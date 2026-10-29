import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request meter for real model token usage (chat, tools, embeddings).
 * Independent of Langfuse so billing works with tracing disabled.
 */
type UsageMeter = { totalTokens: number; modelCalls: number };

const meterStorage = new AsyncLocalStorage<UsageMeter>();

const runWithUsageMeter = async <T>(
  fn: () => Promise<T> | T
): Promise<{ result: T; usage: UsageMeter }> => {
  const meter: UsageMeter = { totalTokens: 0, modelCalls: 0 };
  const result = await meterStorage.run(meter, fn);
  return { result, usage: meter };
};

/** No-op outside runWithUsageMeter (e.g. scripts, seeders). */
const addModelTokens = (tokens: number) => {
  const meter = meterStorage.getStore();
  if (!meter || !Number.isFinite(tokens) || tokens <= 0) return;
  meter.totalTokens += tokens;
  meter.modelCalls += 1;
};

export { runWithUsageMeter, addModelTokens };
