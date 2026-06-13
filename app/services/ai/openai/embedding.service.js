import { EMBEDDING_MODEL, getOpenAIClient } from "./client.js";

const embedText = async (text) => {
  const response = await getOpenAIClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error("OpenAI returned no embedding");
  }

  return embedding;
};

const isEmbeddingHealthy = async () => {
  try {
    await getOpenAIClient().embeddings.create({
      model: EMBEDDING_MODEL,
      input: "health-check",
    });
    return true;
  } catch {
    return false;
  }
};

export { embedText, isEmbeddingHealthy };
