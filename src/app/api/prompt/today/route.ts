import { NextResponse } from "next/server";

import { getTodaysPrompt } from "@/lib/prompt-service";
import { formatDateId } from "@/lib/prompts";

export const runtime = "nodejs";

export async function GET() {
  try {
    const prompt = await getTodaysPrompt();
    const dateId = formatDateId();

    return NextResponse.json({
      prompt: {
        id: prompt.id,
        text: prompt.text,
      },
      dateId,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load prompt right now." },
      { status: 500 },
    );
  }
}
