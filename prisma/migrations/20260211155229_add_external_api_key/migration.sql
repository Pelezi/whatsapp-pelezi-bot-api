/*
  Warnings:

  - A unique constraint covering the columns `[external_api_key]` on the table `project` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "project" ADD COLUMN     "external_api_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "project_external_api_key_key" ON "project"("external_api_key");
