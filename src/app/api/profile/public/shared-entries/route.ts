import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getProfileSharedEntriesPage } from "@/lib/profile-shared-entries";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/security";
import { normalizeUsername, validateNormalizedUsername } from "@/lib/username";

export const runtime = "nodejs";

const querySchema = z.object({
  username: z.string().min(1),
  cursor: z.string().uuid().optional(),
  limit: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return 10;
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return Number.NaN;
      return parsed;
    })
    .refine((value) => Number.isFinite(value), { message: "invalid limit" }),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    username: request.nextUrl.searchParams.get("username") || "",
    cursor: request.nextUrl.searchParams.get("cursor") || undefined,
    limit: request.nextUrl.searchParams.get("limit") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid query." }, { status: 400 });
  }

  const normalizedUsername = normalizeUsername(parsed.data.username);
  const usernameError = validateNormalizedUsername(normalizedUsername);
  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 400 });
  }

  const ip = getClientIp(request);
  const ipLimit = await consumeRateLimit({
    key: `public_profile:ip:${ip}`,
    limit: 240,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipLimit.ok) {
    const retryAfter = Math.max(1, Math.ceil((ipLimit.resetAt.getTime() - Date.now()) / 1000));
    return NextResponse.json(
      { error: "too many requests. try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const scopedLimit = await consumeRateLimit({
    key: `public_profile:${ip}:${normalizedUsername}`,
    limit: 180,
    windowMs: 15 * 60 * 1000,
  });
  if (!scopedLimit.ok) {
    const retryAfter = Math.max(1, Math.ceil((scopedLimit.resetAt.getTime() - Date.now()) / 1000));
    return NextResponse.json(
      { error: "too many requests. try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const user = await prisma.user.findUnique({
    where: { username: normalizedUsername },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "profile not found." }, { status: 404 });
  }

  const limit = Math.max(1, Math.min(20, parsed.data.limit));
  const page = await getProfileSharedEntriesPage({
    userId: user.id,
    cursor: parsed.data.cursor ?? null,
    limit,
  });
  return NextResponse.json(page);
}
