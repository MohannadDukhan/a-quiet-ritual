import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTodaysPrompt } from "@/lib/prompt-service";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/security";

const createCollectiveReplySchema = z.object({
  entryId: z.string().uuid(),
  content: z.string().trim().min(1).max(1000),
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
  const parsed = createCollectiveReplySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reply input." }, { status: 400 });
  }

  const ip = getClientIp(request);
  const ipLimit = await consumeRateLimit({
    key: `collective-reply:ip:${ip}`,
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
    key: `collective-reply:user:${userId}`,
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!userLimit.ok) {
    return NextResponse.json(
      { error: "Too many replies in a short window. Try again soon." },
      { status: 429, headers: addRateLimitHeaders(userLimit.resetAt) },
    );
  }

  const todaysPrompt = await getTodaysPrompt();
  const entry = await prisma.entry.findUnique({
    where: { id: parsed.data.entryId },
    select: {
      id: true,
      type: true,
      isCollective: true,
      promptId: true,
    },
  });

  if (!entry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  if (entry.type !== "PROMPT" || !entry.isCollective || entry.promptId !== todaysPrompt.id) {
    return NextResponse.json({ error: "Replies are only available for today's collective entries." }, { status: 400 });
  }

  const reply = await prisma.collectiveReply.create({
    data: {
      entryId: entry.id,
      userId,
      content: parsed.data.content,
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ reply }, { status: 201 });
}
