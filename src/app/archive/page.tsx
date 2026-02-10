import Link from "next/link";

import { ArchiveClient, type ArchiveEntry } from "@/components/archive-client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <div className="bw-bg">
        <div className="bw-top">
          <Link className="bw-link" href="/">
            back
          </Link>
          <span className="bw-brand">archive</span>
          <span className="bw-brand" style={{ opacity: 0 }}>
            ghost
          </span>
        </div>

        <main className="bw-archiveWrap">
          <div className="bw-hint" style={{ marginTop: 46 }}>
            <Link className="bw-link" href="/sign-in?next=/archive">
              sign in
            </Link>{" "}
            to view your private archive.
          </div>
        </main>
      </div>
    );
  }

  const entries = await prisma.entry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      promptTextSnapshot: true,
      isCollective: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const serializedEntries: ArchiveEntry[] = entries.map((entry) => ({
    id: entry.id,
    content: entry.content,
    promptTextSnapshot: entry.promptTextSnapshot,
    isCollective: entry.isCollective,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }));

  return (
    <div className="bw-bg">
      <div className="bw-top">
        <Link className="bw-link" href="/">
          back
        </Link>
        <span className="bw-brand">archive</span>
        <span className="bw-brand" style={{ opacity: 0 }}>
          ghost
        </span>
      </div>

      <main className="bw-archiveWrap">
        <ArchiveClient entries={serializedEntries} />
      </main>
    </div>
  );
}
