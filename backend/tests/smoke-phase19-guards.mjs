// เทสด่านกันคำขอที่ไม่ครบ/ไม่มีจริง — เน้นเคสที่เงียบแล้วอันตราย
//
// บั๊กที่เทสนี้กันไม่ให้กลับมา (เจอจากการไล่ยิงทุก endpoint 23 ก.ย. 2569):
//
// 1. PATCH /api/students/bulk-eligible ไม่ตรวจ body เลย
//    repository ใช้ updateMany({ where: { student_id: { in: student_ids } } })
//    Prisma ตีความ `{ in: undefined }` ว่า "ไม่มีเงื่อนไขนี้" ไม่ใช่ "ไม่ตรงกับอะไร"
//    → ส่ง {"exam_eligible": false} มาโดยลืม student_ids = ปิดสิทธิ์กรอกผลสอบทั้งระบบ
//    และตอบ 200 เหมือนสำเร็จปกติ ไม่มีอะไรเตือน
//
// 2. PUT/DELETE ของที่ไม่มีจริง ตอบ 500 พร้อม error ดิบของ Prisma
//    (เผยชื่อตาราง/คอลัมน์ออกไป และผู้ใช้อ่านไม่รู้เรื่อง) — ต้องเป็น 404

const BASE = process.env.BASE || "http://localhost:3000";
let failures = 0;

const call = async (method, url, { token, body } = {}) => {
  const headers = {};
  if (token) headers.Cookie = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${url}`, {
    method, headers,
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

const main = async () => {
  const token = (await call("POST", "/api/auth/login", {
    body: { psu_passport_id: "456", password: "456" },
  })).cookie;
  check("login officer", !!token, true);

  // ── 1. bulk-eligible ต้องกันคำขอที่ไม่ครบ ──
  const eligibleBefore = (await call("GET", "/api/students", { token })).json.data.filter(s => s.exam_eligible).length;

  check("bulk-eligible body ว่าง -> 400",
    (await call("PATCH", "/api/students/bulk-eligible", { token, body: {} })).status, 400);

  // เคสอันตรายที่สุด: มีแต่ค่า ไม่มีรายชื่อ
  check("bulk-eligible ไม่มี student_ids -> 400",
    (await call("PATCH", "/api/students/bulk-eligible", { token, body: { exam_eligible: false } })).status, 400);

  check("bulk-eligible student_ids ว่าง -> 400",
    (await call("PATCH", "/api/students/bulk-eligible", { token, body: { student_ids: [], exam_eligible: false } })).status, 400);

  check("bulk-eligible ไม่มี exam_eligible -> 400",
    (await call("PATCH", "/api/students/bulk-eligible", { token, body: { student_ids: ["6610210631"] } })).status, 400);

  check("bulk-eligible exam_eligible เป็นข้อความ -> 400",
    (await call("PATCH", "/api/students/bulk-eligible", { token, body: { student_ids: ["6610210631"], exam_eligible: "false" } })).status, 400);

  // ที่สำคัญที่สุด: คำขอพวกนั้นต้องไม่แตะข้อมูลเลยสักแถว
  const eligibleAfter = (await call("GET", "/api/students", { token })).json.data.filter(s => s.exam_eligible).length;
  check("  คำขอที่ถูกปฏิเสธ ต้องไม่เปลี่ยนสิทธิ์ใคร", eligibleAfter, eligibleBefore);

  // ── 2. ของที่ไม่มีจริง ต้องเป็น 404 ไม่ใช่ 500 ──
  const missing = [
    ["PUT", "/api/subjects/999999", { subject_name: "x" }],
    ["DELETE", "/api/subjects/999999", undefined],
    ["PUT", "/api/rounds/999999", { status: "closed" }],
    ["DELETE", "/api/rounds/999999", undefined],
    ["DELETE", "/api/news/999999", undefined],
    ["POST", "/api/users/999999/revoke", undefined],
  ];
  for (const [method, url, body] of missing) {
    const r = await call(method, url, { token, body });
    check(`${method} ${url} -> 404`, r.status, 404);
    check(`  ไม่หลุด error ดิบของ Prisma`, /prisma\.|Invalid `/.test(r.json?.message ?? ""), false);
  }

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
};

main().catch((e) => { console.error("CRASHED:", e); process.exit(2); });
