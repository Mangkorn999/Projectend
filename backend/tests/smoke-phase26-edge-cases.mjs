// เทสกรณีขอบ (edge cases) ตาม flow จริงของคณะ — ต่อจาก phase25
// รันผ่าน:  TEST_SCHEMA=verify_t TEST_PORT=3101 ONLY=phase26 npm run test:clean
//
// รุ่นที่ใช้ (ปีสมมติ ≥ 2596 ล้างทิ้งตอนจบด้วย cleanupYears — ไม่แตะข้อมูลจริง):
//   รุ่น A = 2596 (รหัสขึ้นต้น 92) — รุ่นหลัก 10 คน
//   รุ่น B = 2598 (รหัสขึ้นต้น 94) — รุ่นที่สอง 1 คน ใช้ดูว่าสองรุ่นไม่ปนกัน + รอบที่สอบแค่ 2 วิชา
//
// ตัวละครรุ่น A และผลที่ต้องได้ตอนจบปี (ผ่านครั้งแรก / ผ่านภายในปีแรก):
//   P   รอบ 1 ถูกตีกลับ → ส่งใหม่ → ยืนยัน                          ✔ / ✔
//   Q   ถูกถอนสิทธิ์กลางรอบ → ได้คืน → ผ่าน 1/3 → รอบ 2 ผ่านที่เหลือ   ✘ / ✔
//   RV  ยืนยันแล้ว → ถอนการยืนยันหลังปิดรอบ → ยืนยันใหม่               ✔ / ✔
//   F   ทดสอบขอบเขตไฟล์ (5 ไฟล์พอดี) → ยืนยันหลังปิดรอบ              ✔ / ✔
//   G   ยืนยันแล้ว → ลบไฟล์ไม่ได้                                    ✔ / ✔
//   H   ตก 1 วิชาทั้ง 3 รอบ                                          ✘ / ✘
//   K   ถูกตีกลับหลังปิดรอบ (ลบไฟล์ได้) แล้วไม่ส่งอีกเลย               ✘ / ✘
//   N   ไม่ส่งเลยทั้งปี (ใช้ลองแอบดู/แก้ของคนอื่นด้วย)                 ✘ / ✘
//   M   ไม่ส่งรอบ 1 → รอบ 2 ผ่านครบ → ยืนยันหลังปิดรอบ 2             ✘ / ✔
//   W   ส่งตอนเจ้าหน้าที่ขยายวันปิดรอบ 1 แล้วค้าง "รอตรวจ" ถึงสิ้นปี    ✘ / ✘ (ใบรอตรวจไม่นับ)
// ตัวเลขที่ต้องได้: ทั้งรุ่น 10 · ผ่านครั้งแรก 4 · ผ่านภายในปีแรก 6
//
// ทุกหัวข้อแยกกันด้วย section() — หัวข้อไหนพังกลางทาง หัวข้อถัดไปยังรันต่อ
// ทุกข้อความ error ที่ผู้ใช้จะเห็น ถูกเก็บไว้ตรวจตอนจบหัวข้อ: ต้องมีภาษาไทย และไม่มีคำภาษาอังกฤษ/ชื่อ field
import readXlsxFile from "read-excel-file/node";
import { cleanupYears } from "./cleanupYears.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
let failures = 0;

// ── ตัวช่วยยิง API ───────────────────────────────────────────
// คืน { status, json, buffer, type, cookie } เสมอ — ต่อ server ไม่ได้ก็คืน status 0 ไม่โยน error
async function call(method, url, options = {}) {
  const headers = {};
  if (options.token) {
    headers.Cookie = options.token;
  }
  let payload;
  if (options.form) {
    payload = options.form;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(options.body);
  }

  let res;
  try {
    res = await fetch(BASE + url, { method, headers, body: payload });
  } catch (err) {
    // server ตัดการเชื่อมต่อกลางทาง (เช่น ไฟล์ใหญ่เกิน) — บันทึกเป็นผลลัพธ์ ไม่ให้ทั้งไฟล์ล้ม
    return { status: 0, json: { message: "เชื่อมต่อไม่สำเร็จ: " + err.message }, buffer: null, type: "", cookie: null };
  }

  const type = res.headers.get("content-type") || "";
  let json = {};
  let buffer = null;
  if (/spreadsheetml|pdf|image\//.test(type)) {
    buffer = Buffer.from(await res.arrayBuffer());
  } else {
    try {
      json = await res.json();
    } catch {
      json = {};
    }
  }

  const setCookie = res.headers.get("set-cookie");
  let cookie = null;
  if (setCookie) {
    cookie = setCookie.split(";")[0];
  }
  return { status: res.status, json, buffer, type, cookie };
}

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
  }
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
  return ok;
}

// ── ตรวจข้อความที่ผู้ใช้เห็น ─────────────────────────────────
// ผู้ใช้เป็นพยาบาล — ข้อความต้องมีภาษาไทย และห้ามมีคำภาษาอังกฤษ (ชื่อ field, role, endpoint, server ฯลฯ)
// ยกเว้นชื่อชนิดไฟล์/หน่วยที่คนทั่วไปรู้จัก
const ALLOWED_ENGLISH = ["PDF", "JPG", "JPEG", "PNG", "GIF", "EXCEL", "CSV", "XLSX", "MB", "KB"];

function messageProblems(message) {
  const problems = [];
  if (typeof message !== "string" || message.trim() === "") {
    problems.push("ไม่มีข้อความ");
    return problems;
  }
  if (!/[ก-๙]/.test(message)) {
    problems.push("ไม่มีภาษาไทย");
  }
  const englishWords = message.match(/[A-Za-z_]{2,}/g) || [];
  for (const word of englishWords) {
    if (!ALLOWED_ENGLISH.includes(word.toUpperCase())) {
      problems.push(`มีคำภาษาอังกฤษ "${word}"`);
    }
  }
  return problems;
}

// ข้อความ error ของหัวข้อปัจจุบัน — ตรวจรวดเดียวตอนจบหัวข้อ (1 บรรทัด FAIL ต่อหัวข้อ ไม่ให้รกจอ)
let sectionMessages = [];

// คาดว่า "ต้องถูกปฏิเสธ" ด้วย status นี้ + เก็บข้อความไว้ตรวจภาษา
function expectError(label, res, wantStatus) {
  check(label, res.status, wantStatus);
  if (res.status >= 400) {
    sectionMessages.push({ label, message: res.json ? res.json.message : undefined });
  }
}

function checkSectionMessages(title) {
  const bad = [];
  for (const item of sectionMessages) {
    const problems = messageProblems(item.message);
    if (problems.length > 0) {
      bad.push(`${item.label}: "${item.message}" (${problems.join(", ")})`);
    }
  }
  sectionMessages = [];
  check(`[${title}] ข้อความแจ้งผู้ใช้ทุกข้อเป็นภาษาไทย ไม่มีคำเทคนิค`, bad, []);
}

// ห่อแต่ละหัวข้อ — พังกลางทางก็บันทึก FAIL แล้วไปหัวข้อถัดไป
async function section(title, steps) {
  console.log(`\n── ${title} ──`);
  try {
    await steps();
  } catch (err) {
    failures++;
    console.log(`FAIL  [${title}] หยุดกลางคัน: ${err.message}`);
  }
  if (sectionMessages.length > 0) {
    checkSectionMessages(title);
  }
}

// ── ไฟล์ทดสอบ (สร้างในหน่วยความจำ) ─────────────────────────
// ระบบต้องตรวจ "หัวไฟล์" จริง ไม่เชื่อนามสกุล/ชนิดที่เบราว์เซอร์บอก
const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");
const PNG_BYTES = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const JPG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const GIF_BYTES = Buffer.from("GIF89a" + "0".repeat(20));
const TEXT_BYTES = Buffer.from("this is not a real document");
const EMPTY_BYTES = Buffer.alloc(0);
// ใหญ่เกินกำหนด 10 MB ไป 1 KB (หัวไฟล์เป็น PDF จริง — ต้องถูกปฏิเสธเพราะขนาดอย่างเดียว)
const BIG_PDF_BYTES = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(10 * 1024 * 1024 + 1024)]);

function fileForm(bytes, mime, name) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), name);
  form.append("certificate_type", "exam_result");
  return form;
}

// ── ข้อมูลทดสอบ ───────────────────────────────────────────────
const YEAR_A = 2596;
const YEAR_B = 2598;
const STAMP = Date.now().toString().slice(-6);

function makeStudentId(year, n) {
  const prefix = String(year - 4).slice(-2); // รหัส 2 หลักแรก = ปีเข้า → ระบบคำนวณปีจบ = ปีเข้า + 4
  return prefix + STAMP + String(n).padStart(2, "0");
}
function makeNationalId(n) {
  return "2" + STAMP + String(n).padStart(6, "0"); // 1 + 6 + 6 = 13 หลัก
}

const COHORT_A = ["P", "Q", "RV", "F", "G", "H", "K", "N", "M", "W"];
const COHORT_B = ["Y1"];
const ID = {};
const NID = {};
const YEAR_OF = {};
let counter = 0;
for (const who of COHORT_A) {
  counter++;
  ID[who] = makeStudentId(YEAR_A, counter);
  NID[who] = makeNationalId(counter);
  YEAR_OF[who] = YEAR_A;
}
for (const who of COHORT_B) {
  counter++;
  ID[who] = makeStudentId(YEAR_B, counter);
  NID[who] = makeNationalId(counter);
  YEAR_OF[who] = YEAR_B;
}

const PHONE = "0898765432";
const parkedRounds = [];

// state ที่ใช้ร่วมกันระหว่างหัวข้อ
const token = {};
let oToken = null;
let rToken = null;
let eToken = null;
let subjects = [];
let s1;
let s2;
let s3;
let s7;
let s8;
const round = {}; // A1, A2, A3, B1 → round_id
const paper = {}; // "P:A1" → result_id

// ── ตัวช่วยตามบทบาท ───────────────────────────────────────────
async function login(username, password) {
  const res = await call("POST", "/api/auth/login", { body: { psu_passport_id: username, password } });
  return res.cookie;
}

// answers = [[subject, true/false], ...]
function send(who, answers) {
  const list = [];
  for (const pair of answers) {
    list.push({ subject_id: pair[0].subject_id, is_passed: pair[1] });
  }
  return call("POST", "/api/exam-results", { token: token[who], body: { subject_results: list } });
}

function upload(tokenValue, resultId, bytes, mime, name) {
  return call("POST", `/api/exam-results/${resultId}/certificates`, { token: tokenValue, form: fileForm(bytes, mime, name) });
}

async function myPapers(who) {
  const res = await call("GET", "/api/exam-results/me", { token: token[who] });
  if (Array.isArray(res.json.data)) {
    return res.json.data;
  }
  return [];
}

// ใบของรอบที่ระบุ (ไม่มี = null)
async function paperIn(who, roundId) {
  const papers = await myPapers(who);
  for (const p of papers) {
    if (p.round_id === roundId) {
      return p;
    }
  }
  return null;
}

async function certCount(who, roundId) {
  const p = await paperIn(who, roundId);
  if (!p || !Array.isArray(p.certificates)) {
    return 0;
  }
  return p.certificates.length;
}

async function active(who) {
  const res = await call("GET", "/api/rounds/active", { token: token[who] });
  return res;
}

// { subject_id: already_passed } ของรอบที่นักศึกษาคนนี้เห็นอยู่
async function passedMap(who) {
  const res = await active(who);
  const map = {};
  const data = res.json.data;
  if (data && Array.isArray(data.subjects)) {
    for (const s of data.subjects) {
      map[s.subject_id] = s.already_passed;
    }
  }
  return map;
}

function approve(resultId, tokenValue) {
  return call("PATCH", `/api/exam-results/${resultId}/approve`, { token: tokenValue || oToken });
}
function reject(resultId, remark) {
  return call("PATCH", `/api/exam-results/${resultId}/reject`, { token: oToken, body: { remark } });
}
function revokeApproval(resultId, remark, tokenValue) {
  return call("PATCH", `/api/exam-results/${resultId}/revoke-approval`, { token: tokenValue || oToken, body: { remark } });
}
function deleteCert(tokenValue, certificateId) {
  return call("DELETE", `/api/certificates/${certificateId}`, { token: tokenValue });
}
function createRound(year, attempt, subjectList) {
  const ids = [];
  for (const s of subjectList) {
    ids.push(s.subject_id);
  }
  return call("POST", "/api/rounds", {
    token: oToken,
    body: { academic_year: year, attempt_number: attempt, open_date: "2020-01-01", close_date: "2099-12-31", subject_ids: ids },
  });
}
function setRound(roundId, body) {
  return call("PUT", `/api/rounds/${roundId}`, { token: oToken, body });
}

// ส่งผล + แนบ PDF 1 ไฟล์ในคราวเดียว (ใช้กับขั้นเตรียม ไม่ใช่สิ่งที่กำลังทดสอบ)
async function submitWithPdf(who, answers, fileName) {
  const res = await send(who, answers);
  if (res.status === 200 && res.json.data) {
    await upload(token[who], res.json.data.result_id, PDF_BYTES, "application/pdf", fileName || `${who}.pdf`);
    return res.json.data.result_id;
  }
  console.log(`  (หมายเหตุ: ${who} ส่งผลไม่สำเร็จ ${res.status} ${res.json.message})`);
  return null;
}

// ── อ่านไฟล์ Excel ที่ส่งออก ─────────────────────────────────
async function readSheet(buffer) {
  const sheets = await readXlsxFile(buffer, { parseNumber: (text) => text });
  return sheets[0].data;
}
function columnValues(rows, header) {
  const values = [];
  if (!rows || rows.length === 0) {
    return values;
  }
  const col = rows[0].indexOf(header);
  if (col < 0) {
    return values;
  }
  for (let i = 1; i < rows.length; i++) {
    values.push(rows[i][col]);
  }
  return values;
}
function sorted(list) {
  const copy = [];
  for (const x of list) {
    copy.push(x);
  }
  copy.sort();
  return copy;
}
function idsOf(names) {
  const ids = [];
  for (const who of names) {
    ids.push(ID[who]);
  }
  return sorted(ids);
}

// ════════════════════════════════════════════════════════════════
const main = async () => {
  oToken = await login("456", "456");
  rToken = await login("321", "321");
  eToken = await login("789", "789");
  check("เข้าระบบ เจ้าหน้าที่ / ผู้ช่วยตรวจสอบ / ผู้บริหาร", [!!oToken, !!rToken, !!eToken], [true, true, true]);

  try {
    // ════════ เตรียม: นักศึกษา 2 รุ่น + รอบ + ประกาศ ════════
    await section("เตรียมข้อมูล", async () => {
      const rooms = (await call("GET", "/api/rooms", { token: oToken })).json.data;
      subjects = (await call("GET", "/api/subjects", { token: oToken })).json.data;
      check("มีรายวิชาอย่างน้อย 8 วิชา", subjects.length >= 8, true);
      s1 = subjects[0];
      s2 = subjects[1];
      s3 = subjects[2];
      s7 = subjects[6];
      s8 = subjects[7];

      const everyone = [];
      for (const who of COHORT_A) everyone.push(who);
      for (const who of COHORT_B) everyone.push(who);

      let created = 0;
      let profiled = 0;
      for (const who of everyone) {
        const add = await call("POST", "/api/students", { token: oToken, body: { student_id: ID[who], national_id: NID[who] } });
        if (add.status === 201) created++;
        token[who] = await login(ID[who], NID[who]);
        const profile = await call("POST", "/api/students/complete-profile", {
          token: token[who],
          body: {
            first_name: `ทดสอบ${who}`, last_name: "ขอบเขต", first_name_en: `Test${who}`, last_name_en: "Edge",
            email: `${ID[who]}@test.local`, phone: PHONE, room_id: rooms[0].room_id,
          },
        });
        if (profile.status === 200 || profile.status === 201) profiled++;
      }
      check(`เพิ่มนักศึกษา ${everyone.length} คน + กรอกโปรไฟล์ครบ`, [created, profiled], [everyone.length, everyone.length]);

      const allIds = [];
      for (const who of everyone) allIds.push(ID[who]);
      const grant = await call("PATCH", "/api/students/bulk-eligible", { token: oToken, body: { student_ids: allIds, exam_eligible: true } });
      check("เปิดสิทธิ์กรอกผลให้ทั้ง 2 รุ่น", grant.status, 200);

      // ปิดรอบที่เปิดค้างอยู่ชั่วคราว (เปิดคืนตอนจบ) — ระบบเปิดได้ทีละรอบ
      const existing = (await call("GET", "/api/rounds", { token: oToken })).json.data || [];
      for (const r of existing) {
        if (r.status === "open") parkedRounds.push(r.round_id);
      }
      for (const id of parkedRounds) {
        await setRound(id, { status: "closed" });
      }

      const a1 = await createRound(YEAR_A, 1, [s1, s2, s3]);
      round.A1 = a1.json.data ? a1.json.data.round_id : undefined;
      const b1 = await createRound(YEAR_B, 1, [s7, s8]); // รอบของรุ่น B สอบแค่ 2 วิชา
      round.B1 = b1.json.data ? b1.json.data.round_id : undefined;
      check("สร้างรอบ 1 ของรุ่น A (3 วิชา) และรุ่น B (2 วิชา)", [a1.status, b1.status], [200, 200]);
      check("เปิดรอบ 1 ของรุ่น A", (await setRound(round.A1, { status: "open" })).status, 200);

      const newsA = await call("POST", "/api/news", { token: oToken, body: { title: `ประกาศรุ่น ${YEAR_A} รอบ 1 (${STAMP})`, content: "กรุณากรอกผลสอบ", round_id: round.A1 } });
      const newsB = await call("POST", "/api/news", { token: oToken, body: { title: `ประกาศรุ่น ${YEAR_B} รอบ 1 (${STAMP})`, content: "กรุณากรอกผลสอบ", round_id: round.B1 } });
      check("โพสต์ประกาศของทั้ง 2 รุ่น", [newsA.status, newsB.status], [201, 201]);
    });

    // ════════ 1. สองรุ่นพร้อมกัน ════════
    await section("สองรุ่นในระบบพร้อมกัน — ข้อมูลไม่ปนกัน", async () => {
      const openB = await setRound(round.B1, { status: "open" });
      expectError("เปิดรอบของรุ่น B ขณะรอบรุ่น A เปิดอยู่ -> 400", openB, 400);
      check("  ข้อความบอกว่าต้องปิดรอบที่เปิดอยู่ก่อน", /ปิดรอบ/.test(openB.json.message || ""), true);

      const yActive = await active("Y1");
      check("นักศึกษารุ่น B ไม่เห็นรอบที่เปิดของรุ่น A (ไม่มีรอบให้กรอก)", yActive.json.data ?? null, null);
      expectError("นักศึกษารุ่น B ส่งผลเข้ารอบของรุ่น A ไม่ได้ -> 400", await send("Y1", [[s1, true], [s2, true], [s3, true]]), 400);

      const pActive = await active("P");
      check("นักศึกษารุ่น A เห็นรอบ 1 ของรุ่นตัวเอง", pActive.json.data ? pActive.json.data.round_id : null, round.A1);

      const yNews = (await call("GET", "/api/news", { token: token.Y1 })).json.data || [];
      const pNews = (await call("GET", "/api/news", { token: token.P })).json.data || [];
      let yHasA = false;
      let yHasB = false;
      for (const n of yNews) {
        if (n.title.includes(`รุ่น ${YEAR_A}`) && n.title.includes(STAMP)) yHasA = true;
        if (n.title.includes(`รุ่น ${YEAR_B}`) && n.title.includes(STAMP)) yHasB = true;
      }
      let pHasA = false;
      let pHasB = false;
      for (const n of pNews) {
        if (n.title.includes(`รุ่น ${YEAR_A}`) && n.title.includes(STAMP)) pHasA = true;
        if (n.title.includes(`รุ่น ${YEAR_B}`) && n.title.includes(STAMP)) pHasB = true;
      }
      check("นักศึกษารุ่น B เห็นประกาศของรุ่นตัวเอง ไม่เห็นของรุ่น A", [yHasB, yHasA], [true, false]);
      check("นักศึกษารุ่น A เห็นประกาศของรุ่นตัวเอง ไม่เห็นของรุ่น B", [pHasA, pHasB], [true, false]);

      // ข้อสังเกต (ไม่นับเป็นผ่าน/ไม่ผ่าน): GET /api/rounds ให้นักศึกษาเห็นรายการรอบของทุกรุ่น (แค่ปี/ครั้งที่/วันที่)
      const allRounds = await call("GET", "/api/rounds", { token: token.Y1 });
      let otherCohortRounds = 0;
      for (const r of allRounds.json.data || []) {
        if (r.academic_year !== YEAR_B) otherCohortRounds++;
      }
      console.log(`INFO  นักศึกษาเรียก GET /api/rounds ได้ ${allRounds.status} เห็นรอบของรุ่นอื่น ${otherCohortRounds} รอบ (หน้าเว็บนักศึกษาไม่ได้ใช้ endpoint นี้)`);
    });

    // ════════ 2. ถอนสิทธิ์กรอกกลางรอบ แล้วคืนสิทธิ์ ════════
    await section("ถอนสิทธิ์กรอกผลกลางรอบ → คืนสิทธิ์", async () => {
      const revoke = await call("PATCH", "/api/students/bulk-eligible", { token: oToken, body: { student_ids: [ID.Q], exam_eligible: false } });
      check("เจ้าหน้าที่ถอนสิทธิ์ Q -> 200", revoke.status, 200);
      expectError("Q เปิดหน้ากรอกผล -> 403", await active("Q"), 403);
      expectError("Q ส่งผล -> 403", await send("Q", [[s1, true], [s2, false], [s3, false]]), 403);
      check("  ยังไม่มีใบของ Q ในรอบ", await paperIn("Q", round.A1), null);

      const regrant = await call("PATCH", "/api/students/bulk-eligible", { token: oToken, body: { student_ids: [ID.Q], exam_eligible: true } });
      check("เจ้าหน้าที่คืนสิทธิ์ Q -> 200", regrant.status, 200);
      const qActive = await active("Q");
      check("Q เห็นรอบ 1 อีกครั้ง", [qActive.status, qActive.json.data ? qActive.json.data.round_id : null], [200, round.A1]);
      const sent = await send("Q", [[s1, true], [s2, false], [s3, false]]);
      check("Q ส่งผล (ผ่าน 1/3) -> 200", sent.status, 200);
      if (sent.json.data) {
        paper["Q:A1"] = sent.json.data.result_id;
        await upload(token.Q, paper["Q:A1"], PDF_BYTES, "application/pdf", "q.pdf");
      }
      const notes = (await call("GET", "/api/notifications/me", { token: token.Q })).json.data || [];
      let eligibleNotes = 0;
      for (const n of notes) {
        if (n.type === "eligible") eligibleNotes++;
      }
      check("  Q ได้แจ้งเตือน 'เปิดสิทธิ์' (ตอนเตรียม + ตอนคืนสิทธิ์)", eligibleNotes >= 2, true);
    });

    // ════════ 3. ขอบเขตไฟล์แนบ ════════
    await section("ขอบเขตไฟล์แนบ (ขนาด / ไฟล์ว่าง / ไฟล์ปลอม / 5 ไฟล์พอดี)", async () => {
      const sent = await send("F", [[s1, true], [s2, true], [s3, true]]);
      check("F ส่งผลรอบ 1 -> 200", sent.status, 200);
      paper["F:A1"] = sent.json.data ? sent.json.data.result_id : undefined;
      const rid = paper["F:A1"];

      check("ไฟล์ที่ 1 (PDF) -> 200", (await upload(token.F, rid, PDF_BYTES, "application/pdf", "1-ใบคะแนน.pdf")).status, 200);
      expectError("ไฟล์ใหญ่เกิน 10 MB -> 400", await upload(token.F, rid, BIG_PDF_BYTES, "application/pdf", "ใหญ่เกิน.pdf"), 400);
      expectError("ไฟล์ว่าง 0 ไบต์ -> 400", await upload(token.F, rid, EMPTY_BYTES, "application/pdf", "ว่าง.pdf"), 400);
      expectError("ไฟล์ข้อความปลอมเป็น PDF -> 400", await upload(token.F, rid, TEXT_BYTES, "application/pdf", "ปลอม.pdf"), 400);
      expectError("ไฟล์ข้อความปลอมเป็น PNG -> 400", await upload(token.F, rid, TEXT_BYTES, "image/png", "ปลอม.png"), 400);
      expectError("ไฟล์ GIF แอบอ้างเป็น PNG -> 400", await upload(token.F, rid, GIF_BYTES, "image/png", "แอบ.png"), 400);
      check("  ไฟล์ที่ถูกปฏิเสธไม่ถูกเก็บ (ยังมี 1 ไฟล์)", await certCount("F", round.A1), 1);

      check("ไฟล์ที่ 2 (JPG) -> 200", (await upload(token.F, rid, JPG_BYTES, "image/jpeg", "2-ถ่ายรูป.jpg")).status, 200);
      check("ไฟล์ที่ 3 (PNG) -> 200", (await upload(token.F, rid, PNG_BYTES, "image/png", "3-สแกน.png")).status, 200);
      check("ไฟล์ที่ 4 (PDF) -> 200", (await upload(token.F, rid, PDF_BYTES, "application/pdf", "4.pdf")).status, 200);
      check("ไฟล์ที่ 5 (PDF) -> 200 (5 ไฟล์พอดี)", (await upload(token.F, rid, PDF_BYTES, "application/pdf", "5.pdf")).status, 200);
      check("  มีไฟล์ครบ 5 ไฟล์", await certCount("F", round.A1), 5);
      const sixth = await upload(token.F, rid, PDF_BYTES, "application/pdf", "6.pdf");
      expectError("ไฟล์ที่ 6 -> 400 (สูงสุด 5 ไฟล์)", sixth, 400);
      check("  ข้อความบอกจำนวนสูงสุด 5 ไฟล์", /5/.test(sixth.json.message || ""), true);
      check("  ยังมี 5 ไฟล์", await certCount("F", round.A1), 5);

      // ลบ 1 ไฟล์ (รอบยังเปิด ใบรอตรวจ) → มีที่ว่างให้แนบใหม่ได้ 1 ไฟล์
      const fPaper = await paperIn("F", round.A1);
      let jpgCert = null;
      if (fPaper) {
        for (const c of fPaper.certificates || []) {
          if (c.file_name === "2-ถ่ายรูป.jpg") jpgCert = c;
        }
      }
      check("พบไฟล์ JPG ที่แนบไว้ (ชื่อไฟล์ภาษาไทยไม่เพี้ยน)", !!jpgCert, true);
      if (jpgCert) {
        const opened = await call("GET", `/api/certificates/${jpgCert.certificate_id}/file`, { token: rToken });
        check("ผู้ช่วยตรวจสอบเปิดรูป JPG ได้ (ชนิดไฟล์ image/jpeg)", [opened.status, opened.type], [200, "image/jpeg"]);
        check("F ลบไฟล์ของตัวเองระหว่างรอบเปิด -> 200", (await deleteCert(token.F, jpgCert.certificate_id)).status, 200);
        check("  เหลือ 4 ไฟล์", await certCount("F", round.A1), 4);
        check("  แนบใหม่ได้อีก 1 ไฟล์ -> 200", (await upload(token.F, rid, JPG_BYTES, "image/jpeg", "2-ถ่ายใหม่.jpg")).status, 200);
        check("  กลับมาเป็น 5 ไฟล์", await certCount("F", round.A1), 5);
      }
    });

    // ════════ 4. นักศึกษาแตะใบ/ไฟล์ของคนอื่นไม่ได้ ════════
    await section("นักศึกษาแตะใบผลสอบ/ไฟล์ของคนอื่นไม่ได้", async () => {
      const rid = paper["F:A1"];
      const fPaper = await paperIn("F", round.A1);
      const firstCert = fPaper && fPaper.certificates && fPaper.certificates.length > 0 ? fPaper.certificates[0] : null;

      expectError("N แนบไฟล์ใส่ใบของ F -> 403", await upload(token.N, rid, PDF_BYTES, "application/pdf", "แอบ.pdf"), 403);
      expectError("นักศึกษารุ่นอื่น (Y1) แนบไฟล์ใส่ใบของ F -> 403", await upload(token.Y1, rid, PDF_BYTES, "application/pdf", "แอบ.pdf"), 403);
      if (firstCert) {
        expectError("N เปิดไฟล์หลักฐานของ F -> 403", await call("GET", `/api/certificates/${firstCert.certificate_id}/file`, { token: token.N }), 403);
        expectError("N ลบไฟล์หลักฐานของ F -> 403", await deleteCert(token.N, firstCert.certificate_id), 403);
      }
      check("  ไฟล์ของ F ยังอยู่ครบ 5 ไฟล์", await certCount("F", round.A1), 5);
      expectError("N ดูข้อมูลส่วนตัวของ F -> 403", await call("GET", `/api/students/${ID.F}`, { token: token.N }), 403);
      expectError("N ดูรายการผลสอบทุกคน -> 403", await call("GET", "/api/exam-results", { token: token.N }), 403);
      expectError("N ยืนยันใบของ F เอง -> 403", await approve(rid, token.N), 403);
      check("N เห็นเฉพาะใบของตัวเอง (ยังไม่มีเลย)", (await myPapers("N")).length, 0);
    });

    // ════════ 5. ผู้ช่วยตรวจสอบทำได้แค่ตรวจ ════════
    await section("ผู้ช่วยตรวจสอบ — ตรวจได้ แต่จัดการระบบไม่ได้", async () => {
      const rid = paper["F:A1"];
      const fPaper = await paperIn("F", round.A1);
      const firstCert = fPaper && fPaper.certificates && fPaper.certificates.length > 0 ? fPaper.certificates[0] : null;

      check("ผู้ช่วยตรวจสอบดูคิวผลสอบของรอบได้ -> 200", (await call("GET", `/api/exam-results?round_id=${round.A1}`, { token: rToken })).status, 200);
      expectError("ผู้ช่วยตรวจสอบถอนการยืนยัน -> 403", await revokeApproval(rid, "ลองถอน", rToken), 403);
      expectError("ผู้ช่วยตรวจสอบสร้างรอบ -> 403", await call("POST", "/api/rounds", { token: rToken, body: { academic_year: YEAR_A, attempt_number: 9, open_date: "2020-01-01", close_date: "2099-12-31" } }), 403);
      expectError("ผู้ช่วยตรวจสอบแก้รอบ -> 403", await call("PUT", `/api/rounds/${round.A1}`, { token: rToken, body: { close_date: "2099-06-30" } }), 403);
      expectError("ผู้ช่วยตรวจสอบโพสต์ประกาศ -> 403", await call("POST", "/api/news", { token: rToken, body: { title: "x", content: "y", round_id: round.A1 } }), 403);
      expectError("ผู้ช่วยตรวจสอบดูรายชื่อผู้ใช้งาน -> 403", await call("GET", "/api/users", { token: rToken }), 403);
      expectError("ผู้ช่วยตรวจสอบเพิ่มผู้ใช้งาน -> 403", await call("POST", "/api/users", { token: rToken, body: { psu_passport_id: `x${STAMP}`, password: "Temp#12345", role_name: "reviewer", first_name: "ก", last_name: "ข", email: "a@psu.ac.th", phone: "0812345678" } }), 403);
      expectError("ผู้ช่วยตรวจสอบเปิด/ปิดสิทธิ์กรอกผล -> 403", await call("PATCH", "/api/students/bulk-eligible", { token: rToken, body: { student_ids: [ID.N], exam_eligible: false } }), 403);
      if (firstCert) {
        expectError("ผู้ช่วยตรวจสอบลบไฟล์หลักฐานของนักศึกษา -> 403", await deleteCert(rToken, firstCert.certificate_id), 403);
      }
      expectError("ผู้ช่วยตรวจสอบส่งออกรายชื่อผ่านครั้งแรก -> 403", await call("GET", `/api/dashboard/export-first-attempt?year=${YEAR_A}&passed=true`, { token: rToken }), 403);
      expectError("ผู้ช่วยตรวจสอบส่งออกรายชื่อภายในปีแรก -> 403", await call("GET", `/api/dashboard/export-first-year?year=${YEAR_A}&passed=true`, { token: rToken }), 403);
      expectError("ผู้ช่วยตรวจสอบส่งออกข้อมูลนักศึกษา -> 403", await call("POST", "/api/students/export", { token: rToken, body: { year: YEAR_A } }), 403);
      check("  ไฟล์ของ F ยังอยู่ครบ", await certCount("F", round.A1), 5);
    });

    // ════════ 6. ผู้บริหารอ่านอย่างเดียว ════════
    await section("ผู้บริหาร — ดูสถิติได้ แต่ตรวจ/แนบ/ลบ/ส่งออกรายบุคคลไม่ได้", async () => {
      const rid = paper["F:A1"];
      const fPaper = await paperIn("F", round.A1);
      const firstCert = fPaper && fPaper.certificates && fPaper.certificates.length > 0 ? fPaper.certificates[0] : null;

      check("ผู้บริหารดูสถิติรายปีได้ -> 200", (await call("GET", "/api/dashboard/history?years=10", { token: eToken })).status, 200);
      expectError("ผู้บริหารยืนยันผล -> 403", await approve(rid, eToken), 403);
      expectError("ผู้บริหารตีกลับ -> 403", await call("PATCH", `/api/exam-results/${rid}/reject`, { token: eToken, body: { remark: "ลอง" } }), 403);
      expectError("ผู้บริหารถอนการยืนยัน -> 403", await revokeApproval(rid, "ลอง", eToken), 403);
      expectError("ผู้บริหารแนบไฟล์ -> 403", await upload(eToken, rid, PDF_BYTES, "application/pdf", "exec.pdf"), 403);
      if (firstCert) {
        expectError("ผู้บริหารลบไฟล์หลักฐาน -> 403", await deleteCert(eToken, firstCert.certificate_id), 403);
        expectError("ผู้บริหารเปิดไฟล์หลักฐานรายบุคคล -> 403", await call("GET", `/api/certificates/${firstCert.certificate_id}/file`, { token: eToken }), 403);
      }
      expectError("ผู้บริหารดูผลสอบรายบุคคล -> 403", await call("GET", "/api/exam-results", { token: eToken }), 403);
      expectError("ผู้บริหารส่งออกรายชื่อผ่านครั้งแรก -> 403", await call("GET", `/api/dashboard/export-first-attempt?year=${YEAR_A}&passed=true`, { token: eToken }), 403);
      expectError("ผู้บริหารส่งออกรายชื่อภายในปีแรก -> 403", await call("GET", `/api/dashboard/export-first-year?year=${YEAR_A}&passed=false`, { token: eToken }), 403);
      expectError("ผู้บริหารส่งออกข้อมูลนักศึกษา -> 403", await call("POST", "/api/students/export", { token: eToken, body: { year: YEAR_A } }), 403);
      check("  ใบของ F ยังรอตรวจอยู่ (ไม่ถูกแตะ)", (await paperIn("F", round.A1)).staff_status, "pending");
    });

    // ════════ 7. ตีกลับ → ส่งใหม่ → ยืนยัน + ลำดับแจ้งเตือน ════════
    await section("ตีกลับ → ส่งใหม่ (ล้างเหตุผลเดิม) → ยืนยัน + แจ้งเตือนเรียงถูก", async () => {
      paper["P:A1"] = await submitWithPdf("P", [[s1, true], [s2, true], [s3, true]], "p.pdf");
      check("P ส่งผลรอบ 1 + แนบไฟล์", !!paper["P:A1"], true);
      check("ตีกลับ P พร้อมเหตุผล -> 200", (await reject(paper["P:A1"], "ใบคะแนนไม่ชัด กรุณาแนบใหม่")).status, 200);
      const rejected = await paperIn("P", round.A1);
      check("  P เห็นสถานะถูกตีกลับ + เหตุผล", [rejected.staff_status, rejected.remark], ["rejected", "ใบคะแนนไม่ชัด กรุณาแนบใหม่"]);

      const again = await send("P", [[s1, true], [s2, true], [s3, true]]);
      check("P ส่งใหม่ -> 200 ใบเดิม", [again.status, again.json.data ? again.json.data.result_id : null], [200, paper["P:A1"]]);
      const resent = await paperIn("P", round.A1);
      check("  เหตุผลตีกลับเดิมถูกล้าง + กลับเป็นรอตรวจ", [resent.remark ?? null, resent.staff_status], [null, "pending"]);
      check("ยืนยัน P -> 200", (await approve(paper["P:A1"])).status, 200);

      const notes = (await call("GET", "/api/notifications/me", { token: token.P })).json.data || [];
      // เอาเฉพาะเรื่องผลสอบ เรียงจากเก่าไปใหม่ (API ส่งมาใหม่สุดก่อน → กลับด้าน)
      const examNotes = [];
      for (let i = notes.length - 1; i >= 0; i--) {
        const n = notes[i];
        if (n.type === "rejected" || n.type === "approved" || n.type === "revoked") {
          examNotes.push(n);
        }
      }
      const types = [];
      for (const n of examNotes) types.push(n.type);
      check("แจ้งเตือน P เรียงตามเวลา: ถูกตีกลับ → ยืนยันแล้ว", types, ["rejected", "approved"]);
      if (examNotes.length >= 1) {
        check("  แจ้งเตือนตีกลับบอกเหตุผล (ภาษาไทย)", examNotes[0].message.includes("ใบคะแนนไม่ชัด"), true);
      }
      let orderOk = true;
      for (let i = 1; i < examNotes.length; i++) {
        if (new Date(examNotes[i].created_at) < new Date(examNotes[i - 1].created_at)) orderOk = false;
      }
      check("  เวลาแจ้งเตือนเรียงจริง (ตีกลับก่อนยืนยัน)", orderOk, true);
    });

    // ════════ 8. ใบยืนยันแล้ว ลบไฟล์ไม่ได้ + เตรียมใบที่เหลือของรอบ 1 ════════
    await section("ใบที่ยืนยันแล้ว — ลบไฟล์หลักฐานไม่ได้", async () => {
      const sent = await send("G", [[s1, true], [s2, true], [s3, true]]);
      paper["G:A1"] = sent.json.data ? sent.json.data.result_id : undefined;
      await upload(token.G, paper["G:A1"], PDF_BYTES, "application/pdf", "g1.pdf");
      await upload(token.G, paper["G:A1"], JPG_BYTES, "image/jpeg", "g2.jpg");
      check("ยืนยัน G -> 200", (await approve(paper["G:A1"])).status, 200);
      const gPaper = await paperIn("G", round.A1);
      const gCert = gPaper && gPaper.certificates && gPaper.certificates.length > 0 ? gPaper.certificates[0] : null;
      check("  G มีไฟล์แนบ", !!gCert, true);
      if (gCert) {
        expectError("G ลบไฟล์หลังเจ้าหน้าที่ยืนยันแล้ว -> 409", await deleteCert(token.G, gCert.certificate_id), 409);
      }
      expectError("G แนบไฟล์เพิ่มหลังยืนยันแล้ว -> 409", await upload(token.G, paper["G:A1"], PDF_BYTES, "application/pdf", "g3.pdf"), 409);
      check("  ไฟล์ของ G ไม่หาย (2 ไฟล์)", await certCount("G", round.A1), 2);

      // ใบที่เหลือของรอบ 1 (ไว้ใช้หลังปิดรอบ)
      paper["RV:A1"] = await submitWithPdf("RV", [[s1, true], [s2, true], [s3, true]], "rv.pdf");
      check("ผู้ช่วยตรวจสอบยืนยัน RV -> 200", (await approve(paper["RV:A1"], rToken)).status, 200);
      paper["H:A1"] = await submitWithPdf("H", [[s1, true], [s2, true], [s3, false]], "h1.pdf");
      await upload(token.H, paper["H:A1"], JPG_BYTES, "image/jpeg", "h2.jpg");
      paper["K:A1"] = await submitWithPdf("K", [[s1, true], [s2, true], [s3, true]], "k1.pdf");
      await upload(token.K, paper["K:A1"], PNG_BYTES, "image/png", "k2.png");
      check("H และ K ส่งผล + แนบ 2 ไฟล์ (ค้างรอตรวจ)", [await certCount("H", round.A1), await certCount("K", round.A1)], [2, 2]);
    });

    // ════════ 9. หลังปิดรอบ 1 ════════
    await section("หลังปิดรอบ — ลบไฟล์ / ตรวจต่อ / ถอนการยืนยันแล้วยืนยันใหม่", async () => {
      check("ปิดรอบ 1", (await setRound(round.A1, { status: "closed" })).status, 200);

      const hPaper = await paperIn("H", round.A1);
      if (hPaper && hPaper.certificates && hPaper.certificates.length > 0) {
        expectError("H (รอตรวจ) ลบไฟล์หลังปิดรอบ -> 409", await deleteCert(token.H, hPaper.certificates[0].certificate_id), 409);
      }
      check("  ไฟล์ของ H ยังอยู่ 2 ไฟล์", await certCount("H", round.A1), 2);

      check("ตีกลับ K หลังปิดรอบ -> 200", (await reject(paper["K:A1"], "ไฟล์ไม่ครบถ้วน")).status, 200);
      const kPaper = await paperIn("K", round.A1);
      if (kPaper && kPaper.certificates && kPaper.certificates.length > 0) {
        check("K (ถูกตีกลับ) ลบไฟล์หลังปิดรอบได้ -> 200", (await deleteCert(token.K, kPaper.certificates[0].certificate_id)).status, 200);
      }
      check("  K เหลือ 1 ไฟล์", await certCount("K", round.A1), 1);

      check("ยืนยัน F, Q, H หลังปิดรอบ -> 200", [
        (await approve(paper["F:A1"])).status,
        (await approve(paper["Q:A1"])).status,
        (await approve(paper["H:A1"])).status,
      ], [200, 200, 200]);

      // ถอนการยืนยันหลังปิดรอบ: ใบกลับเป็นรอตรวจ แต่ "ไม่ใช่ใบที่ถูกตีกลับ" → นักศึกษาแก้เองไม่ได้
      const revoked = await revokeApproval(paper["RV:A1"], "ยืนยันผิดคน ขอตรวจใหม่");
      check("เจ้าหน้าที่ถอนการยืนยัน RV หลังปิดรอบ -> 200", revoked.status, 200);
      check("  ใบของ RV กลับเป็นรอตรวจ", (await paperIn("RV", round.A1)).staff_status, "pending");
      const rvNotes = (await call("GET", "/api/notifications/me", { token: token.RV })).json.data || [];
      let gotRevoked = false;
      for (const n of rvNotes) {
        if (n.type === "revoked" && n.message.includes("ยืนยันผิดคน")) gotRevoked = true;
      }
      check("  RV ได้แจ้งเตือนถอนการยืนยัน พร้อมเหตุผล", gotRevoked, true);
      expectError("RV แก้ผลเองหลังปิดรอบไม่ได้ (ไม่ได้ถูกตีกลับ) -> 400", await send("RV", [[s1, true], [s2, false], [s3, true]]), 400);
      expectError("RV แนบไฟล์เพิ่มหลังปิดรอบไม่ได้ -> 409", await upload(token.RV, paper["RV:A1"], PDF_BYTES, "application/pdf", "rv2.pdf"), 409);
      const rvActive = await active("RV");
      const canFix = rvActive.json.data ? rvActive.json.data.can_fix_rejected === true : false;
      check("  RV ไม่ได้สิทธิ์แก้ใบ (can_fix_rejected ไม่เป็น true)", canFix, false);
      check("เจ้าหน้าที่ยืนยัน RV ใหม่ -> 200", (await approve(paper["RV:A1"])).status, 200);
      const rvFinal = await paperIn("RV", round.A1);
      let allPassed = true;
      for (const sr of rvFinal.subject_results || []) {
        if (!sr.is_passed) allPassed = false;
      }
      check("  ใบของ RV กลับเป็นยืนยันแล้ว ผลเดิมไม่เปลี่ยน", [rvFinal.staff_status, allPassed], ["approved", true]);
    });

    // ════════ 10. เจ้าหน้าที่ขยายวันปิดรอบที่ปิดไปแล้ว ════════
    await section("ขยายวันปิดรอบที่ปิดไปแล้ว → นักศึกษาส่งได้อีก", async () => {
      expectError("W ส่งผลขณะรอบ 1 ปิด -> 400", await send("W", [[s1, true], [s2, true], [s3, true]]), 400);

      check("เจ้าหน้าที่เปิดรอบ 1 อีกครั้ง พร้อมขยายวันปิด -> 200", (await setRound(round.A1, { status: "open", close_date: "2099-12-31" })).status, 200);
      const wActive = await active("W");
      check("  W เห็นรอบ 1 กรอกได้ (phase active)", wActive.json.data ? wActive.json.data.phase : null, "active");
      const sent = await send("W", [[s1, true], [s2, true], [s3, true]]);
      check("  W ส่งผลได้ -> 200", sent.status, 200);
      paper["W:A1"] = sent.json.data ? sent.json.data.result_id : undefined;
      await upload(token.W, paper["W:A1"], PDF_BYTES, "application/pdf", "w.pdf");

      check("ตั้งวันปิดเป็นอดีต (รอบยังค้างสถานะเปิด) -> 200", (await setRound(round.A1, { close_date: "2021-06-30" })).status, 200);
      const expired = await active("W");
      check("  phase = expired", expired.json.data ? expired.json.data.phase : null, "expired");
      expectError("  W แก้ผลหลังเลยวันปิด -> 400", await send("W", [[s1, true], [s2, true], [s3, false]]), 400);

      check("เจ้าหน้าที่ขยายวันปิดอีกครั้ง -> 200", (await setRound(round.A1, { close_date: "2099-12-31" })).status, 200);
      const edit = await send("W", [[s1, true], [s2, true], [s3, true]]);
      check("  W แก้/ส่งซ้ำได้ ใบเดิม ยังรอตรวจ", [edit.status, edit.json.data ? edit.json.data.result_id : null, edit.json.data ? edit.json.data.staff_status : null], [200, paper["W:A1"], "pending"]);
      check("ปิดรอบ 1 อีกครั้ง", (await setRound(round.A1, { status: "closed" })).status, 200);
    });

    // ════════ 11. รุ่น B: รอบที่สอบแค่ 2 จาก 8 วิชา ════════
    await section("รอบที่สอบแค่ 2 วิชา (รุ่น B) + รุ่น A มองไม่เห็นรอบนี้", async () => {
      check("เปิดรอบ 1 ของรุ่น B (ตอนนี้ไม่มีรอบอื่นเปิด)", (await setRound(round.B1, { status: "open" })).status, 200);
      const yActive = await active("Y1");
      const codes = [];
      if (yActive.json.data && Array.isArray(yActive.json.data.subjects)) {
        for (const s of yActive.json.data.subjects) codes.push(s.subject_code);
      }
      check("นักศึกษารุ่น B เห็นเฉพาะ 2 วิชาของรอบ", sorted(codes), sorted([s7.subject_code, s8.subject_code]));
      const pActive = await active("P");
      check("นักศึกษารุ่น A ไม่เห็นรอบของรุ่น B ที่เปิดอยู่", pActive.json.data ? pActive.json.data.round_id : null, null);
      expectError("นักศึกษารุ่น A ส่งผลเข้ารอบของรุ่น B ไม่ได้ -> 400", await send("N", [[s7, true], [s8, true]]), 400);
      expectError("ส่งวิชาที่ไม่ได้อยู่ในรอบ -> 400", await send("Y1", [[s1, true], [s7, true], [s8, true]]), 400);
      const ok = await send("Y1", [[s7, true], [s8, false]]);
      const stored = ok.json.data && ok.json.data.subject_results ? ok.json.data.subject_results.length : 0;
      check("ส่ง 2 วิชาของรอบ -> 200 เก็บแค่ 2 วิชา", [ok.status, stored], [200, 2]);
      check("ปิดรอบของรุ่น B", (await setRound(round.B1, { status: "closed" })).status, 200);
    });

    // ════════ 12. รอบ 2 ของรุ่น A ════════
    await section("รอบ 2 ของรุ่น A", async () => {
      const a2 = await createRound(YEAR_A, 2, [s1, s2, s3]);
      round.A2 = a2.json.data ? a2.json.data.round_id : undefined;
      check("สร้าง + เปิดรอบ 2", [a2.status, (await setRound(round.A2, { status: "open" })).status], [200, 200]);

      const qMap = await passedMap("Q");
      check("Q: วิชา 1 ผ่านแล้ว (ล็อก) วิชา 2-3 ต้องกรอก", [qMap[s1.subject_id], qMap[s2.subject_id], qMap[s3.subject_id]], [true, false, false]);
      paper["Q:A2"] = await submitWithPdf("Q", [[s2, true], [s3, true]], "q2.pdf");
      check("ยืนยัน Q รอบ 2 -> 200", (await approve(paper["Q:A2"])).status, 200);

      paper["H:A2"] = await submitWithPdf("H", [[s3, false]], "h-r2.pdf");
      check("ยืนยัน H รอบ 2 (ยังตกวิชา 3) -> 200", (await approve(paper["H:A2"])).status, 200);

      const mMap = await passedMap("M");
      check("M (ไม่เคยส่ง): ต้องกรอกครบทุกวิชา", [mMap[s1.subject_id], mMap[s2.subject_id], mMap[s3.subject_id]], [false, false, false]);
      paper["M:A2"] = await submitWithPdf("M", [[s1, true], [s2, true], [s3, true]], "m.pdf");
      check("M ส่งรอบ 2 ผ่านครบ (ค้างรอตรวจ)", !!paper["M:A2"], true);

      const kMap = await passedMap("K");
      check("K (ใบรอบ 1 ถูกตีกลับ): ไม่ได้ยกผลมา ต้องกรอกใหม่ทุกวิชา", [kMap[s1.subject_id], kMap[s2.subject_id], kMap[s3.subject_id]], [false, false, false]);
      const pAll = (await active("P")).json.data;
      const wAll = (await active("W")).json.data;
      check("P (ผ่านครบ) และ W (ใบรอบ 1 รอตรวจ ผ่านครบ) ไม่ต้องกรอกรอบ 2", [pAll ? pAll.all_passed : null, wAll ? wAll.all_passed : null], [true, true]);
      check("ปิดรอบ 2", (await setRound(round.A2, { status: "closed" })).status, 200);
    });

    // ════════ 13. รอบ 3 ของรุ่น A ════════
    await section("รอบ 3 ของรุ่น A", async () => {
      const a3 = await createRound(YEAR_A, 3, [s1, s2, s3]);
      round.A3 = a3.json.data ? a3.json.data.round_id : undefined;
      check("สร้าง + เปิดรอบ 3", [a3.status, (await setRound(round.A3, { status: "open" })).status], [200, 200]);
      paper["H:A3"] = await submitWithPdf("H", [[s3, false]], "h-r3.pdf");
      check("ยืนยัน H รอบ 3 (ตกวิชา 3 เป็นครั้งที่ 3) -> 200", (await approve(paper["H:A3"])).status, 200);
      check("ยืนยันใบรอบ 2 ของ M หลังรอบ 2 ปิดแล้ว -> 200", (await approve(paper["M:A2"])).status, 200);
      check("ปิดรอบ 3", (await setRound(round.A3, { status: "closed" })).status, 200);
    });

    // ════════ 14. สรุปทั้งปี + ไฟล์ส่งออก ════════
    await section("สรุปทั้งปี + ไฟล์ส่งออกตรงกับตัวเลขบนแดชบอร์ด", async () => {
      const FIRST_ATTEMPT_PASS = ["P", "RV", "F", "G"];
      const FIRST_ATTEMPT_FAIL = ["Q", "H", "K", "N", "M", "W"];
      const FIRST_YEAR_PASS = ["P", "Q", "RV", "F", "G", "M"];
      const FIRST_YEAR_FAIL = ["H", "K", "N", "W"];

      const hist = (await call("GET", "/api/dashboard/history?years=10", { token: oToken })).json.data;
      let yearA = null;
      let yearB = null;
      for (const y of hist && hist.years ? hist.years : []) {
        if (y.academic_year === YEAR_A) yearA = y;
        if (y.academic_year === YEAR_B) yearB = y;
      }
      check(`รุ่น ${YEAR_A}: ทั้งรุ่น 10 คน`, yearA ? yearA.total : null, 10);
      check("  ผ่านครั้งแรก = 4 (P, RV, F, G)", yearA && yearA.firstAttempt ? yearA.firstAttempt.passed : null, 4);
      check("  ผ่านภายในปีแรก = 6 (P, Q, RV, F, G, M) — W ค้างรอตรวจไม่นับ, K ถูกตีกลับไม่นับ", yearA && yearA.firstYear ? yearA.firstYear.passed : null, 6);
      check(`รุ่น ${YEAR_B}: ทั้งรุ่น 1 คน (ไม่ปนกับรุ่น A)`, yearB ? yearB.total : null, 1);

      // ── รายชื่อผ่าน/ไม่ผ่านภายในปีแรก ──
      const fyPass = await call("GET", `/api/dashboard/export-first-year?year=${YEAR_A}&passed=true`, { token: oToken });
      const fyFail = await call("GET", `/api/dashboard/export-first-year?year=${YEAR_A}&passed=false`, { token: oToken });
      check("ส่งออก 'ผ่าน/ไม่ผ่านภายในปีแรก' -> 200 Excel ทั้งคู่", [fyPass.status, /spreadsheetml/.test(fyPass.type), fyFail.status, /spreadsheetml/.test(fyFail.type)], [200, true, 200, true]);
      if (fyPass.buffer && fyFail.buffer) {
        const passRows = await readSheet(fyPass.buffer);
        const failRows = await readSheet(fyFail.buffer);
        const passIds = sorted(columnValues(passRows, "รหัสนักศึกษา"));
        const failIds = sorted(columnValues(failRows, "รหัสนักศึกษา"));
        check("  ผ่านภายในปีแรก = P, Q, RV, F, G, M", passIds, idsOf(FIRST_YEAR_PASS));
        check("  ไม่ผ่านภายในปีแรก = H, K, N, W", failIds, idsOf(FIRST_YEAR_FAIL));
        check("  ผ่าน + ไม่ผ่าน = ทั้งรุ่น (10 คน ไม่ซ้ำ ไม่ขาด)", sorted(passIds.concat(failIds)), idsOf(COHORT_A));
        check("  จำนวนผ่านในไฟล์ = ตัวเลขบนแดชบอร์ด", passIds.length, yearA && yearA.firstYear ? yearA.firstYear.passed : -1);
        check("  ไม่มีนักศึกษารุ่น B ปนในไฟล์", passIds.concat(failIds).includes(ID.Y1), false);
        const header = passRows[0] || [];
        const needHeaders = ["ชื่อ", "นามสกุล", "ชื่อ (อังกฤษ)", "นามสกุล (อังกฤษ)", "เบอร์โทร", "ห้อง"];
        const missing = [];
        for (const h of needHeaders) {
          if (!header.includes(h)) missing.push(h);
        }
        check("  หัวคอลัมน์มีชื่อไทย/อังกฤษ เบอร์โทร ห้อง", missing, []);
        const idCol = header.indexOf("รหัสนักศึกษา");
        let pRow = null;
        for (let i = 1; i < passRows.length; i++) {
          if (passRows[i][idCol] === ID.P) pRow = passRows[i];
        }
        if (pRow) {
          check("  ข้อมูลของ P: ชื่ออังกฤษ + เบอร์โทรไม่ถูกตัดเลข 0", [pRow[header.indexOf("ชื่อ (อังกฤษ)")], pRow[header.indexOf("เบอร์โทร")]], ["TestP", PHONE]);
        }
        const allText = JSON.stringify(passRows) + JSON.stringify(failRows);
        let leaked = false;
        for (const who of COHORT_A) {
          if (allText.includes(NID[who])) leaked = true;
        }
        check("  ไม่มีเลขบัตรประชาชนในไฟล์", leaked, false);
      }
      const fyPdf = await call("GET", `/api/dashboard/export-first-year?year=${YEAR_A}&passed=false&format=pdf`, { token: oToken });
      check("ส่งออก 'ไม่ผ่านภายในปีแรก' เป็น PDF -> 200", [fyPdf.status, fyPdf.buffer ? fyPdf.buffer.subarray(0, 4).toString() : null], [200, "%PDF"]);
      expectError("ส่งออกภายในปีแรก ระบุปีผิดรูปแบบ -> 400", await call("GET", "/api/dashboard/export-first-year?year=abc&passed=true", { token: oToken }), 400);

      // ── รายชื่อผ่าน/ไม่ผ่านครั้งแรก ──
      const faPass = await call("GET", `/api/dashboard/export-first-attempt?year=${YEAR_A}&passed=true`, { token: oToken });
      const faFail = await call("GET", `/api/dashboard/export-first-attempt?year=${YEAR_A}&passed=false`, { token: oToken });
      check("ส่งออก 'ผ่าน/ไม่ผ่านครั้งแรก' -> 200 ทั้งคู่", [faPass.status, faFail.status], [200, 200]);
      if (faPass.buffer && faFail.buffer) {
        const passRows = await readSheet(faPass.buffer);
        const failRows = await readSheet(faFail.buffer);
        const passIds = sorted(columnValues(passRows, "รหัสนักศึกษา"));
        const failIds = sorted(columnValues(failRows, "รหัสนักศึกษา"));
        check("  ผ่านครั้งแรก = P, RV, F, G", passIds, idsOf(FIRST_ATTEMPT_PASS));
        check("  ไม่ผ่านครั้งแรก = Q, H, K, N, M, W", failIds, idsOf(FIRST_ATTEMPT_FAIL));
        check("  จำนวนผ่านในไฟล์ = ตัวเลขบนแดชบอร์ด", passIds.length, yearA && yearA.firstAttempt ? yearA.firstAttempt.passed : -1);
        const header = passRows[0] || [];
        check("  หัวคอลัมน์มี 'ชื่อ (อังกฤษ)' และ 'เบอร์โทร'", [header.includes("ชื่อ (อังกฤษ)"), header.includes("เบอร์โทร")], [true, true]);
      }
      expectError("ส่งออกครั้งแรก ระบุปีผิดรูปแบบ -> 400", await call("GET", "/api/dashboard/export-first-attempt?year=abc&passed=true", { token: oToken }), 400);
    });
  } finally {
    await cleanupYears([YEAR_A, YEAR_B]);
    for (const id of parkedRounds) {
      await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "open" } });
    }
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
