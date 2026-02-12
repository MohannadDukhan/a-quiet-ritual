import Link from "next/link";

import { AccountPanel } from "@/components/account-panel";
import { AppHeader } from "@/components/layout/app-header";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <div className="bw-bg">
        <AppHeader />

        <main className="bw-journalWrap">
          <div className="bw-hint" style={{ marginTop: 46 }}>
            <Link className="bw-link" href="/sign-in?next=/account">
              sign in
            </Link>{" "}
            to view your account.
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
    },
  });

  if (!user) {
    return (
      <div className="bw-bg">
        <AppHeader />

        <main className="bw-journalWrap">
          <div className="bw-hint" style={{ marginTop: 46 }}>
            account unavailable right now.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bw-bg">
      <AppHeader />

      <main className="bw-journalWrap">
        <AccountPanel
          createdAt={user.createdAt.toISOString()}
          email={user.email}
          emailVerified={Boolean(user.emailVerified)}
        />
      </main>
    </div>
  );
}
