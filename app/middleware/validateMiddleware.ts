import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { ZodError } from "zod";

type RequestSource = "body" | "query" | "params";

const validate =
  (schema: ZodTypeAny, source: RequestSource = "body") =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[source]);
      (req as Request & Record<RequestSource, unknown>)[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: "ValidationError",
          message: err.errors[0]?.message || "Validation failed",
          details: err.errors,
        });
        return;
      }
      next(err);
    }
  };

export { validate };
