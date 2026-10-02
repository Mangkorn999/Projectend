// เทสตาม flow จริงของคณะ (docs/test-plan.md) — เน้นกรณีที่มีโอกาสเกิดจริงและยังไม่มีเทส
//
// ตัวละครของรุ่น 2594 (รหัสขึ้นต้น 90):
//   A  รอบ 1 ผ่านครบ + แนบหลายไฟล์ (PDF + รูป)      → ผ่านครั้งแรก
//   B  รอบ 1 ผ่าน 1/3 → ตรวจหลังปิดรอบ → รอบ 2 ผ่านที่เหลือ → ผ่านภายในปีแรก
//   C  รอบ 1 ผ่านครบ แต่ถูกตีกลับ "หลังปิดรอบ" → แก้ส่งใหม่ได้ → ยืนยัน → ผ่านครั้งแรก
//   D  ไม่ส่งเลยทั้งปี                               → ไม่ผ่าน
//   E  รอบ 1 ผ่าน 1/3 (ยังรอตรวจ) → รอบ 2 เปิดก่อนตรวจเสร็จ → วิชาที่ 1 ถูกยกมาเป็นผ่าน
//      → ภายหลังใบรอบ 1 ถูกตีกลับ → ต้อง "ไม่" นับว่าผ่านวิชาที่ 1 (บั๊ก B1)
//   F  มาส่งช้า หลังปิดรอบ                          → ส่งไม่ได้
// ตัวเลขที่ต้องได้: ผ่านครั้งแรก 2/6 (A, C) · ผ่านภายในปีแรก 3/6 (A, B, C)
import readXlsxFile from "read-excel-file/node";
import { cleanupYears } from "./cleanupYears.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
let failures = 0;

// ── ตัวช่วยยิง API ───────────────────────────────────────────
const call = async (method, url, { token, body, form } = {}) => {
  const headers = {};
  if (token) headers.Cookie = token;
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${url}`, { method, headers, body: payload });
  const type = res.headers.get("content-type") || "";
  let json = {};
  let buffer = null;
  if (/spreadsheetml|pdf|image\//.test(type)) {
    buffer = Buffer.from(await res.arrayBuffer());
  } else {
    json = await res.json().catch(() => ({}));
  }
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, json, buffer, type, cookie: setCookie ? setCookie.split(";")[0] : null };
};

const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
};

// ── ไฟล์ทดสอบ (สร้างในหน่วยความจำ ไม่ต้องมีไฟล์จริงบนดิสก์) ──────────
// ระบบตรวจ "หัวไฟล์" จริง ไม่เชื่อนามสกุล — จึงต้องมีหัวไฟล์ถูกต้องตามชนิด
const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");
const PNG_BYTES = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const JPG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const GIF_BYTES = Buffer.from("GIF89a" + "0".repeat(20));
const TEXT_BYTES = Buffer.from("this is not an image");

const fileForm = (bytes, mime, name) => {
  const fd = new FormData();
  fd.append("file", new Blob([bytes], { type: mime }), name);
  fd.append("certificate_type", "exam_result");
  return fd;
};

// ── ข้อมูลทดสอบ ───────────────────────────────────────────────
const YEAR = 2594;
const PREFIX = String(YEAR - 4).slice(-2);
const STAMP = Date.now().toString().slice(-6);
const sid = (n) => `${PREFIX}${STAMP}0${n}`;
const nid = (n) => `1${STAMP}0000${n}`.slice(0, 13).padEnd(13, "0");
const NAMES = ["A", "B", "C", "D", "E", "F"];
const ID = {};
for (let i = 0; i < NAMES.length; i++) ID[NAMES[i]] = sid(i + 1);

let parkedRounds = [];

const main = async () => {
  const login = async (u, p) => (await call("POST", "/api/auth/login", { body: { psu_passport_id: u, password: p } })).cookie;
  const oToken = await login("456", "456");
  const rToken = await login("321", "321"); // ผู้ช่วยตรวจสอบ (reviewer)
  const eToken = await login("789", "789"); // ผู้บริหาร
  check("login เจ้าหน้าที่ / ผู้ช่วยตรวจ / ผู้บริหาร", [!!oToken, !!rToken, !!eToken], [true, true, true]);

  // C11: เซสชันหมดอายุ/cookie เสียระหว่างใช้งาน → ต้องได้ 401 + code ที่หน้าเว็บใช้พากลับหน้าเข้าสู่ระบบ
  const expired = await call("GET", "/api/exam-results/me", { token: "token=expired.invalid.token" });
  check("เซสชันหมดอายุ -> 401 + code auth_required", [expired.status, expired.json.code], [401, "auth_required"]);
  check("  ข้อความเป็นภาษาไทย", /[ก-๙]/.test(expired.json.message || ""), true);
  const wrongPass = await call("POST", "/api/auth/login", { body: { psu_passport_id: "456", password: "ผิด" } });
  check("รหัสผ่านผิด -> 401 ไม่มี code (หน้าเว็บต้องไม่รีโหลดทิ้งข้อความ)", [wrongPass.status, wrongPass.json.code ?? null], [401, null]);

  try {
    const rooms = (await call("GET", "/api/rooms", { token: oToken })).json.data;
    const subjects = (await call("GET", "/api/subjects", { token: oToken })).json.data;
    const [s1, s2, s3] = subjects.slice(0, 3);
    const subjectIds = [s1.subject_id, s2.subject_id, s3.subject_id];

    // ════════ เตรียม: เจ้าหน้าที่เพิ่มนักศึกษา 6 คน → นักศึกษากรอกโปรไฟล์ ════════
    const tokens = {};
    for (let i = 0; i < NAMES.length; i++) {
      const who = NAMES[i];
      await call("POST", "/api/students", { token: oToken, body: { student_id: ID[who], national_id: nid(i + 1) } });
      const l = await call("POST", "/api/auth/login", { body: { psu_passport_id: ID[who], password: nid(i + 1) } });
      await call("POST", "/api/students/complete-profile", {
        token: l.cookie,
        body: {
          first_name: `ทดสอบ${who}`, last_name: "จริง", first_name_en: `Test${who}`, last_name_en: "Real",
          email: `${ID[who]}@test.local`, phone: "0812345678", room_id: rooms[0].room_id,
        },
      });
      tokens[who] = l.cookie;
    }
    await call("PATCH", "/api/students/bulk-eligible", { token: oToken, body: { student_ids: Object.values(ID), exam_eligible: true } });

    // ปิดรอบจริงที่เปิดค้างไว้ชั่วคราว (เปิดคืนตอนจบ)
    const existingRounds = (await call("GET", "/api/rounds", { token: oToken })).json.data || [];
    for (const r of existingRounds) {
      if (r.status === "open") parkedRounds.push(r.round_id);
    }
    for (const id of parkedRounds) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });

    const setRound = (roundId, body) => call("PUT", `/api/rounds/${roundId}`, { token: oToken, body });
    const send = (who, answers) => call("POST", "/api/exam-results", {
      token: tokens[who],
      body: { subject_results: answers.map(([subject, passed]) => ({ subject_id: subject.subject_id, is_passed: passed })) },
    });
    const upload = (who, resultId, bytes, mime, name) =>
      call("POST", `/api/exam-results/${resultId}/certificates`, { token: tokens[who], form: fileForm(bytes, mime, name) });
    const myPapers = async (who) => (await call("GET", "/api/exam-results/me", { token: tokens[who] })).json.data || [];
    const active = async (who) => (await call("GET", "/api/rounds/active", { token: tokens[who] })).json.data;
    const approve = (resultId, token = oToken) => call("PATCH", `/api/exam-results/${resultId}/approve`, { token });
    const reject = (resultId, remark) => call("PATCH", `/api/exam-results/${resultId}/reject`, { token: oToken, body: { remark } });

    // ════════ B1: สร้างรอบล่วงหน้า + โพสต์ประกาศก่อนเปิดรับ ════════
    console.log("\n── สร้างรอบล่วงหน้า + ประกาศ ──");
    const r1 = await call("POST", "/api/rounds", {
      token: oToken,
      body: { academic_year: YEAR, attempt_number: 1, open_date: "2099-01-01", close_date: "2099-12-31", subject_ids: subjectIds },
    });
    const round1 = r1.json.data.round_id;
    check("เปิดรอบ 1 ล่วงหน้า (วันเปิดยังไม่ถึง) -> 200", (await setRound(round1, { status: "open" })).status, 200);
    const news1 = await call("POST", "/api/news", { token: oToken, body: { title: "เปิดรับผลสอบรอบที่ 1", content: "รายละเอียด", round_id: round1 } });
    check("โพสต์ประกาศก่อนถึงวันเปิดรับ -> 201", news1.status, 201);
    const studentNews = (await call("GET", "/api/news", { token: tokens.A })).json.data || [];
    check("นักศึกษาเห็นประกาศทันที", studentNews.some((n) => n.title === "เปิดรับผลสอบรอบที่ 1"), true);
    check("หน้ากรอกบอกว่ายังไม่ถึงวันเปิด (phase scheduled)", (await active("A"))?.phase, "scheduled");
    check("ส่งผลก่อนถึงวันเปิด -> 400", (await send("A", [[s1, true], [s2, true], [s3, true]])).status, 400);
    check("เลื่อนวันเปิดเป็นวันนี้ -> 200", (await setRound(round1, { open_date: "2020-01-01" })).status, 200);
    check("ตอนนี้กรอกได้ (phase active)", (await active("A"))?.phase, "active");

    // ════════ C3/C4: แนบหลายไฟล์ PDF + รูปภาพ ════════
    console.log("\n── แนบหลายไฟล์ ──");
    const pA = await send("A", [[s1, true], [s2, true], [s3, true]]);
    const resultA = pA.json.data.result_id;
    check("A ส่งผลรอบ 1 -> 200", pA.status, 200);
    check("แนบ PDF -> 200", (await upload("A", resultA, PDF_BYTES, "application/pdf", "ใบคะแนน.pdf")).status, 200);
    check("แนบรูป JPG -> 200", (await upload("A", resultA, JPG_BYTES, "image/jpeg", "ถ่ายรูป.jpg")).status, 200);
    const pngUp = await upload("A", resultA, PNG_BYTES, "image/png", "สแกน.png");
    check("แนบรูป PNG -> 200", pngUp.status, 200);
    check("ไฟล์เก่าไม่ถูกแทนที่ (มี 3 ไฟล์)", (await myPapers("A"))[0]?.certificates?.length, 3);
    const gif = await upload("A", resultA, GIF_BYTES, "image/gif", "a.gif");
    check("แนบ GIF -> 400 (รับเฉพาะ PDF/JPG/PNG)", gif.status, 400);
    const fake = await upload("A", resultA, TEXT_BYTES, "image/jpeg", "fake.jpg");
    check("ไฟล์ปลอม (บอกว่า JPG แต่เนื้อไม่ใช่) -> 400", fake.status, 400);
    check("  ข้อความเป็นภาษาไทย ไม่มีชื่อ field เทคนิค", /[ก-๙]/.test(fake.json.message || "") && !/certificate_type|field/.test(fake.json.message || ""), true);
    await upload("A", resultA, PDF_BYTES, "application/pdf", "4.pdf");
    await upload("A", resultA, PDF_BYTES, "application/pdf", "5.pdf");
    const sixth = await upload("A", resultA, PDF_BYTES, "application/pdf", "6.pdf");
    check("แนบไฟล์ที่ 6 -> 400 (สูงสุด 5 ไฟล์)", sixth.status, 400);

    const aFiles = (await myPapers("A"))[0].certificates;
    const pngCert = aFiles.find((f) => f.file_name === "สแกน.png");
    check("พบไฟล์ PNG ที่แนบไว้", !!pngCert, true);
    if (pngCert) {
      const opened = await call("GET", `/api/certificates/${pngCert.certificate_id}/file`, { token: rToken });
      check("ผู้ช่วยตรวจเปิดรูป PNG ได้ (ชนิดไฟล์ถูกต้อง)", [opened.status, opened.type], [200, "image/png"]);
      check("ผู้บริหารเปิดไฟล์หลักฐานไม่ได้ -> 403", (await call("GET", `/api/certificates/${pngCert.certificate_id}/file`, { token: eToken })).status, 403);
      check("นักศึกษาคนอื่นลบไฟล์ของ A ไม่ได้ -> 403", (await call("DELETE", `/api/certificates/${pngCert.certificate_id}`, { token: tokens.B })).status, 403);
      check("ผู้ช่วยตรวจลบไฟล์ของนักศึกษาไม่ได้ -> 403", (await call("DELETE", `/api/certificates/${pngCert.certificate_id}`, { token: rToken })).status, 403);
      check("A ลบไฟล์ของตัวเองได้ -> 200", (await call("DELETE", `/api/certificates/${pngCert.certificate_id}`, { token: tokens.A })).status, 200);
      check("  เหลือ 4 ไฟล์", (await myPapers("A"))[0].certificates.length, 4);
    }

    // ════════ C9: กดส่งซ้ำพร้อมกัน ════════
    console.log("\n── กดส่งซ้ำพร้อมกัน ──");
    const [dup1, dup2] = await Promise.all([
      send("B", [[s1, true], [s2, false], [s3, false]]),
      send("B", [[s1, true], [s2, false], [s3, false]]),
    ]);
    const statuses = [dup1.status, dup2.status].sort();
    check("กดส่งพร้อมกัน 2 ครั้ง -> ไม่มี 500", statuses.every((s) => s === 200 || s === 409), true);
    check("  ได้ใบเดียวในรอบ", (await myPapers("B")).length, 1);
    const resultB = (await myPapers("B"))[0].result_id;
    await upload("B", resultB, PDF_BYTES, "application/pdf", "b.pdf");

    const pC = await send("C", [[s1, true], [s2, true], [s3, true]]);
    const resultC = pC.json.data.result_id;
    await upload("C", resultC, PDF_BYTES, "application/pdf", "c.pdf");
    const pE = await send("E", [[s1, true], [s2, false], [s3, false]]);
    const resultE1 = pE.json.data.result_id;
    await upload("E", resultE1, PDF_BYTES, "application/pdf", "e.pdf");

    // ════════ D4: เจ้าหน้าที่กับผู้ช่วยตรวจกดยืนยันใบเดียวกันพร้อมกัน ════════
    console.log("\n── ตรวจพร้อมกัน ──");
    const [ap1, ap2] = await Promise.all([approve(resultA, oToken), approve(resultA, rToken)]);
    check("ยืนยันพร้อมกัน -> คนหนึ่ง 200 อีกคน 409", [ap1.status, ap2.status].sort(), [200, 409]);
    check("A แก้ไฟล์หลังยืนยันไม่ได้ -> 409", (await upload("A", resultA, PDF_BYTES, "application/pdf", "x.pdf")).status, 409);

    // ════════ ปิดรอบ 1 ════════
    console.log("\n── ปิดรอบ 1 แล้วตรวจต่อ ──");
    check("ปิดรอบ 1", (await setRound(round1, { status: "closed" })).status, 200);
    const late = await send("F", [[s1, true], [s2, true], [s3, true]]);
    check("F ส่งหลังปิดรอบ -> 400", late.status, 400);
    check("  ข้อความเข้าใจง่าย (ภาษาไทย)", /[ก-๙]/.test(late.json.message || ""), true);
    check("B (รอตรวจ) แก้ผลหลังปิดรอบไม่ได้ -> 400", (await send("B", [[s1, true], [s2, true], [s3, true]])).status, 400);
    check("B (รอตรวจ) เพิ่มไฟล์หลังปิดรอบไม่ได้ -> 409", (await upload("B", resultB, PDF_BYTES, "application/pdf", "late.pdf")).status, 409);

    check("ยืนยัน B หลังปิดรอบ -> 200", (await approve(resultB)).status, 200);
    check("ตีกลับ C หลังปิดรอบ -> 200", (await reject(resultC, "ไฟล์ไม่ชัด กรุณาแนบใหม่")).status, 200);

    // ════════ G4: ใบที่ถูกตีกลับหลังปิดรอบ ต้องแก้ส่งใหม่ได้ ════════
    const cActive = await active("C");
    check("C เห็นฟอร์มของรอบ 1 เพื่อแก้ใบที่ถูกตีกลับ", [cActive?.round_id, cActive?.can_fix_rejected], [round1, true]);
    check("B (ยืนยันแล้ว) ไม่ได้สิทธิ์แก้", (await active("B"))?.can_fix_rejected ?? false, false);
    check("C แนบไฟล์ใหม่ได้ (ใบยังถูกตีกลับ) -> 200", (await upload("C", resultC, JPG_BYTES, "image/jpeg", "ใหม่.jpg")).status, 200);
    const cFix = await send("C", [[s1, true], [s2, true], [s3, true]]);
    check("C ส่งใหม่หลังปิดรอบ -> 200 ใบเดิม กลับเป็นรอตรวจ", [cFix.status, cFix.json.data?.result_id === resultC, cFix.json.data?.staff_status], [200, true, "pending"]);
    check("  ส่งแล้ว แก้ต่อไม่ได้อีก -> 400", (await send("C", [[s1, false], [s2, true], [s3, true]])).status, 400);
    check("  F (ไม่เคยส่ง) ยังส่งไม่ได้", (await send("F", [[s1, true], [s2, true], [s3, true]])).status, 400);
    check("ยืนยัน C -> 200", (await approve(resultC)).status, 200);

    // ════════ รอบ 2 เปิดขณะใบรอบ 1 ของ E ยังรอตรวจ ════════
    console.log("\n── รอบ 2 ──");
    const r2 = await call("POST", "/api/rounds", {
      token: oToken,
      body: { academic_year: YEAR, attempt_number: 2, open_date: "2020-01-01", close_date: "2099-12-31", subject_ids: subjectIds },
    });
    const round2 = r2.json.data.round_id;
    check("สร้าง + เปิดรอบ 2", [r2.status, (await setRound(round2, { status: "open" })).status], [200, 200]);
    check("A (ผ่านครบรอบ 1) -> ไม่ต้องกรอกรอบ 2", (await active("A"))?.all_passed, true);
    const eActive = await active("E");
    const eMap = {};
    for (const s of eActive?.subjects || []) eMap[s.subject_id] = s.already_passed;
    check("E: วิชา 1 ยกมาจากใบรอบ 1 (ยังรอตรวจ)", eMap[s1.subject_id], true);
    const pE2 = await send("E", [[s2, true], [s3, true]]);
    const resultE2 = pE2.json.data.result_id;
    await upload("E", resultE2, PDF_BYTES, "application/pdf", "e2.pdf");
    check("E ส่งรอบ 2 -> 200", pE2.status, 200);
    check("ตีกลับใบรอบ 1 ของ E (หลักฐานวิชา 1 ไม่ผ่านการตรวจ)", (await reject(resultE1, "ไม่พบหลักฐานวิชาที่ 1")).status, 200);
    check("E เห็นฟอร์มรอบ 2 (รอบที่เปิดอยู่มาก่อน) ไม่ใช่รอบ 1", [(await active("E"))?.round_id, (await active("E"))?.can_fix_rejected], [round2, false]);
    check("ยืนยันใบรอบ 2 ของ E", (await approve(resultE2)).status, 200);

    const pB2 = await send("B", [[s2, true], [s3, true]]);
    check("B ส่งรอบ 2 เฉพาะวิชาที่เหลือ -> 200", pB2.status, 200);
    await upload("B", pB2.json.data.result_id, PDF_BYTES, "application/pdf", "b2.pdf");
    check("ยืนยัน B รอบ 2", (await approve(pB2.json.data.result_id, rToken)).status, 200);

    // ════════ รอบ 3: E ต้องกรอกวิชา 1 ใหม่ (หลักฐานเดิมถูกตีกลับ) ════════
    console.log("\n── รอบ 3 ──");
    await setRound(round2, { status: "closed" });
    const r3 = await call("POST", "/api/rounds", {
      token: oToken,
      body: { academic_year: YEAR, attempt_number: 3, open_date: "2020-01-01", close_date: "2099-12-31", subject_ids: subjectIds },
    });
    await setRound(r3.json.data.round_id, { status: "open" });
    const e3 = await active("E");
    const e3Map = {};
    for (const s of e3?.subjects || []) e3Map[s.subject_id] = s.already_passed;
    check("E รอบ 3: วิชา 1 ต้องกรอกใหม่ (ไม่ยกผลจากใบที่ถูกตีกลับ)", e3Map[s1.subject_id], false);
    check("E รอบ 3: วิชา 2-3 ผ่านแล้วจากรอบ 2", [e3Map[s2.subject_id], e3Map[s3.subject_id]], [true, true]);

    // ════════ สถิติทั้งปี ════════
    console.log("\n── สถิติ ──");
    const hist = (await call("GET", "/api/dashboard/history?years=10", { token: oToken })).json.data;
    const y = hist.years.find((v) => v.academic_year === YEAR);
    check("ทั้งรุ่น 6 คน", y?.total, 6);
    check("ผ่านครั้งแรก = 2 (A, C)", y?.firstAttempt?.passed, 2);
    check("ผ่านภายในปีแรก = 3 (A, B, C) — E ไม่นับ เพราะหลักฐานวิชา 1 ถูกตีกลับ", y?.firstYear?.passed, 3);

    // ════════ G3: ส่งออกรายชื่อผ่าน/ไม่ผ่านภายในปีแรก ════════
    console.log("\n── ส่งออก ──");
    const idCol = (sheet) => sheet.data[0].indexOf("รหัสนักศึกษา");
    const idsOf = (sheet) => sheet.data.slice(1).map((row) => row[idCol(sheet)]).sort();
    const fyPass = await call("GET", `/api/dashboard/export-first-year?year=${YEAR}&passed=true`, { token: oToken });
    const fyFail = await call("GET", `/api/dashboard/export-first-year?year=${YEAR}&passed=false`, { token: oToken });
    check("ส่งออก 'ผ่านภายในปีแรก' -> 200 Excel", [fyPass.status, /spreadsheetml/.test(fyPass.type)], [200, true]);
    if (fyPass.buffer && fyFail.buffer) {
      const P = (await readXlsxFile(fyPass.buffer, { parseNumber: (t) => t }))[0];
      const F = (await readXlsxFile(fyFail.buffer, { parseNumber: (t) => t }))[0];
      check("  ผ่าน = A, B, C", idsOf(P), [ID.A, ID.B, ID.C].sort());
      check("  ไม่ผ่าน = D, E, F", idsOf(F), [ID.D, ID.E, ID.F].sort());
      const header = P.data[0];
      check("  มีชื่อไทย/อังกฤษ เบอร์ ห้อง", ["ชื่อ", "นามสกุล", "ชื่อ (อังกฤษ)", "นามสกุล (อังกฤษ)", "เบอร์โทร", "ห้อง"].every((h) => header.includes(h)), true);
      check("  ไม่มีเลขบัตรประชาชน", JSON.stringify(P.data).includes(nid(1)), false);
    }
    const fyPdf = await call("GET", `/api/dashboard/export-first-year?year=${YEAR}&passed=false&format=pdf`, { token: oToken });
    check("ส่งออก 'ไม่ผ่านภายในปีแรก' เป็น PDF -> 200", [fyPdf.status, fyPdf.buffer?.subarray(0, 4).toString()], [200, "%PDF"]);
    check("ผู้ช่วยตรวจส่งออกไม่ได้ -> 403", (await call("GET", `/api/dashboard/export-first-year?year=${YEAR}&passed=true`, { token: rToken })).status, 403);

    const faPass = await call("GET", `/api/dashboard/export-first-attempt?year=${YEAR}&passed=true`, { token: oToken });
    const FA = (await readXlsxFile(faPass.buffer, { parseNumber: (t) => t }))[0];
    check("รายชื่อผ่านครั้งแรก = A, C", idsOf(FA), [ID.A, ID.C].sort());
    check("  มีชื่ออังกฤษ + เบอร์โทร", ["ชื่อ (อังกฤษ)", "เบอร์โทร"].every((h) => FA.data[0].includes(h)), true);
  } finally {
    await cleanupYears([YEAR]);
    for (const id of parkedRounds) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "open" } });
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error(e); process.exit(1); });
