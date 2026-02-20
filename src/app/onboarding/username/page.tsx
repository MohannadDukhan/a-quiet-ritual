"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { normalizeUsername, validateNormalizedUsername } from "@/lib/username";

type UsernameAvailabilityState = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

export default function OnboardingUsernamePage() {
  const router = useRouter();
  const { status } = useSession();
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameAvailabilityState>("idle");
  const [usernameHint, setUsernameHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(true);

  const normalizedUsername = useMemo(() => normalizeUsername(usernameDraft), [usernameDraft]);
  const usernameValidationError = useMemo(
    () => (normalizedUsername ? validateNormalizedUsername(normalizedUsername) : null),
    [normalizedUsername],
  );

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/sign-in?next=/onboarding/username");
      setCheckingProfile(false);
      return;
    }
    if (status !== "authenticated") {
      return;
    }

    let cancelled = false;
    async function loadProfile() {
      try {
        const response = await fetch("/api/profile/update", {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json().catch(() => null)) as { user?: { username?: string | null } } | null;
        if (cancelled) {
          return;
        }

        if (response.ok && data?.user?.username) {
          router.replace("/onboarding/avatar");
          return;
        }
      } finally {
        if (!cancelled) {
          setCheckingProfile(false);
        }
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [router, status]);

  useEffect(() => {
    if (!normalizedUsername) {
      setUsernameStatus("idle");
      setUsernameHint(null);
      return;
    }

    if (usernameValidationError) {
      setUsernameStatus("invalid");
      setUsernameHint(usernameValidationError);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setUsernameStatus("checking");
      setUsernameHint("checking availability...");

      try {
        const response = await fetch(`/api/username/check?username=${encodeURIComponent(normalizedUsername)}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as
          | { available?: boolean; normalized?: string; error?: string }
          | null;

        if (!response.ok) {
          setUsernameStatus("error");
          setUsernameHint(data?.error || "could not check username.");
          return;
        }

        if (data?.available) {
          setUsernameStatus("available");
          setUsernameHint(`${data.normalized || normalizedUsername} is available.`);
          return;
        }

        setUsernameStatus("taken");
        setUsernameHint(data?.error || "username is taken.");
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") {
          return;
        }
        setUsernameStatus("error");
        setUsernameHint("could not check username.");
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [normalizedUsername, usernameValidationError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!normalizedUsername) {
      setError("username is required.");
      return;
    }
    if (usernameValidationError) {
      setError(usernameValidationError);
      return;
    }
    if (usernameStatus === "taken") {
      setError("username is taken.");
      return;
    }
    if (usernameStatus === "checking" || usernameStatus === "idle") {
      setError("wait for username availability.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalizedUsername }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; message?: string }
        | null;
      if (!response.ok || !data?.ok) {
        if (response.status === 409 || data?.error === "USERNAME_TAKEN") {
          setError("username is taken.");
          return;
        }
        setError(data?.error || "could not save username.");
        return;
      }

      router.refresh();
      router.push("/onboarding/avatar");
    } catch {
      setError("could not save username.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bw-bg">
      <div className="bw-top">
        <span className="bw-topLabel" style={{ opacity: 0 }}>
          ghost
        </span>
        <span className="bw-topLabel">onboarding 1 / 4</span>
        <span className="bw-topLabel" style={{ opacity: 0 }}>
          ghost
        </span>
      </div>

      <main className="bw-stage">
        <div className="bw-panel show" style={{ width: "min(560px, 94vw)" }}>
          <h1 className="bw-authTitle">choose a username</h1>
          <p className="bw-authLead">this is required before continuing.</p>
          <form onSubmit={handleSubmit} className="bw-panel show bw-authForm" style={{ gap: 10 }}>
            <input
              className="bw-input"
              type="text"
              autoComplete="username"
              placeholder="username"
              value={usernameDraft}
              onChange={(event) => {
                setUsernameDraft(event.target.value.toLowerCase());
                setError(null);
              }}
              style={{ height: 44 }}
              required
            />
            {usernameHint && <div className="bw-hint">{usernameHint}</div>}
            <button className="bw-btn" type="submit" disabled={saving || checkingProfile}>
              {saving ? "saving..." : "continue"}
            </button>
          </form>
          {error && <div className="bw-hint">{error}</div>}
        </div>
      </main>
    </div>
  );
}
