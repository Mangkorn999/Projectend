// เทสกติกาวันที่ของรอบการกรอก + field `phase`
//
// บั๊กที่เทสนี้กันไม่ให้กลับมา (เจอจริงในระบบ 23 ก.ย. 2569):
//   เจ้าหน้าที่สร้างรอบด้วย เปิดรับ 26 ก.ย. / ปิดรับ 23 ก.ย. (สลับกัน) แล้วกดเปิด
//   → ไม่มี validation เลย รอบนั้นเลยอยู่ในตารางแบบ status = "open"
//   → findActive() ต้องการ open_date <= now <= close_date ซึ่งเป็นไปไม่ได้ตลอดกาล
//   → นักศึกษากรอกไม่ได้สักคน และเจ้าหน้าที่เปิดรอบอื่นไม่ได้ (ระบบยอมให้เปิดทีละรอบ)
//   = ระบบล็อกตายโดยไม่มี error อะไรขึ้นให้เห็น
//
// ใช้ปีการศึกษาสมมติ 2597 — ไม่มีนักศึกษาจริงอยู่ในรุ่นนี้ จึงไม่กระทบข้อมูลจริง
// ท้ายไฟล์ลบรอบที่สร้างไว้ทั้งหมดเสมอ (finally) ไม่ให้ค้างไปกวนเทสตัวอื่น

const BASE = process.env.BASE || "http://localhost:3000";
let failures = 0;

const call = async (method, url, { token, body } = {}) => {
  const headers = {};
  if (token) headers.Cookie = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  let cookie = null;
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return { status: res.status, json, cookie };
};

const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
};

const YEAR = 2597;
const created = []; // เก็บ round_id ไว้ลบตอนจบ
let parkedRoundId = null; // รอบจริงที่เปิดค้างอยู่ก่อนเริ่มเทส — ต้องเปิดคืนตอนจบ

const main = async () => {
  const token = (await call("POST", "/api/auth/login", {
    body: { psu_passport_id: "456", password: "456" },
  })).cookie;
  check("login officer", !!token, true);

  // ระบบยอมให้มีรอบ status="open" ได้ทีละรอบเท่านั้น
  // ถ้ามีรอบจริงเปิดค้างอยู่ เทสนี้จะกดเปิดรอบทดสอบไม่ได้เลย
  // → ปิดไว้ก่อน แล้วเปิดคืนตอนจบ (เหมือนที่ phase13/15/16 ทำ)
  const before = (await call("GET", "/api/rounds", { token })).json.data;
  const alreadyOpen = before.find((r) => r.status === "open");
  if (alreadyOpen) {
    parkedRoundId = alreadyOpen.round_id;
    await call("PUT", `/api/rounds/${parkedRoundId}`, { token, body: { status: "closed" } });
  }

  const subjects = (await call("GET", "/api/subjects", { token })).json.data;
  const oneSubject = [subjects[0].subject_id];

  const mk = (body) => call("POST", "/api/rounds", { token, body: { academic_year: YEAR, subject_ids: oneSubject, ...body } });

  // ── 1. เปิดรับหลังปิดรับ = ปฏิเสธ (บั๊กที่เจอจริง) ──
  const swapped = await mk({ attempt_number: 1, open_date: "2090-09-26T22:44", close_date: "2090-09-23T23:59" });
  check("เปิดรับหลังปิดรับ -> 400", swapped.status, 400);

  // ── 2. เปิดรับ = ปิดรับ พอดี = ปฏิเสธ (ช่วงกว้าง 0 วินาที ไม่มีใครกรอกทัน) ──
  const same = await mk({ attempt_number: 1, open_date: "2090-09-26T10:00", close_date: "2090-09-26T10:00" });
  check("เปิดรับ = ปิดรับ -> 400", same.status, 400);

  // ── 3. ช่วงปกติ = ผ่าน และได้ phase มาด้วย ──
  const ok = await mk({ attempt_number: 1, open_date: "2090-06-01", close_date: "2090-06-30" });
  check("ช่วงวันที่ถูกต้อง -> 200", ok.status, 200);
  if (ok.json?.data?.round_id) created.push(ok.json.data.round_id);
  check("  ยังไม่กดเปิด -> phase closed", ok.json?.data?.phase, "closed");

  const roundId = ok.json?.data?.round_id;

  // ── 4. แก้เฉพาะ close_date ให้เร็วกว่า open_date เดิมใน DB = ปฏิเสธ ──
  // (ต้องตรวจจาก "ค่าหลังแก้" ไม่ใช่เฉพาะ field ที่ส่งมา)
  const halfBad = await call("PUT", `/api/rounds/${roundId}`, { token, body: { close_date: "2090-01-01" } });
  check("ส่งแค่ close_date ให้เร็วกว่า open_date เดิม -> 400", halfBad.status, 400);

  // ── 5. กดเปิดรอบที่ช่วงยังไม่มาถึง -> phase scheduled (ไม่ใช่ active) ──
  const opened = await call("PUT", `/api/rounds/${roundId}`, { token, body: { status: "open" } });
  check("กดเปิดรอบที่ยังไม่ถึงวันเปิด -> 200", opened.status, 200);
  check("  phase = scheduled", opened.json?.data?.phase, "scheduled");

  // ── 6. GET /api/rounds ก็ต้องมี phase ติดมาทุกรอบ ──
  const all = (await call("GET", "/api/rounds", { token })).json.data;
  const mine = all.find(r => r.round_id === roundId);
  check("GET /rounds แปะ phase มาให้ด้วย", mine?.phase, "scheduled");

  // ปิดคืนก่อนไปข้อถัดไป ไม่งั้นติด "เปิดได้ทีละรอบ"
  await call("PUT", `/api/rounds/${roundId}`, { token, body: { status: "closed" } });

  // ── 7. กดเปิดรอบที่เลยวันปิดรับไปแล้ว = ปฏิเสธ ──
  const expired = await mk({ attempt_number: 2, open_date: "2020-01-01", close_date: "2020-01-31" });
  check("สร้างรอบที่อยู่ในอดีต (ยังไม่เปิด) -> 200", expired.status, 200);
  if (expired.json?.data?.round_id) created.push(expired.json.data.round_id);
  const expiredId = expired.json?.data?.round_id;

  const reopen = await call("PUT", `/api/rounds/${expiredId}`, { token, body: { status: "open" } });
  check("กดเปิดรอบที่เลยวันปิดแล้ว -> 400", reopen.status, 400);

  // ── 8. รอบที่เลยกำหนดแต่ status ยังเป็น open -> phase expired ──
  // สร้างแบบเปิดทันทีไม่ได้ (ติด guard ข้อ 7) เลยสร้างช่วงที่ยังไม่หมด แล้วค่อยเลื่อนวันปิดย้อนหลัง
  const live = await mk({ attempt_number: 3, open_date: "2020-01-01", close_date: "2090-12-31", status: "open" });
  check("สร้างรอบที่เปิดรับอยู่จริง -> 200", live.status, 200);
  if (live.json?.data?.round_id) created.push(live.json.data.round_id);
  check("  phase = active", live.json?.data?.phase, "active");

  const liveId = live.json?.data?.round_id;
  const shrunk = await call("PUT", `/api/rounds/${liveId}`, { token, body: { close_date: "2020-06-30" } });
  check("เลื่อนวันปิดมาไว้ในอดีต (รอบยังเปิดค้าง) -> 200", shrunk.status, 200);
  check("  phase = expired", shrunk.json?.data?.phase, "expired");

  // เก็บกวาด: ปิดรอบที่ยังเปิดค้าง แล้วลบทุกรอบที่สร้างในเทสนี้
  // ต้องลบให้หมดก่อนเปิดรอบจริงคืน ไม่งั้นติด "เปิดได้ทีละรอบ" อีก
  for (const id of created) {
    await call("PUT", `/api/rounds/${id}`, { token, body: { status: "closed" } });
    await call("DELETE", `/api/rounds/${id}`, { token });
  }
  const left = (await call("GET", "/api/rounds", { token })).json.data.filter(r => r.academic_year === YEAR);
  check("เก็บกวาดครบ ไม่มีรอบทดสอบค้าง", left.length, 0);

  // คืนสถานะรอบจริงที่ฝากไว้ตอนต้น
  if (parkedRoundId) {
    const restored = await call("PUT", `/api/rounds/${parkedRoundId}`, { token, body: { status: "open" } });
    check("เปิดรอบจริงที่ฝากไว้คืน", restored.status, 200);
  }

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
};

main().catch((e) => { console.error("CRASHED:", e); process.exit(2); });
