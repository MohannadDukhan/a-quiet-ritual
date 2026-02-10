"use client";

import { signOut } from "next-auth/react";
import { useMemo, useState } from "react";

import { BwNavButton } from "@/components/ui/bw-nav-button";

export type ArchiveEntry = {
  id: string;
  content: string;
  promptTextSnapshot: string;
  isCollective: boolean;
  createdAt: string;
  updatedAt: string;
};

function formatNice(iso: string) {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

type ArchiveClientProps = {
  entries: ArchiveEntry[];
};

export function ArchiveClient({ entries }: ArchiveClientProps) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const empty = useMemo(() => entries.length === 0, [entries.length]);

  async function deleteAccount() {
    setDeleteError(null);
    if (confirmText !== "DELETE MY DATA") {
      setDeleteError('type "DELETE MY DATA" to confirm.');
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: confirmText }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setDeleteError(data?.error ?? "could not delete account.");
        return;
      }

      await signOut({ callbackUrl: "/" });
    } catch {
      setDeleteError("could not delete account.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="bw-row" style={{ marginBottom: 14 }}>
        <div className="bw-date">private archive</div>
        <BwNavButton onClick={() => signOut({ callbackUrl: "/" })}>
          sign out
        </BwNavButton>
      </div>

      {empty ? (
        <div className="bw-hint" style={{ marginTop: 10 }}>
          nothing here yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {entries.map((entry) => (
            <div key={entry.id} className="bw-card">
              <div className="bw-cardMeta">
                <div className="bw-cardDate">{formatNice(entry.createdAt)}</div>
                {entry.isCollective && <span className="bw-collectiveBadge">shared on collective</span>}
              </div>
              <div className="bw-cardPrompt">&quot;{entry.promptTextSnapshot}&quot;</div>
              <div className="bw-cardText">{entry.content || " "}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bw-card" style={{ marginTop: 22 }}>
        <div className="bw-cardDate">delete account + all entries</div>
        <div className="bw-hint" style={{ textAlign: "left", marginTop: 8 }}>
          type <code>DELETE MY DATA</code> to confirm permanent deletion.
        </div>
        <input
          className="bw-input"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          placeholder="DELETE MY DATA"
          style={{ marginTop: 10, height: 40 }}
        />
        <div className="bw-row" style={{ marginTop: 8 }}>
          <div className="bw-date">this action cannot be undone.</div>
          <button className="bw-btn" onClick={deleteAccount} disabled={deleting}>
            {deleting ? "deleting..." : "delete account"}
          </button>
        </div>
        {deleteError && <div className="bw-hint">{deleteError}</div>}
      </div>
    </>
  );
}
