import Link from "next/link";

import { JournalEditor } from "@/components/journal-editor";
import { BwMenu } from "@/components/ui/bw-menu";
import { BwNavButton } from "@/components/ui/bw-nav-button";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const session = await auth();
  const userId = session?.user?.id;

  return (
    <div className="bw-bg">
      <div className="bw-top">
        <span className="bw-brand">regular journal</span>
        <div className="bw-navwrap">
          <BwNavButton href="/archive">
            archive
          </BwNavButton>
          <BwNavButton href="/collective">
            collective
          </BwNavButton>
          <BwMenu />
        </div>
      </div>

      <main className="bw-journalWrap">
        {!userId ? (
          <div className="bw-panel show" style={{ width: "min(760px, 100%)" }}>
            <div className="bw-hint" style={{ marginTop: 12 }}>
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
