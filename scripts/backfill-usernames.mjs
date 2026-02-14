import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

function resolveUniqueUsername(base, taken) {
  const normalizedBase = normalizeUsername(base);
  if (!taken.has(normalizedBase)) {
    return normalizedBase;
  }

  const firstFallback = `${normalizedBase}a`;
  if (!taken.has(firstFallback)) {
    return firstFallback;
  }

  let suffix = 2;
  while (true) {
    const candidate = `${normalizedBase}_${suffix}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
    suffix += 1;
  }
}

async function main() {
  const users = await prisma.user.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  });

  const taken = new Set(
    users
      .map((user) => user.username)
      .filter((username) => Boolean(username))
      .map(normalizeUsername),
  );

  const usersMissingUsername = users.filter((user) => !user.username);
  if (usersMissingUsername.length === 0) {
    console.log("[backfill-usernames] no users need backfill.");
    return;
  }

  let assigned = 0;
  for (let index = 0; index < usersMissingUsername.length; index += 1) {
    const user = usersMissingUsername[index];
    const base = `anonymous${index + 1}`;
    const username = resolveUniqueUsername(base, taken);
    taken.add(username);

    const updated = await prisma.user.updateMany({
      where: {
        id: user.id,
        username: null,
      },
      data: {
        username,
        displayName: user.displayName || username,
      },
    });

    if (updated.count === 1) {
      assigned += 1;
    }
  }

  console.log(
    `[backfill-usernames] assigned ${assigned} usernames out of ${usersMissingUsername.length} users missing username.`,
  );
}

main()
  .catch((error) => {
    console.error("[backfill-usernames] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
