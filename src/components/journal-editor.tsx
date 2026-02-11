"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { BwModal } from "@/components/ui/bw-modal";

const JOURNAL_DRAFT_KEY = "bw_journal_draft";

export function JournalEditor() {
  const router = useRouter();
  const [text, setText] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(JOURNAL_DRAFT_KEY) || "";
    } catch {
      return "";
    }
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSavedModal, setShowSavedModal] = useState(false);

  async function handleSave() {
    const trimmed = text.trim();
    setSaved(false);
    setError(null);

    if (!trimmed) {
      setError("write something first.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "could not save right now.");
        return;
      }

      setSaved(true);
      setShowSavedModal(true);
      try {
        localStorage.removeItem(JOURNAL_DRAFT_KEY);
      } catch {
        // ignore storage errors
      }
    } catch {
      setError("could not save right now.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="bw-journalHead">
        <h1 className="bw-journalTitle">write what&apos;s on your mind.</h1>
        <p className="bw-journalSub">no prompt today. just you.</p>
      </div>

      <textarea
        className="bw-textarea"
        value={text}
        onChange={(event) => {
          const value = event.target.value;
          setText(value);
          setSaved(false);
          setError(null);
          try {
            localStorage.setItem(JOURNAL_DRAFT_KEY, value);
          } catch {
            // ignore storage errors
          }
        }}
        placeholder="write anything. no structure required."
      />

      <div className="bw-row">
        <div className="bw-date">{saved ? "saved." : "private only"}</div>
        <button className="bw-btn" onClick={handleSave} disabled={saving}>
          {saving ? "saving..." : "save"}
        </button>
      </div>

      {error && <div className="bw-hint">{error}</div>}

      <BwModal
        open={showSavedModal}
        title="saved."
        description="your regular journal entry is now in your private archive."
        primaryLabel="go to archive"
        onPrimary={() => {
          setShowSavedModal(false);
          router.push("/archive");
        }}
        onClose={() => setShowSavedModal(false)}
      />
    </>
  );
}
