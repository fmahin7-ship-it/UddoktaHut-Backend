import { env } from "../config/env.js";

const buckets = new Map();

const getRateLimitKey = (req) => {
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }

  const storeName =
    req.headers["x-store-name"] || env.AI_DEV_DEFAULT_STORE || null;

  if (storeName) {
    return `store:${storeName}`;
  }

  return `ip:${req.ip || req.socket?.remoteAddress || "unknown"}`;
};

const consumeRateLimit = (key, maxRequests, windowMs) => {
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

const aiRateLimit = (req, res, next) => {
  const maxRequests = env.AI_RATE_LIMIT_MAX;
  const windowMs = env.AI_RATE_LIMIT_WINDOW_MS;
  const key = getRateLimitKey(req);
  const result = consumeRateLimit(key, maxRequests, windowMs);

  res.setHeader("X-RateLimit-Limit", String(maxRequests));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(result.remaining ?? 0, 0)));

  if (!result.allowed) {
    const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
    res.setHeader("Retry-After", String(retryAfterSeconds));

    return res.status(429).json({
      success: false,
      error: "TooManyRequests",
      message:
        "Too many AI requests. Please wait a moment before asking another question.",
      retryAfterSeconds,
    });
  }

  next();
};

export { aiRateLimit };
