"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { BwNavButton } from "@/components/ui/bw-nav-button";

const TONE_LINES = [
  "there's nothing you need to get right here.",
  "you can write, delete, disappear, or return whenever you want.",
  "some days will be a sentence. some days will be a page.",
  "either is enough.",
];

const TONE_DELAYS_MS = [0, 650, 1350, 1950];

export default function OnboardingTonePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [visibleCount, setVisibleCount] = useState(1);
  const [reduceMotion, setReduceMotion] = useState(false);

  const allVisible = useMemo(() => (reduceMotion ? TONE_LINES.length : visibleCount), [reduceMotion, visibleCount]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/sign-in?next=/onboarding/username");
      return;
    }
    if (status === "authenticated" && !session?.user?.username) {
      router.replace("/onboarding/username");
    }
  }, [router, session?.user?.username, status]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mediaQuery.matches);

    sync();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", sync);
      return () => mediaQuery.removeEventListener("change", sync);
    }

    mediaQuery.addListener(sync);
    return () => mediaQuery.removeListener(sync);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    const timers = TONE_DELAYS_MS.slice(1).map((delayMs, index) =>
      window.setTimeout(() => {
        setVisibleCount(index + 2);
      }, delayMs),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [reduceMotion]);

  return (
    <div className="bw-bg">
      <div className="bw-top">
        <BwNavButton href="/onboarding/anonymous">
          back
        </BwNavButton>
        <span className="bw-topLabel">onboarding 4 / 4</span>
        <span className="bw-topLabel" style={{ opacity: 0 }}>
          ghost
        </span>
      </div>

      <main className="bw-stage">
        <div className="bw-panel show bw-tonePanel">
          <div className="bw-toneLines" aria-live="polite">
            {TONE_LINES.map((line, index) => (
              <p
                key={line}
                className={`bw-writing bw-toneLine${index < allVisible ? " is-visible" : ""}`}
                style={!reduceMotion ? { transitionDelay: `${index * 140}ms` } : undefined}
              >
                {line}
              </p>
            ))}
          </div>

          <div className="bw-row" style={{ justifyContent: "center" }}>
            <button className="bw-btn" type="button" onClick={() => router.push("/")}>
              go to today&apos;s prompt
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
