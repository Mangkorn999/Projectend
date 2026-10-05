// เทสข้ามเบราว์เซอร์ + จอมือถือ (แผน docs/full-system-test-plan.md ข้อ 15: UI-01, UI-07, UI-09, B-13)
//
// รันผ่าน:  npm run test:e2e:browsers   (สร้างฐานข้อมูลชั่วคราว + เปิดเว็บให้เอง ไม่แตะข้อมูลจริง)
//
// 4 โปรไฟล์ (เบราว์เซอร์จริงที่ติดตั้งกับ Playwright):
//   1. Firefox คอม            2. Safari (WebKit) คอม
//   3. Safari บน iPhone 13    4. Chrome บน Pixel 7 (Android)
// แต่ละโปรไฟล์ทำเหมือนกัน:
//   - นักศึกษา (คนละคน): เข้าสู่ระบบ → เปิดทุกหน้า (ไม่เลื่อนแนวนอน ไม่มี error ไม่มีค่าหลุด) → กรอกผลสอบ + แนบรูปผ่านหน้าจอจนส่งสำเร็จ
//   - เจ้าหน้าที่: เปิดคิวตรวจ → เปิดใบนั้นเห็นไฟล์ → กดยืนยันผ่านหน้าจอ → สถานะเป็นยืนยันแล้ว
//   - ดาวน์โหลดไฟล์ Excel ผ่านฟังก์ชันดาวน์โหลดจริงของหน้าเว็บ (บัค B-13: บางเบราว์เซอร์ดาวน์โหลดไม่ขึ้น) ต้องได้ไฟล์ที่มีข้อมูล
//   - ผู้บริหาร + ผู้ช่วยตรวจสอบ: เปิดทุกหน้าของตน ไม่เลื่อนแนวนอน
import { chromium, firefox, webkit, devices } from "playwright-core";
import fs from "fs";
import os from "os";
import path from "path";

const FE = process.env.FE || "http://localhost:5175";
const API = process.env.API || "http://localhost:3200/api";
const OUT_DIR = process.env.OUT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "nurse-browsers-"));

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
  return ok;
};
const fail = (message) => { failures++; console.log(`FAIL  ${message}`); };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── API client ────────────────────────────────────────────────────────
async function call(client, method, urlPath, body) {
  const headers = {};
  if (client.cookie) headers.Cookie = client.cookie;
  let payload;
  if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const res = await fetch(API + urlPath, { method, headers, body: payload });
  const json = await res.json().catch(() => ({}));
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) client.cookie = setCookie.split(";")[0];
  return { status: res.status, data: json.data, json };
}
const loginClient = async (u, p) => {
  const client = { cookie: null };
  const res = await call(client, "POST", "/auth/login", { psu_passport_id: u, password: p });
  if (res.status !== 200) throw new Error(`login ${u} ไม่สำเร็จ (${res.status})`);
  return client;
};

const FORBIDDEN_TEXT = ["undefined", "NaN", "[object Object]", "Request failed", "exam_result", "certificate_type", "round_id", "student_id", "Prisma"];
const bodyText = (page) => page.locator("body").innerText().catch(() => "");
const forbiddenIn = (text) => FORBIDDEN_TEXT.filter((w) => text.includes(w));
const PNG_FILE = { name: "สแกนใบคะแนน.png", mimeType: "image/png", buffer: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]) };

// ── ข้อมูลเตรียมไว้ ───────────────────────────────────────────────────
const YEAR = 2596;
const STAMP = Date.now().toString().slice(-6);
const PREFIX = String(YEAR - 4).slice(-2);
const idOf = (seq) => `${PREFIX}${STAMP}${String(seq).padStart(2, "0")}`;
const nidOf = (seq) => `1${STAMP}0000${seq}`.slice(0, 13).padEnd(13, "0");

const PROFILES = [
  { key: "firefox", label: "Firefox (คอม)", launch: () => firefox.launch({ headless: true }), context: { viewport: { width: 1366, height: 850 } } },
  { key: "webkit", label: "Safari/WebKit (คอม)", launch: () => webkit.launch({ headless: true }), context: { viewport: { width: 1366, height: 850 } } },
  { key: "iphone", label: "Safari บน iPhone 13", launch: () => webkit.launch({ headless: true }), context: { ...devices["iPhone 13"] } },
  { key: "pixel", label: "Chrome บน Pixel 7 (Android)", launch: () => chromium.launch({ channel: "chrome", headless: true }), context: { ...devices["Pixel 7"] } },
];

async function openPage(browser, contextOptions) {
  const context = await browser.newContext({ ...contextOptions, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(30000);
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push("หน้าเว็บพัง: " + e.message));
  page.on("response", (r) => { if (r.status() >= 500) page.errors.push(`${r.status()} ${r.url()}`); });
  return { context, page };
}
async function uiLogin(page, username, password) {
  await page.goto(FE + "/", { waitUntil: "domcontentloaded" });
  await page.fill("input[autocomplete=username]", username);
  await page.fill("input[autocomplete=current-password]", password);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);
}
const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
async function tryClick(locator, waitMs = 6000) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if ((await locator.count().catch(() => 0)) > 0) {
      const t = locator.first();
      if ((await t.isVisible().catch(() => false)) && (await t.isEnabled().catch(() => false))) {
        try { await t.click({ timeout: 2500 }); return true; } catch { /* ลองใหม่ */ }
      }
    }
    await sleep(250);
  }
  return false;
}
// เปิดหลายหน้า แล้วตรวจ: ไม่เลื่อนแนวนอน / ไม่มี error / ไม่มีค่าหลุด / ไม่ขึ้น "ไม่พบหน้า"
async function sweepPages(page, label, paths) {
  const problems = [];
  for (const urlPath of paths) {
    page.errors.length = 0;
    await page.goto(FE + urlPath, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1800);
    const text = await bodyText(page);
    const overflow = !(await noHorizontalScroll(page));
    const bad = forbiddenIn(text);
    const notFound = text.includes("ไม่พบหน้าที่ต้องการ");
    if (overflow || bad.length > 0 || notFound || page.errors.length > 0) {
      problems.push(`${urlPath}: ${[overflow ? "เลื่อนแนวนอน" : "", notFound ? "ไม่พบหน้า" : "", bad.join(","), page.errors[0] || ""].filter(Boolean).join(" ")}`);
    }
  }
  check(`${label}: ${paths.length} หน้า ไม่เลื่อนแนวนอน ไม่มี error ไม่มีค่าหลุด`, problems, []);
}

const main = async () => {
  const officer = await loginClient("456", "456");
  const subjects = (await call(officer, "GET", "/subjects")).data;
  const rooms = (await call(officer, "GET", "/rooms")).data;
  const useSubjects = subjects.slice(0, 3).map((s) => s.subject_id);

  for (const r of ((await call(officer, "GET", "/rounds")).data || []).filter((x) => x.status === "open")) {
    await call(officer, "PUT", `/rounds/${r.round_id}`, { status: "closed" });
  }
  const created = await call(officer, "POST", "/rounds", { academic_year: YEAR, attempt_number: 1, open_date: "2020-01-01", close_date: "2099-12-31", subject_ids: useSubjects });
  const roundId = created.data.round_id;
  await call(officer, "PUT", `/rounds/${roundId}`, { status: "open" });
  await call(officer, "POST", "/news", { title: "เปิดรับผลสอบรอบที่ 1", content: "ทดสอบข้ามเบราว์เซอร์", round_id: roundId });

  // นักศึกษาคนละคนต่อโปรไฟล์ (กรอกโปรไฟล์ผ่าน API ให้เรียบร้อยแล้ว)
  const students = {};
  let seq = 0;
  for (const profile of PROFILES) {
    seq += 1;
    await call(officer, "POST", "/students", { student_id: idOf(seq), national_id: nidOf(seq) });
    const c = { cookie: null };
    await call(c, "POST", "/auth/login", { psu_passport_id: idOf(seq), password: nidOf(seq) });
    const p = await call(c, "POST", "/students/complete-profile", {
      first_name: `ทดสอบ${profile.key}`, last_name: "ข้ามเบราว์เซอร์", first_name_en: `Test${profile.key}`, last_name_en: "Browsers",
      email: `${idOf(seq)}@test.local`, phone: "0812345678", room_id: rooms[0].room_id,
    });
    if (p.status !== 201) fail(`สร้างนักศึกษาของ ${profile.label} ไม่สำเร็จ (${p.status})`);
    students[profile.key] = { id: idOf(seq), nid: nidOf(seq) };
  }

  for (const profile of PROFILES) {
    console.log(`\n══ ${profile.label} ══`);
    let browser;
    try {
      browser = await profile.launch();
    } catch (err) {
      fail(`${profile.label}: เปิดเบราว์เซอร์ไม่ได้ — ${String(err.message).split("\n")[0]}`);
      continue;
    }
    const stu = students[profile.key];
    try {
      // ── นักศึกษา ──
      const S = await openPage(browser, profile.context);
      await uiLogin(S.page, stu.id, stu.nid);
      await sweepPages(S.page, `${profile.key} นักศึกษา`, ["/news", "/exam", "/exam/form", "/status", "/history"]);
      await S.page.goto(FE + "/exam/form", { waitUntil: "domcontentloaded" });
      await S.page.waitForTimeout(2200);
      const passButtons = S.page.locator(".seg button:nth-child(1)");
      const buttonCount = await passButtons.count();
      check(`${profile.key} นักศึกษา: ฟอร์มมีให้กรอก 3 วิชา`, buttonCount, 3);
      for (let i = 0; i < buttonCount; i++) await tryClick(passButtons.nth(i));
      await S.page.locator("input[type=file]").first().setInputFiles([PNG_FILE]).catch((e) => fail(`${profile.key}: แนบรูปไม่ได้ — ${String(e.message).split("\n")[0]}`));
      await S.page.waitForTimeout(500);
      check(`${profile.key} นักศึกษา: หลังเลือกคำตอบ+แนบรูป ไม่เลื่อนแนวนอน`, await noHorizontalScroll(S.page), true);
      await S.page.screenshot({ path: path.join(OUT_DIR, `${profile.key}-form.png`) }).catch(() => {});
      const submitted = await tryClick(S.page.getByRole("button", { name: /ยืนยันและส่งผลสอบ/ }));
      await S.page.waitForTimeout(3000);
      const mine = (await call(officer, "GET", `/exam-results?student_id=${stu.id}`)).data || [];
      check(`${profile.key} นักศึกษา: กดส่งผ่านหน้าจอสำเร็จ ใบมี 1 ไฟล์ รอตรวจ`, [submitted, mine.length, mine[0]?.certificates?.length, mine[0]?.staff_status], [true, 1, 1, "pending"]);
      await S.page.goto(FE + "/status", { waitUntil: "domcontentloaded" });
      await S.page.waitForTimeout(1800);
      check(`${profile.key} นักศึกษา: หน้าสถานะแสดง "รอตรวจสอบ"`, (await bodyText(S.page)).includes("รอตรวจสอบ"), true);
      await S.page.screenshot({ path: path.join(OUT_DIR, `${profile.key}-status.png`) }).catch(() => {});
      await S.context.close();

      // ── เจ้าหน้าที่: ตรวจ + ยืนยัน + ดาวน์โหลด ──
      const O = await openPage(browser, profile.context);
      await uiLogin(O.page, "456", "456");
      await sweepPages(O.page, `${profile.key} เจ้าหน้าที่`, ["/dashboard", "/review", "/students", "/rounds", "/users", "/reports", "/manual"]);
      await O.page.goto(FE + "/review", { waitUntil: "domcontentloaded" });
      await O.page.waitForTimeout(2200);
      let approved = false;
      if (await tryClick(O.page.locator(`text=${stu.id}`))) {
        await O.page.waitForTimeout(2200);
        const sawFile = (await bodyText(O.page)).includes(PNG_FILE.name);
        await O.page.screenshot({ path: path.join(OUT_DIR, `${profile.key}-review-detail.png`) }).catch(() => {});
        check(`${profile.key} เจ้าหน้าที่: เปิดใบแล้วเห็นชื่อไฟล์ที่แนบ`, sawFile, true);
        if (await tryClick(O.page.getByRole("button", { name: "ยืนยันผลสอบ" }))) {
          await O.page.waitForTimeout(2000);
          approved = ((await call(officer, "GET", `/exam-results?student_id=${stu.id}`)).data?.[0]?.staff_status) === "approved";
        }
      }
      check(`${profile.key} เจ้าหน้าที่: กดยืนยันผ่านหน้าจอสำเร็จ`, approved, true);

      // ดาวน์โหลดผ่านฟังก์ชันจริงของหน้าเว็บ (B-13)
      await O.page.goto(FE + "/reports", { waitUntil: "domcontentloaded" });
      await O.page.waitForTimeout(1500);
      const downloadPromise = O.page.waitForEvent("download", { timeout: 15000 }).catch(() => null);
      await O.page.evaluate(async (year) => {
        const api = await import("/src/design/api.js");
        await api.downloadFile(`/dashboard/export-first-attempt?year=${year}&passed=false&format=xlsx`, { filename: "ทดสอบดาวน์โหลด.xlsx" });
      }, YEAR).catch(() => {});
      const download = await downloadPromise;
      let size = 0;
      let name = null;
      if (download) {
        name = download.suggestedFilename();
        const savedPath = path.join(OUT_DIR, `${profile.key}-${Date.now()}.xlsx`);
        await download.saveAs(savedPath).catch(() => {});
        size = fs.existsSync(savedPath) ? fs.statSync(savedPath).size : 0;
      }
      check(`${profile.key} เจ้าหน้าที่: ดาวน์โหลด Excel ขึ้นจริง ชื่อไทยถูก ไฟล์มีข้อมูล (B-13)`, [Boolean(download), name, size > 1000], [true, "ทดสอบดาวน์โหลด.xlsx", true]);
      await O.context.close();

      // ── ผู้บริหาร / ผู้ช่วยตรวจสอบ ──
      const E = await openPage(browser, profile.context);
      await uiLogin(E.page, "789", "789");
      await sweepPages(E.page, `${profile.key} ผู้บริหาร`, ["/dashboard", "/reports"]);
      await E.context.close();
      const R = await openPage(browser, profile.context);
      await uiLogin(R.page, "321", "321");
      await sweepPages(R.page, `${profile.key} ผู้ช่วยตรวจสอบ`, ["/review"]);
      await R.context.close();
    } catch (err) {
      fail(`${profile.label}: หยุดกลางคัน — ${String(err.message).split("\n")[0]}`);
    }
    await browser.close();
  }

  console.log("\nภาพหน้าจออยู่ที่: " + OUT_DIR);
  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
};

try {
  await main();
} catch (err) {
  failures++;
  console.error(err);
}
process.exit(failures === 0 ? 0 : 1);
