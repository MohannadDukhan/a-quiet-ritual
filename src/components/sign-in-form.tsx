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
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedEmail = email.trim().toLowerCase();
  const canSubmit = EMAIL_PATTERN.test(normalizedEmail) && password.length > 0 && !isPending;

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(nextPath);
    }
  }, [nextPath, router, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

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
        <span className="bw-topLabel">sign in</span>
        <BwNavButton href="/sign-up">
          create account
        </BwNavButton>
      </div>

      <main className="bw-stage">
        <div className="bw-panel show" style={{ width: "min(560px, 94vw)" }}>
          <h1 className="bw-authTitle">
            sign in
          </h1>

          <form onSubmit={handleSubmit} className="bw-panel show bw-authForm" style={{ gap: 10 }}>
            <input
              className="bw-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
              style={{ height: 44 }}
              required
            />
            <div className="bw-passWrap">
              <input
                className="bw-input bw-passInput"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError(null);
                }}
                style={{ height: 44 }}
                required
              />
              <button
                type="button"
                className="bw-passToggle"
                aria-label={showPassword ? "hide password" : "show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? "hide" : "show"}
              </button>
            </div>

            <button className="bw-btn" type="submit" disabled={!canSubmit}>
              {isPending ? "signing in..." : "sign in"}
            </button>
          </form>

          <div className="bw-row">
            <Link className="bw-authLink" href="/forgot-password">
              forgot password
            </Link>
            <Link className="bw-authLink" href="/sign-up">
              create account
            </Link>
          </div>

          {error && <div className="bw-hint" role="alert">{error}</div>}
        </div>
      </main>
    </div>
  );
}
