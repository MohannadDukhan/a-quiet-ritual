"use client";

import { FormEvent, useState } from "react";

import { BwNavButton } from "@/components/ui/bw-nav-button";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDone(false);

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
