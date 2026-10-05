// Export ข้อมูล — รายชื่อผ่าน/ไม่ผ่านรอบแรก (Excel/PDF), ข้อมูลนักศึกษา (Excel), รายชื่อรายวิชา (Excel เพิ่มจาก PDF เดิม)
//
// ที่เทสนี้คุม:
//   1. ผ่านรอบแรก + ไม่ผ่านรอบแรก = ทั้งรุ่นเสมอ และ "ผ่าน" ตรงกับตัวเลข firstAttempt.passed บน dashboard เป๊ะ
//      (นับเฉพาะใบที่ "ยืนยันแล้ว" — ใบรอตรวจอยู่กลุ่มไม่ผ่านพร้อมสถานะรอตรวจสอบ)
//   2. คนที่ไม่ผ่านเพราะไม่ส่ง / ถูกตีกลับ ต้องอยู่ในรายชื่อ "ไม่ผ่าน" พร้อมสถานะที่บอกสาเหตุ
//   3. ไฟล์ Excel ของนักศึกษาไม่มีเลขบัตรประชาชน (= รหัสผ่านเริ่มต้น)
//   4. เฉพาะ officer (reviewer / executive / student = 403) · พารามิเตอร์แปลก = 400 ไม่ใช่ 500
//
// ปีที่ใช้ 2592 (รหัสขึ้นต้น 88) และ 2591 (ไม่มีรอบ) — ล้างตอนจบด้วย cleanupYears
import { readSheet } from "read-excel-file/node";
import { cleanupYears } from "./cleanupYears.mjs";

import { autoAttachEvidence } from "./autoEvidence.mjs";
const BASE = process.env.BASE || "http://localhost:3000";
let failures = 0;

const call = async (method, url, { token, body } = {}) => {
  const headers = {};
  if (token) headers.Cookie = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const type = res.headers.get("content-type") || "";
  // ไฟล์ (xlsx/pdf) อ่านเป็น buffer · อย่างอื่นเป็น JSON
  const isFile = /spreadsheetml|pdf/.test(type);
  const buffer = isFile ? Buffer.from(await res.arrayBuffer()) : null;
  const json = isFile ? {} : await res.json().catch(() => ({}));
  const setCookie = res.headers.get("set-cookie");
  await autoAttachEvidence(BASE, method, url, token, { status: res.status, json });
  return { status: res.status, json, buffer, type, disposition: res.headers.get("content-disposition") || "", cookie: setCookie ? setCookie.split(";")[0] : null };
};

const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
};

const YEAR = 2592;
const NO_ROUND_YEAR = 2591;
const PREFIX = String(YEAR - 4).slice(-2);
const PREFIX2 = String(NO_ROUND_YEAR - 4).slice(-2);
const STAMP = Date.now().toString().slice(-6);
const sid = (n) => `${PREFIX}${STAMP}0${n}`;
const nid = (n) => `1${STAMP}0000${n}`.slice(0, 13).padEnd(13, "0");
// A ผ่านครบ+ยืนยันแล้ว · B ผ่านครบ แต่ยังรอตรวจ (ยังไม่นับว่าผ่าน) · C ผ่าน 2/3 · D ไม่ส่ง · E ส่งแล้วถูกตีกลับ
const ID = { A: sid(1), B: sid(2), C: sid(3), D: sid(4), E: sid(5) };
const ID_NO_ROUND = `${PREFIX2}${STAMP}09`;

// อ่านไฟล์ xlsx เป็นแถว (ข้ามแถวหัวตาราง) + ชื่อคอลัมน์
const parse = async (buffer) => {
  const rows = await readSheet(buffer, { parseNumber: (t) => t });
  return { header: rows[0], body: rows.slice(1) };
};

let parkedRounds = [];
const main = async () => {
  const login = async (u, p) => (await call("POST", "/api/auth/login", { body: { psu_passport_id: u, password: p } })).cookie;
  const oToken = await login("456", "456");
  check("login officer", !!oToken, true);

  try {
    const rooms = (await call("GET", "/api/rooms", { token: oToken })).json.data;
    const subjects = (await call("GET", "/api/subjects", { token: oToken })).json.data;
    const use = subjects.slice(0, 3);
    const codes = use.map((s) => s.subject_code);

    // ── สร้างนักศึกษา 5 คนของรุ่น 2592 + 1 คนของรุ่น 2591 (ไม่มีรอบ) ──
    const tokens = {};
    for (const [k, id] of Object.entries({ ...ID, X: ID_NO_ROUND })) {
      const n = Object.keys({ ...ID, X: 0 }).indexOf(k) + 1;
      const nat = nid(k === "X" ? 9 : n);
      await call("POST", "/api/students", { token: oToken, body: { student_id: id, national_id: nat } });
      const l = await call("POST", "/api/auth/login", { body: { psu_passport_id: id, password: nat } });
      await call("POST", "/api/students/complete-profile", {
        token: l.cookie,
        body: { first_name: `ทดสอบ${k}`, last_name: "ส่งออก", first_name_en: "T", last_name_en: "E", email: `${id}@test.local`, phone: "0812345678", room_id: rooms[0].room_id },
      });
      tokens[k] = l.cookie;
    }
    await call("PATCH", "/api/students/bulk-eligible", { token: oToken, body: { student_ids: Object.values(ID), exam_eligible: true } });

    // ── รอบ 1 ของรุ่น 2592 (ปิดรอบจริงที่เปิดค้างไว้ชั่วคราว แล้วเปิดคืนใน finally) ──
    const now = (await call("GET", "/api/rounds", { token: oToken })).json.data || [];
    parkedRounds = now.filter((r) => r.status === "open").map((r) => r.round_id);
    for (const id of parkedRounds) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });
    const rnd = await call("POST", "/api/rounds", { token: oToken, body: { academic_year: YEAR, attempt_number: 1, open_date: "2020-01-01", close_date: "2099-12-31", subject_ids: use.map((s) => s.subject_id) } });
    check("สร้างรอบ 1/2592 -> 200", rnd.status, 200);
    const roundId = rnd.json.data.round_id;
    await call("PUT", `/api/rounds/${roundId}`, { token: oToken, body: { status: "open" } });

    const submit = async (who, passList) =>
      (await call("POST", "/api/exam-results", { token: tokens[who], body: { subject_results: use.map((s, i) => ({ subject_id: s.subject_id, is_passed: passList[i] })) } }));
    const rA = await submit("A", [true, true, true]);
    const rB = await submit("B", [true, true, true]);
    const rC = await submit("C", [true, true, false]);
    const rE = await submit("E", [true, true, true]);
    check("ส่งผลสอบ A/B/C/E -> 200", [rA.status, rB.status, rC.status, rE.status], [200, 200, 200, 200]);
    check("approve A", (await call("PATCH", `/api/exam-results/${rA.json.data.result_id}/approve`, { token: oToken })).status, 200);
    check("reject E", (await call("PATCH", `/api/exam-results/${rE.json.data.result_id}/reject`, { token: oToken, body: { remark: "เอกสารไม่ชัด" } })).status, 200);

    // ── 1. ผ่าน/ไม่ผ่านรอบแรก ──
    const pass = await call("GET", `/api/dashboard/export-first-attempt?year=${YEAR}&passed=true`, { token: oToken });
    const fail = await call("GET", `/api/dashboard/export-first-attempt?year=${YEAR}&passed=false`, { token: oToken });
    check("GET ผ่านรอบแรก (xlsx) -> 200 เป็นไฟล์ Excel", [pass.status, /spreadsheetml/.test(pass.type)], [200, true]);
    check("  ชื่อไฟล์ภาษาไทยส่งผ่าน filename*=UTF-8", pass.disposition.includes("filename*=UTF-8''"), true);
    const P = await parse(pass.buffer);
    const F = await parse(fail.buffer);
    const col = (t, name) => t.header.indexOf(name);
    const idsOf = (t) => t.body.map((r) => r[col(t, "รหัสนักศึกษา")]);
    // 1 ต.ค. 2569: เพิ่มชื่อ-นามสกุลอังกฤษ เบอร์โทร อีเมล (คณะต้องใช้ติดต่อ/ออกเอกสาร — docs/test-plan.md ข้อ F3)
    check("  หัวคอลัมน์ครบ", P.header, ["ลำดับ", "รหัสนักศึกษา", "ชื่อ", "นามสกุล", "ชื่อ (อังกฤษ)", "นามสกุล (อังกฤษ)", "ห้อง", "เบอร์โทร", "อีเมล", "สถานะใบผลสอบรอบแรก", "ผ่านกี่วิชา", "วิชาที่ไม่ผ่าน"]);
    check("  ผ่านรอบแรก = A คนเดียว (นับเฉพาะใบที่ยืนยันแล้ว)", idsOf(P).sort(), [ID.A]);
    check("  ไม่ผ่านรอบแรก = B, C, D, E (รอตรวจ / ผ่านไม่ครบ / ไม่ส่ง / ถูกตีกลับ)", idsOf(F).sort(), [ID.B, ID.C, ID.D, ID.E].sort());
    check("  ผ่าน + ไม่ผ่าน = ทั้งรุ่น (5 คน)", idsOf(P).length + idsOf(F).length, 5);

    const rowOf = (t, id) => Object.fromEntries(t.header.map((h, i) => [h, t.body.find((r) => r[col(t, "รหัสนักศึกษา")] === id)?.[i]]));
    check("  A = ยืนยันแล้ว 3/3", [rowOf(P, ID.A)["สถานะใบผลสอบรอบแรก"], rowOf(P, ID.A)["ผ่านกี่วิชา"]], ["ยืนยันแล้ว", "3/3"]);
    check("  B = รอตรวจสอบ (ยังไม่นับว่าผ่าน แต่โชว์ 3/3 ให้เห็น)", [rowOf(F, ID.B)["สถานะใบผลสอบรอบแรก"], rowOf(F, ID.B)["ผ่านกี่วิชา"]], ["รอตรวจสอบ", "3/3"]);
    check("  C = ผ่าน 2/3 + บอกวิชาที่ตก", [rowOf(F, ID.C)["ผ่านกี่วิชา"], rowOf(F, ID.C)["วิชาที่ไม่ผ่าน"]], ["2/3", codes[2]]);
    check("  D = ยังไม่ได้กรอก", rowOf(F, ID.D)["สถานะใบผลสอบรอบแรก"], "ยังไม่ได้กรอก");
    check("  E = ถูกตีกลับ (ไม่นับว่าผ่าน แม้ตอนส่งผ่านครบ)", rowOf(F, ID.E)["สถานะใบผลสอบรอบแรก"], "ถูกตีกลับ");

    // ตรงกับตัวเลขบนการ์ดเทียบรายปี (dashboard/history) เป๊ะ
    const hist = (await call("GET", "/api/dashboard/history?years=10", { token: oToken })).json.data;
    const y = hist.years.find((v) => v.academic_year === YEAR);
    check("  ยอดผ่านในไฟล์ = firstAttempt.passed บน dashboard", [idsOf(P).length, y?.firstAttempt?.passed, y?.total], [1, 1, 5]);

    // ยืนยัน B → นับเป็นผ่านทันที ทั้งในไฟล์และตัวเลขบน dashboard/stats (ตัวเลขทุกตัวใช้ฐาน "ยืนยันแล้ว" เดียวกัน)
    const statsBefore = (await call("GET", `/api/dashboard/stats?round_id=${roundId}`, { token: oToken })).json.data;
    check("stats ก่อนยืนยัน B: ผ่านครบ 1 · ยืนยัน 1 · รอตรวจ 2 (B และ C)", [statsBefore.fullyPassed, statsBefore.confirmed, statsBefore.by.submitted], [1, 1, 2]);
    check("  อัตราผ่านของผู้ยืนยันแล้ว = 100% (1/1 ไม่ถูกใบรอตรวจลากลง)", statsBefore.passRateOfSitters, 100);
    check("approve B", (await call("PATCH", `/api/exam-results/${rB.json.data.result_id}/approve`, { token: oToken })).status, 200);
    const passAfter = await parse((await call("GET", `/api/dashboard/export-first-attempt?year=${YEAR}&passed=true`, { token: oToken })).buffer);
    const histAfter = (await call("GET", "/api/dashboard/history?years=10", { token: oToken })).json.data.years.find((v) => v.academic_year === YEAR);
    const statsAfter = (await call("GET", `/api/dashboard/stats?round_id=${roundId}`, { token: oToken })).json.data;
    check("หลังยืนยัน B: ไฟล์ผ่าน = A,B · firstAttempt.passed = 2 · stats.fullyPassed = 2", [idsOf(passAfter).sort(), histAfter.firstAttempt.passed, statsAfter.fullyPassed], [[ID.A, ID.B].sort(), 2, 2]);

    const pdf = await call("GET", `/api/dashboard/export-first-attempt?year=${YEAR}&passed=false&format=pdf`, { token: oToken });
    check("GET ไม่ผ่านรอบแรก (pdf) -> 200 เป็น PDF จริง", [pdf.status, pdf.type, pdf.buffer?.subarray(0, 4).toString()], [200, "application/pdf", "%PDF"]);

    for (const [name, url, want] of [
      ["ไม่ระบุ year", `/api/dashboard/export-first-attempt?passed=true`, 400],
      ["year ไม่ใช่ตัวเลข", `/api/dashboard/export-first-attempt?year=abc&passed=true`, 400],
      ["passed ผิด", `/api/dashboard/export-first-attempt?year=${YEAR}&passed=maybe`, 400],
      ["format ผิด", `/api/dashboard/export-first-attempt?year=${YEAR}&passed=true&format=csv`, 400],
      ["ปีที่ไม่มีรอบแรก", `/api/dashboard/export-first-attempt?year=${NO_ROUND_YEAR}&passed=true`, 404],
    ]) {
      check(`first-attempt ${name} -> ${want}`, (await call("GET", url, { token: oToken })).status, want);
    }
    for (const [who, u, p] of [["reviewer", "321", "321"], ["executive", "789", "789"], ["student", ID.A, nid(1)]]) {
      const t = await login(u, p);
      check(`${who} export-first-attempt -> 403`, (await call("GET", `/api/dashboard/export-first-attempt?year=${YEAR}&passed=true`, { token: t })).status, 403);
      check(`${who} POST students/export -> 403`, (await call("POST", "/api/students/export", { token: t, body: { year: YEAR } })).status, 403);
    }
    check("ไม่ login export-first-attempt -> 401", (await call("GET", `/api/dashboard/export-first-attempt?year=${YEAR}&passed=true`)).status, 401);

    // ── 2. ข้อมูลนักศึกษา (Excel) ──
    const byYear = await call("POST", "/api/students/export", { token: oToken, body: { year: YEAR } });
    check("POST students/export {year} -> 200 Excel", [byYear.status, /spreadsheetml/.test(byYear.type)], [200, true]);
    const S = await parse(byYear.buffer);
    check("  ทั้งรุ่น 2592 = 5 คน", idsOf(S).sort(), Object.values(ID).sort());
    check("  หัวคอลัมน์ครบ", S.header, ["รหัสนักศึกษา", "ชื่อ", "นามสกุล", "ชื่อ (อังกฤษ)", "นามสกุล (อังกฤษ)", "ห้อง", "ปีการศึกษาที่จบ", "อีเมล", "เบอร์โทร", "สิทธิ์กรอกผลสอบ", "รอบล่าสุดที่ส่ง", "สถานะใบล่าสุด", "ผ่านกี่วิชา (ใบล่าสุด)"]);
    check("  A = ยืนยันแล้ว รอบที่ 1/2592 3/3", [rowOf(S, ID.A)["สถานะใบล่าสุด"], rowOf(S, ID.A)["รอบล่าสุดที่ส่ง"], rowOf(S, ID.A)["ผ่านกี่วิชา (ใบล่าสุด)"]], ["ยืนยันแล้ว", `รอบที่ 1/${YEAR}`, "3/3"]);
    check("  D = ยังไม่ได้กรอก", rowOf(S, ID.D)["สถานะใบล่าสุด"], "ยังไม่ได้กรอก");
    check("  เบอร์โทรไม่ถูกตัดเลข 0 หน้า (เก็บเป็นข้อความ)", rowOf(S, ID.A)["เบอร์โทร"], "0812345678");
    // เลขบัตรประชาชน = รหัสผ่านเริ่มต้น ต้องไม่อยู่ในไฟล์เลย (ทั้งที่หัวคอลัมน์และค่า)
    const all = JSON.stringify([S.header, ...S.body]);
    check("  ไม่มีเลขบัตรประชาชนหลุดในไฟล์", [1, 2, 3, 4, 5].some((n) => all.includes(nid(n))), false);
    check("  ไม่มีคำว่า password / national", /password|national/i.test(all), false);

    const byIds = await call("POST", "/api/students/export", { token: oToken, body: { student_ids: [ID.A, ID.C, ID.A, "ไม่มีรหัสนี้"] } });
    const S2 = await parse(byIds.buffer);
    check("POST students/export {student_ids} -> เฉพาะที่ส่งมา (ซ้ำรวมกัน รหัสที่ไม่มีข้ามไป)", idsOf(S2).sort(), [ID.A, ID.C].sort());

    for (const [name, body, want] of [
      ["ไม่ส่งอะไรเลย", {}, 400],
      ["student_ids ว่าง", { student_ids: [] }, 400],
      ["student_ids ไม่ใช่รายการ", { student_ids: "abc" }, 400],
      ["student_ids มีตัวเลข", { student_ids: [123] }, 400],
      ["year ไม่ใช่ปี พ.ศ.", { year: 1999 }, 400],
      ["student_ids เยอะเกิน 5000", { student_ids: Array.from({ length: 5001 }, (_, i) => String(i)) }, 400],
    ]) {
      check(`students/export ${name} -> ${want}`, (await call("POST", "/api/students/export", { token: oToken, body })).status, want);
    }

    // ── 3. รายชื่อรายวิชา: Excel เพิ่มเข้ามา PDF เดิมต้องยังใช้ได้ ──
    const q = `subject_code=${codes[0]}&passed=true&round_id=${roundId}`;
    const subjX = await call("GET", `/api/students/export-subject?${q}&format=xlsx`, { token: oToken });
    const SX = await parse(subjX.buffer);
    check("export-subject xlsx -> 200 มีคนที่ผ่านและยืนยันแล้ว (A, B)", [subjX.status, idsOf(SX).sort()], [200, [ID.A, ID.B].sort()]);
    const subjP = await call("GET", `/api/students/export-subject?${q}`, { token: oToken });
    check("export-subject ไม่ระบุ format = PDF เหมือนเดิม", [subjP.status, subjP.type], [200, "application/pdf"]);
    check("export-subject format ผิด -> 400", (await call("GET", `/api/students/export-subject?${q}&format=doc`, { token: oToken })).status, 400);
  } finally {
    await cleanupYears([YEAR, NO_ROUND_YEAR]);
    for (const id of parkedRounds) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "open" } });
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error(e); process.exit(1); });
