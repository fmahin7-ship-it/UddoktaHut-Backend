import type { ErrorRequestHandler } from "express";
import { env } from "../config/env.ts";

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const error = err as Error & {
    statusCode?: number;
    code?: string;
    name?: string;
    details?: unknown;
  };

  const statusCode = error.statusCode || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;

  console.error("🔥 Error", error);

  const publicMessage = isClientError
    ? error.message || "Bad Request"
    : env.isProd
      ? "Internal Server Error"
      : error.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    error: error.code || error.name || (isClientError ? "RequestError" : "ServerError"),
    message: publicMessage,
    ...(isClientError && error.details ? { details: error.details } : {}),
  });
};

export { errorHandler };
