"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { BwModal } from "@/components/ui/bw-modal";

const JOURNAL_DRAFT_KEY = "bw_journal_draft";

type JournalEditorProps = {
  initialTodayEntry?: {
    id: string;
    content: string;
  } | null;
};

type JournalEntryPayload = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type JournalEntryResponse = {
  entry?: JournalEntryPayload | null;
  error?: string;
};

function getLocalDayBoundsIso(now: Date = new Date()): { startTs: string; endTs: string } {
  const startLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return {
    startTs: startLocal.toISOString(),
    endTs: endLocal.toISOString(),
  };
}

export function JournalEditor({ initialTodayEntry = null }: JournalEditorProps) {
  const router = useRouter();
  const [hasTodayEntry, setHasTodayEntry] = useState(Boolean(initialTodayEntry?.id));
  const [isEditing, setIsEditing] = useState(!initialTodayEntry?.id);
  const [loadingEntry, setLoadingEntry] = useState(true);
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
  const journalLockedNotice = "you've already written in your journal today.";
  const dayBounds = useMemo(() => getLocalDayBoundsIso(), []);
  const isLockedView = hasTodayEntry && !isEditing;

  useEffect(() => {
    let cancelled = false;

    async function loadTodayEntry() {
      try {
        const params = new URLSearchParams({
          startTs: dayBounds.startTs,
          endTs: dayBounds.endTs,
        });
        const response = await fetch(`/api/journal?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json().catch(() => null)) as JournalEntryResponse | null;
        if (!response.ok || cancelled) {
          return;
        }
        if (data?.entry?.id) {
          setText(data.entry.content);
          setHasTodayEntry(true);
          setIsEditing(false);
          try {
            localStorage.removeItem(JOURNAL_DRAFT_KEY);
          } catch {
            // ignore storage errors
          }
        }
      } finally {
        if (!cancelled) {
          setLoadingEntry(false);
        }
      }
    }

    void loadTodayEntry();
    return () => {
      cancelled = true;
    };
  }, [dayBounds.endTs, dayBounds.startTs]);

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
          startTs: dayBounds.startTs,
          endTs: dayBounds.endTs,
        }),
      });
      const data = (await response.json().catch(() => null)) as JournalEntryResponse | null;

      if (!response.ok || !data?.entry) {
        setError(data?.error ?? "could not save right now.");
        return;
      }

      setText(data.entry.content);
      setHasTodayEntry(true);
      setIsEditing(false);
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

  function handleUnlockOverlay() {
    setIsEditing(true);
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

      <div className="bw-textareaShell">
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

        {isLockedView && (
          <button
            className="bw-lockOverlay bw-lockOverlayInteractive bw-lockOverlayPulse"
            type="button"
            onClick={handleUnlockOverlay}
            aria-label="unlock journal editor"
          >
            <span className="bw-lockOverlayTitle">{journalLockedNotice}</span>
            <span className="bw-lockOverlayHint">click to edit or add more.</span>
          </button>
        )}
      </div>

      <div className="bw-row">
        <div className="bw-ui bw-date">
          {loadingEntry ? "loading..." : saved ? "saved." : "private only"}
        </div>
        <button className="bw-btn" onClick={handleSave} disabled={saving || loadingEntry || isLockedView}>
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
