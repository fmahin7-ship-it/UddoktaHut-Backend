import {
  checkAIServices,
  getAIServiceStatus,
  processAIQueryStream,
} from "./aiService.js";
import { runWithAITrace } from "./observability/aiTrace.js";
import { runWithUsageMeter } from "./observability/usageMeter.js";
import { recordOllamaUsage } from "./ollama/chat.service.js";
import {
  fetchRecentTraceCount,
  isLangfuseEnabled,
} from "./observability/langfuseClient.js";
import { resolveAIStoreContext } from "../../utils/resolveAIStoreContext.js";
import {
  estimateTokens,
  recordAiTokenUsage,
} from "../subscriptions/aiUsageService.js";
import { normalizeChatHistory } from "./chat/chatHistory.js";

const queryAIStream = async (req, res, next) => {
  try {
    const { question, useRAG, history: rawHistory } = req.body;
    const history = normalizeChatHistory(rawHistory);
    const storeName = resolveAIStoreContext(req);
    const storeId = req.ownerStoreContext?.store?.id;
    const servicesStatus = await checkAIServices();

    let answerText = "";

    const { usage } = await runWithUsageMeter(() =>
      runWithAITrace(
        {
          question,
          storeName,
          userId: req.user?.id,
          provider: servicesStatus.provider,
          useRAG: false,
        },
        async () => {
          const result = await processAIQueryStream(question, storeName, {
            useRAG,
            history,
          });

          if (!result.stream) {
            answerText = result.data?.answer ?? result.metadata?.message ?? "";
            res.write(answerText);
            res.end();
            return result;
          }

          answerText = await pipeStreamToResponse(result.stream, res);
          return { ...result, answerPreview: answerText.slice(0, 500) };
        }
      )
    );

    if (storeId) {
      const tokens =
        usage.totalTokens ||
        estimateTokens(
          `${question}${answerText}${history.map((t) => t.content).join("")}`
        );
      await recordAiTokenUsage(storeId, tokens);
    }
  } catch (err) {
    next(err);
  }
};

const getTracingDebug = async (req, res) => {
  const stats = await fetchRecentTraceCount();
  res.json({
    enabled: isLangfuseEnabled(),
    dashboard: "https://jp.cloud.langfuse.com",
    hint: "Open Tracing → Traces, set time filter to Last 24 hours, search name ai-query",
    stats,
  });
};

const getServiceHealth = async (req, res, next) => {
  try {
    const status = await getAIServiceStatus();

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (err) {
    next(err);
  }
};

async function pipeStreamToResponse(stream, res) {
  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  let answerText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.trim()) continue;

        try {
          const data = JSON.parse(line);
          recordOllamaUsage(data);
          if (data.response) {
            answerText += data.response;
            if (!res.writableEnded) {
              res.write(data.response);
            }
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  } catch (error) {
    console.error("Streaming error:", error);
  } finally {
    reader.releaseLock();
    if (stream.completed) {
      await stream.completed;
    }
    if (!res.writableEnded) {
      res.end();
    }
  }

  return answerText;
}

export { queryAIStream, getServiceHealth, getTracingDebug };
