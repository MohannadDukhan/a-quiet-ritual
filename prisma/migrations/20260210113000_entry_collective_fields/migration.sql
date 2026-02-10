-- AlterTable
ALTER TABLE "Entry"
ADD COLUMN "isCollective" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "collectivePublishedAt" TIMESTAMP(3);
