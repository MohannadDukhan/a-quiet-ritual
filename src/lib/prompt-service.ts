import { Prompt } from "@prisma/client";

import { prisma } from "@/lib/db";
import { PROMPT_TEXTS, dailyPromptIndex } from "@/lib/prompts";

export const PROMPT_SCHEDULE_TIME_ZONE = "America/New_York";
export const PROMPT_ADMIN_WINDOW_DAYS = 8;

type PromptSeedRecord = Pick<Prompt, "id" | "text" | "createdAt">;

export type ResolvedPromptDay = {
  date: string;
  promptId: string;
  promptText: string;
  overridden: boolean;
};

let promptSeededInProcess = false;

function getDatePartsInTimeZone(date: Date, timeZone: string): {
  year: string;
  month: string;
  day: string;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Unable to resolve date parts");
  }
  return { year, month, day };
}

function parseDateId(dateId: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateId);
  if (!match) {
    throw new Error("Invalid date id");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

function addDaysToDateId(dateId: string, daysToAdd: number): string {
  const base = parseDateId(dateId);
  base.setUTCDate(base.getUTCDate() + daysToAdd);
  return formatDateIdInTimeZone(base, PROMPT_SCHEDULE_TIME_ZONE);
}

async function getPromptSeedRecords(): Promise<PromptSeedRecord[]> {
  await ensurePromptSeedData();

  const prompts = await prisma.prompt.findMany({
    select: { id: true, text: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  if (prompts.length === 0) {
    throw new Error("No prompts available");
  }
  return prompts;
}

function getDefaultPromptForDateId(prompts: PromptSeedRecord[], dateId: string): PromptSeedRecord {
  const index = dailyPromptIndex(dateId) % prompts.length;
  return prompts[index];
}

export function formatDateIdInTimeZone(date: Date = new Date(), timeZone: string = PROMPT_SCHEDULE_TIME_ZONE): string {
  const { year, month, day } = getDatePartsInTimeZone(date, timeZone);
  return `${year}-${month}-${day}`;
}

export function formatDateIdInEastern(date: Date = new Date()): string {
  return formatDateIdInTimeZone(date, PROMPT_SCHEDULE_TIME_ZONE);
}

export function getUpcomingPromptDateIds(days: number = PROMPT_ADMIN_WINDOW_DAYS, startDate: Date = new Date()): string[] {
  const safeDays = Math.max(1, Math.floor(days));
  const startDateId = formatDateIdInEastern(startDate);
  return Array.from({ length: safeDays }, (_, index) => addDaysToDateId(startDateId, index));
}

export function isPromptDateInAdminWindow(dateId: string, startDate: Date = new Date()): boolean {
  const windowDateIds = new Set(getUpcomingPromptDateIds(PROMPT_ADMIN_WINDOW_DAYS, startDate));
  return windowDateIds.has(dateId);
}

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

export async function resolvePromptDay(dateId: string): Promise<ResolvedPromptDay> {
  const prompts = await getPromptSeedRecords();
  const defaultPrompt = getDefaultPromptForDateId(prompts, dateId);
  const schedule = await prisma.promptSchedule.findUnique({
    where: { date: dateId },
    select: {
      promptText: true,
    },
  });

  return {
    date: dateId,
    promptId: defaultPrompt.id,
    promptText: schedule?.promptText || defaultPrompt.text,
    overridden: Boolean(schedule),
  };
}

export async function getUpcomingResolvedPromptDays(
  days: number = PROMPT_ADMIN_WINDOW_DAYS,
  startDate: Date = new Date(),
): Promise<ResolvedPromptDay[]> {
  const dateIds = getUpcomingPromptDateIds(days, startDate);
  const prompts = await getPromptSeedRecords();
  const schedules = await prisma.promptSchedule.findMany({
    where: {
      date: { in: dateIds },
    },
    select: {
      date: true,
      promptText: true,
    },
  });
  const scheduleByDate = new Map(schedules.map((row) => [row.date, row.promptText]));

  return dateIds.map((dateId) => {
    const defaultPrompt = getDefaultPromptForDateId(prompts, dateId);
    const overrideText = scheduleByDate.get(dateId);

    return {
      date: dateId,
      promptId: defaultPrompt.id,
      promptText: overrideText || defaultPrompt.text,
      overridden: Boolean(overrideText),
    };
  });
}

export async function getTodaysPrompt(date: Date = new Date()): Promise<Prompt> {
  const prompts = await getPromptSeedRecords();
  const dateId = formatDateIdInEastern(date);
  const defaultPrompt = getDefaultPromptForDateId(prompts, dateId);
  const schedule = await prisma.promptSchedule.findUnique({
    where: { date: dateId },
    select: { promptText: true },
  });

  return {
    id: defaultPrompt.id,
    text: schedule?.promptText || defaultPrompt.text,
    createdAt: defaultPrompt.createdAt,
  };
}
