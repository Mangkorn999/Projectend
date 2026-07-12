# ระบบบันทึกใบประกอบวิชาชีพ (Nursing License Record System)

โปรเจกต์จบ (ป.ตรี IT, ม.สงขลานครินทร์). Web app จัดการ+ติดตามผลสอบใบประกอบวิชาชีพนักศึกษาพยาบาล. ใช้เฉพาะภายในคณะพยาบาล ไม่เชื่อมคณะ/หน่วยงานอื่น.

**ทีม:** มังกร (ธัญเทพ) = Backend + Database. แก้ม (ฉันท์ชนก) = Frontend.
**ที่ปรึกษา:** ผศ.ดร.กิตย์ศิริ ช่อเจี้ยง

Requirement ทั้งหมดอิงตาม `รายงานระบบบันทึกใบประกอบวิชาชีพ.docx` เท่านั้น — ห้ามเพิ่ม feature นอกเหนือรายงานโดยไม่ถามผู้ใช้ก่อน.

---

## Tech Stack

| Layer | เทคโนโลยี |
|---|---|
| Frontend | React.js (Vite), HTML/CSS/JS |
| Backend | Node.js + Express.js |
| Database | PostgreSQL + Prisma ORM |
| Auth | PSU One Passport (ยืนยันตัวตน) → ระบบออก JWT เอง |

Path จริง: `frontend/` = React+Vite (`nurse-login-new`), `backend/` = Express+Prisma.

**หมายเหตุ:** `README.md` และ `.env.example` ที่ root ยังเป็นของเก่า (SyntaxCraft) หลงเหลืออยู่ — ไม่เกี่ยวกับโปรเจกต์นี้ อย่าอ้างอิง.

---

## ผู้ใช้งาน 3 กลุ่ม + สิทธิ์

### 1. นักศึกษา (Student)
- Login ผ่าน PSU One Passport
- กรอกรหัสเว็บสภาการพยาบาล (email+password) → เก็บแบบเข้ารหัส
- กรอกผลสอบรายวิชา 8 วิชา (ผ่าน/ไม่ผ่านแต่ละวิชา)
- อัปโหลดเอกสารหลักฐาน (PDF) — ใบผลสอบ, ใบประกอบวิชาชีพ
- ดูสถานะการกรอก (รอยืนยัน / ยืนยันแล้ว / ตีกลับ)
- ดูประวัติผลสอบของตัวเอง
- ดูประกาศ/ข่าวสาร

### 2. เจ้าหน้าที่คณะ (Faculty Officer)
- Login ผ่าน PSU One Passport
- ดู Dashboard สรุปผลสอบ
- ตรวจสอบ/ยืนยัน/ตีกลับ (พร้อม remark) ผลสอบนักศึกษา
- จัดการรอบการกรอกผลสอบ (เปิด/ปิด/สร้างรอบ)
- จัดการรายวิชา (เพิ่ม/ลบ/แก้ไข)
- จัดการผู้ใช้งาน (เพิ่ม/ลบ ผู้บริหารคณะ, จัดการสิทธิ์)
- โพสต์/แก้ไข/ลบ ข่าวสารและประกาศ
- ออกรายงานผลสอบ (PDF)
- ดูรหัสสภาของนักศึกษา (decrypt ชั่วคราว) — endpoint แยกเฉพาะเท่านั้น

### 3. ผู้บริหารคณะ (Faculty Executive)
- Login ผ่าน PSU One Passport
- ดู Dashboard สรุปผลสอบภาพรวม + สถิติ (อัตราผ่าน/ไม่ผ่าน)
- ดูรายละเอียดนักศึกษา + ผลการกรอกรายบุคคล
- **ไม่มีสิทธิ์แก้ไขข้อมูล** (read-only บนข้อมูลผลสอบ)

---

## Database Schema (Prisma, PostgreSQL) — 11 ตาราง

`backend/prisma/schema.prisma` = source of truth ตรงกับ data dictionary ในรายงาน (บทที่ 3.4) แล้ว:

- `roles` — บทบาทผู้ใช้
- `users` — ทุก role, ผูก PSU Passport ID
- `faculties` — คณะ (ปัจจุบันใช้แค่คณะพยาบาล)
- `rooms` — ห้องเรียน
- `students` — ข้อมูลนักศึกษา, มี `nursing_council_email` / `nursing_council_password` (ต้อง**เข้ารหัสเสมอ**)
- `subjects` — รายวิชาที่ใช้สอบ (8 วิชา)
- `submission_rounds` — รอบการกรอกผลสอบ
- `exam_results` — ผลสอบต่อรอบ, มี `student_status` + `staff_status` แยกกัน
- `subject_results` — ผลสอบรายวิชา (ผ่าน/ไม่ผ่าน)
- `certificates` — ไฟล์หลักฐาน (เก็บแค่ `file_path`, **ห้ามเก็บ binary ใน DB**)
- `news` — ข่าวสาร/ประกาศ

ความสัมพันธ์สำคัญ: `users` 1:0..1 `students` (ผู้ใช้บางคนไม่ใช่นักศึกษา), ส่วนใหญ่เป็น 1:M.

---

## Backend — แผนงาน (มังกรรับผิดชอบ)

รายละเอียด phase-by-phase + endpoint list + response format มาตรฐาน อยู่ใน [`backend/Backend.md`](backend/Backend.md) — เอกสารหลักสำหรับ backend, อัปเดตที่นี่เมื่อ progress เปลี่ยน.

สรุปลำดับ: Setup ✅ → Auth middleware → Subjects CRUD → Users/Students → Rounds → Student กรอกผล → Staff ตรวจ/ยืนยัน → News → Dashboard/Export.

Pattern ทุก module: `routes.js → controller.js → service.js → repository.js` (repository คุย Prisma เท่านั้น).

### Security Checklist (ต้องทำก่อนขึ้น production)
- [ ] `nursing_council_password` เข้ารหัส AES-256-GCM ทุกครั้งก่อน save (`backend/src/utils/crypto.js`)
- [ ] Endpoint ฝั่งนักศึกษา **ห้าม** return รหัสสภา แม้แบบ encrypted
- [ ] อ่าน role จาก JWT payload เท่านั้น — ห้ามเชื่อ role ที่ client ส่งมาใน body
- [ ] `JWT_SECRET`, `DATABASE_URL`, `AES_KEY` อยู่ใน `.env` เท่านั้น ห้าม commit
- [ ] ทุก endpoint ที่ไม่ public ต้องผ่าน `authenticate` middleware ก่อน `requireRole`

---

## Frontend — ขอบเขตงาน (แก้มรับผิดชอบ)

ต้องทำหน้าจอตามรายงานบทที่ 4 (4.1–4.3), แบ่งตาม 3 กลุ่มผู้ใช้:

**นักศึกษา:** Login (PSU One Passport) → ประกาศ/ข่าวสาร → ประวัติการกรอก → กรอกรหัสเว็บสภา → กรอกผลสอบ (8 วิชา) → อัปโหลดเอกสาร (PDF) → ดูสถานะการกรอก

**เจ้าหน้าที่คณะ:** Login → Dashboard → รายละเอียดนักศึกษา → รายละเอียดการกรอกของนักศึกษา (ตรวจสอบ/ยืนยัน/ตีกลับ) → จัดการรายวิชา → จัดการรอบสอบ → จัดการผู้ใช้งาน (ผู้บริหาร)

**ผู้บริหารคณะ:** Login → Dashboard สรุปภาพรวม → รายละเอียดนักศึกษา → ผลการกรอกนักศึกษา (read-only)

Auth flow ฝั่ง frontend: หลัง login ได้ JWT จาก backend → เก็บ token → แนบ `Authorization: Bearer <token>` ทุก request → redirect ตาม role.

---

## Task Boundaries — กติกาการแบ่งงาน

- **มังกร (Backend/DB):** เป็นเจ้าของ `backend/**` ทั้งหมด รวม Prisma schema/migration. เปลี่ยน schema ต้องแจ้งแก้มถ้ากระทบ response shape ที่ frontend ใช้.
- **แก้ม (Frontend):** เป็นเจ้าของ `frontend/**` ทั้งหมด. เรียก backend ผ่าน REST API ตาม endpoint ใน `backend/Backend.md` เท่านั้น — ห้าม hardcode logic ที่ควรอยู่ backend (เช่น encrypt, คำนวณสถานะผ่าน/ไม่ผ่าน) ไว้ฝั่ง frontend.
- จุดต่อกัน (contract) คือ REST API response format: `{ success: true, data: {...} }` หรือ error ผ่าน `next(err)` — ทั้งคู่ต้อง sync กันก่อนเปลี่ยน endpoint shape.
- Requirement นอกเหนือรายงาน → ถามเจ้าของ repo (มังกร) ก่อนเพิ่ม ห้ามเดาเอง.

---

## Conventions

- Response format มาตรฐาน backend: success → `res.json({ success: true, data })`, error → `throw`/`next(err)` พร้อม `err.statusCode`.
- ไฟล์อัปโหลด (PDF) เก็บที่ disk เก็บแค่ path ใน DB.
- ชื่อ field ทุกตารางใช้ `snake_case` ตรงกับ data dictionary ในรายงาน — อย่าเปลี่ยนชื่อ column โดยไม่จำเป็น.
