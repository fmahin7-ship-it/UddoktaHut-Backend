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

const processCopilotStream = async (question, storeName) => {
  const validation = await withSpan(
    "validate-context",
    { question },
    async () => validateBusinessContext(question, { storeName })
  );

  if (!validation.isValid) {
    updateActiveTrace({
      output: { errorType: validation.errorType, message: validation.message },
    });
    return buildValidationErrorResponse(validation, { type: "copilot" });
  }

  const intentMatches = await resolveIntent(question);
  const intentPolicy = applyIntentPolicy(intentMatches);
  const toolsToExpose = intentPolicy.toolsToExpose;

  updateActiveTrace({
    metadata: {
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
  });
  const toolsUsed = [];

  try {
    // High confidence + auto-run: execute tool, then LLM streams answer only.
    if (intentPolicy.tier === INTENT_TIERS.AUTO && intentPolicy.autoRunTool) {
      console.log(`[Copilot] Auto-running tool "${intentPolicy.autoRunTool}" with confidence ${intentPolicy.topConfidence}`);
      const toolName = intentPolicy.autoRunTool;
      const result = await runTool(toolName, "{}", ctx);
      toolsUsed.push(toolName);

      messages = appendAutoRunToolMessages(messages, toolName, result);

      const stream = await streamChatMessages(messages, {
        traceName: "copilot-answer-stream-auto",
      });

      updateActiveTrace({ output: { toolsUsed, intentTier: INTENT_TIERS.AUTO } });

      return {
        stream,
        metadata: buildResponseMetadata({
          toolsUsed,
          intentMatches,
          intentPolicy,
        }),
      };
    }

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      console.log(`[Copilot] Tool round ${round + 1} with ${toolsToExpose.length} tool(s) exposed. Tools used so far: ${toolsUsed.join(", ") || "none"}`);
      const assistantMessage = await completeChatWithTools(
        messages,
        toolsToExpose,
        { traceName: `copilot-tools-round-${round}` }
      );

      const toolCalls = assistantMessage.tool_calls ?? [];

      if (toolCalls.length === 0) {
        const directText = assistantMessage.content?.trim();
        if (directText) {
          return {
            stream: createTextStream(directText),
            metadata: buildResponseMetadata({
              toolsUsed,
              intentMatches,
              intentPolicy,
              direct: true,
            }),
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

    return {
      stream,
      metadata: buildResponseMetadata({
        toolsUsed,
        intentMatches,
        intentPolicy,
      }),
    };
  } catch (error) {
    if (error.statusCode === 400) {
      updateActiveTrace({ output: { error: error.message, errorType: "security" } });
      return buildSecurityErrorResponse(error, storeName, { type: "copilot" });
    }
    if (error.statusCode) throw error;
    throwError(`Copilot failed: ${error.message}`, 500);
  }
};

export { processCopilotStream };
