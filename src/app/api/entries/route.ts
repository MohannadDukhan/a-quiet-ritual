import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/security";

const createEntrySchema = z.object({
  promptId: z.string().uuid(),
  content: z.string().trim().min(1).max(8000),
  shareOnCollective: z.boolean().optional(),
  publishPublic: z.boolean().optional(),
  spotifyTrack: z.union([z.string().trim().max(300), z.null()]).optional(),
  spotifyUrl: z.union([z.string().trim().max(300), z.null()]).optional(),
});

export const runtime = "nodejs";

const PUBLIC_ARCHIVE_ENABLED = process.env.ENABLE_PUBLIC_ARCHIVE_POSTS === "true";
const SPOTIFY_TRACK_ID_PATTERN = /^[A-Za-z0-9]{22}$/;

function resolvePublicArchiveUserEmail(request: NextRequest): string {
  const configured = (process.env.PUBLIC_ARCHIVE_ANON_EMAIL || "").trim().toLowerCase();
  if (configured) {
    return configured;
  }

  const baseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || request.nextUrl.origin;
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return `public-archive-anon@${host}`;
  } catch {
    return "public-archive-anon@blndwavejournal.xyz";
  }
}

function normalizeSpotifyTrackUrl(rawValue: string | null | undefined): string | null {
  const value = (rawValue || "").trim();
  if (!value) return null;

  if (value.startsWith("spotify:track:")) {
    const trackId = value.slice("spotify:track:".length).trim();
    if (SPOTIFY_TRACK_ID_PATTERN.test(trackId)) {
      return `https://open.spotify.com/track/${trackId}`;
    }
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return null;
    if (parsed.hostname.toLowerCase() !== "open.spotify.com") return null;

    const path = parsed.pathname.replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);
    if (parts.length !== 2 || parts[0] !== "track") return null;
    if (!SPOTIFY_TRACK_ID_PATTERN.test(parts[1])) return null;

    return `https://open.spotify.com/track/${parts[1]}`;
  } catch {
    return null;
  }
}

function addRateLimitHeaders(resetAt: Date) {
  return {
    "Retry-After": String(Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))),
  };
}

async function getPublicArchiveUserId(request: NextRequest): Promise<string> {
  const email = resolvePublicArchiveUserEmail(request);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      emailVerified: new Date(),
    },
    select: { id: true },
  });
  return user.id;
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await prisma.entry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      content: true,
      promptTextSnapshot: true,
      isCollective: true,
      collectivePublishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createEntrySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid entry input." }, { status: 400 });
  }

  const publishPublic = parsed.data.publishPublic === true;
  const shareOnCollective = parsed.data.shareOnCollective === true;
  const ip = getClientIp(request);
  const prompt = await prisma.prompt.findUnique({
    where: { id: parsed.data.promptId },
    select: { id: true, text: true },
  });

  if (!prompt) {
    return NextResponse.json({ error: "Prompt not found." }, { status: 400 });
  }

  if (publishPublic) {
    if (!PUBLIC_ARCHIVE_ENABLED) {
      return NextResponse.json({ error: "Public archive posting is unavailable." }, { status: 403 });
    }

    const publicLimit = await consumeRateLimit({
      key: `entries:public:ip:${ip}`,
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });
    if (!publicLimit.ok) {
      return NextResponse.json(
        { error: "Too many public posts in a short window. Try again soon." },
        { status: 429, headers: addRateLimitHeaders(publicLimit.resetAt) },
      );
    }

    const spotifyInput =
      typeof parsed.data.spotifyTrack === "string"
        ? parsed.data.spotifyTrack
        : typeof parsed.data.spotifyUrl === "string"
          ? parsed.data.spotifyUrl
          : "";
    const spotifyTrackUrl = normalizeSpotifyTrackUrl(spotifyInput);
    if (spotifyInput.trim() && !spotifyTrackUrl) {
      return NextResponse.json(
        { error: "Invalid spotify track. Use open.spotify.com/track/... or spotify:track:..." },
        { status: 400 },
      );
    }

    const publicUserId = await getPublicArchiveUserId(request);
    const storedContent = spotifyTrackUrl
      ? `${parsed.data.content}\n\n[song] ${spotifyTrackUrl}`
      : parsed.data.content;
    if (storedContent.length > 8000) {
      return NextResponse.json(
        { error: "Entry is too long with spotify metadata included." },
        { status: 400 },
      );
    }

    const entry = await prisma.entry.create({
      data: {
        userId: publicUserId,
        type: "PROMPT",
        promptId: prompt.id,
        promptTextSnapshot: prompt.text,
        content: storedContent,
      },
      select: {
        id: true,
        type: true,
        content: true,
        promptTextSnapshot: true,
        isCollective: true,
        collectivePublishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        entry,
        visibility: "public",
        anonymous: true,
        spotifyTrackUrl,
      },
      { status: 201 },
    );
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipLimit = await consumeRateLimit({
    key: `entries:private:ip:${ip}`,
    limit: 40,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Slow down and try again." },
      { status: 429, headers: addRateLimitHeaders(ipLimit.resetAt) },
    );
  }

  const userLimit = await consumeRateLimit({
    key: `entries:private:user:${userId}`,
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!userLimit.ok) {
    return NextResponse.json(
      { error: "Too many saves in a short window. Try again soon." },
      { status: 429, headers: addRateLimitHeaders(userLimit.resetAt) },
    );
  }

  const entry = await prisma.entry.create({
    data: {
      userId,
      type: "PROMPT",
      promptId: prompt.id,
      promptTextSnapshot: prompt.text,
      content: parsed.data.content,
      isCollective: shareOnCollective,
      collectivePublishedAt: shareOnCollective ? new Date() : null,
    },
    select: {
      id: true,
      type: true,
      content: true,
      promptTextSnapshot: true,
      isCollective: true,
      collectivePublishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
