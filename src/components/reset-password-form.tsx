"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { BwNavButton } from "@/components/ui/bw-nav-button";

type ResetPasswordFormProps = {
  email: string;
  token: string;
};

export function ResetPasswordForm({ email, token }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDone(false);

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
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          token,
          password,
          confirmPassword,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error ?? "could not reset password.");
        return;
      }

      setDone(true);
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("could not reset password.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="bw-bg">
      <div className="bw-top">
        <BwNavButton href="/sign-in">
          sign in
        </BwNavButton>
        <span className="bw-brand">reset password</span>
        <span className="bw-brand" style={{ opacity: 0 }}>
          ghost
        </span>
      </div>

      <main className="bw-stage">
        <div className="bw-panel show" style={{ width: "min(560px, 94vw)" }}>
          <div className="bw-prompt" style={{ fontStyle: "normal" }}>
            choose a new password for {email}.
          </div>

          <form onSubmit={handleSubmit} className="bw-panel show" style={{ gap: 10 }}>
            <input
              className="bw-input"
              type="password"
              autoComplete="new-password"
              placeholder="new password (min 10 chars)"
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
              {isPending ? "resetting..." : "reset password"}
            </button>
          </form>

          {error && <div className="bw-hint">{error}</div>}
          {done && (
            <div className="bw-hint">
              password reset complete. <Link className="bw-link" href="/sign-in">sign in</Link>.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
