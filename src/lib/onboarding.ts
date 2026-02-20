import type { Session } from "next-auth";

export const ONBOARDING_USERNAME_PATH = "/onboarding/username";

export function needsUsernameOnboarding(session: Session | null | undefined): boolean {
  return Boolean(session?.user?.id && !session.user?.username);
}
