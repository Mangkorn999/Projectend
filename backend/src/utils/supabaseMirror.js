// กระจกสะท้อน local -> Supabase
//
// หลักการ: backend เขียนลงฐาน local (DATABASE_URL) เป็นฐานหลักตามปกติ
// แล้วหลังมีการเพิ่ม/แก้/ลบข้อมูล ไม่กี่วินาที (รอให้เงียบก่อน = debounce) จะคัดลอกทุกตารางขึ้น Supabase
// ให้ได้ข้อมูลเหมือน local ทุกอย่าง — ไม่ต้องตั้งเวลา ไม่ต้องกดอะไร
//
// เปิดใช้: ใส่ SUPABASE_DATABASE_URL ใน .env (ไม่ใส่ = ปิด ระบบทำงานเหมือนเดิมทุกอย่าง)
//
// ข้อควรรู้
//   - ทางเดียว local -> Supabase: ฐานปลายทางถูก "ล้างแล้วเขียนใหม่" ทุกครั้ง ห้ามเอาข้อมูลอื่นไปใส่ในฐานนั้น
//     และห้ามแก้ข้อมูลที่ Supabase โดยตรง (จะถูกทับรอบถัดไป)
//   - ไม่ได้คัดลอกไฟล์ PDF/รูปใน uploads/ — มีแค่ path ของไฟล์ในฐานข้อมูล
//   - ความผิดพลาดของ Supabase (เน็ตหลุด ฯลฯ) แค่ log ไว้แล้วลองใหม่ ไม่กระทบการใช้งานจริงของระบบเลย
//   - ฐานปลายทางต้อง migrate ให้ตรงกับ local ก่อน (npm run supabase:migrate) ไม่งั้นไม่ยอมคัดลอก
import { PrismaClient } from "@prisma/client";
import prisma from "../config/db.js";

// ลำดับ "แม่ก่อนลูก" — ใส่ตารางที่ถูกอ้างถึงก่อนตารางที่อ้างถึง ไม่งั้น foreign key ฟ้อง
const TABLES = [
  "roles",
  "faculties",
  "rooms",
  "users",
  "students",
  "subjects",
  "submission_rounds",
  "exam_results",
  "review_logs",
  "subject_results",
  "certificates",
  "news",
  "notifications",
];

const DEBOUNCE_MS = 5000; // รอให้ไม่มีการเขียนใหม่ 5 วินาทีค่อยคัดลอก (กดหลายอย่างติดกัน = คัดลอกรอบเดียว)
const RETRY_MS = 60000; // คัดลอกไม่สำเร็จ ลองใหม่ใน 1 นาที

let targetClient = null;
const getTarget = () => {
  // datasourceUrl = ให้ Prisma ตัวนี้คุยกับฐานอื่นแทน DATABASE_URL
  targetClient ??= new PrismaClient({ datasourceUrl: process.env.SUPABASE_DATABASE_URL });
  return targetClient;
};

// เปิดใช้เมื่อ: มี SUPABASE_DATABASE_URL, ไม่ใช่ฐานเดียวกับต้นทาง, และต้นทางไม่ใช่ schema ชั่วคราวของเทส
// (เทสรัน server ชั่วคราวบน schema verify_* — ถ้าปล่อยให้ mirror ข้อมูลเทสจะไปทับข้อมูลจริงบน Supabase)
export const isMirrorEnabled = () => {
  const dst = process.env.SUPABASE_DATABASE_URL;
  const src = process.env.DATABASE_URL || "";
  if (!dst || dst === src) return false;
  const schema = src.match(/[?&]schema=([^&]+)/);
  if (schema && schema[1] !== "public") return false;
  return true;
};

const quote = (name) => `"${name}"`;

// เช็คว่าสองฐาน migrate ถึงชุดเดียวกัน — ไม่ตรง = คอลัมน์ไม่เท่ากัน คัดลอกไปจะข้อมูลหายเงียบๆ
const assertSameMigrations = async (dst) => {
  const sql = `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name`;
  const [a, b] = await Promise.all([prisma.$queryRawUnsafe(sql), dst.$queryRawUnsafe(sql)]);
  const names = (rows) => rows.map((r) => r.migration_name).join(",");
  if (names(a) !== names(b)) {
    throw new Error("ฐาน Supabase ยังไม่ได้ migrate ให้ตรงกับ local — รัน npm run supabase:migrate ก่อน");
  }
};

// คัดลอกทุกตารางจาก local ไป Supabase (ล้างปลายทางแล้วเขียนใหม่ใน transaction เดียว — ล้มเหลวกลางทางก็ไม่เหลือข้อมูลครึ่งๆ)
export const mirrorAll = async () => {
  const dst = getTarget();
  await assertSameMigrations(dst);

  // อ่านทุกตารางจาก local ใน transaction เดียว = ได้ภาพนิ่งเดียวกัน ไม่ใช่ตารางหนึ่งใหม่กว่าอีกตารางหนึ่ง
  // แต่ละตารางแปลงเป็นข้อความ JSON ก้อนเดียว แล้วให้ Postgres ฝั่งปลายทางแตกกลับเป็นแถวเอง (jsonb_populate_recordset)
  // วิธีนี้ไม่ต้องเขียนจับคู่ชนิดข้อมูลทีละคอลัมน์ (วันที่ / array / boolean ถูกแปลงให้ตรงชนิดคอลัมน์เอง)
  const snapshot = await prisma.$transaction(
    async (tx) => {
      const out = {};
      for (const table of TABLES) {
        out[table] = JSON.stringify(await tx.$queryRawUnsafe(`SELECT * FROM ${quote(table)}`));
      }
      return out;
    },
    { timeout: 60000, maxWait: 20000 },
  );

  await dst.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`TRUNCATE ${TABLES.map(quote).join(", ")} RESTART IDENTITY CASCADE`);

      for (const table of TABLES) {
        await tx.$executeRawUnsafe(
          `INSERT INTO ${quote(table)} SELECT * FROM jsonb_populate_recordset(NULL::${quote(table)}, $1::jsonb)`,
          snapshot[table],
        );
      }

      // ตัวนับ id อัตโนมัติ (sequence) ของปลายทางยังเป็น 1 เพราะเราใส่ id มาเอง — ตั้งให้ต่อจาก id สูงสุด
      // เผื่อวันหนึ่งใช้ Supabase เป็นฐานหลักแล้วเพิ่มข้อมูลใหม่ จะได้ไม่ซ้ำ id เดิม
      for (const table of TABLES) {
        const serialCols = await tx.$queryRawUnsafe(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = current_schema() AND table_name = '${table}' AND column_default LIKE 'nextval%'`,
        );
        for (const { column_name } of serialCols) {
          await tx.$executeRawUnsafe(
            `SELECT setval(pg_get_serial_sequence('${quote(table)}', '${column_name}'),
                           COALESCE((SELECT MAX(${quote(column_name)}) FROM ${quote(table)}), 1),
                           (SELECT MAX(${quote(column_name)}) FROM ${quote(table)}) IS NOT NULL)`,
          );
        }
      }
    },
    { timeout: 120000, maxWait: 20000 },
  );

  return Object.fromEntries(TABLES.map((t) => [t, JSON.parse(snapshot[t]).length]));
};

// ── ตั้งเวลาคัดลอกอัตโนมัติ ──────────────────────────────────
let timer = null;
let running = false;
let dirty = false; // true = มีการเขียนใหม่ระหว่างที่กำลังคัดลอกอยู่ (หรือรอบที่แล้วล้มเหลว) ต้องคัดลอกอีกรอบหลังจบ

const runMirror = async () => {
  if (running) return; // รอบก่อนยังไม่จบ — ตอนจบจะเช็ค dirty แล้วนัดรอบใหม่เอง
  running = true;
  dirty = false;
  let nextDelay = DEBOUNCE_MS;
  const startedAt = Date.now();
  try {
    await mirrorAll();
    console.log(`[mirror] คัดลอกขึ้น Supabase สำเร็จ (${Date.now() - startedAt} ms)`);
  } catch (err) {
    console.error("[mirror] คัดลอกขึ้น Supabase ไม่สำเร็จ จะลองใหม่ใน 1 นาที:", err.message);
    dirty = true;
    nextDelay = RETRY_MS;
  } finally {
    running = false;
    if (dirty) scheduleMirror(nextDelay);
  }
};

// เรียกทุกครั้งที่มีการเขียนข้อมูลสำเร็จ — ปิดอยู่ (ไม่มี SUPABASE_DATABASE_URL) ก็ไม่ทำอะไรเลย
export const scheduleMirror = (delayMs = DEBOUNCE_MS) => {
  if (!isMirrorEnabled()) return;
  dirty = true;
  clearTimeout(timer);
  timer = setTimeout(runMirror, delayMs);
  timer.unref?.(); // ไม่ให้ timer นี้รั้ง process ไม่ยอมปิด
};
