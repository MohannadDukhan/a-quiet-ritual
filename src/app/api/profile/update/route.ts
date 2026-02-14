import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/security";
import { normalizeUsername, validateNormalizedUsername } from "@/lib/username";

const updateProfileSchema = z.object({
  username: z.string().optional(),
  imageDataUrl: z.string().nullable().optional(),
});

export const runtime = "nodejs";

const AVATAR_MAX_BYTES = 250 * 1024;
const IMAGE_DATA_URL_MAX_LENGTH = 500_000;
const IMAGE_DATA_URL_PATTERN = /^data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/;

function parseImageDataUrl(value: string): { mime: string; base64: string } | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > IMAGE_DATA_URL_MAX_LENGTH) {
    return null;
  }

  const match = IMAGE_DATA_URL_PATTERN.exec(trimmed);
  if (!match) {
    return null;
  }

  const mime = match[1]?.toLowerCase() || "";
  const base64 = match[2] || "";
  if (!mime || !base64) {
    return null;
  }

  return { mime, base64 };
}

function validateImageDataUrl(value: string): string | null {
  const parsed = parseImageDataUrl(value);
  if (!parsed) {
    return "avatar image must be a valid data:image payload.";
  }

  const bytes = Buffer.from(parsed.base64, "base64");
  if (bytes.length === 0) {
    return "avatar image payload is empty.";
  }

  if (bytes.length > AVATAR_MAX_BYTES) {
    return "avatar image must be under 250kb.";
  }

  return null;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "invalid origin." }, { status: 403 });
  }

  const ip = getClientIp(request);
  const ipLimit = await consumeRateLimit({
    key: `profile-update:ip:${ip}`,
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipLimit.ok) {
    const retryAfter = Math.max(1, Math.ceil((ipLimit.resetAt.getTime() - Date.now()) / 1000));
    return NextResponse.json(
      { error: "too many profile update attempts. try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  const userLimit = await consumeRateLimit({
    key: `profile-update:user:${userId}`,
    limit: 15,
    windowMs: 15 * 60 * 1000,
  });
  if (!userLimit.ok) {
    const retryAfter = Math.max(1, Math.ceil((userLimit.resetAt.getTime() - Date.now()) / 1000));
    return NextResponse.json(
      { error: "too many profile update attempts. try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid profile payload." }, { status: 400 });
  }

  if (parsed.data.username === undefined && parsed.data.imageDataUrl === undefined) {
    return NextResponse.json({ error: "nothing to update." }, { status: 400 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      image: true,
      displayName: true,
    },
  });
  if (!currentUser) {
    return NextResponse.json({ error: "user not found." }, { status: 404 });
  }

  const updateData: {
    username?: string;
    usernameUpdatedAt?: Date;
    image?: string | null;
    displayName?: string | null;
  } = {};

  if (parsed.data.username !== undefined) {
    const normalizedUsername = normalizeUsername(parsed.data.username);
    const usernameError = validateNormalizedUsername(normalizedUsername);
    if (usernameError) {
      return NextResponse.json({ error: usernameError }, { status: 400 });
    }

    if (normalizedUsername !== currentUser.username) {
      const existing = await prisma.user.findUnique({
        where: { username: normalizedUsername },
        select: { id: true },
      });
      if (existing && existing.id !== userId) {
        return NextResponse.json({ error: "username is taken" }, { status: 409 });
      }

      updateData.username = normalizedUsername;
      updateData.usernameUpdatedAt = new Date();
      if (!currentUser.displayName || currentUser.displayName === currentUser.username) {
        updateData.displayName = normalizedUsername;
      }
    }
  }

  if (parsed.data.imageDataUrl !== undefined) {
    const imageDataUrl = parsed.data.imageDataUrl;
    if (imageDataUrl === null) {
      updateData.image = null;
    } else {
      const imageError = validateImageDataUrl(imageDataUrl);
      if (imageError) {
        return NextResponse.json({ error: imageError }, { status: 400 });
      }
      updateData.image = imageDataUrl.trim();
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({
      ok: true,
      user: {
        username: currentUser.username,
        image: currentUser.image,
        displayName: currentUser.displayName,
      },
    });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        username: true,
        image: true,
        displayName: true,
        usernameUpdatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      user: {
        username: updatedUser.username,
        image: updatedUser.image,
        displayName: updatedUser.displayName,
        usernameUpdatedAt: updatedUser.usernameUpdatedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "username is taken" }, { status: 409 });
    }
    console.error("[profile][update] failed", error);
    return NextResponse.json({ error: "could not update profile." }, { status: 500 });
  }
}
