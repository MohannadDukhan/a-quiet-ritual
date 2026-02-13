CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "User"
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER',
  ADD COLUMN "collectiveBanned" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "role" = 'ADMIN'
WHERE lower("email") = 'dukhanmohannad@gmail.com';