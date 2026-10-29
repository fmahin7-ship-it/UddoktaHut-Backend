import { env } from "../../config/env.ts";
import * as ollamaMod from "./ollama/index.ts";
import * as openaiMod from "./openai/index.ts";
import type {
  AiProvider,
  ChatMessage,
  ChatOptions,
  CompatibleStream,
  ToolDefinition,
} from "./types.ts";

const openaiProvider: AiProvider = {
  id: openaiMod.id,
  chatModel: openaiMod.chatModel,
  embeddingModel: openaiMod.embeddingModel,
  embedText: openaiMod.embedText,
  isChatHealthy: openaiMod.isChatHealthy,
  isEmbeddingHealthy: openaiMod.isEmbeddingHealthy,
  completeChatWithTools: openaiMod.completeChatWithTools,
  streamChatMessages: openaiMod.streamChatMessages,
};

const ollamaProvider: AiProvider = {
  id: ollamaMod.id,
  chatModel: ollamaMod.chatModel,
  embeddingModel: ollamaMod.embeddingModel,
  embedText: ollamaMod.embedText,
  isChatHealthy: ollamaMod.isChatHealthy,
  isEmbeddingHealthy: ollamaMod.isEmbeddingHealthy,
};

const PROVIDERS: Record<string, AiProvider> = {
  openai: openaiProvider,
  ollama: ollamaProvider,
};

const embeddingCache = new Map<string, number[]>();
const CACHE_SIZE_LIMIT = 1000;

const getProvider = (): AiProvider => {
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

const generateEmbedding = async (text: string): Promise<number[]> => {
  const cached = embeddingCache.get(text);
  if (cached) {
    return cached;
  }

  const embedding = await getProvider().embedText(text);

  if (embeddingCache.size >= CACHE_SIZE_LIMIT) {
    const oldestKey = embeddingCache.keys().next().value;
    if (oldestKey !== undefined) {
      embeddingCache.delete(oldestKey);
    }
  }

  embeddingCache.set(text, embedding);
  return embedding;
};

const checkChatHealth = () => getProvider().isChatHealthy();

const checkEmbeddingHealth = () => getProvider().isEmbeddingHealthy();

const supportsToolCalling = () => Boolean(getProvider().completeChatWithTools);

const completeChatWithTools = (
  messages: ChatMessage[],
  tools: ToolDefinition[],
  options?: ChatOptions
) => {
  const provider = getProvider();
  if (!provider.completeChatWithTools) {
    throw new Error(`Tool calling is not supported for provider "${provider.id}"`);
  }
  return provider.completeChatWithTools(messages, tools, options);
};

const streamChatMessages = (
  messages: ChatMessage[],
  options?: ChatOptions
): Promise<CompatibleStream> => {
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
