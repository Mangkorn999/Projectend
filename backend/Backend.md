# 📋 แผนพัฒนา Backend — ระบบบันทึกใบประกอบวิชาชีพ
**Stack:** Node.js + Express.js + PostgreSQL + Prisma ORM  
**Auth:** PSU One Passport → JWT  

---

## 🗂️ โครงสร้าง Folder

```
backend/
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
    ├── utils/
    │   └── crypto.js          ✅ AES-256-GCM encrypt/decrypt รหัสสภา
    │
    ├── modules/               ← แต่ละ module มีโครงสร้างเดียวกัน
    │   ├── auth/              🔲 Phase 1 — ยังไม่ครบ
    │   ├── users/             🔲 Phase 3
    │   ├── students/          🔲 Phase 3
    │   ├── rounds/            🔲 Phase 4
    │   ├── examResults/       🔲 Phase 5
    │   ├── certificates/      🔲 Phase 5
    │   ├── news/              🔲 Phase 7
    │   └── dashboard/         🔲 Phase 8
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

### 🔲 Phase 1 — Auth Middleware `← เริ่มตรงนี้`

> **ทำก่อนทุกอย่าง** เพราะทุก endpoint ถัดไปต้องรู้ว่า "ใครเรียก และ role อะไร"

- [/] ทดสอบ `POST /api/auth/login` ด้วย Postman ว่าคืน JWT ได้จริง
- [/] ทดสอบ `auth.js` middleware — ลอง request โดยไม่มี token → ต้องได้ 401
- [/] ทดสอบ `requireRole.js` — ลอง request ด้วย token role ผิด → ต้องได้ 403
- [/] สร้าง `GET /api/auth/me` — ดึงข้อมูล user ปัจจุบันจาก JWT

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

### 🔲 Phase 2 — Subjects CRUD `วอร์มมือก่อน`

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

### 🔲 Phase 3 — จัดการผู้ใช้ (Users & Students)

| Method | URL | Role | คำอธิบาย |
|---|---|---|---|
| `GET` | `/api/users` | staff | ดูรายชื่อผู้ใช้ทั้งหมด |
| `POST` | `/api/users/:id/role` | staff | เปลี่ยน role ผู้ใช้ |
| `GET` | `/api/students` | staff | ดูรายชื่อนักศึกษา |
| `GET` | `/api/students/:id` | staff, student | ดูข้อมูลนักศึกษา |
| `PATCH` | `/api/students/me/credentials` | student | บันทึกรหัสสภา (encrypt) |

---

### 🔲 Phase 4 — รอบการสอบ (Submission Rounds)

| Method | URL | Role | คำอธิบาย |
|---|---|---|---|
| `GET` | `/api/rounds` | ทุก role | ดูรอบทั้งหมด |
| `GET` | `/api/rounds/active` | student | ดูรอบที่เปิดอยู่ตอนนี้ |
| `POST` | `/api/rounds` | staff | สร้างรอบใหม่ |
| `PUT` | `/api/rounds/:id` | staff | แก้ไข/เปิด/ปิดรอบ |

---

### 🔲 Phase 5 — ฝั่งนักศึกษา: กรอกผลสอบ

| Method | URL | Role | คำอธิบาย |
|---|---|---|---|
| `POST` | `/api/exam-results` | student | สร้าง exam result + subject results |
| `GET` | `/api/exam-results/me` | student | ดูผลสอบของตัวเอง |
| `POST` | `/api/exam-results/:id/certificates` | student | อัปโหลดเอกสาร |

> ⚠️ ไฟล์ที่อัปโหลด → เก็บจริงที่ disk เก็บแค่ `file_path` ใน DB อย่าเก็บ binary ใน DB

---

### 🔲 Phase 6 — ฝั่งเจ้าหน้าที่: ตรวจสอบ/ยืนยัน

| Method | URL | Role | คำอธิบาย |
|---|---|---|---|
| `GET` | `/api/exam-results` | staff | ดูผลสอบทุกคน + filter |
| `PATCH` | `/api/exam-results/:id/approve` | staff | ยืนยัน |
| `PATCH` | `/api/exam-results/:id/reject` | staff | ตีกลับ + remark |
| `GET` | `/api/students/:id/credentials` | staff | ดูรหัสสภา (decrypt ชั่วคราว) |

> ⚠️ endpoint `credentials` ต้องแยกโดยเฉพาะ — endpoint อื่น **ห้าม** return รหัสสภา

---

### 🔲 Phase 7 — ข่าวสาร (News)

| Method | URL | Role | คำอธิบาย |
|---|---|---|---|
| `GET` | `/api/news` | ทุก role | ดูประกาศทั้งหมด |
| `POST` | `/api/news` | staff | โพสต์ประกาศ |
| `PUT` | `/api/news/:id` | staff | แก้ไข |
| `DELETE` | `/api/news/:id` | staff | ลบ |

---

### 🔲 Phase 8 — Dashboard & รายงาน `ทำหลังสุด`

> ต้องมีข้อมูลจริงจาก Phase 5-6 ก่อน

| Method | URL | Role | คำอธิบาย |
|---|---|---|---|
| `GET` | `/api/dashboard/stats` | admin, staff | สรุปสถิติ (ผ่าน/ไม่ผ่าน) |
| `GET` | `/api/dashboard/export` | staff | export รายงาน PDF |

---

## 🔐 Security Checklist

- [ ] `nursing_council_password` → encrypt AES-256-GCM ทุกครั้งก่อน save
- [ ] endpoint นักศึกษา **ห้าม** return รหัสผ่านสภา (แม้แบบ encrypted)
- [ ] อ่าน role จาก JWT payload เท่านั้น ห้ามเชื่อ body ที่ client ส่งมา
- [ ] `JWT_SECRET`, `DATABASE_URL`, `AES_KEY` → ต้องอยู่ใน `.env`
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
