import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiRequest } from "@/lib/admin-api";
import { isOwnerEmail } from "@/lib/admin-role";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const banSchema = z.object({
  banned: z.boolean(),
});

type BanRouteContext = {
  params: Promise<{ userId: string }>;
};

export async function POST(request: NextRequest, context: BanRouteContext) {
  const guard = await requireAdminApiRequest({
    request,
    action: "users-ban",
    limit: 120,
  });
  if (!guard.ok) {
    return guard.response;
  }

  if (!isOwnerEmail(guard.adminUserEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = banSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input." }, { status: 400 });
  }

  const { userId } = await context.params;
  if (!userId) {
    return NextResponse.json({ error: "invalid user." }, { status: 400 });
  }

  const updated = await prisma.user
    .update({
      where: { id: userId },
      data: { collectiveBanned: parsed.data.banned },
      select: { collectiveBanned: true },
    })
    .catch(() => null);

  if (!updated) {
    return NextResponse.json({ error: "user not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    collectiveBanned: updated.collectiveBanned,
  });
}
