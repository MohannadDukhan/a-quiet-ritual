"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { TermsModal } from "@/components/terms/terms-modal";
import { BwNavButton } from "@/components/ui/bw-nav-button";
import {
  evaluatePasswordStrength,
  getPasswordValidationError,
  PASSWORD_REQUIREMENT_LABELS,
} from "@/lib/password-strength";
import { normalizeUsername, validateNormalizedUsername } from "@/lib/username";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type UsernameAvailabilityState = "idle" | "checking" | "available" | "taken" | "invalid" | "error";
type PasswordRequirementKey = keyof typeof PASSWORD_REQUIREMENT_LABELS;

const PASSWORD_REQUIREMENT_KEYS: PasswordRequirementKey[] = ["minLength", "uppercase", "number", "special"];
const PASSWORD_STRENGTH_SEGMENTS: Record<ReturnType<typeof evaluatePasswordStrength>["level"], number> = {
  weak: 1,
  ok: 2,
  good: 3,
  strong: 4,
};

export default function SignUpPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameAvailabilityState>("idle");
  const [usernameHint, setUsernameHint] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [termsReadToEnd, setTermsReadToEnd] = useState(false);

  const normalizedUsername = useMemo(() => normalizeUsername(username), [username]);
  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const emailIsValid = EMAIL_PATTERN.test(normalizedEmail);
  const usernameValidationError = useMemo(
    () => (normalizedUsername ? validateNormalizedUsername(normalizedUsername) : null),
    [normalizedUsername],
  );
  const passwordValidationError = useMemo(() => getPasswordValidationError(password), [password]);
  const passwordStrength = useMemo(() => evaluatePasswordStrength(password), [password]);
  const confirmPasswordError =
    confirmPassword.length > 0 && password !== confirmPassword ? "passwords do not match." : null;
  const strengthSegments = PASSWORD_STRENGTH_SEGMENTS[passwordStrength.level];
  const usernameReady =
    Boolean(normalizedUsername) &&
    !usernameValidationError &&
    (usernameStatus === "available" || usernameStatus === "error");
  const passwordReady = password.length > 0 && !passwordValidationError;
  const confirmPasswordReady = confirmPassword.length > 0 && !confirmPasswordError;
  const canSubmit =
    usernameReady && emailIsValid && passwordReady && confirmPasswordReady && acceptedTerms && !isPending;

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
  }, [normalizedUsername, usernameValidationError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDone(false);

    if (!normalizedUsername) {
      setError("username is required.");
      return;
    }

    if (usernameValidationError) {
      setError(usernameValidationError);
      return;
    }

    if (usernameStatus === "checking" || usernameStatus === "idle") {
      setError("wait until username availability check completes.");
      return;
    }

    if (usernameStatus === "taken") {
      setError("username is taken.");
      return;
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("enter a valid email.");
      return;
    }

    if (passwordValidationError) {
      setError(passwordValidationError);
      return;
    }

    if (password !== confirmPassword) {
      setError("passwords do not match.");
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
          username: normalizedUsername,
          email: normalizedEmail,
          password,
          confirmPassword,
          acceptedTerms,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;

      if (!response.ok) {
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
          <h1 className="bw-authTitle">
            create account
          </h1>
          <div className="bw-authLead">
            create a private account for your archive.
          </div>

          <form onSubmit={handleSubmit} className="bw-panel show bw-authForm" style={{ gap: 10 }}>
            <input
              className="bw-input"
              type="text"
              autoComplete="username"
              placeholder="username (3-20, letters/numbers/underscore)"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value.toLowerCase());
                setUsernameStatus("idle");
                setUsernameHint(null);
                setError(null);
              }}
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

            <div className="bw-passWrap">
              <input
                className="bw-input bw-passInput"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="confirm password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setError(null);
                }}
                style={{ height: 44 }}
                required
              />
              <button
                type="button"
                className="bw-passToggle"
                aria-label={showConfirmPassword ? "hide confirm password" : "show confirm password"}
                aria-pressed={showConfirmPassword}
                onClick={() => setShowConfirmPassword((prev) => !prev)}
              >
                {showConfirmPassword ? "hide" : "show"}
              </button>
            </div>
            {confirmPasswordError && (
              <div className="bw-hint bw-authErrorText">
                {confirmPasswordError}
              </div>
            )}

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
              account created. check your email to verify before signing in.
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
