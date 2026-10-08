# Backend 07 — Exam Results (ผลสอบ): ส่งผล / ตรวจ / ยืนยัน / ตีกลับ

โฟลเดอร์: `backend/src/modules/examResults/`
ไฟล์: `examResults.service.js` (44), `examResults.repository.js` (298), `reviewLog.repository.js` (7), `examResults.controller.js` (486)
routes ดู [เอกสาร 02](02-auth-และแผนที่-routes.md)

> นี่คือ **แกนกลางของระบบ** — อ่านส่วน "แนวคิด" ก่อน

## แนวคิดสำคัญ
1. **1 ใบผลสอบ (exam_result) ต่อ 1 นักศึกษาต่อ 1 รอบ** (`@@unique([student_id, round_id])`) มี 2 สถานะแยกกัน: `student_status` (`draft`/`submitted`) และ `staff_status` (`pending`/`approved`/`rejected`)
2. **วงจรสถานะของใบ:**
   `pending ──approve──▶ approved ──reopen──▶ pending`
   `pending ──reject──▶ rejected ──(นักศึกษาส่งใหม่ หรือ reopen)──▶ pending`
   ยืนยัน/ตีกลับได้เฉพาะใบ `pending`
3. **carry-forward:** วิชาที่เคยผ่านแล้วจากรอบก่อน ระบบบันทึกต่อเป็น "ผ่าน" ให้เอง พร้อมธง `carried_forward = true` (dashboard ไม่นับเป็น "สอบผ่านจริงรอบนี้")
4. **row lock (`SELECT ... FOR UPDATE`)** ป้องกันนักศึกษากับผู้ตรวจแก้ใบเดียวกันพร้อมกัน

---

## `examResults.service.js` — `findSubmittableRound(student)` (44 บรรทัด)

ตัดสินว่า "นักศึกษาคนนี้ส่งผลได้ที่รอบไหนตอนนี้" — ใช้ร่วมกัน 2 ที่ (`create` ตอนกดส่ง, `getActive` ตอนโชว์ฟอร์ม) เพื่อให้ **หน้าจอกับตอนส่งจริงตัดสินตรงกัน**

| บรรทัด | ทำอะไร |
|---|---|
| 1-3 | import repo ของ rounds/examResults + `STAFF_STATUS` |
| 5-17 | คอมเมนต์: คืนค่า 3 แบบ — `{round, fixingRejected:false}` (รอบเปิดปกติ), `{round, fixingRejected:true}` (ไม่มีรอบเปิด แต่ใบถูกตีกลับ → แก้ได้แม้รอบปิด), `null` (ส่งไม่ได้). เหตุผลกรณีที่ 2: เจ้าหน้าที่ตรวจได้หลังปิดรอบ ถ้าตีกลับแล้วนักศึกษาแก้ไม่ได้จะตัน |
| 21-24 | **ขั้น 1** `findActive(student.academic_year)` — มีรอบเปิดจริงของรุ่น ใช้ก่อนเสมอ |
| 29-32 | **ขั้น 2** ไม่มีรอบเปิด → `findLatestStarted` (รอบล่าสุดที่เริ่มแล้ว) ดูเฉพาะรอบล่าสุด ไม่ย้อนรอบเก่า (ย้อนแก้ใบเก่าทำให้ carry-forward ของรอบหลังเพี้ยน) ไม่มี → `null` |
| 35-41 | **ขั้น 3** หาใบของนักศึกษาในรอบนั้น ต้อง `REJECTED` เท่านั้น → `fixingRejected: true` |
| 43 | นอกนั้น `null` |

---

## `examResults.repository.js`

### ค่าคงที่ + include ที่ใช้ซ้ำ (1-77)
| บรรทัด | ทำอะไร |
|---|---|
| 5-10 | `STUDENT_STATUS`, `STAFF_STATUS` — ค่าสถานะที่ใช้ตรงกันทั้งระบบ (กันพิมพ์สตริงผิด) |
| 16-20 | `withDetails` = `{ round, subject_results (+subject), certificates }` — เขียนที่เดียวใช้ 5 จุด. เวลาใช้เห็น `{ ...withDetails, student }` — `...` (spread) = ก๊อป key ทั้งหมดมาวางตรงนี้ |
| 23-33 | `studentSafeSelect` — เลือกเฉพาะ field ของ student/user ที่ส่งออกได้ (ไม่เอา hash) |

### `findByStudentAndRound` (82-87)
`findUnique` ด้วย compound key `student_id_round_id` (ชื่อ Prisma ตั้งจากชื่อคอลัมน์ใน `@@unique` ต่อด้วย `_`)

### `findPassedSubjectIds(student_id, excludeRoundId)` (92-138) — วิชาที่ผ่านแล้ว (ล็อกไม่ให้กรอกซ้ำ)
| บรรทัด | ทำอะไร |
|---|---|
| 99-104 | `buildExcludeRound` — ส่ง id → `{ NOT: { round_id } }`, ไม่ส่ง → `{}` (ไม่กรอง) |
| 106-131 | `subjectResult.findMany` ที่ `is_passed: true` และ **`carried_forward: false`** (นับเฉพาะ "สอบจริงแล้วผ่าน" — บั๊ก B1: แถวยกมาเป็นสำเนา ถ้าใบต้นทางโดนตีกลับภายหลัง สำเนายังค้าง "ผ่าน" ทำให้รอบถัดไปล็อกวิชาผิด) และใบแม่ `staff_status: { not: "rejected" }` (ใบถูกตีกลับไม่นับ แต่ `pending` นับให้ ไม่งั้นต้องกรอกซ้ำระหว่างรอตรวจ) และตัดรอบที่กำลังกรอกออก (ไม่งั้นใบรอบนี้ที่ถูกตีกลับจะล็อกวิชาที่ตัวเองติ๊กผ่าน) |
| 137 | `[...new Set(rows.map(r => r.subject_id))]` — map เอา id → `Set` ตัดซ้ำ → กลับเป็น array |

### `findAll({ round_id, staff_status, student_id } = {})` (143-170)
`({a,b} = {})` = แกะ object ทันที + ค่าเริ่มต้น `{}` กันเรียกเปล่า ๆ พัง. สร้าง `where` ทีละเงื่อนไขที่ส่งมา. include: รายละเอียดใบ + student + `confirmer` + `review_logs` (เก่า→ใหม่ พร้อมชื่อผู้ตรวจ) เรียงส่งล่าสุดก่อน. `map` แปลง actor ด้วย `toActor` (ตัด hash). route นี้ officer/reviewer เท่านั้นจึงโชว์ชื่อผู้ตรวจได้

### Row lock (172-193) — `lockExamResultRow(tx, result_id)`
- ปัญหา: ผู้ตรวจเปิดใบดู → นักศึกษาลบไฟล์/ส่งใหม่ → ผู้ตรวจกดยืนยัน = ยืนยันใบที่หน้าตาไม่ตรงกับที่เห็น
- วิธี: ทุกงานที่เปลี่ยน/ตัดสินใบ (ยืนยัน/ตีกลับ, ส่งทับ, แนบ/ลบไฟล์) ต้อง `SELECT ... FOR UPDATE` แถวใบนั้นก่อน — คนอื่นที่ขอล็อกแถวเดียวกันต้องรอจน transaction จบ
- ลำดับล็อกเหมือนกันทุกงาน (ล็อกใบเดียวก่อนแล้วค่อยแตะตารางลูก) → ไม่เกิด deadlock
- `tx.$queryRaw` แบบ tagged template `` `...${ค่า}...` `` — Prisma ส่งค่าแยกเป็น parameter ไม่ใช่ต่อสตริง SQL → **กัน SQL injection**
- คืน `true` ถ้าเจอใบ (`rows.length > 0`)

### `reviewWithLock(result_id, {staff_status, remark, confirmed_by}, checkBeforeSave)` (203-223)
`prisma.$transaction(async tx => {...})`: ล็อกแถว → อ่านใบล่าสุด (พร้อมรายการไฟล์) → เรียก `checkBeforeSave(current)` ที่ controller ส่งมา (**ทำ "ระหว่างถือล็อก"**; throw = ยกเลิกทั้ง transaction) → `updateMany` ที่ `where staff_status = pending` (optimistic guard ด่านสุดท้าย) → คืน `count` ให้ controller เช็ค 0 = มีคนตรวจแทรก

### `reopenIfStatus(result_id, fromStatus)` (229-238) / `revokeApprovalIfApproved` (241-242)
`updateMany` ที่ `staff_status = fromStatus` → ตั้งกลับ `pending` และล้าง `remark/confirmed_by/confirmed_at` (เหตุผลตีกลับครั้งก่อนไม่ค้างให้นักศึกษาเห็น ประวัติเก็บใน review_logs). count=0 = มีคนเปลี่ยนไปก่อน กดซ้ำไม่ทับกัน

### `findByStudent` (244-249), `findById` (251-255)
query ธรรมดาพร้อม `withDetails`

### `toSubjectRows` (258-263)
แปลงผลรายวิชาให้เป็นรูปที่ Prisma รับ: `Number(subject_id)`, `Boolean(is_passed)`, `Boolean(carried_forward)`

### `resubmitWithSubjects(result_id, subjectResults, mustStillBeRejected)` (278-323)
ส่งใหม่ทับใบเดิม (นักศึกษาแก้หลังถูกตีกลับ) ใน transaction เดียว:
1. ล็อกแถว
2. อ่านสถานะล่าสุด: ไม่มีใบ/`approved` → 409 "ยืนยันแล้ว แก้ไขไม่ได้" (**กันนักศึกษาทับใบที่เพิ่งถูกยืนยันระหว่างที่ controller เช็คกับที่มาเรียกที่นี่**)
3. `mustStillBeRejected` (มาทางแก้ใบตีกลับหลังปิดรอบ) แต่ใบไม่ใช่ `rejected` แล้ว → 400 (ส่งแก้ไปแล้ว ห้ามแก้ซ้ำหลังปิดรอบ)
4. `update`: ตั้ง `pending`, ล้าง remark/confirmed, **`submitted_at = now`** (ผู้ตรวจใช้ค่านี้ดูว่า "นักศึกษาแก้หลังที่ฉันเปิดดูหรือยัง")
5. `deleteMany` ผลรายวิชาเดิมทั้งชุด + `createMany` ชุดใหม่
6. คืนใบพร้อมรายละเอียด

### `createWithSubjects(...)` (327-342)
`examResult.create` พร้อม nested `subject_results: { create: [...] }` (Prisma ทำเป็น transaction ให้อยู่แล้ว) — สร้างใบ + ผลรายวิชาพร้อมกัน

---

## `reviewLog.repository.js` (7 บรรทัด)
`create({result_id, reviewer_id, action, remark})` — **insert-only** เก็บทุกครั้งที่ approve/reject/reopen/revoke (ไม่ทับของเดิม ต่างจาก `confirmed_by` ที่เก็บแค่ครั้งล่าสุด)

---

## `examResults.controller.js`

### `create` (17-167) — `POST /api/exam-results` (นักศึกษาส่งผลสอบ)
| บรรทัด | ทำอะไร |
|---|---|
| 19-22 | `subject_results` ต้องเป็น array ไม่ว่าง |
| 24-31 | หา student; ไม่เจอ 404; `exam_eligible` เป็น false → 403 |
| 38-45 | `findSubmittableRound` ไม่ได้รอบ → 400 "ขณะนี้ไม่มีรอบกรอกผลสอบที่เปิดอยู่" (หารอบจาก **รุ่นของนักศึกษา** ตั้งแต่ต้น ข้ามรุ่นไม่ได้โดยไม่ต้องมีเงื่อนไขกันเพิ่ม) |
| 47-55 | หาใบเดิม; ถ้า `approved` → 409 ล็อก (กันเปลี่ยนผลหลังเซ็น) |
| 60-68 | ถ้ามาทาง `fixingRejected` ใบเดิมต้องยัง `rejected` จริง ไม่งั้น 400 (ใบรอตรวจหลังปิดรอบห้ามแก้) |
| 69 | `isRedo = Boolean(existing)` |
| 71-74 | วิชาของรอบนี้ (`subjectsOfRound`) → array id |
| 77-82 | `passedIds` (ตัดรอบนี้ออก) และ `mustAnswer` = วิชาของรอบ − วิชาที่เคยผ่าน |
| 86-88 | รอบไม่มีวิชาเลย → 400 (แยกจาก "ผ่านครบ" คนละข้อความ) |
| 93-95 | `mustAnswer` ว่าง = ผ่านครบแล้ว → 400 (กันใบ "ว่าง" โผล่ในคิวตรวจ) |
| 98-110 | วน `subject_results` ใส่ `Map answers`: id ต้องอยู่ในรอบ; `is_passed` ต้องเป็น boolean จริง (string `"false"` จะถูกตีเป็น true); ห้ามซ้ำ |
| 112-115 | วิชาที่ต้องตอบแต่ขาด → 400 บอกจำนวน |
| 121-138 | `finalResults = roundSubjectIds.map(...)` ครบทุกวิชาของรอบ: วิชาที่เคยผ่าน **บังคับ `true` ไม่เชื่อค่าจาก client** + `carried_forward: passedBefore`; ที่เหลือใช้คำตอบจริง |
| 142-161 | `isRedo` → `resubmitWithSubjects` (ทับใบเดิม ไม่สร้างใบที่ 2) ไม่งั้น `createWithSubjects` ด้วย `submitted`/`pending` |

### `getMine` (170-177), `getAll` (182-190)
ประวัติของตัวเอง (`req.user.studentId`) / ทุกคนกรองด้วย query `round_id`, `staff_status`, `student_id`

### ตรวจ "เวอร์ชันของใบ" (192-280)
ป้องกัน: ผู้ตรวจเห็นใบเวอร์ชันหนึ่ง แต่นักศึกษาแก้ไปแล้วก่อนกดยืนยัน
| บรรทัด | ทำอะไร |
|---|---|
| 201-204 | ข้อความ 409 / 400 |
| 209-242 | `readExpectedVersion(body)` — อ่าน "ลายนิ้วมือ" 2 อย่างที่หน้าจอส่งมา (ไม่บังคับ): `expected_submitted_at` (ISO → `getTime()` ms; เทียบเป็นเวลา ไม่ใช่ข้อความ) และ `expected_certificate_ids` (array จำนวนเต็มบวก ห้าม boolean). ส่งมาแต่รูปแบบผิด = 400 ไม่เดา |
| 245-249 | `toSortedUniqueIds` — ตัดซ้ำ + `sort((a,b)=>a-b)` |
| 252-280 | `isSameVersion(current, expected)` — เวลาส่งตรงกัน และชุดไฟล์เท่ากันทุกตัว (เทียบทีละตำแหน่งหลังเรียง). ไม่ส่ง expected = ข้ามการเทียบนั้น |

### `reviewExamResult` (284-395) — ตัวกลางของ approve/reject
| บรรทัด | ทำอะไร |
|---|---|
| 286-292 | หาใบ (404); ไม่ใช่ `pending` → 409 (ด่านแรก ให้ข้อความชัด) |
| 296-306 | `remark` ต้องเป็น string (`trim`); ตีกลับ (`requireRemark`) ต้องไม่ว่าง; ยาวไม่เกิน 500 |
| 310-313 | `remarkToSave` ว่าง → `null` |
| 316 | `readExpectedVersion` |
| 326-343 | `checkBeforeSave(current)` (รันระหว่างถือล็อก): ใบต้องมี; ต้องยัง `pending` (อีกคนแทรกไปก่อน = 409); `isSameVersion` (409 ถ้านักศึกษาแก้ระหว่างตรวจ); **ยืนยัน (approved) ต้องมีไฟล์หลักฐาน ≥ 1** ไม่งั้น 409 ให้ตีกลับแทน |
| 346-357 | `reviewWithLock(..., confirmed_by: req.user.userId)` (จาก JWT) ; `count===0` → 409 |
| 358 | ดึงใบล่าสุดไปตอบ |
| 362-371 | บันทึก `review_logs` ใน `try/catch` — log พลาดต้องไม่ทำให้ request ล้ม (ตรวจสำเร็จไปแล้ว) log error ที่ server แทน |
| 374-389 | สร้างข้อความแจ้งเตือน (approved / ตีกลับ+เหตุผล `\n` บรรทัด 2) แล้ว `await notifRepo.create` ใน `try/catch` (รอ เพื่อให้นักศึกษาเปิดดูทันทีแล้วเห็น แต่พลาดไม่ทำให้ล้ม) |
| 391 | ตอบ |

### `reopenPaper` (411-456) — ใช้ร่วม `reopen` / `revokeApproval`
รับ option `{allowedFrom, logAction, wrongStatusMessage, noReasonMessage}`: หาใบ → สถานะต้องอยู่ใน `allowedFrom` (409) → ต้องมี `remark` (400) ≤ 500 → `reopenIfStatus(id, existing.staff_status)` (count=0 → 409) → log (`reopened`/`revoked`) → แจ้งเตือน `type: "revoked"` → ตอบใบล่าสุด

### Export handler (459-486)
| ฟังก์ชัน | ตั้งค่า |
|---|---|
| `reopen` | `allowedFrom: [APPROVED, REJECTED]`, `logAction: "reopened"` — **ปุ่มเดียว** "แก้ไขผลการตรวจ" |
| `revokeApproval` | `allowedFrom: [APPROVED]`, `logAction: "revoked"` — endpoint เดิมเก็บไว้ไม่ให้ของเก่าพัง |
| `approve` | `reviewExamResult` + `APPROVED`, `requireRemark: false` |
| `reject` | `reviewExamResult` + `REJECTED`, `requireRemark: true` |
(หลักการ: ฟังก์ชันเดียว + พารามิเตอร์ ดีกว่าก๊อปโค้ดซ้ำ 2 ชุด)
