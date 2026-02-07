type RateLimitInput = {
  namespace: string;
  key: string;
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function consumeMemoryRateLimit(input: RateLimitInput) {
  const now = Date.now();
  const bucketKey = `${input.namespace}:${input.key}`;
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + input.windowMs;
    buckets.set(bucketKey, { count: 1, resetAt });
    return {
      ok: true,
      remaining: Math.max(0, input.limit - 1),
      retryAfterMs: input.windowMs,
    };
  }

  if (existing.count >= input.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(0, existing.resetAt - now),
    };
  }

  existing.count += 1;
  buckets.set(bucketKey, existing);
  return {
    ok: true,
    remaining: Math.max(0, input.limit - existing.count),
    retryAfterMs: Math.max(0, existing.resetAt - now),
  };
}
