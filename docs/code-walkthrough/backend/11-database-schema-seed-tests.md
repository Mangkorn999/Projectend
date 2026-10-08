# Backend 11 — ฐานข้อมูล (Prisma schema), migration, seed, เทส

โฟลเดอร์: `backend/prisma/` และ `backend/tests/`

> **Prisma** = ตัวกลางระหว่างโค้ด JS กับ PostgreSQL: เราเขียนโครงตารางใน `schema.prisma` → รัน migration สร้างตารางจริง → ใช้ `prisma.<model>.findMany/create/update/...` ในโค้ด
> 11 ตาราง ตรงกับ data dictionary บทที่ 3.4 ของรายงาน (ชื่อ column ใช้ `snake_case`)

---

## 1. `schema.prisma` (253 บรรทัด)

### หัวไฟล์ (1-8)
| บรรทัด | ทำอะไร |
|---|---|
| 1-3 | `generator client` — สั่งสร้าง `PrismaClient` สำหรับ JS |
| 5-8 | `datasource db` — ใช้ PostgreSQL อ่าน connection string จาก `env("DATABASE_URL")` ใน `.env` |

### ศัพท์ที่เจอในไฟล์
| สัญลักษณ์ | ความหมาย |
|---|---|
| `@id` | primary key |
| `@default(autoincrement())` | เลขรันอัตโนมัติ |
| `@unique` | ค่าซ้ำไม่ได้ |
| `@@unique([a, b])` | **คู่** ค่า a+b ซ้ำไม่ได้ (compound unique) |
| `@@index([x])` | ทำ index ให้ค้นด้วย x เร็วขึ้น |
| `@@map("ชื่อตาราง")` | ชื่อจริงใน DB (model ใน JS ใช้ PascalCase เช่น `User` → ตาราง `users`) |
| `String?` / `Int?` | ค่า null ได้ |
| `@db.VarChar(n)` | ชนิดข้อความจำกัดความยาว n |
| `@relation(fields:[...], references:[...])` | foreign key (ฝั่งที่เก็บคีย์) |
| `Model[]` | ฝั่ง "หลายแถว" ของ relation (ไม่มี column จริง) |
| `onDelete: SetNull` | ลบแม่แล้วช่อง FK ของลูกกลับเป็น null (ไม่ทำให้ลบไม่ได้) |
| (ไม่ระบุ onDelete) | ค่าเริ่มต้น = `RESTRICT` ลบแม่ไม่ได้ถ้ายังมีลูก (Postgres ฟ้อง SQLSTATE 23001 — จึงต้องนับเองก่อนลบ) |

### ตารางทีละ model
| บรรทัด | Model → ตาราง | ฟิลด์สำคัญ / กฎ |
|---|---|---|
| 10-17 | `Role` → `roles` | `role_name` (student/officer/executive/reviewer), `description` |
| 19-59 | `User` → `users` | `psu_passport_id` **unique** (= รหัสนักศึกษา สำหรับนักศึกษา; ชื่อ field เก่าจากแผน PSU SSO แต่ตอนนี้ login ในระบบเอง); `password_hash` **null ได้** (null = ถอนสิทธิ์/ปิดบัญชี); `must_change_password` default true; ชื่อ/อีเมล/เบอร์ null ได้ (นักศึกษาว่างตอน import จนกรอกโปรไฟล์); `import_academic_year` (ปีจบที่เจ้าหน้าที่ระบุตอน import — เก็บที่นี่เพราะยังไม่มีแถว students); audit: `created_by`, `closed_at`, `closed_by` (self-relation, `SetNull`) |
| 61-67 | `Faculty` → `faculties` | ตอนนี้มีคณะพยาบาลคณะเดียว |
| 69-75 | `Room` → `rooms` | ห้องเรียนปกติ / ห้องเรียนอังกฤษ |
| 77-101 | `Student` → `students` | PK `student_id` (String); `user_id` **unique** (1 user : 0..1 student); `academic_year` (ปีที่จบ = กำหนดรุ่น); `first_name_en/last_name_en`; `exam_eligible` default **true**; `eligible_set_by/at` (audit); `@@index([academic_year])` เพราะ dashboard กรองตามรุ่นแทบทุกหน้า |
| 103-110 | `Subject` → `subjects` | `subject_code` VarChar(10), `subject_name` VarChar(200) (ไม่ตั้ง unique ที่ DB — กันซ้ำที่ controller) |
| 112-135 | `SubmissionRound` → `submission_rounds` | `academic_year`, `attempt_number`, `open_date/close_date`, `status` ("open"/"closed"), **`subject_ids Int[]`** (array ของ id วิชา ไม่มี FK; `[]` = ทุกวิชา สำหรับรอบเก่า), `created_by`, `updated_by/at`; **`@@unique([academic_year, attempt_number])`** กันรอบซ้ำที่ระดับ DB |
| 137-164 | `ExamResult` → `exam_results` | `student_id`+`round_id`; `student_status` (draft/submitted), `staff_status` (pending/approved/rejected) **แยกกัน**; `remark`; `submitted_at`, `confirmed_by/at`; **`@@unique([student_id, round_id])`** (1 ใบต่อรอบ กันกดส่งซ้ำพร้อมกัน); `@@index([round_id])`, `@@index([staff_status])` เพราะคิวตรวจกรองด้วยสองตัวนี้ |
| 167-180 | `ReviewLog` → `review_logs` | **insert-only** ประวัติ approve/reject/reopen/revoke ทุกครั้ง; `action`, `remark` (Text); `@@index([result_id])` |
| 182-199 | `SubjectResult` → `subject_results` | ผลรายวิชา: `is_passed`, **`carried_forward`** default false (true = ยกผลผ่านมาจากรอบก่อน ไม่ได้สอบจริงรอบนี้); index บน `result_id`, `subject_id` (ตารางใหญ่สุด: คน × 8 วิชา × ทุกรอบ) |
| 201-214 | `Certificate` → `certificates` | `certificate_type` (exam_result/license), `file_name`, **`file_path`** (ห้ามเก็บ binary ใน DB), `file_type` (pdf/jpg/png) |
| 216-234 | `News` → `news` | `posted_by`, **`round_id`** (ประกาศผูกกับรอบ), `title`, `content`, `image_path`, `updated_at @updatedAt` (Prisma อัปเดตเอง), `updated_by` |
| 236-253 | `Notification` → `notifications` | `student_id`, `type` (approved/rejected/eligible/revoked/round_open), `message`, `is_read`, `round_id?` (เฉพาะ round_open); index `[student_id]` และ `[student_id, round_id, type]` |

### ความสัมพันธ์หลัก
```
roles 1─M users 1─0..1 students 1─M exam_results 1─M subject_results M─1 subjects
                                         │ M─1 submission_rounds ─1─M news
                                         ├─1─M certificates
                                         └─1─M review_logs
students 1─M notifications
```

---

## 2. `migrations/` (17 โฟลเดอร์ ตามลำดับเวลา)
แต่ละโฟลเดอร์ = SQL ที่ Prisma สร้างเมื่อรัน `prisma migrate dev` (ชื่อขึ้นต้นด้วย timestamp) เรียงตามประวัติการเปลี่ยน schema:
| migration | เปลี่ยนอะไร |
|---|---|
| `20260709…_project_end` | สร้างตารางตั้งต้นทั้งหมด |
| `…_add_sessions_table` / `…_remove_sessions_table` | เคยมีตาราง session แล้วเลิก (เปลี่ยนมาใช้ JWT ใน cookie) |
| `…_add_exam_eligible` / `…_eligible_default_true` | เพิ่ม `exam_eligible` / เปลี่ยน default เป็น true |
| `…_remove_nursing_council_credentials` | ลบ field ที่ไม่ใช้ |
| `…_add_local_password_auth` | `password_hash`, `must_change_password` (login ในระบบเอง) |
| `…_add_round_subject_ids` | `subject_ids` ของรอบ |
| `…_add_news_image_path` | รูปประกอบข่าว |
| `…_add_carried_forward_to_subject_results` | ธง carry-forward |
| `…_add_notifications` / `…_add_round_open_notification` | ตารางแจ้งเตือน / `round_id` ของ round_open |
| `…_add_unique_round_year_attempt` | `@@unique([academic_year, attempt_number])` |
| `…_add_reviewer_role` | role reviewer + `review_logs` |
| `…_add_user_import_academic_year` | `import_academic_year` |
| `…_add_exam_result_unique_and_indexes` | unique ใบต่อรอบ + index |
| `…_add_audit_actor_columns` | `created_by/closed_by/updated_by/eligible_set_by` |

---

## 3. Seed (ข้อมูลเริ่มต้น / ข้อมูลทดสอบ)

คำสั่งอยู่ใน `package.json` `scripts` (`prisma.seed` = `node prisma/seed.js`)

### `seed.js` (196 บรรทัด) — รัน `npx prisma db seed`
| บรรทัด | ทำอะไร |
|---|---|
| 3 | **สคริปต์ใน `prisma/` สร้าง `new PrismaClient()` เองได้** (รันจบแล้วปิด ไม่ใช่ server — ข้อยกเว้นของกฎ singleton) |
| 7 | `initialPassword(id)` = `bcrypt.hashSync(id, 10)` — รหัสผ่านบัญชีตัวอย่าง = รหัสผู้ใช้ของตัวเอง |
| 11 | `SEED_ACCOUNT = { must_change_password: false }` ข้ามการบังคับเปลี่ยนรหัสเพื่อให้เทสได้ทันที |
| 15-27 | **ลบข้อมูลเก่าทั้งหมด** ตามลำดับ ลูก→แม่ (FK) — ⚠️ รันแล้วล้าง DB |
| 63-72 | สร้าง 4 role: student, officer, executive, reviewer |
| 75-86 | คณะพยาบาลศาสตร์ + 2 ห้อง (ปกติ/อังกฤษ) |
| 105-153 | ผู้ใช้ตัวอย่าง: นักศึกษา `6610210631`, officer `456`, executive `789`, reviewer `321` (รหัสผ่านเท่ากับรหัสผู้ใช้) |
| 158-168 | แถว `students` ของนักศึกษาตัวอย่าง `academic_year: 2570` (66 + 4 + 2500) |
| 172-183 | 8 รายวิชา (รหัส 1101-1108) |

### `seedCohort.js` (163 บรรทัด) — `npm run seed:cohort -- <ปี> <จำนวน> <ห้องแรก>`
สร้างนักศึกษาทั้งรุ่นเพื่อเทสข้อมูลจำนวนมาก (ไม่สร้างรอบ/ผลสอบ); คลังชื่อ ไทย/อังกฤษ **วนซ้ำตามลำดับ ไม่สุ่ม** (ผลเหมือนเดิมทุกครั้ง); `idPrefixOf(year)` = 2 หลักท้ายของ `year − 4`; รันซ้ำได้ (ลบเฉพาะรุ่นที่สร้างไว้ก่อน)

### `demoSeed.js` (335 บรรทัด) — `npm run demo:seed`
ข้อมูลเดโม: นักศึกษา 20 คน × 3 ปี (2567-2569) ผลทุกใบ approved; ข้อมูลเป็นตาราง `ROUNDS` / `STUDENTS` ไม่สุ่ม; รหัสผ่านนักศึกษา = รหัสตัวเอง

### `seedDemoYears.js` (552 บรรทัด) — `npm run seed:demo-years`
จำลองหลายรุ่น (2565-2569) 150-200 คนต่อรุ่น พร้อมรอบ 1/2/3 และผลสอบ; รุ่นล่าสุดมีรอบ 2 **เปิดค้างกลางคัน** (มีใบรอตรวจ/ตีกลับ/ยืนยัน/ยังไม่กรอก ให้คิวตรวจมีงานจริง); ใช้ PRNG `mulberry32` fix seed (ผลเหมือนเดิมทุกครั้ง) และ PRNG แยกอีกตัวสำหรับเลือกคนตรวจ (ไม่ปนกัน การเพิ่มบรรทัดเลือกคนไม่ทำให้ผลสอบเปลี่ยน); hash รหัส `demo1234` ครั้งเดียวใช้ซ้ำ (bcrypt ช้าโดยตั้งใจ 900 คนทีละคนจะรอเป็นนาที)

---

## 4. เทส (`backend/tests/`)

| ไฟล์ | ทำอะไร |
|---|---|
| `smoke-phase*.mjs` (30+ ไฟล์) | smoke test เรียก API จริงตาม phase: 1-3 พื้นฐาน, 4-6, 9 import, 10 วิชาของรอบ, 11 carry-forward, 12 ตีกลับ/แก้, 13 รอบซ้ำ, 14 ขอบเขตข่าว, 15 reviewer, 16-17 ปีจบ, 18 วันที่รอบ, 19-20 guard/hardening, 21 บัญชีค้าง, 22 export, 23 ลบ user, 24-25 วงจรเต็ม, 26 edge case, 27 security, 28 actor, 29 สถิติ, 30 ตาราง role, 31-33 guard/reopen/audit |
| `run-clean.mjs` | `npm run test:clean` — รันเทสบน schema สะอาด (ไม่ทิ้งขยะใน DB จริง) |
| `e2e/` | เทสผ่านหน้าเว็บด้วย Playwright (`test:e2e`, `:lifecycle`, `:browsers`, `:import`, `:devices`, `:real`, `:perf`) |
| `fixtures/`, `autoEvidence.mjs`, `cleanupYears.mjs` | ไฟล์ตัวอย่างและตัวช่วยเทส |

**วิธีเทสพื้นฐาน:** สคริปต์ login ด้วยบัญชี seed → ยิง `fetch` ไปที่ API → `assert` สถานะ/ข้อมูล (ดูไฟล์เป็นตัวอย่างการเขียน flow จริงของทุก role)
