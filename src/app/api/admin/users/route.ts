import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiRequest } from "@/lib/admin-api";
import { isOwnerEmail } from "@/lib/admin-role";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type UserRowOwner = {
  id: string;
  username: string;
  email: string;
  collectiveBanned: boolean;
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

  if (!isOwnerEmail(guard.adminUserEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      email: true,
      collectiveBanned: true,
      createdAt: true,
    },
  });

  const rows: UserRowOwner[] = users.map((user) => ({
    id: user.id,
    username: user.username ?? "",
    email: user.email,
    collectiveBanned: user.collectiveBanned,
    createdAt: user.createdAt.toISOString(),
  }));

  return NextResponse.json({ users: rows });
}
