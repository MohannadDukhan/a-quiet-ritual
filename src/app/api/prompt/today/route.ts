import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateIdInEastern, getTodaysPrompt } from "@/lib/prompt-service";

export const runtime = "nodejs";

function getUtcDayBounds(now: Date = new Date()): { startUtc: Date; endUtc: Date } {
  const startUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
  const endUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  );
  return { startUtc, endUtc };
}

export async function GET() {
  try {
    const [prompt, session] = await Promise.all([getTodaysPrompt(), auth()]);
    const dateId = formatDateIdInEastern();
    let existingEntry: { id: string; content: string; isCollective: boolean } | null = null;

    if (session?.user?.id && session.user.role === "USER") {
      const { startUtc, endUtc } = getUtcDayBounds();
      const row = await prisma.entry.findFirst({
        where: {
          userId: session.user.id,
          type: "PROMPT",
          promptId: prompt.id,
          createdAt: {
            gte: startUtc,
            lt: endUtc,
          },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          isCollective: true,
        },
      });

      if (row) {
        existingEntry = {
          id: row.id,
          content: row.content,
          isCollective: row.isCollective,
        };
      }
    }

    return NextResponse.json({
      prompt: {
        id: prompt.id,
        text: prompt.text,
      },
      dateId,
      existingEntry,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load prompt right now." },
      { status: 500 },
    );
  }
}
