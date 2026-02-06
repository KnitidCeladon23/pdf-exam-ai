-- AlterTable: Add new columns as optional first
ALTER TABLE "Answer" ADD COLUMN "textFromPdf" TEXT;
ALTER TABLE "Answer" ADD COLUMN "textFromAi" TEXT;

-- Data Migration: Copy existing 'text' data to both new columns
-- textFromPdf gets the original text (from PDF)
-- textFromAi gets the original text (for backward compatibility)
UPDATE "Answer" SET "textFromPdf" = "text", "textFromAi" = "text";

-- AlterTable: Make textFromAi required (NOT NULL)
ALTER TABLE "Answer" ALTER COLUMN "textFromAi" SET NOT NULL;

-- AlterTable: Drop the old 'text' column
ALTER TABLE "Answer" DROP COLUMN "text";
