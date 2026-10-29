import { CHAT_MODEL, EMBEDDING_MODEL } from "./client.ts";
import { completeChat, streamChat } from "./chat.service.ts";
import { embedText, isEmbeddingHealthy } from "./embedding.service.ts";
import { isChatHealthy } from "./health.service.ts";

const id = "ollama";
const chatModel = CHAT_MODEL;
const embeddingModel = EMBEDDING_MODEL;

export {
  id,
  chatModel,
  embeddingModel,
  streamChat,
  completeChat,
  embedText,
  isChatHealthy,
  isEmbeddingHealthy,
};
