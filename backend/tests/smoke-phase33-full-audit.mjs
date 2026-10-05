// เทสพิสูจน์บัคที่เจอจากการตรวจโค้ดทั้งระบบ (5 ต.ค. 2569) — ดู docs/full-system-test-plan.md ข้อ 1.2
//
// เทสในไฟล์นี้เขียนเป็น "พฤติกรรมที่ควรเป็น" — ตอนที่บัคยังไม่ถูกแก้ ข้อนั้นต้อง FAIL (red)
// พอแก้แล้วต้องเปลี่ยนเป็น PASS (green). แต่ละข้อมีรหัสบัค B-xx ติดไว้ในชื่อ
//   INFO  = ข้อมูลประกอบที่รอการตัดสินใจ/ข้อจำกัดที่รู้แล้ว ไม่นับเป็น FAIL
//
//   B-02  แก้ปี/ครั้งที่ของรอบที่มีผลสอบแล้ว ต้อง 409
//   B-03  ยืนยันใบที่ไม่มีไฟล์หลักฐาน ต้อง 409 (ตีกลับยังได้)
//   B-04  วันที่ที่ไม่มีจริง (2026-02-31) ต้อง 400
//   B-08  เปิดสิทธิ์ทั้งกลุ่มที่มีรหัสปลอมปน แจ้งเตือนต้องถึงคนที่มีจริง
//   B-18  เปลี่ยนบทบาทเป็น student / เปลี่ยนบทบาทบัญชีนักศึกษา ต้อง 400
//   B-01  INFO: นักศึกษาที่นำเข้าแล้วยังไม่ login — ตัวหารสถิติ
//   B-05  INFO: เปลี่ยนรหัสแล้ว token เดิมยังใช้ได้ (ข้อจำกัดที่รู้แล้ว)
//   B-07  INFO: สถิติรายรอบนับวิชาที่ยกมาจากใบที่ถูกตีกลับภายหลัง
//   B-11  INFO: เจ้าหน้าที่ 2 คนเปิดคนละรอบพร้อมกัน
//   AUTH-07 เดารหัสจาก IP เดียวคนละบัญชี 61 ครั้ง ต้องโดน 429
//
// ปีทดสอบ 2596-2597 (cleanupYears ล้างให้ตอนจบ — ห้ามใช้ปีจริง)
import { cleanupYears } from "./cleanupYears.mjs";
import { autoAttachEvidence } from "./autoEvidence.mjs";

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
const info = (name, value) => console.log(`INFO  ${name}  -> ${JSON.stringify(value)}`);

const STAMP = Date.now().toString().slice(-6);
const NOW = { open_date: "2020-01-01", close_date: "2099-12-31" };
const nid = (i) => `1${STAMP}0000${i}`.slice(0, 13).padEnd(13, "0");

const YEAR_A = 2596; // เทสรอบ/ผลสอบ
const YEAR_B = 2597; // เทสตัวหารสถิติ + รอบแข่งกัน
const PREFIX_A = String(YEAR_A - 4).slice(-2);
const PREFIX_B = String(YEAR_B - 4).slice(-2);

const main = async () => {
  const login = async (u, p) => (await call("POST", "/api/auth/login", { body: { psu_passport_id: u, password: p } })).cookie;
  const oToken = await login("456", "456");
  if (!oToken) { console.log("login seed officer failed"); process.exit(1); }

  const parked = ((await call("GET", "/api/rounds", { token: oToken })).json.data || []).filter((r) => r.status === "open").map((r) => r.round_id);
  for (const id of parked) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });

  try {
    const rooms = (await call("GET", "/api/rooms", { token: oToken })).json.data;
    const subjects = (await call("GET", "/api/subjects", { token: oToken })).json.data;
    const [s1, s2] = subjects.slice(0, 2);

    // สร้างนักศึกษา + login + กรอกโปรไฟล์ — คืน { id, token }
    const makeStudent = async (prefix, seq, { complete = true } = {}) => {
      const id = `${prefix}${STAMP}0${seq}`;
      await call("POST", "/api/students", { token: oToken, body: { student_id: id, national_id: nid(seq) } });
      if (!complete) return { id, token: null };
      const l = await call("POST", "/api/auth/login", { body: { psu_passport_id: id, password: nid(seq) } });
      await call("POST", "/api/students/complete-profile", {
        token: l.cookie,
        body: { first_name: `ทดสอบ${seq}`, last_name: "ตรวจรอบ", first_name_en: `Test${seq}`, last_name_en: "Audit", email: `${id}@test.local`, phone: "0812345678", room_id: rooms[0].room_id },
      });
      return { id, token: l.cookie };
    };

    // ════════ B-02 / B-03 / B-04 : รอบและใบผลสอบ ════════
    console.log("\n── B-02, B-03, B-04: รอบและใบผลสอบ ──");
    const A1 = await makeStudent(PREFIX_A, 1);
    const A2 = await makeStudent(PREFIX_A, 2);

    const badDate = await call("POST", "/api/rounds", { token: oToken, body: { academic_year: YEAR_A, attempt_number: 9, open_date: "2020-01-01", close_date: "2026-02-31", subject_ids: [s1.subject_id] } });
    check("B-04 สร้างรอบด้วยวันปิดที่ไม่มีจริง 2026-02-31 -> 400", badDate.status, 400);
    if (badDate.status === 200) await call("DELETE", `/api/rounds/${badDate.json.data.round_id}`, { token: oToken });
    const badDate2 = await call("POST", "/api/rounds", { token: oToken, body: { academic_year: YEAR_A, attempt_number: 9, open_date: "2026-04-31", close_date: "2099-12-31", subject_ids: [s1.subject_id] } });
    check("B-04 สร้างรอบด้วยวันเปิดที่ไม่มีจริง 2026-04-31 -> 400", badDate2.status, 400);
    if (badDate2.status === 200) await call("DELETE", `/api/rounds/${badDate2.json.data.round_id}`, { token: oToken });

    const r1 = await call("POST", "/api/rounds", { token: oToken, body: { academic_year: YEAR_A, attempt_number: 1, ...NOW, subject_ids: [s1.subject_id, s2.subject_id] } });
    const round1 = r1.json.data.round_id;
    await call("PUT", `/api/rounds/${round1}`, { token: oToken, body: { status: "open" } });

    const sendPaper = async (st) => (await call("POST", "/api/exam-results", {
      token: st.token,
      body: { subject_results: [{ subject_id: s1.subject_id, is_passed: true }, { subject_id: s2.subject_id, is_passed: true }] },
    })).json.data.result_id;
    const paperOf = async (st) => ((await call("GET", `/api/exam-results?student_id=${st.id}`, { token: oToken })).json.data || [])[0];

    const idA1 = await sendPaper(A1); // ใบนี้ไม่มีไฟล์แนบเลย (หน้าเว็บสร้างใบก่อนแล้วค่อยอัปโหลด — อัปโหลดล้มจะค้างแบบนี้)
    const idA2 = await sendPaper(A2);

    const move = await call("PUT", `/api/rounds/${round1}`, { token: oToken, body: { academic_year: YEAR_A + 1 } });
    check("B-02 เปลี่ยนปีการศึกษาของรอบที่มีผลสอบแล้ว -> 409", move.status, 409);
    const swap = await call("PUT", `/api/rounds/${round1}`, { token: oToken, body: { attempt_number: 2 } });
    check("B-02 เปลี่ยนครั้งที่ของรอบที่มีผลสอบแล้ว -> 409", swap.status, 409);
    const afterMove = (await call("GET", "/api/rounds", { token: oToken })).json.data.find((r) => r.round_id === round1);
    check("  รอบต้องไม่ถูกย้าย (ปี/ครั้งที่เดิม)", [afterMove.academic_year, afterMove.attempt_number], [YEAR_A, 1]);
    // บัคยังไม่แก้ = รอบถูกย้ายไปแล้ว — คืนค่าเดิมเพื่อไม่ให้ชนกับรอบของข้อถัดไป
    if (afterMove.academic_year !== YEAR_A || afterMove.attempt_number !== 1) {
      await call("PUT", `/api/rounds/${round1}`, { token: oToken, body: { academic_year: YEAR_A, attempt_number: 1 } });
    }
    check("B-02 แก้วันปิดของรอบที่มีผลสอบแล้ว ยังทำได้ -> 200", (await call("PUT", `/api/rounds/${round1}`, { token: oToken, body: { close_date: "2099-11-30" } })).status, 200);

    const paperBefore = await paperOf(A1);
    check("  (เตรียม) ใบ A1 ไม่มีไฟล์แนบ", (paperBefore.certificates || []).length, 0);
    const approveNoFile = await call("PATCH", `/api/exam-results/${idA1}/approve`, { token: oToken });
    check("B-03 ยืนยันใบที่ไม่มีไฟล์หลักฐาน -> 409", approveNoFile.status, 409);
    check("  ใบ A1 ต้องยังเป็น pending", (await paperOf(A1)).staff_status, "pending");
    const rejectNoFile = await call("PATCH", `/api/exam-results/${idA2}/reject`, { token: oToken, body: { remark: "ไม่มีไฟล์หลักฐาน" } });
    check("B-03 ตีกลับใบที่ไม่มีไฟล์ ยังทำได้ -> 200", rejectNoFile.status, 200);

    // ════════ B-18 : เปลี่ยนบทบาท ════════
    console.log("\n── B-18: เปลี่ยนบทบาท ──");
    const newOfficer = await call("POST", "/api/users", {
      token: oToken,
      body: { psu_passport_id: `aud${STAMP}`, password: "audit1234", role_name: "reviewer", first_name: "ผู้ทดสอบ", last_name: "บทบาท", email: "a@test.local", phone: "0812345678" },
    });
    check("  (เตรียม) สร้างผู้ช่วยตรวจสอบ -> 201", newOfficer.status, 201);
    const targetId = newOfficer.json.data?.user_id;
    check("B-18 เปลี่ยนบัญชีเจ้าหน้าที่เป็น student (ยิง API ตรง) -> 400", (await call("POST", `/api/users/${targetId}/role`, { token: oToken, body: { role_name: "student" } })).status, 400);
    const stuUserId = (await call("GET", `/api/students/${A1.id}`, { token: oToken })).json.data?.user?.user_id;
    check("B-18 เปลี่ยนบัญชีของนักศึกษาเป็นเจ้าหน้าที่ -> 400", (await call("POST", `/api/users/${stuUserId}/role`, { token: oToken, body: { role_name: "officer" } })).status, 400);
    check("B-18 เปลี่ยนระหว่าง reviewer → executive ยังทำได้ -> 200", (await call("POST", `/api/users/${targetId}/role`, { token: oToken, body: { role_name: "executive" } })).status, 200);

    // ════════ B-08 : เปิดสิทธิ์ทั้งกลุ่มที่มีรหัสปลอมปน ════════
    console.log("\n── B-08: เปิดสิทธิ์ทั้งกลุ่มมีรหัสปลอมปน ──");
    await call("PATCH", "/api/students/bulk-eligible", { token: oToken, body: { student_ids: [A1.id], exam_eligible: false } });
    const mixed = await call("PATCH", "/api/students/bulk-eligible", { token: oToken, body: { student_ids: [A1.id, "9999999999"], exam_eligible: true } });
    check("  เปิดสิทธิ์ (มีรหัสปลอมปน 1 ตัว) -> 200", mixed.status, 200);
    await new Promise((r) => setTimeout(r, 800)); // แจ้งเตือนสร้างแบบไม่รอ (fire-and-forget)
    const notifs = (await call("GET", "/api/notifications/me", { token: A1.token })).json.data || [];
    check("B-08 นักศึกษาที่มีจริงได้แจ้งเตือน 'เปิดสิทธิ์' แม้มีรหัสปลอมปนในกลุ่ม", notifs.some((n) => n.type === "eligible"), true);

    // ════════ B-01 : ตัวหารสถิติ (INFO — รอตัดสินใจ) ════════
    console.log("\n── B-01: นักศึกษาที่นำเข้าแล้วยังไม่ login (INFO) ──");
    await call("PUT", `/api/rounds/${round1}`, { token: oToken, body: { status: "closed" } }); // เปิดได้ทีละรอบ — ปิดรอบรุ่น A ก่อน
    const B1 = await makeStudent(PREFIX_B, 1);
    const B2 = await makeStudent(PREFIX_B, 2);
    await makeStudent(PREFIX_B, 3, { complete: false });
    await makeStudent(PREFIX_B, 4, { complete: false });
    const rB = await call("POST", "/api/rounds", { token: oToken, body: { academic_year: YEAR_B, attempt_number: 1, ...NOW, subject_ids: [s1.subject_id] } });
    const roundB = rB.json.data.round_id;
    await call("PUT", `/api/rounds/${roundB}`, { token: oToken, body: { status: "open" } }); // ต้องเปิดก่อน นักศึกษาถึงส่งผลได้
    const statsB = (await call("GET", `/api/dashboard/stats?round_id=${roundB}`, { token: oToken })).json.data;
    info("นำเข้า 4 คน (login+โปรไฟล์ 2 คน) → stats.total", statsB.total);
    info("  not_started", statsB.not_started);
    const pending = (await call("GET", "/api/students/pending-accounts", { token: oToken })).json.data || [];
    info("  บัญชีรอเปิดใช้ของรุ่นนี้ (ไม่อยู่ใน total)", pending.filter((p) => p.academic_year === YEAR_B).length);
    // ตัดสินใจแล้ว 5 ต.ค. 2569: นับบัญชีที่นำเข้าแต่ยังไม่เข้าระบบเป็นสมาชิกของรุ่น = "ยังไม่กรอก"
    check("B-01 ตัวหาร total = 4 (รวมบัญชีที่ยังไม่เข้าระบบ 2 คน)", statsB.total, 4);
    check("B-01 not_started = 4 (ยังไม่มีใครส่ง — รวมบัญชีที่ยังไม่เข้าระบบ)", statsB.not_started, 4);
    const histB = (await call("GET", "/api/dashboard/history?years=10", { token: oToken })).json.data;
    const sumB = (histB.years || []).find((y) => y.academic_year === YEAR_B);
    check("B-01 สรุปรายปี: total = 4 และ 5 สถานะรวมกัน = total", [sumB?.total, Object.values(sumB?.statusByStudent || {}).reduce((a, b) => a + b, 0)], [4, 4]);
    const execStats = await call("GET", `/api/dashboard/stats?round_id=${roundB}`, { token: oToken });
    check("  total จาก stats ตรงกับสรุปรายปี", execStats.json.data.total, sumB?.total);

    // ════════ B-07 : รายรอบนับวิชาที่ยกมา (INFO) ════════
    console.log("\n── B-07: ใบต้นทางถูกตีกลับภายหลัง (INFO) ──");
    const sendB = async (st, subjectsToSend) => (await call("POST", "/api/exam-results", {
      token: st.token, body: { subject_results: subjectsToSend },
    }));
    const b1Paper = await sendB(B1, [{ subject_id: s1.subject_id, is_passed: true }]);
    check("  (เตรียม) B1 ส่งรอบ 1 ผ่าน s1 -> 200", [b1Paper.status, b1Paper.json.message ?? ""], [200, ""]);
    await sendB(B2, [{ subject_id: s1.subject_id, is_passed: false }]);
    // รอบ 2 ของรุ่น B ใช้ s1 + s2 — B1 ยกผล s1 มาจากใบรอบ 1 (ยังรอตรวจ)
    await call("PUT", `/api/rounds/${roundB}`, { token: oToken, body: { status: "closed" } });
    const rB2 = await call("POST", "/api/rounds", { token: oToken, body: { academic_year: YEAR_B, attempt_number: 2, ...NOW, subject_ids: [s1.subject_id, s2.subject_id] } });
    const roundB2 = rB2.json.data.round_id;
    await call("PUT", `/api/rounds/${roundB2}`, { token: oToken, body: { status: "open" } });
    const b1Round2 = await sendB(B1, [{ subject_id: s2.subject_id, is_passed: true }]);
    check("  (เตรียม) B1 ส่งรอบ 2 (เหลือกรอก s2) -> 200", b1Round2.status, 200);
    await autoAttachEvidence(BASE, "POST", "/api/exam-results", B1.token, b1Round2); // ใบต้องมีไฟล์ถึงยืนยันได้ (B-03)
    check("  (เตรียม) ยืนยันใบรอบ 2 ของ B1 -> 200", (await call("PATCH", `/api/exam-results/${b1Round2.json.data.result_id}/approve`, { token: oToken })).status, 200);
    // เจ้าหน้าที่ตีกลับใบรอบ 1 ของ B1 ภายหลัง
    await call("PATCH", `/api/exam-results/${b1Paper.json.data.result_id}/reject`, { token: oToken, body: { remark: "หลักฐาน s1 ไม่ชัด" } });
    const statsR2 = (await call("GET", `/api/dashboard/stats?round_id=${roundB2}`, { token: oToken })).json.data;
    const history = (await call("GET", "/api/dashboard/history?years=10", { token: oToken })).json.data;
    const yearB = (history.years || history).find?.((y) => y.year === YEAR_B || y.academic_year === YEAR_B);
    info("รอบ 2 (ใบ B1 ยืนยันแล้ว, s1 ยกมาจากใบรอบ 1 ที่ถูกตีกลับทีหลัง) → fullyPassed รายรอบ", statsR2.fullyPassed);
    info("  สรุปรายปี firstYear.passed (ต้อง 0 เพราะ s1 ไม่มีใบยืนยัน)", yearB?.firstYear?.passed);
    check("B-07 สรุปรายปีไม่นับ s1 ที่ยกมาจากใบที่ถูกตีกลับ → firstYear.passed = 0", yearB?.firstYear?.passed, 0);

    // ════════ B-11 : เปิดรอบพร้อมกัน (INFO) ════════
    console.log("\n── B-11: เจ้าหน้าที่ 2 คนเปิดคนละรอบพร้อมกัน (INFO) ──");
    await call("PUT", `/api/rounds/${roundB2}`, { token: oToken, body: { status: "closed" } });
    const r3 = await call("POST", "/api/rounds", { token: oToken, body: { academic_year: YEAR_B, attempt_number: 3, ...NOW, subject_ids: [s1.subject_id] } });
    const roundB3 = r3.json.data.round_id;
    const [openX, openY] = await Promise.all([
      call("PUT", `/api/rounds/${roundB2}`, { token: oToken, body: { status: "open" } }),
      call("PUT", `/api/rounds/${roundB3}`, { token: oToken, body: { status: "open" } }),
    ]);
    const openNow = ((await call("GET", "/api/rounds", { token: oToken })).json.data || []).filter((r) => r.status === "open" && [roundB2, roundB3].includes(r.round_id));
    info("เปิดพร้อมกัน 2 รอบ → status", [openX.status, openY.status]);
    info("  จำนวนรอบที่เปิดอยู่จริง (ควร 1; ถ้า 2 = บัค B-11 ที่เลือกไม่แก้)", openNow.length);

    // ════════ B-05 : เปลี่ยนรหัสแล้ว token เดิมยังใช้ได้ (ข้อจำกัดที่รู้แล้ว) ════════
    console.log("\n── B-05: token เดิมหลังเปลี่ยนรหัส (ข้อจำกัดที่รู้แล้ว) ──");
    const second = await login(B1.id, nid(1));
    const changed = await call("PATCH", "/api/auth/password", { token: B1.token, body: { current_password: nid(1), new_password: "newpass12345" } });
    check("  เครื่อง A เปลี่ยนรหัส -> 200", changed.status, 200);
    const meOld = await call("GET", "/api/auth/me", { token: second });
    check("B-05 (ข้อจำกัด) token ของเครื่อง B ยังใช้ได้หลังเปลี่ยนรหัส -> 200", meOld.status, 200);
    check("  login ด้วยรหัสเก่าไม่ได้แล้ว -> 401", (await call("POST", "/api/auth/login", { body: { psu_passport_id: B1.id, password: nid(1) } })).status, 401);

    // ════════ AUTH-07 : เดารหัสจาก IP เดียวคนละบัญชี ════════
    // ทำท้ายสุดเพราะ IP นี้จะถูกบล็อกต่อ (ตัวนับอยู่ใน memory ของ server รอบนี้ — เริ่มใหม่ทุกไฟล์เทส)
    console.log("\n── AUTH-07: ต่อ IP 60 ครั้ง/15 นาที ──");
    let blockedAt = null;
    for (let i = 1; i <= 65; i++) {
      const r = await call("POST", "/api/auth/login", { body: { psu_passport_id: `nouser${i}`, password: "x" } });
      if (r.status === 429) { blockedAt = i; break; }
    }
    info("โดน 429 ครั้งที่", blockedAt);
    check("AUTH-07 โดนบล็อกภายใน 61 ครั้ง (ไม่เกินเพดาน 60 + ครั้งที่ใช้ไปก่อนหน้า)", blockedAt !== null && blockedAt <= 61, true);
  } finally {
    await cleanupYears([YEAR_A, YEAR_B]);
    for (const id of parked) await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "open" } });
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error(e); process.exit(1); });
