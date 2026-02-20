import Link from "next/link";
import { redirect } from "next/navigation";

import { JournalEditor } from "@/components/journal-editor";
import { AppHeader } from "@/components/layout/app-header";
import { auth } from "@/lib/auth";
import { ONBOARDING_USERNAME_PATH, needsUsernameOnboarding } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const session = await auth();
  if (needsUsernameOnboarding(session)) {
    redirect(ONBOARDING_USERNAME_PATH);
  }
  const userId = session?.user?.id;

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
          <JournalEditor />
        )}
      </main>
    </div>
  );
}
