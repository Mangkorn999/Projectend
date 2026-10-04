// สร้างไฟล์โปสเตอร์จาก poster.html
//   node docs/poster/render.mjs            → poster.pdf (A0) + poster.png (4200x5940)
//   node docs/poster/render.mjs preview    → preview.png (เล็ก ไว้ดูเร็ว)
// ต้องมี Chrome ในเครื่อง + ต่อเน็ต (โหลดฟอนต์ LINE Seed Sans TH) · ใช้ playwright-core จาก backend/node_modules
import { createRequire } from "module";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(here, "../../backend/package.json"));
const { chromium } = require("playwright-core");

const preview = process.argv[2] === "preview";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 2100, height: 2970 }, deviceScaleFactor: preview ? 0.5 : 2 });
await page.goto(pathToFileURL(path.join(here, "poster.html")).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);

// เช็คว่าไม่มีกล่องไหนล้น (ข้อความเกินกรอบ)
const overflow = await page.evaluate(() =>
  [...document.querySelectorAll(".card,.sum,.contact,.col")].map((el) => ({
    cls: el.className, bottom: Math.round(el.getBoundingClientRect().bottom), scrollH: el.scrollHeight, clientH: el.clientHeight,
  }))
);
console.log(JSON.stringify(overflow));

if (preview) {
  await page.screenshot({ path: path.join(here, "preview.png") });
} else {
  await page.screenshot({ path: path.join(here, "poster.png") });
  // 841 มม. = 3178 px ที่ 96 dpi → ขยาย 3178/2100 = 1.513 เท่า
  await page.pdf({ path: path.join(here, "poster.pdf"), width: "841mm", height: "1189mm", scale: 3178 / 2100, printBackground: true, pageRanges: "1" });
}
await browser.close();
console.log("เสร็จ", preview ? "preview.png" : "poster.pdf + poster.png");
