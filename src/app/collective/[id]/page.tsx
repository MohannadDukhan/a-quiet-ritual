import { notFound } from "next/navigation";

import {
  CollectiveRepliesPanel,
  type CollectiveReplyItem,
} from "@/components/collective-replies-panel";
import { CollectiveDetailAdminControls } from "@/components/collective-detail-admin-controls";
import { AppHeader } from "@/components/layout/app-header";
import { BwNavButton } from "@/components/ui/bw-nav-button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTodaysPrompt } from "@/lib/prompt-service";
import { getRequestTimeZone } from "@/lib/request-timezone";
import { formatDateTime } from "@/lib/time";

type CollectiveEntryDetailPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function CollectiveEntryDetailPage({ params }: CollectiveEntryDetailPageProps) {
  const session = await auth();
  const canModerate = session?.user?.role === "ADMIN";
  const timeZone = await getRequestTimeZone();
  const { id } = await params;
  const todaysPrompt = await getTodaysPrompt();

  const entry = await prisma.entry.findFirst({
    where: {
      id,
      isCollective: true,
      type: "PROMPT",
      promptId: todaysPrompt.id,
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

  const replies = await prisma.collectiveReply.findMany({
    where: { entryId: entry.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
    },
  });
  const serializedReplies: CollectiveReplyItem[] = replies.map((reply) => ({
    id: reply.id,
    content: reply.content,
    createdAt: reply.createdAt.toISOString(),
  }));

  return (
    <div className="bw-bg">
      <AppHeader active="collective" />

      <main className="bw-journalWrap">
        <div className="bw-card">
          <div className="bw-cardMeta">
            <div className="bw-ui bw-cardDate">{formatDateTime(entry.createdAt, timeZone)}</div>
            <span className="bw-ui bw-collectiveBadge">anonymous</span>
          </div>
          <div className="bw-writing bw-cardText">{entry.content}</div>
          {canModerate && <CollectiveDetailAdminControls entryId={entry.id} />}
        </div>

        <CollectiveRepliesPanel
          entryId={entry.id}
          initialReplies={serializedReplies}
          signInNextPath={`/collective/${entry.id}`}
          canReply
          timeZone={timeZone}
        />

        <div className="bw-row">
          <div className="bw-ui bw-date">today&rsquo;s collective entry</div>
          <BwNavButton href="/collective">
            back to collective
          </BwNavButton>
        </div>
      </main>
    </div>
  );
}
