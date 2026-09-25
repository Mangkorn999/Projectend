# 📋 แผนพัฒนา Backend — ระบบบันทึกใบอนุญาตประกอบวิชาชีพ
**Stack:** Node.js + Express.js + PostgreSQL + Prisma ORM  
**Auth:** PSU One Passport → JWT  

---

## 🗂️ โครงสร้าง Folder

```
backend/
├── assets/fonts/              ✅ Sarabun TTF — ใช้ทำ PDF ภาษาไทย (ห้ามลบ)
│
├── prisma/
│   ├── schema.prisma          ✅ เสร็จแล้ว — database schema ทุกตาราง
│   ├── seed.js                ✅ เสร็จแล้ว — ข้อมูลตัวอย่าง
│   └── migrations/            ✅ เสร็จแล้ว — migration files
│
└── src/
    ├── config/
    │   ├── db.js              ✅ Prisma client singleton
    │   └── env.js             ✅ ตรวจ .env ก่อน server เริ่ม
    │
    ├── middlewares/
    │   ├── auth.js            ✅ ตรวจ JWT ทุก request
    │   ├── requireRole.js     ✅ เช็คสิทธิ์ตาม role
    │   └── errorHandler.js    ✅ ดัก error กลาง → format เดียวกัน
    │
    ├── middlewares/upload.js  ✅ multer — รับ PDF อัปโหลด (เก็บที่ uploads/)
    │
    ├── modules/               ← แต่ละ module มีโครงสร้างเดียวกัน
    │   ├── auth/              ✅ Phase 1
    │   ├── users/             ✅ Phase 3
    │   ├── students/          ✅ Phase 3
    │   ├── rounds/            ✅ Phase 4
    │   ├── examResults/       ✅ Phase 5
    │   ├── certificates/      ✅ Phase 5
    │   ├── news/              ✅ Phase 7
    │   └── dashboard/         ✅ Phase 8 (มี dashboard.pdf.js เพิ่ม)
    │
    ├── Routes/
    │   └── authRoutes.js      ✅ POST /api/auth/login
    │
    ├── controllers/
    │   └── authController.js  ✅ login logic + JWT sign
    │
    ├── app.js                 ✅ ประกอบ Express + middleware ทั้งหมด
    └── server.js              ✅ เริ่ม server + listen port
```

> **กฎของแต่ละ module:** ภายในจะมี `routes.js → controller.js → service.js → repository.js`

---

## 📐 Pattern ของทุก Module

```
Request → Routes → Controller → Service → Repository → Database
```

| ไฟล์ | หน้าที่ |
|---|---|
| `*.routes.js` | กำหนด endpoint + เรียก middleware + ส่งต่อ controller |
| `*.controller.js` | รับ req/res, เรียก service, ส่ง response กลับ |
| `*.service.js` | business logic เช่น validate, encrypt, combine data |
| `*.repository.js` | query database ผ่าน Prisma เท่านั้น |

---

## 🗺️ ลำดับการพัฒนา (Phase by Phase)

### ✅ Phase 0 — Setup พื้นฐาน `เสร็จแล้ว`

- [x] Express + Prisma + PostgreSQL
- [x] `.env` สำหรับ credentials
- [x] config, middleware, utils ครบแล้ว

---

### ✅ Phase 1 — Auth Middleware `ทดสอบผ่านแล้ว`

> **ทำก่อนทุกอย่าง** เพราะทุก endpoint ถัดไปต้องรู้ว่า "ใครเรียก และ role อะไร"

- [x] ทดสอบ `POST /api/auth/login` ด้วย Postman ว่าคืน JWT ได้จริง
- [x] ทดสอบ `auth.js` middleware — ลอง request โดยไม่มี token → ต้องได้ 401
- [x] ทดสอบ `requireRole.js` — ลอง request ด้วย token role ผิด → ต้องได้ 403
- [x] สร้าง `GET /api/auth/me` — ดึงข้อมูล user ปัจจุบันจาก JWT
- [x] สร้าง `POST /api/auth/logout` — สั่งลบ cookie (public ไม่ต้อง authenticate)

> **อัปเดต 2026-08-10:** token ย้ายไปอยู่ใน **httpOnly cookie** ไม่ส่งกลับใน JSON body แล้ว
> รายละเอียดทั้งหมดดู [`BACKEND_GUIDE.md` ส่วน 7.1](BACKEND_GUIDE.md#71-auth--เข้าสู่ระบบ)

**วิธีทดสอบ Postman:**
```
# 1. Login ก่อน — Postman เก็บ cookie ให้เองอัตโนมัติ
POST http://localhost:3000/api/auth/login
Body: { "psu_passport_id": "6510110001", "password": "6510110001" }

# 2. เรียกต่อได้เลย ไม่ต้อง copy token ใส่ header
GET http://localhost:3000/api/auth/me

# 3. ออกจากระบบ (ลบ cookie)
POST http://localhost:3000/api/auth/logout
```

---

### ✅ Phase 2 — Subjects CRUD `ทดสอบผ่านแล้ว`

> ง่ายสุด ใช้ฝึก pattern routes → controller → repository

| Method | URL | Role | คำอธิบาย |
|---|---|---|---|
| `GET` | `/api/subjects` | ทุก role | ดึงรายวิชาทั้งหมด |
| `POST` | `/api/subjects` | staff | เพิ่มรายวิชาใหม่ |
| `PUT` | `/api/subjects/:id` | staff | แก้ไขรายวิชา |
| `DELETE` | `/api/subjects/:id` | staff | ลบรายวิชา |

**ไฟล์ที่ต้องสร้าง:**
```
src/modules/subjects/
├── subjects.routes.js
├── subjects.controller.js
└── subjects.repository.js
```

---

### ✅ Phase 3 — จัดการผู้ใช้ (Users & Students) `ทดสอบผ่านแล้ว`

| Method | URL | Role | คำอธิบาย |
|---|---|---|---|
| `GET` | `/api/users` | staff | ดูรายชื่อผู้ใช้ทั้งหมด |
| `POST` | `/api/users/:id/role` | staff | เปลี่ยน role ผู้ใช้ |
| `GET` | `/api/students` | officer | ดูรายชื่อนักศึกษา (executive ไม่ได้) |
| `GET` | `/api/students/:id` | officer, student | ดูข้อมูลนักศึกษา (executive ไม่ได้) |
| `POST` | `/api/students/bulk-delete` | officer | ลบนักศึกษาหลายคนพร้อมผลสอบ `{ student_ids, delete_results? }` (มีผลสอบต้องยืนยัน `delete_results: true`) |
| `GET` | `/api/students/pending-accounts` | officer | บัญชีที่ import แล้วยังไม่กรอกโปรไฟล์ |
| `POST` | `/api/students/pending-accounts/delete` | officer | ลบบัญชีกลุ่มนั้น `{ student_ids: [...] }` (ไม่ลบคนที่มีโปรไฟล์แล้ว) |

---

### ✅ Phase 4 — รอบการสอบ (Submission Rounds) `ทดสอบผ่านแล้ว`

| Method | URL | Role | คำอธิบาย |
|---|---|---|---|
| `GET` | `/api/rounds` | ทุก role | ดูรอบทั้งหมด |
| `GET` | `/api/rounds/active` | student | ดูรอบที่เปิดอยู่ของ**รุ่นตัวเอง** (ต้อง `exam_eligible`) |
| `POST` | `/api/rounds` | officer | สร้างรอบใหม่ (`created_by` มาจาก JWT) |
| `PUT` | `/api/rounds/:id` | officer | แก้ไข/เปิด/ปิดรอบ |

> `rounds/active` = `status: "open"` **และ** อยู่ในช่วง `open_date..close_date` **และ** `academic_year` ตรงกับรุ่นของนักศึกษา

**รอบผูกกับรุ่น:** รอบหนึ่งเป็นของ `academic_year` เดียว — นักศึกษารุ่นอื่นเรียก `rounds/active` จะได้ `data: null`
และ `POST /api/exam-results` ก็หารอบจาก `academic_year` ของนักศึกษาโดยตรง กรอกข้ามรุ่นจึงเป็นไปไม่ได้

**เลือกวิชาต่อรอบ:** `subject_ids` (Int[]) — ไม่ส่งมา = ใช้ทุกวิชาในระบบ, รอบที่ `status: "open"` แล้วแก้ `subject_ids` ไม่ได้ (400)
รอบเก่าที่ `subject_ids` ว่าง ถือว่าใช้ทุกวิชา (ดู `src/utils/roundSubjects.js`)

**response ของ `rounds/active`** — แผ่ field ของ round ไว้ชั้นบน แล้วเติม 2 ตัว:

```json
{ "success": true, "data": {
  "round_id": 29, "academic_year": 2568, "attempt_number": 2, "status": "open",
  "subjects": [{ "subject_id": 1, "subject_code": "NUR01", "subject_name": "...",
                 "already_passed": true }],
  "all_passed": false
}}
```

`already_passed` = นักศึกษาคนนี้เคยสอบผ่านวิชานั้นในรอบก่อนแล้ว → หน้ากรอกซ่อนปุ่มให้
`all_passed` = ผ่านครบทุกวิชาของรอบนี้แล้ว ไม่ต้องกรอกอีก

---

### ✅ Phase 5 — ฝั่งนักศึกษา: กรอกผลสอบ `ทดสอบผ่านแล้ว`

| Method | URL | Role | คำอธิบาย |
|---|---|---|---|
| `POST` | `/api/exam-results` | student | ส่ง/แก้ exam result + subject results |
| `GET` | `/api/exam-results/me` | student | ดูผลสอบของตัวเอง |
| `POST` | `/api/exam-results/:id/certificates` | student | อัปโหลดเอกสาร |

**เงื่อนไข `POST /api/exam-results`:** ต้องมี `exam_eligible = true` → ต้องมีรอบเปิดของรุ่นตัวเอง

**หน้าต่างแก้ไข — แก้ทับได้จนกว่าเจ้าหน้าที่จะยืนยัน หรือรอบจะปิด**

| สถานะใบเดิม | รอบ | ผลลัพธ์ |
|---|---|---|
| ไม่มีใบ | open | สร้างใหม่ |
| `pending` | open | ส่งทับได้ |
| `rejected` | open | ส่งทับได้ |
| `approved` | open | **409** ล็อก |
| ใดๆ | closed | **400** (ไม่มีรอบเปิด) |

ส่งทับ = ใช้ `result_id` เดิม ลบผลรายวิชาชุดเก่าทิ้ง กลับเป็น `pending` ล้าง `remark`/`confirmed_by`/`confirmed_at`

body: `{ "subject_results": [{ "subject_id": 1, "is_passed": true }, ... ] }`

**ส่งเฉพาะวิชาที่ยังไม่ผ่าน** — วิชาที่ `already_passed` ไม่ต้องส่งมา backend เติมเป็น "ผ่าน" ให้เอง (copy-forward)
พร้อมตั้ง `carried_forward: true` ไว้ให้ dashboard แยกออกว่าไม่ได้สอบจริงในรอบนี้
ไม่เชื่อค่าที่ client ส่งมาสำหรับวิชาที่ผ่านไปแล้ว กันแก้ผลเก่าให้กลายเป็นไม่ผ่าน

> ⚠️ `already_passed` นับจาก **รอบอื่น** เท่านั้น — `findPassedSubjectIds(student_id, excludeRoundId)`
> ต้องส่ง `excludeRoundId` เป็นรอบที่กำลังกรอก ไม่งั้นใบที่ถูกตีกลับจะล็อกวิชาของตัวเองจนแก้ไม่ได้

ตรวจก่อนบันทึกทุกครั้ง ผิดข้อไหนก็ 400: วิชาไม่อยู่ในรอบ / `is_passed` ไม่ใช่ boolean / ส่งวิชาซ้ำ / กรอกไม่ครบ

**อัปโหลดเอกสาร:** `multipart/form-data`, field `file` (PDF เท่านั้น, ≤10MB) + `certificate_type` = `exam_result` \| `license`.
เก็บไฟล์ที่ `backend/uploads/certificates/` (ตั้งชื่อใหม่กันซ้ำ/กัน path traversal), DB เก็บแค่ `file_path`. เช็ค ownership — อัปโหลดใส่ผลสอบคนอื่นไม่ได้ (403)

> ⚠️ ไฟล์ที่อัปโหลด → เก็บจริงที่ disk เก็บแค่ `file_path` ใน DB อย่าเก็บ binary ใน DB

---

### ✅ Phase 6 — ฝั่งเจ้าหน้าที่: ตรวจสอบ/ยืนยัน `ทดสอบผ่านแล้ว`

| Method | URL | Role | คำอธิบาย |
|---|---|---|---|
| `GET` | `/api/exam-results` | officer | ดูผลสอบทุกคน + filter (executive ไม่ได้ — ดูได้แค่ dashboard) |
| `PATCH` | `/api/exam-results/:id/approve` | officer | ยืนยัน |
| `PATCH` | `/api/exam-results/:id/reject` | officer | ตีกลับ + remark (บังคับ) |
| `PATCH` | `/api/exam-results/:id/revoke-approval` | officer | ถอนการยืนยัน (ยืนยันผิด) approved → pending + remark (บังคับ) |

filter ของ `GET /api/exam-results` ใช้ query string: `?round_id=&staff_status=&student_id=`

approve/reject จะเซ็ต `confirmed_by` (จาก JWT) + `confirmed_at` ให้อัตโนมัติ

> `GET /api/students/:id` เช็ค ownership แล้ว — student ดูของคนอื่นไม่ได้ (403)

---

### ✅ Phase 7 — ข่าวสาร (News) `ทดสอบผ่านแล้ว`

| Method | URL | Role | คำอธิบาย |
|---|---|---|---|
| `GET` | `/api/news` | ทุก role | ดูประกาศทั้งหมด (ใหม่สุดก่อน) + ชื่อผู้โพสต์ + รอบ |
| `POST` | `/api/news` | officer | โพสต์ประกาศ (`posted_by` มาจาก JWT) |
| `PUT` | `/api/news/:id` | officer | แก้ไข (ส่งเฉพาะ field ที่จะแก้ได้) |
| `DELETE` | `/api/news/:id` | officer | ลบ |

body ของ `POST`: `{ "title": "...", "content": "...", "round_id": 5 }` — ครบทั้ง 3 ตัว ไม่งั้น 400

---

### ✅ Phase 8 — Dashboard & รายงาน `ทดสอบผ่านแล้ว`

| Method | URL | Role | คำอธิบาย |
|---|---|---|---|
| `GET` | `/api/dashboard/stats?round_id=` | officer, executive | สรุปสถิติของรอบ (ไม่ส่ง `round_id` = รอบที่เปิดรับอยู่) |
| `GET` | `/api/dashboard/history?years=3` | officer, executive | สรุปรายปีย้อนหลังไว้เทียบรุ่นต่อรุ่น (1–10 ปี) |
| `GET` | `/api/dashboard/export?round_id=` | officer | export รายงาน PDF (ตอบเป็นไฟล์ ไม่ใช่ JSON) |
| `GET` | `/api/dashboard/export-first-attempt?year=&passed=&format=` | officer | รายชื่อผ่าน/ไม่ผ่านครั้งแรกของปีการศึกษา (`format=xlsx\|pdf`) |
| `POST` | `/api/students/export` | officer | ข้อมูลนักศึกษาเป็น Excel — body `{ student_ids }` หรือ `{ year }` (ไม่มีเลขบัตรประชาชน) |

**shape ของ `/stats`**:

```json
{ "success": true, "data": {
  "round": { "round_id": 5, "academic_year": 2568, "attempt_number": 2, "status": "open" },
  "total": 120, "eligible": 104,
  "by": { "draft": 0, "submitted": 40, "approved": 58, "rejected": 6 },
  "not_started": 0, "submitted": 104, "fillRate": 100,
  "fullyPassed": 83, "fullyPassedRate": 80, "subjectPassRate": 91,
  "overallPassRate": 80,
  "perSubject": [{ "subject_id": 1, "subject_code": "NUR01", "subject_name": "...",
                   "pass": 90, "fail": 14, "rate": 87 }]
}}
```

กติกาการนับ:
- ไม่ส่ง `round_id` → เอารอบที่ `status: "open"` ก่อน ถ้าไม่มีค่อยเป็นรอบล่าสุด
- `total` = นักศึกษาทั้งรุ่นที่ `academic_year` ตรงกับรอบ
- `eligible` = เฉพาะคนที่ `exam_eligible: true` — คนที่กรอกได้จริง **ใช้เป็นตัวหารของ `fillRate`**
- **สถิติทุกตัวนับเฉพาะนักศึกษาที่ `exam_eligible: true`** → `by.* + not_started` รวมได้เท่า `eligible` เสมอ
- `not_started` = `eligible` − จำนวน exam_result ในรอบ (ของคนที่มีสิทธิ์)
- `by.submitted` = ส่งแล้วแต่ยังไม่ตรวจ (`staff_status: pending`)
- `perSubject` / `fullyPassed` นับเฉพาะคนที่ `student_status !== "draft"` และ**เฉพาะวิชาของรอบนั้น**
- `perSubject[].rate` นับเฉพาะคนที่**สอบวิชานั้นจริง** (`carried_forward: false`) — ถ้าไม่มีใครสอบเลยจะเป็น `null` ไม่ใช่ `0` (หน้าเว็บแสดง `—`)
- `fullyPassed` **ไม่**ตัด carry-forward ออก — ผ่านวิชานั้นตั้งแต่รอบก่อนก็นับว่าผ่านครบ
- `fullyPassedRate` = % คนที่ผ่านครบทุกวิชา (รายคน) — `subjectPassRate` = % ผลรายวิชาที่ผ่าน (รายวิชา) คนละตัวกัน
- `overallPassRate` = ค่าเดียวกับ `fullyPassedRate` เก็บชื่อเดิมไว้ไม่ให้หน้าเก่าพัง

**shape ของ `/history`** — รวมทุกรอบในปีเข้าด้วยกัน นับเป็น**รายคน** (กรอกหลายรอบในปีเดียวนับครั้งเดียว):

```json
{ "success": true, "data": { "years": [
  { "academic_year": 2568, "total": 120, "eligible": 104,
    "submitted": 100, "fullyPassed": 83, "fillRate": 96, "passRate": 83,
    "rounds": [{ "round_id": 5, "attempt_number": 2, "status": "open",
                 "subject_count": 8, "submitted": 60, "fullyPassed": 50 }] }
]}}
```

**PDF:** ใช้ `pdfkit` + embed font Sarabun ที่ `backend/assets/fonts/` — ถ้าไม่ embed ภาษาไทยจะกลายเป็นสี่เหลี่ยม **ห้ามลบโฟลเดอร์นี้**

---

##  ค่าสถานะมาตรฐาน (ใช้ให้ตรงกันทั้งระบบ)

| คอลัมน์ | ค่าที่ใช้ได้ |
|---|---|
| `submission_rounds.status` | `open` \| `closed` |
| `exam_results.student_status` | `draft` \| `submitted` |
| `exam_results.staff_status` | `pending` \| `approved` \| `rejected` |
| `certificates.certificate_type` | `exam_result` (ใบผลสอบ) \| `license` (ใบประกอบวิชาชีพ) |

---

##  การทดสอบ

```bash
npm run test:clean      # ← ใช้อันนี้ ทำ seed + เปิด server + รันครบ 11 ไฟล์ + เก็บกวาดให้เอง
```

ทำงานบน PostgreSQL schema ชั่วคราว (`verify_tmp`) แล้วลบทิ้ง — **ไม่แตะข้อมูล demo ที่ใช้อยู่**
ไม่ต้อง seed เอง ไม่ต้องเปิด server เอง

แบบเดิม (ยิงใส่ DB ตัวที่ใช้จริง — จะ fail หลายตัวถ้ามีข้อมูล demo ค้าง):
```bash
npx prisma db seed      # ล้าง+ใส่ข้อมูลตัวอย่าง (roles, 8 วิชา, user 3 role)
npm start               # เปิด server ที่ port 3000 (คนละ terminal)
npm test                # ต่อไฟล์ด้วย && — ไฟล์แรกพังแล้วที่เหลือไม่ได้รัน
```

| ไฟล์เทส | ครอบอะไร |
|---|---|
| `smoke-phase1-3.mjs` (17 เคส) | auth, subjects, users/students |
| `smoke-phase4-6.mjs` (46 เคส) | rounds, กรอกผลสอบ, ตรวจ/ยืนยัน |
| `smoke-phase9-import.mjs` | import CSV รายชื่อนักศึกษา |
| `smoke-phase10-round-subjects.mjs` | เลือกวิชาต่อรอบ (`subject_ids`) |
| `smoke-phase11-carry-forward.mjs` (27 เคส) | วิชาที่ผ่านแล้วไม่ต้องกรอกซ้ำ, กันกรอกข้ามรุ่น, dashboard เลือกรอบที่เปิด |

เช็คทั้ง happy path และ 401/403/404/409/400

⚠️ `npm test` เขียนข้อมูลจริงลง DB — ต้องรัน seed ใหม่ก่อนทุกครั้ง
(`npm run test:clean` ไม่มีปัญหานี้ เพราะสร้าง schema ใหม่ให้ทุกรอบ)

**บัญชีตัวอย่างจาก seed** (`faculty_id` ต้องส่ง `"14"` ตอน login):

| psu_passport_id | role |
|---|---|
| `6610210631` | student |
| `456` | officer |
| `789` | executive |

---

## 🔐 Security Checklist

- [x] อ่าน role จาก JWT payload เท่านั้น ห้ามเชื่อ body ที่ client ส่งมา
- [x] `JWT_SECRET`, `DATABASE_URL` → ต้องอยู่ใน `.env` (มี `.env.example` ให้คัดลอกแล้ว)
- [x] ทุก endpoint ที่ไม่ใช่ public → ต้องผ่าน `authenticate` middleware
- [x] ไม่มีค่า hardcode ที่ต้องแก้โค้ดตอนย้าย server — `CORS_ORIGIN` / `COOKIE_SECURE` อยู่ใน `.env`

- [x] `helmet` ใส่ security header ทุก response
- [x] rate limit ครบทั้ง `/auth/login` (2 ชั้น: id + IP) และ `/auth/password`
- [x] ไม่มี endpoint ที่เปิด public โดยไม่จำเป็น (`/api/rooms` ใส่ `authenticate` แล้ว)

**ก่อนขึ้น server จริง (HTTPS) ต้องทำ:**
- [ ] `.env` ตั้ง `COOKIE_SECURE="true"` (ไม่งั้น token วิ่งเป็นข้อความเปล่าให้ดักอ่านได้)
- [ ] `.env` ตั้ง `CORS_ORIGIN` เป็น domain จริง และ `NODE_ENV="production"` (ไม่ส่ง stack trace ออกไป)
- [ ] frontend `.env` ตั้ง `VITE_API_BASE` เป็น URL จริง
- [ ] ตัดสินใจเรื่องรหัสผ่านนักศึกษา = เลขบัตรประชาชน (ตอนนี้เป็นรหัสถาวร เปลี่ยนไม่ได้)

---

## 💡 Tips การทำ Module ใหม่

```
1. สร้าง folder ใน src/modules/<ชื่อ>/
2. เขียน repository.js ก่อน — query Prisma
3. เขียน controller.js — รับ req, เรียก repository, ส่ง res
4. เขียน routes.js — endpoint + middleware
5. import routes เข้า app.js
6. ทดสอบ Postman ทีละ endpoint
```

**Response Format มาตรฐาน:**
```js
// ✅ Success
res.json({ success: true, data: { ... } })

// ❌ Error — ใช้ next(err) ให้ errorHandler จัดการ
const err = new Error("ไม่พบข้อมูล");
err.statusCode = 404;
next(err);
```
