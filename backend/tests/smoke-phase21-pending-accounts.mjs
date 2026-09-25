// บัญชีนักศึกษาที่ import แล้วยังไม่กรอกโปรไฟล์ — ดูรายชื่อ + ลบ
//
// ปัญหาเดิม: บัญชีกลุ่มนี้มีแค่แถว users ไม่มีแถว students เลยไม่โผล่ในรายชื่อนักศึกษา
// และ DELETE /students/:id ลบไม่ได้ → import รหัสผิด (เช่นจาก Google Form) แล้วไม่มีทางเอาออก
//
// เทสนี้คุม:
//   1. GET  /students/pending-accounts   เห็นเฉพาะคนที่ยังไม่กรอกโปรไฟล์ (officer เท่านั้น)
//   2. POST /students/pending-accounts/delete  ลบได้เฉพาะกลุ่มนั้น — คนที่กรอกโปรไฟล์แล้วต้องไม่ถูกแตะ
//   3. ลบแล้ว login ไม่ได้อีก · ส่งของแปลกมา = 400/404 ไม่ใช่ 500
//
// ปีที่ใช้ 2593 (เทสอื่นใช้ 2594–2599) ล้างตอนจบด้วย cleanupYears
import { cleanupYears } from "./cleanupYears.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
let failures = 0;

const call = async (method, url, { token, body } = {}) => {
  const headers = {};
  if (token) headers.Cookie = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, json, cookie: setCookie ? setCookie.split(";")[0] : null };
};

const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
};

const YEAR = 2593;
const PREFIX = String(YEAR - 4).slice(-2); // รหัสขึ้นต้น 89 → คำนวณปีจบได้ 2593
const STAMP = Date.now().toString().slice(-6);
const ID_A = `${PREFIX}${STAMP}01`; // pending (ไม่กรอกโปรไฟล์)
const ID_B = `${PREFIX}${STAMP}02`; // pending
const ID_C = `${PREFIX}${STAMP}03`; // กรอกโปรไฟล์แล้ว
const nid = (i) => `1${STAMP}0000${i}`.slice(0, 13).padEnd(13, "0");

const main = async () => {
  const oToken = (await call("POST", "/api/auth/login", { body: { psu_passport_id: "456", password: "456" } })).cookie;
  check("login officer", !!oToken, true);

  try {
    for (const [id, i] of [[ID_A, 1], [ID_B, 2], [ID_C, 3]]) {
      const r = await call("POST", "/api/students", { token: oToken, body: { student_id: id, national_id: nid(i) } });
      check(`สร้างบัญชี ${id} -> 201`, r.status, 201);
    }
    // C กรอกโปรไฟล์ → มีแถว students แล้ว
    const cLogin = await call("POST", "/api/auth/login", { body: { psu_passport_id: ID_C, password: nid(3) } });
    const rooms = (await call("GET", "/api/rooms", { token: cLogin.cookie })).json.data;
    const prof = await call("POST", "/api/students/complete-profile", {
      token: cLogin.cookie,
      body: { first_name: "ก", last_name: "ข", first_name_en: "A", last_name_en: "B", email: "c@test.local", phone: "0800000000", room_id: rooms[0].room_id },
    });
    check("C กรอกโปรไฟล์ -> 201", prof.status, 201);

    // ── 1. รายชื่อ ──
    const list = await call("GET", "/api/students/pending-accounts", { token: oToken });
    check("officer GET pending-accounts -> 200", list.status, 200);
    const ids = (list.json.data || []).map((x) => x.student_id);
    check("  มี A และ B (ยังไม่กรอกโปรไฟล์)", [ids.includes(ID_A), ids.includes(ID_B)], [true, true]);
    check("  ไม่มี C (กรอกโปรไฟล์แล้ว)", ids.includes(ID_C), false);
    check("  ปีจบคำนวณจากรหัสมาให้", list.json.data.find((x) => x.student_id === ID_A)?.academic_year, YEAR);
    check("  ไม่มี password_hash / เลขบัตรหลุด", /password|national/i.test(JSON.stringify(list.json)), false);

    for (const [who, login] of [["reviewer", ["321", "321"]], ["executive", ["789", "789"]], ["student", [ID_C, nid(3)]]]) {
      const t = (await call("POST", "/api/auth/login", { body: { psu_passport_id: login[0], password: login[1] } })).cookie;
      check(`${who} GET pending-accounts -> 403`, (await call("GET", "/api/students/pending-accounts", { token: t })).status, 403);
      check(`${who} POST pending-accounts/delete -> 403`, (await call("POST", "/api/students/pending-accounts/delete", { token: t, body: { student_ids: [ID_A] } })).status, 403);
    }
    check("ไม่ login GET -> 401", (await call("GET", "/api/students/pending-accounts")).status, 401);

    // ── 2. ลบ ──
    const del = (body) => call("POST", "/api/students/pending-accounts/delete", { token: oToken, body });
    check("ไม่ส่ง student_ids -> 400", (await del({})).status, 400);
    check("student_ids ว่าง -> 400", (await del({ student_ids: [] })).status, 400);
    check("student_ids ไม่ใช่ข้อความ -> 400", (await del({ student_ids: [123] })).status, 400);
    check("student_ids เกิน 1000 -> 400", (await del({ student_ids: Array.from({ length: 1001 }, (_, i) => `x${i}`) })).status, 400);
    check("รหัสที่ไม่มีจริง -> 404", (await del({ student_ids: ["0000000000"] })).status, 404);

    // คนที่กรอกโปรไฟล์แล้วต้องไม่ถูกลบผ่านทางนี้
    const tryC = await del({ student_ids: [ID_C] });
    check("ส่งรหัสของคนที่กรอกโปรไฟล์แล้ว -> 404 (ไม่ลบ)", tryC.status, 404);
    check("  C ยังอยู่ในรายชื่อนักศึกษา", (await call("GET", `/api/students/${ID_C}`, { token: oToken })).status, 200);
    check("  C ยัง login ได้", (await call("POST", "/api/auth/login", { body: { psu_passport_id: ID_C, password: nid(3) } })).status, 200);

    // ลบ A + ส่ง C ปนมาด้วย → ลบ A เท่านั้น C ถูกข้าม
    const mixed = await del({ student_ids: [ID_A, ID_C, ID_A] });
    check("ลบ A + C ปนกัน (A ซ้ำ 2 ครั้ง) -> 200", mixed.status, 200);
    check("  ลบ 1 ข้าม 1", [mixed.json?.data?.deleted_count, mixed.json?.data?.skipped_count], [1, 1]);
    check("  A login ไม่ได้อีก -> 401", (await call("POST", "/api/auth/login", { body: { psu_passport_id: ID_A, password: nid(1) } })).status, 401);
    const after = (await call("GET", "/api/students/pending-accounts", { token: oToken })).json.data.map((x) => x.student_id);
    check("  A หายจากรายชื่อ B ยังอยู่", [after.includes(ID_A), after.includes(ID_B)], [false, true]);
    check("  C ยังอยู่", (await call("GET", `/api/students/${ID_C}`, { token: oToken })).status, 200);

    // ลบซ้ำ = 404 ไม่ใช่ 500
    check("ลบ A ซ้ำ -> 404", (await del({ student_ids: [ID_A] })).status, 404);
    check("ลบ B -> 200", (await del({ student_ids: [ID_B] })).status, 200);
  } finally {
    await cleanupYears([YEAR]);
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error(e); process.exit(1); });
