import { env } from "../../config/env.js";
import { buildChatPrompt, buildSqlAnalysisPrompt } from "../../utils/prompt.js";
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

const queryChatStream = (prompt, options) =>
  getProvider().streamChat(prompt, options);

const queryChatComplete = (prompt, options) =>
  getProvider().completeChat(prompt, options);

const queryWithContextStream = async ({ question, dbResults, storeName }) => {
  const prompt = dbResults
    ? buildSqlAnalysisPrompt(question, storeName, dbResults)
    : buildChatPrompt(question);

  return queryChatStream(prompt);
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

export {
  getActiveProvider,
  queryChatStream,
  queryChatComplete,
  queryWithContextStream,
  generateEmbedding,
  checkChatHealth,
  checkEmbeddingHealth,
};
