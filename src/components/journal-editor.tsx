"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { BwModal } from "@/components/ui/bw-modal";

const JOURNAL_DRAFT_KEY = "bw_journal_draft";

type JournalEditorProps = {
  initialTodayEntry?: {
    id: string;
    content: string;
  } | null;
};

type JournalSaveResponse = {
  entry?: {
    id: string;
    content: string;
  };
  error?: string;
};

export function JournalEditor({ initialTodayEntry = null }: JournalEditorProps) {
  const router = useRouter();
  const [hasTodayEntry, setHasTodayEntry] = useState(Boolean(initialTodayEntry?.id));
  const [isAddMoreMode, setIsAddMoreMode] = useState(!initialTodayEntry?.id);
  const [text, setText] = useState(() => {
    if (initialTodayEntry?.content) {
      return initialTodayEntry.content;
    }
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isLockedView = hasTodayEntry && !isAddMoreMode;
  const journalLockedNotice = "you’ve already written in your journal today.";

  async function handleSave() {
    if (isLockedView) {
      return;
    }

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
        body: JSON.stringify({
          content: trimmed,
          mode: "append",
        }),
      });
      const data = (await response.json().catch(() => null)) as JournalSaveResponse | null;

      if (!response.ok) {
        setError(data?.error ?? "could not save right now.");
        return;
      }

      if (data?.entry?.content) {
        setText(data.entry.content);
      }
      setHasTodayEntry(true);
      setIsAddMoreMode(false);
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

  function handleAddMore() {
    setIsAddMoreMode(true);
    setText("");
    setSaved(false);
    setError(null);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  return (
    <>
      <div className="bw-journalHead">
        <h1 className="bw-writing bw-journalTitle">write what&apos;s on your mind.</h1>
        <p className="bw-ui bw-journalSub">no prompt today. just you.</p>
      </div>

      {hasTodayEntry && <div className="bw-ui bw-hint">{journalLockedNotice}</div>}

      <textarea
        ref={textareaRef}
        className={`bw-writing bw-textarea${isLockedView ? " bw-contentBlurred" : ""}`}
        value={text}
        readOnly={isLockedView}
        aria-readonly={isLockedView}
        onChange={(event) => {
          if (isLockedView) {
            return;
          }
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
        placeholder={isLockedView ? "" : "write anything. what's on your mind."}
      />

      <div className="bw-row">
        <div className="bw-ui bw-date">{saved ? "saved." : "private only"}</div>
        {isLockedView ? (
          <button className="bw-btnGhost" type="button" onClick={handleAddMore}>
            add more
          </button>
        ) : (
          <button className="bw-btn" onClick={handleSave} disabled={saving}>
            {saving ? "saving..." : "save"}
          </button>
        )}
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
