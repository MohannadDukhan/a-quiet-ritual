"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { CSSProperties, PointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useEightBallTransition } from "@/components/eight-ball-transition-provider";
import { AppHeader } from "@/components/layout/app-header";
import { BwModal } from "@/components/ui/bw-modal";
import { InfoPopover } from "@/components/ui/info-popover";

type PromptPayload = {
  prompt: {
    id: string;
    text: string;
  };
  dateId: string;
};

const DRAFT_KEY = "bw_entry_draft";
const IDLE_SIZE = 360;
const REVEALED_SIZE = 300;
const INSIDE_PROMPT_MAX = 64;
const BALL_MAX_TILT_DEGREES = 8;

function fallbackDateId() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function HomePage() {
  const router = useRouter();
  const { status } = useSession();
  const { isTransitioning, startEightBallTransition } = useEightBallTransition();

  const [revealed, setRevealed] = useState(false);
  const [promptState, setPromptState] = useState<PromptPayload | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);

  const [text, setText] = useState("");
  const [shareOnCollective, setShareOnCollective] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSavedModal, setShowSavedModal] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

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
    const audio = new Audio("/sounds/ball-click.wav");
    audio.preload = "auto";
    audio.volume = 0.34;
    audioRef.current = audio;

    return () => {
      audioRef.current = null;
    };
  }, []);

  function playBallClickSound() {
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio("/sounds/ball-click.wav");
      audio.preload = "auto";
      audio.volume = 0.34;
      audioRef.current = audio;
    }
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // ignore autoplay/restriction failures without impacting interaction
    });
  }

  const loadPrompt = useCallback(async () => {
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
  }, []);

  function resetReveal() {
    setTilt({ x: 0, y: 0 });
    setRevealed(false);
    setSaved(false);
    setNeedsSignIn(false);
    setSaveError(null);
  }

  const revealPromptFlow = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setRevealed(true);
    void loadPrompt();
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loadPrompt]);

  function handleBallClick() {
    if (isTransitioning) return;
    if (revealed) {
      resetReveal();
      return;
    }
    playBallClickSound();
    setTilt({ x: 0, y: 0 });
    startEightBallTransition({ targetHref: "/#compose", onComplete: revealPromptFlow });
  }

  function handleBallPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (isTransitioning || event.pointerType === "touch") {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetX = (event.clientX - bounds.left) / bounds.width;
    const offsetY = (event.clientY - bounds.top) / bounds.height;
    const rotateY = (offsetX - 0.5) * (BALL_MAX_TILT_DEGREES * 2);
    const rotateX = (0.5 - offsetY) * (BALL_MAX_TILT_DEGREES * 2);
    setTilt({ x: rotateX, y: rotateY });
  }

  function handleBallPointerLeave() {
    setTilt({ x: 0, y: 0 });
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
      setShowSavedModal(true);
    } catch {
      setSaveError("could not save right now.");
    } finally {
      setSaving(false);
    }
  }

  function closeSavedModal() {
    setShowSavedModal(false);
  }

  function goToCollectiveFromModal() {
    setShowSavedModal(false);
    router.push("/collective");
  }

  const rootClass = ["bw-bg", revealed ? "bw-revealed" : ""].filter(Boolean).join(" ");
  const dateLabel = promptState?.dateId ?? fallbackDateId();
  const ballStyle: CSSProperties & Record<
    "--bw-tilt-x" | "--bw-tilt-y" | "--bw-gloss-shift-x" | "--bw-gloss-shift-y",
    string
  > = {
    width: `min(${ballSize}px, 82vw)`,
    height: `min(${ballSize}px, 82vw)`,
    "--bw-tilt-x": `${tilt.x.toFixed(2)}deg`,
    "--bw-tilt-y": `${tilt.y.toFixed(2)}deg`,
    "--bw-gloss-shift-x": `${(tilt.y * 1.1).toFixed(2)}px`,
    "--bw-gloss-shift-y": `${(-tilt.x * 1.1).toFixed(2)}px`,
  };

  return (
    <div className={rootClass}>
      <AppHeader brandTone={revealed ? "dark" : "light"} />

      <main className="bw-stage">
        <div className="bw-orbWrap">
          <div className="bw-float">
            <div className="bw-parallax">
              <button
                type="button"
                className={`bw-ball ${isTransitioning ? "bw-ball-launching" : ""}`}
                onClick={handleBallClick}
                onPointerMove={handleBallPointerMove}
                onPointerLeave={handleBallPointerLeave}
                onBlur={handleBallPointerLeave}
                style={ballStyle}
                aria-label={revealed ? "reset the 8-ball prompt" : "tap the 8-ball"}
                disabled={isTransitioning}
              >
                <span className="bw-ballSpecular" aria-hidden="true" />
                <span className="bw-ballStreak" aria-hidden="true" />
                <span className="bw-ballRimLight" aria-hidden="true" />
                <div className={`bw-eight ${revealed ? "is-hidden" : ""}`}>
                  <span>8</span>
                </div>
                <div className={`eightball__window ${revealed ? "show" : ""}`}>
                  <div className="bw-writing eightball__windowText">{insidePromptText}</div>
                </div>
              </button>
            </div>
          </div>

          {!revealed && <div className="bw-ui bw-hint">{isTransitioning ? "..." : "tap the 8-ball"}</div>}
          {revealed && <div className="bw-ui bw-hint">tap again to reset</div>}

          <div ref={panelRef} className={`bw-panel ${revealed ? "show" : ""}`}>
            {revealed && (
              <>
                {showFullPromptBelow && <div className="bw-writing bw-prompt">&quot;{promptText}&quot;</div>}

                <textarea
                  className="bw-writing bw-textarea"
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value);
                    setSaved(false);
                    setSaveError(null);
                  }}
                  placeholder="write anything. nothing to prove."
                />

                <div className="bw-checkRow">
                  <label className="bw-ui bw-checkLabel">
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
                  <InfoPopover title="what is the collective?">
                    if you enable this, your response will still save to your private archive, and a copy will also
                    appear on the collective page. the collective is a shared space where people can read anonymous
                    responses to today&rsquo;s prompt. your name and account aren&rsquo;t shown.
                  </InfoPopover>
                </div>

                <div className="bw-row">
                  <div className="bw-ui bw-date">{dateLabel}</div>
                  <div className="bw-actions">
                    {saved && <span className="bw-ui bw-date">saved.</span>}
                    <button className="bw-btn" onClick={handleSave} disabled={saving || promptLoading}>
                      {saving ? "saving..." : "save"}
                    </button>
                  </div>
                </div>

                {needsSignIn && (
                  <div className="bw-ui bw-hint">
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

                {saveError && <div className="bw-ui bw-hint">{saveError}</div>}
              </>
            )}
          </div>
        </div>
      </main>

      <BwModal
        open={showSavedModal}
        title="saved."
        description="nothing else is required today. if you want, you can read what others wrote on the collective."
        primaryLabel="go to collective"
        onPrimary={goToCollectiveFromModal}
        onClose={closeSavedModal}
      />
    </div>
  );
}
