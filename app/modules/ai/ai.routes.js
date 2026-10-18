import express from "express";
import {
  getServiceHealth,
  getTracingDebug,
  queryAIStream,
} from "./ai.controller.js";
import { aiQueryAuth } from "../../middleware/aiAccessMiddleware.js";
import { requireAiEntitlement } from "../../middleware/entitlementMiddleware.js";
import { aiRateLimit } from "../../middleware/aiRateLimitMiddleware.js";
import { validate } from "../../middleware/validateMiddleware.js";
import { setAIStreamingHeaders } from "../../middleware/streamingMiddleware.js";
import { aiQuerySchema } from "./ai.schema.js";

const aiRoutes = express.Router();

// Custom implementation endpoints
aiRoutes.get("/health", getServiceHealth);
aiRoutes.get("/tracing-debug", getTracingDebug);
aiRoutes.post(
  "/query",
  aiQueryAuth,
  validate(aiQuerySchema),
  requireAiEntitlement,
  aiRateLimit,
  setAIStreamingHeaders,
  queryAIStream
);

export { aiRoutes };
