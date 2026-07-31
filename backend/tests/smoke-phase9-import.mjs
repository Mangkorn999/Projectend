// Smoke test for rooms + student CSV bulk import (incl. Thai ANSI/win874 encoding).
// Run with the server already listening on BASE, after a fresh `npx prisma db seed`.
import iconv from "iconv-lite";

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
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}  → ${JSON.stringify(actual)} (want ${JSON.stringify(expected)}) ${extra}`);
  return ok;
};

const login = async (psu_passport_id) =>
  call("POST", "/api/auth/login", {
    body: { psu_passport_id, password: psu_passport_id },
  });

const csvBody = (roomName, studentId = "6699990001") =>
  [
    "student_id,first_name,last_name,email,phone,room_name,academic_year",
    `${studentId},ทดสอบ,นำเข้า,test.import@example.com,0800000001,${roomName},2568`,
  ].join("\r\n");

const main = async () => {
  const officerLogin = await login("456");
  check("login officer → 200", officerLogin.status, 200);
  const officerToken = officerLogin.json.token;

  // ── rooms ────────────────────────────────────────
  const rooms = await call("GET", "/api/rooms");
  check("GET /api/rooms → 200", rooms.status, 200);
  check("rooms มีข้อมูล seed", rooms.json?.data?.length >= 2, true);
  check(
    "rooms มีชื่อห้องภาษาไทยถูกต้อง",
    rooms.json?.data?.some((r) => r.room_name === "ห้องเรียนปกติ"),
    true,
  );

  // ── bulk import: UTF-8 CSV (มี BOM) ───────────────
  const utf8Csv = Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from(csvBody("ห้องเรียนปกติ"), "utf8"),
  ]);
  const utf8Form = new FormData();
  utf8Form.append("file", new Blob([utf8Csv], { type: "text/csv" }), "students-utf8.csv");
  const utf8Import = await call("POST", "/api/students/import", {
    token: officerToken,
    form: utf8Form,
  });
  check("import CSV UTF-8 BOM → 201", utf8Import.status, 201);
  check("import CSV UTF-8 BOM → imported_count 1", utf8Import.json?.data?.imported_count, 1);

  // ── bulk import: Thai ANSI (win874) CSV ไม่มี BOM ─
  // จำลองไฟล์ที่ Excel บน Windows ไทย save เป็น CSV ธรรมดา (ไม่ใช่ "CSV UTF-8")
  const win874Csv = iconv.encode(
    [
      "student_id,first_name,last_name,email,phone,room_name,academic_year",
      "6699990002,ทดสอบ,เอนซี,test.import2@example.com,0800000002,ห้องเรียนอังกฤษ,2568",
    ].join("\r\n"),
    "win874",
  );
  const ansiForm = new FormData();
  ansiForm.append("file", new Blob([win874Csv], { type: "text/csv" }), "students-ansi.csv");
  const ansiImport = await call("POST", "/api/students/import", {
    token: officerToken,
    form: ansiForm,
  });
  check("import CSV Thai ANSI (win874) → 201", ansiImport.status, 201);
  check(
    "import CSV Thai ANSI → imported_count 1 (ห้องจับคู่ถูกแม้ไม่มี BOM)",
    ansiImport.json?.data?.imported_count,
    1,
  );
  check("import CSV Thai ANSI → skipped_count 0", ansiImport.json?.data?.skipped_count, 0);

  // ── bulk import: UTF-8 CSV ไม่มี BOM (เช่น Google Sheets/Notepad export) ─
  // เคสนี้เคยพังเพราะ heuristic เดิม "ไม่มี BOM = win874" เดาผิด ต้องลอง decode UTF-8 จริงก่อน
  const utf8NoBomForm = new FormData();
  utf8NoBomForm.append(
    "file",
    new Blob([Buffer.from(csvBody("ห้องเรียนอังกฤษ", "6699990003"), "utf8")], { type: "text/csv" }),
    "students-utf8-no-bom.csv",
  );
  const utf8NoBomImport = await call("POST", "/api/students/import", {
    token: officerToken,
    form: utf8NoBomForm,
  });
  check("import CSV UTF-8 ไม่มี BOM → 201", utf8NoBomImport.status, 201);
  check(
    "import CSV UTF-8 ไม่มี BOM → imported_count 1 (ไม่ถูกเดาเป็น win874 ผิด)",
    utf8NoBomImport.json?.data?.imported_count,
    1,
  );

  // ── bulk import: ห้องไม่มีจริง → skip พร้อมเหตุผล ─
  const badRoomForm = new FormData();
  badRoomForm.append(
    "file",
    new Blob([Buffer.from(csvBody("ห้องไม่มีจริง", "6699990004"), "utf8")], { type: "text/csv" }),
    "students-badroom.csv",
  );
  const badRoomImport = await call("POST", "/api/students/import", {
    token: officerToken,
    form: badRoomForm,
  });
  check("import CSV ห้องไม่มีจริง → 201 (แต่ skip)", badRoomImport.status, 201);
  check("import CSV ห้องไม่มีจริง → skipped_count 1", badRoomImport.json?.data?.skipped_count, 1);

  console.log(results.join("\n"));
  console.log(`\n${results.length - failures}/${results.length} passed`);
  if (failures > 0) process.exit(1);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
