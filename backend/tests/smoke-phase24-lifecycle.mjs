// วงจรชีวิตเต็มของรุ่นหนึ่ง: รอบ 1 → 2 → 3 (กรอก / ตีกลับ / ยืนยัน / ยกผลรอบก่อน / ประกาศ / สถิติ)
// + ของที่เพิ่มรอบนี้: ส่งออกข้อมูลนักศึกษาแยกตามรอบ (Excel หลายชีต) + ชื่อภาษาอังกฤษ
//   และการสร้างบัญชีผู้บริหารโดยไม่ต้องมีอีเมล/เบอร์โทร
//
// ตัวละครของรุ่น 2593 (รหัสขึ้นต้น 89):
//   S1 รอบ 1 ผ่านครบ + ยืนยัน                      → ผ่านครั้งแรก
//   S2 รอบ 1 ผ่าน 1/3 + ยืนยัน → รอบ 2 แก้วิชาที่ตก → ผ่านภายในปีแรก (ไม่ใช่ผ่านครั้งแรก)
//   S3 รอบ 1 ผ่าน 2/3 → ถูกตีกลับ → ส่งใหม่ผ่านครบ  → ผ่านครั้งแรก (ใบรอบ 1 ที่ยืนยันแล้วผ่านครบ)
//   S4 ไม่ส่งรอบ 1/2 → รอบ 3 ส่งผ่านครบ              → ผ่านภายในปีแรก
//   S5 ไม่ส่งเลย
// ตัวเลขที่ต้องได้: ผ่านครั้งแรก 2/5 (S1,S3) · ผ่านภายในปีแรก 4/5 (S1,S2,S3,S4)
//
// ปีที่ใช้ 2593 — ล้างตอนจบด้วย cleanupYears
import readXlsxFile from "read-excel-file/node";
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
  const isFile = /spreadsheetml|pdf/.test(type);
  const buffer = isFile ? Buffer.from(await res.arrayBuffer()) : null;
  const json = isFile ? {} : await res.json().catch(() => ({}));
  const setCookie = res.headers.get("set-cookie");
  await autoAttachEvidence(BASE, method, url, token, { status: res.status, json });
  return { status: res.status, json, buffer, type, cookie: setCookie ? setCookie.split(";")[0] : null };
};

const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
};

const YEAR = 2593;
const PREFIX = String(YEAR - 4).slice(-2);
const STAMP = Date.now().toString().slice(-6);
const sid = (n) => `${PREFIX}${STAMP}0${n}`;
const nid = (n) => `1${STAMP}0000${n}`.slice(0, 13).padEnd(13, "0");
const ID = { S1: sid(1), S2: sid(2), S3: sid(3), S4: sid(4), S5: sid(5) };

let parkedRounds = [];
let extraUserIds = [];

const main = async () => {
  const login = async (u, p) => (await call("POST", "/api/auth/login", { body: { psu_passport_id: u, password: p } })).cookie;
  const oToken = await login("456", "456");
  check("login officer", !!oToken, true);

  try {
    const rooms = (await call("GET", "/api/rooms", { token: oToken })).json.data;
    const subjects = (await call("GET", "/api/subjects", { token: oToken })).json.data;
    const use = subjects.slice(0, 3);
    const [sub1, sub2, sub3] = use;

    // ── เตรียมนักศึกษา 5 คน ──
    const tokens = {};
    let n = 0;
    for (const [k, id] of Object.entries(ID)) {
      n += 1;
      await call("POST", "/api/students", { token: oToken, body: { student_id: id, national_id: nid(n) } });
      const l = await call("POST", "/api/auth/login", { body: { psu_passport_id: id, password: nid(n) } });
      const cp = await call("POST", "/api/students/complete-profile", {
        token: l.cookie,
        body: { first_name: `ทดสอบ${k}`, last_name: "วงจร", first_name_en: `Test${k}`, last_name_en: "Lifecycle", email: `${id}@test.local`, phone: "0812345678", room_id: rooms[0].room_id },
      });
      if (cp.status !== 200 && cp.status !== 201) console.log("complete-profile", cp.status, JSON.stringify(cp.json));
      tokens[k] = l.cookie;
    }
    await call("PATCH", "/api/students/bulk-eligible", { token: oToken, body: { student_ids: Object.values(ID), exam_eligible: true } });

    const now = (await call("GET", "/api/rounds", { token: oToken })).json.data || [];
    parkedRounds = now.filter((r) => r.status === "open").map((r) => r.round_id);
    for (const id of parkedRounds) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });

    const makeRound = async (attempt) => {
      const r = await call("POST", "/api/rounds", { token: oToken, body: { academic_year: YEAR, attempt_number: attempt, open_date: "2020-01-01", close_date: "2099-12-31", subject_ids: use.map((s) => s.subject_id) } });
      return r;
    };
    const setStatus = (roundId, status) => call("PUT", `/api/rounds/${roundId}`, { token: oToken, body: { status } });
    const send = (who, list, token) => call("POST", "/api/exam-results", {
      token: token ?? tokens[who],
      body: { subject_results: list.map(([s, v]) => ({ subject_id: s.subject_id, is_passed: v })) },
    });

    // ════════ รอบ 1 ════════
    console.log("\n── รอบ 1 ──");
    const r1 = await makeRound(1);
    check("สร้างรอบ 1/2593 -> 200 (ปิดอยู่ก่อน)", [r1.status, r1.json.data.status], [200, "closed"]);
    const round1 = r1.json.data.round_id;

    check("รอบยังปิด → นักศึกษากรอกไม่ได้ (400)", (await send("S1", [[sub1, true], [sub2, true], [sub3, true]])).status, 400);
    check("เปิดรอบ 1 -> 200", (await setStatus(round1, "open")).status, 200);
    check("เปิดรอบซ้อนอีกรอบ (2/2593) ขณะรอบ 1 เปิดอยู่ -> 400", (await call("POST", "/api/rounds", { token: oToken, body: { academic_year: YEAR, attempt_number: 2, open_date: "2020-01-01", close_date: "2099-12-31", status: "open" } })).status, 400);
    check("สร้างรอบ 1 ซ้ำ -> 400", (await makeRound(1)).status, 400);

    const act1 = await call("GET", "/api/rounds/active", { token: tokens.S1 });
    check("นักศึกษาเห็นรอบที่เปิด (phase active, 3 วิชา)", [act1.json.data?.round_id, act1.json.data?.phase, act1.json.data?.subjects?.length], [round1, "active", 3]);

    // ตรวจ input ผิด
    check("ส่งวิชาไม่ครบ -> 400", (await send("S1", [[sub1, true]])).status, 400);
    check("ส่งวิชาซ้ำ -> 400", (await send("S1", [[sub1, true], [sub1, true], [sub2, true], [sub3, true]])).status, 400);
    const bad = await call("POST", "/api/exam-results", { token: tokens.S1, body: { subject_results: [{ subject_id: sub1.subject_id, is_passed: "false" }, { subject_id: sub2.subject_id, is_passed: true }, { subject_id: sub3.subject_id, is_passed: true }] } });
    check("is_passed เป็นข้อความ \"false\" -> 400 (ไม่แอบกลายเป็น true)", bad.status, 400);
    check("ส่ง subject_results ว่าง -> 400", (await call("POST", "/api/exam-results", { token: tokens.S1, body: { subject_results: [] } })).status, 400);
    check("เจ้าหน้าที่กรอกผลแทนนักศึกษาไม่ได้ -> 403", (await call("POST", "/api/exam-results", { token: oToken, body: { subject_results: [] } })).status, 403);

    const a1 = await send("S1", [[sub1, true], [sub2, true], [sub3, true]]);
    const a2 = await send("S2", [[sub1, true], [sub2, false], [sub3, false]]);
    const a3 = await send("S3", [[sub1, true], [sub2, true], [sub3, false]]);
    check("ส่งผล S1/S2/S3 รอบ 1 -> 200", [a1.status, a2.status, a3.status], [200, 200, 200]);
    check("  สถานะเริ่มต้น = รอตรวจ", [a1.json.data.student_status, a1.json.data.staff_status], ["submitted", "pending"]);

    // สิทธิ์การตรวจ
    const rid = (r) => r.json.data.result_id;
    check("นักศึกษายืนยันผลตัวเองไม่ได้ -> 403", (await call("PATCH", `/api/exam-results/${rid(a1)}/approve`, { token: tokens.S1 })).status, 403);
    check("ผู้บริหารยืนยันผลไม่ได้ -> 403", (await call("PATCH", `/api/exam-results/${rid(a1)}/approve`, { token: await login("789", "789") })).status, 403);
    check("ตีกลับโดยไม่ใส่เหตุผล -> 400", (await call("PATCH", `/api/exam-results/${rid(a3)}/reject`, { token: oToken, body: {} })).status, 400);

    check("ยืนยัน S1 -> 200", (await call("PATCH", `/api/exam-results/${rid(a1)}/approve`, { token: oToken })).status, 200);
    check("ยืนยัน S1 ซ้ำ -> 409", (await call("PATCH", `/api/exam-results/${rid(a1)}/approve`, { token: oToken })).status, 409);
    check("S1 แก้ผลที่ยืนยันแล้วไม่ได้ -> 409", (await send("S1", [[sub1, false], [sub2, false], [sub3, false]])).status, 409);
    check("ยืนยัน S2 (ผ่าน 1/3) -> 200", (await call("PATCH", `/api/exam-results/${rid(a2)}/approve`, { token: oToken })).status, 200);
    check("ตีกลับ S3 -> 200", (await call("PATCH", `/api/exam-results/${rid(a3)}/reject`, { token: oToken, body: { remark: "ใบผลสอบไม่ชัด" } })).status, 200);

    const notiS3 = (await call("GET", "/api/notifications/me", { token: tokens.S3 })).json.data;
    check("S3 ได้แจ้งเตือนถูกตีกลับ (มีเหตุผล)", notiS3.some((x) => x.type === "rejected" && /ใบผลสอบไม่ชัด/.test(x.message)), true);

    // S3 ส่งใหม่ → ใบเดิมถูกทับ ไม่เกิด 2 ใบในรอบเดียว
    const a3b = await send("S3", [[sub1, true], [sub2, true], [sub3, true]]);
    check("S3 ส่งใหม่หลังถูกตีกลับ -> 200 ใบเดิม (result_id เดิม) กลับเป็นรอตรวจ", [a3b.status, rid(a3b) === rid(a3), a3b.json.data.staff_status], [200, true, "pending"]);
    check("ยืนยัน S3 -> 200", (await call("PATCH", `/api/exam-results/${rid(a3)}/approve`, { token: oToken })).status, 200);

    // ประกาศของรอบ 1
    const news1 = await call("POST", "/api/news", { token: oToken, body: { title: "ประกาศรอบ 1 ทดสอบ", content: "เนื้อหา", round_id: round1 } });
    check("officer โพสต์ประกาศรอบ 1 -> 201", news1.status, 201);
    check("ผู้บริหารโพสต์ประกาศไม่ได้ -> 403", (await call("POST", "/api/news", { token: await login("789", "789"), body: { title: "x", content: "y", round_id: round1 } })).status, 403);
    check("นักศึกษาโพสต์ประกาศไม่ได้ -> 403", (await call("POST", "/api/news", { token: tokens.S1, body: { title: "x", content: "y", round_id: round1 } })).status, 403);
    check("โพสต์ประกาศโดยไม่ระบุรอบ -> 400", (await call("POST", "/api/news", { token: oToken, body: { title: "x", content: "y" } })).status, 400);
    const sNews = (await call("GET", "/api/news", { token: tokens.S1 })).json.data;
    check("นักศึกษารุ่น 2593 เห็นประกาศรอบ 1", sNews.some((x) => x.title === "ประกาศรอบ 1 ทดสอบ"), true);

    check("ลบรอบ 1 ที่มีผลสอบ/ประกาศผูกอยู่ไม่ได้ -> 400", (await call("DELETE", `/api/rounds/${round1}`, { token: oToken })).status, 400);

    // ════════ รอบ 2 ════════
    console.log("\n── รอบ 2 ──");
    check("ปิดรอบ 1", (await setStatus(round1, "closed")).status, 200);
    const r2 = await makeRound(2);
    const round2 = r2.json.data.round_id;
    check("สร้างรอบ 2 -> 200", r2.status, 200);
    check("เปิดรอบ 2 -> 200", (await setStatus(round2, "open")).status, 200);

    const act2 = await call("GET", "/api/rounds/active", { token: tokens.S2 });
    const passedMap2 = Object.fromEntries((act2.json.data.subjects ?? []).map((s) => [s.subject_code, s.already_passed]));
    check("S2 เห็นวิชา 1 ผ่านแล้วจากรอบก่อน (ล็อก) วิชา 2-3 ยังต้องกรอก", [passedMap2[sub1.subject_code], passedMap2[sub2.subject_code], passedMap2[sub3.subject_code]], [true, false, false]);
    const act2b = await call("GET", "/api/rounds/active", { token: tokens.S1 });
    check("S1 ผ่านครบตั้งแต่รอบ 1 → all_passed = true", act2b.json.data.all_passed, true);

    // S2 พยายามเปลี่ยนวิชาที่ผ่านแล้วให้เป็น "ไม่ผ่าน" — ระบบต้องไม่เชื่อ (copy-forward)
    const b2 = await send("S2", [[sub1, false], [sub2, true], [sub3, true]]);
    check("S2 ส่งรอบ 2 (พยายามตั้งวิชาที่ผ่านแล้วเป็นไม่ผ่าน) -> 200", b2.status, 200);
    const sr = b2.json.data.subject_results ?? [];
    const byId = Object.fromEntries(sr.map((x) => [x.subject_id, x]));
    check("  วิชา 1 ยังเป็นผ่านและติดธง carried_forward (ไม่นับว่าสอบรอบนี้)", [byId[sub1.subject_id]?.is_passed, byId[sub1.subject_id]?.carried_forward], [true, true]);
    check("  วิชา 2-3 ผ่านจริงในรอบนี้ (carried_forward = false)", [byId[sub2.subject_id]?.carried_forward, byId[sub3.subject_id]?.carried_forward], [false, false]);
    check("ยืนยัน S2 รอบ 2 -> 200", (await call("PATCH", `/api/exam-results/${rid(b2)}/approve`, { token: oToken })).status, 200);

    // ประกาศของรอบ 2 — นักศึกษาเห็นทั้งของรอบ 1 และ 2 (รุ่นเดียวกัน)
    check("โพสต์ประกาศรอบ 2 -> 201", (await call("POST", "/api/news", { token: oToken, body: { title: "ประกาศรอบ 2 ทดสอบ", content: "เนื้อหา", round_id: round2 } })).status, 201);

    // ════════ รอบ 3 ════════
    console.log("\n── รอบ 3 ──");
    check("ปิดรอบ 2", (await setStatus(round2, "closed")).status, 200);
    const r3 = await makeRound(3);
    const round3 = r3.json.data.round_id;
    check("สร้าง+เปิดรอบ 3", [r3.status, (await setStatus(round3, "open")).status], [200, 200]);
    const c4 = await send("S4", [[sub1, true], [sub2, true], [sub3, true]]);
    check("S4 ส่งรอบ 3 (ไม่เคยส่งรอบก่อน) -> 200", c4.status, 200);
    check("ยืนยัน S4 -> 200", (await call("PATCH", `/api/exam-results/${rid(c4)}/approve`, { token: oToken })).status, 200);

    // ════════ สถิติทั้งปี ════════
    console.log("\n── สถิติ / รายงาน ──");
    const hist = (await call("GET", "/api/dashboard/history?years=10", { token: oToken })).json.data;
    const y = hist.years.find((v) => v.academic_year === YEAR);
    check("ทั้งรุ่น = 5 คน", y?.total, 5);
    check("ผ่านครั้งแรก = 2 (S1, S3) — S2 ไม่นับเพราะต้องแก้รอบ 2", y?.firstAttempt?.passed, 2);
    check("ผ่านภายในปีแรก = 4 (S1, S2, S3, S4)", y?.firstYear?.passed, 4);
    check("ผู้บริหารดูสถิติได้ (read-only) -> 200", (await call("GET", "/api/dashboard/history?years=10", { token: await login("789", "789") })).status, 200);
    check("นักศึกษาดู dashboard ไม่ได้ -> 403", (await call("GET", "/api/dashboard/history?years=10", { token: tokens.S1 })).status, 403);

    const st3 = (await call("GET", `/api/dashboard/stats?round_id=${round3}`, { token: oToken })).json.data;
    check("stats รอบ 3: ส่งแล้ว 1 · ยืนยัน 1", [st3.submitted, st3.by.approved], [1, 1]);

    // ════════ ส่งออก: ชื่ออังกฤษ + แยกตามรอบ ════════
    console.log("\n── ส่งออก ──");
    const plain = await call("POST", "/api/students/export", { token: oToken, body: { year: YEAR } });
    const plainSheets = await readXlsxFile(plain.buffer, { parseNumber: (t) => t });
    check("ส่งออกปกติ = 1 ชีต", plainSheets.length, 1);
    const header = plainSheets[0].data[0];
    check("  มีคอลัมน์ชื่อ/นามสกุลภาษาอังกฤษ", [header.includes("ชื่อ (อังกฤษ)"), header.includes("นามสกุล (อังกฤษ)")], [true, true]);
    const rowS1 = plainSheets[0].data.find((r) => r[header.indexOf("รหัสนักศึกษา")] === ID.S1);
    check("  ชื่ออังกฤษของ S1 ถูกต้อง", [rowS1?.[header.indexOf("ชื่อ (อังกฤษ)")], rowS1?.[header.indexOf("นามสกุล (อังกฤษ)")]], ["TestS1", "Lifecycle"]);

    const multi = await call("POST", "/api/students/export", { token: oToken, body: { year: YEAR, by_round: true } });
    const sheets = await readXlsxFile(multi.buffer, { parseNumber: (t) => t });
    check("ส่งออกแยกรอบ -> 200 เป็น Excel", [multi.status, /spreadsheetml/.test(multi.type)], [200, true]);
    check("  ชีต = ข้อมูลนักศึกษา + รอบ 1 + รอบ 2 + รอบ 3", sheets.map((s) => s.sheet), ["ข้อมูลนักศึกษา", "รอบ 1-2593", "รอบ 2-2593", "รอบ 3-2593"]);
    const idsIn = (sheet) => sheet.data.slice(1).map((r) => r[0]).sort();
    check("  รอบ 1 มี S1,S2,S3", idsIn(sheets[1]), [ID.S1, ID.S2, ID.S3].sort());
    check("  รอบ 2 มี S2 คนเดียว", idsIn(sheets[2]), [ID.S2]);
    check("  รอบ 3 มี S4 คนเดียว", idsIn(sheets[3]), [ID.S4]);
    const h2 = sheets[2].data[0];
    const r2row = sheets[2].data[1];
    check("  รอบ 2 ของ S2 = ยืนยันแล้ว ผ่าน 3/3", [r2row[h2.indexOf("สถานะใบผลสอบ")], r2row[h2.indexOf("ผ่านกี่วิชา")]], ["ยืนยันแล้ว", "3/3"]);
    check("  ทุกชีตรอบมีคอลัมน์ส่งเมื่อ/ยืนยันเมื่อ", [h2.includes("ส่งเมื่อ"), h2.includes("ยืนยันเมื่อ")], [true, true]);
    check("  by_round ไม่ใช่ true (เช่น \"yes\") -> ใช้แบบ 1 ชีต", (await readXlsxFile((await call("POST", "/api/students/export", { token: oToken, body: { year: YEAR, by_round: "yes" } })).buffer)).length, 1);
    check("ผู้บริหารส่งออกแยกรอบไม่ได้ -> 403", (await call("POST", "/api/students/export", { token: await login("789", "789"), body: { year: YEAR, by_round: true } })).status, 403);

    const fail = await call("GET", `/api/dashboard/export-first-attempt?year=${YEAR}&passed=false&format=xlsx`, { token: oToken });
    const F = await readXlsxFile(fail.buffer, { parseNumber: (t) => t });
    const fids = F[0].data.slice(1).map((r) => r[F[0].data[0].indexOf("รหัสนักศึกษา")]).sort();
    check("รายชื่อสอบไม่ผ่านครั้งแรก = S2, S4, S5", fids, [ID.S2, ID.S4, ID.S5].sort());

    // ════════ บัญชีผู้บริหารไม่ต้องมีอีเมล/เบอร์โทร ════════
    console.log("\n── สร้างบัญชี ──");
    const uname = `ex${STAMP}`;
    const exec = await call("POST", "/api/users", { token: oToken, body: { psu_passport_id: uname, password: "Temp#12345", role_name: "executive", first_name: "ผู้บริหาร", last_name: "ทดสอบ" } });
    check("สร้างผู้บริหารโดยไม่ส่งอีเมล/เบอร์ -> 201", exec.status, 201);
    check("  email/phone เก็บเป็น null", [exec.json.data?.email ?? null, exec.json.data?.phone ?? null], [null, null]);
    if (exec.json.data?.user_id) extraUserIds.push(exec.json.data.user_id);
    const execWith = await call("POST", "/api/users", { token: oToken, body: { psu_passport_id: `${uname}b`, password: "Temp#12345", role_name: "executive", first_name: "ผู้บริหาร", last_name: "สอง", email: "a@psu.ac.th", phone: "0812345678" } });
    check("สร้างผู้บริหารที่ส่งอีเมล/เบอร์มาด้วย -> 201 และเก็บไว้", [execWith.status, execWith.json.data?.email], [201, "a@psu.ac.th"]);
    if (execWith.json.data?.user_id) extraUserIds.push(execWith.json.data.user_id);
    const offNo = await call("POST", "/api/users", { token: oToken, body: { psu_passport_id: `${uname}o`, password: "Temp#12345", role_name: "officer", first_name: "เจ้าหน้าที่", last_name: "ไม่มีเบอร์" } });
    check("สร้างเจ้าหน้าที่โดยไม่ส่งอีเมล/เบอร์ -> 400 (role อื่นยังบังคับ)", offNo.status, 400);
    const noName = await call("POST", "/api/users", { token: oToken, body: { psu_passport_id: `${uname}c`, password: "Temp#12345", role_name: "executive", first_name: "" , last_name: "x" } });
    check("ผู้บริหารไม่ใส่ชื่อ -> 400", noName.status, 400);
    check("ผู้บริหารที่ไม่มีประวัติลบได้ -> 200", (await call("DELETE", `/api/users/${exec.json.data.user_id}`, { token: oToken })).status, 200);
    extraUserIds = extraUserIds.filter((id) => id !== exec.json.data.user_id);
  } finally {
    await cleanupYears([YEAR]);
    // ล้างบัญชีผู้บริหารที่เทสสร้างค้างไว้ (ผ่าน API ได้เพราะไม่มีประวัติ)
    for (const id of extraUserIds) await call("DELETE", `/api/users/${id}`, { token: oToken });
    for (const id of parkedRounds) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "open" } });
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error(e); process.exit(1); });
