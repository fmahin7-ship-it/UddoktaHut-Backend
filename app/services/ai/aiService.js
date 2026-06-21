import { env } from "../../config/env.js";
import { processCopilotStream } from "./copilot/orchestrator.js";
import {
  checkChatHealth,
  checkEmbeddingHealth,
  getActiveProvider,
  supportsToolCalling,

} from "./provider.js";

import { checkIntentResolutionHealth } from "./intent/intentHealth.js";
import { throwError } from "../../lib/throwError.js";


const shouldUseCopilot = () =>
  env.AI_USE_TOOLS !== false && supportsToolCalling();


const processAIQueryStream = async (question, storeName) => {
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
      return await processCopilotStream(question, storeName);
    } catch (error) {
      if (error.statusCode) throw error;
      console.warn("[AI] Copilot failed:", error.message);
      throwError("AI assistant temporarily unavailable. Please try again.", 503);
    }
  } catch (error) {
    if (error.statusCode) throw error;
    throwError(`AI query processing failed: ${error.message}`, 500);
  }
};

const checkAIServices = async () => {
  try {
    const provider = getActiveProvider();
    const [llmStatus, embeddingStatus] = await Promise.allSettled([
      checkChatHealth(),
      checkEmbeddingHealth(),
    ]);

    const llm = llmStatus.status === "fulfilled" && llmStatus.value;
    const embedding = embeddingStatus.status === "fulfilled" && embeddingStatus.value;

    return {
      available: llm,
      provider: provider.id,
      llm,
      embedding,
      toolCalling: shouldUseCopilot(),
      error: !llm ? `${provider.id} LLM service not available` : null,
    };
  } catch (error) {
    return {
      available: false,
      provider: null,
      llm: false,
      embedding: false,
      toolCalling: false,
      error: error.message,
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

