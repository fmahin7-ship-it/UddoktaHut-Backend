const createErrorStream = (message) => {
  const encoder = new TextEncoder();
  let index = 0;
  const words = message.split(" ");

  const stream = new ReadableStream({
    start(controller) {
      const sendNextWord = () => {
        if (index < words.length) {
          const word = words[index] + (index < words.length - 1 ? " " : "");
          controller.enqueue(
            encoder.encode(`${JSON.stringify({ response: word })}\n`)
          );
          index++;
          setTimeout(sendNextWord, 50);
        } else {
          controller.enqueue(
            encoder.encode(`${JSON.stringify({ response: "", done: true })}\n`)
          );
          controller.close();
        }
      };
      sendNextWord();
    },
  });

  return {
    getReader: () => stream.getReader(),
  };
};

export { createErrorStream };
