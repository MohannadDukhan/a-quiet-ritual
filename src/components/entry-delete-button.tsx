"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type EntryDeleteButtonProps = {
  entryId: string;
  redirectTo: string;
  confirmMessage?: string;
  className?: string;
};

type DeleteEntryResponse = {
  error?: string;
};

export function EntryDeleteButton({
  entryId,
  redirectTo,
  confirmMessage = "delete this entry permanently? this cannot be undone.",
  className = "bw-rowDeleteAction bw-btnGhost",
}: EntryDeleteButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/entries/${encodeURIComponent(entryId)}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as DeleteEntryResponse | null;
      if (!response.ok) {
        setError(data?.error || "could not delete right now.");
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("could not delete right now.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button className={className} type="button" disabled={pending} onClick={() => void handleDelete()}>
        {pending ? "deleting..." : "delete"}
      </button>
      {error && <div className="bw-hint">{error}</div>}
    </>
  );
}
