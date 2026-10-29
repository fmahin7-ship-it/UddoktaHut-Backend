import { env } from "../config/env.ts";
import type { AsyncRoute, MaybeAuthRequest } from "../types/http.ts";

type RateBucket = { count: number; resetAt: number };

const buckets = new Map<string, RateBucket>();

const getRateLimitKey = (req: MaybeAuthRequest): string => {
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }

  const headerStore = req.headers["x-store-name"];
  const storeName =
    (typeof headerStore === "string" ? headerStore : undefined) ||
    env.AI_DEV_DEFAULT_STORE ||
    null;

  if (storeName) {
    return `store:${storeName}`;
  }

  return `ip:${req.ip || req.socket?.remoteAddress || "unknown"}`;
};

const consumeRateLimit = (
  key: string,
  maxRequests: number,
  windowMs: number
): {
  allowed: boolean;
  remaining?: number;
  resetAt?: number;
  retryAfterMs?: number;
} => {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > maxRequests) {
    return {
      allowed: false,
      retryAfterMs: Math.max(bucket.resetAt - now, 0),
    };
  }

  return {
    allowed: true,
    remaining: maxRequests - bucket.count,
    resetAt: bucket.resetAt,
  };
};

const aiRateLimit: AsyncRoute = (req, res, next) => {
  const maxRequests = env.AI_RATE_LIMIT_MAX;
  const windowMs = env.AI_RATE_LIMIT_WINDOW_MS;
  const key = getRateLimitKey(req);
  const result = consumeRateLimit(key, maxRequests, windowMs);

  res.setHeader("X-RateLimit-Limit", String(maxRequests));
  res.setHeader(
    "X-RateLimit-Remaining",
    String(Math.max(result.remaining ?? 0, 0))
  );

  if (!result.allowed) {
    const retryAfterSeconds = Math.ceil((result.retryAfterMs ?? 0) / 1000);
    res.setHeader("Retry-After", String(retryAfterSeconds));

    res.status(429).json({
      success: false,
      error: "TooManyRequests",
      message:
        "Too many AI requests. Please wait a moment before asking another question.",
      retryAfterSeconds,
    });
    return;
  }

  next();
};

export { aiRateLimit };
