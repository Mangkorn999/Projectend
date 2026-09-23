-- ปีการศึกษาที่จบที่เจ้าหน้าที่ระบุตอนนำเข้ารายชื่อ (เคสซ้ำชั้น/ลาพัก)
-- ว่างได้: ว่าง = คำนวณจากรหัสนักศึกษาเหมือนเดิม — แถวเดิมทั้งหมดจึงไม่ต้อง backfill
-- AlterTable
ALTER TABLE "users" ADD COLUMN "import_academic_year" INTEGER;
