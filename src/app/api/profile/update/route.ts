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
  image: z.string().optional(),
});

export const runtime = "nodejs";

function isValidImageUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
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

  if (parsed.data.username === undefined && parsed.data.image === undefined) {
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

  if (parsed.data.image !== undefined) {
    const normalizedImage = parsed.data.image.trim();
    if (!normalizedImage) {
      updateData.image = null;
    } else if (!isValidImageUrl(normalizedImage)) {
      return NextResponse.json({ error: "image must be a valid http/https url." }, { status: 400 });
    } else {
      updateData.image = normalizedImage;
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
