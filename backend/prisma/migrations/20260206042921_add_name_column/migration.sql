/*
  Warnings:

  - Added the required column `name` to the `Exam` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: Add column as nullable first
ALTER TABLE "Exam" ADD COLUMN "name" TEXT;

-- Update existing rows to use subject as name
UPDATE "Exam" SET "name" = "subject" WHERE "name" IS NULL;

-- Make column NOT NULL
ALTER TABLE "Exam" ALTER COLUMN "name" SET NOT NULL;

-- Set default for future inserts
ALTER TABLE "Exam" ALTER COLUMN "name" SET DEFAULT '';
