import {
  checkAIServices,
  getAIServiceStatus,
  processAIQueryStream,
} from "../services/ai/aiService.js";
import { runWithAITrace } from "../services/ai/observability/aiTrace.js";
import {
  fetchRecentTraceCount,
  isLangfuseEnabled,
} from "../services/ai/observability/langfuseClient.js";
import { resolveAIStoreContext } from "../utils/resolveAIStoreContext.js";
import {
  estimateTokens,
  recordAiTokenUsage,
} from "../services/subscription/aiUsageService.js";

const queryAIStream = async (req, res, next) => {
  try {
    const { question, useRAG } = req.body;
    const storeName = resolveAIStoreContext(req);
    const storeId = req.ownerStoreContext?.store?.id;
    const servicesStatus = await checkAIServices();

    let answerText = "";

    await runWithAITrace(
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
        });

        if (!result.stream) {
          answerText = result.data?.answer ?? result.metadata?.message ?? "";
          res.write(answerText);
          res.end();
          return result;
        }

        answerText = await pipeStreamToResponse(result.stream, res);
        return { ...result, answerPreview: answerText };
      }
    );

    if (storeId) {
      const tokens =
        req.recordAiUsage?.(answerText) ??
        estimateTokens(`${question}${answerText}`);
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
  let answerPreview = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.trim()) continue;

        try {
          const data = JSON.parse(line);
          if (data.response) {
            answerPreview += data.response;
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

  return answerPreview.slice(0, 500);
}

export { queryAIStream, getServiceHealth, getTracingDebug };
