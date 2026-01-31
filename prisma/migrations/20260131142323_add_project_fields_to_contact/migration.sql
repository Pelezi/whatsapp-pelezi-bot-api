-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "available_project_ids" TEXT,
ADD COLUMN     "pending_project_selection" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "project_id" INTEGER;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
