// เทสบนอุปกรณ์มือถือ/แท็บเล็ตหลายรุ่น (จำลองจอ + ระบบสัมผัส + เอนจินจริง: Safari/WebKit สำหรับ Apple, Chrome สำหรับ Android)
// แผน docs/full-system-test-plan.md ข้อ 15 (UI-01, UI-07, UI-08)
//
// รันผ่าน:  npm run test:e2e:devices   (ฐานข้อมูลชั่วคราว + ข้อมูลจำลอง ไม่แตะข้อมูลจริง)
// 12 อุปกรณ์: iPhone SE (จอเล็กสุด 320px), iPhone 13 (แนวตั้ง/แนวนอน), iPhone 15 Pro Max, iPad Mini (แนวตั้ง/นอน),
//             iPad Pro 11 (แนวตั้ง/นอน), Galaxy S9+, Pixel 7 (แนวนอน), Galaxy Tab S4 (แนวตั้ง)
// ทุกอุปกรณ์:
//   - นักศึกษา: เปิดทุกหน้า → "แตะ" กรอกผล + แนบรูป + ส่ง (ต้องส่งสำเร็จ ใบมี 1 ไฟล์)
//   - เจ้าหน้าที่: เปิดทุกหน้า → "แตะ" ยืนยันใบนั้น (สถานะต้องเป็นยืนยันแล้ว)
//   - ผู้บริหาร / ผู้ช่วยตรวจ: เปิดทุกหน้าของตน
//   - ทุกหน้า: ไม่เลื่อนแนวนอน ไม่มี error ไม่มีค่าหลุด
//   - ข้อสังเกต (INFO ไม่นับเป็น FAIL): ปุ่ม/ช่องที่เล็กกว่า 32px บนฟอร์มกรอกผล, ตัวอักษรเล็กกว่า 12px
// ข้อจำกัด: ไม่ใช่เครื่องจริง (กล้อง, แป้นพิมพ์จริง, รูป HEIC จากกล้อง iPhone ลองไม่ได้)
import { chromium, webkit, devices } from "playwright-core";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import os from "os";
import path from "path";
import { applySession, apiClient, findAccount } from "./forgeSession.mjs";

const FE = process.env.FE || "http://localhost:5175";
const API = process.env.API || "http://localhost:3200/api";
const OUT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "nurse-devices-"));
const prisma = new PrismaClient();

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual).slice(0, 300)} (want ${JSON.stringify(expected).slice(0, 100)})`);
  return ok;
};
const fail = (message) => { failures++; console.log(`FAIL  ${message}`); };
const info = (name, value) => console.log(`INFO  ${name}  -> ${value}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FORBIDDEN_TEXT = ["undefined", "NaN", "[object Object]", "Request failed", "exam_result", "certificate_type", "round_id", "student_id", "Prisma"];
const forbiddenIn = (text) => FORBIDDEN_TEXT.filter((w) => text.includes(w));
const PNG_FILE = { name: "ถ่ายรูปใบคะแนน.png", mimeType: "image/png", buffer: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]) };

const DEVICES = [
  "iPhone SE", "iPhone 13", "iPhone 13 landscape", "iPhone 15 Pro Max",
  "iPad Mini", "iPad Mini landscape", "iPad Pro 11", "iPad Pro 11 landscape",
  "Galaxy S9+", "Pixel 7", "Pixel 7 landscape", "Galaxy Tab S4",
];

// แตะ (touch) — ถ้าแตะไม่ได้ใน 6 วินาทีคืน false
async function tryTap(page, locator, waitMs = 6000) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if ((await locator.count().catch(() => 0)) > 0) {
      const target = locator.first();
      if ((await target.isVisible().catch(() => false)) && (await target.isEnabled().catch(() => false))) {
        try { await target.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {}); await target.tap({ timeout: 2500 }); return true; } catch { /* ลองใหม่ */ }
      }
    }
    await sleep(250);
  }
  return false;
}

async function sweep(page, label, paths) {
  const problems = [];
  for (const urlPath of paths) {
    page.errors.length = 0;
    await page.goto(FE + urlPath, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1700);
    const text = await page.locator("body").innerText().catch(() => "");
    const overflow = await page.evaluate(() => {
      const limit = window.innerWidth + 1;
      if (document.documentElement.scrollWidth <= limit) return null;
      for (const el of document.querySelectorAll("body *")) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.right > limit) return `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`;
      }
      return "ไม่ทราบองค์ประกอบ";
    });
    const bad = forbiddenIn(text);
    const notFound = text.includes("ไม่พบหน้าที่ต้องการ");
    if (overflow || bad.length || notFound || page.errors.length) {
      problems.push(`${urlPath}: ${[overflow ? `เลื่อนแนวนอน(${overflow})` : "", notFound ? "ไม่พบหน้า" : "", bad.join(","), page.errors[0] || ""].filter(Boolean).join(" ")}`);
    }
  }
  check(`${label}: ${paths.length} หน้า ไม่เลื่อนแนวนอน ไม่มี error ไม่มีค่าหลุด`, problems, []);
}

async function openContext(browser, device, account) {
  const context = await browser.newContext({ ...devices[device], acceptDownloads: true });
  await applySession(context, API, account);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(30000);
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push("หน้าเว็บพัง: " + e.message));
  page.on("response", (r) => { if (r.status() >= 500) page.errors.push(`${r.status()} ${r.url()}`); });
  return { context, page };
}

const main = async () => {
  const officerAcc = await findAccount(prisma, { psu_passport_id: "456" });
  const execAcc = await findAccount(prisma, { psu_passport_id: "789" });
  const reviewerAcc = await findAccount(prisma, { psu_passport_id: "321" });
  const officer = apiClient(API, officerAcc);

  // รอบเปิดรับของรุ่นทดสอบ 2599 + นักศึกษาคนละคนต่ออุปกรณ์ (กรอกโปรไฟล์แล้ว)
  const YEAR = 2599;
  const PREFIX = String(YEAR - 4).slice(-2);
  const rooms = (await officer("GET", "/rooms")).data;
  const subjects = (await officer("GET", "/subjects")).data.slice(0, 3);
  for (const r of ((await officer("GET", "/rounds")).data || []).filter((x) => x.status === "open")) await officer("PUT", `/rounds/${r.round_id}`, { status: "closed" });
  const created = await officer("POST", "/rounds", { academic_year: YEAR, attempt_number: 1, open_date: "2020-01-01", close_date: "2099-12-31", subject_ids: subjects.map((s) => s.subject_id) });
  await officer("PUT", `/rounds/${created.data.round_id}`, { status: "open" });
  await officer("POST", "/news", { title: "เปิดรับผลสอบรอบที่ 1", content: "ทดสอบบนอุปกรณ์หลายรุ่น", round_id: created.data.round_id });
  const studentOf = {};
  for (let i = 0; i < DEVICES.length; i++) {
    const id = `${PREFIX}${String(70000000 + i + 1)}`;
    const made = await officer("POST", "/students", { student_id: id, national_id: "4" + String(i + 1).padStart(12, "0") });
    if (made.status !== 201) fail(`สร้างนักศึกษาของ ${DEVICES[i]} ไม่สำเร็จ (${made.status})`);
    const acc = await findAccount(prisma, { psu_passport_id: id });
    const profile = await apiClient(API, acc)("POST", "/students/complete-profile", {
      first_name: `ทดสอบ${i + 1}`, last_name: "อุปกรณ์", first_name_en: `Test${i + 1}`, last_name_en: "Device",
      email: `dev${i + 1}@test.local`, phone: "0812345678", room_id: rooms[0].room_id,
    });
    if (profile.status !== 201) fail(`กรอกโปรไฟล์ของ ${DEVICES[i]} ไม่สำเร็จ (${profile.status})`);
    studentOf[DEVICES[i]] = { id, acc: await findAccount(prisma, { psu_passport_id: id }) };
  }

  const browsers = { webkit: await webkit.launch({ headless: true }), chromium: await chromium.launch({ channel: "chrome", headless: true }) };
  for (const device of DEVICES) {
    const profile = devices[device];
    const browser = browsers[profile.defaultBrowserType];
    console.log(`\n══ ${device} (${profile.viewport.width}×${profile.viewport.height}, ${profile.defaultBrowserType === "webkit" ? "Safari" : "Chrome"}) ══`);
    const stu = studentOf[device];
    const safeName = device.replace(/[^A-Za-z0-9]+/g, "_");
    try {
      // ── นักศึกษา ──
      const S = await openContext(browser, device, stu.acc);
      await sweep(S.page, "นักศึกษา", ["/news", "/exam", "/exam/form", "/status", "/history"]);
      await S.page.goto(FE + "/exam/form", { waitUntil: "domcontentloaded" });
      await S.page.waitForTimeout(2200);
      const hasViewportMeta = await S.page.evaluate(() => Boolean(document.querySelector("meta[name=viewport]")));
      check("มี viewport meta (จอมือถือไม่ถูกย่อ)", hasViewportMeta, true);
      const small = await S.page.evaluate(() => {
        const result = { smallTargets: 0, tinyText: 0 };
        for (const el of document.querySelectorAll("button, a, input, select, [role=button]")) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32) && getComputedStyle(el).visibility !== "hidden" && el.type !== "hidden" && el.type !== "file") result.smallTargets++;
        }
        for (const el of document.querySelectorAll("p, span, label, td, li, div")) {
          if (el.children.length === 0 && el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 12) result.tinyText++;
        }
        return result;
      });
      info("หน้ากรอกผล: ปุ่ม/ช่องที่เล็กกว่า 32px / ข้อความเล็กกว่า 12px", `${small.smallTargets} / ${small.tinyText}`);
      const passButtons = S.page.locator(".seg button:nth-child(1)");
      const count = await passButtons.count();
      check("ฟอร์มมีให้กรอก 3 วิชา", count, 3);
      let tapped = 0;
      for (let i = 0; i < count; i++) if (await tryTap(S.page, passButtons.nth(i))) tapped++;
      check("แตะเลือก 'ผ่าน' ได้ครบ 3 วิชา", tapped, 3);
      await S.page.locator("input[type=file]").first().setInputFiles([PNG_FILE]).catch((e) => fail(`แนบรูปไม่ได้ — ${String(e.message).split("\n")[0]}`));
      await S.page.waitForTimeout(500);
      check("หลังเลือกคำตอบ + แนบรูป ไม่เลื่อนแนวนอน", await S.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
      await S.page.screenshot({ path: path.join(OUT_DIR, `${safeName}-form.png`) }).catch(() => {});
      const sent = await tryTap(S.page, S.page.getByRole("button", { name: /ยืนยันและส่งผลสอบ/ }));
      await S.page.waitForTimeout(3000);
      const mine = (await officer("GET", `/exam-results?student_id=${stu.id}`)).data || [];
      check("แตะส่งสำเร็จ ใบมี 1 ไฟล์ รอตรวจ", [sent, mine.length, mine[0]?.certificates?.length, mine[0]?.staff_status], [true, 1, 1, "pending"]);
      await S.context.close();

      // ── เจ้าหน้าที่ ──
      const O = await openContext(browser, device, officerAcc);
      await sweep(O.page, "เจ้าหน้าที่", ["/dashboard", "/review", "/students", "/import", "/rounds", "/users", "/news-manage", "/reports", "/manual"]);
      await O.page.goto(FE + "/review", { waitUntil: "domcontentloaded" });
      await O.page.waitForTimeout(2200);
      let approved = false;
      if (await tryTap(O.page, O.page.locator(`text=${stu.id}`))) {
        await O.page.waitForTimeout(2200);
        await O.page.screenshot({ path: path.join(OUT_DIR, `${safeName}-review.png`) }).catch(() => {});
        if (await tryTap(O.page, O.page.getByRole("button", { name: "ยืนยันผลสอบ" }))) {
          await O.page.waitForTimeout(2000);
          approved = ((await officer("GET", `/exam-results?student_id=${stu.id}`)).data?.[0]?.staff_status) === "approved";
        }
      }
      check("เจ้าหน้าที่แตะยืนยันใบสำเร็จ", approved, true);
      await O.context.close();

      // ── ผู้บริหาร / ผู้ช่วยตรวจ ──
      const E = await openContext(browser, device, execAcc);
      await sweep(E.page, "ผู้บริหาร", ["/dashboard", "/reports"]);
      await E.page.goto(FE + "/dashboard", { waitUntil: "domcontentloaded" });
      await E.page.waitForTimeout(2000);
      await E.page.screenshot({ path: path.join(OUT_DIR, `${safeName}-exec.png`) }).catch(() => {});
      await E.context.close();
      const R = await openContext(browser, device, reviewerAcc);
      await sweep(R.page, "ผู้ช่วยตรวจ", ["/review"]);
      await R.context.close();
    } catch (err) {
      fail(`${device}: หยุดกลางคัน — ${String(err.message).split("\n")[0]}`);
    }
  }
  await browsers.webkit.close();
  await browsers.chromium.close();
  await prisma.$disconnect();
  console.log("\nภาพหน้าจออยู่ที่: " + OUT_DIR);
  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
};

try { await main(); } catch (err) { failures++; console.error(err); }
process.exit(failures === 0 ? 0 : 1);
