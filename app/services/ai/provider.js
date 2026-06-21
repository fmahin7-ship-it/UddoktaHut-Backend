import { env } from "../../config/env.js";
import * as ollama from "./ollama/index.js";
import * as openai from "./openai/index.js";

const PROVIDERS = { openai, ollama };

const embeddingCache = new Map();
const CACHE_SIZE_LIMIT = 1000;

const getProvider = () => {
  const provider = PROVIDERS[env.AI_PROVIDER];

  if (!provider) {
    throw new Error(
      `Unknown AI_PROVIDER "${env.AI_PROVIDER}". Use "openai" or "ollama".`
    );
  }

  return provider;
};

const getActiveProvider = () => {
  const provider = getProvider();

  return {
    id: provider.id,
    chatModel: provider.chatModel,
    embeddingModel: provider.embeddingModel,
  };
};

const generateEmbedding = async (text) => {
  if (embeddingCache.has(text)) {
    return embeddingCache.get(text);
  }

  const embedding = await getProvider().embedText(text);

  if (embeddingCache.size >= CACHE_SIZE_LIMIT) {
    const oldestKey = embeddingCache.keys().next().value;
    embeddingCache.delete(oldestKey);
  }

  embeddingCache.set(text, embedding);
  return embedding;
};

const checkChatHealth = () => getProvider().isChatHealthy();

const checkEmbeddingHealth = () => getProvider().isEmbeddingHealthy();

const supportsToolCalling = () => Boolean(getProvider().completeChatWithTools);

const completeChatWithTools = (messages, tools, options) => {
  const provider = getProvider();
  if (!provider.completeChatWithTools) {
    throw new Error(`Tool calling is not supported for provider "${provider.id}"`);
  }
  return provider.completeChatWithTools(messages, tools, options);
};

const streamChatMessages = (messages, options) => {
  const provider = getProvider();
  if (!provider.streamChatMessages) {
    throw new Error(`Message streaming is not supported for provider "${provider.id}"`);
  }
  return provider.streamChatMessages(messages, options);
};

export {
  getActiveProvider,
  generateEmbedding,
  checkChatHealth,
  checkEmbeddingHealth,
  supportsToolCalling,
  completeChatWithTools,
  streamChatMessages,
};
