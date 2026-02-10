import Link from "next/link";

import { prisma } from "@/lib/db";
import { getTodaysPrompt } from "@/lib/prompt-service";

export const dynamic = "force-dynamic";

function formatEntryTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date).toLowerCase();
}

export default async function CollectivePage() {
  const todaysPrompt = await getTodaysPrompt();
  const entries = await prisma.entry.findMany({
    where: {
      isCollective: true,
      promptId: todaysPrompt.id,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
    },
  });

  return (
    <div className="bw-bg">
      <div className="bw-top">
        <Link className="bw-link" href="/">
          back
        </Link>
        <span className="bw-brand">collective</span>
        <span className="bw-brand" style={{ opacity: 0 }}>
          ghost
        </span>
      </div>

      <main className="bw-archiveStage">
        <div className="bw-archiveHeader">
          <div className="bw-archiveTitle">collective</div>
          <div className="bw-archiveSub">&quot;{todaysPrompt.text}&quot;</div>
          <div className="bw-archiveSub">
            this is a respectful space. hate, threats, or harassment can&rsquo;t be shared.
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="bw-empty">no shared entries yet.</div>
        ) : (
          <div className="bw-feed">
            {entries.map((entry) => (
              <article key={entry.id} className="bw-fragment">
                <div className="bw-fragMeta">{formatEntryTime(entry.createdAt)}</div>
                <div className="bw-fragText">{entry.content}</div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
