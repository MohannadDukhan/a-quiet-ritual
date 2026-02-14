import { prisma } from "@/lib/db";

export type ProfileSharedEntryItem = {
  id: string;
  content: string;
  createdAt: string;
};

export type ProfileSharedEntriesPage = {
  items: ProfileSharedEntryItem[];
  nextCursor: string | null;
};

type GetProfileSharedEntriesPageInput = {
  userId: string;
  cursor?: string | null;
  limit?: number;
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

function resolveLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
}

export async function getProfileSharedEntriesPage({
  userId,
  cursor,
  limit = DEFAULT_LIMIT,
}: GetProfileSharedEntriesPageInput): Promise<ProfileSharedEntriesPage> {
  const pageSize = resolveLimit(limit);
  const rows = await prisma.entry.findMany({
    where: {
      userId,
      type: "PROMPT",
      isCollective: true,
      collectiveRemovedAt: null,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
    select: {
      id: true,
      content: true,
      createdAt: true,
    },
  });

  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.id ?? null : null;

  return {
    items: pageRows.map((row) => ({
      id: row.id,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
    })),
    nextCursor,
  };
}
