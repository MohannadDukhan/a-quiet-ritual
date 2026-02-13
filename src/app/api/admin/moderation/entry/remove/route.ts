import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiRequest } from "@/lib/admin-api";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const removeEntrySchema = z.object({
  entryId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const guard = await requireAdminApiRequest({
    request,
    action: "moderation-entry-remove",
  });
  if (!guard.ok) {
    return guard.response;
  }

  const payload = await request.json().catch(() => null);
  const parsed = removeEntrySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid entry id." }, { status: 400 });
  }

  const entry = await prisma.entry.findUnique({
    where: { id: parsed.data.entryId },
    select: { id: true },
  });
  if (!entry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.collectiveReply.deleteMany({
      where: { entryId: entry.id },
    }),
    prisma.entry.update({
      where: { id: entry.id },
      data: {
        isCollective: false,
        collectivePublishedAt: null,
        collectiveRemovedAt: new Date(),
        collectiveRemovedReason: "removed by admin",
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
