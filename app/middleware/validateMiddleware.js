import { ZodError } from "zod";

const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: "ValidationError",
          message: err.errors[0]?.message || "Validation failed",
          details: err.errors,
        });
      }
      next(err);
    }
  };

export { validate };
