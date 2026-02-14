import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireOwnerAdminApiRequest } from "@/lib/admin-api";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const grantAdminSchema = z.object({
  email: z.string().trim().email(),
});

export async function POST(request: NextRequest) {
  const guard = await requireOwnerAdminApiRequest({
    request,
    action: "roles",
  });
  if (!guard.ok) {
    return guard.response;
  }

  const payload = await request.json().catch(() => null);
  const parsed = grantAdminSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid email." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();

  try {
    await prisma.user.update({
      where: { email },
      data: { role: "ADMIN" },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    console.error("[admin][users][grant-admin] failed", error);
    return NextResponse.json({ error: "request failed." }, { status: 500 });
  }
}
