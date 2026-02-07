import { PrismaClient } from "@prisma/client";

import { PROMPT_TEXTS } from "../src/lib/prompts";

const prisma = new PrismaClient();

async function main() {
  await prisma.prompt.createMany({
    data: PROMPT_TEXTS.map((text) => ({ text })),
    skipDuplicates: true,
  });
}

main()
  .catch((error) => {
    process.stderr.write(`Prisma seed failed: ${String(error)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
