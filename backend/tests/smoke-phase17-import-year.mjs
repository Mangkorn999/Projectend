// เจ้าหน้าที่ระบุปีที่จบตั้งแต่ตอนนำเข้ารายชื่อ (เคสซ้ำชั้น/ลาพัก)
//
// ก่อนหน้านี้ปีจบคำนวณจากรหัสอย่างเดียว (รหัส+4) คนซ้ำชั้นได้ปีผิดตั้งแต่ต้น
// ต้องรอนักศึกษา login ก่อน เจ้าหน้าที่ถึงจะแก้ได้ (ตอนนั้นยังไม่มีแถว students ให้แก้)
// ตอนนี้ CSV / ฟอร์มเพิ่มทีละคน มีคอลัมน์ academic_year แบบไม่บังคับ:
//   เว้นว่าง = ใช้สูตรเหมือนเดิม · ใส่ปี = ใช้ปีนั้นตอนนักศึกษากรอกโปรไฟล์
//
// คุม 4 เรื่อง:
//   1. dry_run=true ตรวจไฟล์ได้โดยยังไม่บันทึกอะไร (หน้าเว็บใช้ทำกล่องสรุปก่อนยืนยัน)
//   2. ปีที่ใส่มาถูกใช้จริงตอน complete-profile, เว้นว่างได้ปีตามสูตร
//   3. ปีผิดรูปแบบ / น้อยกว่าปีตามรหัส (ใส่ปีเข้าแทนปีจบ) ถูกข้ามพร้อมเหตุผล
//   4. PATCH /students/:id ใช้กฎตรวจปีเดียวกัน
//
// ต้องรัน backend ที่ localhost:3000 + seed แล้ว (`node prisma/seed.js`)
import { cleanupYears } from "./cleanupYears.mjs";

const BASE = "http://localhost:3000";
let failures = 0;

const call = async (method, url, { token, body, form } = {}) => {
  const headers = {};
  if (token) headers.Cookie = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
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

// ปีสมมติ ≥ 2590 (cleanupYears ล้างได้เฉพาะช่วงนี้) และไม่ชนเทสอื่น (phase15 = 2596, phase16 = 2597/2599)
const DERIVED = 2591;           // ปีจบตามสูตรของรหัสที่ขึ้นต้นด้วย "87"
const REAL = 2593;              // ปีจบจริงหลังซ้ำ 2 ปี
const PREFIX = String(DERIVED - 4).slice(-2); // "87"
const STAMP = Date.now().toString().slice(-6);
const sid = (n) => `${PREFIX}${STAMP}${n}`;           // รหัสไม่ซ้ำกันในแต่ละรอบที่รันเทส
const nid = (n) => `1${STAMP}${n}`.padEnd(13, "0");   // เลขบัตร 13 หลัก

const S_BLANK = sid("01");    // เว้นว่าง → ใช้สูตร
const S_OVERRIDE = sid("02"); // ซ้ำชั้น → 2593
const S_SAME = sid("03");     // ใส่ปีเท่าสูตรพอดี → ไม่นับเป็นการแก้
const S_ENTRY = sid("04");    // ใส่ปีเข้า (2587) แทนปีจบ → ต้องถูกข้าม
const S_GARBAGE = sid("05");  // ใส่ตัวอักษร → ต้องถูกข้าม
const S_MANUAL = sid("06");   // เพิ่มทีละคนพร้อมปี

const csvForm = (text) => {
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(text, "utf8")], { type: "text/csv" }), "students.csv");
  return form;
};

const CSV =
  "student_id,national_id,academic_year\n" +
  `${S_BLANK},${nid("01")},\n` +
  `${S_OVERRIDE},${nid("02")},${REAL}\n` +
  `${S_SAME},${nid("03")},${DERIVED}\n` +
  `${S_ENTRY},${nid("04")},${DERIVED - 4}\n` +
  `${S_GARBAGE},${nid("05")},ปี69\n`;

// login + กรอกโปรไฟล์ แล้วคืนปีจบที่ระบบตั้งให้
const profileYear = async (studentId, nationalId, roomId) => {
  const login = await call("POST", "/api/auth/login", { body: { psu_passport_id: studentId, password: nationalId } });
  const done = await call("POST", "/api/students/complete-profile", {
    token: login.cookie,
    body: {
      first_name: "ทดสอบ", last_name: "ปีจบ", first_name_en: "Test", last_name_en: "Year",
      email: `${studentId}@test.local`, phone: "0800000000", room_id: roomId,
    },
  });
  return done.json.data?.student?.academic_year;
};

const main = async () => {
  const officer = await call("POST", "/api/auth/login", { body: { psu_passport_id: "456", password: "456" } });
  const oToken = officer.cookie;
  if (!oToken) { console.log("officer login failed:", JSON.stringify(officer.json)); process.exit(1); }
  const rooms = (await call("GET", "/api/rooms", { token: oToken })).json.data || [];
  const roomId = rooms[0].room_id;

  try {
    // ---- 1. dry run: ตรวจอย่างเดียว ไม่บันทึก ----
    const dry = await call("POST", "/api/students/import?dry_run=true", { token: oToken, form: csvForm(CSV) });
    check("dry run -> 200", dry.status, 200);
    check("dry run บอกว่าเป็น dry run", dry.json.data?.dry_run, true);
    check("dry run: จะนำเข้า 3 คน", dry.json.data?.imported_count, 3);
    check("dry run: จะข้าม 2 คน", dry.json.data?.skipped_count, 2);
    check("dry run: ปีที่ต่างจากสูตรมีคนเดียว (ใส่ปีเท่าสูตรไม่นับ)",
      dry.json.data?.year_overrides?.map((o) => o.student_id), [S_OVERRIDE]);
    check("dry run: บอกทั้งปีตามสูตรและปีที่จะใช้",
      dry.json.data?.year_overrides?.[0] && {
        derived: dry.json.data.year_overrides[0].derived,
        academic_year: dry.json.data.year_overrides[0].academic_year,
      },
      { derived: DERIVED, academic_year: REAL });
    const skippedIds = (dry.json.data?.skipped || []).map((s) => s.student_id).sort();
    check("dry run: ข้ามคนที่ใส่ปีเข้า + คนที่ใส่ตัวอักษร", skippedIds, [S_ENTRY, S_GARBAGE].sort());

    // dry run ต้องไม่สร้างบัญชี — login ยังไม่ได้
    const noAccount = await call("POST", "/api/auth/login", { body: { psu_passport_id: S_BLANK, password: nid("01") } });
    check("dry run ไม่ได้สร้างบัญชีจริง (login ไม่ได้)", noAccount.status, 401);

    // ---- 2. นำเข้าจริง: ผลต้องตรงกับที่ dry run บอกไว้ ----
    const real = await call("POST", "/api/students/import", { token: oToken, form: csvForm(CSV) });
    check("นำเข้าจริง -> 201", real.status, 201);
    check("นำเข้าจริง: ไม่ใช่ dry run", real.json.data?.dry_run, false);
    check("นำเข้าจริง: ได้ 3 คนตรงกับ dry run", real.json.data?.imported_count, 3);

    // ---- 3. ปีที่ใช้ตอนกรอกโปรไฟล์ ----
    check("เว้นว่าง → ใช้ปีตามสูตร", await profileYear(S_BLANK, nid("01"), roomId), DERIVED);
    check("ใส่ปีจบจริง → ใช้ปีนั้น", await profileYear(S_OVERRIDE, nid("02"), roomId), REAL);
    check("ใส่ปีเท่าสูตร → ได้ปีตามสูตร", await profileYear(S_SAME, nid("03"), roomId), DERIVED);

    const detail = await call("GET", `/api/students/${S_OVERRIDE}`, { token: oToken });
    check("หน้ารายละเอียดยังบอกปีตามสูตรไว้เทียบ", detail.json.data?.academic_year_derived, DERIVED);

    // ---- 4. เพิ่มทีละคน ----
    const badManual = await call("POST", "/api/students", {
      token: oToken, body: { student_id: S_MANUAL, national_id: nid("06"), academic_year: DERIVED - 1 },
    });
    check("เพิ่มทีละคน ปีน้อยกว่าสูตร -> 400", badManual.status, 400);
    const okManual = await call("POST", "/api/students", {
      token: oToken, body: { student_id: S_MANUAL, national_id: nid("06"), academic_year: REAL },
    });
    check("เพิ่มทีละคนพร้อมปี -> 201", okManual.status, 201);
    check("เพิ่มทีละคน → ใช้ปีที่ใส่", await profileYear(S_MANUAL, nid("06"), roomId), REAL);

    // ---- 5. PATCH ใช้กฎตรวจปีเดียวกัน (S_BLANK ยังไม่มีผลสอบ แก้ปีได้) ----
    const patchEntry = await call("PATCH", `/api/students/${S_BLANK}`, {
      token: oToken, body: { academic_year: DERIVED - 4 },
    });
    check("PATCH ใส่ปีเข้าแทนปีจบ -> 400", patchEntry.status, 400);
    const patchGarbage = await call("PATCH", `/api/students/${S_BLANK}`, {
      token: oToken, body: { academic_year: "abc" },
    });
    check("PATCH ใส่ตัวอักษร -> 400 (เดิมหลุดไปเป็น 500)", patchGarbage.status, 400);
    const patchOk = await call("PATCH", `/api/students/${S_BLANK}`, {
      token: oToken, body: { academic_year: REAL },
    });
    check("PATCH ปีที่ถูกต้อง -> 200", patchOk.status, 200);
  } finally {
    await cleanupYears([DERIVED, REAL]);
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error(e); process.exit(1); });
