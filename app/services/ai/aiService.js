import {
  processRAGQueryStream,
  processSimpleQueryStream,
} from "./ragService.js";
import {
  checkChatHealth,
  checkEmbeddingHealth,
  getActiveProvider,
} from "./provider.js";
import { throwError } from "../../lib/throwError.js";

const processAIQueryStream = async (question, storeName, options = {}) => {
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

    const useRAG = options.useRAG !== false;

    if (useRAG && servicesStatus.embedding) {
      return processRAGQueryStream(question, storeName);
    }

    return processSimpleQueryStream(question, storeName);
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
    const embedding =
      embeddingStatus.status === "fulfilled" && embeddingStatus.value;

    return {
      available: llm,
      provider: provider.id,
      llm,
      embedding,
      error: !llm ? `${provider.id} LLM service not available` : null,
    };
  } catch (error) {
    return {
      available: false,
      provider: null,
      llm: false,
      embedding: false,
      error: error.message,
    };
  }
};

const getAIServiceStatus = async () => {
  const status = await checkAIServices();
  const provider = getActiveProvider();

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
      },
      vector: {
        available: true,
        type: "default_patterns",
      },
    },
    overallStatus: status.available ? "healthy" : "degraded",
    capabilities: {
      basicQueries: status.llm,
      ragQueries: status.llm && status.embedding,
      vectorSearch: true,
    },
  };
};

export { processAIQueryStream, checkAIServices, getAIServiceStatus };
