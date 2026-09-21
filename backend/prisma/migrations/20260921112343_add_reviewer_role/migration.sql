/*
  Warnings:

  - Added the required column `first_name_en` to the `students` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_name_en` to the `students` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "students" ADD COLUMN     "first_name_en" VARCHAR(100) NOT NULL DEFAULT '',
ADD COLUMN     "last_name_en" VARCHAR(100) NOT NULL DEFAULT '';

-- backfill done via default above; drop default so future inserts must supply a value explicitly
ALTER TABLE "students" ALTER COLUMN "first_name_en" DROP DEFAULT,
ALTER COLUMN "last_name_en" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "first_name" DROP NOT NULL,
ALTER COLUMN "last_name" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "phone" DROP NOT NULL;

-- CreateTable
CREATE TABLE "review_logs" (
    "log_id" SERIAL NOT NULL,
    "result_id" INTEGER NOT NULL,
    "reviewer_id" INTEGER NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_logs_pkey" PRIMARY KEY ("log_id")
);

-- AddForeignKey
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "exam_results"("result_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
