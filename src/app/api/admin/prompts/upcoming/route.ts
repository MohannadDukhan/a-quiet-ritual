import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiRequest } from "@/lib/admin-api";
import { getUpcomingResolvedPromptDays } from "@/lib/prompt-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = await requireAdminApiRequest({
    request,
    action: "prompts-upcoming",
    limit: 120,
  });
  if (!guard.ok) {
    return guard.response;
  }

  const days = await getUpcomingResolvedPromptDays();
  return NextResponse.json({ days });
}
