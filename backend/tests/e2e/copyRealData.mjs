// คัดลอกข้อมูลจากฐานข้อมูลจริง (schema public) ไปไว้ใน schema ชั่วคราว เพื่อทดสอบด้วยข้อมูลหน้าตาจริง
//
// ปลอดภัยยังไงบ้าง:
//   - อ่านจาก public ด้วย SELECT เท่านั้น — ไม่มี INSERT/UPDATE/DELETE/DDL ใดๆ ลง public (โค้ดด้านล่างขึ้นต้นเขียนทุกคำสั่งที่แตะ public เป็น SELECT)
//   - โครงสร้างตารางของ schema ชั่วคราวสร้างจาก prisma migrate deploy (มี sequence ของตัวเอง ไม่ใช่ LIKE public — ไม่งั้น nextval จะไปขยับ sequence ของฐานข้อมูลจริง)
//   - ไฟล์ใน uploads/ ไม่ถูกคัดลอกและไม่ถูกแก้ (แถวใน certificates อ้างไฟล์เดิม — เทสเปิดอ่านได้เท่านั้น)
// เรียกจาก run-e2e.mjs เมื่อใส่ --copy-real
import { PrismaClient } from "@prisma/client";

// ลำดับตามความสัมพันธ์ (ตารางที่ถูกอ้างถึงมาก่อน) + คอลัมน์ id ที่เป็น autoincrement ไว้ตั้ง sequence ใหม่
const TABLES = [
  ["roles", "role_id"],
  ["faculties", "faculty_id"],
  ["rooms", "room_id"],
  ["users", "user_id"],
  ["students", null],
  ["subjects", "subject_id"],
  ["submission_rounds", "round_id"],
  ["exam_results", "result_id"],
  ["subject_results", "subject_result_id"],
  ["certificates", "certificate_id"],
  ["news", "news_id"],
  ["notifications", "notification_id"],
  ["review_logs", "log_id"],
];

export async function copyRealData(testSchema) {
  const prisma = new PrismaClient();
  try {
    for (const [table, idColumn] of TABLES) {
      // คอลัมน์ที่มีทั้งสองฝั่ง (เผื่อฐานจริงยังไม่ได้ migrate ล่าสุด) — อ่านจาก information_schema (SELECT)
      const rows = await prisma.$queryRawUnsafe(
        `SELECT a.column_name FROM information_schema.columns a
           JOIN information_schema.columns b ON b.column_name = a.column_name AND b.table_name = a.table_name AND b.table_schema = $2
          WHERE a.table_schema = 'public' AND a.table_name = $1 ORDER BY a.ordinal_position`,
        table, testSchema,
      );
      const columns = rows.map((r) => `"${r.column_name}"`).join(", ");
      if (columns === "") throw new Error(`ไม่พบตาราง ${table} ในทั้งสอง schema`);
      await prisma.$executeRawUnsafe(`INSERT INTO "${testSchema}"."${table}" (${columns}) SELECT ${columns} FROM "public"."${table}"`);
      if (idColumn) {
        await prisma.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"${testSchema}"."${table}"', '${idColumn}'), COALESCE((SELECT MAX("${idColumn}") FROM "${testSchema}"."${table}"), 1))`,
        );
      }
    }
    const counts = {};
    for (const [table] of TABLES) {
      counts[table] = Number((await prisma.$queryRawUnsafe(`SELECT count(*)::int c FROM "${testSchema}"."${table}"`))[0].c);
    }
    console.log("      คัดลอกจากฐานข้อมูลจริงแล้ว:", JSON.stringify(counts));
  } finally {
    await prisma.$disconnect();
  }
}
