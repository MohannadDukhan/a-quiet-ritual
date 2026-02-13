"use client";

import { useEffect } from "react";

import { TIME_ZONE_COOKIE_NAME, isValidTimeZone } from "@/lib/time";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  const cookiePrefix = `${name}=`;
  const match = document.cookie
    .split("; ")
    .find((cookieItem) => cookieItem.startsWith(cookiePrefix));
  if (!match) {
    return null;
  }
  try {
    return decodeURIComponent(match.slice(cookiePrefix.length));
  } catch {
    return null;
  }
}

export function TimeZoneCookieSync() {
  useEffect(() => {
    try {
      const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!isValidTimeZone(browserTimeZone)) {
        return;
      }

      const currentCookieValue = readCookie(TIME_ZONE_COOKIE_NAME);
      if (currentCookieValue === browserTimeZone) {
        return;
      }

      document.cookie = [
        `${TIME_ZONE_COOKIE_NAME}=${encodeURIComponent(browserTimeZone)}`,
        "Path=/",
        "SameSite=Lax",
        `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
      ].join("; ");
    } catch {
      // Ignore timezone detection failures and keep server fallback behavior.
    }
  }, []);

  return null;
}
