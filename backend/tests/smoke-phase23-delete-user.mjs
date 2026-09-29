// DELETE /api/users/:id — ลบบัญชีจริง (officer/executive/reviewer)
// เคสสำคัญที่สุด: user ที่มีประวัติผูก (review_logs/submission_rounds/news) ต้องได้ 409 สุภาพ
// ไม่ใช่ 500 พร้อม raw SQL error — ทุก FK ที่เกี่ยวข้องตั้งเป็น ON DELETE RESTRICT ซึ่ง Postgres
// ตอบ SQLSTATE 23001 ไม่ใช่ 23503 ที่ Prisma แปลงเป็น P2003 ให้เอง (เคยพังจริงมาก่อน แก้ที่
// users.controller.js ด้วย pre-check countLinkedHistory ก่อนเรียก .delete())
import { cleanupYears } from "./cleanupYears.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
let failures = 0;

const call = async (method, url, { token, body } = {}) => {
  const headers = {};
  if (token) headers.Cookie = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  let cookie = null;
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return { status: res.status, json, cookie };
};

const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
};

const YEAR = 2595; // clear of every other smoke-phase year
const STAMP = Date.now().toString().slice(-8);
const STUDENT_ID = `${String(YEAR - 4).slice(-2)}${STAMP}`;
const NATIONAL_ID = `1${STAMP}00000`.slice(0, 13);
const NOW = { open_date: "2020-01-01", close_date: "2099-12-31" };

const login = (psu_passport_id, password = psu_passport_id) =>
  call("POST", "/api/auth/login", { body: { psu_passport_id, password } });

const main = async () => {
  const officer = await login("456");
  const oToken = officer.cookie;
  if (!oToken) { console.log("officer login failed:", JSON.stringify(officer.json)); process.exit(1); }
  const officerId = officer.json.user.id;

  const student = await login("6610210631");
  const sTokenSeed = student.cookie;

  // ---- case: ลบ user ที่ไม่มีประวัติผูก -> 200 ----
  const fresh = await call("POST", "/api/users", {
    token: oToken,
    body: { psu_passport_id: `9${STAMP}`, password: "test1234", role_name: "reviewer", first_name: "Del", last_name: "Clean", email: `del${STAMP}@test.local`, phone: "0800000000" },
  });
  check("สร้าง reviewer ทดสอบ (ไม่มีประวัติ) -> 201", fresh.status, 201);
  const freshId = fresh.json.data?.user_id;

  const del1 = await call("DELETE", `/api/users/${freshId}`, { token: oToken });
  check("ลบ user ที่ไม่มีประวัติผูก -> 200", del1.status, 200);

  const del1Again = await call("DELETE", `/api/users/${freshId}`, { token: oToken });
  check("ลบซ้ำ (ไม่มีอยู่แล้ว) -> 404", del1Again.status, 404);

  // ---- case: guard ทั่วไป ----
  check("ลบตัวเอง -> 400", (await call("DELETE", `/api/users/${officerId}`, { token: oToken })).status, 400);
  check("role อื่น (student) เรียก DELETE -> 403", (await call("DELETE", `/api/users/${officerId}`, { token: sTokenSeed })).status, 403);
  check("ไม่ login -> 401", (await call("DELETE", `/api/users/${officerId}`)).status, 401);
  check("id ไม่ใช่ตัวเลข -> 400", (await call("DELETE", "/api/users/abc", { token: oToken })).status, 400);
  check("user id ไม่มีจริง -> 404", (await call("DELETE", "/api/users/999999", { token: oToken })).status, 404);

  // ---- case สำคัญสุด: ลบ user ที่มีประวัติผูก (เคย approve ผลสอบ 1 ใบ) -> 409 สุภาพ ไม่ใช่ 500 ----
  const linked = await call("POST", "/api/users", {
    token: oToken,
    body: { psu_passport_id: `8${STAMP}`, password: "test1234", role_name: "reviewer", first_name: "Del", last_name: "Linked", email: `link${STAMP}@test.local`, phone: "0800000001" },
  });
  const linkedId = linked.json.data?.user_id;

  const allRounds = (await call("GET", "/api/rounds", { token: oToken })).json.data || [];
  const parked = allRounds.filter((r) => r.status === "open").map((r) => r.round_id);
  for (const id of parked) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });

  const created = [];
  try {
    const ids = (await call("GET", "/api/subjects", { token: oToken })).json.data.map((s) => s.subject_id);
    const rooms = (await call("GET", "/api/rooms", { token: oToken })).json.data || [];

    const openRes = await call("POST", "/api/rounds", { token: oToken, body: { academic_year: YEAR, attempt_number: 1, ...NOW, subject_ids: ids.slice(0, 5) } });
    const roundId = openRes.json.data.round_id;
    await call("PUT", `/api/rounds/${roundId}`, { token: oToken, body: { status: "open" } });
    created.push(roundId);

    await call("POST", "/api/students", { token: oToken, body: { student_id: STUDENT_ID, national_id: NATIONAL_ID } });
    const sLogin = await login(STUDENT_ID, NATIONAL_ID);
    const sToken = sLogin.cookie;
    await call("POST", "/api/students/complete-profile", {
      token: sToken,
      body: { first_name: "ทดสอบ", last_name: "DeleteUser", first_name_en: "Test", last_name_en: "DeleteUser", email: `${STUDENT_ID}@test.local`, phone: "0800000002", room_id: rooms[0].room_id },
    });
    await call("PATCH", "/api/students/bulk-eligible", { token: oToken, body: { student_ids: [STUDENT_ID], exam_eligible: true } });

    const submit = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id, i) => ({ subject_id: id, is_passed: i < 3 })) },
    });
    const resultId = submit.json.data.result_id;

    // ให้ user ทดสอบ "linked" เปลี่ยนรหัสก่อนใช้งานจริง (must_change_password บังคับไว้ตอนสร้าง)
    const linkedLoginFirst = await login(`8${STAMP}`, "test1234");
    await call("PATCH", "/api/auth/password", { token: linkedLoginFirst.cookie, body: { current_password: "test1234", new_password: "test5678" } });
    const linkedLogin = await login(`8${STAMP}`, "test5678");
    const lToken = linkedLogin.cookie;

    const approve = await call("PATCH", `/api/exam-results/${resultId}/approve`, { token: lToken });
    check("reviewer ทดสอบ approve ใบสอบ -> 200", approve.status, 200);

    const del2 = await call("DELETE", `/api/users/${linkedId}`, { token: oToken });
    check("ลบ user ที่มีประวัติผูก (เคย approve) -> 409", del2.status, 409);
    check("  ไม่ใช่ raw error ของ Prisma/Postgres", /prisma|postgres|sqlstate|constraint/i.test(del2.json.message ?? ""), false);
    check("  บอกให้ใช้ถอนสิทธิ์แทน", (del2.json.message ?? "").includes("ถอนสิทธิ์"), true);

    const stillThere = await call("GET", "/api/users", { token: oToken });
    check("  user ที่มีประวัติผูกยังอยู่ (ไม่ถูกลบครึ่งๆ)", (stillThere.json.data || []).some((u) => u.user_id === linkedId), true);
  } finally {
    for (const id of created) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });
    await cleanupYears([YEAR]);
    for (const id of parked) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "open" } });
    // เก็บกวาด user ทดสอบที่มีประวัติผูก — ลบ review_log ก่อนแล้วค่อยลบ user (ทำตรงๆ ผ่าน DB ในเทสนี้ไม่ได้ ปล่อยไว้ก็ไม่กระทบเทสอื่น)
  }

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
};

main();
