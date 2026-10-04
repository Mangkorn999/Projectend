// ทดสอบผ่านหน้าเว็บจริง (เปิด Chrome อัตโนมัติ) ตาม flow ของคณะ — ทุกบทบาท + จอมือถือ + ภาษาบนจอ
//
// รันผ่าน:  npm run test:e2e   (ดู run-e2e.mjs — สร้างฐานข้อมูลชั่วคราว + เปิดเว็บให้เอง ไม่แตะข้อมูลจริง)
//
// หลักการของไฟล์นี้:
//   - แบ่งเป็นหัวข้อ (section) — หัวข้อไหนพังกลางทาง บันทึก FAIL แล้วไปหัวข้อถัดไป ไม่หยุดทั้งไฟล์
//   - กดปุ่มผ่าน safeClick() — รอปุ่มโผล่และกดได้ไม่เกิน 5 วินาที ถ้าไม่ได้ = FAIL แล้วเดินต่อ (ไม่ค้างรอ 30 วินาที)
//   - ถ้าขั้นตอนบนหน้าเว็บไม่สำเร็จ แต่ขั้นถัดไปต้องใช้ข้อมูลนั้น จะเตรียมข้อมูลผ่าน API แทน (พิมพ์ NOTE ไว้)
//     เพื่อให้หัวข้อถัดไปยังทดสอบได้จริง — ความล้มเหลวของหน้าเว็บถูกบันทึกเป็น FAIL ไปแล้ว
//   - ทุกหน้าที่เปิด ตรวจข้อความต้องห้าม (ศัพท์เทคนิค, undefined, รหัสข้อความที่ยังไม่แปล เช่น examform.xxx)
//
// หัวข้อที่ทดสอบ:
//    1. เจ้าหน้าที่เปิดทุกเมนูได้ + โพสต์ประกาศผ่านหน้าเว็บ
//    2. นักศึกษา S1 เข้าครั้งแรก → กรอกโปรไฟล์ → เห็นประกาศ → กรอกผล + แนบ PDF + รูป → รอตรวจ
//    3. นักศึกษา S2 ใช้มือถือ (จอ 390px) → ไม่ล้นจอ → กรอกผล + แนบรูปถ่าย
//    4. S3 เลือกไฟล์ผิดเงื่อนไข (GIF / ใหญ่เกิน / เกิน 5 ไฟล์) → เห็นข้อความภาษาไทย
//    5. S3 นำไฟล์ที่เลือกออกก่อนกดส่ง → ระบบเก็บเฉพาะไฟล์ที่เหลือ
//    6. S2 แก้คำตอบของใบที่ยังรอตรวจ (ก่อนปิดรอบ) → ใบเดิม ยังรอตรวจ
//    7. ผู้ช่วยตรวจสอบเห็นไฟล์ครบ → ตีกลับ S1 พร้อมเหตุผล
//    8. ปิดรอบ → S1 เห็นแจ้งเตือน + ยังแก้ใบที่ถูกตีกลับได้ → ส่งใหม่
//    9. S1 ปัดแจ้งเตือนทิ้ง (ลากไปซ้ายเกิน 90 px) → หายถาวร · ลากสั้นไม่หาย
//   10. เจ้าหน้าที่ยืนยัน S1 หลังปิดรอบ + เมนูส่งออกมี "ภายในปีแรก"
//   11. เจ้าหน้าที่แก้ไขผลการตรวจผ่านหน้าเว็บ (ใส่เหตุผล) → นักศึกษาได้แจ้งเตือน
//   12. เจ้าหน้าที่แก้ไข + ลบประกาศผ่านหน้าเว็บ
//   13. เจ้าหน้าที่สร้างบัญชี "ผู้ช่วยตรวจสอบ" → เข้าครั้งแรกต้องเปลี่ยนรหัส → เห็นแค่คิวตรวจ
//   14. หน้าข้อมูลนักศึกษา: ตัวนับ "แสดง N จาก M คน" + แบ่งหน้า + ทุกเมนูส่งออกได้ไฟล์จริง
//   15. หน้านำเข้า: ไฟล์ CSV หัวคอลัมน์ภาษาไทย → ตรวจไฟล์ → ยืนยัน → อยู่ใน "บัญชีที่ยังไม่เข้าระบบ"
//   16. ผู้บริหารเห็นเฉพาะภาพรวม + ดาวน์โหลดรายงานได้
//   17. สลับภาษาเป็น EN ทุกบทบาท → ทุกเมนูไม่พัง ไม่มี undefined / รหัสข้อความ
//   18. พิมพ์ URL ของบทบาทอื่นตรงๆ → ถูกพากลับหน้าเริ่มต้นของตัวเอง
//   19. ออกจากระบบ → กลับหน้าเข้าสู่ระบบ ใช้งานต่อไม่ได้
import { chromium } from "playwright-core";
import fs from "fs";
import os from "os";
import path from "path";

const FE = process.env.FE || "http://localhost:5175";
const API = process.env.API || "http://localhost:3200/api";
const OUT_DIR = process.env.OUT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "nurse-e2e-"));

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
  return ok;
};
// บันทึก FAIL ตรงๆ (ใช้ตอนกดปุ่มไม่ได้ ฯลฯ)
const fail = (message) => {
  failures++;
  console.log(`FAIL  ${message}`);
};
const note = (message) => {
  console.log(`NOTE  ${message}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── หัวข้อ: ห่อแต่ละขั้น ให้พังได้ทีละหัวข้อ ─────────────────────────────
const sectionSummary = [];
async function section(title, steps) {
  console.log(`\n── ${title} ──`);
  const before = failures;
  try {
    await steps();
  } catch (err) {
    const firstLine = String(err && err.message ? err.message : err).split("\n")[0];
    fail(`[${title}] หยุดกลางคัน: ${firstLine}`);
  }
  sectionSummary.push({ title, fails: failures - before });
}

// ── กดปุ่ม / พิมพ์ / แนบไฟล์ อย่างปลอดภัย ────────────────────────────────
// ปิดแจ้งเตือนที่เด้งมุมขวาบน (อยู่ 6 วินาที) — บางครั้งเด้งทับปุ่มของหน้าพอดี
const toastCovers = [];
async function dismissToasts(page) {
  const closeButtons = page.locator("[aria-live=polite] button");
  const count = await closeButtons.count().catch(() => 0);
  for (let i = count - 1; i >= 0; i--) {
    await closeButtons.nth(i).click({ timeout: 1000 }).catch(() => {});
  }
  return count;
}

// หาบรรทัดที่ Playwright บอกว่า "อะไรบังปุ่มอยู่"
function interceptLine(message) {
  for (const line of String(message).split("\n")) {
    if (line.includes("intercepts pointer events")) return line.trim();
  }
  return "";
}

// รอให้ "มองเห็น + กดได้" ไม่เกิน waitMs ถ้าไม่ได้ = บันทึก FAIL แล้วคืน false (ไม่ค้าง ไม่โยน error)
async function safeClick(locator, label, waitMs = 5000) {
  const deadline = Date.now() + waitMs;
  let lastProblem = "ไม่พบปุ่มบนหน้าจอ";
  while (Date.now() < deadline) {
    const count = await locator.count().catch(() => 0);
    if (count > 0) {
      const target = locator.first();
      const visible = await target.isVisible().catch(() => false);
      const enabled = await target.isEnabled().catch(() => false);
      if (visible && enabled) {
        try {
          await target.click({ timeout: 2000 });
          return true;
        } catch (err) {
          const blocker = interceptLine(err.message);
          lastProblem = "กดไม่ได้: " + (blocker || String(err.message).split("\n")[0]);
          // ถูกแจ้งเตือนที่เด้งมุมขวาบนบัง → จดไว้เป็นข้อสังเกต UX แล้วปิดแจ้งเตือน ลองกดใหม่
          if (blocker.includes("aria-live") || blocker.includes("fade-up")) {
            const closed = await dismissToasts(target.page());
            if (closed > 0 && !toastCovers.includes(label)) {
              toastCovers.push(label);
              note(`แจ้งเตือนที่เด้งมุมขวาบนบังปุ่ม "${label}" — ปิดแจ้งเตือนแล้วกดใหม่`);
            }
          }
        }
      } else if (!visible) {
        lastProblem = "มีปุ่มแต่มองไม่เห็น";
      } else {
        lastProblem = "ปุ่มถูกปิดไว้ (กดไม่ได้)";
      }
    }
    await sleep(250);
  }
  fail(`${label}: ${lastProblem} (รอ ${waitMs / 1000} วินาที)`);
  return false;
}

// เหมือน safeClick แต่ไม่บันทึก FAIL — ใช้กับปุ่มที่ "มีหรือไม่มีก็ได้"
async function tryClick(locator, waitMs = 2000) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const count = await locator.count().catch(() => 0);
    if (count > 0) {
      const target = locator.first();
      const visible = await target.isVisible().catch(() => false);
      const enabled = await target.isEnabled().catch(() => false);
      if (visible && enabled) {
        try {
          await target.click({ timeout: 2000 });
          return true;
        } catch {
          // ลองใหม่รอบหน้า
        }
      }
    }
    await sleep(250);
  }
  return false;
}

// รอให้ปุ่ม "พร้อมกด" แต่ยังไม่กด (ใช้คู่กับการรอดาวน์โหลด) — ไม่พร้อม = FAIL
async function waitUsable(locator, label, waitMs = 5000) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const count = await locator.count().catch(() => 0);
    if (count > 0) {
      const visible = await locator.first().isVisible().catch(() => false);
      const enabled = await locator.first().isEnabled().catch(() => false);
      if (visible && enabled) return true;
    }
    await sleep(250);
  }
  fail(`${label}: ไม่พบปุ่มหรือปุ่มกดไม่ได้ (รอ ${waitMs / 1000} วินาที)`);
  return false;
}

async function safeFill(locator, value, label, waitMs = 5000) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const count = await locator.count().catch(() => 0);
    if (count > 0) {
      try {
        await locator.first().fill(value, { timeout: 2000 });
        return true;
      } catch {
        // ยังพิมพ์ไม่ได้ ลองใหม่
      }
    }
    await sleep(250);
  }
  fail(`${label}: ไม่พบช่องให้พิมพ์ (รอ ${waitMs / 1000} วินาที)`);
  return false;
}

// แนบไฟล์ใส่ <input type=file> (ซ่อนอยู่ก็แนบได้) — แนบไม่ได้ = FAIL พร้อมเหตุผล
async function safeSetFiles(locator, files, label) {
  const count = await locator.count().catch(() => 0);
  if (count === 0) {
    fail(`${label}: ไม่พบช่องแนบไฟล์`);
    return false;
  }
  try {
    await locator.first().setInputFiles(files, { timeout: 5000 });
    return true;
  } catch (err) {
    fail(`${label}: แนบไม่ได้ — ${String(err.message).split("\n")[0]}`);
    return false;
  }
}

// รอจนมีข้อความตรงกับ regex บนจอ (ไม่เกิน waitMs) — คืน true/false ไม่บันทึกผลเอง
async function waitForText(page, regex, waitMs = 4000) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const count = await page.getByText(regex).count().catch(() => 0);
    if (count > 0) return true;
    await sleep(250);
  }
  return false;
}

async function bodyText(page) {
  return page.locator("body").innerText().catch(() => "");
}

// บรรทัดที่ "เพิ่งโผล่" หลังทำ action — ใช้จับข้อความ error ที่ขึ้นมาใหม่ (ไม่สับสนกับคำอธิบายที่มีอยู่แล้วบนหน้า)
async function newLinesAfter(page, action, waitMs = 3000) {
  const before = await bodyText(page);
  await action();
  const deadline = Date.now() + waitMs;
  let after = before;
  while (Date.now() < deadline) {
    await sleep(300);
    after = await bodyText(page);
    if (after !== before) break;
  }
  await sleep(300);
  after = await bodyText(page);
  const oldLines = new Set(before.split("\n"));
  const fresh = [];
  for (const line of after.split("\n")) {
    const trimmed = line.trim();
    if (trimmed !== "" && !oldLines.has(line)) fresh.push(trimmed);
  }
  return fresh;
}

// ── ไฟล์แนบทดสอบ (หัวไฟล์ถูกต้องตามชนิด) ─────────────────────────────
const pdfFile = (name) => ({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF") });
const PDF_FILE = pdfFile("ใบคะแนน.pdf");
const PNG_FILE = { name: "สแกนใบคะแนน.png", mimeType: "image/png", buffer: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]) };
const JPG_FILE = { name: "ถ่ายรูปใบคะแนน.jpg", mimeType: "image/jpeg", buffer: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]) };
const GIF_FILE = { name: "ภาพเคลื่อนไหว.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a" + "0".repeat(40)) };
const BIG_FILE = { name: "ไฟล์ใหญ่เกิน.pdf", mimeType: "application/pdf", buffer: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(11 * 1024 * 1024)]) };

// ── ข้อความที่ "ห้าม" โผล่บนจอ (ผู้ใช้เป็นพยาบาล ไม่ใช่คนไอที) ─────────────────
const FORBIDDEN_TEXT = [
  "undefined", "NaN", "[object Object]", "Request failed", "exam_result", "certificate_type",
  "round_id", "student_id", "server", "Dashboard", "login",
];
// โหมดภาษาอังกฤษ: คำอย่าง Dashboard / login ใช้ได้ — ห้ามแค่ค่าที่หลุดจริงๆ
const FORBIDDEN_TEXT_EN = ["undefined", "NaN", "[object Object]", "Request failed"];

// รหัสข้อความใน i18n.js (เช่น examform.removeFileBtn) — ถ้าโผล่บนจอแปลว่ายังไม่มีคำแปล
// เก็บ "หมวด" ของรหัส (ส่วนหน้าจุดแรก) ไว้จับรหัสที่ยังไม่ได้ใส่ในพจนานุกรมด้วย
const I18N_NAMESPACES = new Set();
try {
  const i18nText = fs.readFileSync(new URL("../../../frontend/src/design/i18n.js", import.meta.url), "utf8");
  for (const match of i18nText.matchAll(/'([a-zA-Z][a-zA-Z0-9_]*)\.[a-zA-Z0-9_.]+'\s*:/g)) {
    I18N_NAMESPACES.add(match[1]);
  }
} catch {
  note("อ่าน i18n.js ไม่ได้ — ข้ามการตรวจรหัสข้อความที่หลุด");
}
const FILE_ENDINGS = ["pdf", "png", "jpg", "jpeg", "xlsx", "csv", "th", "com", "local"];

function problemsInText(text, forbiddenWords) {
  const found = [];
  for (const word of forbiddenWords) {
    if (text.includes(word)) found.push(word);
  }
  // รหัสข้อความที่หลุด เช่น "examform.removeFileBtn"
  const tokens = text.match(/[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+/g) || [];
  for (const token of tokens) {
    const parts = token.split(".");
    const ending = parts[parts.length - 1].toLowerCase();
    if (I18N_NAMESPACES.has(parts[0]) && !FILE_ENDINGS.includes(ending) && !found.includes(token)) {
      found.push(token);
    }
  }
  // ตัวแปรที่ไม่ได้แทนค่า เช่น "{n}"
  const placeholders = text.match(/\{[a-zA-Z]+\}/g) || [];
  for (const placeholder of placeholders) {
    if (!found.includes(placeholder)) found.push(placeholder);
  }
  return found;
}
const findForbidden = async (page) => problemsInText(await bodyText(page), FORBIDDEN_TEXT);
// ตรวจหน้าปัจจุบัน (ไม่ต้องเปิดใหม่) — ใช้หลังกดปุ่ม/เปิดกล่อง
async function scanScreen(page, label) {
  check(`${label}: ไม่มีศัพท์เทคนิค/ค่าหลุดบนจอ`, await findForbidden(page), []);
}

// ── เปิดหน้าต่างเบราว์เซอร์ใหม่ (แต่ละคนแยกกัน เหมือนคนละเครื่อง) ─────────────
const browser = await chromium.launch({ channel: "chrome", headless: true });
const openSession = async ({ mobile = false } = {}) => {
  const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 950 };
  const context = await browser.newContext({ viewport, acceptDownloads: true, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  // คำสั่งที่รอ element ให้รอไม่เกิน 8 วินาที (ค่าเดิมของ Playwright 30 วินาที ทำให้เทสค้างนาน)
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(30000);
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push("หน้าเว็บพัง: " + e.message));
  page.on("response", (r) => {
    if (r.status() >= 500) page.errors.push(`${r.status()} ${r.url()}`);
  });
  return { context, page };
};
const uiLogin = async (page, username, password) => {
  await page.goto(FE + "/");
  await page.fill("input[autocomplete=username]", username);
  await page.fill("input[autocomplete=current-password]", password);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2500);
};
// เปิดหน้า แล้วตรวจ 3 อย่าง: ไม่ขึ้น "ไม่พบหน้า" · ไม่มี error · ไม่มีข้อความต้องห้าม
const visitAndCheck = async (page, urlPath, label) => {
  page.errors.length = 0;
  await page.goto(FE + urlPath);
  await page.waitForTimeout(1800);
  const notFound = await page.getByText("ไม่พบหน้าที่ต้องการ").count();
  check(`${label}: เปิดได้ ไม่มี error`, [notFound, page.errors.length === 0 ? "ok" : page.errors.slice(0, 2).join(" | ")], [0, "ok"]);
  check(`${label}: ไม่มีศัพท์เทคนิค/ค่าหลุดบนจอ`, await findForbidden(page), []);
};
const noHorizontalScroll = async (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const shot = (page, name) => page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: false }).catch(() => {});

// ── ตัวช่วยเรียก API (ใช้เตรียมข้อมูล/ตรวจผลหลังบ้าน) ─────────────────────────
async function apiCall(request, method, url, data) {
  const options = { method };
  if (data !== undefined) options.data = data;
  let res;
  try {
    res = await request.fetch(API + url, options);
  } catch (err) {
    return { status: 0, body: { message: err.message } };
  }
  let body = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  return { status: res.status(), body };
}
async function apiUpload(request, resultId, file) {
  const res = await request.post(`${API}/exam-results/${resultId}/certificates`, {
    multipart: { file: { name: file.name, mimeType: file.mimeType, buffer: file.buffer }, certificate_type: "exam_result" },
  });
  return res.status();
}
// เปิด "เครื่อง" ใหม่ที่เข้าระบบด้วยบัญชีนี้ไว้เรียก API
async function apiSession(username, password) {
  const context = await browser.newContext();
  const request = context.request;
  await request.post(API + "/auth/login", { data: { psu_passport_id: username, password } });
  return request;
}
async function completeProfileApi(request, firstName, lastName, firstEn, lastEn, email, phone, roomId) {
  return apiCall(request, "POST", "/students/complete-profile", {
    first_name: firstName, last_name: lastName, first_name_en: firstEn, last_name_en: lastEn, email, phone, room_id: roomId,
  });
}
// ใบผลสอบของนักศึกษาคนนี้ในรอบ (ไม่มี = null)
async function paperOf(request, roundId) {
  const mine = await apiCall(request, "GET", "/exam-results/me");
  for (const p of mine.body.data || []) {
    if (p.round_id === roundId) return p;
  }
  return null;
}
// ถ้าส่งผ่านหน้าเว็บไม่สำเร็จ → ส่งผ่าน API แทน (answers = ผ่าน/ไม่ผ่าน ตามลำดับวิชาที่ต้องกรอก)
// เพื่อให้หัวข้อถัดไปยังมีใบให้ทดสอบ — ความล้มเหลวของหน้าเว็บถูกบันทึก FAIL ไปแล้ว
// files = ไฟล์ที่ควรติดใบไว้ (ค่าเริ่มต้น PDF 1 ไฟล์)
async function ensurePaper(request, roundId, answers, label, files = [PDF_FILE]) {
  const existing = await paperOf(request, roundId);
  if (existing) {
    if (!existing.certificates || existing.certificates.length === 0) {
      note(`${label}: ใบไม่มีไฟล์แนบ — แนบไฟล์ผ่าน API แทน`);
      for (const file of files) {
        await apiUpload(request, existing.result_id, file);
      }
    }
    return existing.result_id;
  }
  const activeRound = (await apiCall(request, "GET", "/rounds/active")).body.data;
  if (!activeRound) {
    note(`${label}: ไม่มีรอบให้ส่ง (ส่งผ่าน API แทนไม่ได้)`);
    return null;
  }
  const list = [];
  let index = 0;
  for (const s of activeRound.subjects || []) {
    if (!s.already_passed) {
      let passed = true;
      if (index < answers.length) passed = answers[index];
      list.push({ subject_id: s.subject_id, is_passed: passed });
      index++;
    }
  }
  const sent = await apiCall(request, "POST", "/exam-results", { subject_results: list });
  note(`${label}: ส่งผ่านหน้าเว็บไม่สำเร็จ — ส่งผ่าน API แทนเพื่อทดสอบขั้นต่อไป (${sent.status})`);
  if (sent.body.data) {
    for (const file of files) {
      await apiUpload(request, sent.body.data.result_id, file);
    }
    return sent.body.data.result_id;
  }
  return null;
}
// ดาวน์โหลดไฟล์จากการกดปุ่ม — คืน { name, bytes } หรือ null (บันทึก FAIL เอง)
async function downloadBy(page, clickTarget, label) {
  try {
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 25000 }),
      clickTarget.click({ timeout: 5000 }),
    ]);
    const filePath = await download.path();
    const bytes = filePath ? fs.readFileSync(filePath) : Buffer.alloc(0);
    return { name: download.suggestedFilename(), bytes };
  } catch (err) {
    fail(`${label}: ไม่ได้ไฟล์ — ${String(err.message).split("\n")[0]}`);
    return null;
  }
}
function looksLikeFile(file) {
  if (!file || file.bytes.length === 0) return false;
  const head = file.bytes.subarray(0, 4).toString("latin1");
  if (file.name.endsWith(".xlsx")) return head.startsWith("PK");
  if (file.name.endsWith(".pdf")) return head === "%PDF";
  return true;
}

// ── เตรียมข้อมูลผ่าน API (เร็วกว่ากดหน้าเว็บ) — รุ่น 2595 ─────────────────────
const YEAR = 2595;
const PREFIX = String(YEAR - 4).slice(-2);
const STAMP = Date.now().toString().slice(-6);
const makeStudent = (n) => ({ id: `${PREFIX}${STAMP}${String(n).padStart(2, "0")}`, nid: `1${STAMP}0000${String(n).padStart(2, "0")}` });
const S1 = makeStudent(1);
const S2 = makeStudent(2);
const S3 = makeStudent(3);
const IMPORTED = makeStudent(77); // คนที่นำเข้าผ่านไฟล์ CSV ในหัวข้อ 15
const EXTRA_COUNT = 10;           // นักศึกษาเพิ่มให้หน้าข้อมูลนักศึกษามีมากกว่า 1 หน้า (หน้าละ 10 คน)

const officerApi = await browser.newContext();
const api = officerApi.request;
const post = (url, data) => api.post(API + url, { data });
const put = (url, data) => api.put(API + url, { data });

let round = null;
let subjects = [];
let s1api = null;
let s2api = null;
let s3api = null;
let firstRoomId = null;
try {
  await post("/auth/login", { psu_passport_id: "456", password: "456" });
  for (const s of [S1, S2, S3]) {
    await post("/students", { student_id: s.id, national_id: s.nid });
  }
  subjects = (await (await api.get(API + "/subjects")).json()).data;
  round = (await (await post("/rounds", {
    academic_year: YEAR, attempt_number: 1, open_date: "2020-01-01", close_date: "2099-12-31",
    subject_ids: subjects.slice(0, 3).map((s) => s.subject_id),
  })).json()).data;
  await put(`/rounds/${round.round_id}`, { status: "open" });

  // S2, S3 กรอกโปรไฟล์ผ่าน API (ทดสอบหน้าโปรไฟล์กับ S1 แล้ว)
  s2api = await apiSession(S2.id, S2.nid);
  firstRoomId = (await apiCall(s2api, "GET", "/rooms")).body.data[0].room_id;
  await completeProfileApi(s2api, "สมศรี", "มือถือ", "Somsri", "Mobile", "s2@psu.ac.th", "0822222222", firstRoomId);
  s3api = await apiSession(S3.id, S3.nid);
  await completeProfileApi(s3api, "สมปอง", "แนบไฟล์", "Sompong", "Attach", "s3@psu.ac.th", "0833333333", firstRoomId);
  await api.patch(API + "/students/bulk-eligible", { data: { student_ids: [S1.id, S2.id, S3.id], exam_eligible: true } });

  // นักศึกษาเพิ่ม 10 คน (มีโปรไฟล์) — ให้รายชื่อเกิน 1 หน้า
  for (let i = 1; i <= EXTRA_COUNT; i++) {
    const extra = makeStudent(10 + i);
    await post("/students", { student_id: extra.id, national_id: extra.nid });
    const extraApi = await apiSession(extra.id, extra.nid);
    await completeProfileApi(extraApi, `เพิ่มเติม${i}`, "ทดสอบ", `Extra${i}`, "Test", `x${i}@psu.ac.th`, "0844444444", firstRoomId);
  }
} catch (err) {
  console.error("เตรียมข้อมูลผ่าน API ไม่สำเร็จ:", err.message);
  await browser.close();
  process.exit(1);
}

const sessions = {};
try {
  // ════════ 1. เจ้าหน้าที่ ════════
  await section("1. เจ้าหน้าที่: ทุกเมนู + โพสต์ประกาศ", async () => {
    sessions.O = await openSession();
    const O = sessions.O;
    await uiLogin(O.page, "456", "456");
    for (const [urlPath, label] of [
      ["/dashboard", "แดชบอร์ด"], ["/review", "ตรวจสอบผล"], ["/students", "ข้อมูลนักศึกษา"], ["/import", "นำเข้ารายชื่อ"],
      ["/rounds", "รอบการกรอก"], ["/users", "จัดการผู้ใช้งาน"], ["/news-manage", "ประกาศ"], ["/reports", "รายงาน"], ["/manual", "คู่มือ"],
    ]) {
      await visitAndCheck(O.page, urlPath, `เจ้าหน้าที่ ${label}`);
    }
    const navText = await O.page.locator("aside").innerText();
    check("เมนูชื่อ 'จัดการผู้ใช้งาน' (ไม่ใช่ 'ผู้ใช้งานผู้บริหาร')", navText.includes("จัดการผู้ใช้งาน"), true);

    // เพิ่มผู้ใช้: ต้องมีบทบาท "ผู้ช่วยตรวจสอบ" ให้เลือก
    await O.page.goto(FE + "/users");
    await O.page.waitForTimeout(1500);
    if (await safeClick(O.page.getByRole("button", { name: /เพิ่มผู้ใช้งาน/ }), "ปุ่มเพิ่มผู้ใช้งาน")) {
      await O.page.waitForTimeout(400);
      await safeClick(O.page.locator(".modal-card .select-trigger"), "ช่องเลือกบทบาท");
      await O.page.waitForTimeout(300);
      const roleOptions = await O.page.locator(".select-option").allInnerTexts();
      check("เพิ่มผู้ใช้: มีบทบาท 'ผู้ช่วยตรวจสอบ'", roleOptions.some((t) => t.includes("ผู้ช่วยตรวจสอบ")), true);
      await O.page.keyboard.press("Escape");
    }

    // โพสต์ประกาศผ่านหน้าเว็บ
    await O.page.goto(FE + "/news-manage");
    await O.page.waitForTimeout(1500);
    if (await safeClick(O.page.getByRole("button", { name: /เขียนประกาศ/ }), "ปุ่มเขียนประกาศ")) {
      await O.page.waitForTimeout(400);
      await safeFill(O.page.getByPlaceholder("หัวข้อ…"), "เปิดรับผลสอบรอบที่ 1 (ทดสอบ)", "ช่องหัวข้อประกาศ");
      await safeFill(O.page.getByPlaceholder("รายละเอียดประกาศ…"), "กรุณากรอกผลสอบและแนบใบคะแนนภายในกำหนด", "ช่องรายละเอียดประกาศ");
      await safeClick(O.page.getByRole("button", { name: /เผยแพร่/ }), "ปุ่มเผยแพร่ประกาศ");
      await O.page.waitForTimeout(1500);
    }
    const posted = await O.page.getByText("เปิดรับผลสอบรอบที่ 1 (ทดสอบ)").count() > 0;
    check("โพสต์ประกาศผ่านหน้าเว็บ -> ขึ้นในรายการ", posted, true);
    if (!posted) {
      note("โพสต์ประกาศผ่านหน้าเว็บไม่สำเร็จ — โพสต์ผ่าน API แทน");
      await post("/news", { title: "เปิดรับผลสอบรอบที่ 1 (ทดสอบ)", content: "กรุณากรอกผลสอบ", round_id: round.round_id });
    }
  });

  // ════════ 2. นักศึกษา S1 (คอมพิวเตอร์) ════════
  await section("2. นักศึกษา S1 (คอมพิวเตอร์): โปรไฟล์ → ประกาศ → กรอกผล + แนบ 2 ไฟล์", async () => {
    sessions.A = await openSession();
    const A = sessions.A;
    await uiLogin(A.page, S1.id, S1.nid);
    check("เข้าครั้งแรก -> หน้ากรอกโปรไฟล์", A.page.url().includes("complete-profile"), true);
    const input = (label) => A.page.locator(`xpath=//label[contains(.,"${label}")]/following-sibling::input`);
    await safeFill(input("ชื่อจริง (ไทย)"), "สมหญิง", "ช่องชื่อจริง (ไทย)");
    await safeFill(input("นามสกุล (ไทย)"), "ใจดี", "ช่องนามสกุล (ไทย)");
    await safeFill(input("First name (EN)"), "Somying", "ช่องชื่ออังกฤษ");
    await safeFill(input("Last name (EN)"), "Jaidee", "ช่องนามสกุลอังกฤษ");
    await safeFill(input("อีเมล"), "somying@psu.ac.th", "ช่องอีเมล");
    await safeFill(input("เบอร์โทร"), "0811111111", "ช่องเบอร์โทร");
    if (await safeClick(A.page.locator(".select-trigger"), "ช่องเลือกห้องเรียน")) {
      await safeClick(A.page.locator(".select-option").nth(1), "ตัวเลือกห้องเรียน");
    }
    await safeClick(A.page.getByRole("button", { name: "ตรวจสอบข้อมูล" }), "ปุ่มตรวจสอบข้อมูลโปรไฟล์");
    await A.page.waitForTimeout(400);
    check("หน้าตรวจทานโปรไฟล์แสดงชื่อภาษาอังกฤษ", await A.page.getByText("Somying Jaidee").count() > 0, true);
    await safeClick(A.page.getByRole("button", { name: "ยืนยันข้อมูล" }), "ปุ่มยืนยันข้อมูลโปรไฟล์");
    await A.page.waitForTimeout(1500);
    await tryClick(A.page.getByRole("button", { name: "เข้าสู่ระบบ" }));
    await A.page.waitForTimeout(2000);

    // ช่องทาง API ของ S1 (ใช้ตรวจผลหลังบ้าน) — ถ้ากรอกโปรไฟล์ผ่านหน้าเว็บไม่สำเร็จ กรอกผ่าน API แทน
    s1api = await apiSession(S1.id, S1.nid);
    const profileFallback = await completeProfileApi(s1api, "สมหญิง", "ใจดี", "Somying", "Jaidee", "somying@psu.ac.th", "0811111111", firstRoomId);
    if (profileFallback.status === 200 || profileFallback.status === 201) {
      note("กรอกโปรไฟล์ผ่านหน้าเว็บไม่สำเร็จ — กรอกผ่าน API แทน");
      await uiLogin(A.page, S1.id, S1.nid);
    }

    await visitAndCheck(A.page, "/news", "นักศึกษา ประกาศ");
    check("นักศึกษาเห็นประกาศที่เจ้าหน้าที่โพสต์", await A.page.getByText("เปิดรับผลสอบรอบที่ 1 (ทดสอบ)").count() > 0, true);
    for (const [urlPath, label] of [["/exam", "เริ่มกรอก"], ["/status", "สถานะ"], ["/history", "ประวัติ"]]) {
      await visitAndCheck(A.page, urlPath, `นักศึกษา ${label}`);
    }

    await visitAndCheck(A.page, "/exam/form", "นักศึกษา ฟอร์มกรอกผล");
    const passButtons = A.page.locator(".seg button:nth-child(1)");
    const subjectCount = await passButtons.count();
    check("ฟอร์มแสดงวิชาของรอบ (3 วิชา)", subjectCount, 3);
    for (let i = 0; i < subjectCount; i++) {
      await safeClick(passButtons.nth(i), `ปุ่มผ่านวิชาที่ ${i + 1}`);
    }
    const attachedTwo = await safeSetFiles(A.page.locator("input[type=file]"), [PDF_FILE, PNG_FILE], "เลือกแนบ 2 ไฟล์พร้อมกัน");
    check("เลือกแนบ 2 ไฟล์พร้อมกัน (PDF + รูป) ได้", attachedTwo, true);
    await A.page.waitForTimeout(400);
    check("ฟอร์มแสดงรายชื่อไฟล์ที่เลือกครบ 2 ไฟล์", [await A.page.getByText(PDF_FILE.name).count() > 0, await A.page.getByText(PNG_FILE.name).count() > 0], [true, true]);
    await scanScreen(A.page, "ฟอร์มหลังเลือกไฟล์");
    await shot(A.page, "01-student-form-2-files");
    await safeClick(A.page.getByRole("button", { name: /ยืนยันและส่งผลสอบ/ }), "ปุ่มยืนยันและส่งผลสอบ (S1)");
    await A.page.waitForTimeout(2500);
    await A.page.goto(FE + "/status");
    await A.page.waitForTimeout(1800);
    check("ส่งแล้ว -> สถานะ 'รอตรวจสอบ'", await A.page.getByText("รอตรวจสอบ").count() > 0, true);
    const s1Paper = await paperOf(s1api, round.round_id);
    check("  หลังบ้านได้ไฟล์ครบ 2 ไฟล์", s1Paper && s1Paper.certificates ? s1Paper.certificates.length : 0, 2);
    await ensurePaper(s1api, round.round_id, [true, true, true], "S1", [PDF_FILE, PNG_FILE]);
  });

  // ════════ 3. นักศึกษา S2 (มือถือ) ════════
  await section("3. นักศึกษา S2 (มือถือ 390px)", async () => {
    sessions.M = await openSession({ mobile: true });
    const M = sessions.M;
    await M.page.goto(FE + "/");
    await M.page.waitForTimeout(1200);
    check("มือถือ: หน้าเข้าสู่ระบบไม่ต้องเลื่อนซ้าย-ขวา", await noHorizontalScroll(M.page), true);
    await uiLogin(M.page, S2.id, S2.nid);
    for (const [urlPath, label] of [["/news", "ประกาศ"], ["/exam", "เริ่มกรอก"], ["/exam/form", "ฟอร์มกรอกผล"], ["/status", "สถานะ"], ["/history", "ประวัติ"]]) {
      await visitAndCheck(M.page, urlPath, `มือถือ ${label}`);
      check(`มือถือ ${label}: ไม่ต้องเลื่อนซ้าย-ขวา`, await noHorizontalScroll(M.page), true);
    }
    await M.page.goto(FE + "/exam/form");
    await M.page.waitForTimeout(1800);
    const mPass = M.page.locator(".seg button:nth-child(1)");
    const mFail = M.page.locator(".seg button:nth-child(2)");
    await safeClick(mPass.nth(0), "มือถือ: ปุ่มผ่านวิชาที่ 1");
    await safeClick(mFail.nth(1), "มือถือ: ปุ่มไม่ผ่านวิชาที่ 2");
    await safeClick(mFail.nth(2), "มือถือ: ปุ่มไม่ผ่านวิชาที่ 3");
    await safeSetFiles(M.page.locator("input[type=file]"), [JPG_FILE], "มือถือ: แนบรูปถ่าย");
    await M.page.waitForTimeout(300);
    check("มือถือ: หลังแนบรูปแล้วยังไม่ต้องเลื่อนซ้าย-ขวา", await noHorizontalScroll(M.page), true);
    await shot(M.page, "02-mobile-form");
    const mSubmit = M.page.getByRole("button", { name: /ยืนยันและส่งผลสอบ/ });
    check("มือถือ: ปุ่มส่งมองเห็นและกดได้", await mSubmit.isEnabled().catch(() => false), true);
    await safeClick(mSubmit, "มือถือ: ปุ่มยืนยันและส่งผลสอบ");
    await M.page.waitForTimeout(2500);
    await ensurePaper(s2api, round.round_id, [true, false, false], "S2");
  });

  // ════════ 4. S3: ไฟล์ผิดเงื่อนไข ════════
  await section("4. S3 เลือกไฟล์ผิดเงื่อนไข (GIF / ใหญ่เกิน / เกิน 5 ไฟล์) → ข้อความภาษาไทย", async () => {
    sessions.T = await openSession();
    const T = sessions.T;
    await uiLogin(T.page, S3.id, S3.nid);
    await visitAndCheck(T.page, "/exam/form", "S3 ฟอร์มกรอกผล");
    const fileInput = T.page.locator("input[type=file]");

    // (ก) ไฟล์ GIF — ชนิดที่ไม่รับ
    const gifLines = await newLinesAfter(T.page, () => safeSetFiles(fileInput, [GIF_FILE], "เลือกไฟล์ GIF"));
    let gifMessage = "";
    for (const line of gifLines) {
      if (/[ก-๙]/.test(line) && /PDF|JPG|PNG|ชนิด|ประเภท/.test(line)) gifMessage = line;
    }
    check("GIF: ขึ้นข้อความภาษาไทยบอกชนิดไฟล์ที่รับได้", gifMessage !== "", true);
    check("  ข้อความไม่มีศัพท์เทคนิค", problemsInText(gifLines.join("\n"), FORBIDDEN_TEXT), []);
    check("  ไฟล์ GIF ไม่ถูกเพิ่มในรายการแนบ", await T.page.getByText(GIF_FILE.name, { exact: true }).count(), 0);

    // (ข) ไฟล์ใหญ่เกิน 10 MB
    const bigLines = await newLinesAfter(T.page, () => safeSetFiles(fileInput, [BIG_FILE], "เลือกไฟล์ใหญ่เกิน"));
    let bigMessage = "";
    for (const line of bigLines) {
      if (/[ก-๙]/.test(line) && /10\s*MB|ใหญ่|ขนาด/.test(line)) bigMessage = line;
    }
    check("ไฟล์ใหญ่เกิน 10 MB: ขึ้นข้อความภาษาไทยบอกขนาดสูงสุด", bigMessage !== "", true);
    check("  ข้อความไม่มีศัพท์เทคนิค", problemsInText(bigLines.join("\n"), FORBIDDEN_TEXT), []);
    check("  ไฟล์ใหญ่เกินไม่ถูกเพิ่มในรายการแนบ", await T.page.getByText(BIG_FILE.name, { exact: true }).count(), 0);

    // (ค) เลือก 6 ไฟล์พร้อมกัน — รับได้สูงสุด 5
    await T.page.goto(FE + "/exam/form");
    await T.page.waitForTimeout(1800);
    const sixFiles = [];
    for (let i = 1; i <= 6; i++) sixFiles.push(pdfFile(`หลักฐาน-${i}.pdf`));
    const sixLines = await newLinesAfter(T.page, () => safeSetFiles(T.page.locator("input[type=file]"), sixFiles, "เลือก 6 ไฟล์พร้อมกัน"));
    let maxMessage = "";
    for (const line of sixLines) {
      if (/[ก-๙]/.test(line) && /5/.test(line) && /ไฟล์/.test(line)) maxMessage = line;
    }
    check("เลือก 6 ไฟล์: ขึ้นข้อความภาษาไทยว่าแนบได้สูงสุด 5 ไฟล์", maxMessage !== "", true);
    check("  ข้อความไม่มีศัพท์เทคนิค", problemsInText(sixLines.join("\n"), FORBIDDEN_TEXT), []);
    let listed = 0;
    for (const f of sixFiles) {
      if (await T.page.getByText(f.name, { exact: true }).count() > 0) listed++;
    }
    check("  รายการแนบมีไม่เกิน 5 ไฟล์", listed <= 5, true);
    await scanScreen(T.page, "ฟอร์มหลังเลือกไฟล์เกินจำนวน");
    await shot(T.page, "03-file-errors");
  });

  // ════════ 5. S3: นำไฟล์ออกก่อนส่ง ════════
  await section("5. S3 นำไฟล์ที่เลือกออกก่อนกดส่ง", async () => {
    const T = sessions.T;
    const keep = pdfFile("เก็บไว้-ใบคะแนน.pdf");
    const drop = { name: "นำออก-รูปผิด.jpg", mimeType: "image/jpeg", buffer: JPG_FILE.buffer };
    await T.page.goto(FE + "/exam/form");
    await T.page.waitForTimeout(1800);
    const passButtons = T.page.locator(".seg button:nth-child(1)");
    const count = await passButtons.count();
    for (let i = 0; i < count; i++) {
      await safeClick(passButtons.nth(i), `S3 ปุ่มผ่านวิชาที่ ${i + 1}`);
    }
    await safeSetFiles(T.page.locator("input[type=file]"), [keep, drop], "S3 เลือก 2 ไฟล์");
    await T.page.waitForTimeout(400);
    check("เห็นไฟล์ที่เลือกทั้ง 2 ไฟล์", [await T.page.getByText(keep.name, { exact: true }).count() > 0, await T.page.getByText(drop.name, { exact: true }).count() > 0], [true, true]);

    // ปุ่มนำออกอยู่ในแถวของไฟล์นั้น
    // แถวไฟล์ใหม่มีปุ่มตัวเลือกประเภทเอกสารอยู่ด้วย จึงต้องระบุชื่อปุ่ม "นำออก" ไม่ใช่หา button ตัวไหนก็ได้ในแถว
    let removeButton = T.page.locator(".evidence-row", { hasText: drop.name }).getByRole("button", { name: /นำออก|ลบ|เอาออก/ });
    if (await removeButton.count() === 0) {
      removeButton = T.page.locator("div", { hasText: drop.name }).filter({ has: T.page.getByRole("button", { name: /นำออก|ลบ|เอาออก/ }) }).last().getByRole("button", { name: /นำออก|ลบ|เอาออก/ });
    }
    await safeClick(removeButton, "ปุ่มนำไฟล์ออก");
    await T.page.waitForTimeout(400);
    check("นำออกแล้ว: ไฟล์ที่นำออกหายจากรายการ ไฟล์อื่นยังอยู่", [await T.page.getByText(drop.name, { exact: true }).count(), await T.page.getByText(keep.name, { exact: true }).count() > 0], [0, true]);
    await scanScreen(T.page, "ฟอร์มหลังนำไฟล์ออก");
    await safeClick(T.page.getByRole("button", { name: /ยืนยันและส่งผลสอบ/ }), "ปุ่มยืนยันและส่งผลสอบ (S3)");
    await T.page.waitForTimeout(2500);
    const s3Paper = await paperOf(s3api, round.round_id);
    const names = [];
    if (s3Paper) {
      for (const c of s3Paper.certificates || []) names.push(c.file_name);
    }
    check("หลังบ้านเก็บเฉพาะไฟล์ที่เหลือ (1 ไฟล์ ไม่มีไฟล์ที่นำออก)", names, [keep.name]);
    await ensurePaper(s3api, round.round_id, [true, true, true], "S3");
  });

  // ════════ 6. S2 แก้ใบที่รอตรวจ ════════
  await section("6. S2 แก้คำตอบของใบที่ยังรอตรวจ (ก่อนปิดรอบ)", async () => {
    const M = sessions.M;
    const before = await paperOf(s2api, round.round_id);
    const activeRound = (await apiCall(s2api, "GET", "/rounds/active")).body.data;
    const secondSubjectId = activeRound && activeRound.subjects && activeRound.subjects[1] ? activeRound.subjects[1].subject_id : null;
    await M.page.goto(FE + "/exam/form");
    await M.page.waitForTimeout(2000);
    check("หน้ากรอกบอกว่ากำลังแก้ใบเดิม", await M.page.getByText("แก้ไขและส่งผลสอบใหม่").count() > 0, true);
    await safeClick(M.page.locator(".seg button:nth-child(1)").nth(1), "มือถือ: เปลี่ยนวิชาที่ 2 เป็นผ่าน");
    await safeClick(M.page.getByRole("button", { name: /บันทึกการแก้ไข/ }), "มือถือ: ปุ่มบันทึกการแก้ไข");
    await M.page.waitForTimeout(2500);
    const after = await paperOf(s2api, round.round_id);
    let secondPassed = null;
    if (after) {
      for (const sr of after.subject_results || []) {
        if (sr.subject_id === secondSubjectId) secondPassed = sr.is_passed;
      }
    }
    check("แก้แล้ว: ใบเดิม (ไม่เกิดใบใหม่) ยังรอตรวจ วิชาที่ 2 เป็นผ่าน", [
      after ? after.result_id : null, after ? after.staff_status : null, secondPassed,
    ], [before ? before.result_id : "มีใบเดิม", "pending", true]);
    await visitAndCheck(M.page, "/status", "มือถือ สถานะหลังแก้");
    check("  สถานะยังเป็น 'รอตรวจสอบ'", await M.page.getByText("รอตรวจสอบ").count() > 0, true);
  });

  // ════════ 7. ผู้ช่วยตรวจ ตีกลับ S1 ════════
  await section("7. ผู้ช่วยตรวจสอบ: เห็นไฟล์ครบ → ตีกลับ S1", async () => {
    sessions.R = await openSession();
    const R = sessions.R;
    await uiLogin(R.page, "321", "321");
    await visitAndCheck(R.page, "/review", "ผู้ช่วยตรวจ คิวตรวจ");
    check("ผู้ช่วยตรวจไม่มีเมนูจัดการ", await R.page.locator("aside").getByText("จัดการผู้ใช้งาน").count(), 0);
    let rejectedByUi = false;
    if (await safeClick(R.page.locator(`text=${S1.id}`), "แถวของ S1 ในคิวตรวจ")) {
      await R.page.waitForTimeout(1800);
      check("ผู้ช่วยตรวจเห็นไฟล์แนบครบ 2 ไฟล์", [await R.page.getByText(PDF_FILE.name).count() > 0, await R.page.getByText(PNG_FILE.name).count() > 0], [true, true]);
      check("ชนิดเอกสารแสดงเป็นภาษาไทย (ไม่ใช่ exam_result)", await findForbidden(R.page), []);
      await shot(R.page, "04-reviewer-detail");
      if (await safeClick(R.page.getByRole("button", { name: /ตีกลับเพื่อแก้ไข/ }), "ปุ่มตีกลับเพื่อแก้ไข")) {
        await R.page.waitForTimeout(400);
        await safeFill(R.page.locator(".modal-card textarea"), "รูปใบคะแนนไม่ชัด กรุณาแนบใหม่", "ช่องเหตุผลตีกลับ");
        await safeClick(R.page.locator(".modal-card button", { hasText: "ยืนยันการตีกลับ" }), "ปุ่มยืนยันการตีกลับ");
        await R.page.waitForTimeout(1500);
        rejectedByUi = await R.page.getByText("ถูกตีกลับ").count() > 0;
      }
    }
    check("ตีกลับสำเร็จ", rejectedByUi, true);
    const s1Paper = await paperOf(s1api, round.round_id);
    if (s1Paper && s1Paper.staff_status === "pending") {
      note("ตีกลับผ่านหน้าเว็บไม่สำเร็จ — ตีกลับผ่าน API แทน");
      await apiCall(api, "PATCH", `/exam-results/${s1Paper.result_id}/reject`, { remark: "รูปใบคะแนนไม่ชัด กรุณาแนบใหม่" });
    }
  });

  // ════════ 8. ปิดรอบ แล้ว S1 แก้ใบที่ถูกตีกลับ ════════
  await section("8. ปิดรอบ → S1 เห็นแจ้งเตือน + แก้ใบที่ถูกตีกลับได้", async () => {
    const A = sessions.A;
    await put(`/rounds/${round.round_id}`, { status: "closed" });
    await A.page.goto(FE + "/news");
    await A.page.waitForTimeout(2000);
    if (await safeClick(A.page.getByRole("button", { name: "การแจ้งเตือน" }), "ปุ่มการแจ้งเตือน")) {
      await A.page.waitForTimeout(600);
      check("แจ้งเตือนบอกเหตุผลที่ถูกตีกลับ", await A.page.getByText(/รูปใบคะแนนไม่ชัด/).count() > 0, true);
      await scanScreen(A.page, "กล่องแจ้งเตือนนักศึกษา");
    }
    await A.page.goto(FE + "/exam/form");
    await A.page.waitForTimeout(2000);
    const resubmit = A.page.getByRole("button", { name: /ส่งผลสอบใหม่/ });
    check("รอบปิดแล้ว แต่ใบที่ถูกตีกลับยังแก้ได้ (มีปุ่มส่งใหม่)", await resubmit.count() > 0, true);
    await scanScreen(A.page, "ฟอร์มแก้ใบที่ถูกตีกลับหลังปิดรอบ");
    if (await resubmit.count() > 0) {
      await safeSetFiles(A.page.locator("input[type=file]"), [JPG_FILE], "แนบรูปใหม่");
      await A.page.waitForTimeout(300);
      await safeClick(resubmit, "ปุ่มส่งผลสอบใหม่");
      await A.page.waitForTimeout(2500);
      await A.page.goto(FE + "/status");
      await A.page.waitForTimeout(1800);
      check("ส่งใหม่แล้ว -> กลับเป็น 'รอตรวจสอบ'", await A.page.getByText("รอตรวจสอบ").count() > 0, true);
    }
    await shot(A.page, "05-student-after-fix");
  });

  // ════════ 9. ปัดแจ้งเตือนทิ้ง ════════
  await section("9. S1 ปัดแจ้งเตือนทิ้ง (ลากไปซ้ายเกิน 90 px)", async () => {
    const A = sessions.A;
    await A.page.goto(FE + "/news");
    await A.page.waitForTimeout(2000);
    if (!(await safeClick(A.page.getByRole("button", { name: "การแจ้งเตือน" }), "ปุ่มการแจ้งเตือน"))) return;
    await A.page.waitForTimeout(700);
    // แถวแจ้งเตือน = ปุ่มในกล่องที่มี div ข้างใน (ปุ่มปิด/ล้างทั้งหมดไม่มี)
    const rows = A.page.locator(".modal-card button:has(> div)");
    const before = await rows.count();
    check("มีแจ้งเตือนอย่างน้อย 2 รายการให้ทดสอบ", before >= 2, true);
    if (before < 2) return;

    const dragLeft = async (distance) => {
      const box = await rows.first().boundingBox();
      const y = box.y + box.height / 2;
      const startX = box.x + box.width / 2;
      await A.page.mouse.move(startX, y);
      await A.page.mouse.down();
      for (let step = 1; step <= 10; step++) {
        await A.page.mouse.move(startX - (distance * step) / 10, y);
        await sleep(20);
      }
      await A.page.mouse.up();
      await A.page.waitForTimeout(900);
    };

    await dragLeft(40);
    check("ลากสั้น (40 px) -> แถวเด้งกลับ ไม่ถูกลบ กล่องยังเปิดอยู่", [await rows.count(), await A.page.locator(".modal-card").count() > 0], [before, true]);
    const firstTitle = (await rows.first().innerText()).split("\n")[0];
    await dragLeft(160);
    check("ลากยาว (160 px) -> แถวนั้นหายไป 1 รายการ", await rows.count(), before - 1);

    await A.page.mouse.click(5, 400); // คลิกพื้นหลังเพื่อปิดกล่อง
    await A.page.waitForTimeout(500);
    await safeClick(A.page.getByRole("button", { name: "การแจ้งเตือน" }), "ปุ่มการแจ้งเตือน (เปิดอีกครั้ง)");
    await A.page.waitForTimeout(700);
    const afterReopen = await rows.count();
    const titles = await rows.allInnerTexts();
    let stillThere = false;
    for (const t of titles) {
      if (t.split("\n")[0] === firstTitle) stillThere = true;
    }
    check("เปิดกล่องใหม่ -> รายการที่ปัดทิ้งไม่กลับมา", [afterReopen, stillThere], [before - 1, false]);
    await A.page.mouse.click(5, 400);
  });

  // ════════ 10. เจ้าหน้าที่ยืนยัน + เมนูส่งออก ════════
  await section("10. เจ้าหน้าที่ยืนยัน S1 หลังปิดรอบ + เมนูส่งออก", async () => {
    const O = sessions.O;
    await O.page.goto(FE + "/review");
    await O.page.waitForTimeout(1800);
    if (await safeClick(O.page.locator(`text=${S1.id}`), "แถวของ S1 ในคิวตรวจ (เจ้าหน้าที่)")) {
      await O.page.waitForTimeout(1800);
      await safeClick(O.page.getByRole("button", { name: /^ยืนยันผลสอบ$/ }), "ปุ่มยืนยันผลสอบ");
      await O.page.waitForTimeout(1500);
    }
    check("เจ้าหน้าที่ยืนยันผลหลังปิดรอบได้", await O.page.getByText("ยืนยันแล้ว").count() > 0, true);

    await O.page.goto(FE + "/students");
    await O.page.waitForTimeout(1800);
    if (await safeClick(O.page.getByRole("button", { name: /ส่งออกข้อมูล/ }), "ปุ่มส่งออกข้อมูล")) {
      await O.page.waitForTimeout(300);
      const exportItems = await O.page.getByRole("menuitem").allInnerTexts();
      check("เมนูส่งออกหน้านักศึกษามีเฉพาะข้อมูลนักศึกษา (รายชื่อผ่าน/ไม่ผ่านอยู่หน้ารายงานที่เดียว)", [exportItems.length, exportItems.some((t) => t.includes("ภายในปีแรก"))], [2, false]);
      await O.page.keyboard.press("Escape");
    }
    await O.page.goto(FE + "/reports");
    await O.page.waitForTimeout(2200);
    check("แผงส่งออกในรายงานมี 'ภายในปีแรก'", await O.page.getByText(/ภายในปีแรก/).count() > 0, true);
  });

  // ════════ 11. แก้ไขผลการตรวจผ่านหน้าเว็บ (ยืนยันแล้ว/ถูกตีกลับ → รอตรวจ) ════════
  await section("11. เจ้าหน้าที่แก้ไขผลการตรวจผ่านหน้าเว็บ → นักศึกษาได้แจ้งเตือน + ปุ่มตรงกับสถานะ", async () => {
    const O = sessions.O;
    const T = sessions.T;
    const REASON = "ยืนยันผิดคน ขอตรวจใหม่อีกครั้ง";
    const s3Paper = await paperOf(s3api, round.round_id);
    check("S3 มีใบให้ทดสอบ", !!s3Paper, true);
    if (!s3Paper) return;
    if (s3Paper.staff_status === "pending") {
      await apiCall(api, "PATCH", `/exam-results/${s3Paper.result_id}/approve`);
    }
    await O.page.goto(FE + "/students");
    await O.page.waitForTimeout(1800);
    await safeFill(O.page.getByPlaceholder(/ค้นหาด้วยชื่อหรือรหัสนักศึกษา/), S3.id, "ช่องค้นหานักศึกษา");
    await O.page.waitForTimeout(600);
    if (await safeClick(O.page.locator("tbody tr", { hasText: S3.id }), "แถวของ S3 ในรายชื่อนักศึกษา")) {
      await O.page.waitForTimeout(1800);
      // ใบที่ยืนยันแล้ว: ปุ่มเดียวคือ "แก้ไขผลการตรวจ" (ไม่มีปุ่มยืนยัน/ตีกลับซ้ำ)
      const btn = (name) => O.page.getByRole("button", { name });
      check("ใบยืนยันแล้ว: เห็นปุ่มแก้ไขผลการตรวจ ไม่เห็นปุ่มยืนยัน/ตีกลับ",
        [await btn(/แก้ไขผลการตรวจ/).count() > 0, await btn(/^ยืนยันผลสอบ$/).count(), await btn(/ตีกลับเพื่อแก้ไข/).count()], [true, 0, 0]);
      if (await safeClick(btn(/แก้ไขผลการตรวจ/), "ปุ่มแก้ไขผลการตรวจ")) {
        await O.page.waitForTimeout(400);
        await scanScreen(O.page, "กล่องแก้ไขผลการตรวจ");
        await safeFill(O.page.locator(".modal-card textarea"), REASON, "ช่องเหตุผลแก้ไขผลการตรวจ");
        await safeClick(O.page.locator(".modal-card button", { hasText: "แก้ไขผลการตรวจ" }), "ปุ่มยืนยันการแก้ไข");
        await O.page.waitForTimeout(1800);
      }
      // กลับเป็นรอตรวจ: ปุ่มยืนยัน/ตีกลับกลับมา ปุ่มแก้ไขหายไป
      check("ใบรอตรวจ: เห็นปุ่มยืนยัน+ตีกลับ ไม่เห็นปุ่มแก้ไขผลการตรวจ",
        [await btn(/^ยืนยันผลสอบ$/).count() > 0, await btn(/ตีกลับเพื่อแก้ไข/).count() > 0, await btn(/แก้ไขผลการตรวจ/).count()], [true, true, 0]);
      // ตีกลับผ่านหน้าเว็บ → ใบที่ถูกตีกลับก็ต้องมีปุ่มเดียวคือ "แก้ไขผลการตรวจ" (ซ้ำซ้อนเดิม: ตีกลับแล้วไม่มีทางแก้)
      if (await safeClick(btn(/ตีกลับเพื่อแก้ไข/), "ปุ่มตีกลับเพื่อแก้ไข (S3)")) {
        await O.page.waitForTimeout(400);
        await safeFill(O.page.locator(".modal-card textarea"), "ตีกลับเพื่อทดสอบปุ่มแก้ไข", "ช่องเหตุผลตีกลับ (S3)");
        await safeClick(O.page.locator(".modal-card button", { hasText: "ยืนยันการตีกลับ" }), "ปุ่มยืนยันการตีกลับ (S3)");
        await O.page.waitForTimeout(1800);
      }
      check("ใบถูกตีกลับ: เห็นปุ่มแก้ไขผลการตรวจ ไม่เห็นปุ่มยืนยัน/ตีกลับ",
        [await btn(/แก้ไขผลการตรวจ/).count() > 0, await btn(/^ยืนยันผลสอบ$/).count(), await btn(/ตีกลับเพื่อแก้ไข/).count()], [true, 0, 0]);
      // คืนใบเป็นรอตรวจด้วยปุ่มเดียวกันผ่านหน้าเว็บ (ให้หัวข้อถัดไปเจอสถานะเหมือนเดิม) — เหตุผลเดิมใช้เช็คแจ้งเตือนด้านล่าง
      if (await safeClick(btn(/แก้ไขผลการตรวจ/), "ปุ่มแก้ไขผลการตรวจ (ใบที่ถูกตีกลับ)")) {
        await O.page.waitForTimeout(400);
        await safeFill(O.page.locator(".modal-card textarea"), REASON, "ช่องเหตุผลแก้ไขผลการตรวจ (ใบที่ถูกตีกลับ)");
        await safeClick(O.page.locator(".modal-card button", { hasText: "แก้ไขผลการตรวจ" }), "ปุ่มยืนยันการแก้ไข (ใบที่ถูกตีกลับ)");
        await O.page.waitForTimeout(1800);
      }
    }
    const after = await paperOf(s3api, round.round_id);
    check("ใบของ S3 กลับเป็นรอตรวจสอบ", after ? after.staff_status : null, "pending");
    const notes = (await apiCall(s3api, "GET", "/notifications/me")).body.data || [];
    let gotNote = false;
    for (const n of notes) {
      if (n.type === "revoked" && n.message.includes(REASON)) gotNote = true;
    }
    check("S3 ได้แจ้งเตือนแก้ไขผลการตรวจพร้อมเหตุผล (หลังบ้าน)", gotNote, true);
    await T.page.goto(FE + "/news");
    await T.page.waitForTimeout(2000);
    if (await safeClick(T.page.getByRole("button", { name: "การแจ้งเตือน" }), "ปุ่มการแจ้งเตือน (S3)")) {
      await T.page.waitForTimeout(700);
      check("S3 เห็นแจ้งเตือนแก้ไขผลการตรวจบนหน้าเว็บ", await T.page.getByText(new RegExp(REASON)).count() > 0, true);
      await T.page.mouse.click(5, 400);
    }
  });

  // ════════ 12. แก้ไข + ลบประกาศผ่านหน้าเว็บ ════════
  await section("12. เจ้าหน้าที่แก้ไข + ลบประกาศผ่านหน้าเว็บ", async () => {
    const O = sessions.O;
    const OLD_TITLE = `ประกาศทดสอบแก้ไข ${STAMP}`;
    const NEW_TITLE = `ประกาศทดสอบแก้ไขแล้ว ${STAMP}`;
    await post("/news", { title: OLD_TITLE, content: "เนื้อหาเดิม", round_id: round.round_id });
    await O.page.goto(FE + "/news-manage");
    await O.page.waitForTimeout(1800);
    const rowOf = (title) => O.page.locator("div", { has: O.page.getByText(title, { exact: true }) })
      .filter({ has: O.page.getByRole("button", { name: /แก้ไข/ }) }).last();
    if (await safeClick(rowOf(OLD_TITLE).getByRole("button", { name: /แก้ไข/ }), "ปุ่มแก้ไขประกาศ")) {
      await O.page.waitForTimeout(400);
      await safeFill(O.page.locator(".modal-card input.input"), NEW_TITLE, "ช่องหัวข้อประกาศ (แก้ไข)");
      await safeClick(O.page.locator(".modal-card button", { hasText: /บันทึกการแก้ไข/ }), "ปุ่มบันทึกการแก้ไขประกาศ");
      await O.page.waitForTimeout(1500);
    }
    check("แก้ไขแล้ว: รายการแสดงหัวข้อใหม่ ไม่มีหัวข้อเดิม", [
      await O.page.getByText(NEW_TITLE, { exact: true }).count() > 0, await O.page.getByText(OLD_TITLE, { exact: true }).count(),
    ], [true, 0]);
    let studentSeesNew = false;
    for (const n of (await apiCall(s1api, "GET", "/news")).body.data || []) {
      if (n.title === NEW_TITLE) studentSeesNew = true;
    }
    check("  นักศึกษาเห็นหัวข้อที่แก้แล้ว", studentSeesNew, true);

    if (await safeClick(rowOf(NEW_TITLE).getByRole("button", { name: "ลบประกาศ" }), "ปุ่มลบประกาศ")) {
      await O.page.waitForTimeout(400);
      await scanScreen(O.page, "กล่องยืนยันลบประกาศ");
      await safeClick(O.page.locator(".modal-card button", { hasText: /ลบประกาศนี้/ }), "ปุ่มยืนยันลบประกาศ");
      await O.page.waitForTimeout(1500);
    }
    check("ลบแล้ว: ประกาศหายจากรายการ", await O.page.getByText(NEW_TITLE, { exact: true }).count(), 0);
    let studentStillSees = false;
    for (const n of (await apiCall(s1api, "GET", "/news")).body.data || []) {
      if (n.title === NEW_TITLE) studentStillSees = true;
    }
    check("  นักศึกษาไม่เห็นประกาศที่ลบแล้ว", studentStillSees, false);
  });

  // ════════ 13. สร้างบัญชีผู้ช่วยตรวจสอบ ════════
  await section("13. สร้างบัญชีผู้ช่วยตรวจสอบ → เปลี่ยนรหัสครั้งแรก → เห็นแค่คิวตรวจ", async () => {
    const O = sessions.O;
    const USERNAME = `rv${STAMP}`;
    const TEMP_PASSWORD = `Temp#${STAMP}`;
    const NEW_PASSWORD = `New#${STAMP}ok`;
    await O.page.goto(FE + "/users");
    await O.page.waitForTimeout(1800);
    if (await safeClick(O.page.getByRole("button", { name: /เพิ่มผู้ใช้งาน/ }), "ปุ่มเพิ่มผู้ใช้งาน")) {
      await O.page.waitForTimeout(400);
      if (await safeClick(O.page.locator(".modal-card .select-trigger"), "ช่องเลือกบทบาท")) {
        await O.page.waitForTimeout(300);
        let option = O.page.locator(".select-option", { hasText: "ผู้ช่วยตรวจสอบ" });
        if (await option.count() === 0) {
          fail("ตัวเลือกบทบาทยังไม่ใช้ชื่อ 'ผู้ช่วยตรวจสอบ' — เลือกตัวเลือกที่มีคำว่า 'ตรวจสอบ' แทน");
          option = O.page.locator(".select-option", { hasText: "ตรวจสอบ" });
        }
        await safeClick(option, "ตัวเลือกบทบาทผู้ช่วยตรวจสอบ");
      }
      const field = (label) => O.page.locator(".modal-card .field", { hasText: label }).locator("input");
      await safeFill(field("รหัสผู้ใช้"), USERNAME, "ช่องรหัสผู้ใช้");
      await safeFill(field("รหัสผ่าน"), TEMP_PASSWORD, "ช่องรหัสผ่านชั่วคราว");
      await safeFill(field("ชื่อจริง"), "ผู้ช่วย", "ช่องชื่อจริง");
      await safeFill(field("นามสกุล"), "ตรวจทาน", "ช่องนามสกุล");
      await safeFill(field("อีเมล"), `${USERNAME}@psu.ac.th`, "ช่องอีเมล");
      await safeFill(field("เบอร์"), "0855555555", "ช่องเบอร์โทร");
      await scanScreen(O.page, "ฟอร์มเพิ่มผู้ใช้งาน");
      await safeClick(O.page.locator(".modal-card button", { hasText: /เพิ่มผู้ใช้งาน/ }), "ปุ่มบันทึกผู้ใช้งานใหม่");
      await O.page.waitForTimeout(1800);
    }
    let created = null;
    for (const u of (await apiCall(api, "GET", "/users")).body.data || []) {
      if (u.psu_passport_id === USERNAME) created = u;
    }
    check("สร้างบัญชีสำเร็จ บทบาท reviewer ต้องเปลี่ยนรหัส", [created ? created.role.role_name : null, created ? created.must_change_password : null], ["reviewer", true]);
    check("  บัญชีใหม่ขึ้นในตาราง", await O.page.getByText(USERNAME, { exact: true }).count() > 0, true);
    if (!created) return;

    sessions.NR = await openSession();
    const NR = sessions.NR;
    await uiLogin(NR.page, USERNAME, TEMP_PASSWORD);
    check("เข้าครั้งแรก -> บังคับเปลี่ยนรหัสผ่าน", await waitForText(NR.page, /ต้องเปลี่ยนรหัสผ่าน/), true);
    await scanScreen(NR.page, "หน้าบังคับเปลี่ยนรหัสผ่าน");
    const pw = NR.page.locator("input[type=password]");
    await safeFill(pw.nth(0), TEMP_PASSWORD, "ช่องรหัสผ่านชั่วคราว (เดิม)");
    await safeFill(pw.nth(1), NEW_PASSWORD, "ช่องรหัสผ่านใหม่");
    await safeFill(pw.nth(2), NEW_PASSWORD, "ช่องยืนยันรหัสผ่านใหม่");
    await safeClick(NR.page.getByRole("button", { name: /^เปลี่ยนรหัสผ่าน$/ }), "ปุ่มเปลี่ยนรหัสผ่าน");
    await NR.page.waitForTimeout(2500);
    check("เปลี่ยนรหัสแล้วกลับหน้าเข้าสู่ระบบ", await NR.page.locator("input[autocomplete=username]").count() > 0, true);
    await uiLogin(NR.page, USERNAME, NEW_PASSWORD);
    check("เข้าด้วยรหัสใหม่ -> หน้าคิวตรวจ", NR.page.url().endsWith("/review"), true);
    const navCount = await NR.page.locator("aside button.nav-item").count();
    const navText = await NR.page.locator("aside").innerText().catch(() => "");
    check("เมนูมีแค่คิวตรวจ 1 เมนู ไม่มีเมนูจัดการ", [navCount, navText.includes("จัดการผู้ใช้งาน"), navText.includes("ข้อมูลนักศึกษา")], [1, false, false]);
    const headerText = await NR.page.locator("header").innerText().catch(() => "");
    check("แถบบนแสดงบทบาท 'ผู้ช่วยตรวจสอบ'", headerText.includes("ผู้ช่วยตรวจสอบ"), true);
    await visitAndCheck(NR.page, "/review", "ผู้ช่วยตรวจสอบคนใหม่ คิวตรวจ");
    await NR.page.goto(FE + "/users");
    await NR.page.waitForTimeout(2200);
    check("พิมพ์ URL หน้าจัดการผู้ใช้งาน -> ถูกพากลับคิวตรวจ", NR.page.url().endsWith("/review"), true);
  });

  // ════════ 14. หน้าข้อมูลนักศึกษา ════════
  await section("14. หน้าข้อมูลนักศึกษา: ตัวนับ + แบ่งหน้า + ทุกเมนูส่งออกได้ไฟล์จริง", async () => {
    const O = sessions.O;
    const total = ((await apiCall(api, "GET", "/students")).body.data || []).length;
    const pages = Math.ceil(total / 10);
    await visitAndCheck(O.page, "/students", "เจ้าหน้าที่ ข้อมูลนักศึกษา (มีหลายหน้า)");
    const counter = async () => {
      const m = (await bodyText(O.page)).match(/แสดง\s*(\d+)\s*จาก\s*(\d+)\s*คน/);
      return m ? [Number(m[1]), Number(m[2])] : null;
    };
    check(`ตัวนับหน้าแรก "แสดง N จาก M คน" (ทั้งหมด ${total} คน)`, await counter(), [Math.min(10, total), total]);
    check("บอกเลขหน้า 'หน้า 1 จาก N'", await O.page.getByText(`หน้า 1 จาก ${pages}`).count() > 0, true);
    const firstRowBefore = await O.page.locator("tbody tr").first().innerText().catch(() => "");
    if (await safeClick(O.page.getByRole("button", { name: /ถัดไป/ }), "ปุ่มหน้าถัดไป")) {
      await O.page.waitForTimeout(600);
      check("หน้า 2: ตัวนับเพิ่มขึ้น + บอก 'หน้า 2'", [await counter(), await O.page.getByText(`หน้า 2 จาก ${pages}`).count() > 0], [[Math.min(20, total), total], true]);
      const firstRowAfter = await O.page.locator("tbody tr").first().innerText().catch(() => "");
      check("  รายชื่อหน้า 2 ไม่ซ้ำกับหน้า 1", firstRowAfter !== firstRowBefore && firstRowAfter !== "", true);
    }
    await safeFill(O.page.getByPlaceholder(/ค้นหาด้วยชื่อหรือรหัสนักศึกษา/), S1.id, "ช่องค้นหานักศึกษา");
    await O.page.waitForTimeout(600);
    check("ค้นหารหัส S1 -> 'แสดง 1 จาก 1 คน'", await counter(), [1, 1]);
    check(`  บอกจำนวนทั้งหมด (นักศึกษาทั้งหมด ${total} คน)`, (await bodyText(O.page)).includes(`ทั้งหมด ${total} คน`), true);
    await safeFill(O.page.getByPlaceholder(/ค้นหาด้วยชื่อหรือรหัสนักศึกษา/), "", "ล้างช่องค้นหา");
    await O.page.waitForTimeout(600);

    // ส่งออก: กดทีละเมนู ทุกเมนูต้องได้ไฟล์จริง (Excel ขึ้นต้น PK / PDF ขึ้นต้น %PDF)
    const exportButton = O.page.getByRole("button", { name: /ส่งออกข้อมูล/ });
    if (!(await safeClick(exportButton, "ปุ่มส่งออกข้อมูล"))) return;
    await O.page.waitForTimeout(300);
    const labels = await O.page.getByRole("menuitem").allInnerTexts();
    check("เมนูส่งออกมีอย่างน้อย 2 รายการ", labels.length >= 2, true);
    await O.page.keyboard.press("Escape");
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i].trim();
      await O.page.waitForTimeout(500);
      if (!(await safeClick(exportButton, `ปุ่มส่งออกข้อมูล (ก่อนกด "${label}")`))) continue;
      await O.page.waitForTimeout(300);
      const file = await downloadBy(O.page, O.page.getByRole("menuitem").nth(i), `ส่งออก "${label}"`);
      if (file) {
        check(`ส่งออก "${label}" -> ได้ไฟล์ ${file.name}`, looksLikeFile(file), true);
      }
    }
    await scanScreen(O.page, "หน้าข้อมูลนักศึกษาหลังส่งออก");
  });

  // ════════ 15. นำเข้าไฟล์ CSV หัวคอลัมน์ภาษาไทย ════════
  await section("15. นำเข้า CSV หัวคอลัมน์ภาษาไทย → ตรวจไฟล์ → ยืนยัน → บัญชีที่ยังไม่เข้าระบบ", async () => {
    const O = sessions.O;
    const csv = "﻿รหัสนักศึกษา,เลขบัตรประชาชน,ปีการศึกษาที่จบ\n" + `${IMPORTED.id},${IMPORTED.nid},${YEAR}\n`;
    const csvFile = { name: "รายชื่อนักศึกษา.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") };
    const pendingHas = async () => {
      for (const p of (await apiCall(api, "GET", "/students/pending-accounts")).body.data || []) {
        if (p.student_id === IMPORTED.id) return p;
      }
      return null;
    };
    await visitAndCheck(O.page, "/import", "เจ้าหน้าที่ นำเข้า (ก่อนเลือกไฟล์)");
    await safeSetFiles(O.page.locator("input[type=file]"), [csvFile], "เลือกไฟล์ CSV");
    await O.page.waitForTimeout(400);
    await safeClick(O.page.getByRole("button", { name: /ตรวจไฟล์/ }), "ปุ่มตรวจไฟล์");
    await O.page.waitForTimeout(2000);
    check("ตรวจไฟล์: สรุปว่า 'จะนำเข้า' + เห็นรหัสในไฟล์", [await O.page.getByText(/จะนำเข้า/).count() > 0, await O.page.getByText(IMPORTED.id).count() > 0], [true, true]);
    check("  ขั้นตรวจไฟล์ยังไม่บันทึกจริง", await pendingHas(), null);
    await scanScreen(O.page, "หน้าสรุปก่อนนำเข้า");
    await safeClick(O.page.getByRole("button", { name: /ยืนยันนำเข้า 1 คน/ }), "ปุ่มยืนยันนำเข้า 1 คน");
    await O.page.waitForTimeout(2000);
    check("ยืนยันแล้ว: ขึ้น 'นำเข้าสำเร็จ'", await O.page.getByText(/นำเข้าสำเร็จ/).count() > 0, true);
    const pending = await pendingHas();
    check("  หลังบ้าน: อยู่ในบัญชีที่ยังไม่เข้าระบบ ปีจบ 2595", pending ? pending.academic_year : null, YEAR);
    if (await safeClick(O.page.getByRole("button", { name: /บัญชีที่ยังไม่เข้าระบบ/ }), "แท็บบัญชีที่ยังไม่เข้าระบบ")) {
      await O.page.waitForTimeout(1500);
      await safeFill(O.page.getByPlaceholder(/ค้นหารหัสนักศึกษา/), IMPORTED.id, "ช่องค้นหาบัญชีที่ยังไม่เข้าระบบ");
      await O.page.waitForTimeout(500);
      check("แท็บบัญชีที่ยังไม่เข้าระบบแสดงรหัสที่เพิ่งนำเข้า", await O.page.getByText(IMPORTED.id).count() > 0, true);
      await scanScreen(O.page, "แท็บบัญชีที่ยังไม่เข้าระบบ");
    }
  });

  // ════════ 16. ผู้บริหาร ════════
  await section("16. ผู้บริหาร: เฉพาะภาพรวม + ดาวน์โหลดรายงาน", async () => {
    sessions.E = await openSession();
    const E = sessions.E;
    await uiLogin(E.page, "789", "789");
    for (const [urlPath, label] of [["/dashboard", "แดชบอร์ด"], ["/reports", "รายงาน"], ["/manual", "คู่มือ"]]) {
      await visitAndCheck(E.page, urlPath, `ผู้บริหาร ${label}`);
    }
    check("ผู้บริหารไม่มีเมนูข้อมูลนักศึกษารายคน", await E.page.locator("aside").getByText("ข้อมูลนักศึกษา").count(), 0);
    await E.page.goto(FE + "/reports");
    await E.page.waitForTimeout(2200);
    const pdfButton = E.page.getByRole("button", { name: /ดาวน์โหลด PDF/ });
    if (await waitUsable(pdfButton, "ปุ่มดาวน์โหลด PDF ของผู้บริหาร")) {
      const file = await downloadBy(E.page, pdfButton.first(), "ผู้บริหารดาวน์โหลดรายงาน PDF");
      check("ผู้บริหารดาวน์โหลดรายงาน PDF ได้", file ? file.name.endsWith(".pdf") && looksLikeFile(file) : false, true);
    }
  });

  // ════════ 17. สลับภาษาอังกฤษ ════════
  await section("17. สลับภาษา EN ทุกบทบาท → ทุกเมนูไม่พัง ไม่มีค่าหลุด", async () => {
    const roles = [["O", "เจ้าหน้าที่"], ["A", "นักศึกษา"], ["R", "ผู้ช่วยตรวจสอบ"], ["E", "ผู้บริหาร"]];
    for (const [key, roleLabel] of roles) {
      const session = sessions[key];
      if (!session) {
        fail(`EN ${roleLabel}: ไม่มีหน้าต่างของบทบาทนี้ (หัวข้อก่อนหน้าพัง)`);
        continue;
      }
      const page = session.page;
      await page.goto(FE + "/");
      await page.waitForTimeout(2000);
      if (!(await safeClick(page.getByRole("button", { name: "EN", exact: true }), `EN ${roleLabel}: ปุ่มสลับภาษา EN`))) continue;
      await page.waitForTimeout(900);
      const navButtons = page.locator("aside button.nav-item");
      const count = await navButtons.count();
      const problemPages = [];
      for (let i = 0; i < count; i++) {
        page.errors.length = 0;
        const name = (await navButtons.nth(i).innerText().catch(() => `เมนู ${i + 1}`)).trim();
        await navButtons.nth(i).click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(1500);
        const problems = problemsInText(await bodyText(page), FORBIDDEN_TEXT_EN);
        const notFound = await page.getByText("ไม่พบหน้าที่ต้องการ").count();
        if (problems.length > 0 || page.errors.length > 0 || notFound > 0) {
          problemPages.push(`${name}: ${problems.concat(page.errors.slice(0, 1)).join(", ")}${notFound ? " (ไม่พบหน้า)" : ""}`);
        }
      }
      check(`EN ${roleLabel}: ทุกเมนู (${count}) เปิดได้ ไม่มี undefined/รหัสข้อความหลุด`, problemPages, []);
      await shot(page, `06-en-${key}`);
      await tryClick(page.getByRole("button", { name: "TH", exact: true }));
      await page.waitForTimeout(600);
    }
  });

  // ════════ 18. URL ของบทบาทอื่น ════════
  await section("18. พิมพ์ URL ของบทบาทอื่นตรงๆ → ถูกพากลับหน้าเริ่มต้น", async () => {
    const cases = [
      ["E", "/students", "/dashboard", "ผู้บริหารเปิด /students"],
      ["R", "/users", "/review", "ผู้ช่วยตรวจสอบเปิด /users"],
      ["A", "/dashboard", "/news", "นักศึกษาเปิด /dashboard"],
      ["A", "/users", "/news", "นักศึกษาเปิด /users"],
    ];
    for (const [key, target, expected, label] of cases) {
      const session = sessions[key];
      if (!session) {
        fail(`${label}: ไม่มีหน้าต่างของบทบาทนี้`);
        continue;
      }
      await session.page.goto(FE + target);
      await session.page.waitForTimeout(2200);
      const finalPath = new URL(session.page.url()).pathname;
      const notFound = await session.page.getByText("ไม่พบหน้าที่ต้องการ").count();
      check(`${label} -> ถูกพาไป ${expected}`, [finalPath, notFound], [expected, 0]);
    }
  });

  // ════════ 19. ออกจากระบบ ════════
  await section("19. ออกจากระบบ (มือถือ) → กลับหน้าเข้าสู่ระบบ ใช้งานต่อไม่ได้", async () => {
    const M = sessions.M;
    if (!M) {
      fail("ออกจากระบบ: ไม่มีหน้าต่างของ S2");
      return;
    }
    await M.page.goto(FE + "/news");
    await M.page.waitForTimeout(2000);
    // ปุ่มเมนูผู้ใช้ = ปุ่มในกล่องสุดท้ายของแถบบน
    if (await safeClick(M.page.locator("header > div:last-child > button"), "ปุ่มเมนูผู้ใช้")) {
      await M.page.waitForTimeout(400);
      await safeClick(M.page.getByRole("button", { name: /ออกจากระบบ/ }), "ปุ่มออกจากระบบ");
      await M.page.waitForTimeout(2000);
    }
    check("ออกแล้วอยู่หน้าเข้าสู่ระบบ", [M.page.url().includes("/login"), await M.page.locator("input[autocomplete=username]").count() > 0], [true, true]);
    const stored = await M.page.evaluate(() => localStorage.getItem("nursing_user"));
    check("  ข้อมูลผู้ใช้ในเครื่องถูกล้าง", stored, null);
    await M.page.goto(FE + "/status");
    await M.page.waitForTimeout(2000);
    check("  เปิด /status ตรงๆ หลังออก -> ยังอยู่หน้าเข้าสู่ระบบ", await M.page.locator("input[autocomplete=username]").count() > 0, true);
    const me = await apiCall(M.context.request, "GET", "/auth/me");
    check("  หลังบ้านไม่รับเซสชันเดิมแล้ว (401)", me.status, 401);
  });
} finally {
  await browser.close();
  console.log(`\nภาพหน้าจออยู่ที่: ${OUT_DIR}`);
}

console.log("\nสรุปรายหัวข้อ (จำนวน FAIL):");
for (const item of sectionSummary) {
  console.log(`  ${item.fails === 0 ? "ผ่าน " : "ไม่ผ่าน"}  ${item.title}  (${item.fails})`);
}
if (toastCovers.length > 0) {
  console.log(`\nข้อสังเกต UX: แจ้งเตือนเด้งบังปุ่ม ${toastCovers.length} ครั้ง — ${toastCovers.join(" · ")}`);
}
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
