// ตัวช่วยเทส: เข้าสู่ระบบโดยเซ็ต token เอง (ใช้ JWT_SECRET ของฐานข้อมูลเทส) แทนการกรอกรหัสผ่าน
// ทำไม: login จริงถูกจำกัด 60 ครั้งต่อ IP ต่อ 15 นาที และเทสที่ใช้ข้อมูลคัดลอกจากฐานจริงไม่รู้รหัสผ่านของทุกบัญชี
// ใช้กับฐานข้อมูลชั่วคราวเท่านั้น — ระบบตรวจ token กับ DB ทุก request เหมือนเดิม (บัญชีต้องมีอยู่จริงและไม่ถูกปิด)
import jwt from "jsonwebtoken";

export const tokenFor = ({ userId, role, studentId = null }) =>
  jwt.sign({ userId, role, studentId, mustChangePassword: false }, process.env.JWT_SECRET, { expiresIn: "2h" });

// หาบัญชีจาก prisma แล้วคืนข้อมูลที่ใช้เซ็ต session
export async function findAccount(prisma, where) {
  const u = await prisma.user.findFirst({ where, include: { role: true, student: true } });
  if (!u) return null;
  return { userId: u.user_id, name: u.first_name, role: u.role.role_name, studentId: u.student?.student_id ?? null, username: u.psu_passport_id };
}

// ใส่ cookie + ข้อมูลผู้ใช้ใน localStorage ให้ context (ต้องเรียกก่อนเปิดหน้า)
export async function applySession(context, API, account) {
  const origin = new URL(API).origin;
  await context.addCookies([{ name: "token", value: tokenFor(account), url: origin }]);
  await context.addInitScript((user) => {
    try { localStorage.setItem("nursing_user", JSON.stringify(user)); } catch { /* ไม่เป็นไร */ }
  }, { id: account.userId, name: account.name, role: account.role, mustChangePassword: false, profileIncomplete: false });
}

// เรียก API ด้วย token ที่เซ็ตเอง
export function apiClient(API, account) {
  const cookie = "token=" + tokenFor(account);
  return async (method, urlPath, body) => {
    const headers = { Cookie: cookie };
    let payload;
    if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
    const started = Date.now();
    const res = await fetch(API + urlPath, { method, headers, body: payload });
    const buffer = Buffer.from(await res.arrayBuffer());
    let json = {};
    try { json = JSON.parse(buffer.toString("utf8")); } catch { /* ไฟล์ */ }
    return { status: res.status, data: json.data, json, ms: Date.now() - started, bytes: buffer.length, buffer, text: buffer.toString("utf8", 0, Math.min(buffer.length, 4000000)) };
  };
}
