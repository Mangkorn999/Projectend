// Smoke test for rooms + student CSV bulk import (incl. Thai ANSI/win874 encoding).
// Run with the server already listening on BASE, after a fresh `npx prisma db seed`.
import iconv from "iconv-lite";

const BASE = process.env.BASE || "http://localhost:3000";
const results = [];
let failures = 0;

const call = async (method, url, { token, body, form } = {}) => {
  const headers = {};
  // `token` ที่ส่งเข้ามาคือข้อความ cookie เต็มๆ เช่น "token=eyJhbGci..."
  // backend อ่าน JWT จาก httpOnly cookie แล้ว ไม่ได้อ่านจาก Authorization header อีก
  if (token) headers.Cookie = token;
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
  // ดึง cookie ที่ server ส่งกลับมา (มีเฉพาะตอน login) เพื่อเอาไปใช้ request ถัดๆ ไป
  // set-cookie มาเป็น "token=eyJ...; Path=/; HttpOnly; SameSite=Lax" — เอาแค่ชิ้นแรกก่อน ;
  let cookie = null;
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    cookie = setCookie.split(";")[0];
  }
  return { status: res.status, json, cookie };
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

const csvBody = (studentId = "6699990001", nationalId = "1100000000001") =>
  ["student_id,national_id", `${studentId},${nationalId}`].join("\r\n");

const main = async () => {
  const officerLogin = await login("456");
  check("login officer → 200", officerLogin.status, 200);
  const officerToken = officerLogin.cookie;

  // ── rooms ────────────────────────────────────────
  // ต้องส่ง token แล้ว — /api/rooms ไม่ใช่ public อีกต่อไป
  // (เดิมเปิดไว้เพราะมีหน้าสมัครสมาชิก ตอนนี้ไม่มีแล้ว)
  check("GET /api/rooms ไม่ login → 401", (await call("GET", "/api/rooms")).status, 401);
  const rooms = await call("GET", "/api/rooms", { token: officerToken });
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
    Buffer.from(csvBody(), "utf8"),
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
  // หมายเหตุ: CSV ใหม่ไม่มีคอลัมน์ภาษาไทยแล้ว (ชื่อ/ห้อง ย้ายไป complete-profile)
  // เคสนี้เลยไม่ได้ทดสอบ path decode win874 จริงจัง (ไม่มี byte ที่ไม่ใช่ ASCII ให้เดาผิด) แต่ยังคุ้มไว้เผื่อมีคนเปิดไฟล์เป็น ANSI มา
  const win874Csv = iconv.encode(
    ["student_id,national_id", "6699990002,1100000000002"].join("\r\n"),
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
    new Blob([Buffer.from(csvBody("6699990003", "1100000000003"), "utf8")], { type: "text/csv" }),
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

  // ── bulk import: เลขบัตร ปชช ผิดรูปแบบ (ไม่ใช่ 13 หลัก) → skip พร้อมเหตุผล ─
  const badIdForm = new FormData();
  badIdForm.append(
    "file",
    new Blob([Buffer.from(csvBody("6699990004", "123"), "utf8")], { type: "text/csv" }),
    "students-badid.csv",
  );
  const badIdImport = await call("POST", "/api/students/import", {
    token: officerToken,
    form: badIdForm,
  });
  check("import CSV เลขบัตรผิดรูปแบบ → 201 (แต่ skip)", badIdImport.status, 201);
  check("import CSV เลขบัตรผิดรูปแบบ → skipped_count 1", badIdImport.json?.data?.skipped_count, 1);

  console.log(results.join("\n"));
  console.log(`\n${results.length - failures}/${results.length} passed`);
  if (failures > 0) process.exit(1);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
