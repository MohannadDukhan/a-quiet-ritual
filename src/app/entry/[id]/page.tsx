import { notFound } from "next/navigation";

import {
  CollectiveRepliesPanel,
  type CollectiveReplyItem,
} from "@/components/collective-replies-panel";
import { AppHeader } from "@/components/layout/app-header";
import { BwNavButton } from "@/components/ui/bw-nav-button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTodaysPrompt } from "@/lib/prompt-service";

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
      id: true,
      promptId: true,
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
  let replies: CollectiveReplyItem[] = [];
  let canReply = false;

  if (entry.isCollective) {
    const replyRows = await prisma.collectiveReply.findMany({
      where: { entryId: entry.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        content: true,
        createdAt: true,
      },
    });
    replies = replyRows.map((reply) => ({
      id: reply.id,
      content: reply.content,
      createdAt: reply.createdAt.toISOString(),
    }));

    const todaysPrompt = await getTodaysPrompt();
    canReply = entry.promptId === todaysPrompt.id;
  }

  return (
    <div className="bw-bg">
      <AppHeader />

      <main className="bw-journalWrap">
        <div className="bw-card">
          <div className="bw-cardMeta">
            <div className="bw-ui bw-cardDate">{formatEntryDate(entry.createdAt).toLowerCase()}</div>
            {entry.isCollective && <span className="bw-ui bw-collectiveBadge">shared on collective</span>}
          </div>
          <div className="bw-writing bw-cardPrompt">&quot;{promptText}&quot;</div>
          <div className="bw-writing bw-cardText">{entry.content}</div>
        </div>

        {entry.isCollective && (
          <CollectiveRepliesPanel
            entryId={entry.id}
            initialReplies={replies}
            signInNextPath={`/entry/${entry.id}`}
            canReply={canReply}
          />
        )}

        <div className="bw-row">
          <div className="bw-ui bw-date">private prompt entry</div>
          <BwNavButton href="/archive">
            back to archive
          </BwNavButton>
        </div>
      </main>
    </div>
  );
}
