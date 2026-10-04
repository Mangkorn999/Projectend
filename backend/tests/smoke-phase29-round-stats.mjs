// สถิติ "ฐานคนของรอบ" ของ /api/dashboard/stats — field ใหม่ roundTotal / roundNotStarted / roundFillRate / alreadyPassed
//
// กฎที่ต้องจริงเสมอ ไม่ว่าจะดูรอบไหน ณ จังหวะไหน:
//   approved + submitted + rejected + draft + roundNotStarted = roundTotal
//   alreadyPassed = alreadyPassedStudentIds.length
//   roundTotal = (คนที่เปิดสิทธิ์ + ยังผ่านวิชาของรอบนี้ไม่ครบ) + (คนที่มีใบในรอบนี้อยู่แล้ว)
//
// ตัวละครรุ่น 2591 (รหัสขึ้นต้น 87) — 3 วิชาต่อรอบ:
//   A  รอบ 1 ผ่านครบ + ยืนยัน          → รอบ 2 ขึ้นไปเป็น alreadyPassed
//   B  รอบ 1 ผ่าน 1/3 รอตรวจ            → รอบ 2 ส่งวิชาที่เหลือ ผ่านครบ (รอตรวจ)
//   C  รอบ 1 ผ่านครบ แต่ถูกตีกลับ        → รอบ 2 ส่งใหม่ทั้ง 3 วิชา (รอตรวจ)
//   D  รอบ 1 ผ่าน 2/3 ยืนยัน             → รอบ 2 ส่งวิชาที่เหลือ ยืนยัน
//   E  เปิดสิทธิ์แต่ไม่ส่งเลย
//   F  ไม่เปิดสิทธิ์ ไม่ส่ง               → อยู่ใน total แต่ไม่อยู่ใน roundTotal
//   G  ส่งรอบ 1 แล้วโดนถอนสิทธิ์ทีหลัง    → ยังต้องอยู่ใน roundTotal (มีใบในรอบนี้อยู่แล้ว)
// และปี 2592 ที่มีรอบแต่ไม่มีนักศึกษา → ทุกตัวเลขต้องเป็น 0 ไม่ใช่ NaN/null
import { cleanupYears } from "./cleanupYears.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
let failures = 0;

const call = async (method, url, { token, body } = {}) => {
  const headers = {};
  if (token) headers.Cookie = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, json, cookie: setCookie ? setCookie.split(";")[0] : null };
};

const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
};

const YEAR = 2591;
const EMPTY_YEAR = 2592;
const PREFIX = String(YEAR - 4).slice(-2);
const STAMP = Date.now().toString().slice(-6);
const NAMES = ["A", "B", "C", "D", "E", "F", "G"];
const ID = {};
NAMES.forEach((n, i) => (ID[n] = `${PREFIX}${STAMP}0${i + 1}`));
const nid = (i) => `1${STAMP}0000${i}`.slice(0, 13).padEnd(13, "0");
const NOW = { open_date: "2020-01-01", close_date: "2099-12-31" };

// ผลรวม 5 ช่อง — ต้องเท่า roundTotal เสมอ
const fiveSum = (d) => d.by.approved + d.by.submitted + d.by.rejected + d.by.draft + d.roundNotStarted;

const main = async () => {
  const login = async (u, p) => (await call("POST", "/api/auth/login", { body: { psu_passport_id: u, password: p } })).cookie;
  const oToken = await login("456", "456");
  const rToken = await login("321", "321");
  const eToken = await login("789", "789");
  if (!oToken || !rToken || !eToken) { console.log("login seed accounts failed"); process.exit(1); }

  const parked = ((await call("GET", "/api/rounds", { token: oToken })).json.data || []).filter((r) => r.status === "open").map((r) => r.round_id);
  for (const id of parked) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });

  try {
    const rooms = (await call("GET", "/api/rooms", { token: oToken })).json.data;
    const subjects = (await call("GET", "/api/subjects", { token: oToken })).json.data;
    const [s1, s2, s3] = subjects.slice(0, 3);
    const subjectIds = [s1.subject_id, s2.subject_id, s3.subject_id];

    // ── นักศึกษา 7 คน ──
    const tokens = {};
    for (let i = 0; i < NAMES.length; i++) {
      const who = NAMES[i];
      await call("POST", "/api/students", { token: oToken, body: { student_id: ID[who], national_id: nid(i + 1) } });
      const l = await call("POST", "/api/auth/login", { body: { psu_passport_id: ID[who], password: nid(i + 1) } });
      await call("POST", "/api/students/complete-profile", {
        token: l.cookie,
        body: { first_name: `ทดสอบ${who}`, last_name: "สถิติ", first_name_en: `Test${who}`, last_name_en: "Stats", email: `${ID[who]}@test.local`, phone: "0812345678", room_id: rooms[0].room_id },
      });
      tokens[who] = l.cookie;
    }
    // ค่าเริ่มต้นของ exam_eligible คือ true (schema.prisma) — F ต้องสั่งปิดเองถึงจะเป็น "ไม่เปิดสิทธิ์"
    await call("PATCH", "/api/students/bulk-eligible", { token: oToken, body: { student_ids: [ID.F], exam_eligible: false } });

    const setRound = (id, body) => call("PUT", `/api/rounds/${id}`, { token: oToken, body });
    const makeRound = async (attempt, open = true) => {
      const r = await call("POST", "/api/rounds", { token: oToken, body: { academic_year: YEAR, attempt_number: attempt, ...NOW, subject_ids: subjectIds } });
      if (r.status !== 200) throw new Error(`create round ${attempt}: ${JSON.stringify(r.json)}`);
      if (open) await setRound(r.json.data.round_id, { status: "open" });
      return r.json.data.round_id;
    };
    const send = (who, answers) => call("POST", "/api/exam-results", {
      token: tokens[who],
      body: { subject_results: answers.map(([s, p]) => ({ subject_id: s.subject_id, is_passed: p })) },
    });
    const approve = (id) => call("PATCH", `/api/exam-results/${id}/approve`, { token: oToken });
    const reject = (id) => call("PATCH", `/api/exam-results/${id}/reject`, { token: oToken, body: { remark: "ทดสอบตีกลับ" } });
    const stats = async (roundId, token = oToken) => (await call("GET", `/api/dashboard/stats${roundId ? `?round_id=${roundId}` : ""}`, { token })).json.data;
    const invariants = (label, d) => {
      check(`${label}: approved+submitted+rejected+draft+roundNotStarted = roundTotal`, fiveSum(d), d.roundTotal);
      check(`${label}: alreadyPassed = จำนวน alreadyPassedStudentIds`, d.alreadyPassed, d.alreadyPassedStudentIds.length);
      check(`${label}: ทุกช่องเป็นตัวเลข ไม่ติดลบ ไม่ NaN`, [d.roundTotal, d.roundNotStarted, d.roundFillRate, d.alreadyPassed].every((v) => Number.isFinite(v) && v >= 0), true);
      check(`${label}: roundFillRate อยู่ใน 0-100`, d.roundFillRate >= 0 && d.roundFillRate <= 100, true);
      check(`${label}: ฐานทั้งรุ่น not_started + by = total (กฎเดิมยังจริง)`, d.by.approved + d.by.submitted + d.by.rejected + d.by.draft + d.not_started, d.total);
    };

    // ════════ รอบ 1 ════════
    console.log("\n── รอบ 1 ──");
    const round1 = await makeRound(1);
    const pA = await send("A", [[s1, true], [s2, true], [s3, true]]);
    const pB = await send("B", [[s1, true], [s2, false], [s3, false]]);
    const pC = await send("C", [[s1, true], [s2, true], [s3, true]]);
    const pD = await send("D", [[s1, true], [s2, true], [s3, false]]);
    const pG = await send("G", [[s1, false], [s2, false], [s3, false]]);
    check("ส่งผลรอบ 1 ทั้ง 5 คน -> 200", [pA, pB, pC, pD, pG].map((r) => r.status), [200, 200, 200, 200, 200]);
    check("เจ้าหน้าที่ยืนยัน A และ D", [(await approve(pA.json.data.result_id)).status, (await approve(pD.json.data.result_id)).status], [200, 200]);
    check("เจ้าหน้าที่ตีกลับ C", (await reject(pC.json.data.result_id)).status, 200);

    // ถอนสิทธิ์ G หลังส่งผลไปแล้ว — ใบของ G ยังอยู่ในรอบ จึงต้องไม่หายจากฐานคนของรอบ
    const unElig = await call("PATCH", "/api/students/bulk-eligible", { token: oToken, body: { student_ids: [ID.G], exam_eligible: false } });
    check("ถอนสิทธิ์ G หลังส่งผล -> 200", unElig.status, 200);

    const r1 = await stats(round1);
    check("รอบ 1: total = 7 (A-G)", r1.total, 7);
    check("รอบ 1: by approved/submitted/rejected/draft = 2/2/1/0", [r1.by.approved, r1.by.submitted, r1.by.rejected, r1.by.draft], [2, 2, 1, 0]);
    check("รอบ 1: ฐานคนของรอบ = 6 (A,B,C,D,E เปิดสิทธิ์ + G มีใบ; F ไม่อยู่)", r1.roundTotal, 6);
    check("รอบ 1: ยังไม่เริ่ม (roundNotStarted) = 1 (E)", r1.roundNotStarted, 1);
    check("รอบ 1: roundFillRate = 83 (ส่ง 5 จาก 6)", r1.roundFillRate, 83);
    check("รอบ 1: fillRate เดิม (หารทั้งรุ่น) = 71 (5/7)", r1.fillRate, 71);
    check("รอบ 1: alreadyPassed = 0 (ยังไม่มีรอบก่อนหน้า)", r1.alreadyPassed, 0);
    check("รอบ 1: canSubmit = 5 (A,B,C,D,E)", r1.canSubmit, 5);
    check("รอบ 1: not_started (ฐานทั้งรุ่น) = 2 (E,F)", r1.not_started, 2);
    invariants("รอบ 1", r1);

    // ════════ รอบ 2 (คนผ่านครบจากรอบ 1 ต้องหลุดจากฐาน) ════════
    console.log("\n── รอบ 2 ──");
    await setRound(round1, { status: "closed" });
    const round2 = await makeRound(2);

    const r2a = await stats(round2);
    check("รอบ 2 (ก่อนใครส่ง): alreadyPassed = 1 และเป็น A", [r2a.alreadyPassed, r2a.alreadyPassedStudentIds], [1, [ID.A]]);
    check("  roundTotal = 4 (B,C,D,E) — A หลุด, C กลับมาเพราะใบถูกตีกลับ", r2a.roundTotal, 4);
    check("  roundNotStarted = 4, roundFillRate = 0", [r2a.roundNotStarted, r2a.roundFillRate], [4, 0]);
    check("  canSubmit = 4", r2a.canSubmit, 4);
    check("  total ทั้งรุ่นยัง = 7 (ตัวหาร % ผ่านไม่เปลี่ยน)", r2a.total, 7);
    invariants("รอบ 2 ก่อนส่ง", r2a);

    // A ผ่านครบแล้ว เปิดฟอร์มรอบ 2 ไม่ได้ และส่งไม่ได้
    const aActive = (await call("GET", "/api/rounds/active", { token: tokens.A })).json.data;
    check("A (ผ่านครบรอบ 1) ฟอร์มรอบ 2 บอก all_passed", aActive?.all_passed, true);

    // แจ้งเตือน "เปิดรับผลสอบรอบ 2" — คนที่ผ่านครบแล้วไม่มีอะไรต้องกรอก จึงไม่ควรได้ (ส่วน C ใบถูกตีกลับ ยังต้องได้)
    const roundOpenNotices = async (who, roundId) => {
      const list = (await call("GET", "/api/notifications/me", { token: tokens[who] })).json.data || [];
      return list.filter((n) => n.type === "round_open" && n.round_id === roundId).length;
    };
    check("A (ผ่านครบแล้ว) ไม่ได้แจ้งเตือนเปิดรอบ 2", await roundOpenNotices("A", round2), 0);
    check("C (ใบรอบ 1 ถูกตีกลับ) ยังได้แจ้งเตือนเปิดรอบ 2 ครั้งเดียว", await roundOpenNotices("C", round2), 1);
    check("B (ผ่านไม่ครบ) ได้แจ้งเตือนเปิดรอบ 2", await roundOpenNotices("B", round2), 1);
    check("A เปิดกระดิ่งซ้ำ ยังไม่มีแจ้งเตือนเปิดรอบ 2 (ไม่ถูกสร้างทีหลัง)", await roundOpenNotices("A", round2), 0);

    const pB2 = await send("B", [[s2, true], [s3, true]]);
    const pC2 = await send("C", [[s1, true], [s2, true], [s3, true]]);
    const pD2 = await send("D", [[s3, true]]);
    check("ส่งรอบ 2: B (2 วิชาที่เหลือ), C (ครบ 3), D (1 วิชาที่เหลือ) -> 200", [pB2.status, pC2.status, pD2.status], [200, 200, 200]);
    // ยืนยันโดยส่ง remark เป็นตัวเลข (ชนิดผิด) — ต้องไม่ 500: ถือว่าไม่ได้ใส่ remark แล้วยืนยันได้ตามปกติ เก็บ remark เป็น null
    const approveD2 = await call("PATCH", `/api/exam-results/${pD2.json.data.result_id}/approve`, { token: oToken, body: { remark: 12345 } });
    check("ยืนยัน D รอบ 2 โดยส่ง remark เป็นตัวเลข -> 200 และ remark = null", [approveD2.status, approveD2.json.data?.remark], [200, null]);

    const r2b = await stats(round2);
    check("รอบ 2 หลังส่ง: by approved/submitted/rejected = 1/2/0", [r2b.by.approved, r2b.by.submitted, r2b.by.rejected], [1, 2, 0]);
    check("  roundTotal ยัง 4 (ไม่เปลี่ยนเมื่อมีคนส่งผล/ถูกยืนยัน)", r2b.roundTotal, 4);
    check("  roundNotStarted = 1 (E), roundFillRate = 75 (3/4)", [r2b.roundNotStarted, r2b.roundFillRate], [1, 75]);
    check("  alreadyPassed ยัง 1 (D เพิ่งผ่านในรอบนี้ ไม่ใช่ 'ก่อนรอบนี้')", [r2b.alreadyPassed, r2b.alreadyPassedStudentIds], [1, [ID.A]]);
    invariants("รอบ 2 หลังส่ง", r2b);

    // ดูย้อนรอบ 1 หลังรอบ 2 เดินไปแล้ว — ตัวเลขรอบ 1 ต้องเท่าเดิม ไม่ปนกับความคืบหน้ารอบ 2
    const r1again = await stats(round1);
    check("ดูรอบ 1 ย้อนหลัง: ฐาน/ตัวเลขเท่าเดิม", [r1again.roundTotal, r1again.roundNotStarted, r1again.roundFillRate, r1again.alreadyPassed], [r1.roundTotal, r1.roundNotStarted, r1.roundFillRate, r1.alreadyPassed]);
    check("  by รอบ 1 เท่าเดิม", r1again.by, r1.by);
    invariants("รอบ 1 (ย้อนหลัง)", r1again);

    // ════════ รอบ 3 (คนส่วนใหญ่ผ่านครบสะสมแล้ว เหลือแต่ E) ════════
    console.log("\n── รอบ 3 ──");
    await setRound(round2, { status: "closed" });
    const round3 = await makeRound(3);
    const r3a = await stats(round3);
    check("รอบ 3: alreadyPassed = 4 (A,B,C,D)", [r3a.alreadyPassed, [...r3a.alreadyPassedStudentIds].sort()], [4, [ID.A, ID.B, ID.C, ID.D].sort()]);
    check("  roundTotal = 1 (เหลือ E), roundNotStarted = 1, roundFillRate = 0", [r3a.roundTotal, r3a.roundNotStarted, r3a.roundFillRate], [1, 1, 0]);
    invariants("รอบ 3 ก่อนส่ง", r3a);
    const dflt = await stats(null);
    check("ไม่ส่ง round_id -> ได้รอบที่เปิดอยู่ (รอบ 3)", [dflt.round.round_id, dflt.roundTotal, dflt.alreadyPassed], [round3, r3a.roundTotal, r3a.alreadyPassed]);

    // ตีกลับใบรอบ 2 ของ B → วิชา 2,3 ของ B ไม่ถือว่าผ่านแล้ว → B กลับเข้าฐานรอบ 3
    check("ตีกลับใบรอบ 2 ของ B", (await reject(pB2.json.data.result_id)).status, 200);
    const r3b = await stats(round3);
    check("รอบ 3 หลังตีกลับ B: alreadyPassed = 3, roundTotal = 2 (B,E)", [r3b.alreadyPassed, r3b.roundTotal], [3, 2]);
    check("  roundNotStarted = 2", r3b.roundNotStarted, 2);
    invariants("รอบ 3 หลังตีกลับ B", r3b);

    // ถอนการยืนยัน (revoke-approval) ใบรอบ 2 ของ D — ใบกลับเป็นรอตรวจ ตัวเลขฐานยังต้องรวมกันได้
    const rev = await call("PATCH", `/api/exam-results/${pD2.json.data.result_id}/revoke-approval`, { token: oToken, body: { remark: "ทดสอบถอนยืนยัน" } });
    check("ถอนการยืนยันใบ D รอบ 2 -> 200", rev.status, 200);
    const r2c = await stats(round2);
    check("รอบ 2 หลังถอนยืนยัน D: approved/submitted/rejected = 0/2/1 (B ถูกตีกลับ, D+C รอตรวจ)", [r2c.by.approved, r2c.by.submitted, r2c.by.rejected], [0, 2, 1]);
    invariants("รอบ 2 หลังถอนยืนยัน", r2c);

    // ════════ สิทธิ์ ════════
    console.log("\n── สิทธิ์การดูสถิติ ──");
    const exec = await stats(round2, eToken);
    check("ผู้บริหารไม่เห็น alreadyPassedStudentIds (รหัสนักศึกษารายคน) แต่ยังเห็นจำนวน alreadyPassed", ["alreadyPassedStudentIds" in (exec || {}), typeof exec?.alreadyPassed], [false, "number"]);
    check("เจ้าหน้าที่ยังได้ alreadyPassedStudentIds เป็น array", Array.isArray(r2c.alreadyPassedStudentIds), true);
    check("ผู้บริหารเห็นสถิติรอบ (field ใหม่ครบ)", ["roundTotal", "roundNotStarted", "roundFillRate", "alreadyPassed"].every((k) => k in (exec || {})), true);
    check("  ตัวเลขเท่ากับที่เจ้าหน้าที่เห็น", [exec.roundTotal, exec.roundNotStarted, exec.roundFillRate], [r2c.roundTotal, r2c.roundNotStarted, r2c.roundFillRate]);
    check("นักศึกษาเรียก /dashboard/stats -> 403", (await call("GET", `/api/dashboard/stats?round_id=${round2}`, { token: tokens.A })).status, 403);
    check("ผู้ช่วยตรวจสอบเรียก /dashboard/stats -> 403", (await call("GET", `/api/dashboard/stats?round_id=${round2}`, { token: rToken })).status, 403);
    check("ไม่ login -> 401", (await call("GET", `/api/dashboard/stats?round_id=${round2}`)).status, 401);
    check("round_id ที่ไม่มีอยู่ -> 404", (await call("GET", "/api/dashboard/stats?round_id=99999999", { token: oToken })).status, 404);
    check("round_id ไม่ใช่ตัวเลข -> ไม่ใช่ 500", (await call("GET", "/api/dashboard/stats?round_id=abc", { token: oToken })).status < 500, true);

    // ════════ ส่งผลผ่าน API ตรงๆ ในกรณีที่ฟอร์มซ่อนไว้ (รอบ 3 ยังเปิดอยู่ตรงนี้) ════════
    console.log("\n── ส่งผลที่ฟอร์มไม่ควรให้ส่ง ──");
    const aSend = await send("A", [[s1, true], [s2, true], [s3, true]]);
    check("A (ผ่านครบตั้งแต่รอบ 1) ส่งผลรอบ 3 ผ่าน API ตรงๆ ไม่ได้ -> 400", aSend.status, 400);
    check("  ข้อความเป็นภาษาไทย", /[ก-๙]/.test(aSend.json.message || ""), true);
    const aPapers = (await call("GET", `/api/exam-results?student_id=${ID.A}`, { token: oToken })).json.data || [];
    check("  A ต้องไม่มีใบ 'ว่าง' (ยกผลมาทั้งหมด) โผล่ในคิวตรวจของรอบ 3", aPapers.filter((p) => p.round_id === round3).length, 0);
    check("G (ถูกถอนสิทธิ์) ส่งผลรอบ 3 -> 403", (await send("G", [[s1, true], [s2, true], [s3, true]])).status, 403);
    check("F (ไม่เปิดสิทธิ์) ส่งผลรอบ 3 -> 403", (await send("F", [[s1, true], [s2, true], [s3, true]])).status, 403);

    // ════════ ปีที่ไม่มีนักศึกษาเลย ════════
    console.log("\n── รอบที่ไม่มีนักศึกษา ──");
    await setRound(round3, { status: "closed" });
    const emptyRound = await call("POST", "/api/rounds", { token: oToken, body: { academic_year: EMPTY_YEAR, attempt_number: 1, ...NOW, subject_ids: subjectIds } });
    const emptyId = emptyRound.json.data.round_id;
    const e = await stats(emptyId);
    check("รอบไม่มีนักศึกษา: roundTotal/roundNotStarted/roundFillRate/alreadyPassed = 0", [e.roundTotal, e.roundNotStarted, e.roundFillRate, e.alreadyPassed], [0, 0, 0, 0]);
    invariants("รอบไม่มีนักศึกษา", e);
  } finally {
    await cleanupYears([YEAR, EMPTY_YEAR]);
    for (const id of parked) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "open" } });
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error(e); process.exit(1); });
