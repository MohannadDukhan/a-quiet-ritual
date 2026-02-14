import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOriginReadRequest } from "@/lib/security";
import { normalizeUsername, validateNormalizedUsername } from "@/lib/username";

export const runtime = "nodejs";

function errorResponse(status: number, normalized: string, error: string) {
  return NextResponse.json(
    {
      available: false,
      normalized,
      error,
    },
    { status },
  );
}

export async function GET(request: NextRequest) {
  if (!isSameOriginReadRequest(request)) {
    return errorResponse(403, "", "invalid origin.");
  }

  const ip = getClientIp(request);
  const ipLimit = await consumeRateLimit({
    key: `username-check:ip:${ip}`,
    limit: 120,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipLimit.ok) {
    const retryAfter = Math.max(1, Math.ceil((ipLimit.resetAt.getTime() - Date.now()) / 1000));
    return NextResponse.json(
      {
        available: false,
        normalized: "",
        error: "too many username checks. try again later.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  const rawUsername = request.nextUrl.searchParams.get("username") || "";
  const normalized = normalizeUsername(rawUsername);
  const validationError = validateNormalizedUsername(normalized);
  if (validationError) {
    return errorResponse(400, normalized, validationError);
  }

  const usernameLimit = await consumeRateLimit({
    key: `username-check:user:${ip}:${normalized}`,
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!usernameLimit.ok) {
    const retryAfter = Math.max(1, Math.ceil((usernameLimit.resetAt.getTime() - Date.now()) / 1000));
    return NextResponse.json(
      {
        available: false,
        normalized,
        error: "too many checks for that username. try again later.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  const existing = await prisma.user.findUnique({
    where: { username: normalized },
    select: { id: true },
  });

  return NextResponse.json({
    available: !existing,
    normalized,
  });
}
