import express from "express";
import {
  getServiceHealth,
  getTracingDebug,
  queryAIStream,
} from "../controllers/aiController.js";
import { aiQueryAuth } from "../middleware/aiAccessMiddleware.js";
import { aiRateLimit } from "../middleware/aiRateLimitMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { setAIStreamingHeaders } from "../middleware/streamingMiddleware.js";
import { aiQuerySchema } from "../validations/aiValidation.js";

const aiRoutes = express.Router();

// Custom implementation endpoints
aiRoutes.get("/health", getServiceHealth);
aiRoutes.get("/tracing-debug", getTracingDebug);
aiRoutes.post(
  "/query",
  aiQueryAuth,
  aiRateLimit,
  setAIStreamingHeaders,
  validate(aiQuerySchema),
  queryAIStream
);

export { aiRoutes };
