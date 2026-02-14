import { UserRole } from "@prisma/client";

import { auth } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/admin-role";
import { prisma } from "@/lib/db";

export type SessionUserRecord = {
  id: string;
  email: string;
  role: UserRole;
  collectiveBanned: boolean;
};

export async function getSessionUserRecord(): Promise<SessionUserRecord | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      collectiveBanned: true,
    },
  });

  if (!user) {
    return null;
  }

  if (isOwnerEmail(user.email) && user.role !== "ADMIN") {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });
    return {
      ...user,
      role: "ADMIN",
    };
  }

  return user;
}

export async function requireAdminUser(): Promise<SessionUserRecord | null> {
  const user = await getSessionUserRecord();
  if (!user || user.role !== "ADMIN") {
    return null;
  }
  return user;
}

export async function requireOwnerAdminUser(): Promise<SessionUserRecord | null> {
  const user = await requireAdminUser();
  if (!user || !isOwnerEmail(user.email)) {
    return null;
  }
  return user;
}
