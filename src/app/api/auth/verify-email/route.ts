import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin } from "@/lib/assert-same-origin";
import { hashToken } from "@/lib/auth-tokens";
import { prisma } from "@/lib/db";
import { consumeMemoryRateLimit } from "@/lib/memory-rate-limit";
import { getClientIp } from "@/lib/security";

const verifyEmailSchema = z.object({
  email: z.string().trim().email(),
  token: z.string().trim().min(1),
});

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const originError = assertSameOrigin(request);
  if (originError) {
    return originError;
  }

  const ip = getClientIp(request);
  const ipLimit = consumeMemoryRateLimit({
    namespace: "verify-email-ip",
    key: ip,
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipLimit.ok) {
    return NextResponse.json({ error: "Too many verification attempts. Try later." }, { status: 429 });
  }

  const json = await request.json().catch(() => null);
  const parsed = verifyEmailSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid verification request." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const tokenHash = hashToken(parsed.data.token);

  const record = await prisma.emailVerificationToken.findUnique({
    where: {
      identifier_tokenHash: {
        identifier: email,
        tokenHash,
      },
    },
    select: {
      id: true,
      expires: true,
    },
  });

  if (!record || record.expires <= new Date()) {
    return NextResponse.json({ error: "Invalid or expired verification link." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.updateMany({
      where: {
        email,
        emailVerified: null,
      },
      data: {
        emailVerified: new Date(),
      },
    }),
    prisma.emailVerificationToken.delete({
      where: { id: record.id },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
