/** SSE-compatible stream for a pre-generated assistant message (no extra LLM call). */
const createTextStream = (text: string) => {
  const encoder = new TextEncoder();
  let resolveComplete: (() => void) | undefined;
  const completed = new Promise<void>((resolve) => {
    resolveComplete = resolve;
  });

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(`${JSON.stringify({ response: text })}\n`)
      );
      controller.enqueue(
        encoder.encode(`${JSON.stringify({ response: "", done: true })}\n`)
      );
      controller.close();
      resolveComplete?.();
    },
  });

  return { body, completed };
};

export { createTextStream };
