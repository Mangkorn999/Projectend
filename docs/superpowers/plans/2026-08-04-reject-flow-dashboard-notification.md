# Reject Flow, Dashboard Stats, Notifications & Image Zoom — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปลดล็อกการแก้ผลสอบให้ครบทุกวิชาเมื่อใบถูกตีกลับ, ทำให้สถิติ dashboard ตรงกับความจริง, แจ้งเตือนนักศึกษาเมื่อถูกตีกลับ และเปิดให้ซูมรูปประกาศได้

**Architecture:** ต้นตอเดียวกันของ bug 2 ตัวแรกคือ `findPassedSubjectIds()` นับใบของรอบปัจจุบันเป็น "รอบก่อน" — แก้โดยเพิ่มพารามิเตอร์ `excludeRoundId`. แยก "ผ่านจากการสอบจริง" ออกจาก "ผ่านเพราะยกมา" ด้วย column ใหม่ `carried_forward` ใน `subject_results` เพื่อให้สถิติรายวิชานับเฉพาะคนที่สอบจริง. แจ้งเตือนประกอบขึ้นฝั่ง frontend จาก endpoint ที่มีอยู่ ไม่มีตาราง DB ใหม่

**Tech Stack:** Node.js + Express + Prisma + PostgreSQL (backend), React + Vite (frontend), smoke test เป็น plain `.mjs` ยิง `fetch` ใส่ server ที่รันอยู่

**Spec:** `docs/superpowers/specs/2026-08-04-reject-flow-dashboard-notification-design.md`

## Global Constraints

- Response format: success → `res.json({ success: true, data })`, error → `next(err)` พร้อม `err.statusCode`
- ชื่อ column ใช้ `snake_case` ตรงกับ data dictionary ในรายงาน
- role อ่านจาก JWT (`req.user`) เท่านั้น ห้ามเชื่อ body
- Repository เป็นชั้นเดียวที่คุย Prisma — controller/service ห้ามเรียก `prisma` ตรง
- คอมเมนต์ในโค้ดเขียนภาษาไทย อธิบาย "ทำไม" ไม่ใช่ "ทำอะไร" ตามสไตล์ไฟล์เดิม
- ทุกคอมมิตที่แตะ backend ต้องอัปเดต `backend/BACKEND_GUIDE.md` ในคอมมิตเดียวกัน + เพิ่มบรรทัดใน Changelog ท้ายไฟล์
- Test เป็น smoke test ยิง HTTP จริง — **ต้องมี backend รันอยู่ที่ `http://localhost:3000` ก่อนรันทุกครั้ง** (`cd backend && npm start`)
- เจอ 401 รัวๆ ทั้งชุด = ติด login rate limiter ให้ restart server แล้วรันใหม่
- i18n ต้องเพิ่ม key ทั้ง `TH` และ `EN` ใน `frontend/src/design/i18n.js` เสมอ

---

## File Structure

**Backend — แก้ไข:**

| ไฟล์ | หน้าที่หลังแก้ |
|---|---|
| `backend/prisma/schema.prisma` | เพิ่ม `carried_forward` ใน `SubjectResult` |
| `backend/src/modules/examResults/examResults.repository.js` | `findPassedSubjectIds(student_id, excludeRoundId)`, เขียน/อ่าน `carried_forward` |
| `backend/src/modules/examResults/examResults.controller.js` | กติกาหน้าต่างแก้ไข (pending แก้ได้ / approved ล็อก), ตั้ง `carried_forward` ตอนบันทึก |
| `backend/src/modules/rounds/rounds.controller.js` | `getActive` ส่ง `excludeRoundId` เข้า `findPassedSubjectIds` |
| `backend/src/modules/dashboard/dashboard.repository.js` | `findResultsByRound` กรองเฉพาะนักศึกษาที่ `exam_eligible` |
| `backend/src/modules/dashboard/dashboard.service.js` | `buildPerSubject` ตัด `carried_forward` ออก, `rate: null` เมื่อไม่มีผู้สอบ |

**Backend — สร้างใหม่:**

| ไฟล์ | หน้าที่ |
|---|---|
| `backend/tests/smoke-phase12-reject-edit.mjs` | ทดสอบ flow ตีกลับ/แก้ไข/หน้าต่างแก้ไข + สถิติ dashboard ที่แก้ใหม่ |

**Frontend — แก้ไข:**

| ไฟล์ | หน้าที่หลังแก้ |
|---|---|
| `frontend/src/design/notifications.js` *(สร้างใหม่)* | สร้าง list แจ้งเตือนจาก exam-results + news, จัดการ read state ใน localStorage |
| `frontend/src/design/components.jsx` | `TopBar` รับ prop `notifications` แทน mock `NOTIFS[role]` |
| `frontend/src/design/app.jsx` | ดึงแจ้งเตือน ส่งเข้า `TopBar` |
| `frontend/src/design/dashboardReal.jsx` | บาร์วิชาที่ `rate === null` แสดง `—` |
| `frontend/src/design/examFormReal.jsx` | ป้ายปุ่ม/แบนเนอร์ตามสถานะใบ (pending แก้ได้) |
| `frontend/src/design/newsReal.jsx` | `NewsImage` รองรับคลิกซูม + lightbox |
| `frontend/src/design/i18n.js` | key ใหม่ทั้ง TH/EN |

---

## Task 1: ปลดล็อกวิชาเมื่อใบถูกตีกลับ

แก้ต้นตอ: `findPassedSubjectIds` นับใบของรอบปัจจุบันเป็น "รอบก่อน"

**Files:**
- Modify: `backend/src/modules/examResults/examResults.repository.js:43-54`
- Modify: `backend/src/modules/examResults/examResults.controller.js:48`
- Modify: `backend/src/modules/rounds/rounds.controller.js:45`
- Test: `backend/tests/smoke-phase12-reject-edit.mjs` (สร้างใหม่)

**Interfaces:**
- Consumes: `examRepo.findByStudentAndRound(student_id, round_id)`, `roundsRepo.findActive(academic_year)`, `subjectsOfRound(round, allSubjects)` — มีอยู่แล้วทั้งหมด
- Produces: `findPassedSubjectIds(student_id, excludeRoundId = null) → Promise<number[]>` — Task 3 เรียกใช้ต่อ

- [ ] **Step 1: เขียน test ที่ต้องแดงก่อน**

สร้าง `backend/tests/smoke-phase12-reject-edit.mjs`:

```js
// Reject/edit-window test: หลังถูกตีกลับ นักศึกษาต้องแก้ผลได้ทุกวิชาของรอบนั้น
// รวมวิชาที่ตัวเองเคยติ๊ก "ผ่าน" ไปแล้ว — ผลของรอบตัวเองไม่ใช่ "รอบก่อน"
// ต้องรันตอน backend เปิดอยู่ที่ localhost:3000
const BASE = "http://localhost:3000";
let failures = 0;

const call = async (method, url, { token, body } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
};

const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
};

// นักศึกษาใหม่ทุกครั้งที่รัน — carry-forward ดูจากทุกรอบที่เคยกรอก
// ถ้าใช้บัญชีเดิมซ้ำ ผลของรันก่อนหน้าจะทำให้ตัวเลขที่คาดไว้เพี้ยน
const STAMP = Date.now().toString().slice(-8);
const STUDENT_ID = `993${STAMP}`;
const FIRST = "ทดสอบ";
const LAST = "ตีกลับ";
const PASSWORD = "rejectedit123";
const YEAR = 2597; // ห่างจาก seed และจากไฟล์ smoke-phase11 (2599/2598)
const NOW = { open_date: "2020-01-01", close_date: "2099-12-31" };

const openRound = async (token, attempt, subjectIds) => {
  const r = await call("POST", "/api/rounds", {
    token,
    body: { academic_year: YEAR, attempt_number: attempt, ...NOW, subject_ids: subjectIds },
  });
  if (r.status !== 200) throw new Error(`create round ${attempt} failed: ${JSON.stringify(r.json)}`);
  const id = r.json.data.round_id;
  await call("PUT", `/api/rounds/${id}`, { token, body: { status: "open" } });
  return id;
};

const addStudent = async (token, id, year, roomId) => {
  const made = await call("POST", "/api/students", {
    token,
    body: {
      student_id: id, first_name: FIRST, last_name: LAST,
      email: `${id}@test.local`, phone: "0800000000",
      room_id: roomId, academic_year: year,
    },
  });
  check(`create student ${year} -> 201`, made.status, 201);

  const setup = await call("POST", "/api/auth/first-setup", {
    body: { student_id: id, first_name: FIRST, last_name: LAST, password: PASSWORD },
  });
  check(`first-setup ${year} -> 201`, setup.status, 201);

  await call("PATCH", "/api/students/bulk-eligible", {
    token, body: { student_ids: [id], exam_eligible: true },
  });

  const login = await call("POST", "/api/auth/login", {
    body: { psu_passport_id: id, password: PASSWORD },
  });
  if (!login.json.token) { console.log(`student ${id} login failed:`, JSON.stringify(login.json)); process.exit(1); }
  return login.json.token;
};

const main = async () => {
  const officer = await call("POST", "/api/auth/login", {
    body: { psu_passport_id: "456", password: "456" },
  });
  const oToken = officer.json.token;
  if (!oToken) { console.log("officer login failed:", JSON.stringify(officer.json)); process.exit(1); }

  const ids = (await call("GET", "/api/subjects", { token: oToken })).json.data.map((s) => s.subject_id);
  if (ids.length < 8) { console.log("need >= 8 subjects, run seed first"); process.exit(1); }

  const rooms = (await call("GET", "/api/rooms", { token: oToken })).json.data || [];
  if (!rooms.length) { console.log("no rooms in db, run seed first"); process.exit(1); }

  const sToken = await addStudent(oToken, STUDENT_ID, YEAR, rooms[0].room_id);

  // findActive() หยิบรอบที่เปิดอยู่แบบไหนก็ได้ — พักรอบที่เปิดค้างไว้ก่อน
  const allRounds = (await call("GET", "/api/rounds", { token: oToken })).json.data || [];
  const parked = allRounds.filter((r) => r.status === "open").map((r) => r.round_id);
  for (const id of parked) {
    await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });
  }

  const created = [];
  try {
    // ---- รอบ 1: สอบ 5 วิชา ผ่าน 3 ตก 2 ----
    const r1 = await openRound(oToken, 1, ids.slice(0, 5));
    created.push(r1);

    const submit1 = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id, i) => ({ subject_id: id, is_passed: i < 3 })) },
    });
    check("round1 submit -> 200", submit1.status, 200);
    const resultId = submit1.json.data.result_id;

    // ---- เจ้าหน้าที่ตีกลับ ----
    const rejected = await call("PATCH", `/api/exam-results/${resultId}/reject`, {
      token: oToken, body: { remark: "ไฟล์ไม่สมบูรณ์" },
    });
    check("officer rejects -> 200", rejected.status, 200);

    // *** หัวใจของ task นี้ ***
    // ใบถูกตีกลับ = ต้องกลับมาแก้ได้ทุกวิชาของรอบนี้ ไม่มีวิชาไหนถูกล็อก
    // เพราะ 3 วิชาที่ผ่านมาจากใบของรอบนี้เอง ไม่ใช่รอบก่อน
    const afterReject = await call("GET", "/api/rounds/active", { token: sToken });
    check("after reject: offers 5 subjects", afterReject.json.data?.subjects?.length, 5);
    check("after reject: none locked as already_passed",
      afterReject.json.data?.subjects?.filter((s) => s.already_passed).length, 0);
    check("after reject: all_passed false", afterReject.json.data?.all_passed, false);

    // แก้ผลวิชาที่เคยติ๊กผ่าน ให้กลายเป็นไม่ผ่าน — ต้องบันทึกตามที่ส่งจริง
    const redo = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id, i) => ({ subject_id: id, is_passed: i >= 3 })) },
    });
    check("resubmit with flipped answers -> 200", redo.status, 200);
    check("  same row updated", redo.json.data?.result_id, resultId);
    check("  back to pending", redo.json.data?.staff_status, "pending");
    check("  remark cleared", redo.json.data?.remark, null);
    check("  flipped marks honoured (2 pass)",
      redo.json.data?.subject_results?.filter((s) => s.is_passed).length, 2);

    await call("PUT", `/api/rounds/${r1}`, { token: oToken, body: { status: "closed" } });

    // ---- รอบ 2: วิชาที่ผ่านจาก "รอบก่อนจริงๆ" ต้องยังล็อกอยู่ ----
    const r2 = await openRound(oToken, 2, ids.slice(0, 5));
    created.push(r2);
    const active2 = await call("GET", "/api/rounds/active", { token: sToken });
    check("round2: 2 subjects locked from previous round",
      active2.json.data?.subjects?.filter((s) => s.already_passed).length, 2);
  } finally {
    for (const id of created) {
      await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "closed" } });
    }
    for (const id of parked) {
      await call("PUT", `/api/rounds/${id}`, { token: oToken, body: { status: "open" } });
    }
  }

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
};

main();
```

- [ ] **Step 2: รัน test ให้เห็นว่าแดง**

```bash
cd backend && npm start          # terminal ที่ 1 — ปล่อยรันทิ้งไว้
node tests/smoke-phase12-reject-edit.mjs   # terminal ที่ 2
```

Expected: FAIL ที่ `after reject: none locked as already_passed -> 3 (want 0)`
และ FAIL ที่ `resubmit with flipped answers -> 409` (Task 2 จะแก้ให้)

- [ ] **Step 3: แก้ `findPassedSubjectIds` ให้ตัดรอบปัจจุบันออก**

`backend/src/modules/examResults/examResults.repository.js` แทนที่ทั้งฟังก์ชัน:

```js
// วิชาที่นักศึกษาคนนี้เคยสอบผ่านมาแล้ว — ไม่ต้องกรอกซ้ำอีก
// ไม่ต้องกรองปี เพราะนักศึกษา 1 คนอยู่รุ่นเดียว รอบที่เคยกรอกคือรอบของรุ่นตัวเองอยู่แล้ว
//
// excludeRoundId = รอบที่กำลังจะกรอก/กำลังดูอยู่ ต้องตัดออกเสมอ
// ไม่งั้นใบของรอบนี้เองที่ถูกตีกลับ จะย้อนกลับมาล็อกวิชาที่ตัวเองเพิ่งติ๊กผ่าน
// กลายเป็น "ผ่านแล้วจากรอบก่อน" ทั้งที่ยังไม่มีรอบก่อน แล้วแก้ผลไม่ได้
export const findPassedSubjectIds = async (student_id, excludeRoundId = null) => {
  const rows = await prisma.subjectResult.findMany({
    where: {
      is_passed: true,
      exam_result: {
        student_id,
        // ... (spread) = "ถ้ามี excludeRoundId ให้แปะเงื่อนไข NOT เข้าไป ถ้าไม่มีก็ไม่แปะอะไร"
        ...(excludeRoundId ? { NOT: { round_id: Number(excludeRoundId) } } : {}),
      },
    },
    select: { subject_id: true },
  });
  // วิชาเดียวกันอาจผ่านซ้ำได้หลายรอบ (copy-forward) ตัดซ้ำออกก่อนคืน
  //   1. rows.map(...)  → เอาเฉพาะ subject_id ออกมา เช่น [1, 2, 2, 3]
  //   2. new Set(...)   → Set คือกล่องที่ห้ามมีของซ้ำ ได้ Set {1, 2, 3}
  //   3. [... ]         → แปลง Set กลับเป็น array ธรรมดา [1, 2, 3]
  return [...new Set(rows.map((r) => r.subject_id))];
};
```

- [ ] **Step 4: ส่ง `excludeRoundId` จากจุดที่เรียก**

`backend/src/modules/examResults/examResults.controller.js` บรรทัด 48 เปลี่ยนเป็น:

```js
    // ตัดใบของรอบนี้ออก — วิชาที่ผ่านในใบที่ถูกตีกลับต้องกลับมาแก้ได้
    const passedIds = await examRepo.findPassedSubjectIds(
      student.student_id,
      round.round_id,
    );
```

`backend/src/modules/rounds/rounds.controller.js` บรรทัด 45 เปลี่ยนเป็น:

```js
    // ส่ง round_id ไปด้วย ให้ already_passed ที่ frontend เห็น ตรงกับที่ backend validate ตอน POST
    const passedIds = await examRepo.findPassedSubjectIds(
      student.student_id,
      round.round_id,
    );
```

- [ ] **Step 5: รัน test อีกรอบ**

```bash
node tests/smoke-phase12-reject-edit.mjs
```

Expected: `after reject: none locked as already_passed -> 0` PASS,
`round2: 2 subjects locked from previous round -> 2` PASS
(`resubmit with flipped answers` ยังแดงเป็น 409 — Task 2 แก้)

- [ ] **Step 6: รันชุดเดิมทั้งหมด กันของเดิมพัง**

```bash
cd backend && npm test
```

Expected: `smoke-phase11-carry-forward.mjs` ยัง ALL PASSED
(รอบ 2/3 ของไฟล์นั้นดู carry-forward ข้ามรอบ ซึ่งไม่ถูกกระทบ)

- [ ] **Step 7: อัปเดต BACKEND_GUIDE.md**

ในหัวข้อกฎธุรกิจของ exam-results เพิ่ม:

```markdown
- `findPassedSubjectIds(student_id, excludeRoundId)` — วิชาที่เคยสอบผ่านจาก **รอบอื่น** เท่านั้น
  ต้องส่ง `excludeRoundId` เป็นรอบที่กำลังกรอกเสมอ ไม่งั้นใบที่ถูกตีกลับจะล็อกวิชาของตัวเอง
```

ท้ายไฟล์ Changelog เพิ่ม:

```markdown
- 2026-08-04 fix: ตัดรอบปัจจุบันออกจาก findPassedSubjectIds — ใบที่ถูกตีกลับแก้ได้ทุกวิชาแล้ว
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/examResults/examResults.repository.js \
        backend/src/modules/examResults/examResults.controller.js \
        backend/src/modules/rounds/rounds.controller.js \
        backend/tests/smoke-phase12-reject-edit.mjs \
        backend/BACKEND_GUIDE.md
git commit -m "fix: stop a rejected result from locking its own subjects

findPassedSubjectIds scanned every exam_result of the student, so the
result being redone counted as a previous round. A student rejected in
attempt 1 saw the subjects they had just marked as passed locked behind
\"already passed in an earlier round\" and could not correct them.

Callers now pass the round being filled so it is excluded.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: หน้าต่างแก้ไขผลสอบ — แก้ได้จนกว่าจะยืนยันหรือรอบปิด

**Files:**
- Modify: `backend/src/modules/examResults/examResults.controller.js:36-42`
- Modify: `backend/tests/smoke-phase11-carry-forward.mjs:172-212` (ความคาดหวังเดิมเปลี่ยน)
- Test: `backend/tests/smoke-phase12-reject-edit.mjs` (เพิ่ม assertion)

**Interfaces:**
- Consumes: `examRepo.findByStudentAndRound()`, `examRepo.resubmitWithSubjects(result_id, subjectResults)` — มีอยู่แล้ว, reset `staff_status/remark/confirmed_by/confirmed_at` ให้เองอยู่แล้ว
- Produces: กติกา HTTP ที่ Task 6 (frontend) พึ่งพา — `pending` ส่งทับได้ 200, `approved` → 409

- [ ] **Step 1: เพิ่ม test เคสหน้าต่างแก้ไข**

ใน `backend/tests/smoke-phase12-reject-edit.mjs` แทรกก่อนบรรทัด `await call("PUT", \`/api/rounds/${r1}\`, ... "closed" ...)`:

```js
    // ---- ยังไม่ตรวจ (pending) = แก้ได้ ----
    const editPending = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id, i) => ({ subject_id: id, is_passed: i < 2 })) },
    });
    check("edit while pending -> 200", editPending.status, 200);
    check("  still pending", editPending.json.data?.staff_status, "pending");
    check("  new answers stored (2 pass)",
      editPending.json.data?.subject_results?.filter((s) => s.is_passed).length, 2);

    // ---- เจ้าหน้าที่ยืนยันแล้ว = ล็อก ----
    await call("PATCH", `/api/exam-results/${resultId}/approve`, { token: oToken });
    const afterApprove = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id) => ({ subject_id: id, is_passed: true })) },
    });
    check("edit after approve -> 409", afterApprove.status, 409);
```

**หมายเหตุ:** หลัง `approve` แล้ว 2 วิชาที่ผ่าน (index 0,1) จะกลายเป็น carry-forward ของรอบ 2
ต้องแก้ assertion ท้ายไฟล์จาก `2 subjects locked` ให้ยังเป็น `2` (index 0,1 ผ่าน) — ตรงกันพอดี ไม่ต้องแก้

- [ ] **Step 2: รัน test ให้เห็นว่าแดง**

```bash
node backend/tests/smoke-phase12-reject-edit.mjs
```

Expected: FAIL `edit while pending -> 409 (want 200)`

- [ ] **Step 3: แก้กติกาใน controller**

`backend/src/modules/examResults/examResults.controller.js` แทนที่บรรทัด 36-42:

```js
    const existing = await examRepo.findByStudentAndRound(
      student.student_id,
      round.round_id,
    );
    // แก้ได้จนกว่าเจ้าหน้าที่จะยืนยัน หรือรอบจะปิด — อย่างใดอย่างหนึ่งมาก่อน
    // (รอบปิดไม่ต้องเช็คตรงนี้ เพราะ findActive ด้านบนคืน null ไปแล้ว)
    // ยืนยันแล้วต้องล็อก ไม่งั้นนักศึกษาเปลี่ยนผลหลังเจ้าหน้าที่เซ็นไปแล้วได้
    if (existing?.staff_status === STAFF_STATUS.APPROVED) {
      throw httpError("เจ้าหน้าที่ยืนยันผลสอบรอบนี้แล้ว แก้ไขไม่ได้", 409);
    }
    const isRedo = Boolean(existing);
```

- [ ] **Step 4: รัน test ใหม่**

```bash
node backend/tests/smoke-phase12-reject-edit.mjs
```

Expected: ALL PASSED

- [ ] **Step 5: แก้ความคาดหวังเดิมใน smoke-phase11**

`backend/tests/smoke-phase11-carry-forward.mjs` — 3 จุดที่กติกาเปลี่ยน:

บรรทัด 172-176 เปลี่ยนจาก:

```js
    const again = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id) => ({ subject_id: id, is_passed: true })) },
    });
    check("submit same round twice -> 409", again.status, 409);
```

เป็น:

```js
    // ส่งซ้ำระหว่างที่ยังไม่ตรวจ = แก้ไข ไม่ใช่ error
    // ส่งชุดเดิม (3 ผ่าน / 2 ตก) เพื่อไม่ให้ตัวเลขของรอบถัดไปเพี้ยน
    const again = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id, i) => ({ subject_id: id, is_passed: i < 3 })) },
    });
    check("edit same round while pending -> 200", again.status, 200);
```

บรรทัด 201-205 เปลี่ยนจาก:

```js
    const redoAgain = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id) => ({ subject_id: id, is_passed: true })) },
    });
    check("resubmit while pending -> 409", redoAgain.status, 409);
```

เป็น:

```js
    // ส่งทับได้เรื่อยๆ ตราบใดที่ยังไม่ถูกยืนยัน — ส่งชุดเดิมไว้ ตัวเลขรอบ 2 จะได้ไม่เพี้ยน
    const redoAgain = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: ids.slice(0, 5).map((id, i) => ({ subject_id: id, is_passed: i < 3 })) },
    });
    check("resubmit while pending -> 200", redoAgain.status, 200);
```

บรรทัด 207-212 (`resubmit after approve -> 409`) **ไม่ต้องแก้** — ยังถูกต้องตามกติกาใหม่

- [ ] **Step 6: รันชุดเต็ม**

```bash
cd backend && npm test && node tests/smoke-phase12-reject-edit.mjs
```

Expected: ทุกไฟล์ ALL PASSED

- [ ] **Step 7: อัปเดต BACKEND_GUIDE.md**

ในตาราง endpoint `POST /api/exam-results` แก้คำอธิบายเป็น:

```markdown
| `POST /api/exam-results` | student | ส่ง/แก้ผลสอบของรอบที่เปิดอยู่ แก้ทับได้จนกว่าเจ้าหน้าที่จะยืนยัน (`approved` → 409) หรือรอบปิด (→ 400) การส่งทับ reset สถานะกลับเป็น `pending` และล้าง `remark` |
```

Changelog:

```markdown
- 2026-08-04 feat: นักศึกษาแก้ผลสอบทับได้จนกว่าเจ้าหน้าที่จะยืนยันหรือรอบปิด (เดิมส่งได้ครั้งเดียว)
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/examResults/examResults.controller.js \
        backend/tests/smoke-phase11-carry-forward.mjs \
        backend/tests/smoke-phase12-reject-edit.mjs \
        backend/BACKEND_GUIDE.md
git commit -m "feat: let students edit results until approved or round closes

Submitting was one-shot: any second POST returned 409 even while the
result still sat unreviewed. Students who spotted their own mistake had
to ask an officer to reject the result first.

A resubmit is now allowed whenever a result exists and is not approved,
and resets it to pending with the remark cleared.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: แยก carry-forward ออกจากสถิติรายวิชา

**Files:**
- Modify: `backend/prisma/schema.prisma:119-128`
- Create: migration ผ่าน `npx prisma migrate dev`
- Modify: `backend/src/modules/examResults/examResults.repository.js:100-118` (`resubmitWithSubjects`), `:122-140` (`createWithSubjects`)
- Modify: `backend/src/modules/examResults/examResults.controller.js:81-84`
- Modify: `backend/src/modules/dashboard/dashboard.service.js:38-52, 86-89`
- Test: `backend/tests/smoke-phase12-reject-edit.mjs` (เพิ่ม assertion)

**Interfaces:**
- Consumes: `findPassedSubjectIds(student_id, excludeRoundId)` จาก Task 1
- Produces:
  - `SubjectResult.carried_forward: boolean` — column ใหม่
  - `buildPerSubject()` คืน `{ subject_id, subject_code, subject_name, pass, fail, rate }` โดย `rate: number | null` (null = ไม่มีใครสอบวิชานี้ในรอบ) — Task 5 (frontend) พึ่ง shape นี้

- [ ] **Step 1: เพิ่ม test ที่ต้องแดง**

ใน `backend/tests/smoke-phase12-reject-edit.mjs` แทนที่บล็อกรอบ 2 ท้ายสุด (`const r2 = await openRound(...)` ถึง `check("round2: 2 subjects locked...")`) ด้วย:

```js
    // ---- รอบ 2: วิชาที่ผ่านจาก "รอบก่อนจริงๆ" ต้องยังล็อกอยู่ ----
    const r2 = await openRound(oToken, 2, ids.slice(0, 5));
    created.push(r2);
    const active2 = await call("GET", "/api/rounds/active", { token: sToken });
    check("round2: 2 subjects locked from previous round",
      active2.json.data?.subjects?.filter((s) => s.already_passed).length, 2);

    // ตอบเฉพาะ 3 วิชาที่ยังไม่ผ่าน ให้ผ่านหมด
    const remaining = active2.json.data.subjects.filter((s) => !s.already_passed);
    const submit2 = await call("POST", "/api/exam-results", {
      token: sToken,
      body: { subject_results: remaining.map((s) => ({ subject_id: s.subject_id, is_passed: true })) },
    });
    check("round2 submit -> 200", submit2.status, 200);
    check("  stored all 5 (carry-forward filled the rest)",
      submit2.json.data?.subject_results?.length, 5);
    check("  2 rows flagged carried_forward",
      submit2.json.data?.subject_results?.filter((s) => s.carried_forward).length, 2);

    // สถิติรายวิชาต้องนับเฉพาะคนที่สอบวิชานั้นจริงในรอบนี้
    // 2 วิชาที่ยกมาต้องขึ้น rate: null ไม่ใช่ 100%
    const stats = await call("GET", `/api/dashboard/stats?round_id=${r2}`, { token: oToken });
    check("stats -> 200", stats.status, 200);
    check("  perSubject scoped to round", stats.json.data?.perSubject?.length, 5);
    check("  2 subjects have no real sitters",
      stats.json.data?.perSubject?.filter((s) => s.rate === null).length, 2);
    check("  carried-forward subjects count nobody",
      stats.json.data?.perSubject?.filter((s) => s.rate === null).every((s) => s.pass === 0 && s.fail === 0), true);
    check("  fullyPassed still counts carry-forward", stats.json.data?.fullyPassed, 1);
```

- [ ] **Step 2: รัน test ให้เห็นว่าแดง**

```bash
node backend/tests/smoke-phase12-reject-edit.mjs
```

Expected: FAIL `2 rows flagged carried_forward -> 0 (want 2)` และ `2 subjects have no real sitters -> 0 (want 2)`

- [ ] **Step 3: เพิ่ม column ใน schema**

`backend/prisma/schema.prisma` แก้ model `SubjectResult`:

```prisma
model SubjectResult {
  subject_result_id Int        @id @default(autoincrement())
  result_id         Int
  subject_id        Int
  is_passed         Boolean
  // true = ไม่ได้สอบวิชานี้ในรอบนี้ ผลผ่านยกมาจากรอบก่อน (copy-forward)
  // แยกไว้เพื่อให้สถิติรายวิชานับเฉพาะคนที่สอบจริง ไม่ใช่คนที่ยกผลมา
  // default false = แถวเก่าก่อนมี column นี้ ถือว่าสอบจริงทั้งหมด
  carried_forward   Boolean    @default(false)
  exam_result       ExamResult @relation(fields: [result_id], references: [result_id])
  subject           Subject    @relation(fields: [subject_id], references: [subject_id])

  @@map("subject_results")
}
```

- [ ] **Step 4: สร้าง migration**

```bash
cd backend && npx prisma migrate dev --name add_carried_forward_to_subject_results
```

Expected: สร้างโฟลเดอร์ใหม่ใต้ `backend/prisma/migrations/` และ regenerate Prisma Client

- [ ] **Step 5: บันทึกค่า `carried_forward` ตอนสร้าง/แก้**

`backend/src/modules/examResults/examResults.repository.js` — ทั้ง `resubmitWithSubjects` และ `createWithSubjects` ใช้ `.map()` ก้อนเดียวกัน แยกออกมาเป็นตัวช่วยเหนือทั้งสองฟังก์ชัน:

```js
// แปลงผลรายวิชาให้อยู่ในรูปที่ Prisma รับ — ใช้ทั้งตอนสร้างใหม่และตอนส่งทับ
const toSubjectRows = (subjectResults) =>
  subjectResults.map((s) => ({
    subject_id: Number(s.subject_id),
    is_passed: Boolean(s.is_passed),
    carried_forward: Boolean(s.carried_forward),
  }));
```

แล้วใน `resubmitWithSubjects` เปลี่ยน `create: subjectResults.map((s) => ({ ... }))` เป็น `create: toSubjectRows(subjectResults)`
และใน `createWithSubjects` เปลี่ยนก้อน `.map()` เดียวกันเป็น `create: toSubjectRows(subjectResults)` เช่นกัน

- [ ] **Step 6: ตั้งค่าใน controller**

`backend/src/modules/examResults/examResults.controller.js` แทนที่ก้อน `finalResults` (บรรทัด ~81-84):

```js
    const finalResults = roundSubjectIds.map((id) => ({
      subject_id: id,
      is_passed: passedIds.includes(id) ? true : answers.get(id),
      // ยกมาจากรอบก่อน ไม่ได้สอบรอบนี้ — dashboard ต้องไม่นับเป็นคนสอบผ่าน
      carried_forward: passedIds.includes(id),
    }));
```

- [ ] **Step 7: ตัด carry-forward ออกจากสถิติรายวิชา**

`backend/src/modules/dashboard/dashboard.service.js` แทนที่ `buildPerSubject`:

```js
// ผ่าน/ไม่ผ่าน แยกรายวิชา นับเฉพาะคนที่ "สอบวิชานั้นจริงในรอบนี้"
// วิชาที่ทุกคนยกผลผ่านมาจากรอบก่อน (carried_forward) ไม่มีใครสอบ ต้องไม่ขึ้น 100%
// rate: null แปลว่า "ไม่มีข้อมูล" คนละเรื่องกับ 0 ที่แปลว่า "ตกหมด"
const buildPerSubject = (sent, subjects) =>
  subjects.map((sub) => {
    const marks = sent
      .map((r) => r.subject_results.find((x) => x.subject_id === sub.subject_id))
      .filter((m) => m && !m.carried_forward);
    const pass = marks.filter((m) => m.is_passed).length;
    return {
      subject_id: sub.subject_id,
      subject_code: sub.subject_code,
      subject_name: sub.subject_name,
      pass,
      fail: marks.length - pass,
      rate: marks.length ? percent(pass, marks.length) : null,
    };
  });
```

และแก้ `subjectPassRate` (บรรทัด ~86-89) ให้ข้ามวิชาที่ไม่มีผู้สอบ:

```js
  // เฉลี่ยอัตราผ่านของทุกวิชา — คนละตัวกับ fullyPassedRate ที่นับเป็นรายคน
  // ข้ามวิชาที่ไม่มีใครสอบจริง ไม่งั้นตัวหารจะรวมวิชาที่ไม่มีข้อมูลเข้ามาด้วย
  const sat = perSubject.filter((s) => s.rate !== null);
  const subjectPassRate = percent(
    sat.reduce((sum, s) => sum + s.pass, 0),
    sat.reduce((sum, s) => sum + s.pass + s.fail, 0),
  );
```

**ไม่แตะ** `countFullyPassed` และ `buildStudentRows` — "ผ่านครบทุกวิชา" ต้องนับวิชาที่ยกมาด้วย ถึงจะถูก

- [ ] **Step 8: รัน test**

```bash
node backend/tests/smoke-phase12-reject-edit.mjs && cd backend && npm test
```

Expected: ทุกไฟล์ ALL PASSED
(`smoke-phase11` บรรทัด 238 `perSubject scoped to round -> 6` ยังผ่าน เพราะนับ "จำนวนวิชา" ไม่ใช่ค่า rate)

- [ ] **Step 9: อัปเดต BACKEND_GUIDE.md**

หัวข้อ schema เพิ่มบรรทัดใต้ `subject_results`:

```markdown
- `carried_forward` (Boolean, default false) — `true` = ไม่ได้สอบวิชานี้ในรอบนี้ ยกผล "ผ่าน" มาจากรอบก่อน
  dashboard นับอัตราผ่านรายวิชาเฉพาะแถวที่ `false` แต่ "ผ่านครบทุกวิชา" นับทั้งหมด
```

หัวข้อ dashboard เพิ่ม:

```markdown
- `perSubject[].rate` เป็น `null` เมื่อไม่มีใครสอบวิชานั้นจริงในรอบ — frontend ต้องแสดง `—` ไม่ใช่ 0%
```

Changelog:

```markdown
- 2026-08-04 feat: เพิ่ม subject_results.carried_forward — อัตราผ่านรายวิชานับเฉพาะคนที่สอบจริง
```

- [ ] **Step 10: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations \
        backend/src/modules/examResults/examResults.repository.js \
        backend/src/modules/examResults/examResults.controller.js \
        backend/src/modules/dashboard/dashboard.service.js \
        backend/tests/smoke-phase12-reject-edit.mjs \
        backend/BACKEND_GUIDE.md
git commit -m "feat: exclude carried-forward marks from per-subject pass rates

Copy-forward writes a passing subject_result for every subject the
student already cleared, so the dashboard counted subjects nobody sat
this round as 100% passed.

subject_results.carried_forward now marks those rows. Per-subject stats
skip them and report rate: null when no one sat the subject; the
fully-passed count still includes them, since clearing a subject in an
earlier round does count towards passing everything.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Donut และตัวหารให้บวกกันได้พอดี

**Files:**
- Modify: `backend/src/modules/dashboard/dashboard.repository.js:54-69`
- Test: `backend/tests/smoke-phase12-reject-edit.mjs` (เพิ่ม assertion)

**Interfaces:**
- Consumes: `dashRepo.countEligibleByYear(academic_year)` — มีอยู่แล้ว
- Produces: invariant ที่ Task 5 พึ่ง — `by.approved + by.submitted + by.rejected + by.draft + not_started === eligible`

- [ ] **Step 1: เพิ่ม test ที่ต้องแดง**

ใน `backend/tests/smoke-phase12-reject-edit.mjs` ต่อท้ายบล็อกรอบ 2 (หลัง `check("  fullyPassed still counts carry-forward", ...)`):

```js
    // ---- ปิดสิทธิ์คนที่ส่งไปแล้ว → สัดส่วนใน donut ต้องยังบวกได้เท่า eligible ----
    await call("PATCH", "/api/students/bulk-eligible", {
      token: oToken, body: { student_ids: [STUDENT_ID], exam_eligible: false },
    });
    const afterRevoke = await call("GET", `/api/dashboard/stats?round_id=${r2}`, { token: oToken });
    const d = afterRevoke.json.data;
    check("donut segments sum to eligible",
      d.by.approved + d.by.submitted + d.by.rejected + d.by.draft + d.not_started,
      d.eligible);

    // คืนสิทธิ์ให้เหมือนเดิม
    await call("PATCH", "/api/students/bulk-eligible", {
      token: oToken, body: { student_ids: [STUDENT_ID], exam_eligible: true },
    });
```

- [ ] **Step 2: รัน test ให้เห็นว่าแดง**

```bash
node backend/tests/smoke-phase12-reject-edit.mjs
```

Expected: FAIL `donut segments sum to eligible -> 1 (want 0)` — `by.submitted` ยังนับใบของคนที่ถูกปิดสิทธิ์

- [ ] **Step 3: กรอง results ที่ repository**

`backend/src/modules/dashboard/dashboard.repository.js` แทนที่ `findResultsByRound`:

```js
// ผลสอบทั้งหมดในรอบ + ผลรายวิชา (ใช้คำนวณสถิติ)
// เอาเฉพาะนักศึกษาที่ยังมีสิทธิ์กรอก — ตัวหารทุกตัวใน dashboard คือ eligible
// ถ้าไม่กรอง คนที่ส่งแล้วโดนปิดสิทธิ์ทีหลังจะทำให้ผลรวมของ donut เกิน eligible
// แล้ว Math.max(...) ใน not_started จะตัดเป็น 0 วงกับตัวเลขตรงกลางเลยไม่ตรงกัน
export const findResultsByRound = (roundId) =>
  prisma.examResult.findMany({
    where: {
      round_id: Number(roundId),
      student: { exam_eligible: true },
    },
    include: {
      subject_results: true,
      student: {
        select: {
          student_id: true,
          academic_year: true,
          user: { select: { first_name: true, last_name: true } },
        },
      },
    },
    orderBy: { student_id: "asc" },
  });
```

- [ ] **Step 4: รัน test**

```bash
node backend/tests/smoke-phase12-reject-edit.mjs && cd backend && npm test
```

Expected: ทุกไฟล์ ALL PASSED

- [ ] **Step 5: อัปเดต BACKEND_GUIDE.md**

หัวข้อ dashboard เพิ่ม:

```markdown
- สถิติทุกตัวนับเฉพาะนักศึกษาที่ `exam_eligible = true` — รับประกันว่า
  `by.approved + by.submitted + by.rejected + by.draft + not_started === eligible` เสมอ
  (มีผลกับรายงาน PDF ด้วย เพราะใช้ `findResultsByRound` ตัวเดียวกัน)
```

Changelog:

```markdown
- 2026-08-04 fix: dashboard นับเฉพาะนักศึกษาที่มีสิทธิ์กรอก — สัดส่วนใน donut ตรงกับตัวเลขกลางแล้ว
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/dashboard/dashboard.repository.js \
        backend/tests/smoke-phase12-reject-edit.mjs \
        backend/BACKEND_GUIDE.md
git commit -m "fix: count only eligible students in dashboard stats

not_started was eligible minus every result in the round, including
results from students whose eligibility was revoked after submitting.
Math.max clamped the difference to 0 and the donut segments stopped
adding up to the count in its centre.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Dashboard frontend — วิชาที่ไม่มีผู้สอบแสดง `—`

**Files:**
- Modify: `frontend/src/design/dashboardReal.jsx:95-107`
- Modify: `frontend/src/design/i18n.js` (เพิ่ม key ทั้ง TH และ EN)

**Interfaces:**
- Consumes: `perSubject[].rate: number | null` จาก Task 3
- Produces: ไม่มีอะไรที่ task อื่นใช้ต่อ

- [ ] **Step 1: เพิ่ม i18n key**

`frontend/src/design/i18n.js` — ใต้ `'dashReal.passFailSub'` ในบล็อก `TH`:

```js
    'dashReal.noExamThisRound': 'ไม่มีผู้สอบวิชานี้ในรอบนี้',
```

ใต้บรรทัดเดียวกันในบล็อก `EN`:

```js
    'dashReal.noExamThisRound': 'No one sat this subject this round',
```

- [ ] **Step 2: แสดงบาร์เทาเมื่อ rate เป็น null**

`frontend/src/design/dashboardReal.jsx` แทนที่ก้อน `{perSubject.map(...)}` (บรรทัด 101-105):

```jsx
            {perSubject.map(sub => {
              const label = `${sub.subject_code} · ${subjectName(lang, sub.subject_code, sub.subject_name)}`;
              // rate = null คือไม่มีใครสอบวิชานี้ในรอบ (ทุกคนยกผลผ่านมาจากรอบก่อน)
              // แสดง — ไม่ใช่ 0% เพราะ 0% แปลว่าสอบแล้วตกหมด คนละเรื่องกัน
              if (sub.rate === null) return (
                <BarRow key={sub.subject_id} label={label} value={0} max={100}
                  color="var(--ink-200)" right="—" sub={tt('dashReal.noExamThisRound')} />
              );
              return (
                <BarRow key={sub.subject_id} label={label} value={sub.rate} max={100}
                  color={sub.rate >= 70 ? 'var(--status-ok-dot)' : sub.rate >= 40 ? 'var(--status-wait-dot)' : 'var(--status-reject-dot)'}
                  right={`${sub.rate}%`} sub={tt('dashReal.passFailSub', { pass: sub.pass, fail: sub.fail })} />
              );
            })}
```

- [ ] **Step 3: ตรวจด้วยตาบน dev server**

```bash
cd frontend && npm run dev
```

Login เจ้าหน้าที่ → Dashboard → เลือกรอบที่มีวิชา carry-forward
Expected: วิชาที่ไม่มีใครสอบขึ้นบาร์เทา `—` พร้อมข้อความ "ไม่มีผู้สอบวิชานี้ในรอบนี้"
สลับ EN แล้วข้อความต้องเปลี่ยนตาม

- [ ] **Step 4: Commit**

```bash
git add frontend/src/design/dashboardReal.jsx frontend/src/design/i18n.js
git commit -m "fix: show a dash for subjects nobody sat this round

Subjects everyone carried forward reported rate 0 from the API and
rendered as a red 0% bar, which reads as \"everyone failed\".

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: ฟอร์มกรอกผลสอบ — แก้ได้ตอน pending

**Files:**
- Modify: `frontend/src/design/examFormReal.jsx:18, 40-45, 100-115, 173-176`
- Modify: `frontend/src/design/i18n.js`

**Interfaces:**
- Consumes: `GET /api/exam-results/me` (มี `staff_status`, `remark`, `round_id`), กติกา 409-on-approved จาก Task 2
- Produces: ไม่มีอะไรที่ task อื่นใช้ต่อ

- [ ] **Step 1: เพิ่ม i18n key**

`frontend/src/design/i18n.js` บล็อก `TH` ใต้ `'examform.rejectedResubmitNote'`:

```js
    'examform.editableTitle': 'ส่งผลสอบแล้ว รอเจ้าหน้าที่ตรวจ',
    'examform.editableNote': 'แก้ไขได้จนกว่าเจ้าหน้าที่จะยืนยัน หรือรอบจะปิด',
    'examform.editBtn': 'บันทึกการแก้ไข',
```

บล็อก `EN` ตำแหน่งเดียวกัน:

```js
    'examform.editableTitle': 'Submitted, awaiting review',
    'examform.editableNote': 'You can still edit until an officer confirms it or the round closes',
    'examform.editBtn': 'Save changes',
```

- [ ] **Step 2: เก็บใบเดิมไว้ทั้งก้อน ไม่ใช่เฉพาะที่ถูกตีกลับ**

`frontend/src/design/examFormReal.jsx` บรรทัด 18 เปลี่ยนจาก:

```jsx
  const [rejected, setRejected] = useState(null); // ใบที่ถูกตีกลับ ต้องกรอกใหม่ทับของเดิม
```

เป็น:

```jsx
  // ใบของรอบนี้ที่ส่งไปแล้ว (ถ้ามี) — แก้ทับได้จนกว่าเจ้าหน้าที่จะยืนยันหรือรอบจะปิด
  const [existing, setExisting] = useState(null);
```

บรรทัด 43-45 เปลี่ยนจาก:

```jsx
        const inRound = mine.find(r => r.round_id === activeRound.round_id);
        if (inRound && inRound.staff_status === 'rejected') setRejected(inRound);
        else if (inRound) setBlocked(tt('examform.alreadySubmittedRound'));
```

เป็น:

```jsx
        const inRound = mine.find(r => r.round_id === activeRound.round_id);
        // ยืนยันแล้วเท่านั้นที่ล็อก — pending กับ rejected ยังแก้ได้ (backend เช็คซ้ำอีกชั้น)
        if (inRound?.staff_status === 'approved') setBlocked(tt('examform.alreadySubmittedRound'));
        else if (inRound) setExisting(inRound);
```

- [ ] **Step 3: แบนเนอร์ต่างกันตามสถานะ**

แทนที่ก้อน `{rejected && (...)}` ทั้งบล็อก (บรรทัด 103-115) ด้วย:

```jsx
      {existing?.staff_status === 'rejected' && (
        <div className="card card-pad" style={{ borderLeft: '4px solid var(--status-reject-fg)', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Icon name="xCircle" size={22} style={{ color: 'var(--status-reject-fg)', flex: 'none', marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 3 }}>{tt('examform.rejectedTitle')}</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-700)' }}>
                {existing.remark || tt('examform.rejectedDefaultReason')}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 6 }}>
                {tt('examform.rejectedResubmitNote')}
              </div>
            </div>
          </div>
        </div>
      )}

      {existing?.staff_status === 'pending' && (
        <div className="card card-pad" style={{ borderLeft: '4px solid var(--status-wait-fg)', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Icon name="clock" size={22} style={{ color: 'var(--status-wait-fg)', flex: 'none', marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 3 }}>{tt('examform.editableTitle')}</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-700)' }}>{tt('examform.editableNote')}</div>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 4: ป้ายหัวข้อและปุ่มตามสถานะ**

บรรทัด 100 เปลี่ยน `title={rejected ? ...}` เป็น:

```jsx
      <PageHead title={existing ? tt('examform.editTitle') : tt('nav.student.form')}
```

บรรทัด 175 เปลี่ยนป้ายปุ่มเป็น:

```jsx
              {submitting ? tt('common.submitting')
                : existing?.staff_status === 'rejected' ? tt('examform.resubmitBtn')
                : existing ? tt('examform.editBtn')
                : tt('review.submitBtn')} <Icon name="send" size={16} />
```

- [ ] **Step 5: ตั้งค่าเริ่มต้นของช่องผ่าน/ไม่ผ่านจากใบเดิม**

ต่อท้าย `else if (inRound) setExisting(inRound);` ใน Step 2 เพิ่ม:

```jsx
        // เติมคำตอบเดิมกลับเข้าฟอร์ม ไม่งั้นนักศึกษาต้องติ๊กใหม่หมดทั้งที่แก้แค่วิชาเดียว
        if (inRound && inRound.staff_status !== 'approved') {
          const prev = {};
          for (const sr of inRound.subject_results || []) {
            if (!sr.carried_forward) prev[sr.subject_id] = sr.is_passed;
          }
          setResults(prev);
        }
```

- [ ] **Step 6: ตรวจด้วยตา**

```bash
cd frontend && npm run dev
```

1. Login นักศึกษา → กรอกผลสอบ → ส่ง
2. เข้าหน้ากรอกผลสอบอีกครั้ง
   Expected: แบนเนอร์เหลือง "ส่งผลสอบแล้ว รอเจ้าหน้าที่ตรวจ", ช่องติ๊กเติมคำตอบเดิมไว้, ปุ่ม "บันทึกการแก้ไข"
3. Login เจ้าหน้าที่ → ตีกลับ พร้อม remark
4. กลับไปนักศึกษา → หน้ากรอกผลสอบ
   Expected: แบนเนอร์แดงพร้อม remark, **ทุกวิชาของรอบแก้ได้** ไม่มี "ผ่านแล้วจากรอบก่อน", ปุ่ม "ส่งผลสอบใหม่"
5. เจ้าหน้าที่ยืนยัน → นักศึกษาเข้าหน้ากรอก
   Expected: ถูกบล็อก แก้ไม่ได้

- [ ] **Step 7: Commit**

```bash
git add frontend/src/design/examFormReal.jsx frontend/src/design/i18n.js
git commit -m "feat: let students edit a pending submission from the form

The form only reopened for rejected results; a pending one was blocked
outright. It now reopens for anything not yet approved, prefills the
previous answers, and labels the banner and button per status.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: แจ้งเตือนนักศึกษา

**Files:**
- Create: `frontend/src/design/notifications.js`
- Modify: `frontend/src/design/components.jsx:47-95` (`TopBar`)
- Modify: `frontend/src/design/app.jsx:64-170`
- Modify: `frontend/src/design/i18n.js`

**Interfaces:**
- Consumes: `apiFetch` จาก `./api.js`, `GET /api/exam-results/me`, `GET /api/news`
- Produces:
  - `buildNotifications({ role, examResults, news, lang }) → Array<{ key, tone, icon, title, sub, page, at }>`
  - `readKeys(userId) → string[]`, `markAllRead(userId, keys) → void`
  - `TopBar` prop `notifications: Array<...>` และ `onNotifOpen: () => void`

- [ ] **Step 1: เพิ่ม i18n key**

`frontend/src/design/i18n.js` บล็อก `TH` ใต้ `'topbar.notifEmptySub'`:

```js
    'notif.rejectedTitle': 'ผลสอบถูกตีกลับ',
    'notif.rejectedSub': 'รอบที่ {attempt}/{year} · {remark}',
    'notif.rejectedNoRemark': 'กรุณาแก้ไขแล้วส่งใหม่',
    'notif.approvedTitle': 'ผลสอบได้รับการยืนยันแล้ว',
    'notif.approvedSub': 'รอบที่ {attempt}/{year}',
    'notif.newsTitle': 'ประกาศใหม่',
```

บล็อก `EN` ตำแหน่งเดียวกัน:

```js
    'notif.rejectedTitle': 'Exam result returned',
    'notif.rejectedSub': 'Round {attempt}/{year} · {remark}',
    'notif.rejectedNoRemark': 'Please correct it and submit again',
    'notif.approvedTitle': 'Exam result confirmed',
    'notif.approvedSub': 'Round {attempt}/{year}',
    'notif.newsTitle': 'New announcement',
```

- [ ] **Step 2: สร้างตัวสร้างรายการแจ้งเตือน**

สร้าง `frontend/src/design/notifications.js`:

```js
/* ============================================================
   แจ้งเตือน — ประกอบจาก endpoint ที่มีอยู่ ไม่มีตาราง notifications ใน DB
   ข้อมูล "ถูกตีกลับ + remark" กับ "ประกาศ" อยู่ใน exam_results/news ครบแล้ว
   ตารางใหม่จะเป็นข้อมูลซ้ำที่ต้องคอย sync
   ============================================================ */
import { t } from './i18n.js';

const READ_PREFIX = 'notif_read_';
const NEWS_LIMIT = 5;

// key ใส่สถานะไว้ด้วย เพื่อให้ ตีกลับ → แก้ → ยืนยัน ขึ้นเป็นแจ้งเตือน "ใหม่"
// ไม่ใช่ของเก่าที่เคยกดอ่านไปแล้ว
const examKey = (r) => `exam:${r.result_id}:${r.staff_status}`;
const newsKey = (n) => `news:${n.news_id}`;

export function readKeys(userId) {
  try {
    return JSON.parse(localStorage.getItem(READ_PREFIX + userId) || '[]');
  } catch {
    return []; // localStorage เสีย/ถูกแก้มือ — ถือว่ายังไม่เคยอ่านอะไร ดีกว่าหน้าพัง
  }
}

export function markAllRead(userId, keys) {
  const merged = [...new Set([...readKeys(userId), ...keys])];
  // เก็บแค่ 200 อันล่าสุดพอ ไม่ให้ localStorage โตไม่จำกัด
  localStorage.setItem(READ_PREFIX + userId, JSON.stringify(merged.slice(-200)));
}

// examResults = ผลของนักศึกษาเอง (role อื่นส่ง [] มา), news = ประกาศทั้งหมด
export function buildNotifications({ role, examResults = [], news = [], lang = 'TH' }) {
  const tt = (key, vars) => t(lang, key, vars);
  const items = [];

  if (role === 'student') {
    for (const r of examResults) {
      const round = { attempt: r.round?.attempt_number, year: r.round?.academic_year };
      if (r.staff_status === 'rejected') {
        items.push({
          key: examKey(r), tone: 'reject', icon: 'xCircle', page: 'form',
          title: tt('notif.rejectedTitle'),
          sub: tt('notif.rejectedSub', { ...round, remark: r.remark || tt('notif.rejectedNoRemark') }),
          at: r.confirmed_at || r.submitted_at,
        });
      } else if (r.staff_status === 'approved') {
        items.push({
          key: examKey(r), tone: 'ok', icon: 'checkCircle', page: 'status',
          title: tt('notif.approvedTitle'),
          sub: tt('notif.approvedSub', round),
          at: r.confirmed_at || r.submitted_at,
        });
      }
    }
  }

  for (const n of news.slice(0, NEWS_LIMIT)) {
    items.push({
      key: newsKey(n), tone: 'wait', icon: 'bell', page: 'news',
      title: tt('notif.newsTitle'), sub: n.title, at: n.posted_at,
    });
  }

  // ใหม่สุดขึ้นก่อน — ค่าที่ไม่มีวันที่ให้ไปท้ายสุด
  return items.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
}
```

- [ ] **Step 3: ให้ TopBar รับ list จริง**

`frontend/src/design/components.jsx` เปลี่ยน signature บรรทัด 47:

```jsx
export function TopBar({ role, roleLabel, user, onMenu, onSwitchRole, notifications = [], unread = 0, onNotifOpen, onNotifGo, lang='TH', setLang }) {
```

เปลี่ยนปุ่มกระดิ่ง (บรรทัด 70-75):

```jsx
      <button className="btn btn-ghost btn-sm" style={{ position:'relative', padding:9, border:'1px solid var(--ink-200)' }}
        onClick={()=>{ setNotifOpen(true); onNotifOpen?.(); }}>
        <Icon name="bell" size={19} />
        {unread>0 && <span style={{ position:'absolute', top:5, right:5, width:8, height:8, borderRadius:'50%',
          background:'var(--fail)', boxShadow:'0 0 0 2px #fff' }}></span>}
      </button>
```

แทนที่เนื้อใน `<Modal ...>` (ก้อน `{NOTIFS[role] ? ... : ...}`) ด้วย:

```jsx
        {notifications.length ? (
          <div style={{ minHeight:440, display:'flex', flexDirection:'column', gap:2 }}>
            {notifications.map((n,i)=>(
              <button key={n.key} onClick={()=>{ setNotifOpen(false); onNotifGo?.(n.page); }}
                style={{ display:'flex', alignItems:'flex-start', gap:13, padding:'13px 6px', width:'100%',
                  background:'transparent', border:'none', borderBottom: i<notifications.length-1?'1px solid var(--ink-100)':'none',
                  textAlign:'left', cursor:'pointer', fontFamily:'inherit' }}>
                <div style={{ width:38, height:38, borderRadius:10, flex:'none', display:'flex', alignItems:'center', justifyContent:'center',
                  background:`var(--status-${n.tone}-bg)`, color:`var(--status-${n.tone}-fg)` }}><Icon name={n.icon} size={18}/></div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--ink-900)' }}>{n.title}</div>
                  <div style={{ fontSize:13, color:'var(--ink-500)', marginTop:2 }}>{n.sub}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ minHeight:440, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Empty icon="bell" title={t(lang,'topbar.notifEmptyTitle')} sub={t(lang,'topbar.notifEmptySub')} />
          </div>
        )}
```

ลบ import/ตัวแปร `NOTIFS` ที่ไม่ถูกใช้แล้วออกจากไฟล์

- [ ] **Step 4: ต่อสายใน app.jsx**

`frontend/src/design/app.jsx` เพิ่ม import ด้านบน:

```jsx
import { buildNotifications, readKeys, markAllRead } from './notifications.js';
```

ใน `App()` ใต้ `const [pendingCount, setPendingCount] = useState(0);` เพิ่ม:

```jsx
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
```

เพิ่ม effect ใต้ effect ของ `pendingCount`:

```jsx
  // แจ้งเตือน — ประกอบจาก endpoint ที่มีอยู่ ดึงใหม่ทุกครั้งที่เปลี่ยนหน้า
  // นักศึกษาเห็นผลของตัวเอง + ประกาศ, role อื่นเห็นแค่ประกาศ
  useEffect(()=>{
    if (!role || !currentUser) { setNotifications([]); setUnread(0); return; }
    let dropped = false;
    const load = async () => {
      const news = await apiFetch('/news').catch(()=>[]);
      const examResults = role === 'student'
        ? await apiFetch('/exam-results/me').catch(()=>[])
        : [];
      if (dropped) return;
      const items = buildNotifications({ role, examResults, news, lang });
      const read = readKeys(currentUser.user_id);
      setNotifications(items);
      setUnread(items.filter(n => !read.includes(n.key)).length);
    };
    load();
    return () => { dropped = true; };
  }, [role, currentUser, page, lang]);
```

ส่ง prop เข้า `TopBar` (บรรทัด ~157):

```jsx
      <TopBar role={role} roleLabel={translate(lang,'role.'+role)}
        notifications={notifications} unread={unread}
        onNotifOpen={()=>{ markAllRead(currentUser.user_id, notifications.map(n=>n.key)); setUnread(0); }}
        onNotifGo={(p)=>setPage(p)}
```

(เก็บ prop เดิมที่มีอยู่ไว้ทั้งหมด ลบเฉพาะ `notif={...}` ถ้ามี)

ตรวจว่ามี `import { apiFetch } from './api.js'` อยู่แล้วด้านบนไฟล์ ถ้าไม่มีให้เพิ่ม

- [ ] **Step 5: ตรวจด้วยตา**

```bash
cd frontend && npm run dev
```

1. Login นักศึกษาที่ถูกตีกลับ
   Expected: กระดิ่งมีจุดแดง, เปิดแล้วเห็น "ผลสอบถูกตีกลับ" + remark
2. กดรายการ → เด้งไปหน้ากรอกผลสอบ
3. ปิด modal, reload หน้า
   Expected: จุดแดงหายแล้ว
4. เจ้าหน้าที่ยืนยันผล → นักศึกษา reload
   Expected: จุดแดงกลับมา รายการเปลี่ยนเป็น "ผลสอบได้รับการยืนยันแล้ว"
5. Login เจ้าหน้าที่
   Expected: เห็นเฉพาะประกาศ ไม่มีรายการผลสอบ
6. สลับ EN → ข้อความเปลี่ยนตาม

- [ ] **Step 6: Commit**

```bash
git add frontend/src/design/notifications.js \
        frontend/src/design/components.jsx \
        frontend/src/design/app.jsx \
        frontend/src/design/i18n.js
git commit -m "feat: real notifications for students

The bell was a mock: a hardcoded badge over a static list. It now builds
from /exam-results/me and /news, so a student finds out their result was
returned and can read the officer's remark without hunting for it.

Read state lives in localStorage per user; no notifications table, since
both sources already carry the data a row would duplicate.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: ซูมรูปประกาศ

**Files:**
- Modify: `frontend/src/design/newsReal.jsx:14-26, 95`
- Modify: `frontend/src/design/i18n.js`

**Interfaces:**
- Consumes: `fetchAuthedObjectUrl('/news/:id/image')` จาก `./api.js` — มีอยู่แล้ว
- Produces: `NewsImage` prop เพิ่ม `zoomable` และ `fit` (`'cover' | 'contain'`)

- [ ] **Step 1: เพิ่ม i18n key**

`frontend/src/design/i18n.js` บล็อก `TH`:

```js
    'news.zoomHint': 'คลิกที่รูปเพื่อขยาย',
    'news.zoomIn': 'ขยาย',
    'news.zoomOut': 'ย่อ',
    'news.zoomReset': 'ขนาดเดิม',
    'news.zoomClose': 'ปิด',
```

บล็อก `EN`:

```js
    'news.zoomHint': 'Click the image to zoom',
    'news.zoomIn': 'Zoom in',
    'news.zoomOut': 'Zoom out',
    'news.zoomReset': 'Reset zoom',
    'news.zoomClose': 'Close',
```

- [ ] **Step 2: เพิ่ม lightbox**

`frontend/src/design/newsReal.jsx` แทนที่ `NewsImage` ทั้งฟังก์ชัน (บรรทัด 14-26):

```jsx
/* รูปเต็มจอพร้อมซูม — รูปประกาศมักเป็นไดอะแกรมที่อ่านไม่ออกในขนาดย่อ
   ใช้ transform ล้วน ไม่ต้องพึ่ง library ซูมสำเร็จรูป */
function Lightbox({ url, onClose, tt }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef(null);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // กันหน้าเบื้องหลังเลื่อนตามตอน overlay เปิดอยู่
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  // จำกัด 1–5 เท่า ต่ำกว่า 1 ไม่มีประโยชน์ สูงกว่า 5 ก็เห็นแต่พิกเซล
  const zoom = next => {
    const s = Math.min(5, Math.max(1, next));
    setScale(s);
    if (s === 1) setPos({ x: 0, y: 0 }); // กลับขนาดเดิมแล้วต้องกลับมากลางจอด้วย
  };

  const onDown = e => { if (scale > 1) drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; };
  const onMove = e => { if (drag.current) setPos({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); };
  const onUp = () => { drag.current = null; };

  const btn = { border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 14, fontWeight: 700,
    fontFamily: 'inherit', cursor: 'pointer', background: 'rgba(255,255,255,.92)', color: 'var(--ink-900)' };

  return (
    <div onClick={onClose} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,.86)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 1 }}>
        <button style={btn} title={tt('news.zoomOut')} onClick={() => zoom(scale - 0.5)}>−</button>
        <button style={btn} title={tt('news.zoomReset')} onClick={() => zoom(1)}>{Math.round(scale * 100)}%</button>
        <button style={btn} title={tt('news.zoomIn')} onClick={() => zoom(scale + 0.5)}>+</button>
        <button style={btn} title={tt('news.zoomClose')} onClick={onClose}>✕</button>
      </div>
      <img src={url} alt="" draggable={false}
        onClick={e => e.stopPropagation()}
        onMouseDown={onDown}
        onWheel={e => zoom(scale + (e.deltaY < 0 ? 0.3 : -0.3))}
        style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', userSelect: 'none',
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          cursor: scale > 1 ? (drag.current ? 'grabbing' : 'grab') : 'zoom-in',
          transition: drag.current ? 'none' : 'transform .12s' }} />
    </div>
  );
}

function NewsImage({ newsId, maxHeight = 320, radius = 12, fit = 'cover', zoomable = false, tt }) {
  const [url, setUrl] = useState('');
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    let revoked = false, current = '';
    fetchAuthedObjectUrl(`/news/${newsId}/image`)
      .then(u => { if (revoked) { URL.revokeObjectURL(u); return; } current = u; setUrl(u); })
      .catch(() => {});
    return () => { revoked = true; if (current) URL.revokeObjectURL(current); };
  }, [newsId]);
  if (!url) return null;
  return (<>
    <img src={url} alt="" onClick={zoomable ? () => setZoom(true) : undefined}
      style={{ display: 'block', width: '100%', maxHeight, objectFit: fit,
        borderRadius: radius, border: '1px solid var(--ink-200)', background: 'var(--ink-50)',
        cursor: zoomable ? 'zoom-in' : 'default' }} />
    {zoom && <Lightbox url={url} onClose={() => setZoom(false)} tt={tt} />}
  </>);
}
```

เพิ่ม `useRef` ใน import ของ react ที่หัวไฟล์:

```jsx
import { useState, useEffect, useRef } from 'react';
```

- [ ] **Step 3: เปิดใช้ในหน้ารายละเอียดประกาศ**

`frontend/src/design/newsReal.jsx` บรรทัด 95 เปลี่ยนเป็น:

```jsx
          {open.image_path && <div style={{ marginBottom: 14 }}>
            <NewsImage newsId={open.news_id} maxHeight={420} fit="contain" zoomable tt={tt} />
            <div className="hint" style={{ marginTop: 6, textAlign: 'center' }}>{tt('news.zoomHint')}</div>
          </div>}
```

thumbnail ในลิสต์ (บรรทัด 81 และ 212) **ไม่ต้องแก้** — `cover` เหมาะกับกรอบเล็กสี่เหลี่ยม

- [ ] **Step 4: ตรวจด้วยตา**

```bash
cd frontend && npm run dev
```

Login นักศึกษา → ข่าวสาร/ประกาศ → เปิดประกาศที่มีรูปไดอะแกรม
Expected:
- รูปแสดงเต็มไม่ถูก crop (เห็นทั้งไดอะแกรม)
- คลิกรูป → overlay ดำเต็มจอ
- กด `+` / `−` / scroll → ซูมได้ 100%–500%
- ซูมแล้วลากเลื่อนได้
- กด `Esc` / คลิกพื้นหลัง / กด `✕` → ปิด
- ปิดแล้วหน้าเบื้องหลังเลื่อนได้ตามปกติ

- [ ] **Step 5: Commit**

```bash
git add frontend/src/design/newsReal.jsx frontend/src/design/i18n.js
git commit -m "feat: zoomable announcement images

Announcement images are usually diagrams. object-fit: cover cropped them
inside the detail modal and there was no way to see the whole thing.

The modal now fits the image and opens a full-screen viewer on click,
with wheel and button zoom plus drag panning. No new dependency.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: ตรวจรอบสุดท้ายและอัปเดตเอกสารแผนงาน

**Files:**
- Modify: `backend/Backend.md`
- Modify: `backend/package.json:scripts.test`

**Interfaces:**
- Consumes: ผลงานทุก task ก่อนหน้า
- Produces: ไม่มี

- [ ] **Step 1: ผูก smoke test ใหม่เข้าชุด `npm test`**

`backend/package.json` เปลี่ยน `scripts.test` เป็น:

```json
    "test": "node tests/smoke-phase1-3.mjs && node tests/smoke-phase4-6.mjs && node tests/smoke-phase9-import.mjs && node tests/smoke-phase10-round-subjects.mjs && node tests/smoke-phase11-carry-forward.mjs && node tests/smoke-phase12-reject-edit.mjs"
```

- [ ] **Step 2: reseed แล้วรันชุดเต็ม**

```bash
cd backend && npx prisma db seed && npm test
```

Expected: ทุกไฟล์จบด้วย `ALL PASSED` ไม่มี `FAILED` แม้แต่บรรทัดเดียว
ถ้าเจอ 401 รัวๆ = ติด rate limiter ให้ restart server แล้วรันใหม่

- [ ] **Step 3: อัปเดต Backend.md**

เพิ่มบรรทัดในตาราง progress:

```markdown
| Phase 12 | แก้ flow ตีกลับ + dashboard stats + แจ้งเตือน + ซูมรูป | ✅ |
```

- [ ] **Step 4: Commit**

```bash
git add backend/package.json backend/Backend.md
git commit -m "chore: add phase 12 smoke test to the suite

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| A. แก้ carry-forward ล็อกวิชาผิด | Task 1 |
| B. หน้าต่างแก้ไขผลสอบ | Task 2 (backend), Task 6 (frontend) |
| C. บาร์รายวิชา — ตัด carry-forward | Task 3 (backend), Task 5 (frontend) |
| D. Donut และตัวหาร | Task 4 |
| E. แจ้งเตือนนักศึกษา | Task 7 |
| F. แว่นขยายรูปประกาศ | Task 8 |
| Test 1–11 ในตาราง spec | Task 1 (1,2,3), Task 2 (4,5,6), Task 3 (7), Task 4 (8), Task 7 (9,10), Task 8 (11) |
| อัปเดต BACKEND_GUIDE.md | ทุก backend task + Task 9 |

**Type consistency:**
- `findPassedSubjectIds(student_id, excludeRoundId = null)` — ใช้ชื่อและลำดับพารามิเตอร์เดียวกันทั้ง Task 1 และ Task 3
- `perSubject[].rate: number | null` — Task 3 ผลิต, Task 5 บริโภค ตรงกัน
- `carried_forward` snake_case ทุกที่ (Prisma, API response, frontend)
- `buildNotifications({ role, examResults, news, lang })` — Task 7 นิยามและใช้ที่เดียว
- `NewsImage` prop `fit` / `zoomable` / `tt` — Task 8 นิยามและใช้ที่เดียว
