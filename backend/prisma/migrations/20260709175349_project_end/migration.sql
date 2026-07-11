-- CreateTable
CREATE TABLE "roles" (
    "role_id" SERIAL NOT NULL,
    "role_name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "psu_passport_id" VARCHAR(100) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "faculties" (
    "faculty_id" SERIAL NOT NULL,
    "faculty_name" VARCHAR(150) NOT NULL,

    CONSTRAINT "faculties_pkey" PRIMARY KEY ("faculty_id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "room_id" SERIAL NOT NULL,
    "room_name" VARCHAR(20) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("room_id")
);

-- CreateTable
CREATE TABLE "students" (
    "student_id" VARCHAR(20) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "faculty_id" INTEGER NOT NULL,
    "academic_year" INTEGER NOT NULL,
    "room_id" INTEGER NOT NULL,
    "nursing_council_email" VARCHAR(100) NOT NULL,
    "nursing_council_password" VARCHAR(255) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("student_id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "subject_id" SERIAL NOT NULL,
    "subject_code" VARCHAR(10) NOT NULL,
    "subject_name" VARCHAR(200) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("subject_id")
);

-- CreateTable
CREATE TABLE "submission_rounds" (
    "round_id" SERIAL NOT NULL,
    "created_by" INTEGER NOT NULL,
    "academic_year" INTEGER NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "open_date" TIMESTAMP(3) NOT NULL,
    "close_date" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(10) NOT NULL,

    CONSTRAINT "submission_rounds_pkey" PRIMARY KEY ("round_id")
);

-- CreateTable
CREATE TABLE "exam_results" (
    "result_id" SERIAL NOT NULL,
    "student_id" VARCHAR(20) NOT NULL,
    "round_id" INTEGER NOT NULL,
    "confirmed_by" INTEGER,
    "student_status" VARCHAR(15) NOT NULL,
    "staff_status" VARCHAR(20) NOT NULL,
    "remark" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "exam_results_pkey" PRIMARY KEY ("result_id")
);

-- CreateTable
CREATE TABLE "subject_results" (
    "subject_result_id" SERIAL NOT NULL,
    "result_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "is_passed" BOOLEAN NOT NULL,

    CONSTRAINT "subject_results_pkey" PRIMARY KEY ("subject_result_id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "certificate_id" SERIAL NOT NULL,
    "result_id" INTEGER NOT NULL,
    "certificate_type" VARCHAR(20) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "file_type" VARCHAR(10) NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("certificate_id")
);

-- CreateTable
CREATE TABLE "news" (
    "news_id" SERIAL NOT NULL,
    "posted_by" INTEGER NOT NULL,
    "round_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("news_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "students_user_id_key" ON "students"("user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("faculty_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_rounds" ADD CONSTRAINT "submission_rounds_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "submission_rounds"("round_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_results" ADD CONSTRAINT "subject_results_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "exam_results"("result_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_results" ADD CONSTRAINT "subject_results_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "exam_results"("result_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "submission_rounds"("round_id") ON DELETE RESTRICT ON UPDATE CASCADE;
