import { NextResponse } from "next/server";

import { formatDateIdInEastern, getTodaysPrompt } from "@/lib/prompt-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const prompt = await getTodaysPrompt();
    const dateId = formatDateIdInEastern();

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
