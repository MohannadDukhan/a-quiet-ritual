-- CreateTable
CREATE TABLE "CollectiveReply" (
    "id" TEXT NOT NULL,
    "entryId" UUID NOT NULL,
    "userId" UUID,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectiveReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectiveReply_entryId_createdAt_idx" ON "CollectiveReply"("entryId", "createdAt");

-- AddForeignKey
ALTER TABLE "CollectiveReply" ADD CONSTRAINT "CollectiveReply_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectiveReply" ADD CONSTRAINT "CollectiveReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
