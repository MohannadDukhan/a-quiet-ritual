"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";

type SignInFormProps = {
  nextPath: string;
  sentInitially: boolean;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInForm({ nextPath, sentInitially }: SignInFormProps) {
  const router = useRouter();
  const { status } = useSession();

  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(sentInitially);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(nextPath);
    }
  }, [nextPath, router, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSent(false);

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("enter a valid email.");
      return;
    }

    setIsPending(true);
    const result = await signIn("email", {
      email: normalizedEmail,
      redirect: false,
      callbackUrl: nextPath,
    });
    setIsPending(false);

    if (result?.error) {
      setError("could not send link right now.");
      return;
    }

    setSent(true);
  }

  return (
    <div className="bw-bg">
      <div className="bw-top">
        <Link className="bw-link" href={nextPath}>
          back
        </Link>
        <span className="bw-brand">continue with email</span>
        <span className="bw-brand" style={{ opacity: 0 }}>
          ghost
        </span>
      </div>

      <main className="bw-stage">
        <div className="bw-panel show" style={{ width: "min(560px, 94vw)" }}>
          <div className="bw-prompt" style={{ fontStyle: "normal" }}>
            private sign-in. no username. no public profile.
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
              {isPending ? "sending..." : "continue with email"}
            </button>
          </form>

          {error && <div className="bw-hint">{error}</div>}
          {sent && (
            <div className="bw-hint">
              check your inbox for a sign-in link. it expires shortly.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
