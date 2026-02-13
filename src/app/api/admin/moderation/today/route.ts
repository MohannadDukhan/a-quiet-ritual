import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiRequest } from "@/lib/admin-api";
import { getAdminModerationTodayData } from "@/lib/admin-moderation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = await requireAdminApiRequest({
    request,
    action: "moderation-today",
    limit: 120,
  });
  if (!guard.ok) {
    return guard.response;
  }

  const data = await getAdminModerationTodayData();
  return NextResponse.json(data);
}
