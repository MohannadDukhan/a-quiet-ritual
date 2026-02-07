import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/security";

const createEntrySchema = z.object({
  promptId: z.string().uuid(),
  content: z.string().trim().min(1).max(8000),
});

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await prisma.entry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      promptTextSnapshot: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const ip = getClientIp(request);
  const ipLimit = await consumeRateLimit({
    key: `entries:ip:${ip}`,
    limit: 40,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipLimit.ok) {
    const retryAfter = Math.max(1, Math.ceil((ipLimit.resetAt.getTime() - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many requests. Slow down and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const userLimit = await consumeRateLimit({
    key: `entries:user:${userId}`,
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!userLimit.ok) {
    const retryAfter = Math.max(1, Math.ceil((userLimit.resetAt.getTime() - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many saves in a short window. Try again soon." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = createEntrySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid entry input." }, { status: 400 });
  }

  const prompt = await prisma.prompt.findUnique({
    where: { id: parsed.data.promptId },
    select: { id: true, text: true },
  });

  if (!prompt) {
    return NextResponse.json({ error: "Prompt not found." }, { status: 400 });
  }

  const entry = await prisma.entry.create({
    data: {
      userId,
      promptId: prompt.id,
      promptTextSnapshot: prompt.text,
      content: parsed.data.content,
    },
    select: {
      id: true,
      content: true,
      promptTextSnapshot: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
