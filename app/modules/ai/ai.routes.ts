import express from "express";
import {
  getServiceHealth,
  getTracingDebug,
  queryAIStream,
} from "./ai.controller.ts";
import { aiQueryAuth } from "../../middleware/aiAccessMiddleware.ts";
import { requireAiEntitlement } from "../../middleware/entitlementMiddleware.ts";
import { aiRateLimit } from "../../middleware/aiRateLimitMiddleware.ts";
import { validate } from "../../middleware/validateMiddleware.ts";
import { setAIStreamingHeaders } from "../../middleware/streamingMiddleware.ts";
import { aiQuerySchema } from "./ai.schema.ts";

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
