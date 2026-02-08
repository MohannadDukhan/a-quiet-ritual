import { NextRequest, NextResponse } from "next/server";

function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin.replace(/\/+$/, "").toLowerCase();
  } catch {
    return null;
  }
}

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function resolveHostOrigin(request: NextRequest): string {
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"))?.toLowerCase();
  const fallbackProto = request.nextUrl.protocol.replace(":", "").toLowerCase();
  const proto =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : fallbackProto === "http" || fallbackProto === "https"
        ? fallbackProto
        : "https";

  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const hostHeader = firstHeaderValue(request.headers.get("host"));
  const host = (forwardedHost || hostHeader || request.nextUrl.host).toLowerCase();
  return `${proto}://${host}`;
}

function resolveAllowedOrigin(request: NextRequest): string {
  const configured =
    normalizeOrigin(process.env.NEXTAUTH_URL || "") ||
    normalizeOrigin(process.env.AUTH_URL || "");

  if (configured) return configured;
  return resolveHostOrigin(request);
}

export function assertSameOrigin(request: NextRequest): NextResponse | null {
  const receivedRaw = request.headers.get("origin");
  const hostOrigin = normalizeOrigin(resolveHostOrigin(request));
  const allowedOrigin = resolveAllowedOrigin(request);
  const receivedOrigin = normalizeOrigin(receivedRaw || "");

  if (!receivedOrigin || !hostOrigin) {
    console.warn(
      `[security][origin-block] origin=${receivedRaw ?? "missing"} host=${hostOrigin ?? "unknown"} expected=${allowedOrigin}`,
    );
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  if (receivedOrigin !== allowedOrigin && receivedOrigin !== hostOrigin) {
    console.warn(
      `[security][origin-block] origin=${receivedOrigin} host=${hostOrigin} expected=${allowedOrigin}`,
    );
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  return null;
}
