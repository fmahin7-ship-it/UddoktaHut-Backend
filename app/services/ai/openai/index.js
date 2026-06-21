import { CHAT_MODEL, EMBEDDING_MODEL } from "./client.js";
import {
  completeChat,
  completeChatWithTools,
  streamChat,
  streamChatMessages,
} from "./chat.service.js";
import { embedText, isEmbeddingHealthy } from "./embedding.service.js";
import { isChatHealthy } from "./health.service.js";

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
