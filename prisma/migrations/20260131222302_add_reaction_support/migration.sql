-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'REACTION';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "reaction_emoji" TEXT;
