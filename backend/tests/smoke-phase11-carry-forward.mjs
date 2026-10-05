// Carry-forward test: a subject already passed in an earlier round is not asked
// again in the next round, and the backend stores it as passed anyway.
// This test needs an OPEN round to exist, so it opens rounds one at a time and
// closes them again at the end -- run it after the other smoke tests.
import { cleanupYears } from "./cleanupYears.mjs";

import { autoAttachEvidence } from "./autoEvidence.mjs";
const BASE = process.env.BASE || "http://localhost:3000"; // ตั้ง BASE ได้ตอนรันผ่าน test:clean (server ชั่วคราวอยู่คนละพอร์ต)
let failures = 0;

const call = async (method, url, { token, body } = {}) => {
  const headers = {};
  // `token` ที่ส่งเข้ามาคือข้อความ cookie เต็มๆ เช่น "token=eyJhbGci..."
  // backend อ่าน JWT จาก httpOnly cookie แล้ว ไม่ได้อ่านจาก Authorization header อีก
  if (token) headers.Cookie = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  // ดึง cookie ที่ server ส่งกลับมา (มีเฉพาะตอน login) เพื่อเอาไปใช้ request ถัดๆ ไป
  // set-cookie มาเป็น "token=eyJ...; Path=/; HttpOnly; SameSite=Lax" — เอาแค่ชิ้นแรกก่อน ;
  let cookie = null;
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    cookie = setCookie.split(";")[0];
  }
  await autoAttachEvidence(BASE, method, url, token, { status: res.status, json });
  return { status: res.status, json, cookie };
};

const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
};

// A brand new student every run. Carry-forward looks at every round the student
// has ever filled, so reusing the seeded account would inherit passes from the
// previous run and the expected counts would drift.
const YEAR = 2599; // far from seed data so it cannot collide with other tests
const OTHER_YEAR = 2598;
const STAMP = Date.now().toString().slice(-6);
// 2 หลักแรกของรหัสนักศึกษาคำนวณเป็นปีจบฝั่ง server (entry+4) — ต้องตั้งให้ตรงกับปีที่ต้องการทดสอบ
// ต้องครบ 10 หลักพอดี (ปี 2 หลัก + salt 1 หลัก + "0" + เวลา 6 หลัก) ตามกฎรหัสนักศึกษาของระบบ
const makeStudentId = (year, salt) => `${String(year - 4).slice(-2)}${salt}0${STAMP}`;
const makeNationalId = (salt) => `1${STAMP}${salt}`.padEnd(13, "0").slice(0, 13);
const STUDENT_ID = makeStudentId(YEAR, "1");
const OTHER_ID = makeStudentId(OTHER_YEAR, "2"); // same run, different academic year
const FIRST = "ทดสอบ";
const LAST = "แครี่ฟอร์เวิร์ด";
// window wide enough that the round counts as active while the test runs
const NOW = { open_date: "2020-01-01", close_date: "2099-12-31" };

const openRound = async (token, attempt, subjectIds) => {
  const r = await call("POST", "/api/rounds", {
    token,
    body: { academic_year: YEAR, attempt_number: attempt, ...NOW, subject_ids: subjectIds },
  });
  if (r.status !== 200) throw new Error(`create round ${attempt} failed: ${JSON.stringify(r.json)}`);
  const id = r.json.data.round_id;
  await call("PUT", `/api/rounds/${id}`, { token, body: { status: "open" } });
  return id;
};

// Add a student (id+national_id only), let them complete their profile and fill exam results, return their token.
const addStudent = async (token, id, year, roomId, nationalId) => {
  const made = await call("POST", "/api/students", {
    token,
    body: { student_id: id, national_id: nationalId },
  });
  check(`create student ${year} -> 201`, made.status, 201);

  const login = await call("POST", "/api/auth/login", {
    body: { psu_passport_id: id, password: nationalId },
  });
  if (!login.cookie) { console.log(`student ${id} login failed:`, JSON.stringify(login.json)); process.exit(1); }

  const profile = await call("POST", "/api/students/complete-profile", {
    token: login.cookie,
    body: {
      first_name: FIRST, last_name: LAST,
      first_name_en: "Test", last_name_en: "CarryForward",
      email: `${id}@test.local`, phone: "0800000000",
      room_id: roomId,
    },
  });
  check(`complete-profile ${year} -> 201`, profile.status, 201);
  check(`complete-profile academic_year matches ${year}`, profile.json.data?.student?.academic_year, year);

  await call("PATCH", "/api/students/bulk-eligible", {
    token, body: { student_ids: [id], exam_eligible: true },
  });

  return login.cookie;
};

const main = async () => {
  const officer = await call("POST", "/api/auth/login", {
    body: { psu_passport_id: "456", password: "456" },
  });
  const oToken = officer.cookie;
  if (!oToken) { console.log("officer login failed:", JSON.stringify(officer.json)); process.exit(1); }

  const ids = (await call("GET", "/api/subjects", { token: oToken })).json.data.map((s) => s.subject_id);
  if (ids.length < 8) { console.log("need >= 8 subjects, run seed first"); process.exit(1); }

  const rooms = (await call("GET", "/api/rooms", { token: oToken })).json.data || [];
  if (!rooms.length) { console.log("no rooms in db, run seed first"); process.exit(1); }

  const sToken = await addStudent(oToken, STUDENT_ID, YEAR, rooms[0].room_id, makeNationalId("1"));
  const otherToken = await addStudent(oToken, OTHER_ID, OTHER_YEAR, rooms[0].room_id, makeNationalId("2"));

  // Only one round can be active at a time, and findActive() picks an arbitrary
  // open one. Park any round that is already open so ours is the one found,
  // then reopen them in the finally block.
  const allRounds = (await call("GET", "/api/rounds", { token: oToken })).json.data || [];
  const parked = allRounds.filter((r) => r.status === "open").map((r) => r.round_id);
  for (const id of parked) {
    await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });
  }

  const created = [];
  try {
    // ---- round 1: tests 5 subjects, student passes the first 3 ----
    const r1 = await openRound(oToken, 1, ids.slice(0, 5));
    created.push(r1);

    const active1 = await call("GET", "/api/rounds/active", { token: sToken });
    check("round1 active -> 200", active1.status, 200);
    check("  round1 offers 5 subjects", active1.json.data?.subjects?.length, 5);
    check("  none passed yet", active1.json.data?.subjects?.filter((s) => s.already_passed).length, 0);
    check("  all_passed false", active1.json.data?.all_passed, false);

    // a round belongs to one intake -- other years must not see or fill it
    const otherActive = await call("GET", "/api/rounds/active", { token: otherToken });
    check("other-year student sees no round", otherActive.json.data, null);
    const otherFill = await call("POST", "/api/exam-results", {
      token: otherToken,
      body: { subject_results: ids.slice(0, 5).map((id) => ({ subject_id: id, is_passed: true })) },
    });
    check("other-year student cannot fill -> 400", otherFill.status, 400);

    // no round_id given -> dashboard must land on the round that is open,
    // not merely the highest academic_year
    const auto = await call("GET", "/api/dashboard/stats", { token: oToken });
    check("dashboard default picks the open round", auto.json.data?.round?.round_id, r1);

    // reject a subject that this round does not test
    const outside = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: [{ subject_id: ids[7], is_passed: true }] },
    });
    check("subject outside round -> 400", outside.status, 400);

    // reject a partial submission
    const partial = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 2).map((id) => ({ subject_id: id, is_passed: true })) },
    });
    check("incomplete submission -> 400", partial.status, 400);

    // reject non-boolean is_passed ("false" would coerce to true)
    const badType = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id) => ({ subject_id: id, is_passed: "false" })) },
    });
    check("is_passed not boolean -> 400", badType.status, 400);

    const dup = await call("POST", "/api/exam-results", {
      token: sToken,
      body: {
        subject_results: [
          ...ids.slice(0, 5).map((id) => ({ subject_id: id, is_passed: true })),
          { subject_id: ids[0], is_passed: false },
        ],
      },
    });
    check("duplicate subject -> 400", dup.status, 400);

    const submit1 = await call("POST", "/api/exam-results", {
      token: sToken,
      body: {
        subject_results: ids.slice(0, 5).map((id, i) => ({ subject_id: id, is_passed: i < 3 })),
      },
    });
    check("round1 submit 5 subjects -> 200", submit1.status, 200);

    // ส่งซ้ำระหว่างที่ยังไม่ตรวจ = แก้ไข ไม่ใช่ error
    // ส่งชุดเดิม (3 ผ่าน / 2 ตก) เพื่อไม่ให้ตัวเลขของรอบถัดไปเพี้ยน
    const again = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id, i) => ({ subject_id: id, is_passed: i < 3 })) },
    });
    check("edit same round while pending -> 200", again.status, 200);

    // ---- rejected results must be fixable, that is the point of rejecting ----
    const resultId = submit1.json.data.result_id;
    const rejected = await call("PATCH", `/api/exam-results/${resultId}/reject`, {
      token: oToken, body: { remark: "เอกสารไม่ชัด" },
    });
    check("officer rejects -> 200", rejected.status, 200);

    // send the same 3-pass/2-fail spread again: the later rounds below expect
    // exactly 3 carried-forward passes
    const redo = await call("POST", "/api/exam-results", {
      token: sToken,
      body: {
        subject_results: ids.slice(0, 5).map((id, i) => ({ subject_id: id, is_passed: i < 3 })),
      },
    });
    check("resubmit after reject -> 200", redo.status, 200);
    check("  updates the same row", redo.json.data?.result_id, resultId);
    check("  back to pending", redo.json.data?.staff_status, "pending");
    check("  reject remark cleared", redo.json.data?.remark, null);
    check("  confirmer cleared", redo.json.data?.confirmed_by, null);
    check("  old marks replaced, not appended", redo.json.data?.subject_results?.length, 5);
    check("  marks still 3 pass / 2 fail", redo.json.data?.subject_results?.filter((s) => s.is_passed).length, 3);

    // ส่งทับได้เรื่อยๆ ตราบใดที่ยังไม่ถูกยืนยัน — ส่งชุดเดิมไว้ ตัวเลขรอบ 2 จะได้ไม่เพี้ยน
    const redoAgain = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id, i) => ({ subject_id: id, is_passed: i < 3 })) },
    });
    check("resubmit while pending -> 200", redoAgain.status, 200);

    await call("PATCH", `/api/exam-results/${resultId}/approve`, { token: oToken });
    const afterApprove = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id) => ({ subject_id: id, is_passed: true })) },
    });
    check("resubmit after approve -> 409", afterApprove.status, 409);

    await call("PUT", `/api/rounds/${r1}`, { token: oToken, body: { status: "closed" } });

    // ---- round 2: tests 6 subjects, 3 of them already passed ----
    const r2 = await openRound(oToken, 2, ids.slice(0, 6));
    created.push(r2);

    const active2 = await call("GET", "/api/rounds/active", { token: sToken });
    check("round2 offers 6 subjects", active2.json.data?.subjects?.length, 6);
    check("  3 marked already_passed", active2.json.data?.subjects?.filter((s) => s.already_passed).length, 3);
    check("  all_passed false", active2.json.data?.all_passed, false);

    // only the 3 unpassed subjects need answers now
    const remaining = active2.json.data.subjects.filter((s) => !s.already_passed);
    const submit2 = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: remaining.map((s) => ({ subject_id: s.subject_id, is_passed: true })) },
    });
    check("round2 submit only 3 subjects -> 200", submit2.status, 200);
    check("  stored all 6 (carry-forward filled the rest)", submit2.json.data?.subject_results?.length, 6);
    check("  every stored subject passed", submit2.json.data?.subject_results?.every((sr) => sr.is_passed), true);

    // dashboard must score this round against its own 6 subjects, not all 8
    const stats = await call("GET", `/api/dashboard/stats?round_id=${r2}`, { token: oToken });
    check("dashboard stats -> 200", stats.status, 200);
    check("  perSubject scoped to round", stats.json.data?.perSubject?.length, 6);
    // ตัวเลข "ผ่าน" นับเฉพาะใบที่ยืนยันแล้ว — ใบนี้ยังรอตรวจ จึงยังไม่นับ (แต่ยังเป็น "ส่งผลแล้ว")
    check("  pending paper is not counted as passed yet", [stats.json.data?.fullyPassed, stats.json.data?.submitted, stats.json.data?.by?.submitted], [0, 1, 1]);
    const approve2 = await call("PATCH", `/api/exam-results/${submit2.json.data.result_id}/approve`, { token: oToken });
    check("  approve round2 paper -> 200", approve2.status, 200);
    const stats2 = await call("GET", `/api/dashboard/stats?round_id=${r2}`, { token: oToken });
    check("  fullyPassed counts the student once confirmed", stats2.json.data?.fullyPassed, 1);

    await call("PUT", `/api/rounds/${r2}`, { token: oToken, body: { status: "closed" } });

    // ---- round 3: every subject already passed -> nothing left to fill ----
    const r3 = await openRound(oToken, 3, ids.slice(0, 4));
    created.push(r3);
    const active3 = await call("GET", "/api/rounds/active", { token: sToken });
    check("round3 all_passed true", active3.json.data?.all_passed, true);
  } finally {
    // Put the db back the way we found it. Students and rounds left behind turn
    // into fake academic years on the dashboard and crowd the real ones out of
    // the year list, so wipe them — via prisma, since the api refuses to delete
    // a student or a round that already has exam results attached.
    for (const id of created) {
      await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });
    }
    await cleanupYears([YEAR, OTHER_YEAR]);
    for (const id of parked) {
      await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "open" } });
    }
  }

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
};

main();
