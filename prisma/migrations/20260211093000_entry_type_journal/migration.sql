-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('PROMPT', 'JOURNAL');

-- AlterTable
ALTER TABLE "Entry"
ADD COLUMN "type" "EntryType" NOT NULL DEFAULT 'PROMPT',
ALTER COLUMN "promptId" DROP NOT NULL;
