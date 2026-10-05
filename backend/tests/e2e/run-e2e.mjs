// รันเทสผ่านหน้าเว็บจริง บนฐานข้อมูลชั่วคราว — ไม่แตะข้อมูล demo/ข้อมูลจริง
//
// วิธีรัน:  npm run test:e2e        (จากโฟลเดอร์ backend/)
// ต้องมี:   Google Chrome ติดตั้งในเครื่อง (ใช้ Chrome จริงของเครื่อง ไม่ต้องดาวน์โหลด browser เพิ่ม)
//
// สคริปต์ทำ 5 ขั้น:
//   1. สร้าง PostgreSQL schema ชื่อ verify_e2e ใหม่ (เหมือน test:clean แต่คนละชื่อ จะได้ไม่ชนกัน)
//   2. migrate + seed (มีบัญชี 456 / 789 / 321 และรายวิชาให้)
//   3. เปิด backend พอร์ต 3200 + frontend พอร์ต 5175 ชี้ไปที่ schema นั้น
//   4. รัน real-flow.e2e.mjs
//   5. ปิดทุกอย่าง + ลบ schema + ลบไฟล์อัปโหลดที่เทสสร้าง
import { spawn } from "child_process";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const SCHEMA = "verify_e2e";
const API_PORT = 3200;
const WEB_PORT = 5175;
const API = `http://localhost:${API_PORT}/api`;
const FE = `http://localhost:${WEB_PORT}`;
const FRONTEND_DIR = path.resolve("../frontend");

// รันคำสั่งแล้วรอจนจบ คืน exit code (0 = สำเร็จ)
function run(command, args, env, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env: { ...process.env, ...env }, cwd, shell: true, stdio: "inherit" });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

// เปิดโปรแกรมทิ้งไว้ (server) — เก็บข้อความที่มันพิมพ์ไว้ดูตอนพัง
function start(command, args, env, cwd) {
  const proc = spawn(command, args, { env: { ...process.env, ...env }, cwd, shell: true, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  proc.stdout.on("data", (d) => (output += d));
  proc.stderr.on("data", (d) => (output += d));
  return { proc, log: () => output };
}

// รอจน URL ตอบได้ (ตอบอะไรก็ได้ = ขึ้นแล้ว)
async function waitFor(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return true;
    } catch {
      // ยังไม่ขึ้น รอแล้วลองใหม่
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// Windows: ต้องฆ่าทั้งต้นไม้ของ process (cmd ครอบ node อีกชั้น) ไม่งั้นพอร์ตค้าง
async function stop(server) {
  if (!server) return;
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const k = spawn("taskkill", ["/PID", String(server.proc.pid), "/T", "/F"], { shell: true, stdio: "ignore" });
      k.on("close", resolve);
    });
  } else {
    server.proc.kill();
  }
}


// ไฟล์อัปโหลดที่ "ฐานข้อมูลทดสอบชุดนี้" อ้างถึง — เรียกก่อนลบ schema
// ลบเฉพาะไฟล์ของชุดตัวเอง: เทสหลายชุดรันพร้อมกันได้โดยไม่ลบไฟล์ของกันและกัน
// (เดิมลบ "ไฟล์ใหม่ทุกไฟล์ที่ฐานข้อมูลจริงไม่อ้างถึง" → ชุดที่จบก่อนลบไฟล์ของชุดที่ยังรันอยู่)
async function findUploadsOfSchema(admin, schema) {
  const names = [];
  try {
    const certs = await admin.$queryRawUnsafe(`SELECT file_path FROM "${schema}"."certificates"`);
    for (const row of certs) names.push(path.basename(row.file_path));
    const news = await admin.$queryRawUnsafe(`SELECT image_path FROM "${schema}"."news" WHERE image_path IS NOT NULL`);
    for (const row of news) names.push(path.basename(row.image_path));
  } catch {
    // schema ยังไม่ถูกสร้าง (พังตั้งแต่ต้น) = ไม่มีไฟล์ให้ลบ
  }
  return names;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("ไม่พบ DATABASE_URL — ต้องรันด้วย: npm run test:e2e");
    process.exit(1);
  }
  for (const url of [`${API}/rooms`, FE]) {
    try {
      await fetch(url);
      console.error(`พอร์ตของ ${url} ถูกใช้งานอยู่ — ปิดโปรแกรมที่ใช้พอร์ตนั้นก่อน`);
      process.exit(1);
    } catch {
      // ว่าง ถูกต้อง
    }
  }

  const testUrl = new URL(process.env.DATABASE_URL);
  testUrl.searchParams.set("schema", SCHEMA);
  const testEnv = { DATABASE_URL: testUrl.toString() };

  const admin = new PrismaClient();
  const uploadDirs = ["uploads/certificates", "uploads/news"].map((d) => path.resolve(d));
  const filesBefore = new Map();
  for (const dir of uploadDirs) {
    filesBefore.set(dir, new Set(fs.existsSync(dir) ? fs.readdirSync(dir) : []));
  }

  let backend = null;
  let frontend = null;
  let exitCode = 1;
  try {
    console.log(`[1/5] สร้าง schema ${SCHEMA}`);
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${SCHEMA}"`);

    console.log("[2/5] migrate + seed");
    if ((await run("npx", ["prisma", "migrate", "deploy"], testEnv)) !== 0) throw new Error("migrate ล้มเหลว");
    if ((await run("node", ["prisma/seed.js"], testEnv)) !== 0) throw new Error("seed ล้มเหลว");

    // --demo = ใส่ข้อมูลขนาดจริง 5 รุ่น (~900 คน) ด้วย seedDemoYears.js เพื่อวัดประสิทธิภาพ (ลงใน schema ชั่วคราวเท่านั้น)
    if (process.argv.includes("--demo")) {
      console.log("      ใส่ข้อมูลจำลอง 5 รุ่น (seedDemoYears)");
      if ((await run("node", ["prisma/seedDemoYears.js"], testEnv)) !== 0) throw new Error("seedDemoYears ล้มเหลว");
    }
    console.log(`[3/5] เปิด backend :${API_PORT} + frontend :${WEB_PORT}`);
    backend = start("node", ["src/server.js"], { ...testEnv, PORT: String(API_PORT), CORS_ORIGIN: FE });
    frontend = start("npx", ["vite", "--port", String(WEB_PORT), "--strictPort"], { VITE_API_BASE: API }, FRONTEND_DIR);
    if (!(await waitFor(`${API}/rooms`))) throw new Error(`backend ไม่ขึ้น\n${backend.log()}`);
    if (!(await waitFor(FE))) throw new Error(`frontend ไม่ขึ้น\n${frontend.log()}`);

    console.log("[4/5] รันเทสผ่านหน้าเว็บ\n");
    // E2E_FILE เลือกไฟล์เทสได้ (ค่าเริ่มต้น = real-flow) เช่น tests/e2e/lifecycle.e2e.mjs
    const testFile = process.argv[2] || process.env.E2E_FILE || "tests/e2e/real-flow.e2e.mjs";
    exitCode = await run("node", [testFile], { ...testEnv, FE, API });
  } catch (err) {
    console.error(err.message);
  } finally {
    console.log("\n[5/5] ปิดเซิร์ฟเวอร์ + ลบข้อมูลทดสอบ");
    await stop(backend);
    await stop(frontend);
    const ownFiles = await findUploadsOfSchema(admin, SCHEMA);
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    // ไฟล์ที่ฐานข้อมูลจริงอ้างถึงห้ามลบ (ชื่อไฟล์สุ่ม แทบไม่มีทางซ้ำ แต่เช็คไว้ให้แน่ใจ)
    const realCerts = await admin.certificate.findMany({ select: { file_path: true } });
    const realNews = await admin.news.findMany({ select: { image_path: true } });
    const usedNames = new Set();
    for (const c of realCerts) usedNames.add(path.basename(c.file_path));
    for (const n of realNews) {
      if (n.image_path) usedNames.add(path.basename(n.image_path));
    }
    for (const name of ownFiles) {
      if (usedNames.has(name)) continue;
      for (const dir of uploadDirs) {
        fs.rmSync(path.join(dir, name), { force: true });
      }
    }
    await admin.$disconnect();
  }
  process.exit(exitCode);
}

main();
