import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin } from "@/lib/assert-same-origin";
import { createRawToken, hashToken, tokenExpiry } from "@/lib/auth-tokens";
import { getAuthBaseUrl, sendEmailVerificationEmail } from "@/lib/auth-email";
import { prisma } from "@/lib/db";
import { consumeMemoryRateLimit } from "@/lib/memory-rate-limit";
import { getClientIp } from "@/lib/security";

const signupSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(10).max(128),
    confirmPassword: z.string().min(10).max(128),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "passwords do not match",
    path: ["confirmPassword"],
  });

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    console.log("signup start");

    const originError = assertSameOrigin(request);
    if (originError) {
      return originError;
    }

    const ip = getClientIp(request);
    const ipLimit = consumeMemoryRateLimit({
      namespace: "signup-ip",
      key: ip,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!ipLimit.ok) {
      return NextResponse.json({ error: "Too many signup attempts. Try later." }, { status: 429 });
    }

    const json = await request.json().catch(() => null);
    const parsed = signupSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid signup input." }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }
    if (!process.env.EMAIL_FROM) {
      throw new Error("EMAIL_FROM is not set");
    }
    if (!process.env.AUTH_URL && !process.env.NEXTAUTH_URL) {
      throw new Error("AUTH_URL or NEXTAUTH_URL must be set");
    }

    const email = parsed.data.email.toLowerCase();
    const emailLimit = consumeMemoryRateLimit({
      namespace: "signup-email-ip",
      key: `${email}:${ip}`,
      limit: 4,
      windowMs: 15 * 60 * 1000,
    });
    if (!emailLimit.ok) {
      return NextResponse.json({ error: "Too many signup attempts. Try later." }, { status: 429 });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    await prisma.user.create({
      data: {
        email,
        passwordHash,
      },
      select: { id: true },
    });
    console.log("user created");

    const rawToken = createRawToken();
    const tokenHash = hashToken(rawToken);

    await prisma.emailVerificationToken.create({
      data: {
        identifier: email,
        tokenHash,
        expires: tokenExpiry(60),
      },
    });
    console.log("verification token created");

    const verificationUrl = `${getAuthBaseUrl()}/verify-email?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;
    await sendEmailVerificationEmail({
      to: email,
      verificationUrl,
    });
    console.log("verification email sent");

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "account already exists" }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("SIGNUP_ERROR", { message, stack });
    return NextResponse.json({ error: "SIGNUP_ERROR", message }, { status: 500 });
  }
}
