import { throwError } from "../../../lib/throwError.js";
import { CHAT_MODEL, OLLAMA_BASE_URL } from "./client.js";

const CHAT_OPTIONS = {
  temperature: 0.3,
  top_p: 0.8,
  num_predict: 300,
  num_ctx: 2048,
};

const toOllamaPrompt = (input) => {
  if (typeof input === "string") {
    return input;
  }

  if (input.system) {
    return `${input.system}\n\n${input.user}`;
  }

  return input.user;
};

const streamChat = async (input, { model = CHAT_MODEL, stream = true } = {}) => {
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
  } catch (error) {
    if (error.statusCode) throw error;
    throwError(`Ollama connection failed: ${error.message}`, 503);
  }
};

const completeChat = async (input, options = {}) => {
  const response = await streamChat(input, { ...options, stream: false });
  const data = await response.json();
  return data.response?.trim() || "";
};

export { streamChat, completeChat };
