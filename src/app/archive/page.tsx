import { Prisma } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ArchiveClient, type ArchiveEntry } from "@/components/archive-client";
import { AppHeader } from "@/components/layout/app-header";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ONBOARDING_USERNAME_PATH } from "@/lib/onboarding";
import { needsUsernameOnboardingFromDb } from "@/lib/onboarding-server";
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

function parseIsoTimestamp(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
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

  if (await needsUsernameOnboardingFromDb(session)) {
    redirect(ONBOARDING_USERNAME_PATH);
  }

  const filter = parseFilter(firstSearchParam(params.filter));
  const range = parseRange(firstSearchParam(params.range));
  const requestedPage = parsePage(firstSearchParam(params.page));
  const customStart = firstSearchParam(params.start) || "";
  const customEnd = firstSearchParam(params.end) || "";
  const startTs = firstSearchParam(params.startTs) || "";
  const endTs = firstSearchParam(params.endTs) || "";
  const startDate = parseIsoTimestamp(startTs);
  const endDate = parseIsoTimestamp(endTs);

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

  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lt: endDate } : {}),
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
          customStart={customStart}
          customEnd={customEnd}
          startTs={startTs}
          endTs={endTs}
          page={page}
          totalPages={totalPages}
        />
      </main>
    </div>
  );
}
