import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiRequest } from "@/lib/admin-api";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const removeReplySchema = z.object({
  replyId: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdminApiRequest({
    request,
    action: "moderation-reply-remove",
  });
  if (!guard.ok) {
    return guard.response;
  }

  const payload = await request.json().catch(() => null);
  const parsed = removeReplySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reply id." }, { status: 400 });
  }

  const deleted = await prisma.collectiveReply.deleteMany({
    where: { id: parsed.data.replyId },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Reply not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
