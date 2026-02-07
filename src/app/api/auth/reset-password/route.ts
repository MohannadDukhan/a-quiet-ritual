import bcrypt from "bcrypt";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin } from "@/lib/assert-same-origin";
import { hashToken } from "@/lib/auth-tokens";
import { prisma } from "@/lib/db";
import { consumeMemoryRateLimit } from "@/lib/memory-rate-limit";
import { getClientIp } from "@/lib/security";

const resetPasswordSchema = z
  .object({
    email: z.string().trim().email(),
    token: z.string().trim().min(1),
    password: z.string().min(10).max(128),
    confirmPassword: z.string().min(10).max(128),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "passwords do not match",
    path: ["confirmPassword"],
  });

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const originError = assertSameOrigin(request);
  if (originError) {
    return originError;
  }

  const ip = getClientIp(request);
  const ipLimit = consumeMemoryRateLimit({
    namespace: "reset-password-ip",
    key: ip,
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipLimit.ok) {
    return NextResponse.json({ error: "Too many reset attempts. Try later." }, { status: 429 });
  }

  const json = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reset request." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const emailLimit = consumeMemoryRateLimit({
    namespace: "reset-password-email-ip",
    key: `${email}:${ip}`,
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (!emailLimit.ok) {
    return NextResponse.json({ error: "Too many reset attempts. Try later." }, { status: 429 });
  }

  const tokenHash = hashToken(parsed.data.token);
  const tokenRecord = await prisma.passwordResetToken.findUnique({
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

  if (!tokenRecord || tokenRecord.expires <= new Date()) {
    return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
  }

  const newPasswordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    }),
    prisma.passwordResetToken.delete({
      where: { id: tokenRecord.id },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
