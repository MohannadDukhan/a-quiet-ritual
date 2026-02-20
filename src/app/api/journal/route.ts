import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/security";

const createJournalEntrySchema = z.object({
  content: z.string().trim().min(1).max(8000),
  startTs: z.string().min(1),
  endTs: z.string().min(1),
});

export const runtime = "nodejs";

function addRateLimitHeaders(resetAt: Date) {
  return {
    "Retry-After": String(Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))),
  };
}

function getUtcDayBounds(now: Date = new Date()): { startUtc: Date; endUtc: Date } {
  const startUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
  const endUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  );
  return { startUtc, endUtc };
}

function parseIsoTimestamp(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function resolveJournalBounds(startTs: string | null, endTs: string | null): { startUtc: Date; endUtc: Date } {
  const parsedStart = startTs ? parseIsoTimestamp(startTs) : null;
  const parsedEnd = endTs ? parseIsoTimestamp(endTs) : null;
  if (parsedStart && parsedEnd && parsedStart.getTime() < parsedEnd.getTime()) {
    return { startUtc: parsedStart, endUtc: parsedEnd };
  }
  return getUtcDayBounds();
}

export async function GET(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTs = request.nextUrl.searchParams.get("startTs");
  const endTs = request.nextUrl.searchParams.get("endTs");
  const { startUtc, endUtc } = resolveJournalBounds(startTs, endTs);

  const entry = await prisma.entry.findFirst({
    where: {
      userId,
      type: "JOURNAL",
      createdAt: {
        gte: startUtc,
        lt: endUtc,
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ entry });
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

  const { startUtc, endUtc } = resolveJournalBounds(parsed.data.startTs, parsed.data.endTs);
  const existingTodayEntry = await prisma.entry.findFirst({
    where: {
      userId,
      type: "JOURNAL",
      createdAt: {
        gte: startUtc,
        lt: endUtc,
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
    },
  });

  const entrySelect = {
    id: true,
    type: true,
    content: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  if (existingTodayEntry) {
    const entry = await prisma.entry.update({
      where: { id: existingTodayEntry.id },
      data: {
        content: parsed.data.content,
      },
      select: entrySelect,
    });

    return NextResponse.json({ entry, updated: true }, { status: 200 });
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
    select: entrySelect,
  });

  return NextResponse.json({ entry }, { status: 201 });
}
