import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin } from "@/lib/assert-same-origin";
import { createRawToken, hashToken, tokenExpiry } from "@/lib/auth-tokens";
import {
  getAuthBaseUrl,
  sendEmailVerificationEmail,
  TransactionalEmailError,
} from "@/lib/auth-email";
import { roleForEmail } from "@/lib/admin-role";
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

const VERIFICATION_SENT_MESSAGE = "verification email sent";
const EMAIL_SERVICE_UNAVAILABLE_MESSAGE =
  "email service is not enabled for public signups yet. please try again later.";

export const runtime = "nodejs";

function successResponse(status: 200 | 201) {
  return NextResponse.json({ ok: true, message: VERIFICATION_SENT_MESSAGE }, { status });
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      ok: false,
      code,
      message,
      error: message,
    },
    { status },
  );
}

function getEmailErrorDetails(error: unknown) {
  if (error instanceof TransactionalEmailError) {
    return {
      message: error.message,
      statusCode: error.statusCode,
      providerCode: error.providerCode,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      statusCode: null,
      providerCode: null,
    };
  }

  return {
    message: "Unknown email error",
    statusCode: null,
    providerCode: null,
  };
}

function isTestingModeRestriction(error: unknown) {
  const details = getEmailErrorDetails(error);
  const statusCode = details.statusCode;
  if (statusCode === 401 || statusCode === 403) {
    return true;
  }

  const lowerMessage = details.message.toLowerCase();
  return (
    lowerMessage.includes("testing emails") ||
    lowerMessage.includes("testing mode") ||
    lowerMessage.includes("verify a domain") ||
    lowerMessage.includes("only send testing emails") ||
    lowerMessage.includes("recipient not allowed")
  );
}

function logEmailSendFailure(email: string, error: unknown) {
  const details = getEmailErrorDetails(error);
  console.error("[auth][signup] verification email send failed", {
    email,
    statusCode: details.statusCode,
    providerCode: details.providerCode,
    testingRestriction: isTestingModeRestriction(error),
    message: details.message,
  });
}

function getVerificationUrl(email: string, rawToken: string) {
  return `${getAuthBaseUrl()}/verify-email?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;
}

async function createVerificationToken(email: string) {
  const rawToken = createRawToken();
  const tokenHash = hashToken(rawToken);

  await prisma.emailVerificationToken.create({
    data: {
      identifier: email,
      tokenHash,
      expires: tokenExpiry(60),
    },
  });

  return { rawToken, tokenHash };
}

async function resendVerificationForUnverifiedUser(email: string) {
  await prisma.emailVerificationToken.deleteMany({
    where: { identifier: email },
  });

  const token = await createVerificationToken(email);

  try {
    await sendEmailVerificationEmail({
      to: email,
      verificationUrl: getVerificationUrl(email, token.rawToken),
    });
    return successResponse(200);
  } catch (error) {
    await prisma.emailVerificationToken
      .deleteMany({
        where: {
          identifier: email,
          tokenHash: token.tokenHash,
        },
      })
      .catch(() => undefined);

    logEmailSendFailure(email, error);
    return errorResponse(503, "EMAIL_SERVICE_UNAVAILABLE", EMAIL_SERVICE_UNAVAILABLE_MESSAGE);
  }
}

async function cleanupFailedNewSignup(email: string, userId: string, tokenHash: string | null) {
  try {
    await prisma.$transaction([
      prisma.emailVerificationToken.deleteMany({
        where: tokenHash
          ? {
              identifier: email,
              tokenHash,
            }
          : { identifier: email },
      }),
      prisma.user.deleteMany({
        where: {
          id: userId,
          email,
        },
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown cleanup error";
    console.warn("[auth][signup] cleanup after failed signup email send failed", {
      email,
      userId,
      message,
    });
  }
}

export async function POST(request: NextRequest) {
  let normalizedEmailForCatch: string | null = null;

  try {
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
      return errorResponse(429, "RATE_LIMITED", "Too many signup attempts. Try later.");
    }

    const json = await request.json().catch(() => null);
    const parsed = signupSchema.safeParse(json);
    if (!parsed.success) {
      return errorResponse(400, "INVALID_INPUT", "Invalid signup input.");
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
    normalizedEmailForCatch = email;
    const emailLimit = consumeMemoryRateLimit({
      namespace: "signup-email-ip",
      key: `${email}:${ip}`,
      limit: 4,
      windowMs: 15 * 60 * 1000,
    });
    if (!emailLimit.ok) {
      return errorResponse(429, "RATE_LIMITED", "Too many signup attempts. Try later.");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        emailVerified: true,
      },
    });

    if (existingUser?.emailVerified) {
      return errorResponse(409, "ACCOUNT_EXISTS", "account already exists");
    }

    if (existingUser && !existingUser.emailVerified) {
      return resendVerificationForUnverifiedUser(email);
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const createdUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: roleForEmail(email),
      },
      select: { id: true },
    });

    let createdTokenHash: string | null = null;
    let emailSendAttempted = false;
    try {
      const token = await createVerificationToken(email);
      createdTokenHash = token.tokenHash;
      emailSendAttempted = true;

      await sendEmailVerificationEmail({
        to: email,
        verificationUrl: getVerificationUrl(email, token.rawToken),
      });
      return successResponse(201);
    } catch (error) {
      await cleanupFailedNewSignup(email, createdUser.id, createdTokenHash);
      if (emailSendAttempted) {
        logEmailSendFailure(email, error);
        return errorResponse(503, "EMAIL_SERVICE_UNAVAILABLE", EMAIL_SERVICE_UNAVAILABLE_MESSAGE);
      }
      throw error;
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      try {
        if (!normalizedEmailForCatch) {
          return errorResponse(409, "ACCOUNT_EXISTS", "account already exists");
        }

        const racedUser = await prisma.user.findUnique({
          where: { email: normalizedEmailForCatch },
          select: {
            email: true,
            emailVerified: true,
          },
        });

        if (racedUser?.emailVerified) {
          return errorResponse(409, "ACCOUNT_EXISTS", "account already exists");
        }
        if (racedUser) {
          return resendVerificationForUnverifiedUser(racedUser.email);
        }
      } catch {
        // Fall through to generic error response.
      }
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return errorResponse(409, "ACCOUNT_EXISTS", "account already exists");
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("SIGNUP_ERROR", { message, stack });
    return errorResponse(500, "SIGNUP_ERROR", "could not create account.");
  }
}
