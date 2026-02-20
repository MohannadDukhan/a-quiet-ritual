import { NextResponse } from "next/server";

const DEFAULT_RATE_LIMIT_MESSAGE = "too many requests. try again in a few minutes.";

export function rateLimited(message?: string, retryAfterSeconds?: number) {
  const safeRetryAfterSeconds =
    typeof retryAfterSeconds === "number" && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? Math.max(1, Math.floor(retryAfterSeconds))
      : undefined;

  return NextResponse.json(
    {
      error: "RATE_LIMITED",
      message: message || DEFAULT_RATE_LIMIT_MESSAGE,
      ...(safeRetryAfterSeconds ? { retryAfterSeconds: safeRetryAfterSeconds } : {}),
    },
    {
      status: 429,
      headers: safeRetryAfterSeconds ? { "Retry-After": String(safeRetryAfterSeconds) } : undefined,
    },
  );
}
