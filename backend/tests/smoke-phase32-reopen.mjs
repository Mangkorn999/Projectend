// เทส "แก้ไขผลการตรวจ" (PATCH /api/exam-results/:id/reopen) และวงจรสถานะใบผลสอบ (4 ต.ค. 2569)
//
// วงจรที่ต้องเป็น:
//   รอตรวจ ──ยืนยัน──▶ ยืนยันแล้ว ──แก้ไขผลการตรวจ──▶ รอตรวจ
//   รอตรวจ ──ตีกลับ──▶ ถูกตีกลับ  ──แก้ไขผลการตรวจ──▶ รอตรวจ
//   ยืนยัน/ตีกลับ ทำได้เฉพาะใบรอตรวจ → ยืนยันซ้ำ / ตีกลับซ้ำ / ตีกลับใบที่ยืนยันแล้ว ต้องได้ 409
//
//   A. ยืนยัน/ตีกลับซ้ำและข้ามสถานะ = 409
//   B. แก้ไขผลการตรวจจาก "ยืนยันแล้ว" → รอตรวจ (ล้าง remark, บันทึก log, แจ้งเตือนนักศึกษา) แล้วตีกลับได้
//   C. แก้ไขผลการตรวจจาก "ถูกตีกลับ" → รอตรวจ (เหตุผลที่ตีกลับถูกล้าง) แล้วยืนยันได้
//   D. กติกาของ endpoint: ต้องมีเหตุผล / ใบรอตรวจแก้ไม่ได้ / สิทธิ์ (เฉพาะ officer) / เหตุผลยาวเกิน
//   E. endpoint เดิม revoke-approval ยังทำงานเหมือนเดิม
//   F. กดแก้ไขพร้อมกัน — สำเร็จได้ครั้งเดียว
//
// ปีทดสอบ 2595 (cleanupYears ล้างให้ตอนจบ — ห้ามใช้ปีจริง)
import { cleanupYears } from "./cleanupYears.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
let failures = 0;

const call = async (method, url, { token, body } = {}) => {
  const headers = {};
  if (token) headers.Cookie = token;
  let payload;
  if (body !== undefined) {
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

const YEAR = 2595;
const PREFIX = String(YEAR - 4).slice(-2);
const STAMP = Date.now().toString().slice(-6);
const nid = (i) => `1${STAMP}0000${i}`.slice(0, 13).padEnd(13, "0");
const NOW = { open_date: "2020-01-01", close_date: "2099-12-31" };

const main = async () => {
  const login = async (u, p) => (await call("POST", "/api/auth/login", { body: { psu_passport_id: u, password: p } })).cookie;
  const oToken = await login("456", "456");
  const rToken = await login("321", "321"); // ผู้ช่วยตรวจสอบ (reviewer)
  if (!oToken || !rToken) { console.log("login seed officer/reviewer failed"); process.exit(1); }

  // ปิดรอบที่เปิดค้างอยู่ชั่วคราว (ระบบเปิดได้ทีละรอบ) แล้วคืนตอนจบ
  const parked = ((await call("GET", "/api/rounds", { token: oToken })).json.data || []).filter((r) => r.status === "open").map((r) => r.round_id);
  for (const id of parked) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });

  try {
    const rooms = (await call("GET", "/api/rooms", { token: oToken })).json.data;
    const subjects = (await call("GET", "/api/subjects", { token: oToken })).json.data;
    const [s1, s2] = subjects.slice(0, 2);

    // ── นักศึกษา 5 คน (คนละใบ ไม่ปนกัน) ──
    const NAMES = ["A", "B", "C", "D", "F"];
    const ID = {};
    const tokens = {};
    for (let i = 0; i < NAMES.length; i++) {
      const who = NAMES[i];
      ID[who] = `${PREFIX}${STAMP}0${i + 1}`;
      await call("POST", "/api/students", { token: oToken, body: { student_id: ID[who], national_id: nid(i + 1) } });
      const l = await call("POST", "/api/auth/login", { body: { psu_passport_id: ID[who], password: nid(i + 1) } });
      await call("POST", "/api/students/complete-profile", {
        token: l.cookie,
        body: { first_name: `ทดสอบ${who}`, last_name: "แก้ไขผล", first_name_en: `Test${who}`, last_name_en: "Reopen", email: `${ID[who]}@test.local`, phone: "0812345678", room_id: rooms[0].room_id },
      });
      tokens[who] = l.cookie;
    }

    const r1 = await call("POST", "/api/rounds", { token: oToken, body: { academic_year: YEAR, attempt_number: 1, ...NOW, subject_ids: [s1.subject_id, s2.subject_id] } });
    const round1 = r1.json.data.round_id;
    await call("PUT", `/api/rounds/${round1}`, { token: oToken, body: { status: "open" } });

    const send = async (who) => (await call("POST", "/api/exam-results", {
      token: tokens[who],
      body: { subject_results: [{ subject_id: s1.subject_id, is_passed: true }, { subject_id: s2.subject_id, is_passed: true }] },
    })).json.data.result_id;
    const paper = async (who) => ((await call("GET", `/api/exam-results?student_id=${ID[who]}`, { token: oToken })).json.data || [])[0];
    const approve = (id, token = oToken) => call("PATCH", `/api/exam-results/${id}/approve`, { token });
    const reject = (id, remark = "ไฟล์ไม่ชัด", token = oToken) => call("PATCH", `/api/exam-results/${id}/reject`, { token, body: { remark } });
    const reopen = (id, remark, token = oToken) => call("PATCH", `/api/exam-results/${id}/reopen`, { token, body: remark === undefined ? {} : { remark } });

    // ════════ A. ยืนยัน/ตีกลับซ้ำและข้ามสถานะ ════════
    console.log("\n── A. ยืนยัน/ตีกลับซ้ำ ──");
    const idA = await send("A");
    check("ยืนยันใบรอตรวจ -> 200", (await approve(idA)).status, 200);
    check("ยืนยันซ้ำ -> 409", (await approve(idA)).status, 409);
    check("ตีกลับใบที่ยืนยันแล้ว (ต้องกดแก้ไขก่อน) -> 409", (await reject(idA)).status, 409);
    check("  ใบยังเป็น approved ไม่ถูกตีกลับ", (await paper("A")).staff_status, "approved");

    const idB = await send("B");
    check("ตีกลับใบรอตรวจ -> 200", (await reject(idB)).status, 200);
    check("ตีกลับซ้ำ -> 409", (await reject(idB)).status, 409);
    check("ยืนยันใบที่ถูกตีกลับ (ต้องกดแก้ไขก่อน) -> 409", (await approve(idB)).status, 409);
    check("  ใบยังเป็น rejected", (await paper("B")).staff_status, "rejected");

    // ════════ B. แก้ไขผลการตรวจจาก "ยืนยันแล้ว" ════════
    console.log("\n── B. แก้ไขจากยืนยันแล้ว → รอตรวจ → ตีกลับ ──");
    check("แก้ไขโดยไม่ใส่เหตุผล -> 400", (await reopen(idA)).status, 400);
    check("แก้ไขด้วยเหตุผลว่างเปล่า (เว้นวรรค) -> 400", (await reopen(idA, "   ")).status, 400);
    check("  ใบยังเป็น approved (คำขอที่ถูกปฏิเสธไม่เปลี่ยนอะไร)", (await paper("A")).staff_status, "approved");
    const reopenA = await reopen(idA, "กดยืนยันผิดใบ");
    check("แก้ไขพร้อมเหตุผล -> 200", reopenA.status, 200);
    check("  สถานะกลับเป็น pending", reopenA.json.data?.staff_status, "pending");
    check("  ล้างผู้ยืนยัน (confirmed_by)", reopenA.json.data?.confirmed_by, null);
    check("  ล้างวันที่ยืนยัน (confirmed_at)", reopenA.json.data?.confirmed_at, null);
    const logsA = (await paper("A")).review_logs || [];
    const lastLogA = logsA[logsA.length - 1] || {};
    check("  บันทึกประวัติ action = reopened พร้อมเหตุผล", [lastLogA.action, lastLogA.remark], ["reopened", "กดยืนยันผิดใบ"]);
    const notiA = (await call("GET", "/api/notifications/me", { token: tokens.A })).json.data || [];
    check("  นักศึกษาได้แจ้งเตือนว่าใบกลับเป็นรอตรวจ", notiA.some((n) => n.type === "revoked" && /รอตรวจสอบ/.test(n.message) && /กดยืนยันผิดใบ/.test(n.message)), true);
    check("หลังแก้ไข ตีกลับได้ตามปกติ -> 200", (await reject(idA, "ตรวจแล้วเอกสารไม่ครบ")).status, 200);
    check("  สถานะเป็น rejected", (await paper("A")).staff_status, "rejected");

    // ════════ C. แก้ไขผลการตรวจจาก "ถูกตีกลับ" ════════
    console.log("\n── C. แก้ไขจากถูกตีกลับ → รอตรวจ → ยืนยัน ──");
    const rejectedBefore = await paper("B");
    check("ใบ B ถูกตีกลับพร้อมเหตุผล", [rejectedBefore.staff_status, rejectedBefore.remark], ["rejected", "ไฟล์ไม่ชัด"]);
    const reopenB = await reopen(idB, "ตีกลับผิดใบ");
    check("แก้ไขใบที่ถูกตีกลับ -> 200", reopenB.status, 200);
    check("  สถานะกลับเป็น pending", reopenB.json.data?.staff_status, "pending");
    check("  เหตุผลที่ตีกลับครั้งก่อนถูกล้าง (นักศึกษาไม่เห็นของเก่า)", reopenB.json.data?.remark, null);
    const logsB = (await paper("B")).review_logs || [];
    check("  ประวัติเก็บครบ: rejected แล้ว reopened", logsB.map((l) => l.action).filter((a) => a === "rejected" || a === "reopened"), ["rejected", "reopened"]);
    const notiB = (await call("GET", "/api/notifications/me", { token: tokens.B })).json.data || [];
    check("  นักศึกษาได้แจ้งเตือนว่าการตีกลับถูกยกเลิก", notiB.some((n) => n.type === "revoked" && /ถูกตีกลับ/.test(n.message) && /ตีกลับผิดใบ/.test(n.message)), true);
    check("หลังแก้ไข ยืนยันได้ตามปกติ -> 200", (await approve(idB)).status, 200);
    check("  สถานะเป็น approved", (await paper("B")).staff_status, "approved");

    // ════════ D. กติกาของ endpoint ════════
    console.log("\n── D. กติกา/สิทธิ์ ──");
    const idC = await send("C");
    const onPending = await reopen(idC, "ลองกดแก้ไขใบรอตรวจ");
    check("แก้ไขใบที่ยังรอตรวจ (ยืนยัน/ตีกลับได้เลย) -> 409", onPending.status, 409);
    check("  ข้อความเป็นภาษาไทย", /ยืนยันแล้วหรือถูกตีกลับ/.test(onPending.json.message || ""), true);
    check("แก้ไขใบที่ไม่มีอยู่ -> 404", (await reopen(99999999, "x")).status, 404);
    await reject(idC, "ไฟล์เบลอ");
    check("reviewer แก้ไขผลการตรวจ -> 403", (await reopen(idC, "ลอง", rToken)).status, 403);
    check("นักศึกษาแก้ไขผลการตรวจ -> 403", (await reopen(idC, "ลอง", tokens.C)).status, 403);
    check("ไม่ล็อกอินแก้ไขผลการตรวจ -> 401", (await call("PATCH", `/api/exam-results/${idC}/reopen`, { body: { remark: "x" } })).status, 401);
    check("เหตุผลยาวเกิน 500 ตัวอักษร -> 400", (await reopen(idC, "ก".repeat(501))).status, 400);
    check("  ใบยังเป็น rejected (คำขอที่ถูกปฏิเสธไม่เปลี่ยนอะไร)", (await paper("C")).staff_status, "rejected");
    check("เหตุผลยาว 500 ตัวพอดี -> 200", (await reopen(idC, "ก".repeat(500))).status, 200);

    // ════════ E. endpoint เดิม revoke-approval ════════
    console.log("\n── E. revoke-approval (endpoint เดิม) ──");
    const idD = await send("D");
    await approve(idD);
    const oldRevoke = (id, remark) => call("PATCH", `/api/exam-results/${id}/revoke-approval`, { token: oToken, body: { remark } });
    check("revoke-approval ใบที่ยืนยันแล้ว -> 200", (await oldRevoke(idD, "ยืนยันผิด")).status, 200);
    check("  สถานะกลับเป็น pending", (await paper("D")).staff_status, "pending");
    await reject(idD, "ทดสอบ");
    const oldOnRejected = await oldRevoke(idD, "ลอง");
    check("revoke-approval ใบที่ถูกตีกลับ -> 409 (endpoint เดิมไม่รับ ต้องใช้ reopen)", oldOnRejected.status, 409);
    check("  ข้อความเดิมไม่เปลี่ยน", /ถอนการยืนยันได้เฉพาะใบที่ยืนยันแล้ว/.test(oldOnRejected.json.message || ""), true);

    // ════════ F. กดแก้ไขพร้อมกัน ════════
    console.log("\n── F. กดพร้อมกัน ──");
    const idF = await send("F");
    await approve(idF);
    const race = await Promise.all([reopen(idF, "ครั้งที่ 1"), reopen(idF, "ครั้งที่ 2"), reopen(idF, "ครั้งที่ 3")]);
    const codes = race.map((r) => r.status).sort();
    check("แก้ไขพร้อมกัน 3 คำขอ → สำเร็จ 1 ที่เหลือ 409", codes, [200, 409, 409]);
    const logsF = ((await paper("F")).review_logs || []).filter((l) => l.action === "reopened");
    check("  มีประวัติ reopened แค่ 1 แถว", logsF.length, 1);
    check("  ใบเป็น pending", (await paper("F")).staff_status, "pending");
  } finally {
    await cleanupYears([YEAR]);
    for (const id of parked) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "open" } });
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error(e); process.exit(1); });
