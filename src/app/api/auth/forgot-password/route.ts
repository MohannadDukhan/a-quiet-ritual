import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createRawToken, hashToken, tokenExpiry } from "@/lib/auth-tokens";
import { getAuthBaseUrl, sendPasswordResetEmail } from "@/lib/auth-email";
import { prisma } from "@/lib/db";
import { consumeMemoryRateLimit } from "@/lib/memory-rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/security";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

const GENERIC_RESPONSE = {
  ok: true,
  message: "If an account exists, a reset email has been sent.",
};

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }

  const ip = getClientIp(request);
  const ipLimit = consumeMemoryRateLimit({
    namespace: "forgot-password-ip",
    key: ip,
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipLimit.ok) {
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }

  const json = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }

  const email = parsed.data.email.toLowerCase();

  const emailLimit = consumeMemoryRateLimit({
    namespace: "forgot-password-email-ip",
    key: `${email}:${ip}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!emailLimit.ok) {
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (user?.passwordHash) {
    const rawToken = createRawToken();
    const tokenHash = hashToken(rawToken);

    await prisma.passwordResetToken.create({
      data: {
        identifier: email,
        tokenHash,
        expires: tokenExpiry(60),
      },
    });

    try {
      const resetUrl = `${getAuthBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;
      await sendPasswordResetEmail({
        to: email,
        resetUrl,
      });
    } catch (error) {
      console.error("[auth][forgot-password] reset email failed:", error);
    }
  }

  return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
}
