import { createTextStream } from "../streams/textStream.js";
import { throwError } from "../../../lib/throwError.js";
import { validateBusinessContext } from "../validation/questionValidator.js";
import { completeChatWithTools, streamChatMessages } from "../provider.js";
import { runTool } from "../tools/registry.js";
import { buildCopilotMessages } from "./prompts.js";
import { resolveIntent } from "../intent/index.js";
import { applyIntentPolicy } from "../intent/applyIntentPolicy.js";
import { INTENT_TIERS } from "../intent/constants.js";
import {
  buildSecurityErrorResponse,
  buildValidationErrorResponse,
} from "../rag/queryResponse.js";
import { updateActiveTrace, withSpan } from "../observability/aiTrace.js";
import { readStreamAnswer } from "../evals/readStreamAnswer.js";
import { buildIntentQuery } from "../chat/chatHistory.js";

const MAX_TOOL_ROUNDS = 3;

const serializeToolResult = (result) => {
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
}) => ({
  type: "copilot",
  toolsUsed,
  intentMatches: intentMatches.map((m) => m.tool_name),
  intentTier: intentPolicy.tier,
  intentToolFilter: intentPolicy.toolNames,
  intentConfidence: intentPolicy.topConfidence,
  direct,
});

const appendAutoRunToolMessages = (messages, toolName, toolResult) => {
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
}) => ({
  refused,
  errorType,
  answer: await readStreamAnswer(stream),
  toolsUsed,
  toolResults,
  metadata,
});

/**
 * Shared copilot pipeline for HTTP streaming and offline evals.
 * @param {{ collectAnswer?: boolean, history?: Array<{ role: string, content: string }> }} options
 */
const runCopilot = async (
  question,
  storeName,
  { collectAnswer = false, history = [] } = {}
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
  const intentMatches = await resolveIntent(intentQuery);
  const intentPolicy = applyIntentPolicy(intentMatches);
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
  let messages = buildCopilotMessages(question, storeName, {
    intentMatches,
    tier: intentPolicy.tier,
    history,
  });
  const toolsUsed = [];
  const toolResults = {};

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
        toolsToExpose,
        { traceName: `copilot-tools-round-${round}` }
      );

      const toolCalls = assistantMessage.tool_calls ?? [];

      if (toolCalls.length === 0) {
        const directText = assistantMessage.content?.trim();
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
        content: assistantMessage.content ?? null,
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
  } catch (error) {
    if (error.statusCode === 400) {
      updateActiveTrace({
        output: { error: error.message, errorType: "security" },
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
    if (error.statusCode) throw error;
    throwError(`Copilot failed: ${error.message}`, 500);
  }
};

export { runCopilot };
