import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountPanel } from "@/components/account-panel";
import { AppHeader } from "@/components/layout/app-header";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ONBOARDING_USERNAME_PATH } from "@/lib/onboarding";
import { needsUsernameOnboardingFromDb } from "@/lib/onboarding-server";
import { getProfileSharedEntriesPage } from "@/lib/profile-shared-entries";
import { getRequestTimeZone } from "@/lib/request-timezone";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  if (await needsUsernameOnboardingFromDb(session)) {
    redirect(ONBOARDING_USERNAME_PATH);
  }
  const userId = session?.user?.id;
  const timeZone = await getRequestTimeZone();

  if (!userId) {
    return (
      <div className="bw-bg">
        <AppHeader />

        <main className="bw-journalWrap">
          <div className="bw-hint" style={{ marginTop: 46 }}>
            <Link className="bw-link" href="/sign-in?next=/account">
              sign in
            </Link>{" "}
            to view your profile.
          </div>
        </main>
      </div>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      emailVerified: true,
      createdAt: true,
      username: true,
      image: true,
      collectiveAnonymous: true,
    },
  });

  if (!user) {
    return (
      <div className="bw-bg">
        <AppHeader />

        <main className="bw-journalWrap">
          <div className="bw-hint" style={{ marginTop: 46 }}>
            profile unavailable right now.
          </div>
        </main>
      </div>
    );
  }

  const sharedEntriesPage = await getProfileSharedEntriesPage({
    userId,
    limit: 10,
  });

  return (
    <div className="bw-bg">
      <AppHeader />

      <main className="bw-journalWrap">
        <AccountPanel
          createdAt={user.createdAt.toISOString()}
          email={user.email}
          emailVerified={Boolean(user.emailVerified)}
          initialUsername={user.username || "anonymous"}
          initialImage={user.image}
          initialCollectiveAnonymous={user.collectiveAnonymous}
          initialSharedEntries={sharedEntriesPage.items}
          initialSharedEntriesNextCursor={sharedEntriesPage.nextCursor}
          timeZone={timeZone}
        />
      </main>
    </div>
  );
}
