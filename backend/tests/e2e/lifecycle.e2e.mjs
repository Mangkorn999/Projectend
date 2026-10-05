// เทสวงจรครบ 3 รอบ ของรุ่นเดียว + กวาดหน้าจอทุกบทบาททุกขนาดจอ (แผน docs/full-system-test-plan.md ข้อ 10 และข้อ 15)
//
// รันผ่าน:  npm run test:e2e:lifecycle   (สร้างฐานข้อมูลชั่วคราว + เปิดเว็บให้เอง ไม่แตะข้อมูลจริง)
//
// หลักการ: "ตารางคำตอบ" ด้านล่างคำนวณด้วยมือล่วงหน้าจากกฎของระบบ — ไม่ได้ดูจากผลที่ระบบตอบ
// แล้วเทียบกับตัวเลขที่ระบบรายงานจริงทุกจุด (สถิติรายรอบ รายปี รายชื่อส่งออก ผู้บริหารเห็นเท่าเจ้าหน้าที่)
//
// นักศึกษา 10 คน (รุ่น 2596, 8 วิชา):
//   S01 ผ่านครบรอบ 1 → ยืนยัน
//   S02 ตก 2 วิชารอบ 1 → ผ่านทั้งสองในรอบ 2
//   S03 ตก 2 วิชารอบ 1 → รอบ 2 ผ่าน 1 ตก 1 → ผ่านในรอบ 3
//   S04 ตก 2 วิชา ทั้ง 3 รอบ
//   S05 ถูกตีกลับระหว่างรอบ 1 เปิด → แก้ส่งใหม่ → ยืนยัน (ผ่านครบ)
//   S06 ถูกตีกลับ "หลังปิดรอบ 1" (ก่อนรอบ 2 เริ่ม) → แก้ส่งใหม่ได้ → ยืนยัน (ผ่านครบ)
//   S07 ใบรอบ 1 ค้างรอตรวจตอนรอบ 2 เปิด → ถูกตีกลับหลังรอบ 2 เริ่ม → ต้องกรอกครบ 8 วิชาในรอบ 2 → ผ่าน
//   S09 ไม่ส่งเลย
//   S10 ถูกถอนสิทธิ์กรอกก่อนรอบ 1
//   S13 นำเข้าแล้วแต่ไม่เคยเข้าระบบ (บัญชีรอเปิดใช้) — นับเป็น "ยังไม่กรอก" (ตัดสินใจ 5 ต.ค. 2569)
//
// ตัวเลขที่ต้องได้ (ดู check ในแต่ละหัวข้อ):
//   รอบ 1: ส่ง 7, ยืนยัน 6, รอตรวจ 1 (S07), ผ่านครบรอบนี้ 3 (S01, S05, S06)
//   รอบ 2: ผ่านครบมาก่อน 3, กรอกได้ 5, ส่ง 4 (S02,S03,S04,S07) ยืนยัน 4, ผ่านครบรอบนี้ 2 (S02, S07)
//   รอบ 3: ผ่านครบมาก่อน 5, กรอกได้ 3, ส่ง 2 (S03,S04), ผ่านครบรอบนี้ 1 (S03)
//   ปี 2596: นักศึกษาทั้งรุ่น 10 · ผ่านครั้งแรก 3 (30%) · ผ่านภายในปีแรก 6 (60%) · ไม่ผ่าน S04,S09,S10,S13
import { chromium } from "playwright-core";
import { readSheet } from "read-excel-file/node";
import fs from "fs";
import os from "os";
import path from "path";

const FE = process.env.FE || "http://localhost:5175";
const API = process.env.API || "http://localhost:3200/api";
const OUT_DIR = process.env.OUT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "nurse-lifecycle-"));

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
  return ok;
};
const fail = (message) => { failures++; console.log(`FAIL  ${message}`); };
const note = (message) => console.log(`NOTE  ${message}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sectionSummary = [];
async function section(title, steps) {
  console.log(`\n── ${title} ──`);
  const before = failures;
  try {
    await steps();
  } catch (err) {
    fail(`[${title}] หยุดกลางคัน: ${String(err && err.message ? err.message : err).split("\n")[0]}`);
  }
  sectionSummary.push({ title, fails: failures - before });
}

// ── API client (แต่ละคนมี cookie ของตัวเอง) ─────────────────────────────
const makeClient = () => ({ cookie: null });
async function call(client, method, urlPath, body) {
  const headers = {};
  if (client.cookie) headers.Cookie = client.cookie;
  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(API + urlPath, { method, headers, body: payload });
  const json = await res.json().catch(() => ({}));
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) client.cookie = setCookie.split(";")[0];
  return { status: res.status, data: json.data, json };
}
async function download(client, urlPath) {
  const res = await fetch(API + urlPath, { headers: { Cookie: client.cookie } });
  return { status: res.status, buffer: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") || "" };
}
async function loginClient(username, password) {
  const client = makeClient();
  const res = await call(client, "POST", "/auth/login", { psu_passport_id: username, password });
  if (res.status !== 200) throw new Error(`login ${username} ไม่สำเร็จ (${res.status})`);
  return client;
}
const pdfBlobForm = (name) => {
  const form = new FormData();
  form.append("file", new Blob([Buffer.from("%PDF-1.4\n%lifecycle evidence\n%%EOF\n")], { type: "application/pdf" }), name);
  form.append("certificate_type", "exam_result");
  return form;
};
async function attachPdf(client, resultId) {
  const res = await fetch(`${API}/exam-results/${resultId}/certificates`, { method: "POST", headers: { Cookie: client.cookie }, body: pdfBlobForm("ใบคะแนน.pdf") });
  return res.status;
}

// ── เตรียมข้อมูล ───────────────────────────────────────────────────────
const YEAR = 2596;
const STAMP = Date.now().toString().slice(-6);
const PREFIX = String(YEAR - 4).slice(-2);
const idOf = (seq) => `${PREFIX}${STAMP}${String(seq).padStart(2, "0")}`;
const nidOf = (seq) => `1${STAMP}0000${seq}`.slice(0, 13).padEnd(13, "0");
const WHO = { S01: 1, S02: 2, S03: 3, S04: 4, S05: 5, S06: 6, S07: 7, S09: 9, S10: 10, S13: 13 };
const ID = Object.fromEntries(Object.entries(WHO).map(([k, seq]) => [k, idOf(seq)]));
const NOW = { open_date: "2020-01-01", close_date: "2099-12-31" };

const FORBIDDEN_TEXT = ["undefined", "NaN", "[object Object]", "Request failed", "exam_result", "certificate_type", "round_id", "student_id", "Prisma"];
const bodyText = (page) => page.locator("body").innerText().catch(() => "");
const forbiddenIn = (text) => FORBIDDEN_TEXT.filter((word) => text.includes(word));
const shot = (page, name) => page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: false }).catch(() => {});

const browser = await chromium.launch({ channel: "chrome", headless: true });
const openSession = async (width = 1440, height = 950) => {
  const mobile = width <= 430;
  const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(30000);
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push("หน้าเว็บพัง: " + e.message));
  page.on("response", (r) => { if (r.status() >= 500) page.errors.push(`${r.status()} ${r.url()}`); });
  return { context, page };
};
const uiLogin = async (page, username, password) => {
  await page.goto(FE + "/", { waitUntil: "domcontentloaded" });
  await page.fill("input[autocomplete=username]", username);
  await page.fill("input[autocomplete=current-password]", password);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2500);
};
// กดปุ่มแบบรอได้ — ไม่สำเร็จ = false (ผู้เรียกตัดสินใจเองว่า FAIL หรือใช้ API แทน)
async function tryClick(locator, waitMs = 5000) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const count = await locator.count().catch(() => 0);
    if (count > 0) {
      const target = locator.first();
      if ((await target.isVisible().catch(() => false)) && (await target.isEnabled().catch(() => false))) {
        try { await target.click({ timeout: 2000 }); return true; } catch { /* ลองใหม่ */ }
      }
    }
    await sleep(250);
  }
  return false;
}
// ปิดแจ้งเตือนที่เด้งมุมขวาบนก่อนกด (บังปุ่มได้)
async function dismissToasts(page) {
  const buttons = page.locator("[aria-live=polite] button");
  const count = await buttons.count().catch(() => 0);
  for (let i = count - 1; i >= 0; i--) await buttons.nth(i).click({ timeout: 800 }).catch(() => {});
}

const main = async () => {
  const officer = await loginClient("456", "456");
  const executive = await loginClient("789", "789");
  const reviewer = await loginClient("321", "321");

  const subjects = (await call(officer, "GET", "/subjects")).data;
  const rooms = (await call(officer, "GET", "/rooms")).data;
  check("มีรายวิชา 8 วิชา", subjects.length, 8);
  const subjectIds = subjects.map((s) => s.subject_id);
  const answersOf = (passMap) => subjectIds.map((id, i) => ({ subject_id: id, is_passed: passMap[i] }));
  const ALL_PASS = [true, true, true, true, true, true, true, true];
  const FAIL_FIRST_TWO = [false, false, true, true, true, true, true, true];

  const students = {}; // S01 → { id, client }
  const sendPaper = async (who, passMap) => call(students[who].client, "POST", "/exam-results", { subject_results: passMap });
  const paperOf = async (who, roundId) => {
    const list = (await call(officer, "GET", `/exam-results?student_id=${ID[who]}&round_id=${roundId}`)).data || [];
    return list[0];
  };
  const reviewApi = (action, resultId, body = {}) => call(officer, "PATCH", `/exam-results/${resultId}/${action}`, body);
  const statsOf = async (roundId, client = officer) => (await call(client, "GET", `/dashboard/stats?round_id=${roundId}`)).data;
  const yearSummary = async (client = officer) => ((await call(client, "GET", "/dashboard/history?years=20")).data.years || []).find((y) => y.academic_year === YEAR);

  // รอบเดียวที่เปิดได้ทีละรอบ — ปิดรอบที่ seed/เทสอื่นเปิดค้างไว้
  for (const r of ((await call(officer, "GET", "/rounds")).data || []).filter((x) => x.status === "open")) {
    await call(officer, "PUT", `/rounds/${r.round_id}`, { status: "closed" });
  }

  // ════════ L-01: นำเข้า + กรอกโปรไฟล์ ════════
  await section("L-01 นำเข้านักศึกษา 10 คน — 9 คนเข้าระบบกรอกโปรไฟล์ S13 ไม่เข้า S10 ถูกถอนสิทธิ์", async () => {
    for (const [who, seq] of Object.entries(WHO)) {
      const made = await call(officer, "POST", "/students", { student_id: ID[who], national_id: nidOf(seq) });
      if (made.status !== 201) fail(`นำเข้า ${who} ไม่สำเร็จ (${made.status})`);
    }
    for (const [who, seq] of Object.entries(WHO)) {
      if (who === "S13") continue;
      const client = makeClient();
      const l = await call(client, "POST", "/auth/login", { psu_passport_id: ID[who], password: nidOf(seq) });
      const p = await call(client, "POST", "/students/complete-profile", {
        first_name: `ทดสอบ${who}`, last_name: "วงจรสามรอบ", first_name_en: `Test${who}`, last_name_en: "Lifecycle",
        email: `${ID[who]}@test.local`, phone: "0812345678", room_id: rooms[0].room_id,
      });
      if (l.status !== 200 || p.status !== 201) fail(`${who} login/กรอกโปรไฟล์ไม่สำเร็จ (${l.status}/${p.status})`);
      // หลังกรอกโปรไฟล์ token เดิมยังใช้ได้ (ระบบอ่านสถานะจาก DB)
      students[who] = { id: ID[who], client };
    }
    const off = await call(officer, "PATCH", "/students/bulk-eligible", { student_ids: [ID.S10], exam_eligible: false });
    check("ถอนสิทธิ์ S10 -> 200", off.status, 200);
    const pending = (await call(officer, "GET", "/students/pending-accounts")).data || [];
    check("บัญชีรอเปิดใช้ของรุ่นนี้ = S13 คนเดียว", pending.filter((p) => p.academic_year === YEAR).map((p) => p.student_id), [ID.S13]);
  });

  // ════════ L-02: สร้างรอบ 1 เปิดรอบ ════════
  let round1;
  await section("L-02 สร้างรอบ 1 + ประกาศ → เปิดรอบ → ตัวเลขเริ่มต้น + แจ้งเตือนรอบเปิด", async () => {
    const created = await call(officer, "POST", "/rounds", { academic_year: YEAR, attempt_number: 1, ...NOW, subject_ids: subjectIds });
    check("สร้างรอบ 1 -> 200", created.status, 200);
    round1 = created.data.round_id;
    const news = await call(officer, "POST", "/news", { title: "เปิดรับผลสอบรอบที่ 1", content: "กรุณากรอกผลสอบพร้อมแนบไฟล์", round_id: round1 });
    check("โพสต์ประกาศผูกรอบ 1 -> 201", news.status, 201);
    check("เปิดรอบ 1 -> 200", (await call(officer, "PUT", `/rounds/${round1}`, { status: "open" })).status, 200);
    const s = await statsOf(round1);
    check("รอบ 1: total = 10 (รวม S13 ที่ยังไม่เข้าระบบ)", s.total, 10);
    check("รอบ 1: eligible = 8 (S10 ถูกถอนสิทธิ์)", s.eligible, 8);
    check("รอบ 1: canSubmit = 8", s.canSubmit, 8);
    check("รอบ 1: ยังไม่มีใครส่ง not_started = 10", s.not_started, 10);
    const notifS01 = (await call(students.S01.client, "GET", "/notifications/me")).data || [];
    check("S01 ได้แจ้งเตือนรอบเปิด 1 ครั้ง", notifS01.filter((n) => n.type === "round_open").length, 1);
    const notifS01Again = (await call(students.S01.client, "GET", "/notifications/me")).data || [];
    check("เปิดดูซ้ำ แจ้งเตือนไม่เพิ่ม", notifS01Again.filter((n) => n.type === "round_open").length, 1);
    const notifS10 = (await call(students.S10.client, "GET", "/notifications/me")).data || [];
    check("S10 (ถูกถอนสิทธิ์) ไม่ได้แจ้งเตือนรอบเปิด", notifS10.filter((n) => n.type === "round_open").length, 0);
    const s10Active = await call(students.S10.client, "GET", "/rounds/active");
    check("S10 เปิดฟอร์มกรอกผลไม่ได้ -> 403", s10Active.status, 403);
  });

  // ════════ L-03: ส่งผลรอบ 1 ════════
  await section("L-03 ส่งผลรอบ 1: S01–S07 ส่งพร้อมไฟล์ (S09 ไม่ส่ง S10 ส่งไม่ได้)", async () => {
    const plan = { S01: ALL_PASS, S02: FAIL_FIRST_TWO, S03: FAIL_FIRST_TWO, S04: FAIL_FIRST_TWO, S05: ALL_PASS, S06: ALL_PASS, S07: ALL_PASS };
    for (const [who, passMap] of Object.entries(plan)) {
      const res = await sendPaper(who, answersOf(passMap));
      if (res.status !== 200) { fail(`${who} ส่งผลรอบ 1 ไม่สำเร็จ (${res.status}: ${res.json.message})`); continue; }
      const up = await attachPdf(students[who].client, res.data.result_id);
      if (up !== 200) fail(`${who} แนบไฟล์ไม่สำเร็จ (${up})`);
    }
    const noPaper = await sendPaper("S10", answersOf(ALL_PASS));
    check("S10 ส่งผลตรงๆ ผ่าน API -> 403", noPaper.status, 403);
    const s = await statsOf(round1);
    check("รอบ 1: ส่งแล้ว 7 คน", s.submitted, 7);
    check("รอบ 1: ทุกใบรอตรวจ (by.submitted = 7)", s.by.submitted, 7);
    check("รอบ 1: ยืนยันแล้ว 0 → ผ่านครบยัง 0 (ใบรอตรวจไม่นับ)", [s.confirmed, s.fullyPassed], [0, 0]);
  });

  // ════════ L-04: ตรวจรอบ 1 ผ่านหน้าเว็บ ════════
  const officerSession = await openSession();
  await section("L-04 เจ้าหน้าที่ตรวจผ่านหน้าเว็บ: ยืนยัน S01 ผ่านหน้าจอ, ตีกลับ S05 ผ่านหน้าจอ, ที่เหลือยืนยันผ่าน API", async () => {
    const page = officerSession.page;
    await uiLogin(page, "456", "456");
    page.errors.length = 0;
    await page.goto(FE + "/review", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2200);
    await shot(page, "01-review-queue-round1");
    check("คิวตรวจเปิดได้ ไม่มี error ไม่มีค่าหลุด", [page.errors.length, forbiddenIn(await bodyText(page))], [0, []]);

    // ยืนยัน S01 ผ่านหน้าจอ
    let approvedByUi = false;
    if (await tryClick(page.locator(`text=${ID.S01}`))) {
      await page.waitForTimeout(1800);
      await dismissToasts(page);
      if (await tryClick(page.getByRole("button", { name: "ยืนยันผลสอบ" }))) {
        await page.waitForTimeout(1500);
        approvedByUi = (await paperOf("S01", round1)).staff_status === "approved";
      }
    }
    if (!check("ยืนยัน S01 ผ่านหน้าจอสำเร็จ", approvedByUi, true)) {
      await reviewApi("approve", (await paperOf("S01", round1)).result_id);
      note("ยืนยัน S01 ผ่าน API แทน");
    }

    // ตีกลับ S05 ผ่านหน้าจอ
    await page.goto(FE + "/review", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1800);
    let rejectedByUi = false;
    if (await tryClick(page.locator(`text=${ID.S05}`))) {
      await page.waitForTimeout(1800);
      await dismissToasts(page);
      if (await tryClick(page.getByRole("button", { name: /ตีกลับเพื่อแก้ไข/ }))) {
        await page.waitForTimeout(400);
        await page.locator(".modal-card textarea").first().fill("ตัวเลขในใบคะแนนอ่านไม่ชัด กรุณาถ่ายใหม่").catch(() => {});
        await tryClick(page.locator(".modal-card button", { hasText: "ยืนยันการตีกลับ" }));
        await page.waitForTimeout(1500);
        rejectedByUi = (await paperOf("S05", round1)).staff_status === "rejected";
      }
    }
    if (!check("ตีกลับ S05 ผ่านหน้าจอสำเร็จ", rejectedByUi, true)) {
      await reviewApi("reject", (await paperOf("S05", round1)).result_id, { remark: "ตัวเลขในใบคะแนนอ่านไม่ชัด กรุณาถ่ายใหม่" });
      note("ตีกลับ S05 ผ่าน API แทน");
    }

    // ที่เหลือ: ยืนยัน S02–S04 (S06/S07 ค้างรอตรวจไว้ตามเรื่องราว)
    for (const who of ["S02", "S03", "S04"]) {
      check(`ยืนยัน ${who} -> 200`, (await reviewApi("approve", (await paperOf(who, round1)).result_id)).status, 200);
    }
    // ตีกลับซ้ำใบที่ยืนยันแล้ว / ยืนยันซ้ำ ต้อง 409
    const s01 = await paperOf("S01", round1);
    check("ยืนยันซ้ำ S01 -> 409", (await reviewApi("approve", s01.result_id)).status, 409);

    // S05 เห็นเหตุผลที่ถูกตีกลับ → แก้ส่งใหม่ (ระหว่างรอบเปิด) → ยืนยัน
    const s05Notif = (await call(students.S05.client, "GET", "/notifications/me")).data || [];
    check("S05 ได้แจ้งเตือนตีกลับพร้อมเหตุผล", s05Notif.some((n) => n.type === "rejected" && /อ่านไม่ชัด/.test(n.message)), true);
    const fix = await sendPaper("S05", answersOf(ALL_PASS));
    check("S05 แก้ส่งใหม่ระหว่างรอบเปิด -> 200 (ใบเดิม ไม่เกิดใบใหม่)", [fix.status, fix.data.result_id === (await paperOf("S05", round1)).result_id], [200, true]);
    check("ใบ S05 กลับเป็นรอตรวจ", (await paperOf("S05", round1)).staff_status, "pending");
    check("ยืนยัน S05 หลังแก้ -> 200", (await reviewApi("approve", fix.data.result_id)).status, 200);
    await page.goto(FE + "/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await shot(page, "02-dashboard-round1-open");
    check("แดชบอร์ดรอบ 1 ที่ยังเปิด: ไม่มี error ไม่มีค่าหลุด", [page.errors.length, forbiddenIn(await bodyText(page))], [0, []]);
  });

  // ════════ L-05: ปิดรอบ 1 + ตีกลับหลังปิด ════════
  await section("L-05 ปิดรอบ 1 → ตีกลับ S06 หลังปิด → S06 แก้ส่งใหม่ได้ (เฉพาะใบนั้น) → ยืนยัน", async () => {
    check("ปิดรอบ 1 -> 200", (await call(officer, "PUT", `/rounds/${round1}`, { status: "closed" })).status, 200);
    const s06 = await paperOf("S06", round1);
    check("ตีกลับ S06 หลังปิดรอบ -> 200", (await reviewApi("reject", s06.result_id, { remark: "หลักฐานไม่ครบ กรุณาแนบใหม่" })).status, 200);
    const active = await call(students.S06.client, "GET", "/rounds/active");
    check("S06: รอบปิดแล้วแต่แก้ใบที่ถูกตีกลับได้ (can_fix_rejected = true)", [active.status, active.data?.round_id === round1, active.data?.can_fix_rejected], [200, true, true]);
    const s01Active = await call(students.S01.client, "GET", "/rounds/active");
    check("S01 (ไม่ถูกตีกลับ): ไม่มีรอบให้กรอก (data = null)", [s01Active.status, s01Active.data], [200, null]);
    const fix = await sendPaper("S06", answersOf(ALL_PASS));
    check("S06 แก้ส่งใหม่หลังปิดรอบ -> 200", fix.status, 200);
    check("ยืนยัน S06 หลังแก้ -> 200", (await reviewApi("approve", fix.data.result_id)).status, 200);
    const s01Send = await sendPaper("S01", answersOf(ALL_PASS));
    check("S01 ส่งทับใบที่ยืนยันแล้ว/รอบปิด -> 400 หรือ 409", [400, 409].includes(s01Send.status), true);

    const s = await statsOf(round1);
    check("รอบ 1 หลังตรวจ: ส่ง 7 / ยืนยัน 6 / รอตรวจ 1 (S07)", [s.submitted, s.confirmed, s.by.submitted, s.by.approved], [7, 6, 1, 6]);
    check("รอบ 1: ผ่านครบรอบนี้ = 3 (S01, S05, S06)", s.fullyPassed, 3);
    check("รอบ 1: ยังไม่เริ่ม (ทั้งรุ่น) = 3 (S09, S10, S13)", s.not_started, 3);
    const sum = await yearSummary();
    check("ปี 2596 หลังรอบ 1: ผ่านครั้งแรก 3 จาก 10 (30%)", [sum.firstAttempt.passed, sum.firstAttempt.rate], [3, 30]);
  });

  // ════════ L-06: รอบ 2 ════════
  let round2;
  await section("L-06 สร้าง/เปิดรอบ 2 → ใบรอบ 1 ของ S07 ที่ค้างรอตรวจนับเป็นผ่าน → ตีกลับหลังรอบ 2 เริ่ม → ต้องกรอกครบ 8 วิชา", async () => {
    const created = await call(officer, "POST", "/rounds", { academic_year: YEAR, attempt_number: 2, ...NOW, subject_ids: subjectIds });
    round2 = created.data.round_id;
    await call(officer, "POST", "/news", { title: "เปิดรับผลสอบรอบที่ 2", content: "เฉพาะผู้ที่ยังสอบไม่ผ่านครบ", round_id: round2 });
    check("เปิดรอบ 2 -> 200", (await call(officer, "PUT", `/rounds/${round2}`, { status: "open" })).status, 200);
    const before = await statsOf(round2);
    check("รอบ 2 (S07 ยังรอตรวจ นับเป็นผ่านไปก่อน): ผ่านครบมาก่อน = 4", before.alreadyPassed, 4);
    check("  กรอกได้ 4", before.canSubmit, 4);

    const s07r1 = await paperOf("S07", round1);
    check("ตีกลับใบรอบ 1 ของ S07 หลังรอบ 2 เริ่ม -> 200", (await reviewApi("reject", s07r1.result_id, { remark: "ไฟล์ไม่ตรงกับผลที่กรอก" })).status, 200);
    const after = await statsOf(round2);
    check("รอบ 2 หลังตีกลับ: ผ่านครบมาก่อน = 3, กรอกได้ 5", [after.alreadyPassed, after.canSubmit], [3, 5]);
    check("  รายชื่อที่ไม่ต้องกรอกคือ S01, S05, S06", [...after.alreadyPassedStudentIds].sort(), [ID.S01, ID.S05, ID.S06].sort());

    const active = await call(students.S07.client, "GET", "/rounds/active");
    check("S07: ฟอร์มเป็นของรอบ 2 และแก้ใบรอบ 1 ไม่ได้ (can_fix_rejected = false)", [active.data?.round_id === round2, active.data?.can_fix_rejected], [true, false]);
    check("S07: ทุกวิชาต้องกรอกใหม่ (ไม่มีวิชาที่ล็อกว่าผ่านแล้ว)", (active.data?.subjects || []).filter((s) => s.already_passed).length, 0);
    const tooFew = await call(students.S07.client, "POST", "/exam-results", { subject_results: answersOf(ALL_PASS).slice(0, 2) });
    check("S07 ส่งไม่ครบ 8 วิชา -> 400", tooFew.status, 400);
    const s02Active = await call(students.S02.client, "GET", "/rounds/active");
    check("S02: เหลือกรอก 2 วิชา อีก 6 วิชาล็อกว่าผ่านแล้ว", (s02Active.data?.subjects || []).filter((s) => s.already_passed).length, 6);
  });

  await section("L-07 ส่ง + ตรวจรอบ 2 (S02 ผ่านทั้งคู่, S03 ผ่าน 1 ตก 1, S04 ตกทั้งคู่, S07 ผ่านครบ 8)", async () => {
    const plan = {
      S02: [true, true], S03: [true, false], S04: [false, false],
    };
    for (const [who, firstTwo] of Object.entries(plan)) {
      const answers = [{ subject_id: subjectIds[0], is_passed: firstTwo[0] }, { subject_id: subjectIds[1], is_passed: firstTwo[1] }];
      const res = await sendPaper(who, answers);
      if (res.status !== 200) { fail(`${who} ส่งรอบ 2 ไม่สำเร็จ (${res.status}: ${res.json.message})`); continue; }
      await attachPdf(students[who].client, res.data.result_id);
    }
    const s07 = await sendPaper("S07", answersOf(ALL_PASS));
    check("S07 ส่งครบ 8 วิชา -> 200", s07.status, 200);
    await attachPdf(students.S07.client, s07.data.result_id);
    for (const who of ["S02", "S03", "S04", "S07"]) {
      check(`ยืนยัน ${who} รอบ 2 -> 200`, (await reviewApi("approve", (await paperOf(who, round2)).result_id)).status, 200);
    }
    const s = await statsOf(round2);
    check("รอบ 2: ส่ง 4 ยืนยัน 4", [s.submitted, s.confirmed], [4, 4]);
    check("รอบ 2: ผ่านครบรอบนี้ = 2 (S02, S07)", s.fullyPassed, 2);
    check("รอบ 2: ฐานคนของรอบ = 5, ยังไม่เริ่ม 1 (S09)", [s.roundTotal, s.roundNotStarted], [5, 1]);
    // วิชาที่ S02 ยกผลมา ไม่นับเป็นผู้เข้าสอบจริง
    const s02Paper = await paperOf("S02", round2);
    check("ใบรอบ 2 ของ S02 มีผลครบ 8 วิชา แบ่งเป็นสอบจริง 2 ยกมา 6", [s02Paper.subject_results.length, s02Paper.subject_results.filter((r) => r.carried_forward).length], [8, 6]);
    const officerPage = officerSession.page;
    officerPage.errors.length = 0;
    await officerPage.goto(FE + "/dashboard", { waitUntil: "domcontentloaded" });
    await officerPage.waitForTimeout(2500);
    await shot(officerPage, "03-dashboard-round2-open");
    check("แดชบอร์ดรอบ 2: ไม่มี error ไม่มีค่าหลุด", [officerPage.errors.length, forbiddenIn(await bodyText(officerPage))], [0, []]);
  });

  // ════════ L-08: รอบ 3 ════════
  let round3;
  await section("L-08 ปิดรอบ 2 → รอบ 3: S03 ผ่านวิชาที่เหลือ, S04 ตกต่อ, S09 ยังไม่ส่ง", async () => {
    check("ปิดรอบ 2 -> 200", (await call(officer, "PUT", `/rounds/${round2}`, { status: "closed" })).status, 200);
    const created = await call(officer, "POST", "/rounds", { academic_year: YEAR, attempt_number: 3, ...NOW, subject_ids: subjectIds });
    round3 = created.data.round_id;
    check("เปิดรอบ 3 -> 200", (await call(officer, "PUT", `/rounds/${round3}`, { status: "open" })).status, 200);
    const before = await statsOf(round3);
    check("รอบ 3: ผ่านครบมาก่อน = 5, กรอกได้ 3 (S03, S04, S09)", [before.alreadyPassed, before.canSubmit], [5, 3]);
    const s03Active = await call(students.S03.client, "GET", "/rounds/active");
    const s03Open = (s03Active.data?.subjects || []).filter((s) => !s.already_passed).map((s) => s.subject_id);
    check("S03: เหลือกรอกวิชาเดียว (วิชาที่ตกในรอบ 2)", s03Open, [subjectIds[1]]);
    const s04Active = await call(students.S04.client, "GET", "/rounds/active");
    check("S04: เหลือกรอก 2 วิชา", (s04Active.data?.subjects || []).filter((s) => !s.already_passed).length, 2);
    const s01Active = await call(students.S01.client, "GET", "/rounds/active");
    check("S01 (ผ่านครบแล้ว): ฟอร์มรอบ 3 บอกผ่านครบ (all_passed)", s01Active.data?.all_passed, true);
    const s01Send = await sendPaper("S01", answersOf(ALL_PASS));
    check("S01 ส่งผลรอบ 3 ผ่าน API -> 400 (ผ่านครบแล้ว ไม่ต้องกรอก)", s01Send.status, 400);

    const s03 = await sendPaper("S03", [{ subject_id: subjectIds[1], is_passed: true }]);
    const s04 = await sendPaper("S04", [{ subject_id: subjectIds[0], is_passed: false }, { subject_id: subjectIds[1], is_passed: false }]);
    check("S03 และ S04 ส่งรอบ 3 -> 200", [s03.status, s04.status], [200, 200]);
    await attachPdf(students.S03.client, s03.data.result_id);
    await attachPdf(students.S04.client, s04.data.result_id);
    check("ยืนยัน S03, S04 รอบ 3 -> 200", [(await reviewApi("approve", s03.data.result_id)).status, (await reviewApi("approve", s04.data.result_id)).status], [200, 200]);
    const s = await statsOf(round3);
    check("รอบ 3: ส่ง 2 ยืนยัน 2 ผ่านครบรอบนี้ 1 (S03)", [s.submitted, s.confirmed, s.fullyPassed], [2, 2, 1]);
    check("รอบ 3: ฐานคนของรอบ = 3, ยังไม่เริ่ม 1 (S09)", [s.roundTotal, s.roundNotStarted], [3, 1]);
    check("ปิดรอบ 3 -> 200", (await call(officer, "PUT", `/rounds/${round3}`, { status: "closed" })).status, 200);
  });

  // ════════ L-09: สรุปปี + ส่งออก ════════
  const idsInSheet = async (urlPath) => {
    const res = await download(officer, urlPath);
    if (res.status !== 200) return { status: res.status, ids: [] };
    const rows = await readSheet(res.buffer);
    const ids = [];
    for (const row of rows.slice(1)) {
      if (row[1]) ids.push(String(row[1]));
    }
    return { status: 200, ids: ids.sort() };
  };
  await section("L-09 สรุปปี 2596 + ไฟล์ส่งออกต้องตรงกับแดชบอร์ด", async () => {
    const sum = await yearSummary();
    check("ปี 2596: นักศึกษาทั้งรุ่น = 10", sum.total, 10);
    check("ปี 2596: ส่งผลอย่างน้อย 1 รอบ = 7 (70%)", [sum.submitted, sum.fillRate], [7, 70]);
    check("ปี 2596: ผ่านครั้งแรก = 3 (30%)", [sum.firstAttempt.passed, sum.firstAttempt.rate], [3, 30]);
    check("ปี 2596: ผ่านภายในปีแรก = 6 (60%)", [sum.firstYear.passed, sum.firstYear.rate], [6, 60]);
    check("ปี 2596: สถานะรายคน ยืนยันแล้ว 7 · ยังไม่เริ่ม 3 (รวมกันได้ 10)", [sum.statusByStudent.approved, sum.statusByStudent.not_started, Object.values(sum.statusByStudent).reduce((a, b) => a + b, 0)], [7, 3, 10]);
    check("ปี 2596: มี 3 รอบ", sum.rounds.length, 3);

    const firstYearPass = await idsInSheet(`/dashboard/export-first-year?year=${YEAR}&passed=true&format=xlsx`);
    const firstYearFail = await idsInSheet(`/dashboard/export-first-year?year=${YEAR}&passed=false&format=xlsx`);
    check("ส่งออก 'ผ่านภายในปีแรก' = S01,S02,S03,S05,S06,S07", firstYearPass.ids, [ID.S01, ID.S02, ID.S03, ID.S05, ID.S06, ID.S07].sort());
    check("ส่งออก 'ไม่ผ่านภายในปีแรก' = S04,S09,S10,S13 (รวมคนที่ไม่เคยเข้าระบบ)", firstYearFail.ids, [ID.S04, ID.S09, ID.S10, ID.S13].sort());
    check("จำนวนในไฟล์ 'ผ่าน' = ตัวเลขบนแดชบอร์ด", firstYearPass.ids.length, sum.firstYear.passed);
    const firstAttemptPass = await idsInSheet(`/dashboard/export-first-attempt?year=${YEAR}&passed=true&format=xlsx`);
    const firstAttemptFail = await idsInSheet(`/dashboard/export-first-attempt?year=${YEAR}&passed=false&format=xlsx`);
    check("ส่งออก 'ผ่านครั้งแรก' = S01,S05,S06", firstAttemptPass.ids, [ID.S01, ID.S05, ID.S06].sort());
    check("ส่งออก 'ไม่ผ่านครั้งแรก' = อีก 7 คน", firstAttemptFail.ids, [ID.S02, ID.S03, ID.S04, ID.S07, ID.S09, ID.S10, ID.S13].sort());
    for (const roundId of [round1, round2, round3]) {
      const pdf = await download(officer, `/dashboard/export?round_id=${roundId}`);
      check(`รายงาน PDF รอบ ${roundId} -> 200 ไฟล์ PDF จริง`, [pdf.status, pdf.buffer.subarray(0, 4).toString()], [200, "%PDF"]);
    }
    const studentsXlsx = await download(officer, `/students/export`).catch(() => null);
    note(`(ข้ามการลองส่งออกข้อมูลนักศึกษาซ้ำ — มีเทสใน phase22)${studentsXlsx ? "" : ""}`);
  });

  // ════════ L-10: ผู้บริหาร / ผู้ช่วยตรวจเห็นตัวเลขเท่ากัน ════════
  await section("L-10 ผู้บริหารเห็นตัวเลขเท่าเจ้าหน้าที่ทุกตัว แต่ไม่เห็นรายชื่อรายคน · ผู้ช่วยตรวจเข้าแดชบอร์ดไม่ได้", async () => {
    for (const [label, roundId] of [["รอบ 1", round1], ["รอบ 2", round2], ["รอบ 3", round3]]) {
      const o = await statsOf(roundId, officer);
      const e = await statsOf(roundId, executive);
      const { alreadyPassedStudentIds, ...oRest } = o;
      check(`${label}: ผู้บริหารเห็นสถิติเท่ากับเจ้าหน้าที่ (ไม่รวมรายชื่อรายคน)`, [JSON.stringify(e) === JSON.stringify(oRest), "alreadyPassedStudentIds" in e], [true, false]);
    }
    const eSum = await yearSummary(executive);
    const oSum = await yearSummary(officer);
    check("สรุปรายปีของผู้บริหารเท่ากับของเจ้าหน้าที่", JSON.stringify(eSum) === JSON.stringify(oSum), true);
    check("ผู้บริหารดูรายชื่อนักศึกษา -> 403", (await call(executive, "GET", "/students")).status, 403);
    check("ผู้บริหารดูใบผลสอบรายคน -> 403", (await call(executive, "GET", "/exam-results")).status, 403);
    check("ผู้ช่วยตรวจดูแดชบอร์ด -> 403", (await call(reviewer, "GET", `/dashboard/stats?round_id=${round1}`)).status, 403);
    const s07 = await paperOf("S07", round1);
    check("ผู้ช่วยตรวจเห็นประวัติการตรวจครบ (S07 รอบ 1: ตีกลับ 1 ครั้ง)", (s07.review_logs || []).map((l) => l.action), ["rejected"]);
  });

  // ════════ UI: ดูแดชบอร์ดผู้บริหารกับข้อมูลครบ 3 รอบ ════════
  await section("UI-DATA หน้าแดชบอร์ด/รายงาน/ข้อมูลนักศึกษา ของเจ้าหน้าที่และผู้บริหาร เมื่อมีข้อมูลครบ 3 รอบ", async () => {
    const page = officerSession.page;
    for (const [urlPath, label, shotName] of [
      ["/dashboard", "แดชบอร์ดเจ้าหน้าที่", "04-officer-dashboard-final"],
      ["/reports", "หน้ารายงานเจ้าหน้าที่", "05-officer-reports-final"],
      ["/students", "หน้าข้อมูลนักศึกษา", "06-officer-students-final"],
      ["/rounds", "หน้าจัดการรอบ", "07-officer-rounds-final"],
    ]) {
      page.errors.length = 0;
      await page.goto(FE + urlPath, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      await shot(page, shotName);
      check(`${label}: ไม่มี error ไม่มีค่าหลุด`, [page.errors.length, forbiddenIn(await bodyText(page))], [0, []]);
    }
    const exec = await openSession();
    await uiLogin(exec.page, "789", "789");
    for (const [urlPath, label, shotName] of [["/dashboard", "แดชบอร์ดผู้บริหาร", "08-exec-dashboard-final"], ["/reports", "รายงานผู้บริหาร", "09-exec-reports-final"]]) {
      exec.page.errors.length = 0;
      await exec.page.goto(FE + urlPath, { waitUntil: "domcontentloaded" });
      await exec.page.waitForTimeout(2500);
      await shot(exec.page, shotName);
      check(`${label}: ไม่มี error ไม่มีค่าหลุด`, [exec.page.errors.length, forbiddenIn(await bodyText(exec.page))], [0, []]);
    }
    await exec.context.close();
  });
  await officerSession.context.close();

  // ════════ UI-01: กวาดทุกหน้า × ทุกบทบาท × 5 ความกว้างจอ ════════
  const WIDTHS = [360, 390, 768, 1366, 1920];
  const sweep = async (label, username, password, paths) => {
    const session = await openSession(1366, 900);
    const page = session.page;
    await uiLogin(page, username, password);
    const problems = [];
    let visits = 0;
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width <= 430 ? 844 : 900 });
      for (const urlPath of paths) {
        page.errors.length = 0;
        await page.goto(FE + urlPath, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);
        visits++;
        const text = await bodyText(page);
        const overflow = await page.evaluate(() => {
          const limit = window.innerWidth + 1;
          if (document.documentElement.scrollWidth <= limit) return null;
          const all = document.querySelectorAll("body *");
          for (const el of all) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.right > limit) return `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`;
          }
          return "ไม่ทราบองค์ประกอบ";
        });
        const notFound = text.includes("ไม่พบหน้าที่ต้องการ");
        const bad = forbiddenIn(text);
        if (overflow || notFound || bad.length > 0 || page.errors.length > 0) {
          problems.push(`${urlPath}@${width}: ${[overflow ? `เลื่อนแนวนอน(${overflow})` : "", notFound ? "ไม่พบหน้า" : "", bad.join(","), page.errors[0] || ""].filter(Boolean).join(" ")}`);
        }
        if (width === 390 || width === 1366) await shot(page, `sweep-${label}-${urlPath.replace(/\//g, "_")}-${width}`);
      }
    }
    check(`${label}: ${paths.length} หน้า × ${WIDTHS.length} ขนาดจอ (${visits} ครั้ง) ไม่เลื่อนแนวนอน ไม่มี error ไม่มีค่าหลุด`, problems, []);
    await session.context.close();
  };
  await section("UI-01 กวาดหน้าจอ เจ้าหน้าที่", () => sweep("officer", "456", "456", ["/dashboard", "/review", "/students", "/import", "/rounds", "/users", "/news-manage", "/reports", "/manual"]));
  await section("UI-01 กวาดหน้าจอ ผู้ช่วยตรวจสอบ", () => sweep("reviewer", "321", "321", ["/review"]));
  await section("UI-01 กวาดหน้าจอ ผู้บริหาร", () => sweep("executive", "789", "789", ["/dashboard", "/reports"]));
  await section("UI-01 กวาดหน้าจอ นักศึกษา (S03 — ใบรอบ 3 ยืนยันแล้ว)", () => sweep("student", ID.S03, nidOf(WHO.S03), ["/news", "/exam", "/exam/form", "/status", "/history"]));

  // ════════ รายละเอียดนักศึกษา (เปิดผ่านการกดจากรายชื่อ) ════════
  await section("UI-DETAIL เปิดหน้ารายละเอียดนักศึกษา S04 (ตก 3 รอบ) ผ่านการกดจากรายชื่อ ทั้งจอคอมและมือถือ", async () => {
    for (const [width, label] of [[1366, "จอคอม"], [390, "มือถือ"]]) {
      const session = await openSession(width, width <= 430 ? 844 : 900);
      const page = session.page;
      await uiLogin(page, "456", "456");
      await page.goto(FE + "/students", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      const search = page.locator("input[type=search], input[placeholder*='ค้นหา']").first();
      if (await search.count()) await search.fill(ID.S04).catch(() => {});
      await page.waitForTimeout(800);
      page.errors.length = 0;
      const clicked = await tryClick(page.locator(`text=${ID.S04}`));
      await page.waitForTimeout(2200);
      const text = await bodyText(page);
      await shot(page, `10-detail-S04-${width}`);
      check(`หน้ารายละเอียด S04 (${label}): เปิดได้ เห็นผล 3 รอบ ไม่มี error`, [clicked, text.includes("รอบ"), page.errors.length, forbiddenIn(text)], [true, true, 0, []]);
      if (width <= 430) {
        check("  มือถือ: ไม่เลื่อนแนวนอน", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
      }
      await session.context.close();
    }
  });

  console.log("\nภาพหน้าจออยู่ที่: " + OUT_DIR);
  console.log("\nสรุปรายหัวข้อ (จำนวน FAIL):");
  for (const s of sectionSummary) console.log(`  ${s.fails === 0 ? "ผ่าน" : "ไม่ผ่าน"}  ${s.title}  (${s.fails})`);
  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
};

try {
  await main();
} catch (err) {
  failures++;
  console.error(err);
}
await browser.close();
process.exit(failures === 0 ? 0 : 1);
