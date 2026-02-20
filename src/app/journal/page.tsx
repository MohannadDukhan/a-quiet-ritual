import Link from "next/link";

import { JournalEditor } from "@/components/journal-editor";
import { AppHeader } from "@/components/layout/app-header";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function getUtcDayBounds(now: Date = new Date()): { startUtc: Date; endUtc: Date } {
  const startUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
  const endUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  );
  return { startUtc, endUtc };
}

export default async function JournalPage() {
  const session = await auth();
  const userId = session?.user?.id;
  let todayJournalEntry: { id: string; content: string } | null = null;

  if (userId) {
    const { startUtc, endUtc } = getUtcDayBounds();
    const row = await prisma.entry.findFirst({
      where: {
        userId,
        type: "JOURNAL",
        createdAt: {
          gte: startUtc,
          lt: endUtc,
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        content: true,
      },
    });

    if (row) {
      todayJournalEntry = row;
    }
  }

  return (
    <div className="bw-bg">
      <AppHeader />

      <main className="bw-journalWrap">
        {!userId ? (
          <div className="bw-panel show" style={{ width: "min(760px, 100%)" }}>
            <div className="bw-ui bw-hint" style={{ marginTop: 12 }}>
              <Link className="bw-link" href="/sign-in?next=/journal">
                sign in
              </Link>{" "}
              to write in your regular journal.
            </div>
          </div>
        ) : (
          <JournalEditor initialTodayEntry={todayJournalEntry} />
        )}
      </main>
    </div>
  );
}
