import { NextRequest, NextResponse } from "next/server";

function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    return parsed.origin.replace(/\/+$/, "").toLowerCase();
  } catch {
    return null;
  }
}

function resolveAllowedOrigin(request: NextRequest): string {
  const configured =
    normalizeOrigin(process.env.AUTH_URL || "") ||
    normalizeOrigin(process.env.NEXTAUTH_URL || "");

  if (configured) return configured;
  return new URL(request.url).origin.replace(/\/+$/, "").toLowerCase();
}

export function assertSameOrigin(request: NextRequest): NextResponse | null {
  const receivedRaw = request.headers.get("origin");
  if (!receivedRaw) {
    return null;
  }

  const allowedOrigin = resolveAllowedOrigin(request);
  const receivedOrigin = normalizeOrigin(receivedRaw);

  if (!receivedOrigin || receivedOrigin !== allowedOrigin) {
    return NextResponse.json(
      {
        error: "Invalid origin",
        allowedOrigin,
        receivedOrigin: receivedOrigin ?? receivedRaw,
      },
      { status: 403 },
    );
  }

  return null;
}
