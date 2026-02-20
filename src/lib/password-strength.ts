export const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_STRONG_LENGTH = 14;

type PasswordRequirementResult = {
  minLength: boolean;
  uppercase: boolean;
  number: boolean;
  special: boolean;
};

export type PasswordStrengthLevel = "weak" | "ok" | "good" | "strong";

export type PasswordStrengthResult = {
  level: PasswordStrengthLevel;
  score: number;
  progressPercent: number;
  requirements: PasswordRequirementResult;
};

export const PASSWORD_REQUIREMENT_LABELS = {
  minLength: `at least ${PASSWORD_MIN_LENGTH} characters`,
  uppercase: "at least 1 uppercase letter",
  number: "at least 1 number",
  special: "at least 1 special character",
} as const;

export function getPasswordRequirementResult(password: string): PasswordRequirementResult {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export function getPasswordValidationError(password: string): string | null {
  const requirements = getPasswordRequirementResult(password);

  if (!requirements.minLength) {
    return `password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!requirements.uppercase) {
    return "password must include at least 1 uppercase letter.";
  }
  if (!requirements.number) {
    return "password must include at least 1 number.";
  }
  if (!requirements.special) {
    return "password must include at least 1 special character.";
  }

  return null;
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const requirements = getPasswordRequirementResult(password);
  const requirementCount = Object.values(requirements).filter(Boolean).length;
  const lengthBonus = password.length >= PASSWORD_STRONG_LENGTH ? 1 : 0;
  const score = requirementCount + lengthBonus;

  if (score <= 1) {
    return { level: "weak", score, progressPercent: 25, requirements };
  }

  if (score === 2) {
    return { level: "ok", score, progressPercent: 50, requirements };
  }

  if (score <= 4) {
    return { level: "good", score, progressPercent: 75, requirements };
  }

  return { level: "strong", score, progressPercent: 100, requirements };
}
