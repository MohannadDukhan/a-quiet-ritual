import { UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";

const DEFAULT_OWNER_EMAIL = "dukhamohannad@gmail.com";

function normalizeEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase();
}

export const OWNER_EMAIL = normalizeEmail(process.env.OWNER_EMAIL || DEFAULT_OWNER_EMAIL);
export const PRIMARY_ADMIN_EMAIL = OWNER_EMAIL;

export function isOwnerEmail(email: string | null | undefined): boolean {
  return OWNER_EMAIL.length > 0 && normalizeEmail(email) === OWNER_EMAIL;
}

export function isOwnerSession(session: { user?: { email?: string | null } } | null | undefined): boolean {
  return isOwnerEmail(session?.user?.email);
}

export function isPrimaryAdminEmail(email: string | null | undefined): boolean {
  return isOwnerEmail(email);
}

export function roleForEmail(email: string | null | undefined): UserRole {
  return isOwnerEmail(email) ? "ADMIN" : "USER";
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

export async function ensurePrimaryAdminRoleByUserId(userId: string): Promise<UserRole | null> {
  const user = await ensurePrimaryAdminUserByUserId(userId);
  return user?.role ?? null;
}
