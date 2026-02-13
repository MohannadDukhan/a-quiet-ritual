import { notFound } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { BwNavButton } from "@/components/ui/bw-nav-button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRequestTimeZone } from "@/lib/request-timezone";
import { formatDateTime } from "@/lib/time";

type JournalEntryDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function JournalEntryDetailPage({ params }: JournalEntryDetailPageProps) {
  const timeZone = await getRequestTimeZone();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    notFound();
  }

  const { id } = await params;
  const entry = await prisma.entry.findFirst({
    where: {
      id,
      userId,
      type: "JOURNAL",
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
    },
  });

  if (!entry) {
    notFound();
  }

  return (
    <div className="bw-bg">
      <AppHeader />

      <main className="bw-journalWrap">
        <div className="bw-card">
          <div className="bw-cardMeta">
            <span className="bw-ui bw-collectiveBadge">regular journal entry</span>
            <div className="bw-ui bw-cardDate">{formatDateTime(entry.createdAt, timeZone)}</div>
          </div>
          <div className="bw-writing bw-cardText">{entry.content}</div>
        </div>

        <div className="bw-row">
          <div className="bw-ui bw-date">private entry</div>
          <BwNavButton href="/archive">
            back to archive
          </BwNavButton>
        </div>
      </main>
    </div>
  );
}
