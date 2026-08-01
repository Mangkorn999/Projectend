# Round Subject Targeting — Design

## Problem

ตอนนี้ทุกรอบสอบ (`submission_rounds`) บังคับให้นักศึกษากรอกครบทั้ง 8 วิชาเสมอ ไม่ว่าจะเคยผ่านวิชาไหนมาก่อนหรือยัง ในความเป็นจริง:

- นักศึกษาแต่ละคนอยู่ 1 รุ่น (`academic_year`) มีโอกาสสอบ 3 รอบ (`attempt_number` 1-3) ภายในปีเดียวกันเท่านั้น ไม่ข้ามปี
- บางรอบอาจไม่ต้องเก็บครบ 8 วิชา (เช่น วิชาถูกตัดออกจากรอบนั้น)
- นักศึกษาที่ผ่านบางวิชาแล้วในรอบก่อน ไม่ควรต้องกรอกวิชานั้นซ้ำ
- ถ้าสอบครบ 3 รอบแล้วยังไม่ผ่านครบ → พ้นการเก็บข้อมูลของระบบ (ไปสอบเองนอกระบบ) ไม่มีรอบที่ 4 ไม่มีลากข้ามปี

## Scope

เฉพาะ backend logic + schema + frontend หน้าที่เกี่ยวข้อง (สร้าง/แก้รอบของ officer, ฟอร์มกรอกผลของนักศึกษา, dashboard stats). ไม่แตะ auth/rooms/certificates ที่ทำเสร็จไปแล้ว.

## Design

### 1. Schema change

เพิ่ม column เดียวใน `submission_rounds`:

```prisma
model SubmissionRound {
  // ...fields เดิม
  subject_ids Int[]   // Postgres array — id ของวิชาที่รอบนี้ทดสอบ
}
```

เลือกใช้ Postgres array แทนตาราง many-to-many (`round_subjects`) เพราะวิชามีแค่ 8 ตัว แทบไม่เปลี่ยน ไม่คุ้มที่จะเพิ่ม join table + repository ใหม่ ข้อเสียคือไม่มี FK บังคับความถูกต้อง — validate เองใน controller แทน (เช็คว่าทุก id ใน `subject_ids` มีอยู่จริงในตาราง `subjects` ตอนสร้าง/แก้รอบ).

### 2. สร้าง/แก้รอบ (officer)

- `POST /api/rounds` และ `PUT /api/rounds/:id` รับ `subject_ids: number[]` เพิ่ม, validate ว่าไม่ว่างและทุก id มีจริงในตาราง `subjects`
- แก้ `subject_ids` ได้เฉพาะตอนรอบยัง `status: closed` (ยังไม่เปิดให้กรอก) — เปิดแล้วล็อกไม่ให้แก้ กันข้อมูลไม่ตรงกับที่นักศึกษาเห็นไปแล้ว
- Frontend (`manageRoundsSubjectsReal.jsx` `RoundModal`) เพิ่ม checkbox เลือกวิชาจาก `GET /api/subjects`

### 3. คำนวณ "ผ่านแล้วหรือยัง" ต่อวิชาต่อคน

ฟังก์ชันใหม่ใน `examResults.repository.js`: `findPassedSubjectIds(student_id)` — หา subject_id ทั้งหมดที่นักศึกษาคนนี้เคยได้ `is_passed: true` จาก `subject_results` ของทุก `exam_results` ก่อนหน้า (ไม่ต้อง filter ปี เพราะนักศึกษาแต่ละคนอยู่ปีเดียวอยู่แล้ว รอบทั้งหมดที่เขาเคยกรอกคือปีของเขาเอง)

### 4. `GET /api/rounds/active` (นักศึกษา)

Response เพิ่ม field:

```json
{
  "round": { "round_id": 5, "subject_ids": [1,2,3,4,5,6,7,8], ... },
  "subjects": [
    { "subject_id": 1, "subject_code": "NUR01", "subject_name": "...", "already_passed": false },
    { "subject_id": 2, "subject_code": "NUR02", "subject_name": "...", "already_passed": true }
  ],
  "all_passed": false
}
```

- `subjects` = เฉพาะวิชาที่อยู่ใน `round.subject_ids` เท่านั้น (ไม่ใช่ทั้ง 8 วิชาเสมอไป) พร้อม flag `already_passed`
- `all_passed: true` เมื่อทุกวิชาใน `subject_ids` ผ่านหมดแล้ว — frontend โชว์ข้อความ "ผ่านครบแล้ว ไม่ต้องกรอกรอบนี้" แทนฟอร์ม
- ยังคงเช็ค `exam_eligible` เหมือนเดิมก่อนคืนค่าทั้งหมด (gate เดิมไม่เปลี่ยน)

### 5. `POST /api/exam-results` (นักศึกษาส่งผล)

- นักศึกษาส่ง `subject_results` มาเฉพาะวิชาที่ตอบจริง (วิชาที่ `already_passed: false`)
- Backend validate: ทุกวิชาที่ส่งมาต้องอยู่ใน `round.subject_ids`, และต้องส่งมาครบทุกวิชาที่ `already_passed: false` (ห้ามขาด)
- ก่อนบันทึก backend ดึงวิชาที่ผ่านแล้ว (จาก `findPassedSubjectIds`) มาเติมเป็น `is_passed: true` ต่อให้ครบตาม `round.subject_ids` ทั้งหมด แล้วค่อย `createWithSubjects` — ผลลัพธ์คือแต่ละ `exam_result` มี `subject_results` ครบตามที่รอบนั้นทดสอบเสมอ (copy-forward ตามที่ตกลง)

### 6. Dashboard (`dashboard.service.js`)

- `perSubject` — เปลี่ยนจาก loop `subjects` (ทั้ง 8) เป็น loop เฉพาะวิชาใน `round.subject_ids`
- `fullyPassed` — เทียบ `subject_results.length === round.subject_ids.length` แทน `subjects.length`
- ที่เหลือ (`by`, `not_started`, `fillRate` ฯลฯ) ไม่กระทบ เพราะนับที่ระดับ exam_result ไม่ใช่ระดับวิชา

## Out of scope / ตัดทิ้งจากไอเดียตั้งต้น

- ไม่ต้องเลือกรุ่นปี พ.ศ. หลายปีต่อรอบ — 1 รอบผูกกับ `academic_year` เดียวตาม schema เดิมอยู่แล้ว
- ไม่มีรอบที่ 4 หรือการลากข้ามปีสำหรับนักศึกษาที่สอบไม่ผ่านครบใน 3 รอบ — พ้นการเก็บข้อมูลของระบบไปเลย ตรงตามที่ยืนยันไว้
- ไม่สร้างตาราง many-to-many `round_subjects` — ใช้ column array แทนตามที่ตกลง

## Open follow-up (ยังไม่ต้องตัดสินตอนนี้)

- ถ้า officer ลบวิชาออกจากตาราง `subjects` ทั้งที่มี `subject_ids` ของรอบเก่าอ้างถึงอยู่ จะกลายเป็น dangling id — ไม่ block เพราะวิชาแทบไม่มีทางถูกลบ แต่ถ้าจะลบวิชาในอนาคตต้องเช็คจุดนี้ก่อน
