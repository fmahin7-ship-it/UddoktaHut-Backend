/** Shared chat / tool types for AI providers and copilot. */

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole | string;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type ChatInput =
  | string
  | {
      system?: string;
      user: string;
    };

export type TokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type OpenAIUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type ToolCall = {
  id: string;
  type?: string;
  function: {
    name: string;
    arguments: string;
  };
};

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ChatOptions = {
  model?: string;
  traceName?: string;
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
};

export type CompatibleStream = {
  body: ReadableStream<Uint8Array>;
  completed: Promise<void>;
};

export type AiProvider = {
  id: string;
  chatModel: string;
  embeddingModel: string;
  embedText: (text: string) => Promise<number[]>;
  isChatHealthy: () => Promise<boolean> | boolean;
  isEmbeddingHealthy: () => Promise<boolean> | boolean;
  completeChatWithTools?: (
    messages: ChatMessage[],
    tools: ToolDefinition[],
    options?: ChatOptions
  ) => Promise<ChatMessage | null | undefined>;
  streamChatMessages?: (
    messages: ChatMessage[],
    options?: ChatOptions
  ) => Promise<CompatibleStream>;
};
