/** Collect streamed assistant text for offline eval scoring. */
const readStreamAnswer = async (stream: {
  body?: ReadableStream<Uint8Array> | null;
}): Promise<string> => {
  if (!stream?.body) return "";

  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  let answer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as { response?: string };
        if (parsed.response) answer += parsed.response;
      } catch {
        // ignore non-JSON lines
      }
    }
  }

  return answer;
};

export { readStreamAnswer };
