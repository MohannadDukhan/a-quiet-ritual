"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type VerifyEmailStateProps = {
  email: string;
  token: string;
};

export function VerifyEmailState({ email, token }: VerifyEmailStateProps) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token }),
        });
        const data = (await response.json().catch(() => null)) as { error?: string } | null;

        if (cancelled) return;

        if (!response.ok) {
          setStatus("error");
          setError(data?.error ?? "could not verify email.");
          return;
        }

        setStatus("success");
      } catch {
        if (cancelled) return;
        setStatus("error");
        setError("could not verify email.");
      }
    }

    void verify();

    return () => {
      cancelled = true;
    };
  }, [email, token]);

  return (
    <div className="bw-bg">
      <div className="bw-top">
        <Link className="bw-link" href="/sign-in">
          sign in
        </Link>
        <span className="bw-brand">verify email</span>
        <span className="bw-brand" style={{ opacity: 0 }}>
          ghost
        </span>
      </div>

      <main className="bw-stage">
        <div className="bw-panel show" style={{ width: "min(560px, 94vw)" }}>
          {status === "loading" && <div className="bw-hint">verifying...</div>}
          {status === "success" && (
            <div className="bw-hint">
              email verified. <Link className="bw-link" href="/sign-in">sign in</Link>.
            </div>
          )}
          {status === "error" && <div className="bw-hint">{error || "verification failed."}</div>}
        </div>
      </main>
    </div>
  );
}
