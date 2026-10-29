import { CHAT_MODEL, EMBEDDING_MODEL } from "./client.ts";
import {
  completeChat,
  completeChatWithTools,
  streamChat,
  streamChatMessages,
} from "./chat.service.ts";
import { embedText, isEmbeddingHealthy } from "./embedding.service.ts";
import { isChatHealthy } from "./health.service.ts";

const id = "openai";
const chatModel = CHAT_MODEL;
const embeddingModel = EMBEDDING_MODEL;

export {
  id,
  chatModel,
  embeddingModel,
  streamChat,
  completeChat,
  completeChatWithTools,
  streamChatMessages,
  embedText,
  isChatHealthy,
  isEmbeddingHealthy,
};
