// Reject/edit-window test: after a rejection the student must be able to change
// every subject of that round again, including the ones they had marked passed.
// A result belonging to the round being filled is not a "previous round".
// Needs the backend running on localhost:3000.
const BASE = "http://localhost:3000";
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
  return { status: res.status, json, cookie };
};

const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
};

// A brand new student every run. Carry-forward looks at every round the student
// has ever filled, so reusing an account would inherit passes from the last run.
const STAMP = Date.now().toString().slice(-8);
const STUDENT_ID = `993${STAMP}`;
const FIRST = "ทดสอบ";
const LAST = "ตีกลับ";
const PASSWORD = "rejectedit123";
const YEAR = 2597; // clear of the seed data and of smoke-phase11 (2599/2598)
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

const addStudent = async (token, id, year, roomId) => {
  const made = await call("POST", "/api/students", {
    token,
    body: {
      student_id: id, first_name: FIRST, last_name: LAST,
      email: `${id}@test.local`, phone: "0800000000",
      room_id: roomId, academic_year: year,
    },
  });
  check(`create student ${year} -> 201`, made.status, 201);

  // imported accounts have no password yet, first-setup sets one
  const setup = await call("POST", "/api/auth/first-setup", {
    body: { student_id: id, first_name: FIRST, last_name: LAST, password: PASSWORD },
  });
  check(`first-setup ${year} -> 201`, setup.status, 201);

  await call("PATCH", "/api/students/bulk-eligible", {
    token, body: { student_ids: [id], exam_eligible: true },
  });

  const login = await call("POST", "/api/auth/login", {
    body: { psu_passport_id: id, password: PASSWORD },
  });
  if (!login.cookie) { console.log(`student ${id} login failed:`, JSON.stringify(login.json)); process.exit(1); }
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

  const sToken = await addStudent(oToken, STUDENT_ID, YEAR, rooms[0].room_id);

  // findActive() picks an arbitrary open round, so park the ones already open
  // and put them back in the finally block.
  const allRounds = (await call("GET", "/api/rounds", { token: oToken })).json.data || [];
  const parked = allRounds.filter((r) => r.status === "open").map((r) => r.round_id);
  for (const id of parked) {
    await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });
  }

  const created = [];
  try {
    // ---- round 1: 5 subjects, 3 passed 2 failed ----
    const r1 = await openRound(oToken, 1, ids.slice(0, 5));
    created.push(r1);

    const submit1 = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id, i) => ({ subject_id: id, is_passed: i < 3 })) },
    });
    check("round1 submit -> 200", submit1.status, 200);
    const resultId = submit1.json.data.result_id;

    // ---- still unreviewed (pending) = editable ----
    const editPending = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id, i) => ({ subject_id: id, is_passed: i < 2 })) },
    });
    check("edit while pending -> 200", editPending.status, 200);
    check("  same row updated", editPending.json.data?.result_id, resultId);
    check("  still pending", editPending.json.data?.staff_status, "pending");
    check("  new answers stored (2 pass)",
      editPending.json.data?.subject_results?.filter((s) => s.is_passed).length, 2);

    // put the 3-pass spread back, the rounds below expect it
    await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id, i) => ({ subject_id: id, is_passed: i < 3 })) },
    });

    // ---- officer rejects ----
    const rejected = await call("PATCH", `/api/exam-results/${resultId}/reject`, {
      token: oToken, body: { remark: "ไฟล์ไม่สมบูรณ์" },
    });
    check("officer rejects -> 200", rejected.status, 200);

    // *** the point of this file ***
    // A rejected result must reopen every subject of the round. The 3 passes
    // came from this round's own result, not from an earlier round.
    const afterReject = await call("GET", "/api/rounds/active", { token: sToken });
    check("after reject: offers 5 subjects", afterReject.json.data?.subjects?.length, 5);
    check("after reject: none locked as already_passed",
      afterReject.json.data?.subjects?.filter((s) => s.already_passed).length, 0);
    check("after reject: all_passed false", afterReject.json.data?.all_passed, false);

    // flip the answers: subjects marked passed become failed and vice versa
    const redo = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id, i) => ({ subject_id: id, is_passed: i >= 3 })) },
    });
    check("resubmit with flipped answers -> 200", redo.status, 200);
    check("  same row updated", redo.json.data?.result_id, resultId);
    check("  back to pending", redo.json.data?.staff_status, "pending");
    check("  remark cleared", redo.json.data?.remark, null);
    check("  confirmer cleared", redo.json.data?.confirmed_by, null);
    check("  flipped marks honoured (2 pass)",
      redo.json.data?.subject_results?.filter((s) => s.is_passed).length, 2);
    check("  nothing carried forward in round 1",
      redo.json.data?.subject_results?.filter((s) => s.carried_forward).length, 0);

    // ---- approved = locked ----
    await call("PATCH", `/api/exam-results/${resultId}/approve`, { token: oToken });
    const afterApprove = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id) => ({ subject_id: id, is_passed: true })) },
    });
    check("edit after approve -> 409", afterApprove.status, 409);

    await call("PUT", `/api/rounds/${r1}`, { token: oToken, body: { status: "closed" } });

    // ---- round 2: passes from a real previous round stay locked ----
    const r2 = await openRound(oToken, 2, ids.slice(0, 5));
    created.push(r2);
    const active2 = await call("GET", "/api/rounds/active", { token: sToken });
    check("round2: 2 subjects locked from previous round",
      active2.json.data?.subjects?.filter((s) => s.already_passed).length, 2);

    const remaining = active2.json.data.subjects.filter((s) => !s.already_passed);
    const submit2 = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: remaining.map((s) => ({ subject_id: s.subject_id, is_passed: true })) },
    });
    check("round2 submit -> 200", submit2.status, 200);
    check("  stored all 5 (carry-forward filled the rest)",
      submit2.json.data?.subject_results?.length, 5);
    check("  2 rows flagged carried_forward",
      submit2.json.data?.subject_results?.filter((s) => s.carried_forward).length, 2);

    // per-subject stats count only students who actually sat the subject,
    // so the 2 carried-forward subjects report null instead of 100%
    const stats = await call("GET", `/api/dashboard/stats?round_id=${r2}`, { token: oToken });
    check("stats -> 200", stats.status, 200);
    check("  perSubject scoped to round", stats.json.data?.perSubject?.length, 5);
    check("  2 subjects have no real sitters",
      stats.json.data?.perSubject?.filter((s) => s.rate === null).length, 2);
    check("  those subjects count nobody",
      stats.json.data?.perSubject?.filter((s) => s.rate === null).every((s) => s.pass === 0 && s.fail === 0), true);
    check("  fullyPassed still counts carry-forward", stats.json.data?.fullyPassed, 1);

    // ---- revoking eligibility must not break the donut arithmetic ----
    await call("PATCH", "/api/students/bulk-eligible", {
      token: oToken, body: { student_ids: [STUDENT_ID], exam_eligible: false },
    });
    const afterRevoke = await call("GET", `/api/dashboard/stats?round_id=${r2}`, { token: oToken });
    const d = afterRevoke.json.data;
    // สถิติหารด้วย "นักศึกษาทั้งรุ่นที่ import" ไม่ใช่คนที่เปิดสิทธิ์อยู่
    // ถอนสิทธิ์ทีหลังต้องไม่ทำให้ผลที่ส่งไปแล้วหายจากโดนัท
    check("donut segments sum to cohort total",
      d.by.approved + d.by.submitted + d.by.rejected + d.by.draft + d.not_started,
      d.total);

    await call("PATCH", "/api/students/bulk-eligible", {
      token: oToken, body: { student_ids: [STUDENT_ID], exam_eligible: true },
    });
  } finally {
    // leave no open round behind, then put the DB back the way we found it
    for (const id of created) {
      await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });
    }
    for (const id of parked) {
      await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "open" } });
    }
  }

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
};

main();
