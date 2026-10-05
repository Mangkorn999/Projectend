// Smoke test for Phase 1-3 endpoints (auth/me, subjects CRUD, users).
const BASE = process.env.BASE || "http://localhost:3000"; // ตั้ง BASE ได้ตอนรันผ่าน test:clean (server ชั่วคราวอยู่คนละพอร์ต)
const results = [];
let failures = 0;

const call = async (method, url, { token, body } = {}) => {
  const headers = {};
  // `token` ที่ส่งเข้ามาคือข้อความ cookie เต็มๆ เช่น "token=eyJhbGci..."
  // backend อ่าน JWT จาก httpOnly cookie แล้ว ไม่ได้อ่านจาก Authorization header อีก
  if (token) headers.Cookie = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  // ดึง cookie ที่ server ส่งกลับมา (มีเฉพาะตอน login) เพื่อเอาไปใช้ request ถัดๆ ไป
  // set-cookie มาเป็น "token=eyJ...; Path=/; HttpOnly; SameSite=Lax" — เอาแค่ชิ้นแรกก่อน ;
  let cookie = null;
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    cookie = setCookie.split(";")[0];
  }
  return { status: res.status, json, cookie };
};

const check = (name, actual, expected, extra = "") => {
  const ok = actual === expected;
  if (!ok) failures++;
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}  → ${JSON.stringify(actual)} (want ${JSON.stringify(expected)}) ${extra}`);
};

// รหัสผ่านเริ่มต้นจาก seed = psu_passport_id ของตัวเอง
const login = (psu_passport_id) =>
  call("POST", "/api/auth/login", {
    body: { psu_passport_id, password: psu_passport_id },
  });

const main = async () => {
  const student = (await login("6610210631")).cookie;
  const officer = (await login("456")).cookie;

  // Phase 1 — auth/me
  const me = await call("GET", "/api/auth/me", { token: student });
  check("GET /api/auth/me → 200", me.status, 200, JSON.stringify(me.json));
  check("auth/me ไม่มี token → 401", (await call("GET", "/api/auth/me")).status, 401);
  const badToken = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: "token=garbage" } });
  check("auth/me token ปลอม → 401", badToken.status, 401);

  // logout — ต้องสั่งให้ browser ลบ cookie ทิ้ง (ฝั่ง JS ลบ httpOnly cookie เองไม่ได้)
  const logoutRes = await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: student },
  });
  check("POST /api/auth/logout → 200", logoutRes.status, 200);
  // คำสั่งลบ cookie คือส่ง Set-Cookie ค่าว่างพร้อมวันหมดอายุย้อนหลัง
  const clearHeader = logoutRes.headers.get("set-cookie") || "";
  check("logout สั่งลบ cookie", clearHeader.startsWith("token=;"), true, clearHeader);

  // Phase 2 — subjects CRUD
  const created = await call("POST", "/api/subjects", {
    token: officer,
    body: { subject_code: "TEST99", subject_name: "วิชาทดสอบ" },
  });
  check("POST /api/subjects (officer) → 200", created.status, 200);
  const subjectId = created.json?.data?.subject_id;

  check(
    "POST /api/subjects (student) → 403",
    (await call("POST", "/api/subjects", { token: student, body: { subject_code: "X", subject_name: "Y" } })).status,
    403,
  );

  const updated = await call("PUT", `/api/subjects/${subjectId}`, {
    token: officer,
    body: { subject_name: "วิชาทดสอบแก้ไข" },
  });
  check("PUT /api/subjects/:id → 200", updated.status, 200);
  check("PUT แก้ชื่อจริง", updated.json?.data?.subject_name, "วิชาทดสอบแก้ไข");

  check("DELETE /api/subjects/:id → 200", (await call("DELETE", `/api/subjects/${subjectId}`, { token: officer })).status, 200);

  const after = await call("GET", "/api/subjects", { token: student });
  check("ลบแล้วเหลือ 8 วิชา", after.json?.data?.length, 8);

  // Phase 3 — users
  const users = await call("GET", "/api/users", { token: officer });
  check("GET /api/users (officer) → 200", users.status, 200);
  check("GET /api/users (student) → 403", (await call("GET", "/api/users", { token: student })).status, 403);

  const students = await call("GET", "/api/students", { token: officer });
  check("GET /api/students (officer) → 200", students.status, 200);
  check("students คืน 1 คน", students.json?.data?.length, 1);

  // เปลี่ยน role แล้วเปลี่ยนกลับ
  const execUserId = users.json?.data?.find((u) => u.psu_passport_id === "789")?.user_id;
  const roleChange = await call("POST", `/api/users/${execUserId}/role`, {
    token: officer,
    body: { role_name: "officer" },
  });
  check("POST /api/users/:id/role → 200", roleChange.status, 200, JSON.stringify(roleChange.json).slice(0, 120));

  check(
    "role_name ผิด → 400",
    (await call("POST", `/api/users/${execUserId}/role`, { token: officer, body: { role_name: "admin" } })).status,
    400,
  );

  const officerUserId = users.json?.data?.find((u) => u.psu_passport_id === "456")?.user_id;
  check(
    "เปลี่ยน role ตัวเอง → 400",
    (await call("POST", `/api/users/${officerUserId}/role`, { token: officer, body: { role_name: "student" } })).status,
    400,
  );

  check(
    "user id ไม่มีจริง → 404",
    (await call("POST", "/api/users/999999/role", { token: officer, body: { role_name: "officer" } })).status,
    404,
  );

  // B-18 (5 ต.ค. 2569): ห้ามเปลี่ยนบทบาทเป็นนักศึกษาผ่าน API (role นี้เกิดจากการนำเข้ารายชื่อเท่านั้น)
  check(
    "เปลี่ยน role เป็น student → 400",
    (await call("POST", `/api/users/${execUserId}/role`, { token: officer, body: { role_name: "student" } })).status,
    400,
  );

  // เปลี่ยนกลับเป็น executive
  await call("POST", `/api/users/${execUserId}/role`, { token: officer, body: { role_name: "executive" } });

  console.log(results.join("\n"));
  console.log(`\n${results.length - failures}/${results.length} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
};

main().catch((e) => { console.error("CRASHED:", e); process.exit(2); });
