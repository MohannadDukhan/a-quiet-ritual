"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type StartEightBallTransitionOptions = {
  targetHref?: string;
  onComplete?: () => void;
};

type TransitionPhase = "idle" | "press" | "spin" | "push" | "eclipse" | "fade" | "reduced";

type EightBallTransitionContextValue = {
  isTransitioning: boolean;
  startEightBallTransition: (options?: StartEightBallTransitionOptions) => boolean;
};

const EightBallTransitionContext = createContext<EightBallTransitionContextValue | null>(null);

type EightBallTransitionProviderProps = {
  children: React.ReactNode;
};

export function EightBallTransitionProvider({ children }: EightBallTransitionProviderProps) {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [phase, setPhase] = useState<TransitionPhase>("idle");
  const runningRef = useRef(false);
  const prefersReducedMotionRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current = [];
  }, []);

  const schedule = useCallback((delayMs: number, fn: () => void) => {
    const timerId = window.setTimeout(fn, delayMs);
    timersRef.current.push(timerId);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      prefersReducedMotionRef.current = mediaQuery.matches;
    };

    sync();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", sync);
      return () => mediaQuery.removeEventListener("change", sync);
    }

    mediaQuery.addListener(sync);
    return () => mediaQuery.removeListener(sync);
  }, []);

  const finishTransition = useCallback(() => {
    clearTimers();
    runningRef.current = false;
    setPhase("idle");
    setIsVisible(false);
    setIsTransitioning(false);
  }, [clearTimers]);

  const startEightBallTransition = useCallback(
    (options?: StartEightBallTransitionOptions) => {
      if (runningRef.current) {
        return false;
      }

      runningRef.current = true;
      setIsTransitioning(true);
      setIsVisible(true);
      clearTimers();

      const runDestination = () => {
        if (options?.targetHref) {
          router.push(options.targetHref);
        }
        options?.onComplete?.();
      };

      if (prefersReducedMotionRef.current) {
        setPhase("reduced");
        schedule(180, runDestination);
        schedule(420, finishTransition);
        return true;
      }

      setPhase("press");
      schedule(120, () => setPhase("spin"));
      schedule(980, () => setPhase("push"));
      schedule(2280, () => setPhase("eclipse"));
      schedule(2980, runDestination);
      schedule(3200, () => setPhase("fade"));
      schedule(3540, finishTransition);

      return true;
    },
    [clearTimers, finishTransition, router, schedule],
  );

  useEffect(() => finishTransition, [finishTransition]);

  const value = useMemo<EightBallTransitionContextValue>(
    () => ({
      isTransitioning,
      startEightBallTransition,
    }),
    [isTransitioning, startEightBallTransition],
  );

  return (
    <EightBallTransitionContext.Provider value={value}>
      {children}
      {isVisible && (
        <div className={`bw-transitionOverlay phase-${phase}`} aria-hidden="true">
          <div className="bw-transitionBall">
            <span className="bw-transitionBallSpecular" />
            <span className="bw-transitionBallStreak" />
            <span className="bw-transitionBallRim" />
            <span className="bw-transitionEight">
              <span>8</span>
            </span>
          </div>
        </div>
      )}
    </EightBallTransitionContext.Provider>
  );
}

export function useEightBallTransition() {
  const context = useContext(EightBallTransitionContext);
  if (!context) {
    throw new Error("useEightBallTransition must be used within EightBallTransitionProvider.");
  }
  return context;
}
