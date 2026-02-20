import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiRequest } from "@/lib/admin-api";
import { isOwnerEmail } from "@/lib/admin-role";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type UserRowOwner = {
  id: string;
  username: string;
  email: string;
  createdAt: string;
};

type UserRowAdmin = {
  id: string;
  username: string;
  createdAt: string;
};

export async function GET(request: NextRequest) {
  const guard = await requireAdminApiRequest({
    request,
    action: "users-list",
    limit: 120,
  });
  if (!guard.ok) {
    return guard.response;
  }

  const owner = isOwnerEmail(guard.adminUserEmail);

  if (owner) {
    const users = await prisma.user.findMany({
      where: {
        username: { not: null },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
    });

    const rows: UserRowOwner[] = users.map((user) => ({
      id: user.id,
      username: user.username ?? "",
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    }));

    return NextResponse.json({ users: rows });
  }

  const users = await prisma.user.findMany({
    where: {
      username: { not: null },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      username: true,
      createdAt: true,
    },
  });

  const rows: UserRowAdmin[] = users.map((user) => ({
    id: user.id,
    username: user.username ?? "",
    createdAt: user.createdAt.toISOString(),
  }));

  return NextResponse.json({ users: rows });
}
