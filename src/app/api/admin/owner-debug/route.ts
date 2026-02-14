import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiRequest } from "@/lib/admin-api";
import { getOwnerConfigurationState, isOwnerEmail, normalizeEmail } from "@/lib/admin-role";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = await requireAdminApiRequest({
    request,
    action: "owner-debug",
    limit: 60,
  });
  if (!guard.ok) {
    return guard.response;
  }

  const { ownerConfigured, ownerLen } = getOwnerConfigurationState();
  const sessionEmailLen = normalizeEmail(guard.adminUserEmail).length;
  const matches = isOwnerEmail(guard.adminUserEmail);

  return NextResponse.json({
    ownerConfigured,
    ownerLen,
    sessionEmailLen,
    matches,
  });
}
