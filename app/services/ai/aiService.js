import {
  processRAGQueryStream,
  processSimpleQueryStream,
} from "./ragService.js";
import { checkOllamaStatus } from "./ollamaService.js";
import { checkEmbeddingModel } from "./embeddingService.js";
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

    const useRAG = options.useRAG !== false; // Default to true

    if (useRAG && servicesStatus.embedding)
      return await processRAGQueryStream(question, storeName);

    return await processSimpleQueryStream(question, storeName);
  } catch (error) {
    if (error.statusCode) throw error;
    throwError(`AI query processing failed: ${error.message}`, 500);
  }
};

const checkAIServices = async () => {
  try {
    const [ollamaStatus, embeddingStatus] = await Promise.allSettled([
      checkOllamaStatus(),
      checkEmbeddingModel(),
    ]);

    const ollama = ollamaStatus.status === "fulfilled" && ollamaStatus.value;
    const embedding =
      embeddingStatus.status === "fulfilled" && embeddingStatus.value;

    return {
      available: ollama, // Minimum requirement
      ollama,
      embedding,
      error: !ollama ? "Ollama service not available" : null,
    };
  } catch (error) {
    return {
      available: false,
      ollama: false,
      embedding: false,
      error: error.message,
    };
  }
};

const getAIServiceStatus = async () => {
  const status = await checkAIServices();
  return {
    timestamp: new Date().toISOString(),
    services: {
      ollama: {
        available: status.ollama,
        model: "llama3.1:8b",
      },
      embedding: {
        available: status.embedding,
        model: "nomic-embed-text",
      },
      vector: {
        available: true,
        type: "default_patterns",
      },
    },
    overallStatus: status.available ? "healthy" : "degraded",
    capabilities: {
      basicQueries: status.ollama,
      ragQueries: status.ollama && status.embedding,
      vectorSearch: true,
    },
  };
};

export { processAIQueryStream, checkAIServices, getAIServiceStatus };
