import type { Response } from "express";
import { resolveAIStoreContext } from "../../utils/resolveAIStoreContext.ts";
import type { AsyncRoute } from "../../types/http.ts";
import {
  estimateTokens,
  recordAiTokenUsage,
} from "../subscriptions/aiUsageService.ts";
import { normalizeChatHistory } from "./chat/chatHistory.ts";
import {
  checkAIServices,
  getAIServiceStatus,
  processAIQueryStream,
} from "./aiService.ts";
import { runWithAITrace } from "./observability/aiTrace.ts";
import { runWithUsageMeter } from "./observability/usageMeter.ts";
import { recordOllamaUsage } from "./ollama/chat.service.ts";
import {
  fetchRecentTraceCount,
  isLangfuseEnabled,
} from "./observability/langfuseClient.ts";

type StreamLike = {
  body: ReadableStream<Uint8Array>;
  completed?: Promise<unknown>;
};

const pipeStreamToResponse = async (
  stream: StreamLike,
  res: Response
): Promise<string> => {
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
          const data = JSON.parse(line) as {
            response?: string;
            [key: string]: unknown;
          };
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
};

const queryAIStream: AsyncRoute = async (req, res, next) => {
  try {
    const body = req.body as {
      question: string;
      useRAG?: boolean;
      history?: unknown;
    };
    const { question, useRAG, history: rawHistory } = body;
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
          provider: servicesStatus.provider ?? undefined,
          useRAG: false,
        },
        async () => {
          void useRAG;
          const result = (await processAIQueryStream(question, storeName, {
            history,
          })) as {
            stream?: StreamLike;
            data?: { answer?: string };
            metadata?: { message?: string };
          };

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

const getTracingDebug: AsyncRoute = async (_req, res) => {
  const stats = await fetchRecentTraceCount();
  res.json({
    enabled: isLangfuseEnabled(),
    dashboard: "https://jp.cloud.langfuse.com",
    hint: "Open Tracing → Traces, set time filter to Last 24 hours, search name ai-query",
    stats,
  });
};

const getServiceHealth: AsyncRoute = async (_req, res, next) => {
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

export { queryAIStream, getServiceHealth, getTracingDebug };
