import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getProfileSharedEntriesPage } from "@/lib/profile-shared-entries";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOriginReadRequest } from "@/lib/security";

export const runtime = "nodejs";

const querySchema = z.object({
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
  if (!isSameOriginReadRequest(request)) {
    return NextResponse.json({ error: "invalid origin." }, { status: 403 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const ipLimit = await consumeRateLimit({
    key: `profile-shared-entries:ip:${ip}`,
    limit: 180,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipLimit.ok) {
    const retryAfter = Math.max(1, Math.ceil((ipLimit.resetAt.getTime() - Date.now()) / 1000));
    return NextResponse.json(
      { error: "too many requests. try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const userLimit = await consumeRateLimit({
    key: `profile-shared-entries:user:${userId}`,
    limit: 180,
    windowMs: 15 * 60 * 1000,
  });
  if (!userLimit.ok) {
    const retryAfter = Math.max(1, Math.ceil((userLimit.resetAt.getTime() - Date.now()) / 1000));
    return NextResponse.json(
      { error: "too many requests. try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const parsed = querySchema.safeParse({
    cursor: request.nextUrl.searchParams.get("cursor") || undefined,
    limit: request.nextUrl.searchParams.get("limit") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid query." }, { status: 400 });
  }

  const limit = Math.max(1, Math.min(20, parsed.data.limit));

  try {
    const page = await getProfileSharedEntriesPage({
      userId,
      cursor: parsed.data.cursor ?? null,
      limit,
    });
    return NextResponse.json(page);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "invalid cursor." }, { status: 400 });
    }
    console.error("[profile][shared-entries] failed", error);
    return NextResponse.json({ error: "could not load shared entries." }, { status: 500 });
  }
}
