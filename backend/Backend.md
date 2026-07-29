# 📋 แผนพัฒนา Backend — ระบบบันทึกใบประกอบวิชาชีพ
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

**วิธีทดสอบ Postman:**
```
# 1. Login ก่อน
POST http://localhost:3000/api/auth/login
Body: { "psu_passport_id": "6510110001" }

# 2. Copy token จาก response ใส่ header
GET http://localhost:3000/api/auth/me
Authorization: Bearer <token>
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
| `GET` | `/api/students` | staff | ดูรายชื่อนักศึกษา |
| `GET` | `/api/students/:id` | staff, student | ดูข้อมูลนักศึกษา |

---

### ✅ Phase 4 — รอบการสอบ (Submission Rounds) `ทดสอบผ่านแล้ว`

| Method | URL | Role | คำอธิบาย |
|---|---|---|---|
| `GET` | `/api/rounds` | ทุก role | ดูรอบทั้งหมด |
| `GET` | `/api/rounds/active` | student | ดูรอบที่เปิดอยู่ตอนนี้ (ต้อง `exam_eligible`) |
| `POST` | `/api/rounds` | officer | สร้างรอบใหม่ (`created_by` มาจาก JWT) |
| `PUT` | `/api/rounds/:id` | officer | แก้ไข/เปิด/ปิดรอบ |

> `rounds/active` = `status: "open"` **และ** ตอนนี้อยู่ในช่วง `open_date..close_date`

---

### ✅ Phase 5 — ฝั่งนักศึกษา: กรอกผลสอบ `ทดสอบผ่านแล้ว`

| Method | URL | Role | คำอธิบาย |
|---|---|---|---|
| `POST` | `/api/exam-results` | student | สร้าง exam result + subject results |
| `GET` | `/api/exam-results/me` | student | ดูผลสอบของตัวเอง |
| `POST` | `/api/exam-results/:id/certificates` | student | อัปโหลดเอกสาร |

**เงื่อนไข `POST /api/exam-results`:** ต้องมี `exam_eligible = true` → ต้องมีรอบเปิดอยู่ → กรอกซ้ำรอบเดิมไม่ได้ (409)

body: `{ "subject_results": [{ "subject_id": 1, "is_passed": true }, ... ] }`

**อัปโหลดเอกสาร:** `multipart/form-data`, field `file` (PDF เท่านั้น, ≤10MB) + `certificate_type` = `exam_result` \| `license`.
เก็บไฟล์ที่ `backend/uploads/certificates/` (ตั้งชื่อใหม่กันซ้ำ/กัน path traversal), DB เก็บแค่ `file_path`. เช็ค ownership — อัปโหลดใส่ผลสอบคนอื่นไม่ได้ (403)

> ⚠️ ไฟล์ที่อัปโหลด → เก็บจริงที่ disk เก็บแค่ `file_path` ใน DB อย่าเก็บ binary ใน DB

---

### ✅ Phase 6 — ฝั่งเจ้าหน้าที่: ตรวจสอบ/ยืนยัน `ทดสอบผ่านแล้ว`

| Method | URL | Role | คำอธิบาย |
|---|---|---|---|
| `GET` | `/api/exam-results` | officer, executive | ดูผลสอบทุกคน + filter |
| `PATCH` | `/api/exam-results/:id/approve` | officer | ยืนยัน |
| `PATCH` | `/api/exam-results/:id/reject` | officer | ตีกลับ + remark (บังคับ) |

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
| `GET` | `/api/dashboard/stats?round_id=` | officer, executive | สรุปสถิติของรอบ (ไม่ส่ง `round_id` = รอบล่าสุด) |
| `GET` | `/api/dashboard/export?round_id=` | officer | export รายงาน PDF (ตอบเป็นไฟล์ ไม่ใช่ JSON) |

**shape ของ `/stats`** — ตรงกับ `computeStats()` ที่ frontend ใช้อยู่ (`frontend/src/design/data.jsx`):

```json
{ "success": true, "data": {
  "round": { "round_id": 5, "academic_year": 2568, "attempt_number": 2, "status": "open" },
  "total": 120, "by": { "draft": 0, "submitted": 40, "approved": 58, "rejected": 6 },
  "not_started": 16, "submitted": 104, "fillRate": 87,
  "fullyPassed": 83, "overallPassRate": 80,
  "perSubject": [{ "subject_id": 1, "subject_code": "NUR01", "subject_name": "...",
                   "pass": 90, "fail": 14, "rate": 87 }]
}}
```

กติกาการนับ:
- `total` = นักศึกษาที่ `academic_year` ตรงกับรอบ (นักศึกษา import เข้าระบบก่อน)
- `by.submitted` = ส่งแล้วแต่ยังไม่ตรวจ (`staff_status: pending`)
- `not_started` = `total` − จำนวน exam_result ในรอบ (ยังไม่เริ่มกรอกเลย)
- `perSubject` / `fullyPassed` / `overallPassRate` นับเฉพาะคนที่ `student_status !== "draft"`

**PDF:** ใช้ `pdfkit` + embed font Sarabun ที่ `backend/assets/fonts/` — ถ้าไม่ embed ภาษาไทยจะกลายเป็นสี่เหลี่ยม **ห้ามลบโฟลเดอร์นี้**

---

## 🔤 ค่าสถานะมาตรฐาน (ใช้ให้ตรงกันทั้งระบบ)

| คอลัมน์ | ค่าที่ใช้ได้ |
|---|---|
| `submission_rounds.status` | `open` \| `closed` |
| `exam_results.student_status` | `draft` \| `submitted` |
| `exam_results.staff_status` | `pending` \| `approved` \| `rejected` |
| `certificates.certificate_type` | `exam_result` (ใบผลสอบ) \| `license` (ใบประกอบวิชาชีพ) |

---

## 🧪 การทดสอบ

```bash
npx prisma db seed      # หรือ node prisma/seed.js — ล้าง+ใส่ข้อมูลตัวอย่าง (roles, 8 วิชา, user 3 role)
npm start               # เปิด server ที่ port 3000 (คนละ terminal)
npm test                # ยิงทุก endpoint จริง — Phase 1-6
```

`tests/smoke-phase1-3.mjs` (17 เคส) + `tests/smoke-phase4-6.mjs` (46 เคส) — เช็คทั้ง happy path และ 401/403/404/409/400

⚠️ เทสเขียนข้อมูลจริงลง DB — รัน seed ใหม่ก่อนทุกครั้ง

**บัญชีตัวอย่างจาก seed** (`faculty_id` ต้องส่ง `"14"` ตอน login):

| psu_passport_id | role |
|---|---|
| `6610210631` | student |
| `456` | officer |
| `789` | executive |

---

## 🔐 Security Checklist

- [ ] อ่าน role จาก JWT payload เท่านั้น ห้ามเชื่อ body ที่ client ส่งมา
- [ ] `JWT_SECRET`, `DATABASE_URL` → ต้องอยู่ใน `.env`
- [ ] ทุก endpoint ที่ไม่ใช่ public → ต้องผ่าน `authenticate` middleware

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
