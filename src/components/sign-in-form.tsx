"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";

import { BwNavButton } from "@/components/ui/bw-nav-button";

type SignInFormProps = {
  nextPath: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInForm({ nextPath }: SignInFormProps) {
  const router = useRouter();
  const { status } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(nextPath);
    }
  }, [nextPath, router, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("enter a valid email.");
      return;
    }

    setIsPending(true);
    const result = await signIn("credentials", {
      email: normalizedEmail,
      password,
      redirect: false,
      callbackUrl: nextPath,
    });
    setIsPending(false);

    if (result?.ok) {
      router.replace(nextPath);
      return;
    }

    const code = (result?.error || "").toUpperCase();
    if (code.includes("VERIFY_EMAIL_FIRST")) {
      setError("verify your email first.");
      return;
    }

    if (code.includes("TOO_MANY_ATTEMPTS")) {
      setError("too many attempts. try again shortly.");
      return;
    }

    setError("invalid email or password.");
  }

  return (
    <div className="bw-bg">
      <div className="bw-top">
        <BwNavButton href={nextPath}>
          back
        </BwNavButton>
        <span className="bw-brand">sign in</span>
        <BwNavButton href="/sign-up">
          create account
        </BwNavButton>
      </div>

      <main className="bw-stage">
        <div className="bw-panel show" style={{ width: "min(560px, 94vw)" }}>
          <div className="bw-prompt" style={{ fontStyle: "normal" }}>
            private account access. no public profiles.
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
              autoComplete="current-password"
              placeholder="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={{ height: 44 }}
              required
            />

            <button className="bw-btn" type="submit" disabled={isPending}>
              {isPending ? "signing in..." : "sign in"}
            </button>
          </form>

          <div className="bw-row">
            <Link className="bw-link" href="/forgot-password">
              forgot password
            </Link>
            <Link className="bw-link" href="/sign-up">
              create account
            </Link>
          </div>

          <div className="bw-hint">
            used email links before? choose forgot password to set one now.
          </div>

          {error && <div className="bw-hint">{error}</div>}
        </div>
      </main>
    </div>
  );
}
