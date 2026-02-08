import { NextRequest } from "next/server";

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function resolveRequestHostOrigin(request: NextRequest): string {
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

function resolveConfiguredOrigin(): string | null {
  return normalizeOrigin(process.env.NEXTAUTH_URL) || normalizeOrigin(process.env.AUTH_URL);
}

export function isSameOrigin(request: NextRequest): boolean {
  const receivedRaw = request.headers.get("origin");
  const receivedOrigin = normalizeOrigin(receivedRaw);
  const hostOrigin = normalizeOrigin(resolveRequestHostOrigin(request));
  const expectedOrigin = resolveConfiguredOrigin() || hostOrigin;

  if (!receivedOrigin || !hostOrigin || !expectedOrigin) {
    console.warn(
      `[security][origin-block] origin=${receivedRaw ?? "missing"} host=${hostOrigin ?? "unknown"} expected=${expectedOrigin ?? "unknown"}`,
    );
    return false;
  }

  if (receivedOrigin === expectedOrigin) return true;
  if (receivedOrigin === hostOrigin) return true;

  console.warn(
    `[security][origin-block] origin=${receivedOrigin} host=${hostOrigin} expected=${expectedOrigin}`,
  );
  return false;
}
