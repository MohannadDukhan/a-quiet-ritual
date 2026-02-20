import { Prisma } from "@prisma/client";
import Link from "next/link";

import { ArchiveClient, type ArchiveEntry } from "@/components/archive-client";
import { AppHeader } from "@/components/layout/app-header";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRequestTimeZone } from "@/lib/request-timezone";

export const dynamic = "force-dynamic";

type ArchiveFilter = "all" | "archive" | "collective" | "journal";
type ArchiveRange = "all" | "7d" | "30d" | "custom";

type ArchivePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE_SIZE = 20;

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parseFilter(value: string | undefined): ArchiveFilter {
  if (value === "archive" || value === "collective" || value === "journal") {
    return value;
  }
  return "all";
}

function parseRange(value: string | undefined): ArchiveRange {
  if (value === "7d" || value === "30d" || value === "custom") {
    return value;
  }
  return "all";
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value || "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function parseUtcDateInput(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  const day = Number.parseInt(dayRaw, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function resolveDateRangeBounds(
  range: ArchiveRange,
  startRaw: string | undefined,
  endRaw: string | undefined,
): { gte?: Date; lt?: Date; startInput: string; endInput: string } {
  const now = new Date();
  const todayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

  if (range === "7d" || range === "30d") {
    const days = range === "7d" ? 7 : 30;
    const startUtc = addUtcDays(todayStartUtc, -(days - 1));
    const endUtcExclusive = addUtcDays(todayStartUtc, 1);
    return { gte: startUtc, lt: endUtcExclusive, startInput: "", endInput: "" };
  }

  if (range === "custom") {
    let startUtc = parseUtcDateInput(startRaw);
    let endUtc = parseUtcDateInput(endRaw);

    if (startUtc && endUtc && startUtc.getTime() > endUtc.getTime()) {
      const temp = startUtc;
      startUtc = endUtc;
      endUtc = temp;
    }

    return {
      gte: startUtc || undefined,
      lt: endUtc ? addUtcDays(endUtc, 1) : undefined,
      startInput: startRaw || "",
      endInput: endRaw || "",
    };
  }

  return { startInput: "", endInput: "" };
}

export default async function ArchivePage({ searchParams }: ArchivePageProps) {
  const [session, timeZone, params] = await Promise.all([auth(), getRequestTimeZone(), searchParams]);
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <div className="bw-bg">
        <AppHeader active="archive" />

        <main className="bw-page">
          <div className="bw-ui bw-hint" style={{ marginTop: 46 }}>
            <Link className="bw-link" href="/sign-in?next=/archive">
              sign in
            </Link>{" "}
            to view your private archive.
          </div>
        </main>
      </div>
    );
  }

  const filter = parseFilter(firstSearchParam(params.filter));
  const range = parseRange(firstSearchParam(params.range));
  const requestedPage = parsePage(firstSearchParam(params.page));
  const startRaw = firstSearchParam(params.start);
  const endRaw = firstSearchParam(params.end);
  const dateBounds = resolveDateRangeBounds(range, startRaw, endRaw);

  const where: Prisma.EntryWhereInput = {
    userId,
  };

  if (filter === "archive") {
    where.type = "PROMPT";
    where.isCollective = false;
  } else if (filter === "collective") {
    where.type = "PROMPT";
    where.isCollective = true;
  } else if (filter === "journal") {
    where.type = "JOURNAL";
  }

  if (dateBounds.gte || dateBounds.lt) {
    where.createdAt = {
      ...(dateBounds.gte ? { gte: dateBounds.gte } : {}),
      ...(dateBounds.lt ? { lt: dateBounds.lt } : {}),
    };
  }

  const totalCount = await prisma.entry.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const entries = await prisma.entry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      type: true,
      content: true,
      promptTextSnapshot: true,
      prompt: {
        select: {
          text: true,
        },
      },
      isCollective: true,
      collectiveRemovedAt: true,
      collectiveRemovedReason: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const serializedEntries: ArchiveEntry[] = entries.map((entry) => ({
    id: entry.id,
    type: entry.type,
    content: entry.content,
    promptText: entry.promptTextSnapshot || entry.prompt?.text || "",
    isCollective: entry.isCollective,
    collectiveRemovedAt: entry.collectiveRemovedAt?.toISOString() || null,
    collectiveRemovedReason: entry.collectiveRemovedReason,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }));

  return (
    <div className="bw-bg">
      <AppHeader active="archive" />

      <main className="bw-page">
        <ArchiveClient
          entries={serializedEntries}
          timeZone={timeZone}
          filter={filter}
          range={range}
          customStart={dateBounds.startInput}
          customEnd={dateBounds.endInput}
          page={page}
          totalPages={totalPages}
        />
      </main>
    </div>
  );
}
