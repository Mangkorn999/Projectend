// สร้าง/อัปเดตตารางบน Supabase ให้ตรงกับ migration ของโปรเจกต์ (prisma migrate deploy ชี้ไป Supabase)
// แล้วล็อกตารางไม่ให้เรียกผ่าน Supabase REST API ได้
// รัน: npm run supabase:migrate   (ต้องตั้ง SUPABASE_DATABASE_URL ใน backend/.env ก่อน)
// ⚠️ ใช้ connection string แบบ direct หรือ Session pooler (พอร์ต 5432) — แบบ Transaction pooler (6543) ใช้ migrate ไม่ได้
import { spawnSync } from "child_process";
import { PrismaClient } from "@prisma/client";

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
if (result.status !== 0) process.exit(result.status ?? 1);

// ── ล็อกตาราง ──
// Supabase เปิดตารางใน schema public ให้เรียกผ่าน REST API ด้วย publishable key (คีย์สาธารณะ) ได้เอง
// ถ้าไม่เปิด Row Level Security ใครมีคีย์นี้ก็อ่านข้อมูลนักศึกษาได้ทั้งหมด
// เปิด RLS โดยไม่ใส่ policy = anon/authenticated อ่านเขียนอะไรไม่ได้เลย
// ส่วน backend เข้าด้วย role เจ้าของตาราง (postgres) ซึ่งข้าม RLS ได้ จึงใช้งานปกติ
// รันซ้ำได้ทุกครั้งที่ migrate (ตารางใหม่ที่เพิ่มทีหลังจะถูกล็อกด้วย)
const db = new PrismaClient({ datasourceUrl: url });
try {
  const tables = await db.$queryRawUnsafe(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
  for (const { tablename } of tables) {
    await db.$executeRawUnsafe(`ALTER TABLE "public"."${tablename}" ENABLE ROW LEVEL SECURITY`);
  }
  // Prisma เรียก $executeRawUnsafe ได้ทีละคำสั่ง จึงแยกเป็น 2 ครั้ง
  await db.$executeRawUnsafe(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated`);
  await db.$executeRawUnsafe(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated`);
  console.log(`ล็อกตารางบน Supabase แล้ว ${tables.length} ตาราง (RLS เปิด + ถอนสิทธิ์ anon/authenticated)`);
} catch (err) {
  console.error("ล็อกตารางไม่สำเร็จ — อย่าเพิ่งใช้งานจนกว่าจะแก้:", err.message);
  process.exit(1);
} finally {
  await db.$disconnect();
}
