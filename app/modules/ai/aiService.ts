import { env } from "../../config/env.ts";
import { throwError } from "../../lib/throwError.ts";
import { processCopilotStream } from "./copilot/orchestrator.ts";
import { checkIntentResolutionHealth } from "./intent/intentHealth.ts";
import {
  checkChatHealth,
  checkEmbeddingHealth,
  getActiveProvider,
  supportsToolCalling,
} from "./provider.ts";
const shouldUseCopilot = () =>
  env.AI_USE_TOOLS !== false && supportsToolCalling();

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const hasStatusCode = (error: unknown): error is { statusCode: number } =>
  typeof error === "object" &&
  error !== null &&
  "statusCode" in error &&
  typeof (error as { statusCode: unknown }).statusCode === "number";

const processAIQueryStream = async (
  question: string,
  storeName: string,
  {
    history = [],
  }: { history?: Array<{ role: string; content: string }> } = {}
) => {
  try {
    if (
      !question ||
      typeof question !== "string" ||
      question.trim().length === 0
    ) {
      throwError("Question is required and must be a valid string", 400);
    }

    if (
      !storeName ||
      typeof storeName !== "string" ||
      storeName.trim().length === 0
    ) {
      throwError("Valid store name is required", 400);
    }

    const servicesStatus = await checkAIServices();

    if (!servicesStatus.available) {
      throwError(`AI services unavailable: ${servicesStatus.error}`, 503);
    }

    if (!shouldUseCopilot()) {
      throwError(
        "Store AI assistant requires tool calling. Use AI_PROVIDER=openai with AI_USE_TOOLS enabled.",
        503
      );
    }

    try {
      return await processCopilotStream(question, storeName, { history });
    } catch (error: unknown) {
      if (hasStatusCode(error)) throw error;
      console.warn("[AI] Copilot failed:", errorMessage(error));
      throwError("AI assistant temporarily unavailable. Please try again.", 503);
    }
  } catch (error: unknown) {
    if (hasStatusCode(error)) throw error;
    throwError(`AI query processing failed: ${errorMessage(error)}`, 500);
  }
};

const checkAIServices = async () => {
  try {
    const provider = getActiveProvider();
    const [llmStatus, embeddingStatus] = await Promise.allSettled([
      checkChatHealth(),
      checkEmbeddingHealth(),
    ]);

    const llm = llmStatus.status === "fulfilled" && Boolean(llmStatus.value);
    const embedding =
      embeddingStatus.status === "fulfilled" && Boolean(embeddingStatus.value);

    return {
      available: llm,
      provider: provider.id,
      llm,
      embedding,
      toolCalling: shouldUseCopilot(),
      error: !llm ? `${provider.id} LLM service not available` : null,
    };
  } catch (error: unknown) {
    return {
      available: false,
      provider: null,
      llm: false,
      embedding: false,
      toolCalling: false,
      error: errorMessage(error),
    };
  }
};

const getAIServiceStatus = async () => {
  const status = await checkAIServices();
  const provider = getActiveProvider();
  const intentResolution = await checkIntentResolutionHealth();

  return {
    timestamp: new Date().toISOString(),
    provider: provider.id,
    services: {
      llm: {
        available: status.llm,
        model: provider.chatModel,
      },
      embedding: {
        available: status.embedding,
        model: provider.embeddingModel,
        note: "Used for intent resolution (pgvector utterance index)",
      },
      intentResolution: {
        available: intentResolution.available,
        enabled: env.AI_INTENT_RESOLUTION !== false,
        tiered: env.AI_INTENT_TIERED !== false,
        autoRun: env.AI_INTENT_AUTO_RUN !== false,
        utteranceCount: intentResolution.utteranceCount ?? 0,
        thresholds: {
          minConfidence: env.AI_INTENT_MIN_CONFIDENCE,
          highConfidence: env.AI_INTENT_HIGH_CONFIDENCE,
        },
        note: intentResolution.reason,
      },
      toolCalling: {
        available: status.toolCalling,
        tools: [
          "get_store_summary",
          "get_product_stats",
          "list_products",
          "get_low_stock_products",
          "get_categories_breakdown",
          "get_order_summary",
          "get_recent_orders",
          "get_top_selling_products",
          "get_returns_summary",
        ],
      },
    },
    overallStatus: status.available ? "healthy" : "degraded",
    capabilities: {
      copilotTools: status.toolCalling,
      intentResolution: intentResolution.available,
      documentRag: false,
    },
  };
};

export { processAIQueryStream, checkAIServices, getAIServiceStatus };
