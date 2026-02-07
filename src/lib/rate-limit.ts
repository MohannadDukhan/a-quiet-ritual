import { prisma } from "@/lib/db";

type RateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: Date;
};

export async function consumeRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const now = Date.now();
  const cutoff = new Date(now - input.windowMs);
  const nowDate = new Date(now);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.rateLimitBucket.findUnique({
      where: { key: input.key },
      select: { count: true, windowStart: true },
    });

    if (!existing || existing.windowStart <= cutoff) {
      await tx.rateLimitBucket.upsert({
        where: { key: input.key },
        create: { key: input.key, count: 1, windowStart: nowDate },
        update: { count: 1, windowStart: nowDate },
      });

      return {
        ok: true,
        remaining: Math.max(0, input.limit - 1),
        resetAt: new Date(now + input.windowMs),
      };
    }

    const updated = await tx.rateLimitBucket.updateMany({
      where: {
        key: input.key,
        windowStart: { gt: cutoff },
        count: { lt: input.limit },
      },
      data: {
        count: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      return {
        ok: false,
        remaining: 0,
        resetAt: new Date(existing.windowStart.getTime() + input.windowMs),
      };
    }

    return {
      ok: true,
      remaining: Math.max(0, input.limit - (existing.count + 1)),
      resetAt: new Date(existing.windowStart.getTime() + input.windowMs),
    };
  });
}
