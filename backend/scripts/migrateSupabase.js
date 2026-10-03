// สร้าง/อัปเดตตารางบน Supabase ให้ตรงกับ migration ของโปรเจกต์ (prisma migrate deploy ชี้ไป Supabase)
// รัน: npm run supabase:migrate   (ต้องตั้ง SUPABASE_DATABASE_URL ใน backend/.env ก่อน)
// ⚠️ ใช้ connection string แบบ direct หรือ Session pooler (พอร์ต 5432) — แบบ Transaction pooler (6543) ใช้ migrate ไม่ได้
import { spawnSync } from "child_process";

const url = process.env.SUPABASE_DATABASE_URL;
if (!url) {
  console.error("ยังไม่ได้ตั้ง SUPABASE_DATABASE_URL ใน backend/.env");
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: url }, // ทับ DATABASE_URL เฉพาะ process ลูกนี้ — ไม่แตะไฟล์ .env
});
process.exit(result.status ?? 1);
