-- CreateIndex
CREATE INDEX "certificates_result_id_idx" ON "certificates"("result_id");

-- CreateIndex
CREATE INDEX "exam_results_round_id_idx" ON "exam_results"("round_id");

-- CreateIndex
CREATE INDEX "exam_results_staff_status_idx" ON "exam_results"("staff_status");

-- CreateIndex
CREATE UNIQUE INDEX "exam_results_student_id_round_id_key" ON "exam_results"("student_id", "round_id");

-- CreateIndex
CREATE INDEX "news_round_id_idx" ON "news"("round_id");

-- CreateIndex
CREATE INDEX "notifications_student_id_idx" ON "notifications"("student_id");

-- CreateIndex
CREATE INDEX "review_logs_result_id_idx" ON "review_logs"("result_id");

-- CreateIndex
CREATE INDEX "students_academic_year_idx" ON "students"("academic_year");

-- CreateIndex
CREATE INDEX "subject_results_result_id_idx" ON "subject_results"("result_id");

-- CreateIndex
CREATE INDEX "subject_results_subject_id_idx" ON "subject_results"("subject_id");

