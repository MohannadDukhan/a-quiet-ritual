export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_]{2,19}$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validateNormalizedUsername(value: string): string | null {
  if (value.length < USERNAME_MIN_LENGTH || value.length > USERNAME_MAX_LENGTH) {
    return "username must be 3-20 characters.";
  }
  if (!USERNAME_PATTERN.test(value)) {
    return "username must start with a letter or number and only use letters, numbers, or underscores.";
  }
  return null;
}

export function validateUsernameInput(value: string): string | null {
  return validateNormalizedUsername(normalizeUsername(value));
}
