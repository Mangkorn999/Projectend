// ตารางสิทธิ์ทุก endpoint × ทุกบทบาท + จุดที่เทสอื่นยังไม่ครอบ (alerts, รายชื่อผ่าน/ไม่ผ่านรายวิชา, ค่าแปลกใน URL)
//
// 1. ทุก endpoint: ไม่ login -> 401 · บทบาทที่ไม่มีสิทธิ์ -> 403 ข้อความ "ไม่มีสิทธิ์ใช้งานส่วนนี้" · บทบาทที่มีสิทธิ์ -> ผ่านด่านสิทธิ์
//    (ส่ง id/ข้อมูลที่ไม่มีจริง จึงไม่มีการเขียนข้อมูลเกิดขึ้น — ผ่านด่านสิทธิ์แล้วจะได้ 400/404)
// 2. /api/dashboard/alerts: เจ้าหน้าที่เห็น "ใบรอตรวจ" ผู้บริหารไม่เห็น
// 3. /api/students/subject-result-list: นับเฉพาะใบที่ยืนยันแล้ว
// 4. ค่าแปลกใน URL/query (abc, ติดลบ, ว่าง) ต้องไม่ทำให้ server ตอบ 500
//
// รุ่นทดสอบ 2593 (รหัสขึ้นต้น 89) — ล้างทิ้งด้วย cleanupYears
import { cleanupYears } from "./cleanupYears.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
let failures = 0;

const call = async (method, url, { token, body } = {}) => {
  const headers = {};
  if (token) headers.Cookie = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const type = res.headers.get("content-type") || "";
  let json = {};
  if (/json/.test(type)) json = await res.json().catch(() => ({}));
  else await res.arrayBuffer().catch(() => {});
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, json, type, cookie: setCookie ? setCookie.split(";")[0] : null };
};

const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
};

const YEAR = 2593;
const PREFIX = String(YEAR - 4).slice(-2);
const STAMP = Date.now().toString().slice(-6);
const SID = `${PREFIX}${STAMP}01`;
const SID2 = `${PREFIX}${STAMP}02`;
const SID3 = `${PREFIX}${STAMP}03`;
const NID = `1${STAMP}00001`.padEnd(13, "0").slice(0, 13);
const NID2 = `1${STAMP}00002`.padEnd(13, "0").slice(0, 13);
const NID3 = `1${STAMP}00003`.padEnd(13, "0").slice(0, 13);

const ALL = ["officer", "reviewer", "executive", "student"];
const OFFICER = ["officer"];
const OR = ["officer", "reviewer"];
const OE = ["officer", "executive"];
const STUDENT = ["student"];

// [วิธี, path, บทบาทที่มีสิทธิ์]  — :id ใช้เลขที่ไม่มีจริง (99999999)
const MATRIX = [
  ["GET", "/api/auth/me", ALL],
  ["PATCH", "/api/auth/password", ALL],
  ["GET", "/api/subjects", ALL],
  ["POST", "/api/subjects", OFFICER],
  ["PUT", "/api/subjects/99999999", OFFICER],
  ["DELETE", "/api/subjects/99999999", OFFICER],
  ["GET", "/api/users", OFFICER],
  ["POST", "/api/users", OFFICER],
  ["POST", "/api/users/99999999/role", OFFICER],
  ["POST", "/api/users/99999999/revoke", OFFICER],
  ["POST", "/api/users/99999999/reset-password", OFFICER],
  ["DELETE", "/api/users/99999999", OFFICER],
  ["GET", "/api/students", OR],
  ["GET", "/api/students/export-subject", OFFICER],
  ["POST", "/api/students/export", OFFICER],
  ["GET", "/api/students/subject-result-list", OFFICER],
  ["GET", "/api/students/pending-accounts", OFFICER],
  ["POST", "/api/students/pending-accounts/delete", OFFICER],
  ["POST", "/api/students/bulk-delete", OFFICER],
  ["POST", "/api/students", OFFICER],
  ["POST", "/api/students/complete-profile", STUDENT],
  ["PATCH", "/api/students/bulk-eligible", OFFICER],
  ["POST", "/api/students/import", OFFICER],
  ["POST", "/api/students/99999999/reset-password", OFFICER],
  ["DELETE", "/api/students/99999999", OFFICER],
  ["PATCH", "/api/students/99999999", OFFICER],
  ["GET", "/api/rounds", ALL],
  ["GET", "/api/rounds/active", STUDENT],
  ["POST", "/api/rounds", OFFICER],
  ["PUT", "/api/rounds/99999999", OFFICER],
  ["DELETE", "/api/rounds/99999999", OFFICER],
  ["POST", "/api/exam-results", STUDENT],
  ["GET", "/api/exam-results/me", STUDENT],
  ["POST", "/api/exam-results/99999999/certificates", STUDENT],
  ["GET", "/api/exam-results", OR],
  ["PATCH", "/api/exam-results/99999999/approve", OR],
  ["PATCH", "/api/exam-results/99999999/reject", OR],
  ["PATCH", "/api/exam-results/99999999/revoke-approval", OFFICER],
  ["GET", "/api/certificates/99999999/file", ALL],
  ["DELETE", "/api/certificates/99999999", STUDENT],
  ["GET", "/api/news", ALL],
  ["GET", "/api/news/99999999/image", ALL],
  ["POST", "/api/news/99999999/image", OFFICER],
  ["DELETE", "/api/news/99999999/image", OFFICER],
  ["POST", "/api/news", OFFICER],
  ["PUT", "/api/news/99999999", OFFICER],
  ["DELETE", "/api/news/99999999", OFFICER],
  ["GET", "/api/notifications/me", STUDENT],
  ["PATCH", "/api/notifications/read-all", STUDENT],
  ["PATCH", "/api/notifications/99999999/read", STUDENT],
  ["GET", "/api/rooms", ALL],
  ["GET", "/api/dashboard/stats", OE],
  ["GET", "/api/dashboard/history", OE],
  ["GET", "/api/dashboard/alerts", OE],
  ["GET", "/api/dashboard/export", OFFICER],
  ["GET", "/api/dashboard/export-first-attempt", OFFICER],
  ["GET", "/api/dashboard/export-first-year", OFFICER],
];

// 403 ที่มาจากด่านสิทธิ์ของบทบาท (ไม่ใช่ 403 ของกฎธุรกิจ เช่น "ยังไม่ได้รับสิทธิ์กรอกผลสอบ")
const isRoleDenied = (r) => r.status === 403 && /ท่านไม่มีสิทธิ์ใช้งานส่วนนี้/.test(r.json?.message || "");

const main = async () => {
  const login = async (u, p) => (await call("POST", "/api/auth/login", { body: { psu_passport_id: u, password: p } })).cookie;
  const tokens = {
    officer: await login("456", "456"),
    reviewer: await login("321", "321"),
    executive: await login("789", "789"),
    student: await login("6610210631", "6610210631"),
  };
  check("login ครบ 4 บทบาท", Object.values(tokens).every(Boolean), true);
  const oToken = tokens.officer;

  const parked = ((await call("GET", "/api/rounds", { token: oToken })).json.data || []).filter((r) => r.status === "open").map((r) => r.round_id);
  for (const id of parked) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });

  try {
    // ════════ 1. ตารางสิทธิ์ ════════
    console.log("\n── 1. ตารางสิทธิ์ ──");
    const wrongAnon = [];
    const wrongDenied = [];
    const wrongAllowed = [];
    for (const [method, path, allowed] of MATRIX) {
      const body = method === "GET" || method === "DELETE" ? undefined : {};
      const anon = await call(method, path, { body });
      if (anon.status !== 401) wrongAnon.push(`${method} ${path} -> ${anon.status}`);
      for (const role of ALL) {
        const r = await call(method, path, { token: tokens[role], body });
        if (allowed.includes(role)) {
          if (r.status === 401 || isRoleDenied(r) || r.status >= 500) wrongAllowed.push(`${role} ${method} ${path} -> ${r.status} ${r.json?.message ?? ""}`);
        } else if (!isRoleDenied(r)) {
          wrongDenied.push(`${role} ${method} ${path} -> ${r.status}`);
        }
      }
    }
    check(`ไม่ login ทุก endpoint (${MATRIX.length} เส้น) ได้ 401`, wrongAnon, []);
    check("บทบาทที่ไม่มีสิทธิ์ ได้ 403 ทุกเส้น", wrongDenied, []);
    check("บทบาทที่มีสิทธิ์ ผ่านด่านสิทธิ์ และไม่ได้ 5xx", wrongAllowed, []);

    // ════════ เตรียมข้อมูล: 2 นักศึกษา + รอบที่ใกล้ปิด ════════
    const rooms = (await call("GET", "/api/rooms", { token: oToken })).json.data;
    const subjects = (await call("GET", "/api/subjects", { token: oToken })).json.data;
    const [s1, s2] = subjects.slice(0, 2);
    const mk = async (id, nid, name) => {
      await call("POST", "/api/students", { token: oToken, body: { student_id: id, national_id: nid } });
      const l = await call("POST", "/api/auth/login", { body: { psu_passport_id: id, password: nid } });
      await call("POST", "/api/students/complete-profile", {
        token: l.cookie,
        body: { first_name: name, last_name: "สิทธิ์", first_name_en: "Test", last_name_en: "Matrix", email: `${id}@test.local`, phone: "0812345678", room_id: rooms[0].room_id },
      });
      return l.cookie;
    };
    const tA = await mk(SID, NID, "ทดสอบเอ");
    const tB = await mk(SID2, NID2, "ทดสอบบี");
    await mk(SID3, NID3, "ทดสอบซี"); // คนนี้ไม่ส่งผล — ใช้ตรวจแจ้งเตือน "ยังไม่ส่งผลสอบ"

    // ปิดรอบในอีก 3 วัน (นับเวลาไทย) -> ต้องมีแจ้งเตือน "ใกล้ปิดรับ"
    const ict = new Date(Date.now() + 7 * 3600 * 1000 + 3 * 86400 * 1000).toISOString().slice(0, 10);
    const created = await call("POST", "/api/rounds", { token: oToken, body: { academic_year: YEAR, attempt_number: 1, open_date: "2020-01-01", close_date: ict, subject_ids: [s1.subject_id, s2.subject_id] } });
    check("สร้างรอบที่จะปิดในอีก 3 วัน -> 200", created.status, 200);
    const roundId = created.json.data.round_id;
    await call("PUT", `/api/rounds/${roundId}`, { token: oToken, body: { status: "open" } });

    // ════════ 2. alerts ════════
    console.log("\n── 2. แจ้งเตือนของเจ้าหน้าที่/ผู้บริหาร ──");
    const sendA = await call("POST", "/api/exam-results", { token: tA, body: { subject_results: [{ subject_id: s1.subject_id, is_passed: true }, { subject_id: s2.subject_id, is_passed: true }] } });
    const sendB = await call("POST", "/api/exam-results", { token: tB, body: { subject_results: [{ subject_id: s1.subject_id, is_passed: false }, { subject_id: s2.subject_id, is_passed: true }] } });
    check("นักศึกษา A, B ส่งผล -> 200", [sendA.status, sendB.status], [200, 200]);
    const alertsO = (await call("GET", "/api/dashboard/alerts", { token: oToken })).json.data?.alerts || [];
    const alertsE = (await call("GET", "/api/dashboard/alerts", { token: tokens.executive })).json.data?.alerts || [];
    const mine = (list, type) => list.find((a) => a.type === type && a.round_id === roundId);
    check("เจ้าหน้าที่เห็น 'ใกล้ปิดรับ' ของรอบนี้ (เหลือ 3 วัน)", [mine(alertsO, "round_closing")?.detail], ["เหลืออีก 3 วัน"]);
    check("เจ้าหน้าที่เห็น 'มีผลสอบรอตรวจ 2 ใบ'", [mine(alertsO, "pending_review")?.count], [2]);
    // ฐานของ "ยังไม่ส่ง" คือคนที่ต้องกรอกในรอบนี้ (3 คน: A, B, C) ไม่ใช่ทั้งรุ่น — C ยังไม่ส่ง = 1 คน
    const missingAlert = mine(alertsO, "not_submitted");
    check("เจ้าหน้าที่เห็น 'ยังไม่ส่งผลสอบ 1 คน' (C) จากผู้ที่ต้องกรอก 3 คน", [missingAlert?.count, missingAlert?.title, /จากผู้ที่ต้องกรอกในรอบนี้ 3 คน/.test(missingAlert?.detail || "")], [1, "ยังไม่ส่งผลสอบ 1 คน", true]);
    check("ผู้บริหารเห็น 'ใกล้ปิดรับ' เหมือนกัน", !!mine(alertsE, "round_closing"), true);
    check("ผู้บริหารไม่เห็น 'ใบรอตรวจ' (ไม่มีสิทธิ์ตรวจ)", !!mine(alertsE, "pending_review"), false);
    check("ทุกแจ้งเตือนมีข้อความไทย ไม่มีคำเทคนิค", [...alertsO, ...alertsE].every((a) => /[ก-๙]/.test(a.title) && !/undefined|null|NaN/.test(`${a.title}${a.detail}`)), true);

    // ── remark ชนิดผิด/ยาวเกิน ตอนตรวจใบ (ใบของ A, B ยังรอตรวจอยู่ — เคสพวกนี้ต้องไม่ไปเปลี่ยนสถานะใบ) ──
    const patchReview = (r, action, body) => call("PATCH", `/api/exam-results/${r.json.data.result_id}/${action}`, { token: oToken, body });
    check("ตีกลับโดย remark เป็นตัวเลข -> 400 (ไม่ใช่ 500)", (await patchReview(sendA, "reject", { remark: 123 })).status, 400);
    check("ตีกลับโดย remark เป็น object -> 400", (await patchReview(sendA, "reject", { remark: { a: 1 } })).status, 400);
    check("ตีกลับโดย remark เป็น array -> 400", (await patchReview(sendA, "reject", { remark: ["x"] })).status, 400);
    check("ตีกลับโดย remark เป็น true -> 400", (await patchReview(sendA, "reject", { remark: true })).status, 400);
    const longReject = await patchReview(sendA, "reject", { remark: "ก".repeat(501) });
    check("ตีกลับโดย remark ยาว 501 ตัวอักษร -> 400 ข้อความไทย", [longReject.status, /500/.test(longReject.json.message || "")], [400, true]);
    check("ยืนยันโดย remark ยาว 501 ตัวอักษร -> 400", (await patchReview(sendA, "approve", { remark: "ก".repeat(501) })).status, 400);
    const stillPending = (await call("GET", `/api/exam-results?round_id=${roundId}`, { token: oToken })).json.data || [];
    check("ใบทั้ง 2 ยังรอตรวจอยู่ (เคสผิดทั้งหมดไม่เปลี่ยนสถานะ)", stillPending.map((x) => x.staff_status), ["pending", "pending"]);

    // ── รายงาน PDF รายรอบ (ใช้ฐานคนของรอบ roundTotal/roundNotStarted) ต้องออกไฟล์ได้ ──
    const pdfExport = await call("GET", `/api/dashboard/export?round_id=${roundId}`, { token: oToken });
    check("GET /dashboard/export ออก PDF ได้ -> 200 application/pdf", [pdfExport.status, /application\/pdf/.test(pdfExport.type)], [200, true]);

    // ── status ของรอบต้องเป็น open/closed เท่านั้น ──
    const badCreate = await call("POST", "/api/rounds", { token: oToken, body: { academic_year: YEAR, attempt_number: 9, open_date: "2020-01-01", close_date: "2099-12-31", status: "zzz" } });
    check("สร้างรอบด้วย status 'zzz' -> 400 ข้อความไทย", [badCreate.status, /[ก-๙]/.test(badCreate.json.message || "")], [400, true]);
    check("แก้รอบเป็น status 'zzz' -> 400", (await call("PUT", `/api/rounds/${roundId}`, { token: oToken, body: { status: "zzz" } })).status, 400);
    check("แก้รอบเป็น status ตัวเลข -> 400", (await call("PUT", `/api/rounds/${roundId}`, { token: oToken, body: { status: 1 } })).status, 400);
    const afterBad = (await call("GET", "/api/rounds", { token: oToken })).json.data || [];
    check("รอบ 9 ไม่ถูกสร้าง และรอบเดิมยังเปิดอยู่", [afterBad.some((r) => r.academic_year === YEAR && r.attempt_number === 9), afterBad.find((r) => r.round_id === roundId)?.status], [false, "open"]);

    // ════════ 3. รายชื่อผ่าน/ไม่ผ่านรายวิชา ════════
    console.log("\n── 3. รายชื่อผ่าน/ไม่ผ่านรายวิชา ──");
    const list = (qs, token = oToken) => call("GET", `/api/students/subject-result-list?${qs}`, { token });
    const idsOf = (r) => (r.json.data?.students || []).map((s) => s.student_id).sort();
    const before = await list(`subject_code=${s1.subject_code}&passed=true&round_id=${roundId}`);
    check("ก่อนมีใบที่ยืนยัน: รายชื่อว่าง (ใบรอตรวจยังไม่นับ)", [before.status, idsOf(before)], [200, []]);
    const approve = (r) => call("PATCH", `/api/exam-results/${r.json.data.result_id}/approve`, { token: oToken });
    await approve(sendA);
    await approve(sendB);
    const passed = await list(`subject_code=${s1.subject_code}&passed=true&round_id=${roundId}`);
    const failed = await list(`subject_code=${s1.subject_code}&passed=false&round_id=${roundId}`);
    check("ผ่านวิชา 1 = A เท่านั้น", idsOf(passed), [SID]);
    check("ไม่ผ่านวิชา 1 = B เท่านั้น", idsOf(failed), [SID2]);
    check("รวมทั้งปี (year) ได้ผลตรงกับรายรอบ", idsOf(await list(`subject_code=${s1.subject_code}&passed=true&year=${YEAR}`)), [SID]);
    check("ผลลัพธ์ไม่มีเลขบัตรประชาชน/รหัสผ่าน", /national_id|password/i.test(JSON.stringify(passed.json)), false);
    check("ไม่ระบุ passed -> 400", (await list(`subject_code=${s1.subject_code}&round_id=${roundId}`)).status, 400);
    check("ไม่ระบุรอบ/ปี -> 400", (await list(`subject_code=${s1.subject_code}&passed=true`)).status, 400);
    check("รหัสวิชาที่ไม่มี -> 404", (await list(`subject_code=ZZZ999&passed=true&round_id=${roundId}`)).status, 404);
    check("ผู้ช่วยตรวจ/ผู้บริหารเรียกไม่ได้ -> 403", [(await list(`subject_code=${s1.subject_code}&passed=true&round_id=${roundId}`, tokens.reviewer)).status, (await list(`subject_code=${s1.subject_code}&passed=true&round_id=${roundId}`, tokens.executive)).status], [403, 403]);

    // ════════ 4. ค่าแปลกใน URL ต้องไม่ 500 ════════
    console.log("\n── 4. ค่าแปลกใน URL / query ──");
    const weird = [
      ["GET", `/api/students/subject-result-list?subject_code=${s1.subject_code}&passed=true&year=abc`],
      ["GET", `/api/students/subject-result-list?subject_code=${s1.subject_code}&passed=true&round_id=abc`],
      ["GET", "/api/dashboard/stats?round_id=abc"],
      ["GET", "/api/dashboard/stats?round_id=-1"],
      ["GET", "/api/dashboard/stats?round_id=1.5"],
      ["GET", "/api/dashboard/history?years=abc"],
      ["GET", "/api/dashboard/history?years=-5"],
      ["GET", "/api/dashboard/export?round_id=abc"],
      ["GET", "/api/dashboard/export-first-year?year=abc&passed=true"],
      ["GET", "/api/dashboard/export-first-attempt?year=abc&passed=true"],
      ["PUT", "/api/rounds/abc"],
      ["DELETE", "/api/rounds/abc"],
      ["POST", "/api/users/abc/role"],
      ["DELETE", "/api/users/abc"],
      ["PATCH", "/api/exam-results/abc/approve"],
      ["PATCH", "/api/exam-results/abc/reject"],
      ["GET", "/api/exam-results?round_id=abc"],
      ["GET", "/api/exam-results?student_id=%00"],
      ["GET", "/api/certificates/abc/file"],
      ["GET", "/api/news/abc/image"],
      ["PUT", "/api/news/abc"],
      ["DELETE", "/api/subjects/abc"],
      ["PUT", "/api/subjects/abc"],
      ["GET", "/api/students/%20"],
      ["DELETE", "/api/students/%20"],
    ];
    const fiveHundreds = [];
    for (const [method, url] of weird) {
      const r = await call(method, url, { token: oToken, body: method === "GET" || method === "DELETE" ? undefined : {} });
      if (r.status >= 500) fiveHundreds.push(`${method} ${url} -> ${r.status} ${r.json?.message ?? ""}`);
    }
    check(`ค่าแปลก ${weird.length} แบบ ไม่มีเส้นไหนตอบ 5xx`, fiveHundreds, []);

    // อักขระ NUL ใน query ของ API ที่ค้นด้วย student_id — Postgres เก็บไม่ได้ ต้องเป็น 400 ไม่ใช่ 500
    check("GET /exam-results?student_id=%00 -> 400", (await call("GET", "/api/exam-results?student_id=%00", { token: oToken })).status, 400);

    // หน้า login เปิดให้ทุกคน (ไม่ต้องมี token) — ค่าแปลกใน body ต้องได้ 400/401 ไม่ใช่ 500
    const loginProbes = [
      ["รหัสมีอักขระ NUL", { psu_passport_id: "\u0000", password: "x" }],
      ["รหัสเป็น object (พยายามฉีด query)", { psu_passport_id: { not: "" }, password: "x" }],
      ["รหัสเป็นตัวเลข", { psu_passport_id: 456, password: 456 }],
      ["รหัสยาว 10,000 ตัวอักษร", { psu_passport_id: "9".repeat(10000), password: "x" }],
      ["รหัสผ่านเป็น array", { psu_passport_id: "456", password: ["456"] }],
      ["ไม่มี body", {}],
    ];
    const loginBad = [];
    for (const [label, body] of loginProbes) {
      const r = await call("POST", "/api/auth/login", { body });
      if (![400, 401, 429].includes(r.status) || r.cookie) loginBad.push(`${label} -> ${r.status}${r.cookie ? " (ได้ cookie!)" : ""}`);
    }
    check("login ด้วยค่าแปลก ได้ 400/401 เท่านั้น ไม่ 500 ไม่ได้ cookie", loginBad, []);
    const nulLogin = await call("POST", "/api/auth/login", { body: { psu_passport_id: "\u0000", password: "x" } });
    check("login ด้วยรหัสที่เป็นอักขระ NUL -> 400 หรือ 401 (ไม่ใช่ 500)", [400, 401].includes(nulLogin.status), true);
  } finally {
    await cleanupYears([YEAR]);
    for (const id of parked) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "open" } });
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error(e); process.exit(1); });
