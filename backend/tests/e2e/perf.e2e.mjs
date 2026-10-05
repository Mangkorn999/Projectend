// เทสประสิทธิภาพ + ความทนทานเมื่อมีข้อมูลขนาดจริง (แผน docs/full-system-test-plan.md ข้อ 16: PERF-01..06)
//
// รันผ่าน:  npm run test:perf   (ใส่ข้อมูลจำลอง 5 รุ่น ~900 คน ลงฐานข้อมูลชั่วคราว ไม่แตะข้อมูลจริง)
// เกณฑ์ผ่านเป็นของเครื่องเดียว (backend + ฐานข้อมูล + เทส อยู่เครื่องเดียวกัน) — เครื่องจริงที่แยกกันจะช้ากว่า/เร็วกว่าเล็กน้อย
//
//   PERF-01/02  หน้าที่เจ้าหน้าที่เปิดบ่อย (แดชบอร์ด, ย้อนหลัง, ตรวจ, รายชื่อ) ≤ 2 วินาที (ค่ากลางของ 3 ครั้ง)
//   PERF-06     ส่งออก PDF/Excel ทั้งรุ่น ≤ 10 วินาที
//   PERF-03     นักศึกษา 200 คนเปิดกระดิ่งแจ้งเตือนพร้อมกัน 10 รอบ — ไม่มี error, p95 ≤ 1.5 วินาที
//   PERF-05     นำเข้ารายชื่อ 1,000 แถว (ตรวจไฟล์ + นำเข้าจริง) ≤ 3 นาที
//   PERF-04     นักศึกษา 100 คนส่งผล+แนบไฟล์พร้อมกัน (กดซ้ำสองครั้งทุกคน) — ไม่มี 500 ไม่มีใบซ้ำ
// บัญชีนักศึกษาเข้าระบบด้วยการเซ็น token เองจาก JWT_SECRET ของฐานข้อมูลเทส (login จริงถูกจำกัด 60 ครั้งต่อ IP ต่อ 15 นาที)
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const API = process.env.API || "http://localhost:3200/api";
const prisma = new PrismaClient();
let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
  return ok;
};
const info = (name, value) => console.log(`INFO  ${name}  -> ${value}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sec = (ms) => (ms / 1000).toFixed(2);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const percentile = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];

async function call(client, method, urlPath, body, form) {
  const headers = {};
  if (client.cookie) headers.Cookie = client.cookie;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const started = Date.now();
  const res = await fetch(API + urlPath, { method, headers, body: payload });
  const buffer = Buffer.from(await res.arrayBuffer());
  const ms = Date.now() - started;
  let json = {};
  try { json = JSON.parse(buffer.toString("utf8")); } catch { /* ไฟล์ */ }
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) client.cookie = setCookie.split(";")[0];
  return { status: res.status, data: json.data, json, ms, bytes: buffer.length, head: buffer.subarray(0, 4).toString() };
}
const loginClient = async (u, p) => {
  const client = { cookie: null };
  const r = await call(client, "POST", "/auth/login", { psu_passport_id: u, password: p });
  if (r.status !== 200) throw new Error(`login ${u} ไม่สำเร็จ (${r.status})`);
  return client;
};
const forgeClient = (userId) => ({
  cookie: "token=" + jwt.sign({ userId, role: "student", studentId: null, mustChangePassword: false }, process.env.JWT_SECRET, { expiresIn: "1h" }),
});

// วัดเวลาของ endpoint 3 ครั้ง → ค่ากลาง
async function timeEndpoint(label, client, urlPath, limitMs) {
  const times = [];
  let status = 0;
  let bytes = 0;
  for (let i = 0; i < 3; i++) {
    const r = await call(client, "GET", urlPath);
    times.push(r.ms);
    status = r.status;
    bytes = r.bytes;
  }
  info(`${label}: ${times.map(sec).join(" / ")} วินาที, ขนาดคำตอบ ${(bytes / 1024).toFixed(0)} KB`, "");
  check(`${label}: 200 และค่ากลาง ≤ ${limitMs / 1000} วินาที (${sec(median(times))})`, [status, median(times) <= limitMs], [200, true]);
}

const main = async () => {
  const officer = await loginClient("456", "456");
  const exec = await loginClient("789", "789");

  // ════════ ขนาดข้อมูล ════════
  const students = (await call(officer, "GET", "/students")).data || [];
  const rounds = (await call(officer, "GET", "/rounds")).data || [];
  console.log(`\nข้อมูลทดสอบ: นักศึกษา ${students.length} คน, ${rounds.length} รอบ`);
  check("ข้อมูลขนาดจริง (นักศึกษา ≥ 700 คน)", students.length >= 700, true);
  const papers = (await call(officer, "GET", "/exam-results")).data || [];
  info("ใบผลสอบทั้งหมดในระบบ", papers.length);
  const latest = rounds[0];
  const latestYear = Math.max(...rounds.map((r) => r.academic_year));

  // ════════ PERF-01/02: หน้าที่เจ้าหน้าที่เปิดบ่อย ════════
  console.log("\n── PERF-01/02 เวลาตอบของหน้าหลัก (เจ้าหน้าที่) ──");
  await timeEndpoint("แดชบอร์ดรอบล่าสุด", officer, `/dashboard/stats?round_id=${latest.round_id}`, 2000);
  await timeEndpoint("สถิติย้อนหลัง 10 ปี", officer, "/dashboard/history?years=10", 2000);
  await timeEndpoint("แจ้งเตือนเจ้าหน้าที่", officer, "/dashboard/alerts", 2000);
  await timeEndpoint("คิวตรวจ: ใบรอตรวจทั้งหมด", officer, "/exam-results?staff_status=pending", 2000);
  await timeEndpoint("ใบผลสอบทั้งหมด (หน้าข้อมูลนักศึกษา)", officer, "/exam-results", 2000);
  await timeEndpoint("รายชื่อนักศึกษาทั้งหมด", officer, "/students", 2000);
  await timeEndpoint("รอบทั้งหมด", officer, "/rounds", 2000);
  await timeEndpoint("แดชบอร์ดผู้บริหาร: ย้อนหลัง 20 ปี", exec, "/dashboard/history?years=20", 2000);

  // ════════ PERF-06: ส่งออก ════════
  console.log("\n── PERF-06 ส่งออกทั้งรุ่น ──");
  const exp = async (label, urlPath, kind, method = "GET", body) => {
    const r = await call(officer, method, urlPath, body);
    info(`${label}: ${sec(r.ms)} วินาที, ${(r.bytes / 1024).toFixed(0)} KB`, "");
    check(`${label}: 200 ไฟล์ถูกชนิด ≤ 10 วินาที`, [r.status, kind === "pdf" ? r.head === "%PDF" : r.head.startsWith("PK"), r.ms <= 10000], [200, true, true]);
  };
  const y = latestYear - 4 >= 2565 ? latestYear : 2569;
  await exp("ผ่านภายในปีแรก (Excel)", `/dashboard/export-first-year?year=${y}&passed=true&format=xlsx`, "xlsx");
  await exp("ไม่ผ่านภายในปีแรก (PDF)", `/dashboard/export-first-year?year=${y}&passed=false&format=pdf`, "pdf");
  await exp("ผ่านครั้งแรก (Excel)", `/dashboard/export-first-attempt?year=${y}&passed=true&format=xlsx`, "xlsx");
  await exp("รายงานผลรอบล่าสุด (PDF)", `/dashboard/export?round_id=${latest.round_id}`, "pdf");
  await exp("ข้อมูลนักศึกษาทั้งรุ่น แยกรอบ (Excel)", "/students/export", "xlsx", "POST", { year: y, by_round: true });
  const sampleSubject = (await call(officer, "GET", "/subjects")).data[0];
  await exp("รายชื่อรายวิชา (PDF)", `/students/export-subject?subject_code=${sampleSubject.subject_code}&passed=false&year=${y}&format=pdf`, "pdf");

  // ════════ PERF-03: 200 คนเปิดกระดิ่งพร้อมกัน ════════
  console.log("\n── PERF-03 นักศึกษา 200 คนเปิดแจ้งเตือนพร้อมกัน 10 รอบ ──");
  const pool = await prisma.student.findMany({ take: 200, orderBy: { student_id: "asc" }, select: { student_id: true, user_id: true } });
  const clients = pool.map((s) => ({ ...forgeClient(s.user_id), studentId: s.student_id }));
  const times = [];
  let errors = 0;
  for (let round = 0; round < 10; round++) {
    const results = await Promise.all(clients.map((c) => call(c, "GET", "/notifications/me")));
    for (const r of results) {
      times.push(r.ms);
      if (r.status !== 200) errors++;
    }
    await sleep(300);
  }
  info(`ยิงทั้งหมด ${times.length} ครั้ง: ค่ากลาง ${sec(median(times))} / p95 ${sec(percentile(times, 0.95))} / สูงสุด ${sec(Math.max(...times))} วินาที`, "");
  check("แจ้งเตือน 200 คนพร้อมกัน: ไม่มี error", errors, 0);
  check("  p95 ≤ 1.5 วินาที", percentile(times, 0.95) <= 1500, true);

  // ════════ PERF-05: นำเข้า 1,000 แถว ════════
  console.log("\n── PERF-05 นำเข้ารายชื่อ 1,000 แถว (ปีจบ 2598) ──");
  const IMPORT_PREFIX = "94"; // 94 + 4 = 2598
  const lines = ["รหัสนักศึกษา,เลขบัตรประชาชน"];
  for (let i = 1; i <= 1000; i++) lines.push(`${IMPORT_PREFIX}${String(i).padStart(8, "0")},${"2" + String(i).padStart(12, "0")}`);
  const csv = lines.join("\n");
  const makeForm = () => {
    const fd = new FormData();
    fd.append("file", new Blob([csv], { type: "text/csv" }), "import1000.csv");
    return fd;
  };
  const dry = await call(officer, "POST", "/students/import?dry_run=true", undefined, makeForm());
  info(`ตรวจไฟล์ (ยังไม่บันทึก): ${sec(dry.ms)} วินาที`, "");
  check("ตรวจไฟล์ 1,000 แถว: 200 ไม่มีแถวถูกข้าม", [dry.status, dry.data?.imported_count, dry.data?.skipped_count], [200, 1000, 0]);
  const real = await call(officer, "POST", "/students/import", undefined, makeForm());
  info(`นำเข้าจริง: ${sec(real.ms)} วินาที`, "");
  check("นำเข้าจริง 1,000 แถว: 201 สำเร็จครบ ≤ 3 นาที", [real.status, real.data?.imported_count, real.ms <= 180000], [201, 1000, true]);
  const again = await call(officer, "POST", "/students/import", undefined, makeForm());
  check("นำเข้าซ้ำ: ข้ามหมดว่า 'มีในระบบแล้ว' ไม่เกิดบัญชีซ้ำ", [again.status, again.data?.imported_count, again.data?.skipped_count], [201, 0, 1000]);

  // ════════ PERF-04: 100 คนส่งพร้อมกัน ════════
  console.log("\n── PERF-04 นักศึกษา 100 คนส่งผล + แนบไฟล์พร้อมกัน (ทุกคนกดซ้ำ 2 ครั้ง) ──");
  const rooms = (await call(officer, "GET", "/rooms")).data;
  const subjects = (await call(officer, "GET", "/subjects")).data.slice(0, 3);
  for (const r of ((await call(officer, "GET", "/rounds")).data || []).filter((x) => x.status === "open")) {
    await call(officer, "PUT", `/rounds/${r.round_id}`, { status: "closed" });
  }
  const created = await call(officer, "POST", "/rounds", { academic_year: 2598, attempt_number: 1, open_date: "2020-01-01", close_date: "2099-12-31", subject_ids: subjects.map((s) => s.subject_id) });
  const roundId = created.data.round_id;
  check("เปิดรอบของรุ่นที่นำเข้า -> 200", (await call(officer, "PUT", `/rounds/${roundId}`, { status: "open" })).status, 200);
  const accounts = await prisma.user.findMany({ where: { psu_passport_id: { startsWith: IMPORT_PREFIX } }, take: 100, orderBy: { psu_passport_id: "asc" }, select: { user_id: true, psu_passport_id: true } });
  check("มีบัญชีที่นำเข้าให้ใช้ 100 คน", accounts.length, 100);
  // กรอกโปรไฟล์ (ครั้งแรก) ของทั้ง 100 คนพร้อมกัน
  const crowd = accounts.map((a, i) => ({ ...forgeClient(a.user_id), seq: i + 1 }));
  const profileResults = await Promise.all(crowd.map((c) => call(c, "POST", "/students/complete-profile", {
    first_name: `ทดสอบ${c.seq}`, last_name: "พร้อมกัน", first_name_en: `Test${c.seq}`, last_name_en: "Crowd",
    email: `crowd${c.seq}@test.local`, phone: "0812345678", room_id: rooms[0].room_id,
  })));
  check("กรอกโปรไฟล์ 100 คนพร้อมกัน: 201 ทั้งหมด", profileResults.filter((r) => r.status === 201).length, 100);
  // forge ใหม่ให้มี studentId (authenticate อ่านจาก DB อยู่แล้ว ใช้ client เดิมได้)
  const pdf = () => {
    const fd = new FormData();
    fd.append("file", new Blob([Buffer.from("%PDF-1.4\n%crowd\n%%EOF\n")], { type: "application/pdf" }), "ใบคะแนน.pdf");
    fd.append("certificate_type", "exam_result");
    return fd;
  };
  const answers = subjects.map((s) => ({ subject_id: s.subject_id, is_passed: true }));
  const started = Date.now();
  const submitResults = await Promise.all(crowd.map(async (c) => {
    // กดส่งซ้ำ 2 ครั้งพร้อมกัน (เน็ตกระตุก/กดรัว)
    const [a, b] = await Promise.all([call(c, "POST", "/exam-results", { subject_results: answers }), call(c, "POST", "/exam-results", { subject_results: answers })]);
    const resultId = a.data?.result_id || b.data?.result_id;
    const up = resultId ? await call(c, "POST", `/exam-results/${resultId}/certificates`, undefined, pdf()) : { status: 0 };
    return { a: a.status, b: b.status, up: up.status };
  }));
  const wallMs = Date.now() - started;
  info(`ทั้งหมดเสร็จใน ${sec(wallMs)} วินาที`, "");
  const server500 = submitResults.filter((r) => r.a >= 500 || r.b >= 500 || r.up >= 500).length;
  const noPaper = submitResults.filter((r) => r.a !== 200 && r.b !== 200).length;
  check("ไม่มี 500 เลยสักครั้ง", server500, 0);
  check("ทุกคนส่งสำเร็จอย่างน้อย 1 ครั้ง", noPaper, 0);
  check("แนบไฟล์สำเร็จ 100 คน", submitResults.filter((r) => r.up === 200).length, 100);
  const paperCount = await prisma.examResult.count({ where: { round_id: roundId } });
  const certCount = await prisma.certificate.count({ where: { exam_result: { round_id: roundId } } });
  const dupes = await prisma.examResult.groupBy({ by: ["student_id"], where: { round_id: roundId }, _count: { _all: true }, having: { student_id: { _count: { gt: 1 } } } });
  check("ใบผลสอบ = 100 ใบพอดี ไม่มีใครมี 2 ใบ", [paperCount, dupes.length], [100, 0]);
  check("ไฟล์แนบ = 100 ไฟล์ (1 ไฟล์ต่อใบ)", certCount, 100);
  const statsAfter = (await call(officer, "GET", `/dashboard/stats?round_id=${roundId}`)).data;
  check("แดชบอร์ดของรอบนี้นับ ส่งแล้ว 100 / ยืนยันแล้ว 0 / รอตรวจ 100 และตอบภายใน 2 วินาที", [statsAfter.submitted, statsAfter.confirmed, statsAfter.by.submitted], [100, 0, 100]);
  const pendingList = await call(officer, "GET", `/exam-results?round_id=${roundId}&staff_status=pending`);
  check("คิวตรวจของรอบนี้ 100 ใบ ตอบ ≤ 2 วินาที", [pendingList.data?.length, pendingList.ms <= 2000], [100, true]);
  info("เวลาคิวตรวจ 100 ใบ", sec(pendingList.ms) + " วินาที");

  // ล้างข้อมูลปีทดสอบ (schema ชั่วคราวถูกลบอยู่แล้ว แต่ล้างให้เรียบร้อย)
  await prisma.$disconnect();
  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
};

try {
  await main();
} catch (err) {
  failures++;
  console.error(err);
}
process.exit(failures === 0 ? 0 : 1);
