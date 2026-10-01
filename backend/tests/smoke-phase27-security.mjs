// เทสความปลอดภัย (security review 2026-10-01) — ยิง API จริงบน schema ชั่วคราวเท่านั้น
//
// เน้นของที่เพิ่งเปลี่ยน:
//   1. ไฟล์หลักฐานหลายไฟล์ (PDF/JPG/PNG สูงสุด 5 ไฟล์ต่อใบ) + ลบไฟล์ (DELETE /api/certificates/:id)
//      - แนบ/ลบไฟล์ในใบของคนอื่น, ใบที่ยืนยันแล้ว, ใบรอตรวจหลังปิดรอบ ไม่ได้
//      - ใบที่ถูกตีกลับของ "รอบเก่า" (มีรอบใหม่กว่าแล้ว) แนบ/ลบไฟล์ไม่ได้ — ต้องตรงกับกฎตอนส่งผล (findSubmittableRound)
//      - กดแนบพร้อมกันหลายไฟล์ ต้องไม่เกิน 5 ไฟล์
//      - ไฟล์ที่ถูกปฏิเสธทุกกรณีต้องไม่ค้างอยู่บน disk
//      - เปิดไฟล์: ชนิดไฟล์มาจากเนื้อไฟล์จริง + nosniff, คนที่ไม่มีสิทธิ์เปิดไม่ได้
//   2. ไฟล์ส่งออก (export-first-year / export-first-attempt / export / students/export) — เจ้าหน้าที่เท่านั้น
//      และไม่มีเลขบัตรประชาชน / รหัสผ่านที่เข้ารหัสแล้ว
//   3. ข้อความ error ไม่เผยชื่อตาราง/คอลัมน์/คำเทคนิค
//   4. role อ่านจากฐานข้อมูล ไม่เชื่อค่าใน token หรือใน body
//
// รุ่นทดสอบ 2597 (รหัสขึ้นต้น 93) — ลบทิ้งด้วย cleanupYears ตอนจบเสมอ
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import readXlsxFile from "read-excel-file/node";
import { cleanupYears } from "./cleanupYears.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
let failures = 0;

// ── ตัวช่วยยิง API ───────────────────────────────────────────
const call = async (method, url, { token, body, form } = {}) => {
  const headers = {};
  if (token) {
    headers.Cookie = token;
  }
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${url}`, { method, headers, body: payload });
  const type = res.headers.get("content-type") || "";
  let json = {};
  let buffer = null;
  if (/spreadsheetml|pdf|image\//.test(type)) {
    buffer = Buffer.from(await res.arrayBuffer());
  } else {
    json = await res.json().catch(() => ({}));
  }
  const setCookie = res.headers.get("set-cookie");
  let cookie = null;
  if (setCookie) {
    cookie = setCookie.split(";")[0];
  }
  return { status: res.status, json, buffer, type, headers: res.headers, cookie };
};

const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
  }
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
};

// ข้อความที่ผู้ใช้เห็นต้องเป็นภาษาไทย และไม่มีคำเทคนิค/ชื่อตาราง/ชื่อคอลัมน์
const TECH_WORDS = /prisma|invalid|column|table|constraint|undefined|null|error|request|server|login|_id|certificate_type|file_type|field|year|passed|format|P20\d\d|stack/i;
const isCleanMessage = (message) => {
  const text = message || "";
  return /[ก-๙]/.test(text) && !TECH_WORDS.test(text);
};

// ── ไฟล์ทดสอบ: ทุกไฟล์ฝัง "ป้าย" เฉพาะตัว ไว้ตามหาบน disk ทีหลังว่าไฟล์ที่ถูกปฏิเสธถูกลบทิ้งจริงไหม ──
const STAMP = Date.now().toString().slice(-6);
const markerOf = (label) => `SECTEST-${STAMP}-${label}`;
const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const pdfWith = (label) => Buffer.from(`%PDF-1.4\n%${markerOf(label)}\n%%EOF`);
const pngWith = (label) => Buffer.concat([PNG_HEAD, Buffer.from(markerOf(label))]);
const jpgWith = (label) => Buffer.concat([JPG_HEAD, Buffer.from(markerOf(label))]);
const textWith = (label) => Buffer.from(`not a real file ${markerOf(label)}`);

const fileForm = (bytes, mime, name, { fieldName = "file", certificateType = "exam_result" } = {}) => {
  const fd = new FormData();
  fd.append("file", new Blob([bytes], { type: mime }), name);
  if (fieldName !== "file") {
    // ส่งไฟล์มาในชื่อช่องที่ระบบไม่รู้จัก (แทนช่อง file)
    fd.delete("file");
    fd.append(fieldName, new Blob([bytes], { type: mime }), name);
  }
  fd.append("certificate_type", certificateType);
  return fd;
};

// นับไฟล์บน disk ที่มีป้ายนี้อยู่ (ดูเฉพาะไฟล์ที่เพิ่งสร้างระหว่างเทส)
const UPLOAD_DIR = path.resolve("uploads/certificates");
const TEST_START = Date.now() - 5000;
const filesOnDiskWith = (label) => {
  const marker = markerOf(label);
  let found = 0;
  if (!fs.existsSync(UPLOAD_DIR)) {
    return 0;
  }
  for (const name of fs.readdirSync(UPLOAD_DIR)) {
    const fullPath = path.join(UPLOAD_DIR, name);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.mtimeMs < TEST_START) {
        continue;
      }
      const content = fs.readFileSync(fullPath);
      if (content.includes(marker)) {
        found++;
      }
    } catch {
      // ไฟล์ถูกลบไประหว่างอ่าน — ไม่นับ
    }
  }
  return found;
};

// ── ข้อมูลทดสอบ ───────────────────────────────────────────────
const YEAR = 2597;
const PREFIX = String(YEAR - 4).slice(-2); // "93"
const sid = (n) => `${PREFIX}${STAMP}0${n}`;
const nid = (n) => `2${STAMP}0000${n}`.slice(0, 13).padEnd(13, "0");
const NAMES = ["A", "B", "C", "D"];
const ID = {};
for (let i = 0; i < NAMES.length; i++) {
  ID[NAMES[i]] = sid(i + 1);
}

let parkedRounds = [];

const main = async () => {
  const login = async (u, p) => (await call("POST", "/api/auth/login", { body: { psu_passport_id: u, password: p } })).cookie;
  const oToken = await login("456", "456");
  const rToken = await login("321", "321");
  const eToken = await login("789", "789");
  check("login เจ้าหน้าที่ / ผู้ช่วยตรวจ / ผู้บริหาร", [!!oToken, !!rToken, !!eToken], [true, true, true]);

  try {
    const rooms = (await call("GET", "/api/rooms", { token: oToken })).json.data;
    const subjects = (await call("GET", "/api/subjects", { token: oToken })).json.data;
    const [s1, s2] = subjects.slice(0, 2);
    const subjectIds = [s1.subject_id, s2.subject_id];

    // ════════ เตรียมนักศึกษา 4 คน ════════
    const tokens = {};
    for (let i = 0; i < NAMES.length; i++) {
      const who = NAMES[i];
      await call("POST", "/api/students", { token: oToken, body: { student_id: ID[who], national_id: nid(i + 1) } });
      const l = await call("POST", "/api/auth/login", { body: { psu_passport_id: ID[who], password: nid(i + 1) } });
      await call("POST", "/api/students/complete-profile", {
        token: l.cookie,
        body: {
          first_name: `ปลอดภัย${who}`, last_name: "ทดสอบ", first_name_en: `Sec${who}`, last_name_en: "Test",
          email: `${ID[who]}@test.local`, phone: "0812345678", room_id: rooms[0].room_id,
        },
      });
      tokens[who] = l.cookie;
    }
    await call("PATCH", "/api/students/bulk-eligible", { token: oToken, body: { student_ids: Object.values(ID), exam_eligible: true } });
    check("เตรียมนักศึกษา 4 คน", Object.values(tokens).every((t) => !!t), true);

    // ปิดรอบที่เปิดค้างไว้ชั่วคราว (เปิดคืนตอนจบ)
    const existingRounds = (await call("GET", "/api/rounds", { token: oToken })).json.data || [];
    for (const r of existingRounds) {
      if (r.status === "open") {
        parkedRounds.push(r.round_id);
      }
    }
    for (const id of parkedRounds) {
      await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });
    }

    const setRound = (roundId, body) => call("PUT", `/api/rounds/${roundId}`, { token: oToken, body });
    const send = (who) => call("POST", "/api/exam-results", {
      token: tokens[who],
      body: { subject_results: [{ subject_id: s1.subject_id, is_passed: true }, { subject_id: s2.subject_id, is_passed: false }] },
    });
    const upload = (who, resultId, bytes, mime, name, options) =>
      call("POST", `/api/exam-results/${resultId}/certificates`, { token: tokens[who], form: fileForm(bytes, mime, name, options) });
    const deleteCert = (who, certificateId) => call("DELETE", `/api/certificates/${certificateId}`, { token: tokens[who] });
    const myPapers = async (who) => (await call("GET", "/api/exam-results/me", { token: tokens[who] })).json.data || [];
    const paperIn = async (who, roundId) => {
      const papers = await myPapers(who);
      for (const p of papers) {
        if (p.round_id === roundId) {
          return p;
        }
      }
      return null;
    };
    const approve = (resultId) => call("PATCH", `/api/exam-results/${resultId}/approve`, { token: oToken });
    const reject = (resultId, remark) => call("PATCH", `/api/exam-results/${resultId}/reject`, { token: oToken, body: { remark } });

    const r1 = await call("POST", "/api/rounds", {
      token: oToken,
      body: { academic_year: YEAR, attempt_number: 1, open_date: "2020-01-01", close_date: "2099-12-31", subject_ids: subjectIds },
    });
    const round1 = r1.json.data.round_id;
    check("สร้าง + เปิดรอบ 1", [r1.status, (await setRound(round1, { status: "open" })).status], [200, 200]);

    // ════════ 1. ไฟล์ที่ถูกปฏิเสธต้องไม่ค้างบน disk (ทุกเส้นทาง) ════════
    console.log("\n── 1. ไฟล์ที่ถูกปฏิเสธ ต้องถูกลบทิ้งจาก disk ──");
    const pA = await send("A");
    const resultA = pA.json.data.result_id;
    check("A ส่งผลรอบ 1 -> 200", pA.status, 200);

    const cross = await upload("B", resultA, pdfWith("cross"), "application/pdf", "cross.pdf");
    check("B แนบไฟล์ในใบของ A -> 403", cross.status, 403);
    check("  ข้อความไทย ไม่มีคำเทคนิค", isCleanMessage(cross.json.message), true);
    check("  ไฟล์ไม่ค้างบน disk", filesOnDiskWith("cross"), 0);

    const badType = await upload("A", resultA, pdfWith("badtype"), "application/pdf", "t.pdf", { certificateType: "../../etc" });
    check("ประเภทเอกสารแปลก -> 400", badType.status, 400);
    check("  ไฟล์ไม่ค้างบน disk", filesOnDiskWith("badtype"), 0);

    const fake = await upload("A", resultA, textWith("fake"), "image/png", "fake.png");
    check("เนื้อไฟล์ไม่ใช่รูป (บอกว่า PNG) -> 400", fake.status, 400);
    check("  ไฟล์ไม่ค้างบน disk", filesOnDiskWith("fake"), 0);

    const html = await upload("A", resultA, Buffer.from(`<html><script>alert(1)</script>${markerOf("html")}</html>`), "text/html", "x.html");
    check("ไฟล์ HTML -> 400", html.status, 400);
    check("  ข้อความไทย ไม่มีคำเทคนิค", isCleanMessage(html.json.message), true);
    check("  ไฟล์ไม่ค้างบน disk", filesOnDiskWith("html"), 0);

    const svg = await upload("A", resultA, Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><!--${markerOf("svg")}--></svg>`), "image/svg+xml", "x.svg");
    check("ไฟล์ SVG -> 400", svg.status, 400);
    check("  ไฟล์ไม่ค้างบน disk", filesOnDiskWith("svg"), 0);

    const wrongField = await upload("A", resultA, pdfWith("field"), "application/pdf", "f.pdf", { fieldName: "files" });
    check("ส่งไฟล์มาในช่องที่ไม่รู้จัก -> 400", wrongField.status, 400);
    check("  ข้อความไทย ไม่มีคำเทคนิค", isCleanMessage(wrongField.json.message), true);
    check("  ไฟล์ไม่ค้างบน disk", filesOnDiskWith("field"), 0);

    const bigBytes = Buffer.concat([pdfWith("big"), Buffer.alloc(11 * 1024 * 1024, 0x20)]);
    const big = await upload("A", resultA, bigBytes, "application/pdf", "big.pdf");
    check("ไฟล์ใหญ่เกิน 10 MB -> 400", big.status, 400);
    check("  ข้อความไทย ไม่มีคำเทคนิค", isCleanMessage(big.json.message), true);
    check("  ไฟล์ไม่ค้างบน disk", filesOnDiskWith("big"), 0);

    const longName = "ก".repeat(300) + ".pdf";
    const tooLong = await upload("A", resultA, pdfWith("longname"), "application/pdf", longName);
    check("ชื่อไฟล์ยาวเกิน -> 400 (ไม่ใช่ 500)", tooLong.status, 400);
    check("  ไฟล์ไม่ค้างบน disk", filesOnDiskWith("longname"), 0);

    const noPaper = await upload("A", 99999999, pdfWith("nopaper"), "application/pdf", "n.pdf");
    check("ใบผลสอบที่ไม่มีอยู่ -> 404", noPaper.status, 404);
    check("  ไฟล์ไม่ค้างบน disk", filesOnDiskWith("nopaper"), 0);

    const badId = await upload("A", "abc", pdfWith("badid"), "application/pdf", "b.pdf");
    check("เลขใบผลสอบไม่ใช่ตัวเลข -> 400", badId.status, 400);
    check("  ข้อความไทย ไม่มีคำเทคนิค", isCleanMessage(badId.json.message), true);
    check("  ไฟล์ไม่ค้างบน disk", filesOnDiskWith("badid"), 0);

    const hugeId = await upload("A", "99999999999", pdfWith("hugeid"), "application/pdf", "h.pdf");
    check("เลขใบผลสอบใหญ่เกินชนิดข้อมูล -> 4xx (ไม่ใช่ 500)", hugeId.status >= 400 && hugeId.status < 500, true);
    check("  ไฟล์ไม่ค้างบน disk", filesOnDiskWith("hugeid"), 0);

    // ════════ 2. เปิดไฟล์: ชนิดไฟล์จากเนื้อไฟล์จริง + สิทธิ์ ════════
    console.log("\n── 2. เปิดไฟล์ ──");
    // ไฟล์ "สองหน้า": หัวไฟล์ PNG จริง ตามด้วย HTML/script — ผ่านด่านหัวไฟล์ได้ ต้องถูกส่งเป็นรูปภาพ ห้ามเป็น HTML
    const polyglot = Buffer.concat([PNG_HEAD, Buffer.from(`<html><script>alert(document.cookie)</script>${markerOf("poly")}</html>`)]);
    const polyUp = await upload("A", resultA, polyglot, "image/png", "poly.png");
    check("แนบไฟล์หัว PNG + script -> 200 (เก็บเป็นรูป)", polyUp.status, 200);
    const polyId = polyUp.json.data?.certificate_id;
    check("  ชนิดไฟล์ที่บันทึก = png", polyUp.json.data?.file_type, "png");
    check("  path บน disk ระบบตั้งเอง (ไม่มี .. ไม่มีชื่อไฟล์เดิม)",
      /^uploads\/certificates\/\d+-\d+\.(pdf|jpg|png)$/.test(polyUp.json.data?.file_path || ""), true);
    const polyOpen = await call("GET", `/api/certificates/${polyId}/file`, { token: rToken });
    check("  ผู้ช่วยตรวจเปิดได้ เป็น image/png", [polyOpen.status, polyOpen.type], [200, "image/png"]);
    check("  มี X-Content-Type-Options: nosniff", polyOpen.headers.get("x-content-type-options"), "nosniff");

    // บอกว่าเป็น PDF แต่เนื้อเป็นรูป PNG → ต้องส่งออกเป็นชนิดจากเนื้อไฟล์ (image/png)
    const lie = await upload("A", resultA, pngWith("lie"), "application/pdf", "ใบคะแนน.pdf");
    check("แนบ PNG ที่บอกว่าเป็น PDF -> 200", lie.status, 200);
    const lieOpen = await call("GET", `/api/certificates/${lie.json.data?.certificate_id}/file`, { token: tokens.A });
    check("  เจ้าของเปิดได้ ชนิดตามเนื้อไฟล์จริง (image/png)", [lieOpen.status, lieOpen.type], [200, "image/png"]);

    // ชื่อไฟล์มีเครื่องหมายคำพูด/ขึ้นบรรทัดใหม่ — ต้องไม่หลุดไปเป็น header ใหม่
    const evilName = 'a"\r\nX-Evil: 1;.pdf';
    const evil = await upload("A", resultA, pdfWith("evil"), "application/pdf", evilName);
    check("แนบไฟล์ชื่อแปลก -> 200", evil.status, 200);
    const evilOpen = await call("GET", `/api/certificates/${evil.json.data?.certificate_id}/file`, { token: rToken });
    check("  เปิดได้ ไม่มี header แปลกหลุดออกมา", [evilOpen.status, evilOpen.headers.get("x-evil")], [200, null]);
    check("  Content-Disposition เป็น inline + ชื่อไฟล์เข้ารหัส",
      /^inline; filename\*=UTF-8''[^\s"\r\n]+$/.test(evilOpen.headers.get("content-disposition") || ""), true);

    check("นักศึกษาคนอื่นเปิดไฟล์ของ A -> 403", (await call("GET", `/api/certificates/${polyId}/file`, { token: tokens.B })).status, 403);
    check("ผู้บริหารเปิดไฟล์ของ A -> 403", (await call("GET", `/api/certificates/${polyId}/file`, { token: eToken })).status, 403);
    check("ไม่ได้เข้าสู่ระบบเปิดไฟล์ -> 401", (await call("GET", `/api/certificates/${polyId}/file`)).status, 401);
    const openBad = await call("GET", "/api/certificates/abc/file", { token: oToken });
    check("เปิดไฟล์เลขแปลก -> 400 ข้อความไทยสะอาด", [openBad.status, isCleanMessage(openBad.json.message)], [400, true]);
    const openHuge = await call("GET", "/api/certificates/99999999999/file", { token: oToken });
    check("เปิดไฟล์เลขใหญ่เกิน -> 4xx ข้อความไทยสะอาด", [openHuge.status >= 400 && openHuge.status < 500, isCleanMessage(openHuge.json.message)], [true, true]);

    // ════════ 3. กดแนบพร้อมกันหลายไฟล์ ต้องไม่เกิน 5 ไฟล์ ════════
    console.log("\n── 3. แนบพร้อมกัน (race) ──");
    const pC = await send("C");
    const resultC = pC.json.data.result_id;
    const racers = [];
    for (let i = 0; i < 10; i++) {
      racers.push(upload("C", resultC, pdfWith(`race${i}`), "application/pdf", `race${i}.pdf`));
    }
    const raceResults = await Promise.all(racers);
    let raceOk = 0;
    let raceServerError = 0;
    for (const r of raceResults) {
      if (r.status === 200) {
        raceOk++;
      }
      if (r.status >= 500) {
        raceServerError++;
      }
    }
    const cPaper = await paperIn("C", round1);
    const cFileCount = cPaper.certificates.length;
    console.log(`      (สำเร็จ ${raceOk} จาก 10 request, ในใบมี ${cFileCount} ไฟล์)`);
    check("แนบพร้อมกัน 10 ไฟล์ -> ในใบมีไม่เกิน 5 ไฟล์", cFileCount <= 5, true);
    check("  ไม่มี 500", raceServerError, 0);
    let raceOnDisk = 0;
    for (let i = 0; i < 10; i++) {
      raceOnDisk = raceOnDisk + filesOnDiskWith(`race${i}`);
    }
    check("  ไฟล์บน disk เท่ากับจำนวนแถวในใบ (ไฟล์ที่ถูกปฏิเสธถูกลบ)", raceOnDisk, cFileCount);

    // ════════ 4. ใบที่ยืนยันแล้ว ════════
    console.log("\n── 4. ใบที่ยืนยันแล้ว ──");
    check("ยืนยันใบของ A -> 200", (await approve(resultA)).status, 200);
    check("A ลบไฟล์ในใบที่ยืนยันแล้ว -> 409", (await deleteCert("A", polyId)).status, 409);
    const lateA = await upload("A", resultA, pdfWith("approved"), "application/pdf", "late.pdf");
    check("A แนบไฟล์ในใบที่ยืนยันแล้ว -> 409", lateA.status, 409);
    check("  ไฟล์ไม่ค้างบน disk", filesOnDiskWith("approved"), 0);

    // ════════ 5. ใบที่ถูกตีกลับของรอบเก่า / ใบรอตรวจหลังปิดรอบ ════════
    console.log("\n── 5. ใบที่ถูกตีกลับของรอบเก่า ──");
    const pD1 = await send("D");
    const resultD1 = pD1.json.data.result_id;
    const d1Up = await upload("D", resultD1, pdfWith("d1"), "application/pdf", "d1.pdf");
    const d1CertId = d1Up.json.data?.certificate_id;
    check("D ส่งรอบ 1 + แนบไฟล์", [pD1.status, d1Up.status], [200, 200]);
    check("ตีกลับใบรอบ 1 ของ D (ระหว่างรอบเปิด)", (await reject(resultD1, "ไฟล์ไม่ชัด")).status, 200);
    check("ปิดรอบ 1", (await setRound(round1, { status: "closed" })).status, 200);

    const r2 = await call("POST", "/api/rounds", {
      token: oToken,
      body: { academic_year: YEAR, attempt_number: 2, open_date: "2020-01-01", close_date: "2099-12-31", subject_ids: subjectIds },
    });
    const round2 = r2.json.data.round_id;
    check("สร้าง + เปิดรอบ 2", [r2.status, (await setRound(round2, { status: "open" })).status], [200, 200]);
    const dActive = (await call("GET", "/api/rounds/active", { token: tokens.D })).json.data;
    check("D เห็นฟอร์มรอบ 2 (ไม่ใช่รอบ 1 ที่ถูกตีกลับ)", [dActive?.round_id, dActive?.can_fix_rejected], [round2, false]);

    // กฎตอนส่งผล: มีรอบใหม่เปิดอยู่ → ใบเก่าที่ถูกตีกลับแก้ไม่ได้แล้ว → หลักฐานของใบเก่าก็ต้องแก้ไม่ได้เช่นกัน
    const oldUp = await upload("D", resultD1, pdfWith("oldround"), "application/pdf", "old.pdf");
    check("D แนบไฟล์ในใบตีกลับของรอบ 1 ขณะรอบ 2 เปิด -> 409", oldUp.status, 409);
    check("  ไฟล์ไม่ค้างบน disk", filesOnDiskWith("oldround"), 0);
    check("D ลบไฟล์ในใบตีกลับของรอบ 1 ขณะรอบ 2 เปิด -> 409", (await deleteCert("D", d1CertId)).status, 409);

    const pD2 = await send("D");
    const resultD2 = pD2.json.data?.result_id;
    check("D ส่งผลรอบ 2 -> 200 (ใบใหม่)", [pD2.status, resultD2 !== resultD1], [200, true]);
    const pB2 = await send("B");
    const resultB2 = pB2.json.data?.result_id;
    const b2Up = await upload("B", resultB2, pdfWith("b2"), "application/pdf", "b2.pdf");
    check("B ส่งผลรอบ 2 + แนบไฟล์", [pB2.status, b2Up.status], [200, 200]);
    check("ปิดรอบ 2", (await setRound(round2, { status: "closed" })).status, 200);

    const oldUp2 = await upload("D", resultD1, pdfWith("oldround2"), "application/pdf", "old2.pdf");
    check("D แนบไฟล์ในใบตีกลับของรอบ 1 หลังปิดรอบ 2 (ใบรอบ 2 รอตรวจ) -> 409", oldUp2.status, 409);
    check("  ไฟล์ไม่ค้างบน disk", filesOnDiskWith("oldround2"), 0);
    check("D ส่งผลหลังปิดรอบ 2 -> 400 (ไม่ย้อนไปแก้รอบ 1)", (await send("D")).status, 400);
    const pendingUp = await upload("D", resultD2, pdfWith("pending"), "application/pdf", "p.pdf");
    check("D แนบไฟล์ในใบรอตรวจหลังปิดรอบ -> 409", pendingUp.status, 409);
    check("  ไฟล์ไม่ค้างบน disk", filesOnDiskWith("pending"), 0);

    // เส้นทางที่ถูกต้อง: ใบของรอบล่าสุดถูกตีกลับหลังปิดรอบ → แก้หลักฐาน + ส่งใหม่ได้ครั้งเดียว
    check("ตีกลับใบรอบ 2 ของ B หลังปิดรอบ", (await reject(resultB2, "แนบใบคะแนนใหม่")).status, 200);
    const bActive = (await call("GET", "/api/rounds/active", { token: tokens.B })).json.data;
    check("B เห็นฟอร์มรอบ 2 แบบแก้ใบตีกลับ", [bActive?.round_id, bActive?.can_fix_rejected], [round2, true]);
    const bFix = await upload("B", resultB2, jpgWith("bfix"), "image/jpeg", "ใหม่.jpg");
    check("B แนบไฟล์ใหม่ในใบตีกลับ (รอบล่าสุด) -> 200", bFix.status, 200);
    check("B ลบไฟล์เดิมในใบตีกลับ -> 200", (await deleteCert("B", b2Up.json.data?.certificate_id)).status, 200);
    check("  ไฟล์เดิมถูกลบจาก disk ด้วย", filesOnDiskWith("b2"), 0);
    check("B ส่งใหม่ -> 200 กลับเป็นรอตรวจ", [(await send("B")).status, (await paperIn("B", round2))?.staff_status], [200, "pending"]);
    const bAfter = await upload("B", resultB2, pdfWith("bafter"), "application/pdf", "after.pdf");
    check("  ส่งแล้ว แนบไฟล์เพิ่มไม่ได้ -> 409", bAfter.status, 409);
    check("  ลบไฟล์ไม่ได้ -> 409", (await deleteCert("B", bFix.json.data?.certificate_id)).status, 409);

    // ════════ 6. ไฟล์ส่งออก — เจ้าหน้าที่เท่านั้น + ไม่มีเลขบัตร/รหัสผ่าน ════════
    console.log("\n── 6. ไฟล์ส่งออก ──");
    const exportsToCheck = [
      { label: "export-first-year", method: "GET", url: `/api/dashboard/export-first-year?year=${YEAR}&passed=false` },
      { label: "export-first-attempt", method: "GET", url: `/api/dashboard/export-first-attempt?year=${YEAR}&passed=false` },
      { label: "dashboard/export", method: "GET", url: `/api/dashboard/export?round_id=${round2}` },
      { label: "students/export", method: "POST", url: "/api/students/export", body: { year: YEAR, by_round: true } },
      { label: "students/export-subject", method: "GET", url: `/api/students/export-subject?subject_code=${encodeURIComponent(s1.subject_code)}&passed=true&year=${YEAR}&format=xlsx` },
    ];
    for (const ex of exportsToCheck) {
      const asReviewer = await call(ex.method, ex.url, { token: rToken, body: ex.body });
      const asExecutive = await call(ex.method, ex.url, { token: eToken, body: ex.body });
      const asStudent = await call(ex.method, ex.url, { token: tokens.A, body: ex.body });
      const asNobody = await call(ex.method, ex.url, { body: ex.body });
      check(`${ex.label}: ผู้ช่วยตรวจ/ผู้บริหาร/นักศึกษา/ไม่ได้เข้าสู่ระบบ -> 403/403/403/401`,
        [asReviewer.status, asExecutive.status, asStudent.status, asNobody.status], [403, 403, 403, 401]);
      const asOfficer = await call(ex.method, ex.url, { token: oToken, body: ex.body });
      check(`${ex.label}: เจ้าหน้าที่ -> 200`, asOfficer.status, 200);
      if (asOfficer.buffer && /spreadsheetml/.test(asOfficer.type)) {
        const sheets = await readXlsxFile(asOfficer.buffer, { parseNumber: (t) => t });
        const allText = JSON.stringify(sheets);
        let hasNationalId = false;
        for (let i = 1; i <= NAMES.length; i++) {
          if (allText.includes(nid(i))) {
            hasNationalId = true;
          }
        }
        check(`  ${ex.label}: ไม่มีเลขบัตรประชาชน`, hasNationalId, false);
        check(`  ${ex.label}: ไม่มีรหัสผ่านที่เข้ารหัสแล้ว`, /\$2[aby]\$/.test(allText), false);
      }
    }
    const badYear = await call("GET", "/api/dashboard/export-first-year?year=abc&passed=maybe&format=exe", { token: oToken });
    check("ส่งออกด้วยค่าแปลก -> 400 ข้อความไทยไม่มีชื่อ field", [badYear.status, isCleanMessage(badYear.json.message)], [400, true]);

    // ════════ 7. role อ่านจากฐานข้อมูลเท่านั้น ════════
    console.log("\n── 7. role จากฐานข้อมูล ──");
    const me = (await call("GET", "/api/auth/me", { token: tokens.A })).json.data;
    // token ที่เซ็นถูกต้อง (มีกุญแจจริง) แต่ใส่ role เป็น officer — ระบบต้องดู role จาก DB ไม่ใช่จาก token
    const forged = jwt.sign({ userId: me.id, role: "officer", studentId: null, mustChangePassword: false }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const forgedCookie = `token=${forged}`;
    check("token ใส่ role=officer ของนักศึกษา -> ดูรายชื่อนักศึกษาไม่ได้ (403)", (await call("GET", "/api/students", { token: forgedCookie })).status, 403);
    check("  ส่งออกรายชื่อไม่ได้ (403)", (await call("GET", `/api/dashboard/export-first-year?year=${YEAR}&passed=true`, { token: forgedCookie })).status, 403);
    check("นักศึกษาส่ง role=officer มาใน body เพื่อยืนยันผล -> 403",
      (await call("PATCH", `/api/exam-results/${resultD2}/approve`, { token: tokens.A, body: { role: "officer" } })).status, 403);
    const tamperedSig = forged.slice(0, -3) + (forged.endsWith("AAA") ? "BBB" : "AAA");
    check("token ถูกแก้ลายเซ็น -> 401", (await call("GET", "/api/exam-results/me", { token: `token=${tamperedSig}` })).status, 401);

    // ════════ 8. ข้อความ error ไม่เผยของภายใน ════════
    console.log("\n── 8. ข้อความ error ──");
    const badRequests = [
      ["DELETE certificates/abc", "DELETE", "/api/certificates/abc", tokens.A],
      ["DELETE certificates/ใหญ่เกิน", "DELETE", "/api/certificates/99999999999", tokens.A],
      ["DELETE certificates/ไม่มีอยู่", "DELETE", "/api/certificates/99999999", tokens.A],
      ["approve/abc", "PATCH", "/api/exam-results/abc/approve", oToken],
      ["approve/ใหญ่เกิน", "PATCH", "/api/exam-results/99999999999/approve", oToken],
      ["reject ไม่มีเหตุผล", "PATCH", `/api/exam-results/${resultD2}/reject`, oToken],
      ["export-first-attempt ไม่มีปี", "GET", "/api/dashboard/export-first-attempt", oToken],
    ];
    for (const [label, method, url, token] of badRequests) {
      // GET ส่ง body ไม่ได้ (fetch ไม่ยอม) — ส่ง body ว่างเฉพาะ method อื่น
      let body;
      if (method !== "GET") {
        body = {};
      }
      const res = await call(method, url, { token, body });
      check(`${label}: 4xx + ข้อความไทยสะอาด`, [res.status >= 400 && res.status < 500, isCleanMessage(res.json.message)], [true, true]);
    }
  } finally {
    await cleanupYears([YEAR]);
    for (const id of parkedRounds) {
      await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "open" } });
    }
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
