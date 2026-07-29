-- AlterTable
ALTER TABLE "users" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "password_hash" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "users_psu_passport_id_key" ON "users"("psu_passport_id");

