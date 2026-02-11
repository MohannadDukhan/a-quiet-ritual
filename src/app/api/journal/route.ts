import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/security";

const createJournalEntrySchema = z.object({
  content: z.string().trim().min(1).max(8000),
});

export const runtime = "nodejs";

function addRateLimitHeaders(resetAt: Date) {
  return {
    "Retry-After": String(Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))),
  };
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createJournalEntrySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid journal input." }, { status: 400 });
  }

  const ip = getClientIp(request);
  const ipLimit = await consumeRateLimit({
    key: `journal:private:ip:${ip}`,
    limit: 40,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Slow down and try again." },
      { status: 429, headers: addRateLimitHeaders(ipLimit.resetAt) },
    );
  }

  const userLimit = await consumeRateLimit({
    key: `journal:private:user:${userId}`,
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!userLimit.ok) {
    return NextResponse.json(
      { error: "Too many saves in a short window. Try again soon." },
      { status: 429, headers: addRateLimitHeaders(userLimit.resetAt) },
    );
  }

  const entry = await prisma.entry.create({
    data: {
      userId,
      type: "JOURNAL",
      promptId: null,
      promptTextSnapshot: "",
      content: parsed.data.content,
      isCollective: false,
      collectivePublishedAt: null,
    },
    select: {
      id: true,
      type: true,
      content: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
