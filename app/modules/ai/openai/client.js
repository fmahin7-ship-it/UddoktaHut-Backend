import OpenAI from "openai";
import { env } from "../../../config/env.js";

let client = null;

const CHAT_MODEL = env.AI_CHAT_MODEL || "gpt-4o-mini";
const EMBEDDING_MODEL = env.AI_EMBEDDING_MODEL || "text-embedding-3-small";

const getOpenAIClient = () => {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  if (!client) {
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  return client;
};

export { CHAT_MODEL, EMBEDDING_MODEL, getOpenAIClient };
