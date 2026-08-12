-- CreateIndex
CREATE UNIQUE INDEX "submission_rounds_academic_year_attempt_number_key" ON "submission_rounds"("academic_year", "attempt_number");
