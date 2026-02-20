"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { TermsModal } from "@/components/terms/terms-modal";
import { BwNavButton } from "@/components/ui/bw-nav-button";
import {
  evaluatePasswordStrength,
  getPasswordValidationError,
  PASSWORD_REQUIREMENT_LABELS,
} from "@/lib/password-strength";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type PasswordRequirementKey = keyof typeof PASSWORD_REQUIREMENT_LABELS;

const PASSWORD_REQUIREMENT_KEYS: PasswordRequirementKey[] = ["minLength", "uppercase", "number", "special"];
const PASSWORD_STRENGTH_SEGMENTS: Record<ReturnType<typeof evaluatePasswordStrength>["level"], number> = {
  weak: 1,
  ok: 2,
  good: 3,
  strong: 4,
};

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [termsReadToEnd, setTermsReadToEnd] = useState(false);
  const [deletedNotice, setDeletedNotice] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const emailIsValid = EMAIL_PATTERN.test(normalizedEmail);
  const passwordValidationError = useMemo(() => getPasswordValidationError(password), [password]);
  const passwordStrength = useMemo(() => evaluatePasswordStrength(password), [password]);
  const strengthSegments = PASSWORD_STRENGTH_SEGMENTS[passwordStrength.level];
  const passwordReady = password.length > 0 && !passwordValidationError;
  const canSubmit = emailIsValid && passwordReady && acceptedTerms && !isPending;
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDeletedNotice(params.get("deleted") === "1");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDone(false);

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("enter a valid email.");
      return;
    }

    if (passwordValidationError) {
      setError(passwordValidationError);
      return;
    }

    if (!acceptedTerms) {
      setError("you must agree to the terms before creating an account.");
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
          acceptedTerms,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;

      if (!response.ok) {
        if (response.status === 429 || data?.error === "RATE_LIMITED") {
          setError("too many requests have been sent. try again in a few minutes.");
          return;
        }
        if (data?.code === "TERMS_NOT_ACCEPTED") {
          setError("you must agree to the terms before creating an account.");
          return;
        }
        if (data?.code === "WEAK_PASSWORD" && data.error) {
          setError(data.error);
          return;
        }
        setError(data?.error ?? "could not create account.");
        return;
      }

      setDone(true);
      setPassword("");
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
          <h1 className="bw-authTitle">
            create account
          </h1>
          <div className="bw-authLead">
            create a private account for your archive.
          </div>
          {deletedNotice && <div className="bw-hint">account deleted. you can create a new account now.</div>}

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
                autoComplete="new-password"
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
            {password.length > 0 && passwordValidationError && (
              <div className="bw-hint bw-authErrorText">
                {passwordValidationError}
              </div>
            )}

            <div className="bw-passStrength" aria-live="polite">
              <div className="bw-passStrengthHeader">
                <span className="bw-passStrengthTitle">password strength</span>
                <span className="bw-passStrengthValue">{passwordStrength.level}</span>
              </div>
              <div className="bw-passMeter" role="presentation">
                {[0, 1, 2, 3].map((segment) => (
                  <span
                    key={segment}
                    className={["bw-passMeterSegment", segment < strengthSegments ? "is-active" : ""].join(" ").trim()}
                  />
                ))}
              </div>
            </div>

            <ul className="bw-passChecklist" aria-label="password requirements">
              {PASSWORD_REQUIREMENT_KEYS.map((requirement) => {
                const satisfied = passwordStrength.requirements[requirement];
                return (
                  <li key={requirement} className={["bw-passRequirement", satisfied ? "is-done" : ""].join(" ").trim()}>
                    <span className="bw-passRequirementIcon" aria-hidden="true">
                      {satisfied ? "✓" : " "}
                    </span>
                    <span>{PASSWORD_REQUIREMENT_LABELS[requirement]}</span>
                  </li>
                );
              })}
            </ul>

            <div className="bw-termsAcceptanceRow">
              <label className="bw-termsCheckboxLabel">
                <input
                  type="checkbox"
                  className="bw-checkbox"
                  checked={acceptedTerms}
                  disabled={!termsReadToEnd}
                  onChange={(event) => {
                    setAcceptedTerms(event.target.checked);
                    setError(null);
                  }}
                />
                <span>i agree to the terms</span>
              </label>
              <button
                type="button"
                className="bw-authLink bw-termsViewButton"
                onClick={() => setTermsModalOpen(true)}
              >
                view terms
              </button>
            </div>
            {!termsReadToEnd && <div className="bw-hint">scroll to the bottom to enable</div>}

            <button className="bw-btn" type="submit" disabled={!canSubmit}>
              {isPending ? "creating..." : "create account"}
            </button>
          </form>

          {error && <div className="bw-hint" role="alert">{error}</div>}
          {done && (
            <div className="bw-hint" role="status">
              account created. check your email to verify before continuing.
            </div>
          )}
        </div>
      </main>

      <TermsModal
        open={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        onReadToEnd={() => setTermsReadToEnd(true)}
      />
    </div>
  );
}
