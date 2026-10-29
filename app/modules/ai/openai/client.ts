import OpenAI from "openai";
import { env } from "../../../config/env.ts";

let client: OpenAI | null = null;

const CHAT_MODEL = env.AI_CHAT_MODEL || "gpt-4o-mini";
const EMBEDDING_MODEL = env.AI_EMBEDDING_MODEL || "text-embedding-3-small";

const getOpenAIClient = (): OpenAI => {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  if (!client) {
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  return client;
};

export { CHAT_MODEL, EMBEDDING_MODEL, getOpenAIClient };
