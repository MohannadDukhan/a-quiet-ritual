import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiRequest } from "@/lib/admin-api";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const revokeAdminSchema = z.object({
  email: z.string().trim().email(),
});

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminApiRequest({
    request,
    action: "roles",
  });
  if (!guard.ok) {
    return guard.response;
  }

  const payload = await request.json().catch(() => null);
  const parsed = revokeAdminSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid email." }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const actingUser = await prisma.user.findUnique({
    where: { id: guard.adminUserId },
    select: { email: true },
  });
  if (!actingUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (normalizeEmail(actingUser.email) === email) {
    return NextResponse.json({ error: "cannot revoke your own admin role" }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { email },
      data: { role: "USER" },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    console.error("[admin][users][revoke-admin] failed", error);
    return NextResponse.json({ error: "request failed." }, { status: 500 });
  }
}
