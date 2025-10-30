// Middleware for setting streaming response headers
export const setStreamingHeaders = (req, res, next) => {
  // Only apply to streaming endpoints
  if (req.path.includes("/query") && req.method === "POST") {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering for streaming
    res.setHeader("Transfer-Encoding", "chunked"); // Enable chunked transfer
  }
  next();
};

// Alternative: More specific middleware for AI streaming only
export const setAIStreamingHeaders = (req, res, next) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Transfer-Encoding", "chunked");
  next();
};
