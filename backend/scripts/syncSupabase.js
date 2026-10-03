// คัดลอกข้อมูลทั้งฐาน local -> Supabase ทันที 1 ครั้ง (ไม่ต้องรอให้มีการเขียนข้อมูล)
// รัน: npm run sync:supabase
// ใช้ตอนตั้งต้นครั้งแรก หรือเมื่อแก้ข้อมูลใน local ตรงๆ ผ่าน pgAdmin (ที่ระบบไม่รู้ตัว)
import { mirrorAll, isMirrorEnabled } from "../src/utils/supabaseMirror.js";

if (!process.env.SUPABASE_DATABASE_URL) {
  console.error("ยังไม่ได้ตั้ง SUPABASE_DATABASE_URL ใน backend/.env");
  process.exit(1);
}
if (!isMirrorEnabled()) {
  console.error("ไม่คัดลอก: SUPABASE_DATABASE_URL ซ้ำกับ DATABASE_URL หรือต้นทางเป็น schema ชั่วคราว");
  process.exit(1);
}

const startedAt = Date.now();
try {
  const counts = await mirrorAll();
  console.table(counts);
  console.log(`คัดลอกขึ้น Supabase สำเร็จ (${Date.now() - startedAt} ms)`);
  process.exit(0);
} catch (err) {
  console.error("คัดลอกไม่สำเร็จ:", err.message);
  process.exit(1);
}
