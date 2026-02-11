import { notFound } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { BwNavButton } from "@/components/ui/bw-nav-button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type PromptEntryDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatEntryDate(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function PromptEntryDetailPage({ params }: PromptEntryDetailPageProps) {
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
      type: "PROMPT",
    },
    select: {
      content: true,
      promptTextSnapshot: true,
      isCollective: true,
      createdAt: true,
      prompt: {
        select: {
          text: true,
        },
      },
    },
  });

  if (!entry) {
    notFound();
  }

  const promptText = entry.promptTextSnapshot || entry.prompt?.text || "";

  return (
    <div className="bw-bg">
      <AppHeader />

      <main className="bw-journalWrap">
        <div className="bw-card">
          <div className="bw-cardMeta">
            <div className="bw-cardDate">{formatEntryDate(entry.createdAt).toLowerCase()}</div>
            {entry.isCollective && <span className="bw-collectiveBadge">shared on collective</span>}
          </div>
          <div className="bw-cardPrompt">&quot;{promptText}&quot;</div>
          <div className="bw-cardText">{entry.content}</div>
        </div>

        <div className="bw-row">
          <div className="bw-date">private prompt entry</div>
          <BwNavButton href="/archive">
            back to archive
          </BwNavButton>
        </div>
      </main>
    </div>
  );
}
