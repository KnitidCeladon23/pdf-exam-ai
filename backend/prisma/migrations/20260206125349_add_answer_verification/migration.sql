-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "aiSuggestedAnswer" TEXT,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificationNote" TEXT;
