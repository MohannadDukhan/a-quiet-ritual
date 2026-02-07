import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/security";

const deleteAccountSchema = z.object({
  confirmation: z.literal("DELETE MY DATA"),
});

export const runtime = "nodejs";

export async function DELETE(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const ip = getClientIp(request);
  const ipLimit = await consumeRateLimit({
    key: `delete-account:ip:${ip}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!ipLimit.ok) {
    const retryAfter = Math.max(1, Math.ceil((ipLimit.resetAt.getTime() - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many account deletion attempts. Try later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = deleteAccountSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Deletion confirmation is required." }, { status: 400 });
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  return NextResponse.json({ ok: true });
}
