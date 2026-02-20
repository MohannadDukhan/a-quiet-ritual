import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin } from "@/lib/assert-same-origin";
import { createRawToken, hashToken, tokenExpiry } from "@/lib/auth-tokens";
import {
  getAuthBaseUrl,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from "@/lib/auth-email";
import { prisma } from "@/lib/db";
import { rateLimited } from "@/lib/http-errors";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/security";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

const GENERIC_RESPONSE = {
  ok: true,
  message: "If an account exists, a reset email has been sent.",
};

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    console.info("[auth][forgot-password] request start");

    const originError = assertSameOrigin(request);
    if (originError) {
      return originError;
    }

    const ip = getClientIp(request);
    const ipLimit = await consumeRateLimit({
      key: `forgot-ip:${ip}`,
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (!ipLimit.ok) {
      const retryAfterSeconds = Math.max(1, Math.ceil((ipLimit.resetAt.getTime() - Date.now()) / 1000));
      return rateLimited(undefined, retryAfterSeconds);
    }

    const json = await request.json().catch(() => null);
    const parsed = forgotPasswordSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    const email = parsed.data.email.toLowerCase();

    const emailLimit = await consumeRateLimit({
      key: `forgot-email-ip:${email}:${ip}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!emailLimit.ok) {
      const retryAfterSeconds = Math.max(1, Math.ceil((emailLimit.resetAt.getTime() - Date.now()) / 1000));
      return rateLimited(undefined, retryAfterSeconds);
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true, passwordHash: true },
    });

    if (!user) {
      console.info("[auth][forgot-password] no account action taken");
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    if (!user.emailVerified) {
      console.info("[auth][forgot-password] unverified account, sending verification email");
      const rawToken = createRawToken();
      const tokenHash = hashToken(rawToken);

      await prisma.emailVerificationToken.deleteMany({
        where: { identifier: email },
      });
      await prisma.emailVerificationToken.create({
        data: {
          identifier: email,
          tokenHash,
          expires: tokenExpiry(60),
        },
      });
      console.info("[auth][forgot-password] verification token created");

      const verificationUrl = `${getAuthBaseUrl()}/verify-email?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;
      console.info("[auth][forgot-password] verification email send attempt");
      await sendEmailVerificationEmail({
        to: email,
        verificationUrl,
      });
      console.info("[auth][forgot-password] verification email sent");
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    console.info("[auth][forgot-password] verified account, issuing reset token");
    const rawToken = createRawToken();
    const tokenHash = hashToken(rawToken);

    await prisma.passwordResetToken.deleteMany({
      where: { identifier: email },
    });
    await prisma.passwordResetToken.create({
      data: {
        identifier: email,
        tokenHash,
        expires: tokenExpiry(60),
      },
    });
    console.info("[auth][forgot-password] reset token created");

    const resetUrl = `${getAuthBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;
    console.info("[auth][forgot-password] reset email send attempt");
    await sendPasswordResetEmail({
      to: email,
      resetUrl,
    });
    console.info("[auth][forgot-password] reset email sent");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("FORGOT_PASSWORD_ERROR", { message, stack });
  }

  return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
}
