import { throwError } from "../../../lib/throwError.ts";
import { getActiveTrace } from "../observability/aiTrace.ts";
import { addModelTokens } from "../observability/usageMeter.ts";
import type {
  ChatInput,
  ChatMessage,
  ChatOptions,
  CompatibleStream,
  OpenAIUsage,
  TokenUsage,
  ToolDefinition,
} from "../types.ts";
import { CHAT_MODEL, getOpenAIClient } from "./client.ts";

const CHAT_DEFAULTS = { temperature: 0.3, max_tokens: 300 };
const SQL_DEFAULTS = { temperature: 0.1, max_tokens: 500 };
/** Without this, streamed completions report no token usage. */
const STREAM_OPTIONS = { stream_options: { include_usage: true } };

type GenerationHandle = {
  end: (payload: Record<string, unknown>) => void;
} | null;

type TraceHandle = {
  generation: (payload: Record<string, unknown>) => GenerationHandle;
  update: (payload: Record<string, unknown>) => void;
} | null;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const toMessages = (input: ChatInput): ChatMessage[] => {
  if (typeof input === "string") {
    return [{ role: "user", content: input }];
  }

  const messages: ChatMessage[] = [];
  if (input.system) {
    messages.push({ role: "system", content: input.system });
  }
  messages.push({ role: "user", content: input.user });
  return messages;
};

const toUsage = (usage: OpenAIUsage | null | undefined): TokenUsage | undefined => {
  if (!usage) {
    return undefined;
  }

  addModelTokens(usage.total_tokens ?? 0);

  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
};

const toCompatibleStream = (
  openaiStream: AsyncIterable<{
    usage?: OpenAIUsage | null;
    choices?: Array<{ delta?: { content?: string | null } }>;
  }>,
  generation: GenerationHandle,
  trace: TraceHandle
): CompatibleStream => {
  const encoder = new TextEncoder();
  let fullOutput = "";
  let usage: TokenUsage | undefined;
  let resolveComplete: (() => void) | undefined;
  const completed = new Promise<void>((resolve) => {
    resolveComplete = resolve;
  });

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of openaiStream) {
          if (chunk.usage) {
            usage = toUsage(chunk.usage);
          }
          const text = chunk.choices?.[0]?.delta?.content;
          if (text) {
            fullOutput += text;
            controller.enqueue(
              encoder.encode(`${JSON.stringify({ response: text })}\n`)
            );
          }
        }

        generation?.end({ output: fullOutput, usage });
        trace?.update({
          output: {
            answerPreview: fullOutput.slice(0, 500),
          },
        });

        controller.enqueue(
          encoder.encode(`${JSON.stringify({ response: "", done: true })}\n`)
        );
        controller.close();
      } catch (error: unknown) {
        generation?.end({
          output: { error: errorMessage(error) },
          level: "ERROR",
        });
        controller.error(error);
      } finally {
        resolveComplete?.();
      }
    },
  });

  return { body, completed };
};

const streamChat = async (
  input: ChatInput,
  { model = CHAT_MODEL, traceName = "analysis-stream", ...options }: ChatOptions = {}
): Promise<CompatibleStream> => {
  const trace = getActiveTrace() as TraceHandle;
  const generation = trace?.generation({
    name: traceName,
    model,
    input,
    modelParameters: CHAT_DEFAULTS,
  }) ?? null;

  try {
    const stream = await getOpenAIClient().chat.completions.create({
      model,
      messages: toMessages(input) as never,
      stream: true,
      ...STREAM_OPTIONS,
      ...CHAT_DEFAULTS,
      ...options,
    });

    return toCompatibleStream(stream, generation, trace);
  } catch (error: unknown) {
    generation?.end({
      output: { error: errorMessage(error) },
      level: "ERROR",
    });
    return throwError(`OpenAI chat stream failed: ${errorMessage(error)}`, 503);
  }
};

const completeChat = async (
  input: ChatInput,
  { model = CHAT_MODEL, traceName = "chat-complete", ...options }: ChatOptions = {}
): Promise<string> => {
  const trace = getActiveTrace() as TraceHandle;
  const generation = trace?.generation({
    name: traceName,
    model,
    input,
    modelParameters: SQL_DEFAULTS,
  }) ?? null;

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model,
      messages: toMessages(input) as never,
      stream: false,
      ...SQL_DEFAULTS,
      ...options,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";

    generation?.end({
      output: content,
      usage: toUsage(response.usage ?? undefined),
    });

    return content;
  } catch (error: unknown) {
    generation?.end({
      output: { error: errorMessage(error) },
      level: "ERROR",
    });
    return throwError(`OpenAI chat completion failed: ${errorMessage(error)}`, 503);
  }
};

const TOOL_DEFAULTS = { temperature: 0.2, max_tokens: 500 };

const completeChatWithTools = async (
  messages: ChatMessage[],
  tools: ToolDefinition[],
  { model = CHAT_MODEL, traceName = "copilot-tools", ...options }: ChatOptions = {}
): Promise<ChatMessage | null | undefined> => {
  const trace = getActiveTrace() as TraceHandle;
  const generation = trace?.generation({
    name: traceName,
    model,
    input: messages,
    modelParameters: TOOL_DEFAULTS,
  }) ?? null;

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model,
      messages: messages as never,
      tools: tools as never,
      tool_choice: "auto",
      stream: false,
      ...TOOL_DEFAULTS,
      ...options,
    });

    const message = response.choices[0]?.message as ChatMessage | undefined;

    generation?.end({
      output: message,
      usage: toUsage(response.usage ?? undefined),
    });

    return message;
  } catch (error: unknown) {
    generation?.end({
      output: { error: errorMessage(error) },
      level: "ERROR",
    });
    return throwError(`OpenAI tool completion failed: ${errorMessage(error)}`, 503);
  }
};

const streamChatMessages = async (
  messages: ChatMessage[],
  { model = CHAT_MODEL, traceName = "copilot-stream", ...options }: ChatOptions = {}
): Promise<CompatibleStream> => {
  const trace = getActiveTrace() as TraceHandle;
  const generation = trace?.generation({
    name: traceName,
    model,
    input: messages,
    modelParameters: CHAT_DEFAULTS,
  }) ?? null;

  try {
    const stream = await getOpenAIClient().chat.completions.create({
      model,
      messages: messages as never,
      stream: true,
      ...STREAM_OPTIONS,
      ...CHAT_DEFAULTS,
      ...options,
    });

    return toCompatibleStream(stream, generation, trace);
  } catch (error: unknown) {
    generation?.end({
      output: { error: errorMessage(error) },
      level: "ERROR",
    });
    return throwError(`OpenAI message stream failed: ${errorMessage(error)}`, 503);
  }
};

export { streamChat, completeChat, completeChatWithTools, streamChatMessages };
