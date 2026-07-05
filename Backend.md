# แผนพัฒนา Backend — ระบบบันทึกใบประกอบวิชาชีพ (คณะพยาบาล)

Stack: **Node.js + Express.js + PostgreSQL** | Auth: **PSU One Passport (OAuth)**
เอกสารนี้เป็น "แผนงาน" ไม่ใช่โค้ด — เป้าหมายคือให้เห็น flow ว่าต้องทำอะไรก่อนหลัง ส่วนโค้ดจริงลองเขียนเองตามแผนนี้

---

## 1. หลักการเรียงลำดับงาน

กฎง่ายๆ ที่ใช้ตัดสินว่า "อะไรก่อนอะไรหลัง":
1. **ตารางที่ไม่มี FK ชี้ออก** ต้องสร้างก่อนเสมอ (ไม่งั้น FK อ้างไม่ถึง)
2. **Auth ต้องมาก่อน business logic ทุกอย่าง** เพราะทุก endpoint ต้องรู้ว่า "ใครเรียก และเป็น role อะไร"
3. **เขียน flow ที่ "สร้างข้อมูล" ก่อน flow ที่ "อ่าน/สรุปข้อมูล"** เช่น ต้องมี exam_results ก่อนถึงจะทำ dashboard สรุปผลได้

---

## 2. ลำดับสร้างตาราง (Database Schema Order)

ไล่ตาม FK dependency จาก data dictionary ในเล่ม:

```
Step 1 (ไม่มี FK เลย — สร้างพร้อมกันได้)
├── roles
├── faculties
├── rooms
└── subjects

Step 2 (FK ไปหา Step 1)
└── users            → FK: role_id → roles

Step 3 (FK ไปหา Step 2)
└── students         → FK: user_id → users, faculty_id → faculties, room_id → rooms

Step 4 (FK ไปหา Step 2)
└── submission_rounds → FK: created_by → users

Step 5 (FK ไปหา Step 3 + Step 4)
└── exam_results      → FK: student_id → students, round_id → submission_rounds,
                              confirmed_by → users

Step 6 (FK ไปหา Step 5)
├── subject_results   → FK: result_id → exam_results, subject_id → subjects
└── certificates      → FK: result_id → exam_results

Step 7 (FK ไปหา Step 2 + Step 4)
└── news              → FK: posted_by → users, round_id → submission_rounds
```

> เขียน migration/SQL ตามลำดับนี้ ห้ามสลับ ไม่งั้น `CREATE TABLE` จะ error เพราะ FK อ้างตารางที่ยังไม่มี

**จุดที่ต้องคิดเพิ่มตอนสร้างตาราง `students`:**
- field `nursing_council_password` → เก็บเป็น VARCHAR(255) ตามเดิม แต่ **encrypt ก่อน insert เสมอ** อย่าให้มี path ไหนใน backend ที่ insert ค่า plaintext ตรงๆ ลงคอลัมน์นี้ได้

---

## 3. โครงสร้างโปรเจกต์ (แนะนำแบบ feature-based ไม่ใช่ MVC แบบเก่า)

```
src/
├── config/
│   ├── db.js              # PostgreSQL connection pool
│   └── env.js             # โหลด .env, validate ว่ามีครบ
├── middlewares/
│   ├── auth.js            # ตรวจ JWT / session จาก PSU Passport
│   ├── requireRole.js     # เช็คว่า role ตรงกับที่ endpoint ต้องการไหม
│   └── errorHandler.js    # จับ error ทุกจุด ส่ง response format เดียวกัน
├── utils/
│   └── crypto.js          # encrypt/decrypt AES-256 สำหรับ nursing_council_password
├── modules/
│   ├── auth/
│   ├── users/
│   ├── students/
│   ├── rounds/            # submission_rounds
│   ├── examResults/
│   ├── certificates/
│   ├── news/
│   └── dashboard/
│       # แต่ละ module มี: routes.js, controller.js, service.js, repository.js
├── app.js                 # ประกอบ express app + middleware
└── server.js              # เริ่ม server, listen port
```

**ทำไมแยกแบบนี้:** ตอน debug จะได้รู้ทันทีว่าปัญหาอยู่ module ไหน ไม่ต้องไล่หาทั้งโปรเจกต์ และเวลาเพิ่ม feature ใหม่ก็เพิ่มทั้ง folder เดียว ไม่กระทบ module อื่น

---

## 4. ลำดับพัฒนา Backend (Phase by Phase)

### Phase 0 — Setup พื้นฐาน
- [ ] ตั้ง Express project, ต่อ PostgreSQL (แนะนำใช้ `pg` หรือถ้าอยากได้ type-safety ใช้ `Prisma`/`Drizzle`)
- [ ] `.env` เก็บ DB credentials, JWT secret, AES encryption key, PSU Passport client id/secret
- [ ] ตั้ง error handler กลาง + response format มาตรฐาน เช่น `{ success, data, error }`

### Phase 1 — Authentication (ทำก่อนทุกอย่าง)
- [ ] เชื่อม PSU One Passport OAuth flow (redirect → callback → รับ token)
- [ ] map ข้อมูลที่ได้จาก PSU Passport → insert/update ตาราง `users` (ถ้าเป็นบัญชีใหม่ ให้สร้างแถวใหม่)
- [ ] ออก JWT ของระบบเราเอง (เก็บ user_id, role_id ใน payload) หลัง login สำเร็จ
- [ ] เขียน middleware `auth.js` (verify JWT) และ `requireRole.js` (เช็คสิทธิ์ตาม role)

> **เหตุผลที่ต้องทำก่อน:** ทุก endpoint ถัดไปต้องรู้ role ผู้เรียก ถ้ายังไม่มี auth จะ test endpoint อื่นไม่ได้เลยว่า permission ถูกไหม

### Phase 2 — ตาราง Reference/Lookup (CRUD ง่ายๆ)
- [ ] CRUD: `subjects` (เจ้าหน้าที่ เพิ่ม/ลบ/แก้ รายวิชา — ตามข้อ 4.2.5 ในเล่ม)
- [ ] `faculties`, `rooms` ส่วนใหญ่ seed ข้อมูลตรงๆ ไม่ต้องมี UI จัดการก็ได้ (คณะพยาบาลมีคณะเดียว ห้องเรียนไม่ค่อยเปลี่ยน)

### Phase 3 — จัดการผู้ใช้งาน
- [ ] endpoint ให้เจ้าหน้าที่เพิ่ม/ลบสิทธิ์ผู้บริหารคณะ (ข้อ 4.2.7)
- [ ] logic ผูก `students` เข้ากับ `users` (ตอน login ครั้งแรกของนักศึกษา ต้องสร้างแถว `students` ถ้ายังไม่มี)

### Phase 4 — จัดการรอบการสอบ (Submission Rounds)
- [ ] CRUD `submission_rounds` — เจ้าหน้าที่เปิด/ปิดรอบ (ข้อ 4.2.6)
- [ ] logic ตรวจ `open_date` / `close_date` ว่านักศึกษายังกรอกได้อยู่ไหม (ใช้เช็คตอน Phase 5)

### Phase 5 — ฝั่งนักศึกษา: กรอกผลสอบ
- [ ] endpoint กรอกรหัสเว็บสภาการพยาบาล → **encrypt ก่อน save** (ใช้ `utils/crypto.js`)
- [ ] endpoint สร้าง `exam_results` + `subject_results` (กรอกผล 8 วิชา ผ่าน/ไม่ผ่าน)
- [ ] endpoint อัปโหลดเอกสาร → `certificates` (เก็บไฟล์ที่ disk/S3 แล้วเก็บ path ใน DB เท่านั้น อย่าเก็บไฟล์ตรงๆ ใน DB)
- [ ] endpoint ดูสถานะของตัวเอง (`student_status`)

### Phase 6 — ฝั่งเจ้าหน้าที่: ตรวจสอบ/ยืนยัน
- [ ] endpoint ดูรายละเอียดนักศึกษา + ผลกรอก (ข้อ 4.2.3, 4.2.4)
- [ ] endpoint ยืนยัน/ตีกลับผลสอบ → update `staff_status`, `confirmed_by`, `confirmed_at`, `remark`
- [ ] **ตรงนี้เป็นจุดที่ต้องใช้รหัสเว็บสภาที่ encrypt ไว้** → เขียน endpoint แยกต่างหากสำหรับ "ขอดูรหัส" (decrypt แล้ว mask/แสดงชั่วคราว) อย่าให้ endpoint อื่นที่ดึงข้อมูลนักศึกษาทั่วไป return ค่า decrypt ออกมาด้วย

### Phase 7 — ข่าวสาร/ประกาศ
- [ ] CRUD `news` — เจ้าหน้าที่โพสต์, ทุก role อ่านได้

### Phase 8 — Dashboard & รายงาน (ผู้บริหารคณะ)
- [ ] endpoint สรุปสถิติ (อัตราผ่าน/ไม่ผ่าน) — เขียน SQL แบบ aggregate (`GROUP BY`, `COUNT`, `AVG`) ทำตอนนี้เพราะต้องมีข้อมูลจาก Phase 5-6 ก่อนถึงจะมีอะไรให้สรุป
- [ ] endpoint export PDF (ข้อ 1.3 ของเจ้าหน้าที่ก็ต้องมีเหมือนกัน)

---

## 5. เช็คลิสต์ security ที่ต้องไม่ลืม (จากที่คุยกันก่อนหน้า)

- [ ] `nursing_council_password` → AES-256-GCM encrypt/decrypt, เก็บ key ใน `.env` ไม่เก็บใน DB
- [ ] response ที่ดึงข้อมูล student ทั่วไป **ห้าม** มี field รหัสผ่านสภาแบบ decrypt ปนมาโดย default
- [ ] JWT secret, DB password, AES key ต้องอยู่ใน `.env` และ `.env` ต้องอยู่ใน `.gitignore`
- [ ] ทุก endpoint ต้องผ่าน `requireRole` middleware — อย่าเชื่อ role จาก body ที่ client ส่งมาเอง ต้องอ่านจาก JWT payload เท่านั้น

---

## 6. ลำดับแนะนำโดยสรุป (ถ้าจะเริ่มพรุ่งนี้)

```
1. Setup + DB connection
2. สร้างตารางตามลำดับใน ข้อ 2
3. Auth (PSU Passport + JWT + role middleware)
4. Subjects CRUD (ง่ายสุด ใช้วอร์มความชิน pattern)
5. Submission rounds CRUD
6. นักศึกษา: กรอกผลสอบ + upload + encrypt password
7. เจ้าหน้าที่: ตรวจสอบ/ยืนยัน
8. News
9. Dashboard/รายงาน (ทำหลังสุด เพราะต้องมีข้อมูลจริงให้สรุป)
```

ลองเริ่มจาก Phase 0-1 ก่อน ติดตรงไหนเดี๋ยวไล่ debug ทีละจุดได้