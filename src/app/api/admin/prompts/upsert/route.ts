import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiRequest } from "@/lib/admin-api";
import { prisma } from "@/lib/db";
import { isPromptDateInAdminWindow, resolvePromptDay } from "@/lib/prompt-service";

export const runtime = "nodejs";

const upsertPromptSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  promptText: z.string().max(1000),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdminApiRequest({
    request,
    action: "prompts-upsert",
  });
  if (!guard.ok) {
    return guard.response;
  }

  const payload = await request.json().catch(() => null);
  const parsed = upsertPromptSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid prompt payload." }, { status: 400 });
  }

  const date = parsed.data.date;
  if (!isPromptDateInAdminWindow(date)) {
    return NextResponse.json({ error: "date must be within today + next 7 days." }, { status: 400 });
  }

  const promptText = parsed.data.promptText.trim();
  if (!promptText) {
    await prisma.promptSchedule.deleteMany({
      where: { date },
    });
    const day = await resolvePromptDay(date);
    return NextResponse.json({ ok: true, day, reset: true });
  }

  await prisma.promptSchedule.upsert({
    where: { date },
    update: { promptText },
    create: {
      date,
      promptText,
    },
  });

  const day = await resolvePromptDay(date);
  return NextResponse.json({ ok: true, day });
}
