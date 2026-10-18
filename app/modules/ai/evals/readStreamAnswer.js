/** Drain an SSE-style copilot stream into a single answer string (no HTTP). */
const readStreamAnswer = async (stream) => {
  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  let answer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      for (const line of decoder.decode(value, { stream: true }).split("\n")) {
        if (!line.trim()) continue;

        try {
          const data = JSON.parse(line);
          if (data.response) {
            answer += data.response;
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock();
    if (stream.completed) {
      await stream.completed;
    }
  }

  return answer;
};

export { readStreamAnswer };
