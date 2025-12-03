-- Make password nullable
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

-- Add googleId column (nullable)
ALTER TABLE "User" ADD COLUMN "googleId" TEXT;

-- Enforce uniqueness only when googleId is set (ignore NULLs)
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId") WHERE "googleId" IS NOT NULL;
