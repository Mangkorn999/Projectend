// "ผู้ดำเนินการ" (ใครทำอะไร) + ปิดบัญชีแล้วประวัติต้องไม่หาย — ตามที่อาจารย์ที่ปรึกษาแนะนำ
//   - รอบสอบ: GET /api/rounds ต้องบอกว่าใครสร้าง (creator) แต่นักศึกษาห้ามเห็น
//   - ข่าว: GET /api/news ต้องบอกว่าใครโพสต์ (poster) + is_closed
//   - ผลสอบ: GET /api/exam-results ต้องมี confirmer + review_logs (ใครตรวจ/ตีกลับ/ถอนการยืนยัน)
//   - ปิดบัญชีผู้ตรวจ (revoke) แล้ว ชื่อต้องยังอยู่ในประวัติ แต่ is_closed = true
//   - ทุก response ห้ามมี password_hash หลุดออกมาเด็ดขาด
import { cleanupYears } from "./cleanupYears.mjs";

import { autoAttachEvidence } from "./autoEvidence.mjs";
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
  const text = await res.text();
  const json = (() => { try { return JSON.parse(text); } catch { return {}; } })();
  let cookie = null;
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  await autoAttachEvidence(BASE, method, url, token, { status: res.status, json });
  return { status: res.status, json, cookie, text };
};

const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
};

const YEAR = 2590; // ปีสมมติ (cleanupYears รับเฉพาะ 2590 ขึ้นไป)
const STAMP = Date.now().toString().slice(-8);
const STUDENT_ID = `${String(YEAR - 4).slice(-2)}${STAMP}`;
const NATIONAL_ID = `2${STAMP}00000`.slice(0, 13);
const NOW = { open_date: "2020-01-01", close_date: "2099-12-31" };
const REVIEWER_PSU = `7${STAMP}`;

const login = (psu_passport_id, password = psu_passport_id) =>
  call("POST", "/api/auth/login", { body: { psu_passport_id, password } });

const main = async () => {
  const officer = await login("456");
  const oToken = officer.cookie;
  if (!oToken) { console.log("officer login failed:", JSON.stringify(officer.json)); process.exit(1); }
  const officerId = officer.json.user.id;

  const allRounds = (await call("GET", "/api/rounds", { token: oToken })).json.data || [];
  const parked = allRounds.filter((r) => r.status === "open").map((r) => r.round_id);
  for (const id of parked) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });

  const created = [];
  try {
    const ids = (await call("GET", "/api/subjects", { token: oToken })).json.data.map((s) => s.subject_id);
    const rooms = (await call("GET", "/api/rooms", { token: oToken })).json.data || [];

    // ---- เตรียมข้อมูล: ผู้ตรวจ 1 คน + รอบ + ข่าว + นักศึกษาที่ส่งผล ----
    const rv = await call("POST", "/api/users", {
      token: oToken,
      body: { psu_passport_id: REVIEWER_PSU, password: "test1234", role_name: "reviewer", first_name: "ผู้ตรวจ", last_name: "ทดสอบ", email: `rv${STAMP}@test.local`, phone: "0800000003" },
    });
    check("สร้างผู้ตรวจทดสอบ -> 201", rv.status, 201);
    const reviewerId = rv.json.data?.user_id;
    const rvFirst = await login(REVIEWER_PSU, "test1234");
    await call("PATCH", "/api/auth/password", { token: rvFirst.cookie, body: { current_password: "test1234", new_password: "test5678" } });
    const rvToken = (await login(REVIEWER_PSU, "test5678")).cookie;

    const roundRes = await call("POST", "/api/rounds", { token: oToken, body: { academic_year: YEAR, attempt_number: 1, ...NOW, subject_ids: ids.slice(0, 5) } });
    const roundId = roundRes.json.data.round_id;
    await call("PUT", `/api/rounds/${roundId}`, { token: oToken, body: { status: "open" } });
    created.push(roundId);

    const newsRes = await call("POST", "/api/news", { token: oToken, body: { title: "ข่าวทดสอบผู้โพสต์", content: "ทดสอบ", round_id: roundId } });
    check("เจ้าหน้าที่โพสต์ข่าว -> 201", newsRes.status, 201);

    await call("POST", "/api/students", { token: oToken, body: { student_id: STUDENT_ID, national_id: NATIONAL_ID } });
    const sToken = (await login(STUDENT_ID, NATIONAL_ID)).cookie;
    await call("POST", "/api/students/complete-profile", {
      token: sToken,
      body: { first_name: "ทดสอบ", last_name: "ผู้ดำเนินการ", first_name_en: "Test", last_name_en: "Actor", email: `${STUDENT_ID}@test.local`, phone: "0800000004", room_id: rooms[0].room_id },
    });
    await call("PATCH", "/api/students/bulk-eligible", { token: oToken, body: { student_ids: [STUDENT_ID], exam_eligible: true } });
    const submit = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id, i) => ({ subject_id: id, is_passed: i < 3 })) },
    });
    const resultId = submit.json.data.result_id;

    // ---- 1) รอบสอบ: เจ้าหน้าที่เห็นผู้สร้าง นักศึกษาไม่เห็น ----
    const roundsO = await call("GET", "/api/rounds", { token: oToken });
    const myRound = (roundsO.json.data || []).find((r) => r.round_id === roundId);
    check("รอบ: เจ้าหน้าที่เห็นผู้สร้าง (ตรงกับ user ที่สร้าง)", myRound?.creator?.user_id, officerId);
    check("  ผู้สร้างยังไม่ปิดบัญชี (is_closed = false)", myRound?.creator?.is_closed, false);
    const roundsS = await call("GET", "/api/rounds", { token: sToken });
    const myRoundS = (roundsS.json.data || []).find((r) => r.round_id === roundId);
    check("รอบ: นักศึกษาไม่เห็นผู้สร้าง (ไม่มี key creator)", myRoundS ? "creator" in myRoundS : "no-round", false);

    // ---- 2) ข่าว: เห็นผู้โพสต์ ----
    const newsList = await call("GET", "/api/news", { token: oToken });
    const myNews = (newsList.json.data || []).find((n) => n.title === "ข่าวทดสอบผู้โพสต์");
    check("ข่าว: เห็นผู้โพสต์ + is_closed = false", [myNews?.poster?.user_id, myNews?.poster?.is_closed], [officerId, false]);

    // ---- 3) ผลสอบ: ผู้ตรวจ approve -> มี confirmer + review_logs ----
    const approve = await call("PATCH", `/api/exam-results/${resultId}/approve`, { token: rvToken });
    check("ผู้ตรวจยืนยันผลสอบ -> 200", approve.status, 200);

    const findResult = async () => {
      const r = await call("GET", `/api/exam-results?student_id=${STUDENT_ID}`, { token: oToken });
      return { res: r, row: (r.json.data || []).find((x) => x.result_id === resultId) };
    };
    const before = await findResult();
    check("ผลสอบ: confirmer คือผู้ตรวจ + ยังไม่ปิดบัญชี", [before.row?.confirmer?.user_id, before.row?.confirmer?.is_closed], [reviewerId, false]);
    check("  review_logs มี 1 รายการ action = approved โดยผู้ตรวจ", [before.row?.review_logs?.length, before.row?.review_logs?.[0]?.action, before.row?.review_logs?.[0]?.reviewer?.user_id], [1, "approved", reviewerId]);

    // ---- 4) ปิดบัญชีผู้ตรวจ -> ชื่อยังอยู่ แต่ is_closed = true ----
    const revoke = await call("POST", `/api/users/${reviewerId}/revoke`, { token: oToken });
    check("ปิดบัญชีผู้ตรวจ -> 200", revoke.status, 200);
    const after = await findResult();
    check("หลังปิดบัญชี: ชื่อผู้ตรวจยังอยู่ในประวัติ", [after.row?.review_logs?.[0]?.reviewer?.first_name, after.row?.review_logs?.[0]?.reviewer?.last_name], ["ผู้ตรวจ", "ทดสอบ"]);
    check("  is_closed = true ทั้ง confirmer และใน review_logs", [after.row?.confirmer?.is_closed, after.row?.review_logs?.[0]?.reviewer?.is_closed], [true, true]);

    // ---- 5) ห้ามมี password_hash หลุดในทุก response ที่เพิ่งแก้ ----
    const dumps = [roundsO.text, roundsS.text, newsList.text, after.res.text];
    check("ไม่มี password_hash ใน response รอบ/ข่าว/ผลสอบ", dumps.some((t) => /password_hash/i.test(t)), false);

    // ---- 5.1) คอลัมน์ audit ของ users: ใครสร้าง / ใครปิด เมื่อไหร่ ----
    const findUser = async () => (await call("GET", "/api/users", { token: oToken })).json.data.find((u) => u.user_id === reviewerId);
    const closedUser = await findUser();
    check("users: created_by = เจ้าหน้าที่ที่สร้างบัญชี", closedUser?.creator?.user_id, officerId);
    check("users: ปิดบัญชีแล้ว closed_by = คนที่กดปิด + มี closed_at", [closedUser?.closer?.user_id, !!closedUser?.closed_at, closedUser?.is_revoked], [officerId, true, true]);

    // ---- 5.2) รีเซ็ตรหัส = เปิดบัญชีคืน -> ล้าง closed_by / closed_at ----
    const reopen = await call("POST", `/api/users/${reviewerId}/reset-password`, { token: oToken, body: { new_password: "test9999" } });
    check("รีเซ็ตรหัสบัญชีที่ปิดแล้ว -> 200", reopen.status, 200);
    const reopened = await findUser();
    check("  เปิดคืนแล้ว: is_revoked = false, ไม่มี closer / closed_at", [reopened?.is_revoked, reopened?.closer, reopened?.closed_at], [false, null, null]);

    // ---- 5.3) เปลี่ยน role ----
    const toOfficer = await call("POST", `/api/users/${reviewerId}/role`, { token: oToken, body: { role_name: "officer" } });
    check("เปลี่ยน role ผู้ตรวจ -> เจ้าหน้าที่ = 200", toOfficer.status, 200);
    check("  role ใหม่ถูกบันทึก", (await findUser())?.role?.role_name, "officer");
    check("เปลี่ยน role ของตัวเอง -> 400", (await call("POST", `/api/users/${officerId}/role`, { token: oToken, body: { role_name: "reviewer" } })).status, 400);
    check("role ที่ไม่มีอยู่จริง -> 400", (await call("POST", `/api/users/${reviewerId}/role`, { token: oToken, body: { role_name: "admin" } })).status, 400);
    check("นักศึกษาเปลี่ยน role ไม่ได้ -> 403", (await call("POST", `/api/users/${reviewerId}/role`, { token: sToken, body: { role_name: "officer" } })).status, 403);

    // ---- 5.4) รอบ: แก้แล้วมี updater + updated_at ----
    const upRound = await call("PUT", `/api/rounds/${roundId}`, { token: oToken, body: { status: "open" } });
    check("แก้รอบ -> 200", upRound.status, 200);
    const roundAfter = ((await call("GET", "/api/rounds", { token: oToken })).json.data || []).find((r) => r.round_id === roundId);
    check("รอบ: updater = คนที่แก้ + มี updated_at", [roundAfter?.updater?.user_id, !!roundAfter?.updated_at], [officerId, true]);
    const roundAfterS = ((await call("GET", "/api/rounds", { token: sToken })).json.data || []).find((r) => r.round_id === roundId);
    check("รอบ: นักศึกษาไม่เห็น updater", roundAfterS ? "updater" in roundAfterS : "no-round", false);

    // ---- 5.5) ข่าว: แก้แล้วมี updater (นักศึกษาไม่เห็น) ----
    const newsId = newsRes.json.data?.news_id;
    check("ข่าวใหม่ยังไม่มี updater", (myNews && myNews.updater) ?? null, null);
    const upNews = await call("PUT", `/api/news/${newsId}`, { token: oToken, body: { title: "ข่าวทดสอบผู้โพสต์ (แก้แล้ว)" } });
    check("แก้ข่าว -> 200", upNews.status, 200);
    const newsAfter = ((await call("GET", "/api/news", { token: oToken })).json.data || []).find((n) => n.news_id === newsId);
    check("ข่าว: updater = คนที่แก้", newsAfter?.updater?.user_id, officerId);
    const newsAfterS = ((await call("GET", "/api/news", { token: sToken })).json.data || []).find((n) => n.news_id === newsId);
    check("ข่าว: นักศึกษาไม่เห็น updater", newsAfterS ? "updater" in newsAfterS : "no-news", false);

    // ---- 5.6) นักศึกษา: ใครเปิดสิทธิ์ล่าสุด ----
    await call("PATCH", "/api/students/bulk-eligible", { token: oToken, body: { student_ids: [STUDENT_ID], exam_eligible: true } });
    const stuO = (await call("GET", `/api/students/${STUDENT_ID}`, { token: oToken })).json.data;
    check("นักศึกษา: เจ้าหน้าที่เห็น eligible_setter + เวลา", [stuO?.eligible_setter?.user_id, !!stuO?.eligible_set_at], [officerId, true]);
    const stuS = (await call("GET", `/api/students/${STUDENT_ID}`, { token: sToken })).json.data;
    check("นักศึกษา: เจ้าของข้อมูลไม่เห็นชื่อผู้เปิดสิทธิ์", [stuS ? "eligible_setter" in stuS : "no-data", stuS ? "eligible_set_by" in stuS : "no-data"], [false, false]);
    check("ไม่มี password_hash หลุดใน users/news/students", [(await call("GET", "/api/users", { token: oToken })).text, newsAfter ? JSON.stringify(newsAfter) : "", JSON.stringify(stuO)].some((t) => /password_hash/i.test(t)), false);

    // ---- 6) นักศึกษา/ผู้บริหารเรียกดูผลสอบของคนอื่นไม่ได้ (ชื่อผู้ตรวจจึงไม่หลุดไปถึงนักศึกษา) ----
    check("นักศึกษาเรียก GET /exam-results (รายชื่อทั้งหมด) -> 403", (await call("GET", "/api/exam-results", { token: sToken })).status, 403);
  } finally {
    for (const id of created) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });
    await cleanupYears([YEAR]);
    for (const id of parked) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "open" } });
  }

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
};

main();
