import "server-only";

import type { Session } from "next-auth";

import { prisma } from "@/lib/db";

export async function needsUsernameOnboardingFromDb(
  session: Session | null | undefined,
): Promise<boolean> {
  const userId = session?.user?.id;
  if (!userId) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });

  return !user?.username;
}
