import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  CollectiveRepliesPanel,
  type CollectiveReplyItem,
} from "@/components/collective-replies-panel";
import { CollectiveDetailAdminControls } from "@/components/collective-detail-admin-controls";
import { EntryDeleteButton } from "@/components/entry-delete-button";
import { AppHeader } from "@/components/layout/app-header";
import { BwNavButton } from "@/components/ui/bw-nav-button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ONBOARDING_USERNAME_PATH } from "@/lib/onboarding";
import { needsUsernameOnboardingFromDb } from "@/lib/onboarding-server";
import { getTodaysPrompt } from "@/lib/prompt-service";
import { getRequestTimeZone } from "@/lib/request-timezone";
import { formatDateTime } from "@/lib/time";

type CollectiveEntryDetailPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

function formatHandle(username: string): string {
  return `@${username.trim().toLowerCase()}`;
}

export default async function CollectiveEntryDetailPage({ params }: CollectiveEntryDetailPageProps) {
  const session = await auth();
  if (await needsUsernameOnboardingFromDb(session)) {
    redirect(ONBOARDING_USERNAME_PATH);
  }
  const canModerate = session?.user?.role === "ADMIN";
  const viewerIsAdmin = session?.user?.role === "ADMIN";
  const viewerUserId = session?.user?.id ?? null;
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
      userId: true,
      content: true,
      createdAt: true,
      user: {
        select: {
          username: true,
          collectiveAnonymous: true,
        },
      },
    },
  });

  if (!entry) {
    notFound();
  }

  const anonymousPost = entry.user.collectiveAnonymous === true;
  const hideUsername = anonymousPost && !viewerIsAdmin;
  const canDeleteAsOwner = Boolean(viewerUserId && viewerUserId === entry.userId);

  const replies = await prisma.collectiveReply.findMany({
    where: { entryId: entry.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      content: true,
      userId: true,
      createdAt: true,
    },
  });
  const serializedReplies: CollectiveReplyItem[] = replies.map((reply) => ({
    id: reply.id,
    content: reply.content,
    isOwner: Boolean(viewerUserId && reply.userId === viewerUserId),
    createdAt: reply.createdAt.toISOString(),
  }));

  return (
    <div className="bw-bg">
      <AppHeader active="collective" />

      <main className="bw-page">
        <section className="bw-section">
          <div className="bw-rowMeta">
            <div>{formatDateTime(entry.createdAt, timeZone)}</div>
            {!hideUsername && entry.user.username ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Link className="bw-ui bw-handleLink" href={`/u/${encodeURIComponent(entry.user.username)}`}>
                  {formatHandle(entry.user.username)}
                </Link>
                {canModerate && anonymousPost && <span className="bw-ui bw-date">(anonymous post)</span>}
              </div>
            ) : (
              <span className="bw-ui">anonymous</span>
            )}
          </div>
          <hr className="bw-divider" />
          <div className="bw-writing bw-entryContent">{entry.content}</div>
          {canModerate && <CollectiveDetailAdminControls entryId={entry.id} />}
        </section>

        <CollectiveRepliesPanel
          entryId={entry.id}
          initialReplies={serializedReplies}
          signInNextPath={`/collective/${entry.id}`}
          canReply
          timeZone={timeZone}
        />

        <div className="bw-row" style={{ marginTop: 4 }}>
          <div className="bw-ui bw-date">today&rsquo;s collective entry</div>
          <div className="bw-actions">
            {canDeleteAsOwner && (
              <EntryDeleteButton
                entryId={entry.id}
                redirectTo="/collective?deleted=1"
                confirmMessage="delete this shared entry and all replies permanently?"
              />
            )}
            <BwNavButton href="/collective">
              back to collective
            </BwNavButton>
          </div>
        </div>
      </main>
    </div>
  );
}
