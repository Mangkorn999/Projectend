// เคสนักศึกษาซ้ำชั้น/ลาพัก — ปีที่จบจริงไม่ตรงกับที่คำนวณจากรหัส
//
// ระบบผูก "รอบสอบ" เข้ากับ "รุ่น" ผ่าน academic_year ตัวเดียว (rounds.controller getActive
// ดู student.academic_year แล้วหารอบที่ปีตรงกัน) นักศึกษาที่ซ้ำ 2 ปีจึงได้ปีผิดมาตั้งแต่ต้น
// → รอบของรุ่นเดิมเปิดให้เขาทั้งที่ยังเรียนไม่จบ ส่วนรอบที่เขาควรสอบกลับไม่เห็น
//
// เทสนี้คุม 3 อย่างที่ทำไว้แก้เคสนี้:
//   1. เจ้าหน้าที่ย้ายรุ่นได้ (PATCH academic_year) แล้วรอบที่นักศึกษาเห็นเปลี่ยนตามจริง
//   2. ย้ายไม่ได้ถ้าส่งผลสอบไปแล้ว — ใบผูกกับรอบ ไม่ได้ผูกกับรุ่น ย้ายทีหลังสถิติรุ่นเดิมเพี้ยน
//   3. GET /students/:id ส่ง academic_year_derived + exam_result_count มาให้หน้าจอใช้
//
// ต้องรัน backend ที่ localhost:3000 + seed แล้ว (`node prisma/seed.js`)
import { cleanupYears } from "./cleanupYears.mjs";

const BASE = "http://localhost:3000";
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

// ปีสมมติ ห่างจากข้อมูลจริง (2560–2575) และจาก phase15 (2596)
const DERIVED_YEAR = 2597; // ปีที่ "ควรจบ" ตามรหัส
const REAL_YEAR = 2599;    // ปีที่จบจริงหลังซ้ำ 2 ปี
const STAMP = Date.now().toString().slice(-8);
// รหัสขึ้นต้นด้วย 2 หลักของปีเข้า = DERIVED_YEAR - 4 → calcGraduationYear ต้องได้ DERIVED_YEAR
const STUDENT_ID = `${String(DERIVED_YEAR - 4).slice(-2)}${STAMP}`;
const NATIONAL_ID = `1${STAMP}00000`.slice(0, 13);
const NOW = { open_date: "2020-01-01", close_date: "2099-12-31" };

const openRound = async (token, year, attempt, subjectIds) => {
  const r = await call("POST", "/api/rounds", {
    token,
    body: { academic_year: year, attempt_number: attempt, ...NOW, subject_ids: subjectIds },
  });
  if (r.status !== 200) throw new Error(`create round ${year}/${attempt} failed: ${JSON.stringify(r.json)}`);
  const id = r.json.data.round_id;
  await call("PUT", `/api/rounds/${id}`, { token, body: { status: "open" } });
  return id;
};

const main = async () => {
  const officer = await call("POST", "/api/auth/login", { body: { psu_passport_id: "456", password: "456" } });
  const oToken = officer.cookie;
  if (!oToken) { console.log("officer login failed:", JSON.stringify(officer.json)); process.exit(1); }

  const subjectIds = (await call("GET", "/api/subjects", { token: oToken })).json.data.map((s) => s.subject_id);
  const rooms = (await call("GET", "/api/rooms", { token: oToken })).json.data || [];

  // ปิดรอบที่เปิดค้างอยู่ก่อน — ระบบให้เปิดได้ทีละรอบเท่านั้น
  const allRounds = (await call("GET", "/api/rounds", { token: oToken })).json.data || [];
  const parked = allRounds.filter((r) => r.status === "open").map((r) => r.round_id);
  for (const id of parked) {
    await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });
  }

  try {
    // ---- 1. สร้างนักศึกษา — ปีต้องถูกคำนวณจากรหัสให้อัตโนมัติ ----
    const made = await call("POST", "/api/students", {
      token: oToken, body: { student_id: STUDENT_ID, national_id: NATIONAL_ID },
    });
    check("create student -> 201", made.status, 201);

    const sLogin = await call("POST", "/api/auth/login", { body: { psu_passport_id: STUDENT_ID, password: NATIONAL_ID } });
    const sToken = sLogin.cookie;
    await call("POST", "/api/students/complete-profile", {
      token: sToken,
      body: {
        first_name: "ซ้ำชั้น", last_name: "ทดสอบ",
        first_name_en: "Repeat", last_name_en: "Test",
        email: `${STUDENT_ID}@test.local`, phone: "0800000000",
        room_id: rooms[0].room_id,
      },
    });
    await call("PATCH", "/api/students/bulk-eligible", {
      token: oToken, body: { student_ids: [STUDENT_ID], exam_eligible: true },
    });

    // ---- 2. GET /students/:id ต้องมี 2 field ใหม่ที่หน้าจอใช้ ----
    const before = await call("GET", `/api/students/${STUDENT_ID}`, { token: oToken });
    check("ปีคำนวณจากรหัสอัตโนมัติ", before.json.data.academic_year, DERIVED_YEAR);
    check("ส่ง academic_year_derived มาด้วย", before.json.data.academic_year_derived, DERIVED_YEAR);
    check("ยังไม่เคยส่งผล exam_result_count = 0", before.json.data.exam_result_count, 0);

    // ---- 3. ยังไม่มีผลสอบ → ย้ายรุ่นได้ ----
    const moved = await call("PATCH", `/api/students/${STUDENT_ID}`, {
      token: oToken, body: { academic_year: REAL_YEAR },
    });
    check("ย้ายรุ่นตอนยังไม่มีผลสอบ -> 200", moved.status, 200);
    const after = await call("GET", `/api/students/${STUDENT_ID}`, { token: oToken });
    check("ปีเปลี่ยนเป็นปีที่จบจริง", after.json.data.academic_year, REAL_YEAR);
    check("derived ยังคงเป็นปีตามรหัสเหมือนเดิม", after.json.data.academic_year_derived, DERIVED_YEAR);

    // ---- 4. รอบของรุ่นเดิม (ที่เขาไม่ได้อยู่แล้ว) ต้องไม่เปิดให้เขา ----
    const wrongRound = await openRound(oToken, DERIVED_YEAR, 1, subjectIds.slice(0, 3));
    const seesWrong = await call("GET", "/api/rounds/active", { token: sToken });
    check("รอบของรุ่นเดิมไม่เปิดให้ (ย้ายรุ่นแล้ว)", seesWrong.json.data, null);
    await call("PUT", `/api/rounds/${wrongRound}`, { token: oToken, body: { status: "closed" } });

    // ---- 5. รอบของรุ่นที่จบจริง ต้องเปิดให้ ----
    const rightRound = await openRound(oToken, REAL_YEAR, 1, subjectIds.slice(0, 3));
    const seesRight = await call("GET", "/api/rounds/active", { token: sToken });
    check("รอบของรุ่นที่จบจริงเปิดให้", seesRight.json.data?.round_id, rightRound);

    // ---- 6. ส่งผลสอบแล้ว → ย้ายรุ่นไม่ได้อีก ----
    const submit = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: subjectIds.slice(0, 3).map((id, i) => ({ subject_id: id, is_passed: i < 2 })) },
    });
    check("นักศึกษาส่งผล -> 200", submit.status, 200);

    const blocked = await call("PATCH", `/api/students/${STUDENT_ID}`, {
      token: oToken, body: { academic_year: DERIVED_YEAR },
    });
    check("ย้ายรุ่นหลังส่งผลแล้ว -> 400", blocked.status, 400);
    const stillThere = await call("GET", `/api/students/${STUDENT_ID}`, { token: oToken });
    check("ปียังไม่ถูกเปลี่ยน", stillThere.json.data.academic_year, REAL_YEAR);
    check("exam_result_count นับได้ 1", stillThere.json.data.exam_result_count, 1);

    // ---- 7. ส่งปีเท่าเดิมมาต้องผ่าน — กดบันทึกทั้งฟอร์มโดยไม่ได้แตะช่องปีต้องไม่ติด guard ----
    const sameYear = await call("PATCH", `/api/students/${STUDENT_ID}`, {
      token: oToken, body: { academic_year: REAL_YEAR, phone: "0899999999" },
    });
    check("ส่งปีเท่าเดิม (แก้แค่เบอร์โทร) -> 200", sameYear.status, 200);

    // ---- 8. /dashboard/alerts — กระดิ่งแจ้งเตือนของเจ้าหน้าที่/ผู้บริหารดึงจากเส้นนี้ ----
    const execLogin = await call("POST", "/api/auth/login", { body: { psu_passport_id: "789", password: "789" } });
    const revLogin = await call("POST", "/api/auth/login", { body: { psu_passport_id: "321", password: "321" } });

    const oAlerts = await call("GET", "/api/dashboard/alerts", { token: oToken });
    check("officer GET /dashboard/alerts -> 200", oAlerts.status, 200);
    check("alerts เป็น array", Array.isArray(oAlerts.json.data?.alerts), true);
    check("executive GET /dashboard/alerts -> 200",
      (await call("GET", "/api/dashboard/alerts", { token: execLogin.cookie })).status, 200);
    check("student GET /dashboard/alerts -> 403",
      (await call("GET", "/api/dashboard/alerts", { token: sToken })).status, 403);
    check("reviewer GET /dashboard/alerts -> 403",
      (await call("GET", "/api/dashboard/alerts", { token: revLogin.cookie })).status, 403);

    // ---- 9. ผู้บริหารห้ามแก้ข้อมูลนักศึกษา (read-only ตามรายงาน) ----
    check("executive PATCH /students/:id -> 403",
      (await call("PATCH", `/api/students/${STUDENT_ID}`, {
        token: execLogin.cookie, body: { academic_year: DERIVED_YEAR },
      })).status, 403);
    check("reviewer PATCH /students/:id -> 403",
      (await call("PATCH", `/api/students/${STUDENT_ID}`, {
        token: revLogin.cookie, body: { academic_year: DERIVED_YEAR },
      })).status, 403);
    check("student PATCH /students/:id -> 403",
      (await call("PATCH", `/api/students/${STUDENT_ID}`, {
        token: sToken, body: { academic_year: DERIVED_YEAR },
      })).status, 403);
  } finally {
    // ลบรอบทดสอบก่อน (รอบที่เปิดค้างอยู่ถูกลบไปด้วย) แล้วค่อยเปิดรอบจริงที่ปิดไว้ตอนต้นคืน
    // ระบบให้เปิดได้ทีละรอบ — ถ้าเปิดคืนก่อนลบ รอบทดสอบที่ยังเปิดอยู่จะชนกันแล้วเปิดคืนไม่สำเร็จ
    // (เดิมลืมเปิดคืน รอบที่เจ้าหน้าที่เปิดรับอยู่จริงเลยถูกปิดทิ้งทุกครั้งที่รันเทสนี้)
    await cleanupYears([DERIVED_YEAR, REAL_YEAR]);
    for (const id of parked) {
      await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "open" } });
    }
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error(e); process.exit(1); });
