import { Prompt } from "@prisma/client";

import { prisma } from "@/lib/db";
import { PROMPT_TEXTS, dailyPromptIndex, formatDateId } from "@/lib/prompts";

let promptSeededInProcess = false;

export async function ensurePromptSeedData(): Promise<void> {
  if (promptSeededInProcess) return;
  promptSeededInProcess = true;

  try {
    const count = await prisma.prompt.count();
    if (count > 0) return;

    await prisma.prompt.createMany({
      data: PROMPT_TEXTS.map((text) => ({ text })),
      skipDuplicates: true,
    });
  } finally {
    promptSeededInProcess = false;
  }
}

export async function getTodaysPrompt(date: Date = new Date()): Promise<Prompt> {
  await ensurePromptSeedData();

  const prompts = await prisma.prompt.findMany({
    select: { id: true, text: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (prompts.length === 0) {
    throw new Error("No prompts available");
  }

  const dateId = formatDateId(date);
  const index = dailyPromptIndex(dateId) % prompts.length;
  return prompts[index];
}
