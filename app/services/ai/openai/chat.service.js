import { throwError } from "../../../lib/throwError.js";
import { CHAT_MODEL, getOpenAIClient } from "./client.js";

const CHAT_DEFAULTS = { temperature: 0.3, max_tokens: 300 };
const SQL_DEFAULTS = { temperature: 0.1, max_tokens: 500 };

const toMessages = (input) => {
  if (typeof input === "string") {
    return [{ role: "user", content: input }];
  }

  const messages = [];
  if (input.system) {
    messages.push({ role: "system", content: input.system });
  }
  messages.push({ role: "user", content: input.user });
  return messages;
};

const toCompatibleStream = (openaiStream) => {
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of openaiStream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            controller.enqueue(
              encoder.encode(`${JSON.stringify({ response: text })}\n`)
            );
          }
        }

        controller.enqueue(
          encoder.encode(`${JSON.stringify({ response: "", done: true })}\n`)
        );
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return { body };
};

const streamChat = async (input, { model = CHAT_MODEL, ...options } = {}) => {
  try {
    const stream = await getOpenAIClient().chat.completions.create({
      model,
      messages: toMessages(input),
      stream: true,
      ...CHAT_DEFAULTS,
      ...options,
    });

    return toCompatibleStream(stream);
  } catch (error) {
    throwError(`OpenAI chat stream failed: ${error.message}`, 503);
  }
};

const completeChat = async (input, { model = CHAT_MODEL, ...options } = {}) => {
  try {
    const response = await getOpenAIClient().chat.completions.create({
      model,
      messages: toMessages(input),
      stream: false,
      ...SQL_DEFAULTS,
      ...options,
    });

    return response.choices[0]?.message?.content?.trim() || "";
  } catch (error) {
    throwError(`OpenAI chat completion failed: ${error.message}`, 503);
  }
};

export { streamChat, completeChat };
