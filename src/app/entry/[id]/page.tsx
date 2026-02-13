import { notFound } from "next/navigation";

import {
  CollectiveRepliesPanel,
  type CollectiveReplyItem,
} from "@/components/collective-replies-panel";
import { AppHeader } from "@/components/layout/app-header";
import { BwNavButton } from "@/components/ui/bw-nav-button";
import { InfoPopover } from "@/components/ui/info-popover";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTodaysPrompt } from "@/lib/prompt-service";
import { getRequestTimeZone } from "@/lib/request-timezone";
import { formatDateTime } from "@/lib/time";

type PromptEntryDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PromptEntryDetailPage({ params }: PromptEntryDetailPageProps) {
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
      type: "PROMPT",
    },
    select: {
      id: true,
      promptId: true,
      content: true,
      promptTextSnapshot: true,
      isCollective: true,
      collectiveRemovedAt: true,
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
            <div className="bw-ui bw-cardDate">{formatDateTime(entry.createdAt, timeZone)}</div>
            {entry.isCollective && <span className="bw-ui bw-collectiveBadge">shared on collective</span>}
            {entry.collectiveRemovedAt && (
              <span className="bw-ui bw-removedBadge">
                removed from collective
                <InfoPopover
                  title="removed from collective"
                  triggerAriaLabel="why was this removed?"
                >
                  admins removed this from the collective because it didn&apos;t fit the community rules. it still
                  remains in your private archive.
                </InfoPopover>
              </span>
            )}
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
            timeZone={timeZone}
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
