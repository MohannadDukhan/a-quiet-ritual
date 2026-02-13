CREATE TABLE "PromptSchedule" (
  "id" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "promptText" TEXT NOT NULL,
  "promptId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PromptSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromptSchedule_date_key" ON "PromptSchedule"("date");
CREATE INDEX "PromptSchedule_date_idx" ON "PromptSchedule"("date");

ALTER TABLE "PromptSchedule"
ADD CONSTRAINT "PromptSchedule_promptId_fkey"
FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE SET NULL ON UPDATE CASCADE;