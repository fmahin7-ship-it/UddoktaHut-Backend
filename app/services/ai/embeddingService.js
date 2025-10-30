import { throwError } from "../../lib/throwError.js";
import { env } from "../../config/env.js";

const OLLAMA_BASE_URL = env.OLLAMA_URL || "http://localhost:11434";
const EMBEDDING_MODEL = "nomic-embed-text";

const embeddingCache = new Map();
const CACHE_SIZE_LIMIT = 1000; // Limit cache size

const generateEmbedding = async (text) => {
  try {
    // Check cache first
    if (embeddingCache.has(text)) {
      console.log("Using cached embedding");
      return embeddingCache.get(text);
    }

    const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nomic-embed-text",
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Embedding service responded with status: ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.embedding) {
      throw new Error("No embedding returned from service");
    }

    // Cache the result (with size limit)
    if (embeddingCache.size >= CACHE_SIZE_LIMIT) {
      // Remove oldest entry
      const firstKey = embeddingCache.keys().next().value;
      embeddingCache.delete(firstKey);
    }
    embeddingCache.set(text, data.embedding);

    return data.embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
};

const checkEmbeddingStatus = async () => {
  try {
    const response = await fetch("http://localhost:11434/api/tags");
    const data = await response.json();

    const embeddingModel = data.models?.find((model) =>
      model.name.includes("nomic-embed-text")
    );

    return {
      available: !!embeddingModel,
      model: embeddingModel?.name || null,
      size: embeddingModel?.size || null,
    };
  } catch (error) {
    return {
      available: false,
      error: error.message,
    };
  }
};

const batchGenerateEmbeddings = async (textArray) => {
  try {
    const embeddings = await Promise.all(
      textArray.map((text) => generateEmbedding(text))
    );
    return embeddings;
  } catch (error) {
    throwError(`Batch embedding failed: ${error.message}`, 503);
  }
};

const checkEmbeddingModel = async () => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/show`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: EMBEDDING_MODEL,
      }),
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};

export {
  generateEmbedding,
  batchGenerateEmbeddings,
  checkEmbeddingModel,
  checkEmbeddingStatus,
};
