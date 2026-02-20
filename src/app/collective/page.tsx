import { AppHeader } from "@/components/layout/app-header";
import { CollectiveFeed, type CollectiveFeedEntry } from "@/components/collective-feed";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ONBOARDING_USERNAME_PATH, needsUsernameOnboarding } from "@/lib/onboarding";
import { getTodaysPrompt } from "@/lib/prompt-service";
import { getRequestTimeZone } from "@/lib/request-timezone";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CollectivePage() {
  const session = await auth();
  if (needsUsernameOnboarding(session)) {
    redirect(ONBOARDING_USERNAME_PATH);
  }
  const canModerate = session?.user?.role === "ADMIN";
  const viewerIsAdmin = session?.user?.role === "ADMIN";
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
      user: {
        select: {
          username: true,
          collectiveAnonymous: true,
        },
      },
    },
  });
  const serializedEntries: CollectiveFeedEntry[] = entries.map((entry) => {
    const anonymousPost = entry.user.collectiveAnonymous === true;
    const hideUsername = anonymousPost && !viewerIsAdmin;

    return {
      id: entry.id,
      content: entry.content,
      createdAt: entry.createdAt.toISOString(),
      username: hideUsername ? null : entry.user.username,
      anonymousPost,
    };
  });

  return (
    <div className="bw-bg">
      <AppHeader active="collective" />

      <main className="bw-page">
        <section className="bw-section">
          <h1 className="bw-accountTitle">collective</h1>
          <p className="bw-collectiveIntro">this is the collective. you&apos;re reading today&apos;s public prompt entries.</p>
          <p className="bw-collectiveIntro">
            this is a respectful space. hate, threats, or harassment can&apos;t be shared.
          </p>
          <div className="bw-block">
            <div className="bw-ui bw-collectiveEyebrow">today&apos;s prompt</div>
            <h2 className="bw-writing bw-collectivePrompt">{todaysPrompt.text}</h2>
          </div>
          <hr className="bw-divider" />
        </section>

        <CollectiveFeed entries={serializedEntries} timeZone={timeZone} canModerate={canModerate} />
      </main>
    </div>
  );
}
