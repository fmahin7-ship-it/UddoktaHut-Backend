import { AsyncLocalStorage } from "node:async_hooks";
import {
  flushLangfuse,
  getLangfuseClient,
  isLangfuseEnabled,
} from "./langfuseClient.js";

const traceStorage = new AsyncLocalStorage();

const summarizeDbResults = (results) => {
  if (!Array.isArray(results)) {
    return results;
  }

  if (results.length === 0) {
    return { rowCount: 0, rows: [] };
  }

  return {
    rowCount: results.length,
    sample: results.slice(0, 3),
  };
};

const getActiveTrace = () => traceStorage.getStore()?.trace ?? null;

const updateActiveTrace = (payload) => {
  const trace = getActiveTrace();
  if (trace) {
    trace.update(payload);
  }
};

const runWithAITrace = async (context, fn) => {
  if (!isLangfuseEnabled()) {
    return fn();
  }

  const langfuse = getLangfuseClient();
  const traceId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const trace = langfuse.trace({
    id: traceId,
    name: "ai-query",
    userId: context.userId ? String(context.userId) : undefined,
    sessionId: context.storeName,
    metadata: {
      storeName: context.storeName,
      provider: context.provider,
      useRAG: context.useRAG,
    },
    input: { question: context.question },
  });

  if (process.env.NODE_ENV === "development") {
    console.log(
      `[Langfuse] trace started id=${traceId} session=${context.storeName} user=${context.userId ?? "anon"}`
    );
  }

  try {
    const result = await traceStorage.run({ trace }, fn);
    trace.update({
      output: {
        metadata: result?.metadata ?? null,
        answerPreview: result?.answerPreview ?? null,
      },
    });
    return result;
  } catch (error) {
    trace.update({
      output: { error: error.message },
      metadata: { statusCode: error.statusCode ?? 500 },
    });
    throw error;
  } finally {
    await flushLangfuse("ai-query");
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[Langfuse] sent trace id=${traceId} — filter Traces by name "ai-query" (UI may lag 30s–2min)`
      );
    }
  }
};

const withSpan = async (name, input, fn) => {
  const trace = getActiveTrace();
  if (!trace) {
    return fn();
  }

  const span = trace.span({ name, input });

  try {
    const output = await fn();
    span.end({ output });
    return output;
  } catch (error) {
    span.end({
      output: { error: error.message },
      level: "ERROR",
    });
    throw error;
  }
};

const withGeneration = async (name, { model, input, modelParameters }, fn) => {
  const trace = getActiveTrace();
  if (!trace) {
    return fn();
  }

  const generation = trace.generation({
    name,
    model,
    input,
    modelParameters,
  });

  try {
    const result = await fn();
    generation.end({
      output: result.output,
      usage: result.usage,
    });
    return result.value;
  } catch (error) {
    generation.end({
      output: { error: error.message },
      level: "ERROR",
    });
    throw error;
  }
};

export {
  getActiveTrace,
  updateActiveTrace,
  runWithAITrace,
  withSpan,
  withGeneration,
  summarizeDbResults,
};
