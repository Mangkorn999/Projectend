-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "round_id" INTEGER;

-- CreateIndex
CREATE INDEX "notifications_student_id_round_id_type_idx" ON "notifications"("student_id", "round_id", "type");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "submission_rounds"("round_id") ON DELETE SET NULL ON UPDATE CASCADE;
