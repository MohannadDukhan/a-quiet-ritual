import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiRequest } from "@/lib/admin-api";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const unbanUserSchema = z.object({
  userId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdminApiRequest({
    request,
    action: "moderation-user-unban",
  });
  if (!guard.ok) {
    return guard.response;
  }

  const payload = await request.json().catch(() => null);
  const parsed = unbanUserSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  const updated = await prisma.user.updateMany({
    where: { id: parsed.data.userId },
    data: { collectiveBanned: false },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
