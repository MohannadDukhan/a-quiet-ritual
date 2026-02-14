"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { BwNavButton } from "@/components/ui/bw-nav-button";
import { normalizeUsername, validateNormalizedUsername } from "@/lib/username";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type UsernameAvailabilityState = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

export default function SignUpPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameAvailabilityState>("idle");
  const [usernameHint, setUsernameHint] = useState<string | null>(null);

  const normalizedUsername = useMemo(() => normalizeUsername(username), [username]);

  useEffect(() => {
    if (!normalizedUsername) {
      setUsernameStatus("idle");
      setUsernameHint(null);
      return;
    }

    const validationError = validateNormalizedUsername(normalizedUsername);
    if (validationError) {
      setUsernameStatus("invalid");
      setUsernameHint(validationError);
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
          setUsernameHint(data?.error || "could not check username right now.");
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
        setUsernameHint("could not check username right now.");
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [normalizedUsername]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDone(false);

    if (!normalizedUsername) {
      setError("username is required.");
      return;
    }

    const usernameValidationError = validateNormalizedUsername(normalizedUsername);
    if (usernameValidationError) {
      setError(usernameValidationError);
      return;
    }

    if (usernameStatus === "taken") {
      setError("username is taken");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("enter a valid email.");
      return;
    }

    if (password.length < 10) {
      setError("password must be at least 10 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("passwords do not match.");
      return;
    }

    setIsPending(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalizedUsername,
          email: normalizedEmail,
          password,
          confirmPassword,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error ?? "could not create account.");
        return;
      }

      setDone(true);
      setPassword("");
      setConfirmPassword("");
      setUsername(normalizedUsername);
    } catch {
      setError("could not create account.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="bw-bg">
      <div className="bw-top">
        <BwNavButton href="/">
          back
        </BwNavButton>
        <span className="bw-topLabel">create account</span>
        <BwNavButton href="/sign-in">
          sign in
        </BwNavButton>
      </div>

      <main className="bw-stage">
        <div className="bw-panel show" style={{ width: "min(560px, 94vw)" }}>
          <div className="bw-prompt" style={{ fontStyle: "normal" }}>
            create a private account for your archive.
          </div>

          <form onSubmit={handleSubmit} className="bw-panel show" style={{ gap: 10 }}>
            <input
              className="bw-input"
              type="text"
              autoComplete="username"
              placeholder="username (3-20, letters/numbers/underscore)"
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              style={{ height: 44 }}
              required
            />
            {usernameHint && <div className="bw-hint">{usernameHint}</div>}
            <input
              className="bw-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={{ height: 44 }}
              required
            />
            <input
              className="bw-input"
              type="password"
              autoComplete="new-password"
              placeholder="password (min 10 chars)"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={{ height: 44 }}
              required
            />
            <input
              className="bw-input"
              type="password"
              autoComplete="new-password"
              placeholder="confirm password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              style={{ height: 44 }}
              required
            />

            <button className="bw-btn" type="submit" disabled={isPending}>
              {isPending ? "creating..." : "create account"}
            </button>
          </form>

          {error && <div className="bw-hint">{error}</div>}
          {done && (
            <div className="bw-hint">
              account created. check your email to verify before signing in.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
