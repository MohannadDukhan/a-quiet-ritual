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

function resolveOrigins(request: NextRequest): {
  hostOrigin: string | null;
  expectedOrigin: string | null;
} {
  const hostOrigin = normalizeOrigin(resolveRequestHostOrigin(request));
  const expectedOrigin = resolveConfiguredOrigin() || hostOrigin;
  return { hostOrigin, expectedOrigin };
}

function matchesExpectedOrHost(
  candidateOrigin: string | null,
  hostOrigin: string | null,
  expectedOrigin: string | null,
): boolean {
  if (!candidateOrigin || !hostOrigin || !expectedOrigin) {
    return false;
  }
  return candidateOrigin === expectedOrigin || candidateOrigin === hostOrigin;
}

export function isSameOrigin(request: NextRequest): boolean {
  const receivedRaw = request.headers.get("origin");
  const receivedOrigin = normalizeOrigin(receivedRaw);
  const { hostOrigin, expectedOrigin } = resolveOrigins(request);

  if (!receivedOrigin || !hostOrigin || !expectedOrigin) {
    console.warn(
      `[security][origin-block] origin=${receivedRaw ?? "missing"} host=${hostOrigin ?? "unknown"} expected=${expectedOrigin ?? "unknown"}`,
    );
    return false;
  }

  if (matchesExpectedOrHost(receivedOrigin, hostOrigin, expectedOrigin)) return true;

  console.warn(
    `[security][origin-block] origin=${receivedOrigin} host=${hostOrigin} expected=${expectedOrigin}`,
  );
  return false;
}

export function isSameOriginReadRequest(request: NextRequest): boolean {
  const { hostOrigin, expectedOrigin } = resolveOrigins(request);
  if (!hostOrigin || !expectedOrigin) {
    console.warn(
      `[security][origin-read-block] host=${hostOrigin ?? "unknown"} expected=${expectedOrigin ?? "unknown"}`,
    );
    return false;
  }

  const originRaw = request.headers.get("origin");
  const origin = normalizeOrigin(originRaw);
  if (origin) {
    if (matchesExpectedOrHost(origin, hostOrigin, expectedOrigin)) {
      return true;
    }
    console.warn(
      `[security][origin-read-block] origin=${origin} host=${hostOrigin} expected=${expectedOrigin}`,
    );
    return false;
  }

  const refererRaw = request.headers.get("referer");
  const refererOrigin = normalizeOrigin(refererRaw);
  if (refererOrigin && matchesExpectedOrHost(refererOrigin, hostOrigin, expectedOrigin)) {
    return true;
  }

  const secFetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if ((secFetchSite === "same-origin" || secFetchSite === "same-site") && hostOrigin === expectedOrigin) {
    return true;
  }

  console.warn(
    `[security][origin-read-block] origin=missing referer=${refererRaw ?? "missing"} host=${hostOrigin} expected=${expectedOrigin} sec-fetch-site=${secFetchSite ?? "missing"}`,
  );
  return false;
}
