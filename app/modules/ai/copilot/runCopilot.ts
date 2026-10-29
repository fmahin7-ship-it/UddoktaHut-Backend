import { throwError } from "../../../lib/throwError.ts";
import { buildIntentQuery } from "../chat/chatHistory.ts";
import { readStreamAnswer } from "../evals/readStreamAnswer.ts";
import { applyIntentPolicy } from "../intent/applyIntentPolicy.ts";
import { INTENT_TIERS } from "../intent/constants.ts";
import { resolveIntent } from "../intent/index.ts";
import { updateActiveTrace, withSpan } from "../observability/aiTrace.ts";
import { completeChatWithTools, streamChatMessages } from "../provider.ts";
import {
  buildSecurityErrorResponse,
  buildValidationErrorResponse,
} from "../streams/queryResponse.ts";
import { createTextStream } from "../streams/textStream.ts";
import { runTool } from "../tools/registry.ts";
import type { ChatMessage, ToolCall } from "../types.ts";
import { validateBusinessContext } from "../validation/questionValidator.ts";
import { buildCopilotMessages } from "./prompts.ts";

const MAX_TOOL_ROUNDS = 3;

type IntentMatch = {
  tool_name: string;
  similarity: number;
  matched_utterance?: string;
};

type IntentPolicy = {
  tier: string;
  toolNames: string[];
  toolsToExpose: unknown[];
  topConfidence: number;
  autoRunTool?: string | null;
};

type CopilotMetadata = {
  type: string;
  toolsUsed: string[];
  intentMatches: string[];
  intentTier: string;
  intentToolFilter: string[];
  intentConfidence: number;
  direct: boolean;
};

type HistoryMessage = { role: string; content: string };

const serializeToolResult = (result: unknown): string => {
  try {
    return JSON.stringify(result ?? null);
  } catch {
    return JSON.stringify({ error: "Result could not be serialized" });
  }
};

const buildResponseMetadata = ({
  toolsUsed,
  intentMatches,
  intentPolicy,
  direct = false,
}: {
  toolsUsed: string[];
  intentMatches: IntentMatch[];
  intentPolicy: IntentPolicy;
  direct?: boolean;
}): CopilotMetadata => ({
  type: "copilot",
  toolsUsed,
  intentMatches: intentMatches.map((m) => m.tool_name),
  intentTier: intentPolicy.tier,
  intentToolFilter: intentPolicy.toolNames,
  intentConfidence: intentPolicy.topConfidence,
  direct,
});

const appendAutoRunToolMessages = (
  messages: ChatMessage[],
  toolName: string,
  toolResult: unknown
): ChatMessage[] => {
  const callId = `call_intent_${toolName}`;

  messages.push({
    role: "assistant",
    content: null,
    tool_calls: [
      {
        id: callId,
        type: "function",
        function: { name: toolName, arguments: "{}" },
      },
    ],
  });

  messages.push({
    role: "tool",
    tool_call_id: callId,
    content: serializeToolResult(toolResult),
  });

  return messages;
};

const buildEvalResult = async ({
  stream,
  metadata,
  toolsUsed,
  toolResults,
  refused = false,
  errorType = null,
}: {
  stream: unknown;
  metadata: unknown;
  toolsUsed: string[];
  toolResults: Record<string, unknown>;
  refused?: boolean;
  errorType?: string | null;
}) => ({
  refused,
  errorType,
  answer: await readStreamAnswer(stream as never),
  toolsUsed,
  toolResults,
  metadata,
});

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const errorStatus = (error: unknown): number | undefined => {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number"
  ) {
    return (error as { statusCode: number }).statusCode;
  }
  return undefined;
};

/**
 * Shared copilot pipeline for HTTP streaming and offline evals.
 */
const runCopilot = async (
  question: string,
  storeName: string,
  {
    collectAnswer = false,
    history = [],
  }: { collectAnswer?: boolean; history?: HistoryMessage[] } = {}
) => {
  const validation = await withSpan(
    "validate-context",
    { question },
    async () => validateBusinessContext(question, { storeName })
  );

  if (!validation.isValid) {
    updateActiveTrace({
      output: { errorType: validation.errorType, message: validation.message },
    });
    const errorResponse = buildValidationErrorResponse(validation, {
      type: "copilot",
    });

    if (!collectAnswer) {
      return errorResponse;
    }

    return buildEvalResult({
      stream: errorResponse.stream,
      metadata: errorResponse.metadata,
      toolsUsed: [],
      toolResults: {},
      refused: true,
      errorType: validation.errorType,
    });
  }

  const intentQuery = buildIntentQuery(question, history);
  const intentMatches: IntentMatch[] = await resolveIntent(intentQuery);
  const intentPolicy = applyIntentPolicy(intentMatches) as IntentPolicy;
  const toolsToExpose = intentPolicy.toolsToExpose;

  updateActiveTrace({
    metadata: {
      intentQuery: history.length > 0 ? intentQuery : undefined,
      intentTier: intentPolicy.tier,
      intentToolFilter: intentPolicy.toolNames,
      intentConfidence: intentPolicy.topConfidence,
      intentMatches: intentMatches.map((m) => ({
        tool: m.tool_name,
        confidence: m.similarity,
      })),
    },
  });

  const ctx = { storeName };
  let messages: ChatMessage[] = buildCopilotMessages(question, storeName, {
    intentMatches,
    tier: intentPolicy.tier,
    history,
  });
  const toolsUsed: string[] = [];
  const toolResults: Record<string, unknown> = {};

  try {
    if (intentPolicy.tier === INTENT_TIERS.AUTO && intentPolicy.autoRunTool) {
      console.log(
        `[Copilot] Auto-running tool "${intentPolicy.autoRunTool}" with confidence ${intentPolicy.topConfidence}`
      );
      const toolName = intentPolicy.autoRunTool;
      const result = await runTool(toolName, "{}", ctx);
      toolsUsed.push(toolName);
      toolResults[toolName] = result;

      messages = appendAutoRunToolMessages(messages, toolName, result);

      const stream = await streamChatMessages(messages, {
        traceName: "copilot-answer-stream-auto",
      });

      updateActiveTrace({ output: { toolsUsed, intentTier: INTENT_TIERS.AUTO } });

      const metadata = buildResponseMetadata({
        toolsUsed,
        intentMatches,
        intentPolicy,
      });

      if (!collectAnswer) {
        return { stream, metadata };
      }

      return buildEvalResult({
        stream,
        metadata,
        toolsUsed,
        toolResults,
      });
    }

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      console.log(
        `[Copilot] Tool round ${round + 1} with ${toolsToExpose.length} tool(s) exposed. Tools used so far: ${toolsUsed.join(", ") || "none"}`
      );
      const assistantMessage = await completeChatWithTools(
        messages,
        toolsToExpose as never,
        { traceName: `copilot-tools-round-${round}` }
      );

      const toolCalls: ToolCall[] = (assistantMessage?.tool_calls ?? []) as ToolCall[];

      if (toolCalls.length === 0) {
        const directText = assistantMessage?.content?.trim();
        if (directText) {
          const stream = createTextStream(directText);
          const metadata = buildResponseMetadata({
            toolsUsed,
            intentMatches,
            intentPolicy,
            direct: true,
          });

          if (!collectAnswer) {
            return { stream, metadata };
          }

          return {
            refused: false,
            errorType: null,
            answer: directText,
            toolsUsed,
            toolResults,
            metadata,
          };
        }
        break;
      }

      messages.push({
        role: "assistant",
        content: assistantMessage?.content ?? null,
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        const name = call.function?.name;
        const rawArgs = call.function?.arguments ?? "{}";
        const result = await runTool(name, rawArgs, ctx);
        toolsUsed.push(name);
        toolResults[name] = result;

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: serializeToolResult(result),
        });
      }
    }

    const stream = await streamChatMessages(messages, {
      traceName: "copilot-answer-stream",
    });

    updateActiveTrace({ output: { toolsUsed, intentTier: intentPolicy.tier } });

    const metadata = buildResponseMetadata({
      toolsUsed,
      intentMatches,
      intentPolicy,
    });

    if (!collectAnswer) {
      return { stream, metadata };
    }

    return buildEvalResult({
      stream,
      metadata,
      toolsUsed,
      toolResults,
    });
  } catch (error: unknown) {
    const status = errorStatus(error);
    if (status === 400) {
      updateActiveTrace({
        output: { error: errorMessage(error), errorType: "security" },
      });
      const errorResponse = buildSecurityErrorResponse(error, storeName, {
        type: "copilot",
      });

      if (!collectAnswer) {
        return errorResponse;
      }

      return buildEvalResult({
        stream: errorResponse.stream,
        metadata: errorResponse.metadata,
        toolsUsed: [],
        toolResults: {},
        refused: true,
        errorType: "security",
      });
    }
    if (status) throw error;
    throwError(`Copilot failed: ${errorMessage(error)}`, 500);
  }
};

export { runCopilot };
