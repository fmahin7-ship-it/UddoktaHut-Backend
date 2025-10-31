import express from "express";
import {
  getServiceHealth,
  queryAIStream,
} from "../controllers/aiController.js";
import { authenticateUser } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validateMiddleware.js";
import { setAIStreamingHeaders } from "../middleware/streamingMiddleware.js";
import { aiQuerySchema } from "../validations/aiValidation.js";

const aiRoutes = express.Router();

// Custom implementation endpoints
aiRoutes.get("/health", getServiceHealth);
aiRoutes.post(
  "/query",
  // authenticateUser,
  setAIStreamingHeaders,
  validate(aiQuerySchema),
  queryAIStream
);

export { aiRoutes };
