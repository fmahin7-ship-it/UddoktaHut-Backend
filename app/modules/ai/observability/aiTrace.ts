import { AsyncLocalStorage } from "node:async_hooks";
import {
  flushLangfuse,
  getLangfuseClient,
  isLangfuseEnabled,
} from "./langfuseClient.ts";

// Langfuse SDK trace shape varies by version; keep a minimal structural type.
type TraceHandle = {
  update: (payload: Record<string, unknown>) => void;
  span: (payload: Record<string, unknown>) => {
    end: (payload: Record<string, unknown>) => void;
  };
  generation: (payload: Record<string, unknown>) => {
    end: (payload: Record<string, unknown>) => void;
  };
};

type TraceContext = {
  userId?: number | string | null;
  storeName?: string;
  provider?: string;
  useRAG?: boolean;
  question?: string;
};

type GenerationResult<T> = {
  value: T;
  output: unknown;
  usage?: unknown;
};

const traceStorage = new AsyncLocalStorage<{ trace: TraceHandle }>();

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const errorStatus = (error: unknown): number => {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number"
  ) {
    return (error as { statusCode: number }).statusCode;
  }
  return 500;
};

const summarizeDbResults = (results: unknown) => {
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

const getActiveTrace = (): TraceHandle | null =>
  traceStorage.getStore()?.trace ?? null;

const updateActiveTrace = (payload: Record<string, unknown>) => {
  const trace = getActiveTrace();
  if (trace) {
    trace.update(payload);
  }
};

const runWithAITrace = async <T>(
  context: TraceContext,
  fn: () => Promise<T> | T
): Promise<T> => {
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
  }) as TraceHandle;

  if (process.env.NODE_ENV === "development") {
    console.log(
      `[Langfuse] trace started id=${traceId} session=${context.storeName} user=${context.userId ?? "anon"}`
    );
  }

  try {
    const result = (await traceStorage.run({ trace }, fn)) as
      | (T & { metadata?: unknown; answerPreview?: string | null })
      | undefined;
    trace.update({
      output: {
        metadata:
          result && typeof result === "object" && "metadata" in result
            ? result.metadata ?? null
            : null,
        answerPreview:
          result && typeof result === "object" && "answerPreview" in result
            ? result.answerPreview ?? null
            : null,
      },
    });
    return result as T;
  } catch (error: unknown) {
    trace.update({
      output: { error: errorMessage(error) },
      metadata: { statusCode: errorStatus(error) },
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

const withSpan = async <T>(
  name: string,
  input: unknown,
  fn: () => Promise<T> | T
): Promise<T> => {
  const trace = getActiveTrace();
  if (!trace) {
    return fn();
  }

  const span = trace.span({ name, input });

  try {
    const output = await fn();
    span.end({ output });
    return output;
  } catch (error: unknown) {
    span.end({
      output: { error: errorMessage(error) },
      level: "ERROR",
    });
    throw error;
  }
};

const withGeneration = async <T>(
  name: string,
  {
    model,
    input,
    modelParameters,
  }: {
    model?: string;
    input?: unknown;
    modelParameters?: Record<string, unknown>;
  },
  fn: () => Promise<GenerationResult<T>> | GenerationResult<T>
): Promise<T> => {
  const trace = getActiveTrace();
  if (!trace) {
    return (await fn()).value;
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
  } catch (error: unknown) {
    generation.end({
      output: { error: errorMessage(error) },
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
