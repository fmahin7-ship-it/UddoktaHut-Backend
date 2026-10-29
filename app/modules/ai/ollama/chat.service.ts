import { throwError } from "../../../lib/throwError.ts";
import { addModelTokens } from "../observability/usageMeter.ts";
import type { ChatInput } from "../types.ts";
import { CHAT_MODEL, OLLAMA_BASE_URL } from "./client.ts";

const CHAT_OPTIONS = {
  temperature: 0.3,
  top_p: 0.8,
  num_predict: 300,
  num_ctx: 2048,
};

type OllamaChatOptions = {
  model?: string;
  stream?: boolean;
};

type OllamaUsagePayload = {
  response?: string;
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const hasStatusCode = (error: unknown): error is { statusCode: number } =>
  typeof error === "object" &&
  error !== null &&
  "statusCode" in error &&
  typeof (error as { statusCode: unknown }).statusCode === "number";

const toOllamaPrompt = (input: ChatInput): string => {
  if (typeof input === "string") {
    return input;
  }

  if (input.system) {
    return `${input.system}\n\n${input.user}`;
  }

  return input.user;
};

const streamChat = async (
  input: ChatInput,
  { model = CHAT_MODEL, stream = true }: OllamaChatOptions = {}
): Promise<Response> => {
  const prompt = toOllamaPrompt(input);

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream,
        options: CHAT_OPTIONS,
      }),
    });

    if (!response.ok) {
      throwError(`Ollama API error: ${response.statusText}`, 503);
    }

    return response;
  } catch (error: unknown) {
    if (hasStatusCode(error)) throw error;
    return throwError(`Ollama connection failed: ${errorMessage(error)}`, 503);
  }
};

const completeChat = async (
  input: ChatInput,
  options: OllamaChatOptions = {}
): Promise<string> => {
  const response = await streamChat(input, { ...options, stream: false });
  const data = (await response.json()) as OllamaUsagePayload;
  recordOllamaUsage(data);
  return data.response?.trim() || "";
};

/** Ollama reports token counts on the final (done) response object. */
const recordOllamaUsage = (data: OllamaUsagePayload | null | undefined) => {
  if (!data?.done) return;
  addModelTokens((data.prompt_eval_count ?? 0) + (data.eval_count ?? 0));
};

export { streamChat, completeChat, recordOllamaUsage };
