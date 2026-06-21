/** SSE-compatible stream for a pre-generated assistant message (no extra LLM call). */
const createTextStream = (text) => {
  const encoder = new TextEncoder();
  let resolveComplete;
  const completed = new Promise((resolve) => {
    resolveComplete = resolve;
  });

  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`${JSON.stringify({ response: text })}\n`)
      );
      controller.enqueue(
        encoder.encode(`${JSON.stringify({ response: "", done: true })}\n`)
      );
      controller.close();
      resolveComplete();
    },
  });

  return { body, completed };
};

export { createTextStream };
