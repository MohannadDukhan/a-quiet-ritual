"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  EightBallCanvas,
  type EightBallCanvasHandle,
} from "@/components/eight-ball/eight-ball-canvas";
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
const IDLE_SIZE = 392;
const REVEALED_SIZE = 332;
const INSIDE_PROMPT_MAX = 64;
const PREMIUM_TRANSITION_MS = 2400;
const REDUCED_TRANSITION_MS = 150;

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

  const [revealed, setRevealed] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
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
  const ballRef = useRef<EightBallCanvasHandle | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    sync();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", sync);
      return () => mediaQuery.removeEventListener("change", sync);
    }

    mediaQuery.addListener(sync);
    return () => mediaQuery.removeListener(sync);
  }, []);

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
    setRevealed(false);
    setSaved(false);
    setNeedsSignIn(false);
    setSaveError(null);
  }

  const revealPromptFlow = useCallback(() => {
    setRevealed(true);
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  async function handleBallClick() {
    if (isTransitioning) return;
    if (revealed) {
      resetReveal();
      return;
    }
    playBallClickSound();
    setIsTransitioning(true);

    try {
      const duration = prefersReducedMotion ? REDUCED_TRANSITION_MS : PREMIUM_TRANSITION_MS;
      const promptRequest = loadPrompt();
      if (ballRef.current) {
        await ballRef.current.playTransition({
          reducedMotion: prefersReducedMotion,
          durationMs: duration,
        });
      } else {
        await new Promise((resolve) => {
          window.setTimeout(resolve, duration);
        });
      }

      revealPromptFlow();
      void promptRequest;
    } finally {
      setIsTransitioning(false);
    }
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
  const ballStyle = {
    width: `min(${ballSize}px, 82vw)`,
    height: `min(${ballSize}px, 82vw)`,
  };

  return (
    <div className={rootClass}>
      <AppHeader brandTone={revealed ? "dark" : "light"} />

      <main className="bw-stage">
        <div className="bw-orbWrap">
          <div className="bw-float">
            <div className="bw-parallax">
              <EightBallCanvas
                ref={ballRef}
                className={isTransitioning ? "is-transitioning" : ""}
                style={ballStyle}
                ariaLabel={revealed ? "reset the 8-ball prompt" : "tap the 8-ball"}
                disabled={isTransitioning}
                revealed={revealed}
                promptText={insidePromptText}
                onPress={() => {
                  void handleBallClick();
                }}
              />
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
