// เทสชุด "ตรวจบั๊กทั้งระบบ" 24 ก.ย. — ทุกข้อคือบั๊กที่เจอจริงตอนไล่โค้ด แล้วแก้
//
//   1. input ผิดชนิด/ขาด ต้องได้ 400/409 ไม่ใช่ 500 (และ 500 ต้องไม่หลุดข้อความดิบของ Prisma)
//   2. ลบวิชาที่รอบสอบใช้อยู่ไม่ได้ (เดิมลบได้ แล้วรอบเหลือ 0 วิชา นักศึกษาเห็น "ผ่านครบ" ผิดๆ)
//   3. ประกาศ: round_id มั่ว / หัวข้อว่าง
//   4. เอกสาร: ไฟล์ปลอม (mimetype PDF แต่เนื้อไม่ใช่) ต้องถูกปฏิเสธ · ใบที่ยืนยันแล้วเปลี่ยนเอกสารไม่ได้
//
// ปีที่ใช้ 2594 (เทสอื่นใช้ 2596-2599) ล้างทิ้งตอนจบด้วย cleanupYears
import { cleanupYears } from "./cleanupYears.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
let failures = 0;

const call = async (method, url, { token, body, form } = {}) => {
  const headers = {};
  if (token) headers.Cookie = token;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
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

const YEAR = 2594;
const STAMP = Date.now().toString().slice(-8);
const STUDENT_ID = `${String(YEAR - 4).slice(-2)}${STAMP}`;
const NATIONAL_ID = `1${STAMP}00000`.slice(0, 13);
const createdSubjects = [];
let parked = [];
let oToken;

const pdfForm = (bytes, type = "exam_result") => {
  const f = new FormData();
  f.append("certificate_type", type);
  f.append("file", new Blob([Buffer.from(bytes)], { type: "application/pdf" }), "x.pdf");
  return f;
};

const main = async () => {
  oToken = (await call("POST", "/api/auth/login", { body: { psu_passport_id: "456", password: "456" } })).cookie;
  check("login officer", !!oToken, true);

  try {
    // ── 1. input ผิด → 400 ไม่ใช่ 500 ──
    const obj = await call("POST", "/api/auth/login", { body: { psu_passport_id: { contains: "" }, password: "x" } });
    check("login ส่ง object เป็นรหัสผู้ใช้ -> 400", obj.status, 400);

    const badUser = await call("POST", "/api/users", {
      token: oToken,
      body: { psu_passport_id: "t1", password: 12345678, role_name: "reviewer", first_name: "a", last_name: "b", email: "a@b.c", phone: "081" },
    });
    check("สร้างผู้ใช้ password เป็นตัวเลข -> 400", badUser.status, 400);

    const badStudent = await call("POST", "/api/students", {
      token: oToken, body: { student_id: STUDENT_ID, national_id: 1234567890123 },
    });
    check("เพิ่มนักศึกษา national_id เป็นตัวเลข -> 400", badStudent.status, 400);

    // ── 2. วิชา: validate + ห้ามซ้ำ + ลบวิชาที่รอบใช้ไม่ได้ ──
    check("POST /subjects body ว่าง -> 400", (await call("POST", "/api/subjects", { token: oToken, body: {} })).status, 400);
    check("POST /subjects ชื่อวิชายาวเกิน -> 400",
      (await call("POST", "/api/subjects", { token: oToken, body: { subject_code: "T94", subject_name: "ก".repeat(201) } })).status, 400);

    const made = await call("POST", "/api/subjects", { token: oToken, body: { subject_code: "T94", subject_name: "วิชาทดสอบ 94" } });
    check("สร้างวิชา -> 200", made.status, 200);
    const subjectId = made.json?.data?.subject_id;
    if (subjectId) createdSubjects.push(subjectId);

    const dupCode = await call("POST", "/api/subjects", { token: oToken, body: { subject_code: "T94", subject_name: "ซ้ำรหัส" } });
    check("สร้างวิชารหัสซ้ำ -> 409", dupCode.status, 409);

    const junk = await call("PUT", `/api/subjects/${subjectId}`, { token: oToken, body: { subject_id: 1, foo: "bar" } });
    check("PUT วิชาส่ง field แปลกๆ อย่างเดียว -> 400 (ไม่ส่งลง Prisma)", junk.status, 400);

    // ปิดรอบที่เปิดค้างไว้ก่อน (เปิดได้ทีละรอบ) — เปิดคืนใน finally
    const before = (await call("GET", "/api/rounds", { token: oToken })).json.data || [];
    parked = before.filter((r) => r.status === "open").map((r) => r.round_id);
    for (const id of parked) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });

    const round = await call("POST", "/api/rounds", {
      token: oToken,
      body: { academic_year: YEAR, attempt_number: 1, open_date: "2020-01-01", close_date: "2099-12-31", subject_ids: [subjectId] },
    });
    check("สร้างรอบที่ใช้วิชานี้ -> 200", round.status, 200);
    const roundId = round.json?.data?.round_id;

    const del = await call("DELETE", `/api/subjects/${subjectId}`, { token: oToken });
    check("ลบวิชาที่รอบใช้อยู่ -> 409", del.status, 409);
    check("  ข้อความบอกว่ามีรอบใช้อยู่", del.json?.message?.includes("รอบ"), true);

    // ── 3. ประกาศ ──
    const badRound = await call("POST", "/api/news", { token: oToken, body: { title: "t", content: "c", round_id: 99999999 } });
    check("โพสต์ประกาศ round_id ที่ไม่มีจริง -> 400", badRound.status, 400);
    const blankTitle = await call("POST", "/api/news", { token: oToken, body: { title: "   ", content: "c", round_id: roundId } });
    check("โพสต์ประกาศหัวข้อว่าง -> 400", blankTitle.status, 400);

    // ── 4. เอกสารหลักฐาน ──
    await call("POST", "/api/students", { token: oToken, body: { student_id: STUDENT_ID, national_id: NATIONAL_ID } });
    const sToken = (await call("POST", "/api/auth/login", { body: { psu_passport_id: STUDENT_ID, password: NATIONAL_ID } })).cookie;
    const rooms = (await call("GET", "/api/rooms", { token: sToken })).json.data || [];
    await call("POST", "/api/students/complete-profile", {
      token: sToken,
      body: {
        first_name: "ก", last_name: "ข", first_name_en: "A", last_name_en: "B",
        email: `${STUDENT_ID}@test.local`, phone: "0800000000", room_id: rooms[0].room_id,
      },
    });
    await call("PATCH", "/api/students/bulk-eligible", { token: oToken, body: { student_ids: [STUDENT_ID], exam_eligible: true } });
    await call("PUT", `/api/rounds/${roundId}`, { token: oToken, body: { status: "open" } });

    const submit = await call("POST", "/api/exam-results", {
      token: sToken, body: { subject_results: [{ subject_id: subjectId, is_passed: true }] },
    });
    check("นักศึกษาส่งผล -> 200", submit.status, 200);
    const resultId = submit.json?.data?.result_id;

    const fake = await call("POST", `/api/exam-results/${resultId}/certificates`, {
      token: sToken, form: pdfForm("<html>not a pdf</html>"),
    });
    check("อัปโหลดไฟล์ปลอม (mimetype PDF แต่เนื้อเป็น HTML) -> 400", fake.status, 400);

    const real = await call("POST", `/api/exam-results/${resultId}/certificates`, {
      token: sToken, form: pdfForm("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n"),
    });
    check("อัปโหลด PDF จริง -> 200", real.status, 200);

    const approve = await call("PATCH", `/api/exam-results/${resultId}/approve`, { token: oToken, body: {} });
    check("เจ้าหน้าที่ยืนยัน -> 200", approve.status, 200);

    const afterApprove = await call("POST", `/api/exam-results/${resultId}/certificates`, {
      token: sToken, form: pdfForm("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n"),
    });
    check("เปลี่ยนเอกสารหลังยืนยันแล้ว -> 409", afterApprove.status, 409);

    const resubmit = await call("POST", "/api/exam-results", {
      token: sToken, body: { subject_results: [{ subject_id: subjectId, is_passed: false }] },
    });
    check("ส่งผลทับหลังยืนยันแล้ว -> 409", resubmit.status, 409);

    // ผลต้องไม่ถูกเปลี่ยน
    const mine = (await call("GET", "/api/exam-results/me", { token: sToken })).json.data || [];
    check("ผลที่ยืนยันแล้วยังเป็นผ่าน + approved", [mine[0]?.staff_status, mine[0]?.subject_results?.[0]?.is_passed], ["approved", true]);

    // ── 4.5 ถอนการยืนยัน (เจ้าหน้าที่ยืนยันผิด) ──
    const revokeUrl = `/api/exam-results/${resultId}/revoke-approval`;
    const rvToken = (await call("POST", "/api/auth/login", { body: { psu_passport_id: "321", password: "321" } })).cookie;
    check("reviewer ถอนการยืนยันไม่ได้ -> 403", (await call("PATCH", revokeUrl, { token: rvToken, body: { remark: "x" } })).status, 403);
    check("นักศึกษาถอนการยืนยันไม่ได้ -> 403", (await call("PATCH", revokeUrl, { token: sToken, body: { remark: "x" } })).status, 403);
    check("ถอนโดยไม่ใส่เหตุผล -> 400", (await call("PATCH", revokeUrl, { token: oToken, body: {} })).status, 400);
    const revoked = await call("PATCH", revokeUrl, { token: oToken, body: { remark: "กดยืนยันผิดใบ" } });
    check("officer ถอนการยืนยัน -> 200", revoked.status, 200);
    check("  ใบกลับเป็น pending + ล้างผู้ตรวจ", [revoked.json?.data?.staff_status, revoked.json?.data?.confirmed_by], ["pending", null]);
    check("ถอนซ้ำ (ไม่ใช่ approved แล้ว) -> 409", (await call("PATCH", revokeUrl, { token: oToken, body: { remark: "x" } })).status, 409);
    const notifs = (await call("GET", "/api/notifications/me", { token: sToken })).json.data || [];
    check("นักศึกษาได้แจ้งเตือน revoked", notifs.some((n) => n.type === "revoked" && n.message.includes("กดยืนยันผิดใบ")), true);
    // กติกาเดิมของใบ pending: รอบยังเปิด = นักศึกษาแก้ได้
    const redo = await call("POST", "/api/exam-results", {
      token: sToken, body: { subject_results: [{ subject_id: subjectId, is_passed: true }] },
    });
    check("ถอนแล้วรอบยังเปิด -> นักศึกษาแก้/ส่งใหม่ได้", redo.status, 200);
    check("เจ้าหน้าที่ยืนยันใหม่ได้", (await call("PATCH", `/api/exam-results/${resultId}/approve`, { token: oToken, body: {} })).status, 200);
    check("ยืนยันใหม่แล้วล็อกอีกครั้ง -> 409", (await call("POST", "/api/exam-results", {
      token: sToken, body: { subject_results: [{ subject_id: subjectId, is_passed: false }] } })).status, 409);

    // ── 5. 500 ต้องไม่หลุดข้อความดิบ (ยิง endpoint ที่ id เป็นขยะ) ──
    const garbage = await call("GET", "/api/exam-results?round_id=abc", { token: oToken });
    check("ส่ง round_id=abc -> ไม่ใช่ 500", garbage.status < 500, true);
    check("  ไม่มีชื่อตาราง/Prisma ในข้อความ", /prisma|invocation|findMany/i.test(garbage.json?.message || ""), false);

    // ── 6. รอบตรวจซ้ำ 25 ก.ย.: ลำดับรายการต้องนิ่ง (เดิม Postgres คืนตามลำดับบน disk แถวที่ถูกแก้ย้ายไปท้าย) ──
    const subs = (await call("GET", "/api/subjects", { token: oToken })).json.data.map((x) => x.subject_code);
    check("รายวิชาเรียงตามรหัสวิชา", subs, [...subs].sort());
    const studs = (await call("GET", "/api/students", { token: oToken })).json.data;
    let orderOk = true;
    for (let i = 1; i < studs.length; i++) {
      const a = studs[i - 1], b = studs[i];
      if (a.academic_year < b.academic_year || (a.academic_year === b.academic_year && a.student_id > b.student_id)) { orderOk = false; break; }
    }
    check("รายชื่อนักศึกษาเรียง รุ่นใหม่ก่อน แล้วตามรหัส", orderOk, true);

    // ── 7. ข้อมูลโปรไฟล์ที่เจ้าหน้าที่แก้ ──
    const patch = (body) => call("PATCH", `/api/students/${STUDENT_ID}`, { token: oToken, body });
    check("แก้ชื่อเป็นช่องว่าง -> 400", (await patch({ first_name: "   " })).status, 400);
    check("แก้อีเมลรูปแบบผิด -> 400", (await patch({ email: "not-an-email" })).status, 400);
    check("แก้เบอร์โทรเป็นตัวอักษร -> 400", (await patch({ phone: "abc" })).status, 400);
    check("แก้ชื่อยาวเกิน 100 -> 400", (await patch({ last_name: "ก".repeat(101) })).status, 400);
    check("เบอร์โทรแบบ +66 81-234-5678 -> 200", (await patch({ phone: "+66 81-234-5678" })).status, 200);

    // ── 8. อัปโหลดไฟล์ใหญ่เกินกำหนด: ข้อความต้องเป็นไทย ──
    const big = new FormData();
    big.append("file", new Blob([Buffer.alloc(6 * 1024 * 1024, "a")], { type: "text/csv" }), "big.csv");
    const bigRes = await call("POST", "/api/students/import", { token: oToken, form: big });
    check("import ไฟล์ 6MB (เกิน 5MB) -> 400", bigRes.status, 400);
    check("  ข้อความเป็นไทย", bigRes.json?.message?.includes("ไฟล์ใหญ่เกินกำหนด"), true);

    // ── 9. ประกาศ: ข้อความ error เป็นไทย ไม่มีชื่อ field อังกฤษ ──
    const newsEmpty = await call("POST", "/api/news", { token: oToken, body: {} });
    check("โพสต์ประกาศว่าง -> 400 ข้อความไทย", [newsEmpty.status, /title|content|round_id/.test(newsEmpty.json?.message || "")], [400, false]);
  } finally {
    await cleanupYears([YEAR]);
    // ลบวิชาทดสอบ (รอบที่อ้างถึงถูก cleanupYears ลบแล้ว)
    for (const id of createdSubjects) await call("DELETE", `/api/subjects/${id}`, { token: oToken });
    for (const id of parked) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "open" } });
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error(e); process.exit(1); });
