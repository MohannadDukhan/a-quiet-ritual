"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";

type PromptPayload = {
  prompt: {
    id: string;
    text: string;
  };
  dateId: string;
};

const DRAFT_KEY = "bw_entry_draft";
const SHAKE_MS = 1200;
const IDLE_SIZE = 360;
const REVEALED_SIZE = 300;
const INSIDE_PROMPT_MAX = 64;

function fallbackDateId() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function HomePage() {
  const { status } = useSession();

  const [revealed, setRevealed] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [promptState, setPromptState] = useState<PromptPayload | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);

  const [text, setText] = useState("");
  const [shareOnCollective, setShareOnCollective] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const shakeTimeoutRef = useRef<number | null>(null);

  const ballSize = revealed ? REVEALED_SIZE : IDLE_SIZE;
  const promptText = promptState?.prompt.text ?? "";
  const ballPrompt = useMemo(
    () =>
      promptText.length > INSIDE_PROMPT_MAX
        ? `${promptText.slice(0, INSIDE_PROMPT_MAX - 1).trimEnd()}...`
        : promptText,
    [promptText],
  );
  const showFullPromptBelow = ballPrompt !== promptText;
  const insidePromptText = promptLoading
    ? "listening..."
    : promptError
      ? "still listening..."
      : ballPrompt || "shake to reveal";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setText(raw);
    } catch {
      // ignore draft parse/storage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, text);
    } catch {
      // ignore draft parse/storage errors
    }
  }, [text]);

  useEffect(() => {
    if (revealed) {
      document.body.classList.add("bw-light");
    } else {
      document.body.classList.remove("bw-light");
    }

    return () => {
      document.body.classList.remove("bw-light");
    };
  }, [revealed]);

  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current !== null) {
        window.clearTimeout(shakeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      document.documentElement.style.setProperty("--px", String(x));
      document.documentElement.style.setProperty("--py", String(y));
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  async function loadPrompt() {
    setPromptLoading(true);
    setPromptError(null);

    try {
      const response = await fetch("/api/prompt/today", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as PromptPayload | null;

      if (!response.ok || !data?.prompt?.id || !data.prompt.text) {
        setPromptError("prompt unavailable right now.");
        return;
      }

      setPromptState(data);
    } catch {
      setPromptError("prompt unavailable right now.");
    } finally {
      setPromptLoading(false);
    }
  }

  function resetReveal() {
    if (shakeTimeoutRef.current !== null) {
      window.clearTimeout(shakeTimeoutRef.current);
      shakeTimeoutRef.current = null;
    }
    setIsShaking(false);
    setRevealed(false);
    setSaved(false);
    setNeedsSignIn(false);
    setSaveError(null);
  }

  function handleBallClick() {
    if (isShaking) return;
    if (revealed) {
      resetReveal();
      return;
    }

    setIsShaking(true);
    shakeTimeoutRef.current = window.setTimeout(() => {
      setIsShaking(false);
      setRevealed(true);
      void loadPrompt();
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      shakeTimeoutRef.current = null;
    }, SHAKE_MS);
  }

  async function handleSave() {
    const trimmed = text.trim();
    setSaveError(null);
    setSaved(false);

    if (!trimmed) {
      setSaveError("write something first.");
      return;
    }

    if (!promptState?.prompt.id) {
      setSaveError("wait for the prompt to load.");
      return;
    }

    if (status !== "authenticated") {
      setNeedsSignIn(true);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptId: promptState.prompt.id,
          content: trimmed,
          shareOnCollective,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setNeedsSignIn(true);
          return;
        }

        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setSaveError(data?.error ?? "could not save right now.");
        return;
      }

      setSaved(true);
      setNeedsSignIn(false);
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      setSaveError("could not save right now.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut({ callbackUrl: "/" });
  }

  const rootClass = ["bw-bg", revealed ? "bw-revealed" : ""].filter(Boolean).join(" ");
  const dateLabel = promptState?.dateId ?? fallbackDateId();

  return (
    <div className={rootClass}>
      <div className="bw-top">
        <span className="bw-brand">a quiet ritual</span>
        <div className="bw-topRight">
          <Link className="bw-link" href="/archive">
            archive
          </Link>
          <Link className="bw-link" href="/collective">
            collective
          </Link>
          {status === "authenticated" ? (
            <button className="bw-miniLink" onClick={handleSignOut}>
              sign out
            </button>
          ) : (
            <Link className="bw-link" href="/sign-in?next=/">
              sign in
            </Link>
          )}
        </div>
      </div>

      <main className="bw-stage">
        <div className="bw-orbWrap">
          <div className="bw-float">
            <div className="bw-parallax">
              <div
                className={`bw-ball ${isShaking ? "bw-shake" : ""}`}
                onClick={handleBallClick}
                style={{
                  width: `min(${ballSize}px, 82vw)`,
                  height: `min(${ballSize}px, 82vw)`,
                }}
                aria-label="tap the 8-ball"
              >
                <div className={`bw-eight ${revealed ? "is-hidden" : ""}`}>
                  <span>8</span>
                </div>
                <div className={`eightball__window ${revealed ? "show" : ""}`}>
                  <div className="eightball__windowText">{insidePromptText}</div>
                </div>
              </div>
            </div>
          </div>

          {!revealed && <div className="bw-hint">{isShaking ? "..." : "tap the 8-ball"}</div>}
          {revealed && <div className="bw-hint">tap again to reset</div>}

          <div ref={panelRef} className={`bw-panel ${revealed ? "show" : ""}`}>
            {revealed && (
              <>
                {showFullPromptBelow && <div className="bw-prompt">&quot;{promptText}&quot;</div>}

                <textarea
                  className="bw-textarea"
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value);
                    setSaved(false);
                    setSaveError(null);
                  }}
                  placeholder="write anything. nothing to prove."
                />

                <label className="bw-checkRow">
                  <input
                    className="bw-checkbox"
                    type="checkbox"
                    checked={shareOnCollective}
                    onChange={(event) => {
                      setShareOnCollective(event.target.checked);
                      setSaved(false);
                    }}
                  />
                  <span>share this on the collective</span>
                </label>

                <div className="bw-row">
                  <div className="bw-date">{dateLabel}</div>
                  <div className="bw-actions">
                    {saved && <span className="bw-date">saved.</span>}
                    <button className="bw-btn" onClick={handleSave} disabled={saving || promptLoading}>
                      {saving ? "saving..." : "save"}
                    </button>
                  </div>
                </div>

                {needsSignIn && (
                  <div className="bw-hint">
                    <Link className="bw-link" href="/sign-in?next=/">
                      sign in
                    </Link>{" "}
                    to save privately across devices.
                    {" "}
                    <Link className="bw-link" href="/sign-up">
                      create account
                    </Link>
                    .
                  </div>
                )}

                {saveError && <div className="bw-hint">{saveError}</div>}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
