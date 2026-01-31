/*
  Warnings:

  - You are about to drop the `_UserProjects` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[api_key]` on the table `project` will be added. If there are existing duplicate values, this will fail.
  - The required column `api_key` was added to the `project` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE "_UserProjects" DROP CONSTRAINT "_UserProjects_A_fkey";

-- DropForeignKey
ALTER TABLE "_UserProjects" DROP CONSTRAINT "_UserProjects_B_fkey";

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "api_key" TEXT NOT NULL;

-- DropTable
DROP TABLE "_UserProjects";

-- CreateTable
CREATE TABLE "member" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "owner" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_user_id_project_id_key" ON "member"("user_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_api_key_key" ON "project"("api_key");

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
