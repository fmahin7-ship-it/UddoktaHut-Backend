import { addModelTokens } from "../observability/usageMeter.ts";
import { EMBEDDING_MODEL, getOpenAIClient } from "./client.ts";

const embedText = async (text: string): Promise<number[]> => {
  const response = await getOpenAIClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  addModelTokens(response.usage?.total_tokens ?? 0);

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error("OpenAI returned no embedding");
  }

  return embedding;
};

const isEmbeddingHealthy = async (): Promise<boolean> => {
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
