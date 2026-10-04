// เทสรอบที่ 3 ของการตรวจระบบ (4 ต.ค. 2569) — พิสูจน์ทุกข้อที่แก้ใน backend รอบนี้
//
//   A. ผู้ตรวจยืนยัน "เวอร์ชันที่เห็น" — นักศึกษาส่งใหม่/ลบไฟล์ระหว่างตรวจ ต้องได้ 409 และใบยังรอตรวจ
//   B. กดยืนยันพร้อมกับลบไฟล์ (ยิงขนานหลายรอบ) — ต้องไม่มีทาง "ยืนยันแล้วแต่ไฟล์ที่ผู้ตรวจเห็นหาย"
//   C. คนที่ถูกปิดสิทธิ์แนบไฟล์ไม่ได้
//   D. รอบร่าง (ปิดอยู่ ยังไม่มีใบ) ต้องไม่บังสิทธิ์แก้ใบที่ถูกตีกลับของรอบก่อน
//   E. ผ่อนผัน 15 นาทีหลังปิดรอบ: แนบไฟล์เพิ่มได้ (ใบที่ส่งทันเวลา) แต่ลบไฟล์ไม่ได้
//   F. ลบวิชา / แก้รายวิชาของรอบที่มีผลสอบ / รหัสวิชาที่มีเลข 22021 / ปีและครั้งที่ผิดรูปแบบ / รหัสนักศึกษายาวเกิน
//   G. อักขระ NUL ต้องได้ 400 พอดี
//
// ปีทดสอบ 2593 (cleanupYears ล้างให้ตอนจบ — ห้ามใช้ปีจริง)
import { cleanupYears } from "./cleanupYears.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
let failures = 0;

const call = async (method, url, { token, body, form } = {}) => {
  const headers = {};
  if (token) headers.Cookie = token;
  let payload;
  if (form) {
    payload = form; // multipart: ให้ fetch ใส่ Content-Type + boundary เอง
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${url}`, { method, headers, body: payload });
  const json = await res.json().catch(() => ({}));
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, json, cookie: setCookie ? setCookie.split(";")[0] : null };
};

const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const YEAR = 2593;
const PREFIX = String(YEAR - 4).slice(-2);
const STAMP = Date.now().toString().slice(-6);
const nid = (i) => `1${STAMP}0000${i}`.slice(0, 13).padEnd(13, "0");
const NOW = { open_date: "2020-01-01", close_date: "2099-12-31" };

// ไฟล์ PDF เล็กๆ ที่ผ่านด่านตรวจหัวไฟล์ (%PDF)
const pdfForm = (name) => {
  const fd = new FormData();
  fd.append("file", new Blob([Buffer.from("%PDF-1.4\n%phase31 test\n%%EOF\n")], { type: "application/pdf" }), name);
  fd.append("certificate_type", "exam_result");
  return fd;
};

const main = async () => {
  const login = async (u, p) => (await call("POST", "/api/auth/login", { body: { psu_passport_id: u, password: p } })).cookie;
  const oToken = await login("456", "456");
  if (!oToken) { console.log("login seed officer failed"); process.exit(1); }

  // ปิดรอบที่เปิดค้างอยู่ชั่วคราว (ระบบเปิดได้ทีละรอบ) แล้วคืนตอนจบ
  const parked = ((await call("GET", "/api/rounds", { token: oToken })).json.data || []).filter((r) => r.status === "open").map((r) => r.round_id);
  for (const id of parked) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });

  const createdSubjectIds = [];
  try {
    const rooms = (await call("GET", "/api/rooms", { token: oToken })).json.data;
    const subjects = (await call("GET", "/api/subjects", { token: oToken })).json.data;
    const [s1, s2, s3] = subjects.slice(0, 3);
    const subjectIds = [s1.subject_id, s2.subject_id, s3.subject_id];

    // ── นักศึกษา ──
    const NAMES = ["V1", "V2", "V3", "V4", "V5", "E", "R", "G"];
    const ID = {};
    const tokens = {};
    for (let i = 0; i < NAMES.length; i++) {
      const who = NAMES[i];
      ID[who] = `${PREFIX}${STAMP}0${i + 1}`;
      await call("POST", "/api/students", { token: oToken, body: { student_id: ID[who], national_id: nid(i + 1) } });
      const l = await call("POST", "/api/auth/login", { body: { psu_passport_id: ID[who], password: nid(i + 1) } });
      await call("POST", "/api/students/complete-profile", {
        token: l.cookie,
        body: { first_name: `ทดสอบ${who}`, last_name: "รอบสาม", first_name_en: `Test${who}`, last_name_en: "Three", email: `${ID[who]}@test.local`, phone: "0812345678", room_id: rooms[0].room_id },
      });
      tokens[who] = l.cookie;
    }

    const setRound = (id, body) => call("PUT", `/api/rounds/${id}`, { token: oToken, body });
    const send = (who, answers) => call("POST", "/api/exam-results", {
      token: tokens[who],
      body: { subject_results: answers.map(([s, p]) => ({ subject_id: s.subject_id, is_passed: p })) },
    });
    const upload = (who, resultId, name = "ใบคะแนน.pdf") => call("POST", `/api/exam-results/${resultId}/certificates`, { token: tokens[who], form: pdfForm(name) });
    // ใบของนักศึกษาคนนี้ตามที่เจ้าหน้าที่เห็น (ใบเดียวในรอบ)
    const officerView = async (who) => {
      const list = (await call("GET", `/api/exam-results?student_id=${ID[who]}`, { token: oToken })).json.data || [];
      return list[list.length - 1];
    };
    const ids = (paper) => (paper?.certificates || []).map((c) => c.certificate_id).sort((a, b) => a - b);
    const approve = (resultId, body) => call("PATCH", `/api/exam-results/${resultId}/approve`, { token: oToken, body });
    const reject = (resultId, body) => call("PATCH", `/api/exam-results/${resultId}/reject`, { token: oToken, body });
    const passAll = [[s1, true], [s2, true], [s3, true]];

    // ════════ รอบ 1 (เปิดอยู่) ════════
    console.log("\n── A. ยืนยัน 'เวอร์ชันที่เห็น' ──");
    const r1 = await call("POST", "/api/rounds", { token: oToken, body: { academic_year: YEAR, attempt_number: 1, ...NOW, subject_ids: subjectIds } });
    const round1 = r1.json.data.round_id;
    await setRound(round1, { status: "open" });

    // A1: นักศึกษาส่งใหม่หลังผู้ตรวจเปิดดู
    const a1 = await send("V1", passAll);
    check("V1 ส่งผลรอบ 1 -> 200", a1.status, 200);
    const a1Result = a1.json.data.result_id;
    check("V1 แนบไฟล์ -> 200", (await upload("V1", a1Result)).status, 200);
    const seenA1 = await officerView("V1");
    const oldSubmittedAt = seenA1.submitted_at;
    await sleep(15); // ให้ submitted_at ใหม่ต่างจากเก่าแน่ๆ
    check("V1 ส่งทับ (ตกวิชา 3) -> 200", (await send("V1", [[s1, true], [s2, true], [s3, false]])).status, 200);
    const approveStale = await approve(a1Result, { expected_submitted_at: oldSubmittedAt, expected_certificate_ids: ids(seenA1) });
    check("ยืนยันด้วยเวอร์ชันเก่า (นักศึกษาส่งทับไปแล้ว) -> 409", approveStale.status, 409);
    check("  ข้อความบอกให้โหลดหน้าใหม่", /โหลดหน้าใหม่/.test(approveStale.json.message || ""), true);
    check("  ใบยังรอตรวจ (ไม่ถูกยืนยัน)", (await officerView("V1")).staff_status, "pending");
    // รูปแบบ expected_* ผิด -> 400
    check("expected_submitted_at ไม่ใช่เวลา -> 400", (await approve(a1Result, { expected_submitted_at: "nope" })).status, 400);
    check("expected_certificate_ids ไม่ใช่ array -> 400", (await approve(a1Result, { expected_certificate_ids: "x" })).status, 400);
    check("expected_certificate_ids มีค่าไม่ใช่เลข -> 400", (await approve(a1Result, { expected_certificate_ids: ["abc"] })).status, 400);
    check("  ใบยังรอตรวจหลังส่งค่าผิดรูปแบบ", (await officerView("V1")).staff_status, "pending");
    // ใช้เวอร์ชันล่าสุด -> ผ่าน
    const freshA1 = await officerView("V1");
    check("ยืนยันด้วยเวอร์ชันล่าสุด -> 200", (await approve(a1Result, { expected_submitted_at: freshA1.submitted_at, expected_certificate_ids: ids(freshA1) })).status, 200);

    // A2: นักศึกษาลบไฟล์หลังผู้ตรวจเปิดดู
    const a2 = await send("V2", passAll);
    const a2Result = a2.json.data.result_id;
    const a2Up = await upload("V2", a2Result);
    const seenA2 = await officerView("V2");
    check("V2 มีไฟล์ 1 ไฟล์ที่ผู้ตรวจเห็น", ids(seenA2).length, 1);
    check("V2 ลบไฟล์ -> 200", (await call("DELETE", `/api/certificates/${a2Up.json.data.certificate_id}`, { token: tokens.V2 })).status, 200);
    const approveNoFile = await approve(a2Result, { expected_submitted_at: seenA2.submitted_at, expected_certificate_ids: ids(seenA2) });
    check("ยืนยันทั้งที่ไฟล์ที่ผู้ตรวจเห็นถูกลบไปแล้ว -> 409", approveNoFile.status, 409);
    check("  ใบยังรอตรวจ", (await officerView("V2")).staff_status, "pending");
    check("ตีกลับด้วยเวอร์ชันเก่าก็ 409 เหมือนกัน", (await reject(a2Result, { remark: "ทดสอบ", expected_certificate_ids: ids(seenA2) })).status, 409);
    check("ไม่ส่ง expected_* ยังยืนยันได้แบบเดิม (เข้ากันได้ย้อนหลัง) -> 200", (await approve(a2Result, {})).status, 200);

    console.log("\n── B. ยืนยันพร้อมกับลบไฟล์ (ขนาน) ──");
    for (const who of ["V3", "V4", "V5"]) {
      const sent = await send(who, passAll);
      const resultId = sent.json.data.result_id;
      const up = await upload(who, resultId);
      const seen = await officerView(who);
      const [approved, deleted] = await Promise.all([
        approve(resultId, { expected_submitted_at: seen.submitted_at, expected_certificate_ids: ids(seen) }),
        call("DELETE", `/api/certificates/${up.json.data.certificate_id}`, { token: tokens[who] }),
      ]);
      const after = await officerView(who);
      const fileLeft = ids(after).length;
      // ต้องเป็นอย่างใดอย่างหนึ่งเท่านั้น: ยืนยันสำเร็จ (ไฟล์ต้องยังอยู่ ลบถูกปฏิเสธ) หรือลบสำเร็จ (ยืนยันต้องถูกปฏิเสธ)
      const consistent =
        (approved.status === 200 && deleted.status === 409 && fileLeft === 1 && after.staff_status === "approved") ||
        (deleted.status === 200 && approved.status === 409 && fileLeft === 0 && after.staff_status === "pending");
      check(`${who}: ผลลัพธ์สอดคล้อง ไม่มี "ยืนยันแล้วแต่ไฟล์หาย"`, consistent, true);
      if (!consistent) console.log("    ", { approved: approved.status, deleted: deleted.status, fileLeft, status: after.staff_status });
    }

    console.log("\n── C. ปิดสิทธิ์แล้วแนบไฟล์ไม่ได้ ──");
    const e = await send("E", passAll);
    check("E ส่งผลรอบ 1 -> 200", e.status, 200);
    await call("PATCH", "/api/students/bulk-eligible", { token: oToken, body: { student_ids: [ID.E], exam_eligible: false } });
    check("E ถูกปิดสิทธิ์ แนบไฟล์ -> 403", (await upload("E", e.json.data.result_id)).status, 403);

    // ใบที่จะถูกตีกลับ (ใช้ในข้อ D) — ส่งตอนรอบ 1 ยังเปิดอยู่
    const rr = await send("R", [[s1, false], [s2, false], [s3, false]]);
    await upload("R", rr.json.data.result_id, "ใบเดิม.pdf");
    const seenR = await officerView("R");
    check("ตีกลับใบของ R (เวอร์ชันที่เห็นตรง) -> 200", (await reject(rr.json.data.result_id, { remark: "ทดสอบ", expected_submitted_at: seenR.submitted_at, expected_certificate_ids: ids(seenR) })).status, 200);

    console.log("\n── D. รอบร่างไม่บังสิทธิ์แก้ใบที่ถูกตีกลับ ──");
    await setRound(round1, { status: "closed" });
    const activeBefore = (await call("GET", "/api/rounds/active", { token: tokens.R })).json.data;
    check("ปิดรอบ 1 แล้ว: R แก้ใบที่ถูกตีกลับได้ (can_fix_rejected)", activeBefore?.can_fix_rejected, true);
    const r2 = await call("POST", "/api/rounds", { token: oToken, body: { academic_year: YEAR, attempt_number: 2, ...NOW, subject_ids: subjectIds } });
    check("สร้างรอบ 2 เป็นร่าง (ปิดอยู่) -> 200", [r2.status, r2.json.data.status], [200, "closed"]);
    const round2 = r2.json.data.round_id;
    const activeDraft = (await call("GET", "/api/rounds/active", { token: tokens.R })).json.data;
    check("มีรอบ 2 ร่างอยู่ R ยังแก้ใบที่ถูกตีกลับได้", activeDraft?.can_fix_rejected, true);
    const fixDraft = await send("R", [[s1, true], [s2, true], [s3, true]]);
    check("R ส่งแก้ใบที่ถูกตีกลับ (ทั้งที่มีรอบ 2 ร่าง) -> 200", fixDraft.status, 200);

    console.log("\n── E. ผ่อนผัน 15 นาทีหลังปิดรอบ (แนบเพิ่มได้ ลบไม่ได้) ──");
    // รอบ 2 ปิดรับที่ "นาทีปัจจุบัน" (เวลาไทย) → หมดเวลาตอน HH:mm:59.999 — เลี่ยงช่วงท้ายนาทีกันเลยเวลาก่อนทันส่ง
    const ictNow = () => new Date(Date.now() + 7 * 3600 * 1000);
    if (ictNow().getUTCSeconds() > 50) await sleep((61 - ictNow().getUTCSeconds()) * 1000);
    const closeMinute = ictNow().toISOString().slice(0, 16); // "2026-10-04T14:25"
    const openRound2 = await setRound(round2, { status: "open", close_date: closeMinute });
    check("เปิดรอบ 2 ปิดรับที่นาทีนี้ -> 200", openRound2.status, 200);
    const g = await send("G", passAll);
    check("G ส่งผลทันเวลา -> 200", g.status, 200);
    const gResult = g.json.data.result_id;
    // รอจนเลยเวลาปิด
    const closeMs = new Date(openRound2.json.data.close_date).getTime();
    const waitMs = Math.max(0, closeMs - Date.now()) + 1500; // +1.5 วินาทีกันเลยเวลาปิดแบบเฉียดฉิว
    console.log(`    (รอ ${Math.round(waitMs / 1000)} วินาทีให้เลยเวลาปิดรอบ)`);
    await sleep(waitMs);
    const lateSend = await send("G", [[s1, true], [s2, true], [s3, false]]);
    check("รอบปิดแล้ว ส่งผลซ้ำไม่ได้ (ผ่อนผันเฉพาะแนบไฟล์) -> 400", lateSend.status, 400);
    const lateUpload = await upload("G", gResult, "แนบช้า.pdf");
    check("เลยเวลาปิด แต่ใบส่งทันเวลา แนบไฟล์เพิ่ม -> 200 (ผ่อนผัน)", lateUpload.status, 200);
    check("ลบไฟล์ในช่วงผ่อนผัน -> 409 (ผ่อนผันเฉพาะแนบ)", (await call("DELETE", `/api/certificates/${lateUpload.json.data.certificate_id}`, { token: tokens.G })).status, 409);
    const graceView = await officerView("G");
    check("  ไฟล์ที่แนบช่วงผ่อนผันอยู่ในใบ และใบยังรอตรวจ", [ids(graceView).length, graceView.staff_status], [1, "pending"]);

    console.log("\n── F. รายวิชา / รอบ / รหัสนักศึกษา ──");
    // รหัสวิชาที่มีเลข 22021 — ข้อความ "ซ้ำ" ต้องไม่ถูก errorHandler เขียนทับเป็น "ข้อมูลไม่ถูกต้อง"
    const codeA = await call("POST", "/api/subjects", { token: oToken, body: { subject_code: "NUR22021", subject_name: "ทดสอบรหัสมีเลข 22021" } });
    if (codeA.json.data?.subject_id) createdSubjectIds.push(codeA.json.data.subject_id);
    check("สร้างวิชารหัส NUR22021 -> 200", codeA.status, 200);
    const codeB = await call("POST", "/api/subjects", { token: oToken, body: { subject_code: "NUR22021", subject_name: "ซ้ำ" } });
    check("สร้างซ้ำ -> 409", codeB.status, 409);
    check("  ข้อความยังเป็นของเรา (รหัสวิชา NUR22021 ...) ไม่ถูกเขียนทับ", /NUR22021/.test(codeB.json.message || ""), true);
    // วิชาที่มีผลสอบแล้ว ลบไม่ได้ ต้องไม่ใช่ 500
    const delUsed = await call("DELETE", `/api/subjects/${s1.subject_id}`, { token: oToken });
    check("ลบวิชาที่มีรอบ/ผลสอบใช้อยู่ -> 409 (ไม่ใช่ 500)", delUsed.status, 409);
    // วิชาที่ไม่มีใครใช้ ลบได้
    check("ลบวิชาที่ไม่มีใครใช้ -> 200", (await call("DELETE", `/api/subjects/${codeA.json.data.subject_id}`, { token: oToken })).status, 200);

    // แก้รายวิชาของรอบที่มีผลสอบแล้ว
    check("แก้ subject_ids ของรอบ 1 (มีผลสอบแล้ว) เป็นชุดอื่น -> 409", (await setRound(round1, { subject_ids: [s1.subject_id, s2.subject_id] })).status, 409);
    check("ส่ง subject_ids ชุดเดิมกลับมา (ไม่ได้เปลี่ยน) -> 200", (await setRound(round1, { subject_ids: subjectIds })).status, 200);
    check("แก้วันปิดของรอบที่มีผลสอบแล้วยังทำได้ -> 200", (await setRound(round1, { close_date: "2099-11-30" })).status, 200);

    // เปิดรอบเก่า (รอบ 1) ซ้ำ ทั้งที่รอบ 2 มีใบแล้ว
    await setRound(round2, { status: "closed" });
    const reopen = await setRound(round1, { status: "open" });
    check("รอบ 2 มีผลสอบแล้ว เปิดรอบ 1 ซ้ำ -> 409", reopen.status, 409);
    check("  ข้อความไทยบอกเหตุผล", /ใหม่กว่า/.test(reopen.json.message || ""), true);

    // ปี / ครั้งที่ / status ผิดรูปแบบ
    const bad = (extra) => call("POST", "/api/rounds", { token: oToken, body: { academic_year: YEAR, attempt_number: 7, ...NOW, ...extra } });
    const zero = await bad({ attempt_number: 0 });
    check("attempt_number = 0 -> 400", zero.status, 400);
    check("  ข้อความไม่ใช่ 'กรอกไม่ครบ' (บอกสาเหตุที่ถูก)", /ครบ/.test(zero.json.message || ""), false);
    check("attempt_number = -1 -> 400", (await bad({ attempt_number: -1 })).status, 400);
    check("ปีทศนิยม 2593.5 -> 400", (await bad({ academic_year: 2593.5 })).status, 400);
    check("ปีนอกช่วง 99 -> 400", (await bad({ academic_year: 99 })).status, 400);
    check("ปีเป็นข้อความ 'abc' -> 400", (await bad({ academic_year: "abc" })).status, 400);
    check("ปีเป็นข้อความตัวเลข '2593' ยังรับ (หน้าเว็บส่งแบบนี้) แต่ครั้งที่ซ้ำ -> 400", (await bad({ academic_year: "2593", attempt_number: "1" })).status, 400);

    // รหัสนักศึกษายาวเกิน 20 หลัก
    const longId = "9".repeat(21);
    check("รหัสนักศึกษา 21 หลัก -> 400", (await call("POST", "/api/students", { token: oToken, body: { student_id: longId, national_id: nid(9) } })).status, 400);

    console.log("\n── G. อักขระ NUL ──");
    check("login ด้วยอักขระ NUL -> 400 พอดี", (await call("POST", "/api/auth/login", { body: { psu_passport_id: "\u0000", password: "x" } })).status, 400);
    check("GET /exam-results?student_id=%00 -> 400 พอดี", (await call("GET", "/api/exam-results?student_id=%00", { token: oToken })).status, 400);
  } finally {
    for (const id of createdSubjectIds) await call("DELETE", `/api/subjects/${id}`, { token: oToken });
    await cleanupYears([YEAR]);
    for (const id of parked) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "open" } });
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error(e); process.exit(1); });
