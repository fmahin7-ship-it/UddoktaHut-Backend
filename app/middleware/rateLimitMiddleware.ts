import type { RequestHandler } from "express";

type Bucket = { count: number; resetAt: number };

type RateLimitOptions = {
  windowMs: number;
  max: number;
  /** Extra identity beyond IP (email, phone, etc.). */
  identityFromBody?: (body: Record<string, unknown>) => string | undefined;
  message?: string;
};

const makeLimiter = (options: RateLimitOptions): RequestHandler => {
  const buckets = new Map<string, Bucket>();
  const {
    windowMs,
    max,
    identityFromBody,
    message = "Too many attempts. Please try again in a minute.",
  } = options;

  return (req, res, next) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const identity = identityFromBody?.(body) || "anon";
    const key = `${req.ip ?? "unknown"}:${identity}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > max) {
      res.status(429).json({
        success: false,
        error: "RateLimited",
        message,
      });
      return;
    }

    next();
  };
};

/** Login / refresh — per IP + email|phone. */
const loginRateLimit = makeLimiter({
  windowMs: 60_000,
  max: 20,
  identityFromBody: (body) =>
    (typeof body.email === "string" && body.email) ||
    (typeof body.phoneNumber === "string" && body.phoneNumber) ||
    undefined,
});

/** OTP send (email/SMS) — stricter to protect SMS cost. */
const otpSendRateLimit = makeLimiter({
  windowMs: 60_000,
  max: 5,
  identityFromBody: (body) =>
    (typeof body.email === "string" && body.email) ||
    (typeof body.phoneNumber === "string" && body.phoneNumber) ||
    undefined,
  message: "Too many OTP requests. Please wait a minute before trying again.",
});

/** OTP verify — limit guessing. */
const otpVerifyRateLimit = makeLimiter({
  windowMs: 60_000,
  max: 10,
  identityFromBody: (body) =>
    (typeof body.email === "string" && body.email) ||
    (typeof body.phoneNumber === "string" && body.phoneNumber) ||
    undefined,
  message: "Too many verification attempts. Please wait a minute.",
});

export { loginRateLimit, otpSendRateLimit, otpVerifyRateLimit, makeLimiter };
