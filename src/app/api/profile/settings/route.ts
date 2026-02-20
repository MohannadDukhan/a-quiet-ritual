import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSameOrigin } from "@/lib/security";

const updateSettingsSchema = z.object({
  collectiveAnonymous: z.boolean(),
});

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "invalid origin." }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid settings payload." }, { status: 400 });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        collectiveAnonymous: parsed.data.collectiveAnonymous,
      },
      select: {
        collectiveAnonymous: true,
      },
    });

    return NextResponse.json({
      ok: true,
      settings: {
        collectiveAnonymous: updatedUser.collectiveAnonymous,
      },
    });
  } catch {
    return NextResponse.json({ error: "could not update settings." }, { status: 500 });
  }
}
