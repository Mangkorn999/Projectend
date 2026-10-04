// รัน smoke test ทั้งชุดบนฐานข้อมูลสะอาด — ไม่แตะข้อมูล demo ที่ใช้อยู่
//
// ปัญหาที่สคริปต์นี้แก้:
//   `npm test` ยิงใส่ DB ตัวที่ใช้ทำ demo อยู่ (มีนักศึกษา 900+ คน, มีรอบเปิดค้าง)
//   เทสหลายตัวเขียนคาดว่า "ต้องมีนักศึกษา 1 คน" / "ต้องเปิดรอบใหม่ได้" เลย fail ทั้งที่โค้ดไม่ได้พัง
//   → แยกไม่ออกว่าอันไหนบัคจริง อันไหนแค่ข้อมูลไม่สะอาด
//
// วิธีแก้: สร้าง PostgreSQL schema ชื่อ verify_tmp ขึ้นมาใหม่ทั้งก้อน
//   (schema ≈ "โฟลเดอร์ตาราง" ใน database เดียวกัน — ไม่ต้องมีสิทธิ์ CREATE DATABASE
//    ซึ่ง user ของเราไม่มี นี่คือเหตุผลที่ prisma migrate dev ใช้ไม่ได้)
//   แล้ว migrate + seed + รัน server ชั่วคราวชี้ไปที่ schema นั้น พอเสร็จก็ลบทิ้ง
//
// วิธีรัน:  npm run test:clean
//
// หมายเหตุ: ต้องไม่มี server ตัวอื่นจองพอร์ต TEST_PORT อยู่

import { spawn } from "child_process";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

// เปลี่ยนได้ผ่าน env เพื่อรันหลายชุดพร้อมกันโดยไม่ชนกัน เช่น TEST_SCHEMA=verify_b TEST_PORT=3101 npm run test:clean
const TEST_SCHEMA = process.env.TEST_SCHEMA || "verify_tmp";
const TEST_PORT = Number(process.env.TEST_PORT) || 3100;
const BASE = `http://localhost:${TEST_PORT}`;

// รายชื่อไฟล์เทสตามลำดับที่ต้องรัน (เรียงตาม phase เหมือนใน package.json)
const ALL_TEST_FILES = [
  "tests/smoke-phase1-3.mjs",
  "tests/smoke-phase4-6.mjs",
  "tests/smoke-phase9-import.mjs",
  "tests/smoke-phase10-round-subjects.mjs",
  "tests/smoke-phase11-carry-forward.mjs",
  "tests/smoke-phase12-reject-edit.mjs",
  "tests/smoke-phase13-duplicate-round.mjs",
  "tests/smoke-phase14-news-scope.mjs",
  "tests/smoke-phase15-reviewer.mjs",
  "tests/smoke-phase16-cohort-year.mjs",
  "tests/smoke-phase17-import-year.mjs",
  "tests/smoke-phase18-round-dates.mjs",
  "tests/smoke-phase19-guards.mjs",
  "tests/smoke-phase20-hardening.mjs",
  "tests/smoke-phase21-pending-accounts.mjs",
  "tests/smoke-phase22-exports.mjs",
  "tests/smoke-phase23-delete-user.mjs",
  "tests/smoke-phase24-lifecycle.mjs",
  "tests/smoke-phase25-real-flow.mjs",
  "tests/smoke-phase26-edge-cases.mjs",
  "tests/smoke-phase27-security.mjs",
  "tests/smoke-phase28-actor.mjs",
  "tests/smoke-phase29-round-stats.mjs",
  "tests/smoke-phase30-role-matrix.mjs",
  "tests/smoke-phase31-round3-guards.mjs",
];

// รันเฉพาะไฟล์ที่ชื่อมีคำนี้: ONLY=phase24 npm run test:clean (ไม่ใส่ = รันทุกไฟล์)
const TEST_FILES = process.env.ONLY
  ? ALL_TEST_FILES.filter((f) => f.includes(process.env.ONLY))
  : ALL_TEST_FILES;

// ── เตรียม URL ของ DB ชั่วคราว ────────────────────────────────
// เอา DATABASE_URL เดิมมาต่อท้ายด้วย ?schema=verify_tmp
// (ถ้ามี ? อยู่แล้วต้องใช้ & แทน — URL object จัดการให้เองไม่ต้องเช็คเอง)
function buildTestUrl(originalUrl) {
  const url = new URL(originalUrl);
  url.searchParams.set("schema", TEST_SCHEMA);
  return url.toString();
}

// ── รันคำสั่งภายนอกแล้วรอจนจบ ────────────────────────────────
// คืนค่า exit code (0 = สำเร็จ)
function run(command, args, env, { quiet = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      // shell: true จำเป็นบน Windows ไม่งั้นเรียก npx ไม่เจอ
      shell: true,
      stdio: quiet ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    if (quiet) {
      child.stdout.on("data", () => {});
      child.stderr.on("data", () => {});
    }
    child.on("close", (code) => resolve(code ?? 1));
  });
}

// ── รอจน server ชั่วคราวพร้อมรับ request ─────────────────────
async function waitForServer(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      // ตอบอะไรกลับมาก็ถือว่าขึ้นแล้ว — ไม่เช็ค res.ok
      // endpoint นี้ต้อง login แล้ว (401) ซึ่งก็แปลว่า server รับ request ได้เป็นปกติ
      // ถ้าเช็ค res.ok จะรอจนหมดเวลาแล้วคิดว่า server ไม่ขึ้น
      await fetch(`${BASE}/api/rooms`);
      return true;
    } catch {
      // ต่อไม่ได้เลย = server ยังไม่ขึ้น รอแล้วลองใหม่
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// ── เปิด server ชั่วคราว ─────────────────────────────────────
// คืน object ที่มี .kill() ไว้ปิด และ .log() ไว้ดูว่ามันพ่นอะไรออกมา
async function startServer(testEnv) {
  const proc = spawn("node", ["src/server.js"], {
    env: { ...process.env, ...testEnv, PORT: String(TEST_PORT) },
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  proc.stdout.on("data", (d) => (output += d));
  proc.stderr.on("data", (d) => (output += d));

  if (!(await waitForServer())) {
    proc.kill();
    throw new Error(`server ไม่ขึ้นใน 30 วินาที\n${output}`);
  }
  return { proc, log: () => output };
}

// ── ปิด server แล้วรอจนพอร์ตว่างจริง ─────────────────────────
// ถ้าเปิดตัวใหม่เร็วเกินไปจะชนพอร์ตเดิมที่ยังปิดไม่เสร็จ
async function stopServer(server) {
  if (!server) return;

  // บน Windows spawn ด้วย shell: true = ได้ process ของ cmd ครอบ node อีกที
  // proc.kill() จะฆ่าแค่ cmd ตัวนอก ส่วน node ข้างในรอดแล้วจองพอร์ตต่อ
  // taskkill /T สั่งฆ่าทั้งต้นไม้ (ตัวมันเอง + ลูกทั้งหมด) /F = บังคับ
  if (process.platform === "win32") {
    await run("taskkill", ["/PID", String(server.proc.pid), "/T", "/F"], {}, {
      quiet: true,
    });
  } else {
    server.proc.kill();
  }

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      await fetch(`${BASE}/api/rooms`);
    } catch {
      return; // ต่อไม่ได้แล้ว = ปิดสนิท
    }
    await new Promise((r) => setTimeout(r, 200));
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
    console.error("ไม่พบ DATABASE_URL — ต้องรันด้วย: npm run test:clean");
    process.exit(1);
  }

  // กันเคสที่เจ็บที่สุด: มี server ค้างจากรอบก่อนจองพอร์ตนี้อยู่
  // ถ้าปล่อยผ่าน server ตัวใหม่จะ bind ไม่ได้ แต่ waitForServer จะเห็นว่า "ต่อได้" เพราะตัวเก่าตอบแทน
  // → เทสทั้งชุดวิ่งไปคุยกับ server ตัวเก่าที่ชี้ไป schema ซึ่งถูกลบไปแล้ว แล้ว fail แบบงงๆ ทั้ง 11 ไฟล์
  try {
    await fetch(`${BASE}/api/rooms`);
    console.error(
      `\nมี server ค้างอยู่ที่พอร์ต ${TEST_PORT} แล้ว — ปิดก่อนแล้วค่อยรันใหม่\n` +
        `  Windows:  netstat -ano | findstr :${TEST_PORT}   แล้ว  taskkill /PID <เลข> /T /F`,
    );
    process.exit(1);
  } catch {
    // ต่อไม่ได้ = พอร์ตว่าง ถูกต้องแล้ว
  }

  const testUrl = buildTestUrl(process.env.DATABASE_URL);
  // SUPABASE_DATABASE_URL ว่าง = server ทดสอบไม่คัดลอกข้อมูลเทสขึ้น Supabase เด็ดขาด (กันอีกชั้นนอกจากเช็ค schema)
  const testEnv = { DATABASE_URL: testUrl, SUPABASE_DATABASE_URL: "" };

  // client ตัวนี้ชี้ไป schema เดิม (public) — ใช้แค่สั่ง CREATE/DROP SCHEMA เท่านั้น
  const admin = new PrismaClient();
  let server = null;

  // เทสอัปโหลดไฟล์จริงลง uploads/ (PDF หลักฐาน, รูปประกาศ) แล้ว schema ทดสอบถูกลบทิ้ง แต่ไฟล์ไม่ถูกลบตาม
  // → เก็บรายชื่อไฟล์ก่อนรัน แล้วตอนจบลบเฉพาะไฟล์ "ใหม่" ที่ไม่มีแถวในฐานข้อมูลจริงอ้างถึง
  const uploadDirs = ["uploads/certificates", "uploads/news"].map((d) => path.resolve(d));
  const filesBefore = new Map(uploadDirs.map((d) => [d, new Set(fs.existsSync(d) ? fs.readdirSync(d) : [])]));

  try {
    console.log(`\n[1/4] สร้าง schema ${TEST_SCHEMA} ใหม่`);
    // ลบก่อนเผื่อรอบที่แล้วค้างไว้ (เช่นกด Ctrl+C กลางคัน)
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${TEST_SCHEMA}"`);

    console.log(`[2/4] migrate`);
    const migrateCode = await run("npx", ["prisma", "migrate", "deploy"], testEnv, {
      quiet: true,
    });
    if (migrateCode !== 0) throw new Error("prisma migrate deploy ล้มเหลว");

    console.log(`[3/4] seed`);
    const seedCode = await run("node", ["prisma/seed.js"], testEnv, { quiet: true });
    if (seedCode !== 0) throw new Error("seed ล้มเหลว");

    console.log(`[4/4] รันเทส ${TEST_FILES.length} ไฟล์ (พอร์ต ${TEST_PORT})\n`);
    const failed = [];
    for (const file of TEST_FILES) {
      // เปิด server ใหม่ก่อนทุกไฟล์ — ไม่ใช่เปิดทิ้งไว้ตัวเดียวรันยาว
      //
      // เหตุผล: rate limiter เก็บจำนวนครั้งที่ login ไว้ใน memory ของ process
      // (ดู middlewares/rateLimit.js — officer ยิง login ได้ 10 ครั้ง/15 นาที)
      // เทสทุกไฟล์ login ด้วยบัญชี officer ตัวเดียวกัน พอรันติดกัน 11 ไฟล์
      // ไฟล์ท้ายๆ จะโดน 429 "ลองมากเกินไป" ทั้งที่โค้ดไม่ได้พัง
      // เปิด process ใหม่ = ตัวนับเริ่มจาก 0 ใหม่ (ข้อมูลใน DB ยังอยู่เหมือนเดิม)
      server = await startServer(testEnv);

      // ไม่ใช้ && ต่อกันเหมือน npm test — ไฟล์ไหนพังก็ให้ไฟล์ที่เหลือรันต่อ
      // จะได้เห็นภาพรวมทั้งชุดในรอบเดียว ไม่ต้องไล่แก้ทีละอัน
      const code = await run("node", [file], { ...testEnv, BASE });
      if (code !== 0) failed.push(file);

      await stopServer(server);
      server = null;
      console.log("");
    }

    console.log("═".repeat(60));
    if (failed.length === 0) {
      console.log(`ผ่านทั้งหมด ${TEST_FILES.length} ไฟล์`);
    } else {
      console.log(`ไม่ผ่าน ${failed.length}/${TEST_FILES.length} ไฟล์:`);
      for (const f of failed) console.log(`  - ${f}`);
    }
    console.log("═".repeat(60));

    process.exitCode = failed.length === 0 ? 0 : 1;
  } finally {
    // ต้องเก็บกวาดเสมอ ถึงจะพังกลางทางก็ตาม ไม่งั้น schema ค้างไว้ในฐานข้อมูล
    await stopServer(server);
    const ownFiles = await findUploadsOfSchema(admin, TEST_SCHEMA);
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    try {
      // ไฟล์ที่ฐานข้อมูลจริง (public) ยังอ้างถึงอยู่ ห้ามลบเด็ดขาด
      const inUse = new Set([
        ...(await admin.certificate.findMany({ select: { file_path: true } })).map((r) => path.basename(r.file_path)),
        ...(await admin.news.findMany({ select: { image_path: true } })).map((r) => path.basename(r.image_path ?? "")),
      ]);
      let removed = 0;
      for (const name of ownFiles) {
        if (inUse.has(name)) continue;
        for (const dir of uploadDirs) {
          const full = path.join(dir, name);
          if (fs.existsSync(full)) { fs.rmSync(full, { force: true }); removed++; }
        }
      }
      console.log(`ลบไฟล์อัปโหลดที่เทสสร้างค้างไว้ ${removed} ไฟล์`);
    } catch (e) {
      console.log("เก็บกวาดไฟล์อัปโหลดไม่สำเร็จ (ไม่กระทบผลเทส):", e.message);
    }
    await admin.$disconnect();
    console.log(`ลบ schema ${TEST_SCHEMA} แล้ว`);
  }
}

main();
