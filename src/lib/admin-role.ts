import { UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";

export const PRIMARY_ADMIN_EMAIL = "dukhanmohannad@gmail.com";

function normalizeEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase();
}

export function isPrimaryAdminEmail(email: string | null | undefined): boolean {
  return normalizeEmail(email) === PRIMARY_ADMIN_EMAIL;
}

export function roleForEmail(email: string | null | undefined): UserRole {
  return isPrimaryAdminEmail(email) ? "ADMIN" : "USER";
}

export type PrimaryAdminSessionUser = {
  id: string;
  email: string;
  role: UserRole;
  username: string | null;
};

export async function ensurePrimaryAdminUserByUserId(userId: string): Promise<PrimaryAdminSessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      username: true,
    },
  });

  if (!user) {
    return null;
  }

  if (isPrimaryAdminEmail(user.email) && user.role !== "ADMIN") {
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

export async function ensurePrimaryAdminRoleByUserId(userId: string): Promise<UserRole | null> {
  const user = await ensurePrimaryAdminUserByUserId(userId);
  return user?.role ?? null;
}
