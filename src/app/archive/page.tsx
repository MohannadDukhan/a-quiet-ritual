import Link from "next/link";

import { ArchiveClient, type ArchiveEntry } from "@/components/archive-client";
import { BwMenu } from "@/components/ui/bw-menu";
import { BwNavButton } from "@/components/ui/bw-nav-button";
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
          <span className="bw-brand">archive</span>
          <div className="bw-navwrap">
            <BwNavButton href="/archive" active>
              archive
            </BwNavButton>
            <BwNavButton href="/collective">
              collective
            </BwNavButton>
            <BwMenu />
          </div>
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
      type: true,
      content: true,
      promptTextSnapshot: true,
      isCollective: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const serializedEntries: ArchiveEntry[] = entries.map((entry) => ({
    id: entry.id,
    type: entry.type,
    content: entry.content,
    promptTextSnapshot: entry.promptTextSnapshot,
    isCollective: entry.isCollective,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }));

  return (
    <div className="bw-bg">
      <div className="bw-top">
        <span className="bw-brand">archive</span>
        <div className="bw-navwrap">
          <BwNavButton href="/archive" active>
            archive
          </BwNavButton>
          <BwNavButton href="/collective">
            collective
          </BwNavButton>
          <BwMenu />
        </div>
      </div>

      <main className="bw-archiveWrap">
        <ArchiveClient entries={serializedEntries} />
      </main>
    </div>
  );
}
