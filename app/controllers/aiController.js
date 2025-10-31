import {
  getAIServiceStatus,
  processAIQueryStream,
} from "../services/ai/aiService.js";

const queryAIStream = async (req, res, next) => {
  try {
    const { question, useRAG } = req.body;
    const storeName =
      req.headers["x-store-name"] || req.user?.Store?.store_name || "shoporia";

    const result = await processAIQueryStream(question, storeName, { useRAG });

    if (!result.stream) {
      res.write(result.data.answer);
      res.end();
      return;
    }

    const stream = result.stream;
    await streamTheData(stream, res);
  } catch (err) {
    next(err);
  }
};

const getServiceHealth = async (req, res, next) => {
  try {
    const status = await getAIServiceStatus();

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (err) {
    next(err);
  }
};

async function streamTheData(stream, res) {
  const reader = stream.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              // Send each token to the client
              res.write(data.response);
            }
            if (data.done) {
              res.end();
              return;
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
    }
  } catch (error) {
    console.error("Streaming error:", error);
    res.end();
  } finally {
    reader.releaseLock();
    res.end();
  }
}

export { queryAIStream, getServiceHealth };
