import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

type DeleteReplyRouteContext = {
  params: Promise<{ replyId: string }>;
};

const paramsSchema = z.object({
  replyId: z.string().min(1),
});

export async function DELETE(request: NextRequest, context: DeleteReplyRouteContext) {
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
    return NextResponse.json({ error: "invalid reply." }, { status: 400 });
  }
  const replyId = parsedParams.data.replyId;

  const reply = await prisma.collectiveReply.findUnique({
    where: { id: replyId },
    select: {
      id: true,
      userId: true,
    },
  });
  if (!reply) {
    return NextResponse.json({ error: "reply not found." }, { status: 404 });
  }
  if (!reply.userId || reply.userId !== userId) {
    return NextResponse.json({ error: "forbidden." }, { status: 403 });
  }

  const deleted = await prisma.collectiveReply.deleteMany({
    where: {
      id: reply.id,
      userId,
    },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "reply not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
