// ทดสอบด้วยข้อมูลหน้าตาจริง (คัดลอกจากฐานข้อมูลจริงแบบอ่านอย่างเดียว) — ไม่เขียนอะไรลงข้อมูลจริง
//
// รันผ่าน:  npm run test:real   (run-e2e.mjs --copy-real: คัดลอก public → schema ชั่วคราว แล้วรันไฟล์นี้บนสำเนา)
// เทสในไฟล์นี้ "อ่านอย่างเดียว" ทั้งหมด: GET + เปิดหน้าจอ ไม่กดยืนยัน/ตีกลับ/ลบ/นำเข้า
//   1. ความถูกต้องของข้อมูล: ใบทุกใบมีผลรายวิชา, นักศึกษาทุกคนมีโปรไฟล์, ไฟล์แนบมีอยู่บน disk
//   2. สถิติทุกรอบและทุกปีภายในสอดคล้องกัน (สถานะรวมกัน = ทั้งรุ่น ฯลฯ) และผู้บริหารเห็นเท่าเจ้าหน้าที่
//   3. ไฟล์ส่งออกทุกปีมีจำนวนแถวตรงกับสถิติ
//   4. ไม่มี password_hash หลุดใน response ใดๆ
//   5. เปิดทุกหน้าของทุกบทบาท (จอ 390 และ 1366) ไม่เลื่อนแนวนอน ไม่มี error ไม่มีค่าหลุด
//   6. เวลาตอบของหน้าหลักกับข้อมูลจริง
import { chromium } from "playwright-core";
import { PrismaClient } from "@prisma/client";
import { readSheet } from "read-excel-file/node";
import fs from "fs";
import os from "os";
import path from "path";
import { applySession, apiClient, findAccount } from "./forgeSession.mjs";

const FE = process.env.FE || "http://localhost:5175";
const API = process.env.API || "http://localhost:3200/api";
const OUT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "nurse-real-"));
const prisma = new PrismaClient();

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual).slice(0, 300)} (want ${JSON.stringify(expected).slice(0, 120)})`);
  return ok;
};
const info = (name, value) => console.log(`INFO  ${name}  -> ${value}`);
const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);
const FORBIDDEN_TEXT = ["undefined", "NaN", "[object Object]", "Request failed", "exam_result", "certificate_type", "round_id", "student_id", "Prisma"];
const forbiddenIn = (text) => FORBIDDEN_TEXT.filter((w) => text.includes(w));

const main = async () => {
  // ── บัญชีที่ใช้ (หาจากข้อมูลจริง ไม่ต้องรู้รหัสผ่าน) ──
  const officerAcc = await findAccount(prisma, { psu_passport_id: "456" });
  const execAcc = await findAccount(prisma, { psu_passport_id: "789" });
  const reviewerAcc = await findAccount(prisma, { psu_passport_id: "N1" });
  check("พบบัญชีเจ้าหน้าที่ ผู้บริหาร ผู้ช่วยตรวจ ในข้อมูลจริง", [Boolean(officerAcc), Boolean(execAcc), Boolean(reviewerAcc)], [true, true, true]);
  const officer = apiClient(API, officerAcc);
  const exec = apiClient(API, execAcc);

  // ════════ 1. ความถูกต้องของข้อมูล ════════
  console.log("\n── 1. ความถูกต้องของข้อมูล (อ่านอย่างเดียว) ──");
  const counts = {
    users: await prisma.user.count(), students: await prisma.student.count(), rounds: await prisma.submissionRound.count(),
    papers: await prisma.examResult.count(), subjectResults: await prisma.subjectResult.count(), certs: await prisma.certificate.count(),
  };
  info("จำนวนข้อมูลในสำเนา", JSON.stringify(counts));
  check("ข้อมูลสำเนาครบ (นักศึกษา ≥ 900, ใบ ≥ 1,000)", [counts.students >= 900, counts.papers >= 1000], [true, true]);
  const papersWithoutSubjects = await prisma.examResult.count({ where: { subject_results: { none: {} } } });
  check("ใบผลสอบทุกใบมีผลรายวิชาอย่างน้อย 1 วิชา", papersWithoutSubjects, 0);
  const studentsNoProfile = await prisma.student.count({ where: { user: { OR: [{ first_name: null }, { last_name: null }] } } });
  check("นักศึกษาทุกคนมีชื่อ-นามสกุลในบัญชี", studentsNoProfile, 0);
  const emptyEn = await prisma.student.count({ where: { OR: [{ first_name_en: "" }, { last_name_en: "" }] } });
  info("นักศึกษาที่ชื่ออังกฤษว่าง", emptyEn);
  const dupPapers = await prisma.examResult.groupBy({ by: ["student_id", "round_id"], _count: { _all: true }, having: { student_id: { _count: { gt: 1 } } } });
  check("ไม่มีนักศึกษาที่มี 2 ใบในรอบเดียว", dupPapers.length, 0);
  const paperYears = await prisma.examResult.findMany({ select: { student: { select: { academic_year: true } }, round: { select: { academic_year: true } } } });
  const mismatch = paperYears.filter((p) => p.student.academic_year !== p.round.academic_year).length;
  check("ใบทุกใบอยู่ในรอบของรุ่นตัวเอง (ปีรอบ = ปีจบของนักศึกษา)", mismatch, 0);
  const openRounds = await prisma.submissionRound.count({ where: { status: "open" } });
  check("เปิดรับอยู่ไม่เกิน 1 รอบ", openRounds <= 1, true);
  const certs = await prisma.certificate.findMany({ select: { file_path: true } });
  const missingFiles = certs.filter((c) => !fs.existsSync(path.resolve(c.file_path))).length;
  info(`ไฟล์แนบ ${certs.length} ไฟล์ — หายจาก disk`, missingFiles);
  const staffNoHash = await prisma.user.count({ where: { password_hash: null, role: { role_name: { not: "student" } } } });
  info("บัญชีบุคลากรที่ถูกปิด (ไม่มีรหัสผ่าน)", staffNoHash);

  // ════════ 2. สถิติสอดคล้องกัน ════════
  console.log("\n── 2. สถิติทุกปี/ทุกรอบสอดคล้องกัน + ผู้บริหารเห็นเท่าเจ้าหน้าที่ ──");
  const history = (await officer("GET", "/dashboard/history?years=20")).data.years;
  const execHistory = (await exec("GET", "/dashboard/history?years=20")).data.years;
  check("ผู้บริหารเห็นสรุปรายปีเท่าเจ้าหน้าที่", JSON.stringify(execHistory) === JSON.stringify(history), true);
  const studentsByYear = new Map();
  for (const s of await prisma.student.findMany({ select: { academic_year: true } })) studentsByYear.set(s.academic_year, (studentsByYear.get(s.academic_year) || 0) + 1);
  const yearProblems = [];
  for (const y of history) {
    const expected = studentsByYear.get(y.academic_year) || 0;
    if (y.total !== expected + y.pending_accounts) yearProblems.push(`${y.academic_year}: total ${y.total} ≠ ${expected}+${y.pending_accounts}`);
    if (sum(y.statusByStudent) !== y.total) yearProblems.push(`${y.academic_year}: สถานะรวม ${sum(y.statusByStudent)} ≠ ทั้งรุ่น ${y.total}`);
    if (y.firstYear.passed < y.firstAttempt.passed) yearProblems.push(`${y.academic_year}: ผ่านปีแรก < ผ่านครั้งแรก`);
    if (y.fullyPassed !== y.firstYear.passed) yearProblems.push(`${y.academic_year}: fullyPassed ≠ firstYear.passed`);
    if (y.submitted > y.total) yearProblems.push(`${y.academic_year}: ส่งแล้ว > ทั้งรุ่น`);
    for (const r of y.rounds) if (r.fullyPassed > r.confirmed || r.confirmed > r.submitted) yearProblems.push(`${y.academic_year}/${r.attempt_number}: ตัวเลขรอบไม่สอดคล้อง`);
  }
  check(`สรุปรายปีทุกปี (${history.length} ปี) สอดคล้อง: ทั้งรุ่น = นักศึกษาในตาราง, สถานะรวม = ทั้งรุ่น, ผ่านปีแรก ≥ ผ่านครั้งแรก`, yearProblems, []);
  for (const y of history) {
    info(`ปี ${y.academic_year}: ทั้งรุ่น ${y.total} ส่งแล้ว ${y.submitted} ผ่านครั้งแรก ${y.firstAttempt.passed} (${y.firstAttempt.rate}%) ผ่านภายในปีแรก ${y.firstYear.passed} (${y.firstYear.rate}%) ห้อง ${y.byRoom.map((r) => `${r.room_name}:${r.total}`).join("/")}`, "");
  }

  const rounds = (await officer("GET", "/rounds")).data;
  const roundProblems = [];
  for (const r of rounds) {
    const o = await officer("GET", `/dashboard/stats?round_id=${r.round_id}`);
    const e = await exec("GET", `/dashboard/stats?round_id=${r.round_id}`);
    if (o.status !== 200 || e.status !== 200) { roundProblems.push(`รอบ ${r.round_id}: status ${o.status}/${e.status}`); continue; }
    const s = o.data;
    if (sum(s.by) + s.not_started !== s.total) roundProblems.push(`รอบ ${r.round_id}: สถานะ ${sum(s.by)}+ยังไม่เริ่ม ${s.not_started} ≠ ${s.total}`);
    if (sum(s.by) + s.roundNotStarted !== s.roundTotal) roundProblems.push(`รอบ ${r.round_id}: ฐานคนของรอบไม่ครบ`);
    if (s.fullyPassed > s.confirmed || s.confirmed > s.submitted) roundProblems.push(`รอบ ${r.round_id}: ผ่านครบ/ยืนยัน/ส่ง ไม่สอดคล้อง`);
    const { alreadyPassedStudentIds, ...rest } = s;
    if (JSON.stringify(rest) !== JSON.stringify(e.data) || "alreadyPassedStudentIds" in e.data) roundProblems.push(`รอบ ${r.round_id}: ผู้บริหารเห็นไม่เท่าเจ้าหน้าที่/เห็นรายชื่อ`);
    const dbPapers = await prisma.examResult.count({ where: { round_id: r.round_id } });
    if (dbPapers !== sum(s.by)) roundProblems.push(`รอบ ${r.round_id}: ใบในตาราง ${dbPapers} ≠ ในสถิติ ${sum(s.by)}`);
  }
  check(`สถิติรายรอบทุกรอบ (${rounds.length} รอบ): 200, สถานะรวมกันได้ทั้งรุ่น, ใบตรงกับตาราง, ผู้บริหารเห็นเท่ากัน`, roundProblems, []);

  // ════════ 3. ไฟล์ส่งออกทุกปี ════════
  console.log("\n── 3. ส่งออกทุกปี: จำนวนแถวต้องตรงกับสถิติ ──");
  const sheetRows = async (urlPath) => {
    const r = await officer("GET", urlPath);
    if (r.status !== 200) return { status: r.status, rows: -1 };
    const rows = await readSheet(r.buffer);
    return { status: 200, rows: rows.slice(1).filter((row) => row[1]).length };
  };
  const exportProblems = [];
  for (const y of history) {
    if (!y.rounds.some((r) => r.attempt_number === 1)) continue;
    const fyPass = await sheetRows(`/dashboard/export-first-year?year=${y.academic_year}&passed=true&format=xlsx`);
    const fyFail = await sheetRows(`/dashboard/export-first-year?year=${y.academic_year}&passed=false&format=xlsx`);
    const faPass = await sheetRows(`/dashboard/export-first-attempt?year=${y.academic_year}&passed=true&format=xlsx`);
    const faFail = await sheetRows(`/dashboard/export-first-attempt?year=${y.academic_year}&passed=false&format=xlsx`);
    if (fyPass.rows !== y.firstYear.passed) exportProblems.push(`${y.academic_year}: ผ่านภายในปีแรกในไฟล์ ${fyPass.rows} ≠ แดชบอร์ด ${y.firstYear.passed}`);
    if (fyPass.rows + fyFail.rows !== y.total) exportProblems.push(`${y.academic_year}: ผ่าน+ไม่ผ่านภายในปีแรก ${fyPass.rows + fyFail.rows} ≠ ทั้งรุ่น ${y.total}`);
    if (faPass.rows !== y.firstAttempt.passed) exportProblems.push(`${y.academic_year}: ผ่านครั้งแรกในไฟล์ ${faPass.rows} ≠ แดชบอร์ด ${y.firstAttempt.passed}`);
    if (faPass.rows + faFail.rows !== y.total) exportProblems.push(`${y.academic_year}: ผ่าน+ไม่ผ่านครั้งแรก ≠ ทั้งรุ่น`);
    const students = await officer("POST", "/students/export", { year: y.academic_year });
    if (students.status !== 200 || students.buffer.subarray(0, 2).toString() !== "PK") exportProblems.push(`${y.academic_year}: ส่งออกข้อมูลนักศึกษาล้มเหลว`);
    const report = await officer("GET", `/dashboard/export?round_id=${y.rounds[y.rounds.length - 1].round_id}`);
    if (report.status !== 200 || report.buffer.subarray(0, 4).toString() !== "%PDF") exportProblems.push(`${y.academic_year}: รายงาน PDF ล้มเหลว`);
  }
  check(`ส่งออก Excel/PDF ทุกปี (${history.length} ปี): จำนวนแถวตรงกับแดชบอร์ด ผ่าน+ไม่ผ่าน = ทั้งรุ่น`, exportProblems, []);

  // ════════ 4. ไม่มี password_hash หลุด ════════
  console.log("\n── 4. response ต้องไม่มี password_hash ──");
  const leakPaths = ["/users", "/students", "/exam-results", "/rounds", "/news", "/dashboard/alerts", "/subjects", "/rooms"];
  const leaks = [];
  for (const p of leakPaths) {
    const r = await officer("GET", p);
    if (r.status !== 200) leaks.push(`${p}: ${r.status}`);
    else if (/password_hash|\$2[aby]\$/.test(r.text)) leaks.push(`${p}: มี password_hash`);
  }
  check(`GET ${leakPaths.length} endpoint ของเจ้าหน้าที่: 200 และไม่มี password_hash/ค่า bcrypt`, leaks, []);
  const execLeak = await exec("GET", "/dashboard/history?years=20");
  check("ผู้บริหารเห็นสถิติโดยไม่มีรหัสนักศึกษารายคน (ไม่มี student_id ในสรุปรายปี)", /student_id/.test(execLeak.text), false);

  // ════════ 6. เวลาตอบกับข้อมูลจริง ════════
  console.log("\n── 6. เวลาตอบกับข้อมูลจริง ──");
  const timeIt = async (label, client, urlPath, limit = 2000) => {
    const times = [];
    let status = 0;
    for (let i = 0; i < 3; i++) { const r = await client("GET", urlPath); times.push(r.ms); status = r.status; }
    times.sort((a, b) => a - b);
    check(`${label}: 200 และค่ากลาง ≤ ${limit / 1000} วินาที (${(times[1] / 1000).toFixed(2)})`, [status, times[1] <= limit], [200, true]);
  };
  await timeIt("สถิติย้อนหลังทุกปี", officer, "/dashboard/history?years=20");
  await timeIt("แดชบอร์ดรอบล่าสุด", officer, `/dashboard/stats?round_id=${rounds[0].round_id}`);
  await timeIt("ใบผลสอบทั้งหมด", officer, "/exam-results");
  await timeIt("รายชื่อนักศึกษา", officer, "/students");
  await timeIt("คิวตรวจ (รอตรวจ)", officer, "/exam-results?staff_status=pending");

  // ════════ 5. เปิดทุกหน้าของทุกบทบาท ════════
  console.log("\n── 5. เปิดทุกหน้า (อ่านอย่างเดียว) ──");
  const withApproved = await prisma.student.findFirst({ where: { exam_results: { some: { staff_status: "approved" } } }, orderBy: { student_id: "asc" } });
  const withRejected = await prisma.student.findFirst({ where: { exam_results: { some: { staff_status: "rejected" } } } });
  const withPending = await prisma.student.findFirst({ where: { exam_results: { some: { staff_status: "pending" } } } });
  const noPaper = await prisma.student.findFirst({ where: { exam_results: { none: {} } } });
  const studentAccs = [];
  for (const [label, s] of [["มีใบยืนยันแล้ว", withApproved], ["มีใบถูกตีกลับ", withRejected], ["มีใบรอตรวจ", withPending], ["ยังไม่เคยส่ง", noPaper]]) {
    if (s) studentAccs.push([label, await findAccount(prisma, { user_id: s.user_id })]);
  }
  info("นักศึกษาตัวอย่างที่เลือก", studentAccs.map(([l, a]) => `${l}=${a.username}`).join(", "));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const sweep = async (label, account, paths) => {
    const problems = [];
    let visits = 0;
    for (const width of [390, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, isMobile: width < 500, hasTouch: width < 500 });
      await applySession(context, API, account);
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.setDefaultNavigationTimeout(30000);
      const errors = [];
      page.on("pageerror", (e) => errors.push("หน้าเว็บพัง: " + e.message));
      page.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
      for (const urlPath of paths) {
        errors.length = 0;
        await page.goto(FE + urlPath, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1800);
        const text = await page.locator("body").innerText().catch(() => "");
        const overflow = !(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
        const bad = forbiddenIn(text);
        const notFound = text.includes("ไม่พบหน้าที่ต้องการ");
        visits++;
        if (overflow || bad.length || notFound || errors.length) problems.push(`${urlPath}@${width}: ${[overflow ? "เลื่อนแนวนอน" : "", notFound ? "ไม่พบหน้า" : "", bad.join(","), errors[0] || ""].filter(Boolean).join(" ")}`);
        if (urlPath === "/dashboard" || urlPath === "/status") await page.screenshot({ path: path.join(OUT_DIR, `${label}-${urlPath.replace(/\//g, "_")}-${width}.png`) }).catch(() => {});
      }
      await context.close();
    }
    check(`${label}: ${paths.length} หน้า × 2 ขนาดจอ (${visits} ครั้ง) ไม่เลื่อนแนวนอน ไม่มี error ไม่มีค่าหลุด`, problems, []);
  };
  await sweep("เจ้าหน้าที่", officerAcc, ["/dashboard", "/review", "/students", "/import", "/rounds", "/users", "/news-manage", "/reports", "/manual"]);
  await sweep("ผู้บริหาร", execAcc, ["/dashboard", "/reports"]);
  await sweep("ผู้ช่วยตรวจ", reviewerAcc, ["/review"]);
  for (const [label, acc] of studentAccs) await sweep(`นักศึกษา(${label})`, acc, ["/news", "/exam", "/exam/form", "/status", "/history"]);

  // เปิดหน้ารายละเอียดนักศึกษาที่มีหลายรอบ (อ่านอย่างเดียว) ทั้งจอคอมและมือถือ
  const multi = await prisma.student.findFirst({ where: { exam_results: { some: {} } }, orderBy: { exam_results: { _count: "desc" } } });
  for (const width of [1366, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 500, hasTouch: width < 500 });
    await applySession(context, API, officerAcc);
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
    await page.goto(FE + "/students", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2200);
    const search = page.locator("input[type=search], input[placeholder*='ค้นหา']").first();
    if (await search.count()) await search.fill(multi.student_id).catch(() => {});
    await page.waitForTimeout(900);
    const clicked = await page.locator(`text=${multi.student_id}`).first().click({ timeout: 5000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(2500);
    const text = await page.locator("body").innerText().catch(() => "");
    await page.screenshot({ path: path.join(OUT_DIR, `detail-${width}.png`) }).catch(() => {});
    check(`หน้ารายละเอียดนักศึกษาที่มีหลายรอบ (${width}px): เปิดได้ เห็นรอบสอบ ไม่มี error`, [clicked, text.includes("รอบ"), errors.length, forbiddenIn(text)], [true, true, 0, []]);
    await context.close();
  }
  await browser.close();

  console.log("\nภาพหน้าจออยู่ที่: " + OUT_DIR);
  await prisma.$disconnect();
  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
};

try { await main(); } catch (err) { failures++; console.error(err); }
process.exit(failures === 0 ? 0 : 1);
