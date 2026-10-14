import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request meter for real model token usage (chat, tools, embeddings).
 * Independent of Langfuse so billing works with tracing disabled.
 */
const meterStorage = new AsyncLocalStorage();

const runWithUsageMeter = async (fn) => {
  const meter = { totalTokens: 0, modelCalls: 0 };
  const result = await meterStorage.run(meter, fn);
  return { result, usage: meter };
};

/** No-op outside runWithUsageMeter (e.g. scripts, seeders). */
const addModelTokens = (tokens) => {
  const meter = meterStorage.getStore();
  if (!meter || !Number.isFinite(tokens) || tokens <= 0) return;
  meter.totalTokens += tokens;
  meter.modelCalls += 1;
};

export { runWithUsageMeter, addModelTokens };
