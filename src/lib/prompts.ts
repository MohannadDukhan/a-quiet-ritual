export const PROMPT_TEXTS = [
  "what did you avoid feeling today?",
  "what did you lose a little patience with today?",
  "what part of today felt heavier than it should have?",
  "what did you do today that you did not need to do?",
  "what are you carrying today that is not yours to hold?",
  "what did you quietly hope someone would notice?",
  "what felt false today, even if it looked fine?",
  "what did you want to say, but did not?",
  "what did you take personally today?",
  "what did you need today that you did not ask for?",
] as const;

export function formatDateId(date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function dailyPromptIndex(dateId: string): number {
  let hash = 0;
  for (let i = 0; i < dateId.length; i++) {
    hash = (hash * 31 + dateId.charCodeAt(i)) >>> 0;
  }
  return hash % PROMPT_TEXTS.length;
}
