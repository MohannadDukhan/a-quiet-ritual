"use client";

import { FormEvent, useState } from "react";

import { BwNavButton } from "@/components/ui/bw-nav-button";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(false);
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return;
    }

    setIsPending(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (!response.ok) {
        if (response.status === 429 || data?.error === "RATE_LIMITED") {
          setError("too many requests. try again in a few minutes.");
          return;
        }
        setError(data?.message || data?.error || "could not send reset link.");
        return;
      }
      setSent(true);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="bw-bg">
      <div className="bw-top">
        <BwNavButton href="/sign-in">
          back
        </BwNavButton>
        <span className="bw-topLabel">forgot password</span>
        <span className="bw-topLabel" style={{ opacity: 0 }}>
          ghost
        </span>
      </div>

      <main className="bw-stage">
        <div className="bw-panel show" style={{ width: "min(560px, 94vw)" }}>
          <div className="bw-prompt" style={{ fontStyle: "normal" }}>
            enter your email and we will send a reset link.
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

            <button className="bw-btn" type="submit" disabled={isPending}>
              {isPending ? "sending..." : "send reset link"}
            </button>
          </form>

          {sent && (
            <div className="bw-hint">
              if an account exists, a reset link has been sent.
            </div>
          )}
          {error && <div className="bw-hint">{error}</div>}
        </div>
      </main>
    </div>
  );
}
