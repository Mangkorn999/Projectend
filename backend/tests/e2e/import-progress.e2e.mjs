// เทสหน้านำเข้ารายชื่อตอนนำเข้าจำนวนมาก (6 ต.ค. 2569) — ต้องมีแถบ "กำลังนำเข้า" + กดซ้ำไม่ได้ + มีสรุปผลหลังเสร็จ
//
// รันผ่าน:  npm run test:e2e:import   (ฐานข้อมูลชั่วคราว ไม่แตะข้อมูลจริง)
// นำเข้า 300 แถวผ่านหน้าจอ (ใช้เวลา ~20 วินาที เพราะระบบ hash รหัสผ่านทีละคน) แล้วตรวจ:
//   1. กด "ตรวจไฟล์" → เห็นสรุป 300 คน ยังไม่บันทึก
//   2. กด "ยืนยันนำเข้า" แล้วกดซ้ำรัวๆ → ระหว่างทำงานเห็นแถบ "กำลังนำเข้ารายชื่อ 300 คน" + เวลาที่ผ่านไปเดินขึ้น + ปุ่มกดไม่ได้
//   3. เสร็จแล้วแถบหาย มีสรุปผล และในระบบมีบัญชี 300 บัญชีพอดี (ไม่ซ้ำจากการกดซ้ำ)
import { chromium } from "playwright-core";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import os from "os";
import path from "path";

const FE = process.env.FE || "http://localhost:5175";
const prisma = new PrismaClient();
let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
  return ok;
};
const OUT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "nurse-import-"));
const COUNT = 300;
const PREFIX = "93"; // ปีจบ 2597

const lines = ["รหัสนักศึกษา,เลขบัตรประชาชน"];
for (let i = 1; i <= COUNT; i++) lines.push(`${PREFIX}${String(i).padStart(8, "0")},${"3" + String(i).padStart(12, "0")}`);
const csvFile = { name: "นำเข้าทดสอบ.csv", mimeType: "text/csv", buffer: Buffer.from("\ufeff" + lines.join("\n"), "utf8") };

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.goto(FE + "/", { waitUntil: "domcontentloaded" });
  await page.fill("input[autocomplete=username]", "456");
  await page.fill("input[autocomplete=current-password]", "456");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2500);
  await page.goto(FE + "/import", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);

  await page.locator("input[type=file]").first().setInputFiles(csvFile);
  await page.getByRole("button", { name: /ตรวจไฟล์/ }).click();
  await page.waitForTimeout(2500);
  const confirmBtn = page.getByRole("button", { name: /ยืนยันนำเข้า/ });
  check("ตรวจไฟล์แล้วเห็นปุ่ม 'ยืนยันนำเข้า 300 คน'", (await confirmBtn.innerText()).includes("300"), true);
  check("ก่อนกดยืนยัน ยังไม่มีแถบกำลังนำเข้า", await page.getByText(/กำลังนำเข้ารายชื่อ/).count(), 0);
  check("ก่อนกดยืนยัน ในระบบยังไม่มีบัญชีที่นำเข้า", await prisma.user.count({ where: { psu_passport_id: { startsWith: PREFIX } } }), 0);

  // กดยืนยัน แล้วพยายามกดซ้ำรัวๆ (ปุ่มต้องถูกปิดทันที)
  await confirmBtn.click();
  await page.waitForTimeout(600);
  const notice = page.getByText(/กำลังนำเข้ารายชื่อ 300 คน/);
  check("ระหว่างนำเข้า: เห็นแถบ 'กำลังนำเข้ารายชื่อ 300 คน'", await notice.count(), 1);
  const bodyDuring = await page.locator("body").innerText();
  check("  แถบบอกเวลาโดยประมาณและให้รอ ไม่ต้องกดซ้ำ", [/ประมาณ \d+ วินาที/.test(bodyDuring), bodyDuring.includes("ไม่ต้องกดซ้ำ")], [true, true]);
  const importingBtn = page.getByRole("button", { name: /กำลังนำเข้า…/ });
  check("  ปุ่มเปลี่ยนเป็น 'กำลังนำเข้า…' และกดไม่ได้", [await importingBtn.count(), await importingBtn.first().isDisabled()], [1, true]);
  await importingBtn.first().click({ force: true, timeout: 1500 }).catch(() => {}); // พยายามกดซ้ำ
  await importingBtn.first().click({ force: true, timeout: 1500 }).catch(() => {});
  await page.screenshot({ path: path.join(OUT_DIR, "importing.png") });
  await page.waitForTimeout(3000);
  check("  เวลาที่ผ่านไปเดินขึ้น (มีข้อความ 'ผ่านไปแล้ว N วินาที')", /ผ่านไปแล้ว [1-9]\d* วินาที/.test(await page.locator("body").innerText()), true);

  // รอให้เสร็จ (ไม่เกิน 3 นาที)
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline && (await notice.count()) > 0) await page.waitForTimeout(1000);
  await page.waitForTimeout(800);
  check("เสร็จแล้ว: แถบกำลังนำเข้าหายไป", await notice.count(), 0);
  const after = await page.locator("body").innerText();
  check("  มีสรุปผลการนำเข้า 300 คน", /300/.test(after) && /(นำเข้าสำเร็จ|นำเข้า)/.test(after), true);
  await page.screenshot({ path: path.join(OUT_DIR, "done.png") });
  check("ในระบบมีบัญชีที่นำเข้า 300 บัญชีพอดี (กดซ้ำไม่ทำให้ซ้ำ)", await prisma.user.count({ where: { psu_passport_id: { startsWith: PREFIX } } }), COUNT);
  await context.close();
} catch (err) {
  failures++;
  console.error(err);
}
await browser.close();
await prisma.$disconnect();
console.log("\nภาพหน้าจออยู่ที่: " + OUT_DIR);
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
