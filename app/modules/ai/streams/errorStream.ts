const createErrorStream = (message: string): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`${JSON.stringify({ response: message, done: true })}\n`)
      );
      controller.close();
    },
  });
};

export { createErrorStream };
