ALTER TABLE "User"
ADD COLUMN "username" TEXT,
ADD COLUMN "usernameUpdatedAt" TIMESTAMP(3),
ADD COLUMN "image" TEXT,
ADD COLUMN "displayName" TEXT;

ALTER TABLE "User"
ADD CONSTRAINT "User_username_lowercase_check" CHECK ("username" IS NULL OR "username" = lower("username")),
ADD CONSTRAINT "User_username_format_check" CHECK ("username" IS NULL OR "username" ~ '^[a-z0-9][a-z0-9_]{2,19}$');

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
