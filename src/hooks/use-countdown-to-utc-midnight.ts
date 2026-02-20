"use client";

import { useEffect, useMemo, useState } from "react";

function getMsUntilNextUtcMidnight(now: Date): number {
  const nextUtcMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  );
  return Math.max(0, nextUtcMidnight.getTime() - now.getTime());
}

function formatCountdown(diffMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function useCountdownToUtcMidnight(enabled: boolean): string {
  const [remainingMs, setRemainingMs] = useState(() => getMsUntilNextUtcMidnight(new Date()));

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const tick = () => {
      setRemainingMs(getMsUntilNextUtcMidnight(new Date()));
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [enabled]);

  return useMemo(() => formatCountdown(remainingMs), [remainingMs]);
}
