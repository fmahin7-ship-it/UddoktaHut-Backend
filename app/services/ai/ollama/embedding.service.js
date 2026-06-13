import { EMBEDDING_MODEL, OLLAMA_BASE_URL } from "./client.js";

const embedText = async (text) => {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      prompt: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama embedding error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.embedding) {
    throw new Error("No embedding returned from Ollama");
  }

  return data.embedding;
};

const isEmbeddingHealthy = async () => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: EMBEDDING_MODEL }),
    });
    return response.ok;
  } catch {
    return false;
  }
};

export { embedText, isEmbeddingHealthy };
