// End-to-end smoke test for Phase 4/5/6 endpoints.
// Run with the server already listening on BASE.
import fs from "fs";
import os from "os";
import path from "path";

const BASE = process.env.BASE || "http://localhost:3000";
const results = [];
let failures = 0;

const call = async (method, url, { token, body, form } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${url}`, { method, headers, body: payload });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = { _raw: "<non-json>" };
  }
  return { status: res.status, json };
};

const check = (name, actual, expected, extra = "") => {
  const ok = actual === expected;
  if (!ok) failures++;
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}  → ${actual} (want ${expected}) ${extra}`);
  return ok;
};

// รหัสผ่านเริ่มต้นจาก seed = psu_passport_id ของตัวเอง
const login = async (psu_passport_id) =>
  call("POST", "/api/auth/login", {
    body: { psu_passport_id, password: psu_passport_id },
  });

const main = async () => {
  // ── auth ─────────────────────────────────────────
  // เดิมเช็ค faculty_id จาก body — ตัดออกแล้วเพราะ SSO ใช้ไม่ได้ เปลี่ยนมา login ด้วยรหัสผ่าน
  const wrongPassword = await call("POST", "/api/auth/login", {
    body: { psu_passport_id: "6610210631", password: "wrong-password" },
  });
  check("login รหัสผ่านผิด → 401", wrongPassword.status, 401);

  const unknownUser = await call("POST", "/api/auth/login", {
    body: { psu_passport_id: "ไม่มีคนนี้", password: "whatever" },
  });
  check("login user ไม่มีจริง → 401", unknownUser.status, 401);

  const studentLogin = await login("6610210631", "Thanyatep");
  check("login student → 200", studentLogin.status, 200);
  const studentToken = studentLogin.json.token;
  console.log("student jwt payload:", JSON.parse(Buffer.from(studentToken.split(".")[1], "base64").toString()));

  const officerLogin = await login("456", "Thep");
  check("login officer → 200", officerLogin.status, 200);
  const officerToken = officerLogin.json.token;
  console.log("officer jwt payload:", JSON.parse(Buffer.from(officerToken.split(".")[1], "base64").toString()));

  const execLogin = await login("789", "Kitsiri");
  check("login executive → 200", execLogin.status, 200);
  const execToken = execLogin.json.token;

  // ── no token / wrong role ────────────────────────
  check("no token → 401", (await call("GET", "/api/students")).status, 401);
  check(
    "student เรียก GET /api/students → 403",
    (await call("GET", "/api/students", { token: studentToken })).status,
    403,
  );

  // ── Phase 4: rounds ──────────────────────────────
  const noRoundYet = await call("GET", "/api/rounds/active", { token: studentToken });
  check("rounds/active ก่อนเปิดสิทธิ์ → 403", noRoundYet.status, 403, JSON.stringify(noRoundYet.json?.message));

  const eligible = await call("PATCH", "/api/students/bulk-eligible", {
    token: officerToken,
    body: { student_ids: ["6610210631"], exam_eligible: true },
  });
  check("bulk-eligible → 200", eligible.status, 200, JSON.stringify(eligible.json));

  const noOpenRound = await call("GET", "/api/rounds/active", { token: studentToken });
  check("rounds/active ยังไม่มีรอบ → 200 + data null", noOpenRound.status, 200, JSON.stringify(noOpenRound.json));

  const createRound = await call("POST", "/api/rounds", {
    token: officerToken,
    body: {
      academic_year: 2568,
      attempt_number: 1,
      open_date: new Date(Date.now() - 86400000).toISOString(),
      close_date: new Date(Date.now() + 86400000).toISOString(),
      status: "open",
    },
  });
  check("สร้างรอบ → 200", createRound.status, 200, JSON.stringify(createRound.json).slice(0, 200));
  const roundId = createRound.json?.data?.round_id;

  const studentCreateRound = await call("POST", "/api/rounds", {
    token: studentToken,
    body: { academic_year: 2568, attempt_number: 9, open_date: new Date().toISOString(), close_date: new Date().toISOString() },
  });
  check("student สร้างรอบ → 403", studentCreateRound.status, 403);

  const activeRound = await call("GET", "/api/rounds/active", { token: studentToken });
  check("rounds/active → 200 มีรอบ", activeRound.status, 200);
  check("rounds/active คืน round_id ตรง", activeRound.json?.data?.round_id, roundId);

  check("GET /api/rounds → 200", (await call("GET", "/api/rounds", { token: studentToken })).status, 200);

  const updRound = await call("PUT", `/api/rounds/${roundId}`, {
    token: officerToken,
    body: { attempt_number: 2 },
  });
  check("PUT /api/rounds/:id → 200", updRound.status, 200, JSON.stringify(updRound.json?.data?.attempt_number));

  // ── Phase 5: exam results ────────────────────────
  const subjects = await call("GET", "/api/subjects", { token: studentToken });
  check("GET /api/subjects → 200", subjects.status, 200);
  const subjectIds = (subjects.json?.data || []).map((s) => s.subject_id);
  console.log("subject count:", subjectIds.length);

  const emptyBody = await call("POST", "/api/exam-results", { token: studentToken, body: {} });
  check("POST exam-results ไม่ส่งวิชา → 400", emptyBody.status, 400);

  const submit = await call("POST", "/api/exam-results", {
    token: studentToken,
    body: {
      subject_results: subjectIds.map((id, i) => ({ subject_id: id, is_passed: i !== 2 })),
    },
  });
  check("POST exam-results → 200", submit.status, 200, JSON.stringify(submit.json).slice(0, 160));
  const resultId = submit.json?.data?.result_id;

  const dup = await call("POST", "/api/exam-results", {
    token: studentToken,
    body: { subject_results: [{ subject_id: subjectIds[0], is_passed: true }] },
  });
  check("POST exam-results ซ้ำรอบเดิม → 409", dup.status, 409);

  const mine = await call("GET", "/api/exam-results/me", { token: studentToken });
  check("GET exam-results/me → 200", mine.status, 200);
  check("me คืน 1 รายการ", mine.json?.data?.length, 1);
  check("me มี subject_results 8 วิชา", mine.json?.data?.[0]?.subject_results?.length, subjectIds.length);

  // ── certificates upload ──────────────────────────
  // เขียนไฟล์ทดสอบไว้ที่ temp dir ของเครื่อง ไม่ปนกับ repo
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nurse-smoke-"));
  const pdfPath = path.join(tmpDir, "ใบผลสอบ.pdf");
  fs.writeFileSync(pdfPath, "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");
  const txtPath = path.join(tmpDir, "dummy.txt");
  fs.writeFileSync(txtPath, "not a pdf");

  const mkForm = (filePath, type, mime, name) => {
    const fd = new FormData();
    fd.append("file", new Blob([fs.readFileSync(filePath)], { type: mime }), name);
    if (type) fd.append("certificate_type", type);
    return fd;
  };

  const upOk = await call("POST", `/api/exam-results/${resultId}/certificates`, {
    token: studentToken,
    form: mkForm(pdfPath, "exam_result", "application/pdf", "ใบผลสอบ.pdf"),
  });
  check("upload PDF → 200", upOk.status, 200, JSON.stringify(upOk.json).slice(0, 200));

  const upTxt = await call("POST", `/api/exam-results/${resultId}/certificates`, {
    token: studentToken,
    form: mkForm(txtPath, "exam_result", "text/plain", "x.txt"),
  });
  check("upload non-PDF → 400", upTxt.status, 400, JSON.stringify(upTxt.json?.message));

  const upBadType = await call("POST", `/api/exam-results/${resultId}/certificates`, {
    token: studentToken,
    form: mkForm(pdfPath, "wrong_type", "application/pdf", "a.pdf"),
  });
  check("upload certificate_type ผิด → 400", upBadType.status, 400);

  const upNoFile = await call("POST", `/api/exam-results/${resultId}/certificates`, {
    token: studentToken,
    form: (() => { const fd = new FormData(); fd.append("certificate_type", "license"); return fd; })(),
  });
  check("upload ไม่แนบไฟล์ → 400", upNoFile.status, 400);

  // ── Phase 6: staff review ────────────────────────
  const listStudent = await call("GET", "/api/exam-results", { token: studentToken });
  check("student เรียก GET /api/exam-results → 403", listStudent.status, 403);

  const listOfficer = await call("GET", "/api/exam-results", { token: officerToken });
  check("officer GET /api/exam-results → 200", listOfficer.status, 200);
  check("list คืน 1 รายการ", listOfficer.json?.data?.length, 1);
  const leaked = JSON.stringify(listOfficer.json).includes("nursing_council");
  check("list ไม่มี field รหัสสภาหลุด", leaked, false);

  const listExec = await call("GET", "/api/exam-results", { token: execToken });
  check("executive GET /api/exam-results → 200", listExec.status, 200);

  const filtered = await call("GET", "/api/exam-results?staff_status=pending", { token: officerToken });
  check("filter staff_status=pending → 1 รายการ", filtered.json?.data?.length, 1);
  const filteredNone = await call("GET", "/api/exam-results?staff_status=approved", { token: officerToken });
  check("filter staff_status=approved → 0 รายการ", filteredNone.json?.data?.length, 0);

  const execApprove = await call("PATCH", `/api/exam-results/${resultId}/approve`, { token: execToken });
  check("executive approve → 403 (read-only)", execApprove.status, 403);

  const rejectNoRemark = await call("PATCH", `/api/exam-results/${resultId}/reject`, {
    token: officerToken,
    body: {},
  });
  check("reject ไม่ใส่ remark → 400", rejectNoRemark.status, 400);

  const reject = await call("PATCH", `/api/exam-results/${resultId}/reject`, {
    token: officerToken,
    body: { remark: "เอกสารไม่ชัด" },
  });
  check("reject + remark → 200", reject.status, 200);
  check("reject เซ็ต staff_status", reject.json?.data?.staff_status, "rejected");
  check("reject เซ็ต confirmed_by", typeof reject.json?.data?.confirmed_by, "number");

  const approve = await call("PATCH", `/api/exam-results/${resultId}/approve`, { token: officerToken });
  check("approve → 200", approve.status, 200);
  check("approve เซ็ต staff_status", approve.json?.data?.staff_status, "approved");

  const approveMissing = await call("PATCH", "/api/exam-results/999999/approve", { token: officerToken });
  check("approve id ไม่มีจริง → 404", approveMissing.status, 404);

  // ── students ownership ───────────────────────────
  const own = await call("GET", "/api/students/6610210631", { token: studentToken });
  check("student ดูข้อมูลตัวเอง → 200", own.status, 200);
  const other = await call("GET", "/api/students/9999999999", { token: studentToken });
  check("student ดูข้อมูลคนอื่น → 403", other.status, 403);
  const officerViewStudent = await call("GET", "/api/students/6610210631", { token: officerToken });
  check("officer ดูข้อมูลนักศึกษา → 200", officerViewStudent.status, 200);
  check(
    "GET /api/students/:id ไม่มีรหัสสภา",
    JSON.stringify(officerViewStudent.json).includes("nursing_council"),
    false,
  );
  check(
    "credentials endpoint ถูกลบแล้ว → 403/404",
    [403, 404].includes((await call("GET", "/api/students/6610210631/credentials", { token: officerToken })).status),
    true,
  );

  console.log("\n" + results.join("\n"));
  console.log(`\n${results.length - failures}/${results.length} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
};

main().catch((e) => {
  console.error("TEST RUNNER CRASHED:", e);
  process.exit(2);
});
