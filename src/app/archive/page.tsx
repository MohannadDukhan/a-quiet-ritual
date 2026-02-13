import Link from "next/link";

import { ArchiveClient, type ArchiveEntry } from "@/components/archive-client";
import { AppHeader } from "@/components/layout/app-header";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRequestTimeZone } from "@/lib/request-timezone";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const session = await auth();
  const userId = session?.user?.id;
  const timeZone = await getRequestTimeZone();

  if (!userId) {
    return (
      <div className="bw-bg">
        <AppHeader active="archive" />

        <main className="bw-archiveWrap">
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

  const entries = await prisma.entry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
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
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }));

  return (
    <div className="bw-bg">
      <AppHeader active="archive" />

      <main className="bw-archiveWrap">
        <ArchiveClient entries={serializedEntries} timeZone={timeZone} />
      </main>
    </div>
  );
}
