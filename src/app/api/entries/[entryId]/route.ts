import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

type DeleteEntryRouteContext = {
  params: Promise<{ entryId: string }>;
};

const paramsSchema = z.object({
  entryId: z.string().uuid(),
});

export async function DELETE(request: NextRequest, context: DeleteEntryRouteContext) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "invalid entry." }, { status: 400 });
  }
  const entryId = parsedParams.data.entryId;

  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      userId: true,
    },
  });
  if (!entry) {
    return NextResponse.json({ error: "entry not found." }, { status: 404 });
  }
  if (entry.userId !== userId) {
    return NextResponse.json({ error: "forbidden." }, { status: 403 });
  }

  const deletedCount = await prisma.$transaction(async (tx) => {
    await tx.collectiveReply.deleteMany({
      where: { entryId: entry.id },
    });
    const deleted = await tx.entry.deleteMany({
      where: {
        id: entry.id,
        userId,
      },
    });
    return deleted.count;
  });

  if (deletedCount === 0) {
    return NextResponse.json({ error: "entry not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
