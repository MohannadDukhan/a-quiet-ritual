import { NextRequest, NextResponse } from "next/server";

import { getSessionUserRecord } from "@/lib/admin-auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/security";

type RequireAdminApiRequestInput = {
  request: NextRequest;
  action: string;
  limit?: number;
  windowMs?: number;
};

type AdminApiGuardResult =
  | { ok: true; adminUserId: string }
  | { ok: false; response: NextResponse };

const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

function addRateLimitHeaders(resetAt: Date) {
  return {
    "Retry-After": String(Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))),
  };
}

export async function requireAdminApiRequest({
  request,
  action,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
}: RequireAdminApiRequestInput): Promise<AdminApiGuardResult> {
  if (!isSameOrigin(request)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid origin" }, { status: 403 }),
    };
  }

  const sessionUser = await getSessionUserRecord();
  if (!sessionUser) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (sessionUser.role !== "ADMIN") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const ip = getClientIp(request);
  const ipLimit = await consumeRateLimit({
    key: `admin:${action}:ip:${ip}`,
    limit,
    windowMs,
  });
  if (!ipLimit.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many requests. Slow down and try again." },
        { status: 429, headers: addRateLimitHeaders(ipLimit.resetAt) },
      ),
    };
  }

  const userLimit = await consumeRateLimit({
    key: `admin:${action}:user:${sessionUser.id}`,
    limit,
    windowMs,
  });
  if (!userLimit.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many requests. Slow down and try again." },
        { status: 429, headers: addRateLimitHeaders(userLimit.resetAt) },
      ),
    };
  }

  return {
    ok: true,
    adminUserId: sessionUser.id,
  };
}
