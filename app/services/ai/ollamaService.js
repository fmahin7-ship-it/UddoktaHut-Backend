import { env } from "../../config/env.js";
import { throwError } from "../../lib/throwError.js";
import { finalChatPrompt, finalSqlPrompt } from "../../utils/prompt.js";

const OLLAMA_BASE_URL = env.OLLAMA_URL || "http://localhost:11434";

// NEW: Streaming version for real-time responses
const queryOllamaStream = async (
  prompt,
  model = "llama3.1:8b",
  isStreaming = true
) => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: isStreaming,
        options: {
          temperature: 0.3,
          top_p: 0.8,
          num_predict: 300, // Increased for complete responses
          num_ctx: 2048,
        },
      }),
    });

    if (!response.ok) {
      throwError(`Ollama API error: ${response.statusText}`, 503);
    }

    return response; // Return the readable stream
  } catch (error) {
    if (error.statusCode) throw error;
    throwError(`Ollama connection failed: ${error.message}`, 503);
  }
};

const queryWithContextStream = async ({ question, dbResults, storeName }) => {
  const prompt = dbResults
    ? finalSqlPrompt(question, storeName, dbResults)
    : finalChatPrompt(question);
  return await queryOllamaStream(prompt);
};

const checkOllamaStatus = async () => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/version`);
    return response.ok;
  } catch (error) {
    return false;
  }
};

export { queryOllamaStream, queryWithContextStream, checkOllamaStatus };
