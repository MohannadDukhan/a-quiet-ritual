import { cookies } from "next/headers";

import { TIME_ZONE_COOKIE_NAME, resolveTimeZone } from "@/lib/time";

export async function getRequestTimeZone(): Promise<string> {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(TIME_ZONE_COOKIE_NAME)?.value;
  return resolveTimeZone(rawValue);
}
