// Reviewer role (pooled queue, no assignment) — role visibility, guard against
// double-review (409), and the review_logs audit trail.
// Needs the backend running on localhost:3000, seeded via `node prisma/seed.js`
// (adds psu_passport_id "321"/"321" as a reviewer account).
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

const YEAR = 2596; // clear of the seed data and of other smoke-phase years
const STAMP = Date.now().toString().slice(-8);
const STUDENT_ID = `${String(YEAR - 4).slice(-2)}${STAMP}`;
const NATIONAL_ID = `1${STAMP}00000`.slice(0, 13);
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

const main = async () => {
  const officer = await call("POST", "/api/auth/login", {
    body: { psu_passport_id: "456", password: "456" },
  });
  const oToken = officer.cookie;
  if (!oToken) { console.log("officer login failed:", JSON.stringify(officer.json)); process.exit(1); }

  const reviewer = await call("POST", "/api/auth/login", {
    body: { psu_passport_id: "321", password: "321" },
  });
  const rToken = reviewer.cookie;
  if (!rToken) { console.log("reviewer login failed (run `node prisma/seed.js` first):", JSON.stringify(reviewer.json)); process.exit(1); }
  check("reviewer login -> role reviewer", reviewer.json.user?.role, "reviewer");

  // ---- case 2: reviewer blocked from officer-only surfaces ----
  const dash = await call("GET", "/api/dashboard/stats", { token: rToken });
  check("reviewer GET /dashboard/stats -> 403", dash.status, 403);

  const rounds = await call("POST", "/api/rounds", { token: rToken, body: { academic_year: 1, attempt_number: 1, ...NOW, subject_ids: [] } });
  check("reviewer POST /rounds -> 403", rounds.status, 403);

  // ---- case: reviewer allowed on queue + roster ----
  const list = await call("GET", "/api/exam-results", { token: rToken });
  check("reviewer GET /exam-results -> 200", list.status, 200);

  const students = await call("GET", "/api/students", { token: rToken });
  check("reviewer GET /students -> 200", students.status, 200);

  const ids = (await call("GET", "/api/subjects", { token: oToken })).json.data.map((s) => s.subject_id);
  const rooms = (await call("GET", "/api/rooms", { token: oToken })).json.data || [];

  const allRounds = (await call("GET", "/api/rounds", { token: oToken })).json.data || [];
  const parked = allRounds.filter((r) => r.status === "open").map((r) => r.round_id);
  for (const id of parked) {
    await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });
  }

  const created = [];
  try {
    const r1 = await openRound(oToken, 1, ids.slice(0, 5));
    created.push(r1);

    // create the student
    const made = await call("POST", "/api/students", { token: oToken, body: { student_id: STUDENT_ID, national_id: NATIONAL_ID } });
    check("create student -> 201", made.status, 201);
    const sLogin = await call("POST", "/api/auth/login", { body: { psu_passport_id: STUDENT_ID, password: NATIONAL_ID } });
    const sToken = sLogin.cookie;
    await call("POST", "/api/students/complete-profile", {
      token: sToken,
      body: {
        first_name: "ทดสอบ", last_name: "Reviewer",
        first_name_en: "Test", last_name_en: "Reviewer",
        email: `${STUDENT_ID}@test.local`, phone: "0800000000",
        room_id: rooms[0].room_id,
      },
    });
    await call("PATCH", "/api/students/bulk-eligible", { token: oToken, body: { student_ids: [STUDENT_ID], exam_eligible: true } });

    const submit1 = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id, i) => ({ subject_id: id, is_passed: i < 3 })) },
    });
    check("student submit -> 200", submit1.status, 200);
    const resultId = submit1.json.data.result_id;

    // ---- case 6: reviewer and officer race on the SAME still-pending paper, genuinely
    // concurrently (Promise.all, not awaited one after another) — the guard only protects
    // the pending->X transition, so this must be a true race, not two sequential calls.
    const [raceA, raceB] = await Promise.all([
      call("PATCH", `/api/exam-results/${resultId}/approve`, { token: oToken }),
      call("PATCH", `/api/exam-results/${resultId}/reject`, { token: rToken, body: { remark: "สาย" } }),
    ]);
    const statuses = [raceA.status, raceB.status].sort();
    check("exactly one of the two concurrent reviews wins (200) and the other 409", statuses, [200, 409]);

    // ---- case 4/7: whichever action won, review_logs recorded it (checked indirectly —
    // no read endpoint by design: the student's paper must be decided, either way) ----
    const notif = await call("GET", "/api/exam-results/me", { token: sToken });
    check("student's paper is decided (approved or rejected, not still pending)",
      ["approved", "rejected"].includes(notif.json.data?.[0]?.staff_status), true);

    // ---- reviewer confirms a fresh paper end to end ----
    // findActive() picks an arbitrary open round — r1 must close first or it'll be picked again (already approved -> 409)
    await call("PUT", `/api/rounds/${r1}`, { token: oToken, body: { status: "closed" } });
    const r2 = await openRound(oToken, 2, ids.slice(0, 5));
    created.push(r2);
    const submit2 = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id, i) => ({ subject_id: id, is_passed: i < 3 })) },
    });
    check("student submit round2 -> 200", submit2.status, 200);
    const resultId2 = submit2.json.data?.result_id;
    const reviewerApprove = await call("PATCH", `/api/exam-results/${resultId2}/approve`, { token: rToken });
    check("reviewer approve -> 200", reviewerApprove.status, 200);
    check("  confirmed_by is the reviewer", reviewerApprove.json.data?.confirmed_by, reviewer.json.user.id);

    // once decided, the guard blocks ANY further approve/reject on this paper — even from a
    // different person acting afterwards, not just a literal concurrent race — until the student
    // resubmits (back to pending). This is a deliberate behavior change from pre-reviewer days
    // (see smoke-phase4-6.mjs, same guard now blocks the officer's own immediate reject->approve too).
    const officerFlip = await call("PATCH", `/api/exam-results/${resultId2}/reject`, { token: oToken, body: { remark: "แก้คำตัดสิน" } });
    check("officer tries to flip reviewer's decision without resubmit -> 409", officerFlip.status, 409);
  } finally {
    for (const id of created) {
      await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });
    }
    await cleanupYears([YEAR]);
    for (const id of parked) {
      await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "open" } });
    }
  }

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
};

main();
