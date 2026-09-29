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

  // ── ไฟล์ที่ Excel สร้างจริง — ใช้ dry_run ไม่เขียน DB ─────────────────
  // ทุกเคสต้อง "ตรวจแล้วบอกตรงกับที่นำเข้าจริงจะเกิด" ไม่งั้นหน้า "ตรวจไฟล์" โกหกเจ้าหน้าที่
  const dryRun = async (csvText) => {
    const f = new FormData();
    f.append("file", new Blob([Buffer.from(csvText, "utf8")], { type: "text/csv" }), "excel.csv");
    return call("POST", "/api/students/import?dry_run=true", { token: officerToken, form: f });
  };

  // รหัสซ้ำกันเองในไฟล์: เดิมใบตรวจนับได้ 2 แต่นำเข้าจริงเข้าแค่ 1
  const dup = (await dryRun("student_id,national_id\r\n6699990011,1234567890123\r\n6699990011,1234567890124\r\n")).json?.data;
  check("dry_run แถวรหัสซ้ำในไฟล์ → นำเข้าได้ 1", dup?.imported_count, 1);
  check("dry_run แถวรหัสซ้ำในไฟล์ → ข้าม 1 พร้อมบอกว่าซ้ำกับแถว 2", dup?.skipped?.[0]?.reason?.includes("ซ้ำกับแถว 2"), true);

  // Excel แปลงเลข 13 หลักเป็น 1.23457E+12 — ต้องบอกสาเหตุ ไม่ใช่แค่ "ต้องเป็น 13 หลัก"
  const sci = (await dryRun("student_id,national_id\r\n6699990012,1.23457E+12\r\n")).json?.data;
  check("dry_run เลขบัตร E+12 → ข้าม", sci?.skipped_count, 1);
  check("  เหตุผลพูดถึง Excel", sci?.skipped?.[0]?.reason?.includes("Excel"), true);

  // Excel บางภาษา save คั่นด้วย ; + หัวคอลัมน์ตัวพิมพ์ใหญ่ + แถวว่าง ; ท้ายไฟล์
  const semi = (await dryRun("Student_ID;National_ID\r\n6699990013;1234567890123\r\n;\r\n;\r\n")).json?.data;
  check("dry_run คั่นด้วย ; + หัวตัวใหญ่ + แถวว่าง → นำเข้าได้ 1 ไม่มีแถวขยะ", `${semi?.imported_count},${semi?.skipped_count}`, "1,0");

  // เลขบัตรมีช่องว่างท้ายในเครื่องหมายคำพูด (csv-parse ไม่ตัดให้)
  const spaced = (await dryRun('student_id,national_id\r\n6699990014,"1234567890123 "\r\n')).json?.data;
  check("dry_run เลขบัตรมีช่องว่างท้าย → นำเข้าได้", spaced?.imported_count, 1);

  // เลขบัตรหลายรูปแบบ — ตัดสัญลักษณ์ทิ้งเหลือตัวเลข 13 หลักแล้วนำเข้าได้ทุกแบบ
  const idForms = [
    ["ขีดคั่น", "1-2345-67890-12-3"],
    ["ช่องว่างคั่น", "1 2345 67890 12 3"],
    ["จุดคั่น", "1.2345.67890.12.3"],
    ["เครื่องหมาย ' นำหน้า (Excel text)", "'1234567890123"],
    ["เลขไทย", "๑๒๓๔๕๖๗๘๙๐๑๒๓"],
    ["เลขเต็มความกว้าง", "１２３４５６７８９０１２３"],
    ["ลงท้าย .0", "1234567890123.0"],
    ["ช่องว่างล่องหน", "1234567890123​ "],
  ];
  for (const [label, value] of idForms) {
    const r = (await dryRun(`student_id,national_id

6699990015,"${value}"

`)).json?.data;
    check(`dry_run เลขบัตรแบบ${label} → นำเข้าได้`, r?.imported_count, 1);
  }
  // ที่ต้องยังถูกปฏิเสธ: ตัวอักษรปน / ไม่ครบ 13 / เกิน 13
  for (const [label, value] of [["มีตัวอักษรปน", "12345abc90123"], ["12 หลัก", "123456789012"], ["14 หลัก", "12345678901234"]]) {
    const r = (await dryRun(`student_id,national_id

6699990016,"${value}"

`)).json?.data;
    check(`dry_run เลขบัตร${label} → ข้าม`, r?.skipped_count, 1);
  }

  // หัวคอลัมน์ผิดจริง → ข้อความต้องบอกว่าไฟล์มีคอลัมน์อะไรบ้าง
  const wrongHead = await dryRun("ชื่อ,เบอร์โทร\r\nสมชาย,0812345678\r\n");
  check("dry_run หัวคอลัมน์ผิด → 400", wrongHead.status, 400);
  check("  ข้อความบอกคอลัมน์ที่พบ", wrongHead.json?.message?.includes("คอลัมน์ที่พบในไฟล์"), true);

  // ── ไฟล์ Excel (.xlsx) ตรงๆ — เลข 13 หลักที่เป็น "ตัวเลข" ในเซลล์ต้องเข้าครบทุกหลัก ──
  // ที่มา: ถ้าบันทึกเป็น CSV Excel เขียนเลขเป็น 1.23457E+12 (หายไปแล้ว กู้ไม่ได้) แต่ .xlsx เก็บเลขเต็มไว้
  // fixture = 3 แถว: เลขบัตรเป็น Number 2 แถว, เป็นข้อความ 1 แถว, หัวคอลัมน์ตัวพิมพ์ใหญ่, แถวที่ 3 ใส่ปีจบ 2572 (ซ้ำชั้น)
  const { readFileSync } = await import("node:fs");
  const xlsxBuf = readFileSync(new URL("./fixtures/students-numeric-ids.xlsx", import.meta.url));
  const sendXlsx = async (buf, name = "students.xlsx") => {
    const f = new FormData();
    f.append("file", new Blob([buf], { type: "application/octet-stream" }), name);
    return call("POST", "/api/students/import?dry_run=true", { token: officerToken, form: f });
  };
  const xl = await sendXlsx(xlsxBuf);
  check("dry_run .xlsx -> 200", xl.status, 200);
  check("  เลขบัตรที่เป็น Number อ่านได้ครบ นำเข้าได้ 3 ข้าม 0", `${xl.json?.data?.imported_count},${xl.json?.data?.skipped_count}`, "3,0");
  check("  อ่านปีจบ 2572 ของแถวซ้ำชั้นได้", xl.json?.data?.year_overrides?.[0]?.academic_year, 2572);
  // เปลี่ยนชื่อเป็น .csv ก็ยังอ่านได้ — ดูจากเนื้อไฟล์ ไม่ใช่นามสกุล
  check("  ตั้งชื่อไฟล์เป็น .csv แต่เนื้อเป็น xlsx -> ยังอ่านได้", (await sendXlsx(xlsxBuf, "students.csv")).json?.data?.imported_count, 3);
  const badXlsx = await sendXlsx(Buffer.concat([Buffer.from("PK"), Buffer.from("ไม่ใช่ zip จริง")]));
  check("  ไฟล์ xlsx เสีย -> 400 ข้อความไทย", `${badXlsx.status},${badXlsx.json?.message?.includes("อ่านไฟล์ Excel ไม่ได้")}`, "400,true");

  // ── เลข 1929900326091 (ของจริงที่เจ้าหน้าที่พิมพ์แล้วนำเข้าไม่ได้) + หัวคอลัมน์ที่พิมพ์เองไม่ตรง template ──
  // fixture: เลขในเซลล์ตัวเลขถูกเขียนเป็น 1.929900326091E+12 (ใน .xlsx ค่านี้คือเลขเต็ม ต่างจาก CSV) + หัวคอลัมน์ภาษาไทย
  const xlSci = await sendXlsx(readFileSync(new URL("./fixtures/students-sci-notation-thai-headers.xlsx", import.meta.url)));
  check("xlsx เลข E-notation + หัวคอลัมน์ไทย -> นำเข้าได้ 3 ข้าม 0", `${xlSci.json?.data?.imported_count},${xlSci.json?.data?.skipped_count}`, "3,0");
  check("  หัวคอลัมน์ผิด/ไม่ครบ -> ข้อความบอกคอลัมน์ที่พบ", (await dryRun("foo,bar\r\n1,2\r\n")).json?.message?.includes("คอลัมน์ที่พบในไฟล์: foo, bar"), true);
  const aliasCsv = (await dryRun("Student ID,เลขบัตรประชาชน,ปีการศึกษา\r\n6699991201,1929900326091,\r\n")).json?.data;
  check("CSV หัวคอลัมน์ 'Student ID' / ไทย -> นำเข้าได้", `${aliasCsv?.imported_count},${aliasCsv?.skipped_count}`, "1,0");

  // ── ข้อมูลจาก Google Form: คนกรอกเอง มีขีดคั่น/ช่องว่าง/เลขไทย ──
  const formCsv = (await dryRun(
    "Timestamp,รหัสนักศึกษา,เลขบัตรประชาชน,ชื่อ\r\n" +
    "2026/09/25 10:00,6699991301,1-9299-00326-09-1,สมชาย\r\n" +
    "2026/09/25 10:01,๖๖๙๙๙๙๑๓๐๒,๑๙๒๙๙๐๐๓๒๖๐๙๒,สมหญิง\r\n" +
    "2026/09/25 10:02,6699991303,1 9299 00326 09 3,สมศรี\r\n" +
    "2026/09/25 10:03,6699991304,1-9299-00326-09,ตัวเลขไม่ครบ\r\n",
  )).json?.data;
  check("Google Form: ขีดคั่น/เลขไทย/ช่องว่าง นำเข้าได้ 3 (คอลัมน์เกิน Timestamp/ชื่อ ถูกข้าม)", formCsv?.imported_count, 3);
  check("  เลขไม่ครบ 13 หลัก ยังถูกปฏิเสธ", `${formCsv?.skipped_count},${formCsv?.skipped?.[0]?.student_id}`, "1,6699991304");

  // ── หัวคอลัมน์แบบ Google Form (ชื่อคำถามยาว/มีวงเล็บ) + ให้เจ้าหน้าที่เลือกคอลัมน์เอง ──
  const dryRunMap = async (csvText, mapping) => {
    const f = new FormData();
    f.append("file", new Blob([Buffer.from(csvText, "utf8")], { type: "text/csv" }), "form.csv");
    if (mapping !== undefined) f.append("mapping", typeof mapping === "string" ? mapping : JSON.stringify(mapping));
    return call("POST", "/api/students/import?dry_run=true", { token: officerToken, form: f });
  };

  // ของจริงที่เจ้าหน้าที่เจอ: หัวคอลัมน์ = ชื่อคำถามใน Form
  const realForm = await dryRunMap(
    "ประทับเวลา,student_id(รหัสนักศึกษา),national_id(เลขบัตรปชช),academic_year(ปีจบการศึกษา)\r\n" +
    "2026/09/25 10:00,6699991401,1929900326091,\r\n",
  );
  check("หัว 'student_id(รหัสนักศึกษา)' ... -> เดาได้เอง นำเข้าได้ 1", `${realForm.json?.data?.imported_count},${realForm.json?.data?.skipped_count}`, "1,0");
  check("  ตอบกลับบอกว่าใช้คอลัมน์ไหน", realForm.json?.data?.columns_used?.national_id, "national_id(เลขบัตรปชช)");

  // ชื่อคำถามแบบภาษาไทยล้วน (ไม่มี student_id/national_id นำหน้า) — ต้องเดาได้ทั้ง 3 ช่อง โดยเฉพาะปีจบ
  // (ถ้าเดาปีจบไม่ได้ ช่องนี้จะถูกเมินเงียบๆ แล้วคนซ้ำชั้นได้ปีจบผิด)
  for (const yearHead of ["ปีการศึกษาที่จบ", "ปีการศึกษา จบ", "ปีจบการศึกษา", "ปีที่จบ", "ปีการศึกษา"]) {
    const thai = await dryRunMap(
      `ประทับเวลา,รหัสนักศึกษา,เลขบัตรประชาชน,${yearHead}
2026/09/25 10:00,6699991403,1929900326091,2572
`,
    );
    const used = thai.json?.data?.columns_used;
    check(`หัวไทยล้วน ปีจบ='${yearHead}' -> เดาครบ 3 ช่อง`, `${used?.student_id}|${used?.national_id}|${used?.academic_year}`, `รหัสนักศึกษา|เลขบัตรประชาชน|${yearHead}`);
  }

  // ชื่ออื่นที่เดาไม่ได้ -> 400 พร้อมรายชื่อคอลัมน์ให้หน้าจอทำช่องเลือก
  const oddCsv = "ชื่อ,คอลัมน์ก,คอลัมน์ข\r\nสมชาย,6699991402,1929900326092\r\n";
  const odd = await dryRunMap(oddCsv);
  check("ชื่อคอลัมน์เดาไม่ได้ -> 400 code missing_columns", `${odd.status},${odd.json?.code}`, "400,missing_columns");
  check("  ส่งรายชื่อคอลัมน์ในไฟล์กลับมาให้เลือก", odd.json?.columns?.join("|"), "ชื่อ|คอลัมน์ก|คอลัมน์ข");
  const picked = await dryRunMap(oddCsv, { student_id: "คอลัมน์ก", national_id: "คอลัมน์ข" });
  check("เจ้าหน้าที่เลือกคอลัมน์เอง -> นำเข้าได้ 1", `${picked.json?.data?.imported_count},${picked.json?.data?.skipped_count}`, "1,0");
  check("เลือกคอลัมน์ซ้ำกัน -> 400", (await dryRunMap(oddCsv, { student_id: "คอลัมน์ก", national_id: "คอลัมน์ก" })).status, 400);
  check("เลือกคอลัมน์ที่ไม่มีในไฟล์ -> 400", (await dryRunMap(oddCsv, { student_id: "ไม่มีจริง", national_id: "คอลัมน์ข" })).status, 400);
  check("ส่ง mapping ไม่ใช่ JSON -> 400", (await dryRunMap(oddCsv, "{{{")).status, 400);

  // ปีเข้าเรียนต้องไม่ถูกเดาเป็นปีจบ (จะทำให้นักศึกษาเห็นรอบสอบของรุ่นผิดเงียบๆ)
  const admitYear = await dryRunMap("student_id,national_id,ปีการศึกษาที่เข้า\r\n6699991403,1929900326093,2566\r\n");
  check("'ปีการศึกษาที่เข้า' ไม่ถูกจับเป็นปีจบ", admitYear.json?.data?.columns_used?.academic_year, null);
  check("  ยังนำเข้าได้ปกติ (คำนวณปีจบจากรหัส)", admitYear.json?.data?.imported_count, 1);

  // ── ไฟล์ที่ Google Sheets ส่งออกจริง (เทสจากไฟล์จริงของเจ้าหน้าที่ 25 ก.ย.) ──
  // Sheets เขียนตัวเลขใน .xlsx เป็น "1412.0" / "2570.0" และเลขยาวเป็น E-notation "6.610210001E9" ที่ครบทุกหลัก
  // (ต่างจาก Excel ที่เขียน CSV เป็น 1.23457E+12 ตัดเหลือ 6 หลัก — อันนี้ต้องยังถูกปฏิเสธ ห้ามเดาเติม 0)
  const gs = await sendXlsx(readFileSync(new URL("./fixtures/students-google-sheets-style.xlsx", import.meta.url)));
  check("Google Sheets .xlsx: '1412.0' + E-notation ครบหลัก -> นำเข้าได้ 2 ข้าม 1", `${gs.json?.data?.imported_count},${gs.json?.data?.skipped_count}`, "2,1");
  check("  E-notation ที่ตัดหลักแล้ว (1.92990E+12) ยังถูกปฏิเสธ พร้อมบอกสาเหตุ", gs.json?.data?.skipped?.[0]?.reason?.includes("Excel"), true);
  const gsCsv = (await dryRun(
    "ประทับเวลา,student_id(รหัสนักศึกษา),national_id(เลขบัตรปชช),academic_year(ปีจบการศึกษา)\r\n" +
    "2026/09/25 10:00,6699991701.0,1.929900326093E12,2570.0\r\n" +
    "2026/09/25 10:01,6699991702,1.92990E+12,\r\n",
  )).json?.data;
  check("CSV จาก Sheets: '.0' + E-notation ครบหลัก -> นำเข้าได้ 1 ข้าม 1 (E-notation ตัดหลัก ไม่เดา)", `${gsCsv?.imported_count},${gsCsv?.skipped_count}`, "1,1");
  const bareCode = (await dryRunMap("รหัส,เลขบัตรประชาชน\r\n6699991703,1929900326094\r\n")).json?.data;
  check("หัวคอลัมน์ 'รหัส' เฉยๆ = รหัสนักศึกษา", `${bareCode?.imported_count},${bareCode?.columns_used?.student_id}`, "1,รหัส");

  console.log(results.join("\n"));
  console.log(`\n${results.length - failures}/${results.length} passed`);
  if (failures > 0) process.exit(1);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
