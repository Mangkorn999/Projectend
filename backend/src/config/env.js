// ตรวจว่า .env มีตัวแปรสำคัญครบก่อน server เริ่ม
// ถ้าขาดตัวไหน จะ throw error ทันที ไม่ให้ server เริ่มโดยไม่มี config ครบ
//
// ทำไมต้องเช็คตรงนี้:
//   ถ้าปล่อยผ่าน server จะเริ่มได้ปกติ แล้วไปพังตอนมีคนใช้งานจริง
//   (เช่น CORS_ORIGIN ไม่มี → ทุก request จาก frontend โดน block หมด แต่ log ไม่บอกสาเหตุ)
//   เช็คตั้งแต่ตอนเริ่มแล้วบอกชื่อตัวแปรที่ขาดเลย หาสาเหตุง่ายกว่ามาก

const REQUIRED_VARS = [
  "DATABASE_URL", // ที่อยู่ฐานข้อมูล PostgreSQL
  "JWT_SECRET", // กุญแจเซ็น token — ห้ามหลุด ห้าม commit
  "CORS_ORIGIN", // URL ของ frontend ที่อนุญาตให้ยิงเข้ามา
  "COOKIE_SECURE", // "true" ตอนขึ้น HTTPS / "false" ตอน dev บน http
];

export function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        `ดูตัวอย่างค่าที่ต้องใส่ได้ที่ backend/.env.example`,
    );
  }

  // COOKIE_SECURE รับได้แค่ "true" หรือ "false" เท่านั้น
  // พิมพ์ผิดเป็น "True"/"1" แล้วปล่อยผ่าน จะกลายเป็น false เงียบๆ โดยไม่มีใครรู้
  if (!["true", "false"].includes(process.env.COOKIE_SECURE)) {
    throw new Error(
      `COOKIE_SECURE ต้องเป็น "true" หรือ "false" เท่านั้น (ตอนนี้คือ "${process.env.COOKIE_SECURE}")`,
    );
  }

  console.log("Environment variables validated");
}
