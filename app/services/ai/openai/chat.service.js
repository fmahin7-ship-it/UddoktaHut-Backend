import { throwError } from "../../../lib/throwError.js";
import { getActiveTrace } from "../observability/aiTrace.js";
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

const toUsage = (usage) => {
  if (!usage) {
    return undefined;
  }

  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
};

const toCompatibleStream = (openaiStream, generation, trace) => {
  const encoder = new TextEncoder();
  let fullOutput = "";
  let resolveComplete;
  const completed = new Promise((resolve) => {
    resolveComplete = resolve;
  });

  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of openaiStream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            fullOutput += text;
            controller.enqueue(
              encoder.encode(`${JSON.stringify({ response: text })}\n`)
            );
          }
        }

        generation?.end({ output: fullOutput });
        trace?.update({
          output: {
            answerPreview: fullOutput.slice(0, 500),
          },
        });

        controller.enqueue(
          encoder.encode(`${JSON.stringify({ response: "", done: true })}\n`)
        );
        controller.close();
      } catch (error) {
        generation?.end({
          output: { error: error.message },
          level: "ERROR",
        });
        controller.error(error);
      } finally {
        resolveComplete();
      }
    },
  });

  return { body, completed };
};

const streamChat = async (
  input,
  { model = CHAT_MODEL, traceName = "analysis-stream", ...options } = {}
) => {
  const trace = getActiveTrace();
  const generation = trace?.generation({
    name: traceName,
    model,
    input,
    modelParameters: CHAT_DEFAULTS,
  });

  try {
    const stream = await getOpenAIClient().chat.completions.create({
      model,
      messages: toMessages(input),
      stream: true,
      ...CHAT_DEFAULTS,
      ...options,
    });

    return toCompatibleStream(stream, generation, trace);
  } catch (error) {
    generation?.end({
      output: { error: error.message },
      level: "ERROR",
    });
    throwError(`OpenAI chat stream failed: ${error.message}`, 503);
  }
};

const completeChat = async (
  input,
  { model = CHAT_MODEL, traceName = "chat-complete", ...options } = {}
) => {
  const trace = getActiveTrace();
  const generation = trace?.generation({
    name: traceName,
    model,
    input,
    modelParameters: SQL_DEFAULTS,
  });

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model,
      messages: toMessages(input),
      stream: false,
      ...SQL_DEFAULTS,
      ...options,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";

    generation?.end({
      output: content,
      usage: toUsage(response.usage),
    });

    return content;
  } catch (error) {
    generation?.end({
      output: { error: error.message },
      level: "ERROR",
    });
    throwError(`OpenAI chat completion failed: ${error.message}`, 503);
  }
};

const TOOL_DEFAULTS = { temperature: 0.2, max_tokens: 500 };

const completeChatWithTools = async (
  messages,
  tools,
  { model = CHAT_MODEL, traceName = "copilot-tools", ...options } = {}
) => {
  const trace = getActiveTrace();
  const generation = trace?.generation({
    name: traceName,
    model,
    input: messages,
    modelParameters: TOOL_DEFAULTS,
  });

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: "auto",
      stream: false,
      ...TOOL_DEFAULTS,
      ...options,
    });

    const message = response.choices[0]?.message;

    generation?.end({
      output: message,
      usage: toUsage(response.usage),
    });

    return message;
  } catch (error) {
    generation?.end({
      output: { error: error.message },
      level: "ERROR",
    });
    throwError(`OpenAI tool completion failed: ${error.message}`, 503);
  }
};

const streamChatMessages = async (
  messages,
  { model = CHAT_MODEL, traceName = "copilot-stream", ...options } = {}
) => {
  const trace = getActiveTrace();
  const generation = trace?.generation({
    name: traceName,
    model,
    input: messages,
    modelParameters: CHAT_DEFAULTS,
  });

  try {
    const stream = await getOpenAIClient().chat.completions.create({
      model,
      messages,
      stream: true,
      ...CHAT_DEFAULTS,
      ...options,
    });

    return toCompatibleStream(stream, generation, trace);
  } catch (error) {
    generation?.end({
      output: { error: error.message },
      level: "ERROR",
    });
    throwError(`OpenAI message stream failed: ${error.message}`, 503);
  }
};

export { streamChat, completeChat, completeChatWithTools, streamChatMessages };
