import express from "express";
import { loginRateLimit } from "../../middleware/rateLimitMiddleware.ts";
import { validate } from "../../middleware/validateMiddleware.ts";
import { loginSchema } from "./auth.schema.ts";
import {
  loginUser,
  logout,
  refreshToken,
} from "./auth.controller.ts";

const authRoutes = express.Router();

authRoutes.post("/login", loginRateLimit, validate(loginSchema), loginUser);
authRoutes.get("/logout", logout);
authRoutes.post("/refresh", loginRateLimit, refreshToken);

export { authRoutes };
