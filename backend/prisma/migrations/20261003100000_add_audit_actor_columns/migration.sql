-- AlterTable
ALTER TABLE "news" ADD COLUMN     "updated_by" INTEGER;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "eligible_set_at" TIMESTAMP(3),
ADD COLUMN     "eligible_set_by" INTEGER;

-- AlterTable
ALTER TABLE "submission_rounds" ADD COLUMN     "updated_at" TIMESTAMP(3),
ADD COLUMN     "updated_by" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "closed_by" INTEGER,
ADD COLUMN     "created_by" INTEGER;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_eligible_set_by_fkey" FOREIGN KEY ("eligible_set_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_rounds" ADD CONSTRAINT "submission_rounds_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

