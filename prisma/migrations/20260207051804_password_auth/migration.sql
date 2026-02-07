-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_identifier_tokenHash_key" ON "EmailVerificationToken"("identifier", "tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_identifier_expires_idx" ON "EmailVerificationToken"("identifier", "expires");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_identifier_tokenHash_key" ON "PasswordResetToken"("identifier", "tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_identifier_expires_idx" ON "PasswordResetToken"("identifier", "expires");
