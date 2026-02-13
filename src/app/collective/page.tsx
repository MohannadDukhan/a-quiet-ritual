import { AppHeader } from "@/components/layout/app-header";
import { CollectiveFeed, type CollectiveFeedEntry } from "@/components/collective-feed";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTodaysPrompt } from "@/lib/prompt-service";
import { getRequestTimeZone } from "@/lib/request-timezone";

export const dynamic = "force-dynamic";

export default async function CollectivePage() {
  const session = await auth();
  const canModerate = session?.user?.role === "ADMIN";
  const timeZone = await getRequestTimeZone();
  const todaysPrompt = await getTodaysPrompt();
  const entries = await prisma.entry.findMany({
    where: {
      type: "PROMPT",
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
  const serializedEntries: CollectiveFeedEntry[] = entries.map((entry) => ({
    id: entry.id,
    content: entry.content,
    createdAt: entry.createdAt.toISOString(),
  }));

  return (
    <div className="bw-bg">
      <AppHeader active="collective" />

      <main className="bw-collectiveWrap">
        <section className="bw-collectiveHero">
          <div className="bw-collectiveBadgeRow">
            <span className="bw-ui bw-navbtn bw-breathe bw-collectivePill">collective</span>
          </div>
          <div className="bw-ui bw-collectiveEyebrow">today&rsquo;s prompt</div>
          <h1 className="bw-writing bw-collectivePrompt">today&rsquo;s prompt: {todaysPrompt.text}</h1>
          <p className="bw-ui bw-collectiveNotice">
            this is a respectful space. hate, threats, or harassment can&rsquo;t be shared.
          </p>
        </section>

        <CollectiveFeed entries={serializedEntries} timeZone={timeZone} canModerate={canModerate} />
      </main>
    </div>
  );
}
