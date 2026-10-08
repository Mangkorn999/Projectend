# Backend 03 — วิชา (subjects), ห้อง (rooms), รอบการกรอก (rounds)

โฟลเดอร์: `backend/src/modules/{subjects,rooms,rounds}/`

> หลักอ่านทุกโมดูล: **controller** ตรวจ input + กฎธุรกิจ แล้วเรียก **repository** ที่คุย DB. ทุก handler ห่อ `try { ... } catch (err) { next(err) }` เพื่อส่ง error ให้ `errorHandler` กลาง

---

## 1. `subjects/subjects.repository.js` (28 บรรทัด)

| บรรทัด | ฟังก์ชัน | ทำอะไร |
|---|---|---|
| 1 | import | `prisma` client กลาง |
| 5 | `findAll` | `subject.findMany` เรียงตาม `subject_code` (ไม่เรียง = ลำดับวิชาสลับทุกครั้งที่แก้ชื่อ เพราะ Postgres ย้ายแถวที่ UPDATE ไปท้ายตาราง) |
| 7-8 | `findByIds(ids)` | หาหลายวิชาพร้อมกัน `where: { subject_id: { in: ids } }` — ใช้เช็คว่า id ที่เลือกมีจริง |
| 10-11 | `findByCode` | หาวิชาจากรหัสวิชา (`findFirst` เพราะ schema ไม่ตั้ง unique) |
| 13 | `create(data)` | สร้างวิชา |
| 15-16 | `remove(id)` | ลบวิชา (`Number(id)` แปลงจาก string) |
| 18-22 | `findRoundsUsing(id)` | หารอบที่เลือกวิชานี้ไว้ — `subject_ids` ของรอบเป็น `Int[]` ไม่ใช่ FK จึงต้องถามด้วย `has: id` |
| 24-25 | `countSubjectResults(id)` | นับผลสอบที่อ้างวิชานี้ — กันลบวิชาที่มีคนกรอกแล้ว |
| 27-28 | `updata(id, data)` | แก้วิชา (ชื่อสะกด `updata` ตามโค้ดเดิม) |

## 2. `subjects/subjects.controller.js` (116 บรรทัด)

| บรรทัด | ทำอะไร |
|---|---|
| 2 | `import * as subjectrepo` — เอาทุก export ของ repository มาอยู่ใต้ชื่อเดียว |
| 4-8 | `httpError(message, statusCode)` — สร้าง Error ที่ใส่ `statusCode` ให้ errorHandler ใช้ |
| 11-12 | ความยาวสูงสุดตรงกับ schema: รหัสวิชา 10, ชื่อวิชา 200 |
| 17-35 | `cleanSubjectInput(body, requireAll)` — **ตรวจ + ตัดช่องว่าง + เลือกเฉพาะ field ที่รับ** (ไม่ส่ง `req.body` ทั้งก้อนลง Prisma): วน 2 field; ตอนแก้ (`requireAll=false`) ข้าม field ที่ไม่ส่ง (`continue`); ต้องเป็น string ไม่ว่าง; ห้ามยาวเกิน; ถ้าไม่เหลือ field เลย → "ไม่มีข้อมูลที่จะแก้ไข" |
| 38-43 | `ensureCodeFree(code, exceptId)` — รหัสวิชาห้ามซ้ำ (`409`). `exceptId` ข้ามตัวเองตอนแก้ |
| 45-52 | `getAll` — ส่งรายวิชาทั้งหมด `{success, data}` |
| 54-63 | `createAll` — ตรวจ input → ตรวจรหัสซ้ำ → `create` |
| 65-76 | `updatasubject` — `Number(req.params.id)`; ไม่ใช่จำนวนเต็ม → 400; ตรวจ input แบบไม่บังคับครบ; ถ้าแก้รหัสวิชา ตรวจซ้ำ; `updata` |
| 78-116 | `deleteSubject` — **ด่านกันลบ 3 ชั้น**: (84-91) รอบที่ใช้วิชานี้อยู่ → 409 พร้อมชื่อ 3 รอบแรก ที่เหลือบอกจำนวน; (96-99) มีผลสอบอ้างอยู่ → 409 (FK เป็น RESTRICT Postgres ฟ้องรหัส 23001 ที่ Prisma ไม่แปลงเป็น P2003 จึงนับเองก่อน); (101-111) ลบจริง ถ้าชนระหว่างนับกับลบ (P2003/23001) แปลเป็น 409 ข้อความตรง ๆ |

---

## 3. `rooms/rooms.repository.js` (3 บรรทัด) / `rooms.controller.js` (10 บรรทัด)

- repository: `findAll` = `room.findMany` เรียงตาม `room_id`
- controller: `getAll` เรียก repository แล้วตอบ `{ success: true, data: rooms }` — ไม่มีกฎอะไรเพิ่ม (route ต้อง `authenticate` เท่านั้น)

---

## 4. `rounds/rounds.repository.js` (114 บรรทัด)

| บรรทัด | ฟังก์ชัน | ทำอะไร |
|---|---|---|
| 6-12 | `findAll` | รอบทั้งหมดเรียงปีใหม่→เก่า, ครั้งมาก→น้อย; `include` ผู้สร้าง/ผู้แก้ด้วย `ACTOR_SELECT`; `map` แปลงด้วย `toActor` (ตัด hash) |
| 14-17 | `findById` | หาด้วย `round_id` |
| 22-34 | `findActive(academicYear)` | รอบ **ที่นักศึกษากรอกได้จริง ณ ตอนนี้**: `status="open"` และ `open_date <= now <= close_date` และ**ปีการศึกษาตรงรุ่น** (`lte` = ≤, `gte` = ≥) ถ้ามีหลายรอบเอา attempt สูงสุด |
| 42-46 | `findOpenForYear` | รอบของรุ่นที่ "กดเปิดไว้" **ไม่กรองวัน** — ใช้บอกนักศึกษาว่ารอบหน้าเปิดวันไหน ⚠️ ห้ามใช้ตอนรับผล |
| 57-66 | `findLatestStarted` | รอบล่าสุดของรุ่นที่ "เริ่มแล้ว": ถึง `open_date` แล้ว **และ** (`status=open` หรือ มีใบผลสอบ ≥1 ใบ — `OR` + `exam_results: { some: {} }`) กันรอบ "ร่าง" ที่ยังไม่มีใครใช้ |
| 70-78 | `findNewerRoundWithResults` | มีรอบใหม่กว่า (attempt `gt`) ของรุ่นเดียวกันที่มีใบผลสอบไหม — ใช้กันเปิดรอบเก่าซ้ำ |
| 82-90 | `findByYearAndAttempt` | `findUnique` ด้วย compound key `academic_year_attempt_number` (มาจาก `@@unique` ใน schema) |
| 94-95 | `findOpen` | รอบที่ `status=open` ทั้งระบบ — กันเปิดสองรอบพร้อมกัน |
| 97 | `create` | สร้างรอบ |
| 100-105 | `countExamResults`, `countNews` | นับใบผลสอบ/ข่าวที่ผูกรอบ — กันลบรอบที่มีคนใช้ |
| 107-114 | `remove`, `update` | ลบ/แก้ตาม `round_id` |

## 5. `rounds/rounds.controller.js` (564 บรรทัด)

### ส่วน import และ helper (บรรทัด 1-14)
| บรรทัด | ทำอะไร |
|---|---|
| 1-7 | import repo ของ rounds/students/subjects/examResults, `findSubmittableRound` (service), `subjectsOfRound`, `withPhase` |
| 10-14 | `httpError` |

### `getAll` (16-34) — `GET /api/rounds`
ดึงรอบ → `withPhase` แปะสถานะจริง → ถ้าผู้เรียกเป็น `student` `delete round.creator/updater` (ชื่อผู้สร้างเป็นข้อมูลภายในคณะ; อ่าน role จาก `req.user` ที่มาจาก DB) → ตอบ

### `getActive` (36-104) — `GET /api/rounds/active` (นักศึกษา)
| บรรทัด | ทำอะไร |
|---|---|
| 40-45 | หา student จาก `req.user.studentId` ไม่เจอ → 404 |
| 46-50 | `exam_eligible=false` → 403 (เจ้าหน้าที่ยังไม่เปิดสิทธิ์กรอก) |
| 58-73 | **ขั้น 1** `findSubmittableRound(student)` (ตัวเดียวกับตอนกดส่งจริง): ได้รอบ + `fixingRejected` (ใบถูกตีกลับหลังปิดรอบ ต้องเปิดฟอร์มให้แก้ได้). **ขั้น 2** ถ้าไม่ได้ → `findOpenForYear` เพื่อโชว์ "จะเปิดวันที่…" (ปลอดภัย เพราะตอนส่งจริงยังกรองวันที่อยู่) |
| 74 | ไม่มีรอบเลย → `data: null` |
| 77-86 | ดึงวิชาทั้งหมด + `findPassedSubjectIds` (วิชาที่ผ่านแล้วจากรอบก่อน) → `subjectsOfRound(...)` เฉพาะวิชาของรอบนี้ แล้วใส่ `already_passed` ให้แต่ละวิชา |
| 90-100 | ตอบ round ไว้ชั้นบนสุด (ไม่ซ้อน กันหน้าเก่าพัง) + `subjects` + `all_passed` (ต้อง `length>0` เพราะ `[].every()` ให้ true เสมอ) + `can_fix_rejected` |

### กลุ่มแปลงวันที่ (106-207)
| บรรทัด | ทำอะไร |
|---|---|
| 113 | `ICT_OFFSET_MS` = 7 ชม. — ไทย UTC+7 ไม่มี DST บวกลบเองได้. **ห้ามใช้ `setHours`** (ใช้ timezone เครื่อง server) |
| 115-116 | `START_OF_DAY` (00:00:00.000) / `END_OF_DAY` (23:59:59.999) |
| 128-171 | `parseThaiDateTime(value, label, defaultTime, missingSeconds)` — (132-135) regex แยก ปี-เดือน-วัน และเวลา(ถ้ามี) ไม่ตรง → 400 (ไม่ใส่ `$` ท้าย regex ตั้งใจ ให้รับ ISO string มี Z ได้); (139-144) เช็ควันมีจริงในปฏิทินโดยสร้าง `Date.UTC` แล้วอ่านกลับเทียบ (กัน 2026-02-31 เลื่อนเป็น มี.ค. เงียบ ๆ); (145-147) ชั่วโมง/นาที/วินาทีต้องอยู่ในช่วง; (149-154) เลือกเวลา: มีวินาที → ใช้; มีแค่ ชม:นาที → เติม `missingSeconds`; ไม่มีเวลา → `defaultTime`; (158-167) สร้างเป็น UTC แล้ว **ลบ 7 ชม.** = เวลาไทยจริง (กรอก 23:59 ไทย → เก็บ 16:59 UTC); (169) กัน Invalid Date |
| 174-175 | `parseOpenDate` — ไม่ระบุเวลา = ต้นวัน |
| 179-180 | `parseCloseDate` — ไม่ระบุเวลา = ท้ายวัน; ระบุแค่นาที เติมวินาที 59.999 (ปิดรับ 23:59 = รับถึงสิ้นนาที) |
| 189-196 | `ensureValidDateRange` — `open >= close` → 400 (ไม่งั้นรอบเปิดแล้วไม่มีวันหาเจอ = ระบบล็อกตายเงียบ ๆ) |
| 200-207 | `ensureNotAlreadyExpired` — กดเปิดรอบที่เลยกำหนดปิดแล้ว → 400 (เช็คตอนกดเปิดเท่านั้น รอบปิดแล้วยังต้องแก้ข้อมูลย้อนหลังได้) |

### กลุ่มตรวจ input อื่น (209-348)
| บรรทัด | ทำอะไร |
|---|---|
| 211-233 | `validateSubjectIds` — ต้องเป็น array ไม่ว่าง; `map(Number)`; ทุกตัวเป็นจำนวนเต็มบวก (`some`); ห้ามซ้ำ (`new Set` เทียบจำนวน); ทุก id ต้องมีใน DB (`findByIds`); คืน array ไม่ซ้ำ |
| 241-242 | `YEAR_MIN=2500`, `YEAR_MAX=2700` |
| 245-253 | `isBlankValue` — ไม่ส่ง/null/สตริงว่าง = ยังไม่กรอก (แยกจาก "กรอกแล้วแต่ค่าผิด" ซึ่ง `!0` จะเข้าใจผิด) |
| 257-268 | `toWholeNumber` — รับเลขจำนวนเต็ม หรือสตริงตัวเลขล้วน (`/^\d+$/`); อย่างอื่นคืน `NaN` |
| 271-280 | `parseAcademicYear` — ต้อง 2500-2700 |
| 283-289 | `parseAttemptNumber` — จำนวนเต็ม ≥ 1 |
| 292-306 | `sameIdSet` — เทียบชุด id 2 ชุดโดยไม่สนลำดับ (ตัดซ้ำ → เทียบจำนวน → `sort` ตัวเลขด้วย `(x,y)=>x-y` → เทียบทีละตัว) |
| 310-315 | `ensureValidStatus` — ต้อง `"open"`/`"closed"` (undefined ผ่าน = ไม่ได้แก้) |
| 319-330 | `ensureNotDuplicate(year, attempt, exceptRoundId)` — ปี+ครั้งต้องไม่ซ้ำ (ข้ามรอบที่กำลังแก้) |
| 335-343 | `ensureNoOtherOpenRound(exceptRoundId)` — เปิดรับได้ทีละรอบทั้งระบบ |
| 347-348 | `asDuplicateRoundError` — แปลง `P2002` (ชน unique ตอนกดสร้างพร้อมกัน) เป็น 400 ข้อความไทย |

### `create` (350-404) — `POST /api/rounds`
1. (352-359) destructuring field จาก body
2. (361-371) ต้องมีครบ 4 field ไม่งั้น 400
3. (373-374) ตรวจรูปแบบปี/ครั้ง
4. (376-378) ตรวจ status, ซ้ำ, และถ้าสร้างแบบ `open` ต้องไม่มีรอบเปิดอื่น
5. (381-384) `subject_ids` ไม่ส่ง = ทุกวิชา; ส่ง = ตรวจ
6. (386-389) แปลงวันที่เป็นเวลาไทย → ตรวจช่วง → ถ้าสร้างแบบเปิด ตรวจยังไม่หมดอายุ
7. (391-399) `create` — `status ?? "closed"`, **`created_by: req.user.userId`** (จาก JWT/DB ไม่เชื่อ body)
8. (400-402) ตอบ `withPhase(round)`; error ผ่าน `asDuplicateRoundError`

### `update` (406-528) — `PUT /api/rounds/:id`
| บรรทัด | ทำอะไร |
|---|---|
| 416-419 | `data = {}` สะสมเฉพาะ field ที่แก้; หารอบเดิม ไม่เจอ 404 |
| 423-448 | ถ้าส่ง `subject_ids`: รอบ `open` อยู่ห้ามเปลี่ยนวิชา; ตรวจ id; หาชุดวิชาปัจจุบัน; **ต่อเมื่อชุดต่างจริง** (`!sameIdSet`) ถึงเช็คว่ามีผลสอบแล้วหรือไม่ (มี → 409). หน้าแก้ไขส่งวิชาชุดเดิมมาทุกครั้ง ถ้าบล็อกทุกครั้งจะเลื่อนวันปิดไม่ได้เลย |
| 450-455 | แปลง `academic_year`, `attempt_number` ถ้าส่งมา |
| 460-475 | `identityChanged` — ปี/ครั้ง = "ตัวตน" ของรอบ มีผลสอบแล้วห้ามเปลี่ยน (409) |
| 477-483 | แก้ปี/ครั้ง → ตรวจไม่ซ้ำกับรอบอื่น (`??` ใช้ค่าเดิมถ้าไม่ได้ส่ง) |
| 484-486 | ใส่วันเปิด/ปิด/สถานะลง `data` |
| 490-492 | ตรวจช่วงวันที่จาก **ค่าหลังแก้** (ส่งแค่ close_date ก็ทำช่วงพังได้) |
| 495-518 | ถ้ากดเปิด (`status==="open"`): ไม่มีรอบอื่นเปิดอยู่; ถ้าเปลี่ยนจากปิด→เปิด ตรวจยังไม่เลยกำหนดปิด และ **รอบที่ใหม่กว่าของรุ่นเดียวกันต้องยังไม่มีผลสอบ** (ไม่งั้นผลที่ carry-forward ไปรอบใหม่ไม่ตรงใบต้นทาง) |
| 521-524 | `updated_by`/`updated_at` จาก JWT; `update`; ตอบ `withPhase` |

### `remove` (532-564) — `DELETE /api/rounds/:id`
หารอบ (404) → ถ้า `open` และยังไม่เลยกำหนดปิด ห้ามลบ (400) → `Promise.all` นับใบผลสอบกับข่าวพร้อมกัน → มีใบผลสอบ/ข่าวผูกอยู่ ห้ามลบ → `remove` ตอบ `data: null`
