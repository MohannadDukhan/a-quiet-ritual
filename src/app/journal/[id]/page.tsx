import { notFound } from "next/navigation";

import { BwMenu } from "@/components/ui/bw-menu";
import { BwNavButton } from "@/components/ui/bw-nav-button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type JournalEntryDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatJournalDate(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function JournalEntryDetailPage({ params }: JournalEntryDetailPageProps) {
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
      <div className="bw-top">
        <span className="bw-brand">regular journal entry</span>
        <div className="bw-navwrap">
          <BwNavButton href="/archive">
            archive
          </BwNavButton>
          <BwNavButton href="/collective">
            collective
          </BwNavButton>
          <BwMenu />
        </div>
      </div>

      <main className="bw-journalWrap">
        <div className="bw-card">
          <div className="bw-cardMeta">
            <span className="bw-collectiveBadge">regular journal entry</span>
            <div className="bw-cardDate">{formatJournalDate(entry.createdAt).toLowerCase()}</div>
          </div>
          <div className="bw-cardText">{entry.content}</div>
        </div>

        <div className="bw-row">
          <div className="bw-date">private entry</div>
          <BwNavButton href="/archive">
            back to archive
          </BwNavButton>
        </div>
      </main>
    </div>
  );
}
