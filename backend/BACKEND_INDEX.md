# สารบัญ Backend + คีย์เวิร์ดรายฟังก์ชัน

ไว้ค้นหา: กด `Ctrl+F` ในไฟล์นี้ (หรือ `Ctrl+Shift+F` ทั้งโปรเจกต์) ด้วยคีย์เวิร์ดในคอลัมน์ "คีย์เวิร์ด" แล้วกระโดดไปไฟล์/บรรทัดที่ระบุ.

- เลขบรรทัด = ณ 9 ต.ค. 2569 — โค้ดขยับแล้วเลขจะคลาดได้ ให้ค้นชื่อฟังก์ชันแทน
- รายละเอียดเชิงลึกของแต่ละเรื่องอยู่ใน [`BACKEND_GUIDE.md`](BACKEND_GUIDE.md) (ไฟล์นี้เป็นแค่ดัชนี)
- สิทธิ์: 👤 นักศึกษา · 🧑‍💼 officer · 🔍 reviewer · 👔 executive · 🔓 ไม่ต้อง login
- ⚠️ `BACKEND_GUIDE.md` ส่วน 7.1 / 9 ยังเขียนถึง `first-setup` แต่โค้ดจริงไม่มี endpoint นี้แล้ว (login ด้วยรหัสนักศึกษา + เลขบัตร ปชช. เป็นรหัสเริ่มต้น + `must_change_password`) — เชื่อโค้ด/ไฟล์นี้ก่อน

## สารบัญ

1. [ไฟล์แกนกลาง](#1-ไฟล์แกนกลาง) — server, app, config
2. [Middleware](#2-middleware)
3. [Utils (ตัวช่วยกลาง)](#3-utils-ตัวช่วยกลาง)
4. [โมดูล auth](#4-โมดูล-auth)
5. [โมดูล subjects (รายวิชา)](#5-โมดูล-subjects-รายวิชา)
6. [โมดูล rooms (ห้องเรียน)](#6-โมดูล-rooms-ห้องเรียน)
7. [โมดูล users (เจ้าหน้าที่/ผู้บริหาร)](#7-โมดูล-users-เจ้าหน้าที่ผู้บริหาร)
8. [โมดูล students (นักศึกษา)](#8-โมดูล-students-นักศึกษา)
9. [โมดูล rounds (รอบสอบ)](#9-โมดูล-rounds-รอบสอบ)
10. [โมดูล examResults (ผลสอบ)](#10-โมดูล-examresults-ผลสอบ)
11. [โมดูล certificates (ไฟล์หลักฐาน)](#11-โมดูล-certificates-ไฟล์หลักฐาน)
12. [โมดูล notifications (แจ้งเตือน)](#12-โมดูล-notifications-แจ้งเตือน)
13. [โมดูล news (ข่าว/ประกาศ)](#13-โมดูล-news-ข่าวประกาศ)
14. [โมดูล dashboard (สถิติ + รายงาน)](#14-โมดูล-dashboard-สถิติ--รายงาน)
15. [ฐานข้อมูล Prisma + seed + scripts](#15-ฐานข้อมูล-prisma--seed--scripts)
16. [เทส](#16-เทส)
17. [คำสั่ง npm](#17-คำสั่ง-npm)

---

## 1. ไฟล์แกนกลาง

| ไฟล์ | สิ่งที่อยู่ข้างใน | คีย์เวิร์ด | ทำอะไร |
|---|---|---|---|
| `src/server.js` (7) | เปิด port | `listen`, `PORT`, `เริ่มเซิร์ฟเวอร์` | จุดเริ่มรัน — import `app` แล้ว listen |
| `src/app.js` (93) | ประกอบ Express app | `app.use`, `helmet`, `cors`, `CORS_ORIGIN`, `cookieParser`, `404`, `ไม่พบ endpoint`, `/api/...`, `ลำดับ middleware` | ต่อ middleware + mount router ทั้ง 10 ตัวที่ `/api/*` + 404 + errorHandler (ท้ายสุดเสมอ) |
| `src/config/env.js` [`validateEnv`](src/config/env.js#L16) | ตรวจ `.env` | `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `COOKIE_SECURE`, `Missing required environment variables` | ขาดตัวแปรไหน throw ทันทีตอนเริ่ม · `COOKIE_SECURE` ต้องเป็น `"true"`/`"false"` |
| `src/config/db.js` (16) | `prisma` singleton | `PrismaClient`, `connection pool`, `too many clients` | PrismaClient ตัวเดียวทั้ง backend — ห้าม `new PrismaClient()` ที่อื่นใน `src/` |

## 2. Middleware

| ฟังก์ชัน / ไฟล์ | คีย์เวิร์ด | ทำอะไร |
|---|---|---|
| [`authenticate`](src/middlewares/auth.js#L16) — `middlewares/auth.js` (16) | `JWT`, `jwt.verify`, `cookie token`, `req.user`, `401`, `บัญชีนี้ใช้งานไม่ได้แล้ว`, `mustChangePassword`, `PASSWORD_SETUP_PATHS`, `ถอนสิทธิ์ทันที` | แกะ JWT จาก httpOnly cookie → เช็ค user ใน DB ยังอยู่/ไม่ถูกปิด → ถ้า `must_change_password` ใช้ได้แค่ `/me` กับ `/password` → ตั้ง `req.user = { userId, role, studentId, mustChangePassword }` จากค่าใน DB |
| [`requireRole(...roles)`](src/middlewares/requireRole.js#L11) — `middlewares/requireRole.js` (11) | `403`, `สิทธิ์`, `role`, `rest parameter` | ต้องวางหลัง `authenticate` · role ไม่อยู่ในรายการ → 403 |
| [`errorHandler`](src/middlewares/errorHandler.js#L4) — `middlewares/errorHandler.js` (4) | `err.statusCode`, `next(err)`, `MulterError`, `{ success:false, message }`, `500`, `stack`, `P2002`→409, `P2025`→404, `PrismaClient` | แปลง error ทุกตัวเป็น JSON รูปแบบเดียว · ไม่ตั้ง statusCode = 500 · Prisma P2002 → 409, P2025 → 404, error Prisma อื่นไม่ปล่อยข้อความดิบออกไป · multer → 400 |
| [`rateLimit({ windowMs, max, keyField })`](src/middlewares/rateLimit.js#L21) — `middlewares/rateLimit.js` (21) | `429`, `login รัวๆ`, `Map`, `ในหน่วยความจำ`, `รีสตาร์ท server` | กันยิงรัว นับตาม path + keyField (หรือ IP) · เกิน → 429 · ตัวนับอยู่ใน memory |
| [`requestLogger`](src/middlewares/requestLogger.js#L9) — `middlewares/requestLogger.js` (9) | `log`, `terminal`, `res.on("finish")`, `user=`, `ms` | log ทุก request: method url status เวลา user/role · **ไม่ log body/password/cookie** |
| [`uploadEvidence`](src/middlewares/upload.js#L45) — `middlewares/upload.js` (45) | `multer`, `หลักฐาน`, `PDF JPG PNG`, `10MB`, `fileFilter`, `UPLOAD_DIR`, `uploads/certificates` | รับไฟล์หลักฐานของใบผลสอบลง disk |
| [`uploadImage`](src/middlewares/upload.js#L78) — `middlewares/upload.js` (78) | `multer`, `รูปประกาศ`, `news image`, `NEWS_IMAGE_DIR`, `uploads/news` | รับรูปประกาศ (1 ประกาศ = 1 รูป) |

## 3. Utils (ตัวช่วยกลาง)

| ฟังก์ชัน | คีย์เวิร์ด | ทำอะไร |
|---|---|---|
| [`getRoundPhase(round, now)`](src/utils/roundPhase.js#L19) — `utils/roundPhase.js` (19) | `phase`, `closed`, `scheduled`, `active`, `expired`, `สถานะจริงของรอบ` | แปลง `status`+วันที่ เป็น 4 สถานะ — **ต้องตรงกับเงื่อนไข `findActive`** |
| [`withPhase`](src/utils/roundPhase.js#L28) | `phase`, `แปะ phase` | เติม field `phase` เข้า object รอบก่อนส่งออก (ไม่เก็บใน DB) |
| [`ROUND_PHASE`](src/utils/roundPhase.js#L12) | `closed/scheduled/active/expired` | ค่าคงที่ของ phase |
| [`subjectsOfRound(round, allSubjects)`](src/utils/roundSubjects.js#L8) — `utils/roundSubjects.js` (8) | `subject_ids`, `วิชาของรอบ`, `ไม่ส่ง = ทุกวิชา` | คืนรายวิชาของรอบ (ไม่ได้กำหนดไว้ = ทุกวิชา) |
| [`calcGraduationYear(studentId)`](src/utils/academicYear.js#L3) — `utils/academicYear.js` (3) | `ปีจบ`, `รหัส 2 หลักแรก + 4`, `2500+`, `ซ้ำชั้น` | คำนวณปี พ.ศ. ที่จบจากรหัส (66 → 2570) |
| [`validateGraduationYear`](src/utils/academicYear.js#L25) | `ปีการศึกษาที่จบ`, `พ.ศ. 4 หลัก`, `น้อยกว่าปีตามรหัส`, `{ year }`, `{ error }` | ตรวจปีที่เจ้าหน้าที่พิมพ์ (import / เพิ่มทีละคน / แก้) — ไม่ throw คืน object |
| [`isBlankYear`](src/utils/academicYear.js#L42) | `ช่องปีว่าง`, `null/undefined/""` | ว่าง = ให้ระบบคำนวณจากรหัส |
| `ACTOR_SELECT` / `toActor(user)` — `utils/actor.js` (6, 15) | `ผู้ดำเนินการ`, `creator`, `poster`, `confirmer`, `is_closed`, `ปิดบัญชีแล้ว`, `password_hash หลุด` | select ผู้ทำรายการ + ตัด hash เหลือ `is_closed` — **ห้าม return ตรงๆ ต้องผ่าน `toActor`** |
| `buildXlsx` / `buildXlsxWorkbook` / `sendXlsx` / `safeSheetName` — `utils/xlsxExport.js` (39, 56, 76, 25) | `Excel`, `xlsx`, `exceljs`, `ชีต`, `หลายชีต`, `ชื่อชีต 31 ตัว`, `Content-Disposition` | สร้าง/ส่งไฟล์ Excel · [`toCell`](src/utils/xlsxExport.js#L33) แปลงค่าเป็นเซลล์ตามชนิด |
| `utils/pdfReport.js` — [`registerThaiFonts`](src/utils/pdfReport.js#L24) | `Sarabun`, `ฟอนต์ไทย`, `□□□`, `pdfkit` | ลงฟอนต์ไทย ไม่งั้นภาษาไทยเป็นสี่เหลี่ยม |
| [`drawTable`](src/utils/pdfReport.js#L78), [`drawRow`](src/utils/pdfReport.js#L43), [`rule`](src/utils/pdfReport.js#L58), [`section`](src/utils/pdfReport.js#L139), [`drawSignatureLines`](src/utils/pdfReport.js#L146), [`drawPageNumbers`](src/utils/pdfReport.js#L164), [`fitText`](src/utils/pdfReport.js#L34) | `ตาราง PDF`, `widths = 500`, `groups`, `merge cell`, `ลายเซ็น`, `เลขหน้า`, `A4`, `CONTENT_WIDTH`, `LEFT/TOP/BOTTOM` | ชุดวาด PDF ใช้ร่วมทุกรายงาน — ผลรวม `widths` ต้อง = `CONTENT_WIDTH` |

## 4. โมดูล auth

ไฟล์: `modules/auth/auth.routes.js` · `controllers/authController.js` (ไฟล์นี้อยู่นอก `modules/`)

| Endpoint | ฟังก์ชัน | บรรทัด | สิทธิ์ | คีย์เวิร์ด | ทำอะไร |
|---|---|---|---|---|---|
| `POST /api/auth/login` | [`login`](src/controllers/authController.js#L28) | 28 | 🔓 | `bcrypt.compare`, `jwt.sign`, `res.cookie`, `TOKEN_COOKIE_OPTIONS`, `expiresIn 1d`, `401 รหัสผิด`, `403 ยังไม่ตั้งรหัส`, `psu_passport_id`, `rate limit 2 ชั้น` | เข้าสู่ระบบ → ออก JWT ใส่ httpOnly cookie ชื่อ `token` (ไม่ส่งใน body) · limit 10 ครั้ง/15 นาที/บัญชี + 60/IP |
| `POST /api/auth/logout` | [`logout`](src/controllers/authController.js#L108) | 108 | 🔓 | `clearCookie`, `ออกจากระบบ`, `JWT stateless` | ลบ cookie (ไม่ผ่าน authenticate เพราะ token พังก็ต้อง logout ได้) |
| `PATCH /api/auth/password` | [`changePassword`](src/controllers/authController.js#L115) | 115 | 🔑 | `เปลี่ยนรหัสผ่าน`, `รหัสเดิม`, `MIN_PASSWORD_LENGTH 8`, `must_change_password`, `SALT_ROUNDS`, `ต้อง login ใหม่` | ต้องกรอกรหัสเดิมถูก + รหัสใหม่ ≥ 8 ตัวและไม่ซ้ำเดิม · rate limit 10/15 นาที |
| `GET /api/auth/me` | [`getme`](src/controllers/authController.js#L182) | 182 | 🔑 | `ข้อมูลตัวเอง`, `เปิดเว็บ/รีเฟรช`, `role`, `studentId` | frontend ถามว่า cookie ยังใช้ได้ไหม + role อะไร |

## 5. โมดูล subjects (รายวิชา)

ไฟล์: `modules/subjects/` — CRUD ตรงๆ ง่ายที่สุด **อ่านโมดูลนี้ก่อน**

| Endpoint | ฟังก์ชัน | บรรทัด | สิทธิ์ | คีย์เวิร์ด | ทำอะไร |
|---|---|---|---|---|---|
| `GET /api/subjects` | [`getAll`](src/modules/subjects/subjects.controller.js#L46) | 46 | 🔑 | `รายวิชา`, `subject_code`, `findAll` | รายวิชาทั้งหมด เรียงตามรหัส |
| `POST /api/subjects` | [`createAll`](src/modules/subjects/subjects.controller.js#L56) | 56 | 🧑‍💼 | `เพิ่มวิชา`, `ensureCodeFree`, `รหัสวิชาซ้ำ`, `cleanSubjectInput` | เพิ่มวิชา (ชื่อ typo ทำงานปกติ) |
| `PUT /api/subjects/:id` | [`updatasubject`](src/modules/subjects/subjects.controller.js#L68) | 68 | 🧑‍💼 | `แก้วิชา`, `updata` (typo), `exceptId` | แก้วิชา — เช็ครหัสซ้ำโดยข้ามตัวเอง |
| `DELETE /api/subjects/:id` | [`deleteSubject`](src/modules/subjects/subjects.controller.js#L82) | 82 | 🧑‍💼 | `ลบวิชา`, `findRoundsUsing`, `countSubjectResults`, `วิชาถูกใช้อยู่` | ลบไม่ได้ถ้ามีรอบใช้ / มีผลสอบผูก |
| (helper) | [`cleanSubjectInput`](src/modules/subjects/subjects.controller.js#L17), [`ensureCodeFree`](src/modules/subjects/subjects.controller.js#L38), [`httpError`](src/modules/subjects/subjects.controller.js#L4) | | | `validate`, `trim` | ตรวจ/ล้าง input · เช็คซ้ำ |
| repository | `findAll`, [`findByIds`](src/modules/subjects/subjects.repository.js#L7), [`findByCode`](src/modules/subjects/subjects.repository.js#L10), [`create`](src/modules/subjects/subjects.repository.js#L13), [`remove`](src/modules/subjects/subjects.repository.js#L15), [`findRoundsUsing`](src/modules/subjects/subjects.repository.js#L18), [`countSubjectResults`](src/modules/subjects/subjects.repository.js#L24), [`updata`](src/modules/subjects/subjects.repository.js#L27) | | | | |

## 6. โมดูล rooms (ห้องเรียน)

| Endpoint | ฟังก์ชัน | คีย์เวิร์ด | ทำอะไร |
|---|---|---|---|
| `GET /api/rooms` | [`getAll`](src/modules/rooms/rooms.controller.js#L4) → [`findAll`](src/modules/rooms/rooms.repository.js#L4) | `ห้องเรียน`, `room_id`, `ห้องปกติ/ห้องอังกฤษ` | รายชื่อห้องทั้งหมด (ต้อง login) |

## 7. โมดูล users (เจ้าหน้าที่/ผู้บริหาร)

ไฟล์: `modules/users/` · บัญชีนักศึกษาไม่ได้จัดการที่นี่ (ไปโมดูล students)

| Endpoint | ฟังก์ชัน | บรรทัด | สิทธิ์ | คีย์เวิร์ด | ทำอะไร |
|---|---|---|---|---|---|
| `GET /api/users` | [`getAll`](src/modules/users/users.controller.js#L8) | 8 | 🧑‍💼 | `รายชื่อผู้ใช้`, `PUBLIC_USER_FIELDS`, `creator`, `closer`, `closed_at` | รายชื่อผู้ใช้ (ไม่มี hash) + ใครสร้าง/ใครปิดบัญชี |
| `POST /api/users` | [`create`](src/modules/users/users.controller.js#L21) | 21 | 🧑‍💼 | `เพิ่มผู้ใช้`, `CREATABLE_ROLES`, `officer/executive/reviewer`, `psu_passport_id ซ้ำ`, `bcrypt`, `must_change_password` | สร้างบัญชี 3 role (นักศึกษาต้อง import เท่านั้น) |
| `POST /api/users/:id/role` | [`updateRole`](src/modules/users/users.controller.js#L110) | 110 | 🧑‍💼 | `เปลี่ยนบทบาท`, `เปลี่ยนตัวเองไม่ได้`, `บัญชีที่เป็นนักศึกษา` | เปลี่ยน role (ห้ามเปลี่ยนตัวเอง / ห้ามคนที่เป็นนักศึกษา) |
| `POST /api/users/:id/revoke` | [`revokeAccess`](src/modules/users/users.controller.js#L168) | 168 | 🧑‍💼 | `ถอนสิทธิ์`, `ปิดบัญชี`, `closed_at`, `closed_by`, `ล็อกไม่ลบ` | ล้าง `password_hash` เป็น null → login ไม่ได้ ประวัติอยู่ครบ · ห้ามถอนตัวเอง |
| `POST /api/users/:id/reset-password` | [`resetPassword`](src/modules/users/users.controller.js#L200) | 200 | 🧑‍💼 | `รีเซ็ตรหัส`, `เปิดคืน`, `ลืมรหัส`, `must_change_password` | ตั้งรหัสชั่วคราว บังคับเปลี่ยนตอน login · ถ้าบัญชีเคยถูกปิด = เปิดคืน |
| `DELETE /api/users/:id` | [`deleteUser`](src/modules/users/users.controller.js#L250) | 250 | 🧑‍💼 | `ลบบัญชี`, `countLinkedHistory`, `409`, `P2003`, `ON DELETE RESTRICT`, `23001` | ลบจริงเฉพาะบัญชีที่ไม่เคยมีประวัติ (รอบ/ข่าว/review_logs) · เช็คเองก่อน ไม่พึ่ง Prisma |
| repository | [`findAll`](src/modules/users/users.repository.js#L33), [`findRoleByName`](src/modules/users/users.repository.js#L39), [`findByPsuId`](src/modules/users/users.repository.js#L44), [`create`](src/modules/users/users.repository.js#L49), [`findById`](src/modules/users/users.repository.js#L55), [`updateRole`](src/modules/users/users.repository.js#L64), [`revokeAccess`](src/modules/users/users.repository.js#L76), [`setPassword`](src/modules/users/users.repository.js#L87), [`countLinkedHistory`](src/modules/users/users.repository.js#L101), [`remove`](src/modules/users/users.repository.js#L113), [`toPublicUser`](src/modules/users/users.repository.js#L26) | | | `select ไม่ใช่ include` | |

## 8. โมดูล students (นักศึกษา)

ไฟล์: `modules/students/` — controller ใหญ่สุด (920 บรรทัด) แยก export ไว้อีกไฟล์
⚠️ ใน `students.routes.js` path เฉพาะ (`/export`, `/import`, `/bulk-*`, `/pending-accounts`) ต้องอยู่**ก่อน** `/:id` เสมอ

### 8.1 `student.controller.js`

| Endpoint | ฟังก์ชัน | บรรทัด | สิทธิ์ | คีย์เวิร์ด | ทำอะไร |
|---|---|---|---|---|---|
| `GET /api/students` | [`getAll`](src/modules/students/student.controller.js#L62) | 62 | 🧑‍💼🔍 | `รายชื่อนักศึกษา`, `แท็บยังไม่กรอก`, `findAll` | นักศึกษาทั้งหมด + user/คณะ/ห้อง |
| `GET /api/students/:id` | [`getById`](src/modules/students/student.controller.js#L72) | 72 | 🧑‍💼👤🔍 | `ดูรายคน`, `ownership`, `403 ดูคนอื่น`, `academic_year_derived`, `exam_result_count` | นักศึกษาดูได้แค่ตัวเอง (เช็คใน controller ไม่ใช่ requireRole) |
| `POST /api/students` | [`create`](src/modules/students/student.controller.js#L120) | 120 | 🧑‍💼 | `เพิ่มทีละคน`, `ปุ่มเพิ่มนักศึกษา`, `student_id 10 หลัก`, `national_id 13 หลัก`, `createFromImport`, `import_academic_year` | สร้างแค่ `users` (ยังไม่มีแถว `students`) · รหัสผ่าน = hash(เลขบัตร) |
| `POST /api/students/complete-profile` | [`completeProfile`](src/modules/students/student.controller.js#L190) | 190 | 👤 | `กรอกโปรไฟล์ครั้งแรก`, `สร้างแถว students`, `ปีจบตั้งฝั่ง server`, `cleanProfileInput`, `EMAIL_PATTERN`, `PHONE_PATTERN` | นักศึกษากรอกชื่อ/email/เบอร์/ห้อง → สร้าง `students` · ปีจบมาจาก import ไม่รับจาก client |
| `PATCH /api/students/:id` | [`update`](src/modules/students/student.controller.js#L246) | 246 | 🧑‍💼 | `แก้ข้อมูลนักศึกษา`, `academic_year`, `เปลี่ยนปีได้เฉพาะยังไม่มีผลสอบ`, `partial update` | แก้ได้ทุก field · เปลี่ยนรุ่นได้เฉพาะคนที่ยังไม่มีผลสอบ (กันสถิติรุ่นเดิมทะลุ 100%) |
| `PATCH /api/students/bulk-eligible` | [`bulkSetEligible`](src/modules/students/student.controller.js#L325) | 325 | 🧑‍💼 | `exam_eligible`, `เปิดสิทธิ์`, `ปิดสิทธิ์`, `setBy`, `eligible_set_by`, `type: "eligible"`, `findExistingStudentIds` | เปิด/ปิดสิทธิ์กรอกผลหลายคน/ทั้งรุ่น · แจ้งเตือนเฉพาะตอน**เปิด** · ข้ามรหัสปลอม |
| `POST /api/students/import` | [`bulkImport`](src/modules/students/student.controller.js#L564) | 564 | 🧑‍💼 | `import`, `CSV`, `Excel .xlsx`, `นำเข้ารายชื่อ`, `dry_run`, `year_overrides`, `skipped`, `imported_count`, `mapping`, `เลขบัตรหาย 1.23E+12` | นำเข้า CSV/xlsx (ดูจากเนื้อไฟล์) · วนทีละแถว ไม่ล้มทั้งไฟล์ · `?dry_run=true` ตรวจอย่างเดียว |
| `DELETE /api/students/:id` | [`remove`](src/modules/students/student.controller.js#L870) | 870 | 🧑‍💼 | `ลบนักศึกษา`, `delete_results`, `has_exam_results`, `409`, `deleted_result_count` | ลบพร้อมทุกอย่างที่ผูก · มีผลสอบต้องส่ง `?delete_results=true` |
| `POST /api/students/bulk-delete` | [`bulkRemove`](src/modules/students/student.controller.js#L785) | 785 | 🧑‍💼 | `ลบหลายคน`, `MAX_BULK_DELETE 1000`, `ไม่ลบครึ่งๆ`, `removeStudentsCascade` | ลบหลายคนใน transaction เดียว |
| (helper ภายใน) | [`deleteStudents`](src/modules/students/student.controller.js#L759) | 759 | | `ตัวลบกลาง`, `ลบไฟล์ disk หลัง commit` | ใช้ร่วม `remove` + `bulkRemove` |
| `GET /api/students/pending-accounts` | [`listPendingAccounts`](src/modules/students/student.controller.js#L817) | 817 | 🧑‍💼 | `บัญชีที่ import แล้วยังไม่กรอกโปรไฟล์`, `year_overridden`, `imported_at` | รายชื่อบัญชีที่มีแต่ `users` ไม่มี `students` |
| `POST /api/students/pending-accounts/delete` | [`removePendingAccounts`](src/modules/students/student.controller.js#L839) | 839 | 🧑‍💼 | `ลบบัญชี import ผิด`, `skipped_count`, `ลบเฉพาะที่ยังไม่มีโปรไฟล์` | ลบกลุ่มนั้น (ไม่แตะคนที่กรอกโปรไฟล์แล้ว) |
| `POST /api/students/:id/reset-password` | [`resetPassword`](src/modules/students/student.controller.js#L892) | 892 | 🧑‍💼 | `รีเซ็ตรหัสนักศึกษา`, `เลขบัตร ปชช`, `setPassword` | ตั้งรหัสกลับเป็น hash(เลขบัตร) |
| helper import | [`normalizeHeader`](src/modules/students/student.controller.js#L391), [`guessColumns`](src/modules/students/student.controller.js#L395), [`resolveColumns`](src/modules/students/student.controller.js#L412), [`parseMappingParam`](src/modules/students/student.controller.js#L434), [`plainNumberText`](src/modules/students/student.controller.js#L453), [`cleanIdText`](src/modules/students/student.controller.js#L468), [`isXlsxFile`](src/modules/students/student.controller.js#L483), [`rowsFromCsv`](src/modules/students/student.controller.js#L486), [`rowsFromXlsx`](src/modules/students/student.controller.js#L532), [`cleanProfileInput`](src/modules/students/student.controller.js#L43) | | | `เดาหัวคอลัมน์`, `COLUMN_KEYWORDS`, `เลขไทย ๐-๙`, `scientific notation`, `PK magic bytes`, `win874`, `iconv`, `csv-parse` | เดาคอลัมน์จากหัวไทย/อังกฤษ · อ่านรหัสที่เป็นเลขวิทยาศาสตร์/เลขไทย · แยก csv/xlsx จากหัวไฟล์ |

### 8.2 `student.export.controller.js` + `students.pdf.js`

| Endpoint | ฟังก์ชัน | บรรทัด | สิทธิ์ | คีย์เวิร์ด | ทำอะไร |
|---|---|---|---|---|---|
| `GET /api/students/subject-result-list` | [`getSubjectResultList`](src/modules/students/student.export.controller.js#L66) | 66 | 🧑‍💼 | `ผ่าน/ไม่ผ่านรายวิชา`, `subject_code`, `passed`, `round_id`, `year`, `รวมทั้งปี` | รายชื่อคนผ่าน/ไม่ผ่านวิชาหนึ่ง (JSON ไว้พรีวิว) |
| `GET /api/students/export-subject` | [`exportSubjectList`](src/modules/students/student.export.controller.js#L92) | 92 | 🧑‍💼 | `ส่งออกรายวิชา`, `format=pdf\|xlsx`, `buildSubjectListPdf` | รายการเดียวกันเป็น PDF/Excel |
| `POST /api/students/export` | [`exportStudents`](src/modules/students/student.export.controller.js#L160) | 160 | 🧑‍💼 | `ส่งออกนักศึกษา`, `Excel`, `by_round`, `EXPORT_MAX_IDS 5000`, `student_ids`, `ไม่มีเลขบัตร`, `ใบล่าสุด` | Excel ตามรายชื่อที่กรอง/ทั้งรุ่น · `by_round` = 1 ชีตต่อรอบ |
| (helper) | [`resolveSubjectQuery`](src/modules/students/student.export.controller.js#L19), [`formatThaiDateTime`](src/modules/students/student.export.controller.js#L141), [`paperStatusLabel`](src/modules/students/student.export.controller.js#L147) | | | `ตรวจ query`, `วันที่ไทย`, `ป้ายสถานะใบ` | |
| `buildSubjectListPdf` — `students.pdf.js` | | 13 | | `PDF รายชื่อรายวิชา` | วาด PDF รายชื่อ |

### 8.3 `student.repository.js`

| ฟังก์ชัน | บรรทัด | คีย์เวิร์ด | ทำอะไร |
|---|---|---|---|
| [`findAll`](src/modules/students/student.repository.js#L15) | 15 | `รายชื่อ`, `รุ่นใหม่ก่อน` | นักศึกษา + user/คณะ/ห้อง |
| [`findMatchingSubjectResult`](src/modules/students/student.repository.js#L30) | 30 | `ผ่าน/ไม่ผ่านรายวิชา`, `roundId`, `year`, `ยุบเหลือคนละแถว`, `carried_forward` | หาคนผ่าน/ไม่ผ่านวิชาหนึ่ง (รอบเดียว/ทั้งปี) |
| [`findById`](src/modules/students/student.repository.js#L72) | 72 | `นักศึกษา 1 คน` | + user/คณะ/ห้อง |
| [`findEligibilityYear`](src/modules/students/student.repository.js#L88) | 88 | `exam_eligible`, `academic_year`, `select เบา` | เช็คสิทธิ์+ปี แบบเบาที่สุด |
| [`bulkSetEligible`](src/modules/students/student.repository.js#L95) | 95 | `eligible_set_by`, `eligible_set_at` | เปิด/ปิดสิทธิ์ + เก็บคนกด+เวลา |
| [`findExistingStudentIds`](src/modules/students/student.repository.js#L103) | 103 | `รหัสปลอมปน`, `createMany ล้มทั้งชุด` | กรองให้เหลือรหัสที่มีจริง |
| `findRoleByName` / `findFaculty` / `findAllRooms` / `findRoomById` / `findByPsuId` | 116 / 120 / 123 / 126 / 130 | `lookup` | ตัวช่วยค้นหา |
| [`setPassword`](src/modules/students/student.repository.js#L134) | 134 | `รีเซ็ตรหัส` | ตั้ง hash ใหม่ตรงๆ |
| [`createFromImport`](src/modules/students/student.repository.js#L143) | 143 | `สร้าง user จาก import`, `import_academic_year` | สร้าง `users` อย่างเดียว |
| [`completeProfile`](src/modules/students/student.repository.js#L156) | 156 | `สร้าง students`, `update user` | update user + สร้างแถว students |
| [`updateProfile`](src/modules/students/student.repository.js#L192) | 192 | `nested write`, `partial update` | แก้ทั้งฝั่ง user + student ในคำสั่งเดียว |
| [`countExamResults`](src/modules/students/student.repository.js#L210) | 210 | `กันลบคนมีประวัติ`, `กันเปลี่ยนรุ่น` | นับใบผลสอบของคนนี้ |
| [`summarizeResults`](src/modules/students/student.repository.js#L214) | 214 | `เตือนก่อนลบ` | สรุปจำนวนผลสอบของหลายคน |
| [`removeStudentsCascade`](src/modules/students/student.repository.js#L231) | 231 | `cascade`, `transaction`, `filePaths`, `ลบจากลูกขึ้นแม่` | ลบนักศึกษา+ข้อมูลผูกทั้งหมด คืน path ไฟล์ที่ต้องลบจาก disk |
| `findPendingAccounts` / `removePendingAccounts` | 264 / 274 | `ยังไม่กรอกโปรไฟล์`, `psuIds` | บัญชี import ค้าง |
| [`findForExport`](src/modules/students/student.repository.js#L283) | 283 | `export Excel`, `ไม่ดึง national_id` | ข้อมูลส่งออก (ไม่มีเลขบัตร) |

## 9. โมดูล rounds (รอบสอบ)

ไฟล์: `modules/rounds/` · กฎเด่น: ปีละ "ครั้งที่ n" ได้รอบเดียว · ทั้งระบบเปิดได้ทีละ 1 รอบ · รอบที่ open แล้วห้ามแก้รายวิชา

| Endpoint | ฟังก์ชัน | บรรทัด | สิทธิ์ | คีย์เวิร์ด | ทำอะไร |
|---|---|---|---|---|---|
| `GET /api/rounds/active` | [`getActive`](src/modules/rounds/rounds.controller.js#L41) | 41 | 👤 | `รอบที่กรอกได้`, `findSubmittableRound`, `can_fix_rejected`, `already_passed`, `all_passed`, `phase`, `exam_eligible`, `ปิดสิทธิ์` | รอบที่นักศึกษาส่งได้ตอนนี้ + วิชาที่ต้องกรอก (วิชาที่เคยผ่านติด `already_passed`) · ต้องอยู่ก่อน `/:id` |
| `GET /api/rounds` | [`getAll`](src/modules/rounds/rounds.controller.js#L19) | 19 | 🔑 | `รอบทั้งหมด`, `creator`, `ตัด creator ตาม role` | รอบทั้งหมด ใหม่→เก่า (นักศึกษาไม่ได้ creator) |
| `POST /api/rounds` | [`create`](src/modules/rounds/rounds.controller.js#L354) | 354 | 🧑‍💼 | `สร้างรอบ`, `academic_year`, `attempt_number`, `subject_ids`, `open_date`, `close_date`, `created_by` | สร้างรอบ (ผ่านการตรวจชุดด้านล่าง) |
| `PUT /api/rounds/:id` | [`update`](src/modules/rounds/rounds.controller.js#L411) | 411 | 🧑‍💼 | `แก้รอบ`, `เปลี่ยนปี/ครั้งที่ไม่ได้ถ้ามีผลสอบ`, `409`, `เปิดรอบ`, `ปิดรอบ` | แก้รอบ — ดึงรอบเดิมก่อนเสมอ (ไม่เจอ 404) · มีผลสอบแล้วเปลี่ยนปี/ครั้งที่ไม่ได้ |
| `DELETE /api/rounds/:id` | [`remove`](src/modules/rounds/rounds.controller.js#L539) | 539 | 🧑‍💼 | `ลบรอบ`, `delete_linked`, `has_linked_data`, `removeCascade`, `[AUDIT]`, `result_count`, `news_count` | ลบรอบ (ต้องปิดแล้ว) · มีผลสอบ/ประกาศผูก ต้องยืนยัน `?delete_linked=true` |
| helper ตรวจ input | [`parseThaiDateTime`](src/modules/rounds/rounds.controller.js#L131), [`parseOpenDate`](src/modules/rounds/rounds.controller.js#L177), [`parseCloseDate`](src/modules/rounds/rounds.controller.js#L182), [`ensureValidDateRange`](src/modules/rounds/rounds.controller.js#L192), [`ensureNotAlreadyExpired`](src/modules/rounds/rounds.controller.js#L203) | | | `วันที่ไม่มีจริง 2026-02-31`, `Invalid Date`, `วันเปิด < วันปิด`, `เวลาเริ่ม/สิ้นสุดวัน`, `ICT` | แปลง/ตรวจวันที่ไทย |
| helper ตรวจ input | [`validateSubjectIds`](src/modules/rounds/rounds.controller.js#L214), [`sameIdSet`](src/modules/rounds/rounds.controller.js#L295), [`isBlankValue`](src/modules/rounds/rounds.controller.js#L248), [`toWholeNumber`](src/modules/rounds/rounds.controller.js#L260), [`parseAcademicYear`](src/modules/rounds/rounds.controller.js#L274), [`parseAttemptNumber`](src/modules/rounds/rounds.controller.js#L286), [`ensureValidStatus`](src/modules/rounds/rounds.controller.js#L313) | | | `subject_ids ซ้ำ`, `ต้องมีอยู่จริง` (Int[] ไม่มี FK), `status open/closed เท่านั้น` | |
| helper กฎธุรกิจ | [`ensureNotDuplicate`](src/modules/rounds/rounds.controller.js#L322), [`ensureNoOtherOpenRound`](src/modules/rounds/rounds.controller.js#L338), [`asDuplicateRoundError`](src/modules/rounds/rounds.controller.js#L350) | | | `รอบซ้ำ`, `@@unique([academic_year, attempt_number])`, `P2002`, `เปิดได้ทีละรอบเดียว`, `รอบอื่นเปิดค้าง` | |
| repository | [`findAll`](src/modules/rounds/rounds.repository.js#L6), [`findById`](src/modules/rounds/rounds.repository.js#L15), [`findActive`](src/modules/rounds/rounds.repository.js#L23), [`findOpenForYear`](src/modules/rounds/rounds.repository.js#L43), [`findLatestStarted`](src/modules/rounds/rounds.repository.js#L58), [`findNewerRoundWithResults`](src/modules/rounds/rounds.repository.js#L71), [`findByYearAndAttempt`](src/modules/rounds/rounds.repository.js#L83), [`findOpen`](src/modules/rounds/rounds.repository.js#L95), [`create`](src/modules/rounds/rounds.repository.js#L99), [`countExamResults`](src/modules/rounds/rounds.repository.js#L102), [`countNews`](src/modules/rounds/rounds.repository.js#L106), [`remove`](src/modules/rounds/rounds.repository.js#L112), [`removeCascade`](src/modules/rounds/rounds.repository.js#L122), [`update`](src/modules/rounds/rounds.repository.js#L156) | | | `findActive` = open + อยู่ในช่วงวัน + รุ่นตรง · `findOpenForYear` ไม่กรองวัน (ห้ามใช้ตอนรับผล) · `findLatestStarted` ข้ามรอบร่าง | |

## 10. โมดูล examResults (ผลสอบ) ⭐ หัวใจ

ไฟล์: `modules/examResults/` · สถานะ 2 ชุด: `student_status` (draft/submitted) แยกจาก `staff_status` (pending/approved/rejected)

### 10.1 Controller

| Endpoint | ฟังก์ชัน | บรรทัด | สิทธิ์ | คีย์เวิร์ด | ทำอะไร |
|---|---|---|---|---|---|
| `POST /api/exam-results` | [`create`](src/modules/examResults/examResults.controller.js#L17) | 17 | 👤 | `ส่งผลสอบ`, `กรอกผลสอบ`, `8 ด่าน`, `exam_eligible 403`, `findSubmittableRound`, `isRedo`, `fixingRejected`, `carry-forward`, `carried_forward`, `mustAnswer`, `is_passed boolean`, `ผ่านครบทุกวิชาแล้ว 400`, `createWithSubjects`, `resubmitWithSubjects` | ส่ง/แก้ผลสอบ — ถ้า approved แล้ว 409 · วิชาที่เคยผ่านบันทึก `true` ให้เอง ไม่เชื่อ client |
| `GET /api/exam-results/me` | [`getMine`](src/modules/examResults/examResults.controller.js#L170) | 170 | 👤 | `ประวัติผลสอบตัวเอง`, `findByStudent` | ใบผลสอบทุกรอบของตัวเอง |
| `GET /api/exam-results` | [`getAll`](src/modules/examResults/examResults.controller.js#L182) | 182 | 🧑‍💼🔍 | `คิวตรวจ`, `round_id`, `staff_status`, `student_id`, `confirmer`, `review_logs`, `is_closed` | ดูทั้งหมดกรองได้ + ผู้ตรวจล่าสุด + ประวัติตรวจ · ไม่ส่ง `round_id` = ปนทุกรอบ |
| `PATCH /api/exam-results/:id/approve` | [`approve`](src/modules/examResults/examResults.controller.js#L477) | 477 | 🧑‍💼🔍 | `ยืนยันผล`, `reviewExamResult`, `remark ไม่บังคับ`, `ไม่มีไฟล์หลักฐาน 409`, `expected_submitted_at`, `expected_certificate_ids`, `เวอร์ชันของใบ` | ยืนยัน (ได้เฉพาะใบ pending) · ใบไม่มีไฟล์ยืนยันไม่ได้ · กัน "นักศึกษาแก้ระหว่างตรวจ" |
| `PATCH /api/exam-results/:id/reject` | [`reject`](src/modules/examResults/examResults.controller.js#L484) | 484 | 🧑‍💼🔍 | `ตีกลับ`, `remark บังคับ ≤500`, `type: "rejected"` | ตีกลับพร้อมเหตุผล |
| `PATCH /api/exam-results/:id/revoke-approval` | [`revokeApproval`](src/modules/examResults/examResults.controller.js#L468) | 468 | 🧑‍💼 | `ถอนการยืนยัน`, `approved → pending`, `revoked`, `reopenPaper` | ยืนยันผิด → กลับเป็นรอตรวจ (เฉพาะ officer, ต้องมี remark) |
| `PATCH /api/exam-results/:id/reopen` | [`reopen`](src/modules/examResults/examResults.controller.js#L459) | 459 | 🧑‍💼 | `แก้ไขผลการตรวจ`, `approved/rejected → pending`, `ล้าง remark/confirmed_by`, `กดพร้อมกันสำเร็จครั้งเดียว` | เปิดใบที่ตัดสินแล้วให้ตรวจใหม่ |
| (helper) | [`reviewExamResult`](src/modules/examResults/examResults.controller.js#L284) | | | `approve+reject ใช้ร่วม`, `confirmed_by`, `confirmed_at`, `ตรวจซ้อน 409`, `reviewWithLock` | ตัวทำงานจริงของ approve/reject |
| (helper) | [`reopenPaper`](src/modules/examResults/examResults.controller.js#L411), [`readExpectedVersion`](src/modules/examResults/examResults.controller.js#L209), [`isSameVersion`](src/modules/examResults/examResults.controller.js#L252), [`toSortedUniqueIds`](src/modules/examResults/examResults.controller.js#L245), [`httpError`](src/modules/examResults/examResults.controller.js#L10) | | | `optimistic check`, `เทียบเวอร์ชัน` | |

### 10.2 `examResults.service.js` + repository

| ฟังก์ชัน | บรรทัด | คีย์เวิร์ด | ทำอะไร |
|---|---|---|---|
| `findSubmittableRound(student)` — service | 18 | `รอบที่ส่งได้`, `fixingRejected`, `ตีกลับหลังปิดรอบ`, `findActive → findLatestStarted`, `null` | ตัดสินว่านักศึกษาส่งรอบไหนได้ — ใช้ร่วม `create`, `getActive`, certificates |
| `STUDENT_STATUS` / `STAFF_STATUS` — repository | 5 / 7 | `draft submitted`, `pending approved rejected` | ค่าคงที่สถานะ |
| [`findByStudentAndRound`](src/modules/examResults/examResults.repository.js#L39) | 39 | `@@unique(student_id, round_id)`, `กันกรอกซ้ำ` | ใบของคนนี้ในรอบนั้น |
| `findPassedSubjectIds(student_id, excludeRoundId)` | 64 | `วิชาที่เคยผ่าน`, `carry-forward`, `excludeRoundId ต้องส่งเสมอ`, `บั๊ก B1`, `ไม่นับ carried_forward`, `buildExcludeRound` | วิชาที่ผ่านจริงแล้ว (ล็อกวิชาในรอบถัดไป) |
| [`findAll`](src/modules/examResults/examResults.repository.js#L101) | 101 | `ฝั่งเจ้าหน้าที่`, `กรองรอบ/สถานะ/คน` | รายการใบทั้งหมด |
| [`lockExamResultRow`](src/modules/examResults/examResults.repository.js#L148) | 148 | `SELECT FOR UPDATE`, `$queryRaw`, `ล็อกแถว`, `deadlock` | ล็อกใบก่อนแก้ (ต้องอยู่ใน `$transaction`) |
| [`reviewWithLock`](src/modules/examResults/examResults.repository.js#L161) | 161 | `ยืนยัน/ตีกลับ`, `checkBeforeSave`, `updateMany guard` | ตรวจใบแบบล็อก |
| `reopenIfStatus` / `revokeApprovalIfApproved` | 187 / 199 | `updateMany where staff_status`, `count = 0 = กดซ้ำ` | เปิดใบ/ถอนยืนยัน แบบกันกดพร้อมกัน |
| `findByStudent` / `findById` | 203 / 211 | `ใบ + subject_results + certificates`, [`toSubjectRows`](src/modules/examResults/examResults.repository.js#L218) | ดึงใบ |
| [`resubmitWithSubjects`](src/modules/examResults/examResults.repository.js#L238) | 238 | `ส่งทับ`, `submitted_at ใหม่`, `ล้าง remark`, `mustStillBeRejected` | ลบผลรายวิชาเดิมใส่ใหม่ + รีเซ็ตเป็น pending |
| [`createWithSubjects`](src/modules/examResults/examResults.repository.js#L287) | 287 | `nested create`, `transaction` | สร้างใบ + ผลรายวิชาพร้อมกัน |
| `reviewLog.repository.js` `create` | 4 | `review_logs`, `approved/rejected/revoked/reopened`, `ประวัติตรวจ` | บันทึกประวัติการตรวจ (ยังไม่มี endpoint อ่าน) |

## 11. โมดูล certificates (ไฟล์หลักฐาน)

| Endpoint | ฟังก์ชัน | บรรทัด | สิทธิ์ | คีย์เวิร์ด | ทำอะไร |
|---|---|---|---|---|---|
| `POST /api/exam-results/:id/certificates` | [`upload`](src/modules/certificates/certificates.controller.js#L189) | 189 | 👤 | `แนบไฟล์`, `อัปโหลด`, `MAX_FILES_PER_RESULT 5`, `certificate_type exam_result/license`, `saved`, `discard`, `ตรวจซ้ำหลังบันทึก`, `race` | แนบ PDF/JPG/PNG ต่อท้ายไฟล์เดิม สูงสุด 5 ไฟล์/ใบ · route อยู่ใน examResults.routes |
| `DELETE /api/certificates/:id` | [`remove`](src/modules/certificates/certificates.controller.js#L274) | 274 | 👤 | `ลบไฟล์หลักฐาน`, `removeWithLock`, `ลบ DB ก่อน แล้วลบ disk` | ลบไฟล์ของตัวเองทีละไฟล์ |
| `GET /api/certificates/:id/file` | [`serveFile`](src/modules/certificates/certificates.controller.js#L335) | 335 | 🔑 | `เปิดไฟล์`, `ดาวน์โหลด`, `CAN_VIEW_OTHERS_FILES`, `Content-Type`, `CONTENT_TYPE_OF`, `executive ไม่ได้` | เจ้าของใบ/officer/reviewer เท่านั้น |
| (helper) | [`detectFileType`](src/modules/certificates/certificates.controller.js#L57) | | | `magic bytes`, `%PDF-`, `FF D8 FF`, `PNG signature`, `FILE_SIGNATURES` | ตรวจชนิดไฟล์จากหัวไฟล์จริง ไม่เชื่อนามสกุล |
| (helper) | [`ensureCanChangeEvidence`](src/modules/certificates/certificates.controller.js#L136) | | | `ใครแนบ/ลบได้`, `approved 409`, `รอบปิดแล้ว 409`, `exam_eligible 403` | กฎกลางทั้งแนบและลบ |
| (helper) | [`isInEvidenceGrace`](src/modules/certificates/certificates.controller.js#L102), `EVIDENCE_GRACE_MINUTES = 15` (98) | | | `ผ่อนผัน 15 นาที`, `หลังปิดรอบ` | แนบเพิ่มได้ 15 นาทีหลังปิด (ลบไม่ผ่อนผัน) |
| (helper) | [`discard`](src/modules/certificates/certificates.controller.js#L38), [`tooManyFilesError`](src/modules/certificates/certificates.controller.js#L50), [`httpError`](src/modules/certificates/certificates.controller.js#L9) | | | `ลบไฟล์ที่ไม่ได้บันทึก` | |
| repository | [`CERTIFICATE_TYPE`](src/modules/certificates/certificates.repository.js#L5), [`findById`](src/modules/certificates/certificates.repository.js#L11), [`createWithLock`](src/modules/certificates/certificates.repository.js#L24), [`removeWithLock`](src/modules/certificates/certificates.repository.js#L44) | | | `ล็อกใบก่อนเปลี่ยนไฟล์` | `certificates.repository.js` |

## 12. โมดูล notifications (แจ้งเตือน)

ไม่มี endpoint สร้าง — โมดูลอื่นเรียก `create` / `createMany` เอง (fire-and-forget) · ทุก route ต้อง `requireRole("student")`

| Endpoint | ฟังก์ชัน | บรรทัด | คีย์เวิร์ด | ทำอะไร |
|---|---|---|---|---|
| `GET /api/notifications/me` | [`getMine`](src/modules/notifications/notifications.controller.js#L68) | 68 | `แจ้งเตือนของฉัน`, `50 อันล่าสุด`, `notifyIfRoundJustOpened`, `round_open` | ดูแจ้งเตือน · ถ้ามีรอบเพิ่งเปิดและยังไม่ผ่านครบ จะสร้าง `round_open` ให้ครั้งเดียว |
| `PATCH /api/notifications/:id/read` | [`markRead`](src/modules/notifications/notifications.controller.js#L79) | 79 | `อ่านแล้ว`, `updateMany + student_id` | mark อันเดียว (เดา id ของคนอื่นไม่ได้) |
| `PATCH /api/notifications/read-all` | [`markAllRead`](src/modules/notifications/notifications.controller.js#L89) | 89 | `อ่านทั้งหมด` | mark ทั้งหมดของตัวเอง |
| (helper) | [`notifyIfRoundJustOpened`](src/modules/notifications/notifications.controller.js#L10), [`removeDuplicateRoundOpen`](src/modules/notifications/notifications.controller.js#L54) | | `แจ้งเปิดรอบ`, `กันแจ้งซ้ำ`, `findRoundOpenNoticeIds` | |
| repository | [`create`](src/modules/notifications/notifications.repository.js#L4), [`hasRoundOpenNotice`](src/modules/notifications/notifications.repository.js#L8), [`findRoundOpenNoticeIds`](src/modules/notifications/notifications.repository.js#L16), [`removeByIds`](src/modules/notifications/notifications.repository.js#L31), [`createMany`](src/modules/notifications/notifications.repository.js#L35), [`requireStudentId`](src/modules/notifications/notifications.repository.js#L43), [`findByStudent`](src/modules/notifications/notifications.repository.js#L53), [`markRead`](src/modules/notifications/notifications.repository.js#L61), [`markAllRead`](src/modules/notifications/notifications.repository.js#L72) | | `student_id undefined = ไม่กรอง (อันตราย)` | |

type ที่มี: `approved`, `rejected`, `revoked`, `eligible`, `round_open`

## 13. โมดูล news (ข่าว/ประกาศ)

| Endpoint | ฟังก์ชัน | บรรทัด | สิทธิ์ | คีย์เวิร์ด | ทำอะไร |
|---|---|---|---|---|---|
| `GET /api/news` | [`getAll`](src/modules/news/news.controller.js#L34) | 34 | 🔑 | `ข่าว`, `ประกาศ`, `กรองตามรุ่น`, `poster`, `is_closed` | นักศึกษาเห็นเฉพาะรุ่นตัวเอง (ผ่าน `round.academic_year`) |
| `POST /api/news` | [`createNews`](src/modules/news/news.controller.js#L52) | 52 | 🧑‍💼 | `โพสต์ประกาศ`, `ensureNewsText`, `ensureRoundExists`, `posted_by`, `round_id` | ต้องมี title+content+round_id |
| `PUT /api/news/:id` | [`updateNews`](src/modules/news/news.controller.js#L75) | 75 | 🧑‍💼 | `แก้ประกาศ`, `partial update`, `!== undefined` | แก้เฉพาะ field ที่ส่ง |
| `DELETE /api/news/:id` | [`deleteNews`](src/modules/news/news.controller.js#L102) | 102 | 🧑‍💼 | `ลบประกาศ`, `removeImageFile` | ลบพร้อมรูป |
| `POST /api/news/:id/image` | [`uploadNewsImage`](src/modules/news/news.controller.js#L126) | 126 | 🧑‍💼 | `แนบรูป`, `เปลี่ยนรูป`, `ลบรูปเก่า`, `uploadImage` | 1 ประกาศ = 1 รูป |
| `DELETE /api/news/:id/image` | [`deleteNewsImage`](src/modules/news/news.controller.js#L150) | 150 | 🧑‍💼 | `เอารูปออก` | |
| `GET /api/news/:id/image` | [`serveNewsImage`](src/modules/news/news.controller.js#L166) | 166 | 🔑 | `ดูรูป` | |
| (helper) | [`ensureNewsText`](src/modules/news/news.controller.js#L16), [`ensureRoundExists`](src/modules/news/news.controller.js#L23), [`toStoredPath`](src/modules/news/news.controller.js#L118), [`removeImageFile`](src/modules/news/news.controller.js#L121) | | `path / เสมอ`, `ลบไฟล์กำพร้า` | |
| repository | [`findAll`](src/modules/news/news.repository.js#L7), [`findById`](src/modules/news/news.repository.js#L33), [`create`](src/modules/news/news.repository.js#L37), [`update`](src/modules/news/news.repository.js#L40), [`remove`](src/modules/news/news.repository.js#L44) | | | |

## 14. โมดูล dashboard (สถิติ + รายงาน)

ไฟล์: `modules/dashboard/` — มี service เพราะคำนวณซับซ้อน · executive เข้าได้แค่ `alerts`/`stats`/`history`

### 14.1 Controller + routes

| Endpoint | ฟังก์ชัน | บรรทัด | สิทธิ์ | คีย์เวิร์ด | ทำอะไร |
|---|---|---|---|---|---|
| `GET /api/dashboard/stats?round_id=` | [`getStats`](src/modules/dashboard/dashboard.controller.js#L6) | 6 | 🧑‍💼👔 | `สถิติรอบ`, `buildStats`, `alreadyPassedStudentIds ตัดสำหรับ executive` | สถิติ 1 รอบ |
| `GET /api/dashboard/history?years=3` | [`getHistory`](src/modules/dashboard/dashboard.controller.js#L27) | 27 | 🧑‍💼👔 | `สรุปย้อนหลังรายปี`, `buildHistory`, `1–10 ปี` | |
| `GET /api/dashboard/alerts` | [`getAlerts`](src/modules/dashboard/dashboard.controller.js#L40) | 40 | 🧑‍💼👔 | `แจ้งเตือนเจ้าหน้าที่`, `buildAlerts`, `round_overdue`, `round_closing`, `not_submitted`, `pending_review` | แจ้งเตือนคำนวณสด (ไม่เก็บ DB) |
| `GET /api/dashboard/export?round_id=` | [`exportReport`](src/modules/dashboard/dashboard.controller.js#L50) | 50 | 🧑‍💼 | `รายงาน PDF`, `สภาการพยาบาล`, `buildReportPdf` | PDF สรุปผลสอบ |
| `GET /api/dashboard/export-first-attempt` | [`exportFirstAttempt`](src/modules/dashboard/dashboard.controller.js#L142) | 142 | 🧑‍💼 | `ผ่านครั้งแรก`, `ไม่ผ่านครั้งแรก`, `buildFirstAttemptList` | รายชื่อ xlsx/pdf |
| `GET /api/dashboard/export-first-year` | [`exportFirstYear`](src/modules/dashboard/dashboard.controller.js#L184) | 184 | 🧑‍💼 | `ผ่านภายในปีแรก`, `buildFirstYearList` | รายชื่อ xlsx/pdf |
| (helper) | [`readListExportQuery`](src/modules/dashboard/dashboard.controller.js#L80), [`listColumns`](src/modules/dashboard/dashboard.controller.js#L105), [`withRowNumbers`](src/modules/dashboard/dashboard.controller.js#L121), [`setPdfHeaders`](src/modules/dashboard/dashboard.controller.js#L132), [`badRequest`](src/modules/dashboard/dashboard.controller.js#L72) | | `ตรวจ year 2400–2700`, `passed`, `format`, `คอลัมน์ Excel` | |

### 14.2 `dashboard.service.js` (คำนวณ)

| ฟังก์ชัน | บรรทัด | คีย์เวิร์ด | ทำอะไร |
|---|---|---|---|
| `buildStats(roundId)` | 327 | `total`, `eligible`, `canSubmit`, `not_started`, `roundTotal`, `roundNotStarted`, `roundFillRate`, `alreadyPassed`, `fillRate`, `fullyPassed`, `fullyPassedRate`, `subjectPassRate`, `perSubject`, `pending_accounts` | สถิติรายรอบ |
| `buildYearStats(year)` | 646 | `สถิติรายปี` | wrapper ของ `buildYearSummary` |
| `buildYearSummary` (ภายใน) | 443 | `statusByStudent`, `firstAttempt`, `firstYear`, `byRoom`, `passDistribution`, `firstAttemptBySubject`, `started` | สรุปทั้งปี |
| `buildHistory(yearCount)` | 652 | `ย้อนหลัง`, `นับรายคน Set`, `ไม่ใช่รายใบ` | |
| `buildAlerts(role)` | 690 | `round_overdue` (เลยกำหนดยังไม่ปิด), `round_closing` (ใกล้ปิด ≤ `CLOSING_SOON_DAYS` 7 วัน), `not_submitted` (ยังไม่ส่งผล N คน), `pending_review` (รอตรวจ), `daysUntil`, `ictDayNumber` | |
| `buildStudentRows(roundId)` | 786 | `แถวนักศึกษาสำหรับ PDF`, `paperStatusLabel`, `studentContactColumns` | |
| `buildFirstAttemptList(year, wantPassed)` | 847 | `ผ่านครั้งแรก`, `ตัวหาร = ทั้งรุ่น` | |
| `buildFirstYearList(year, wantPassed)` | 904 | `ผ่านภายในปีแรก`, `addConfirmedRealPasses`, `getRequiredSubjectIds`, `hasPassedAll` | |
| helper นับ | [`percent`](src/modules/dashboard/dashboard.service.js#L6), [`rate2`](src/modules/dashboard/dashboard.service.js#L10), [`onlySent`](src/modules/dashboard/dashboard.service.js#L16), [`notRejected`](src/modules/dashboard/dashboard.service.js#L21), [`onlyConfirmed`](src/modules/dashboard/dashboard.service.js#L30), [`countByStatus`](src/modules/dashboard/dashboard.service.js#L33), [`countFullyPassed`](src/modules/dashboard/dashboard.service.js#L54) | | `% จำนวนเต็ม`, `% ทศนิยม 2 ตำแหน่ง`, `ตัด draft`, `ตัด rejected`, `เฉพาะ approved` | |
| helper ตาราง | [`buildPerSubject`](src/modules/dashboard/dashboard.service.js#L68), [`buildPerSubjectByStudent`](src/modules/dashboard/dashboard.service.js#L87), [`buildPassDistribution`](src/modules/dashboard/dashboard.service.js#L113), [`buildFirstAttemptBySubject`](src/modules/dashboard/dashboard.service.js#L192) | | `ผ่านกี่วิชา`, `ตารางสภาการพยาบาล`, `pass/fail/not_submitted`, `sat`, `rate null = ไม่มีข้อมูล` | |
| helper ผ่านภายในปีแรก | [`addConfirmedRealPasses`](src/modules/dashboard/dashboard.service.js#L280), [`getRequiredSubjectIds`](src/modules/dashboard/dashboard.service.js#L301), [`hasPassedAll`](src/modules/dashboard/dashboard.service.js#L318) | | `ไม่นับ carried_forward`, `บั๊ก B1` | |

### 14.3 Repository + PDF

| ฟังก์ชัน | บรรทัด | คีย์เวิร์ด | ทำอะไร |
|---|---|---|---|
| [`findDefaultRound`](src/modules/dashboard/dashboard.repository.js#L11) | 11 | `รอบเริ่มต้น`, `เปิดอยู่ก่อน ไม่งั้นล่าสุด` | |
| `findRoundsByYears` / `findAcademicYears` / `findRoundById` | 19 / 26 / 36 | `ปีที่มีรอบ` | |
| `findPendingStudentIdsByYear` / `countPendingByYear` | 43 / 66 | `นำเข้าแล้วยังไม่เข้าระบบ`, `ตัวหารต้องรวม` | |
| `countStudentsByYear` / `countEligibleByYear` / `countStudentsByRoom` | 69 / 77 / 84 | `ตัวหาร`, `ห้องเรียน` | |
| [`findAllSubjects`](src/modules/dashboard/dashboard.repository.js#L108) | 108 | | |
| [`findEligibleWithPassedSubjects`](src/modules/dashboard/dashboard.repository.js#L123) | 123 | `คิวตรวจ`, `canSubmit`, `ผ่านครบแล้ว`, `ต้องตรงกับ findPassedSubjectIds` | |
| [`findResultsByRound`](src/modules/dashboard/dashboard.repository.js#L168) | 168 | `ผลสอบทั้งรอบ + ผลรายวิชา` | |
| [`findStudentsByYear`](src/modules/dashboard/dashboard.repository.js#L189) | 189 | `ทั้งรุ่น`, `ห้ามเพิ่ม password_hash` | ใช้ทำรายชื่อ export |
| `buildReportPdf` — `dashboard.pdf.js` | 18 | `รายงาน PDF`, `pdfkit`, `doc.pipe(res)` | PDF สรุป (stream ไม่เขียน disk) |
| `buildPassListPdf` — `dashboard.pdf.js` | 319 | `รายชื่อผ่าน/ไม่ผ่าน PDF` | ใช้ร่วม ผ่านครั้งแรก/ภายในปีแรก |

## 15. ฐานข้อมูล Prisma + seed + scripts

| ไฟล์ | คีย์เวิร์ด | ทำอะไร |
|---|---|---|
| `prisma/schema.prisma` | `model`, `13 ตาราง`, `@@unique`, `onDelete RESTRICT`, `subject_ids Int[]`, `exam_eligible`, `carried_forward`, `review_logs`, `notifications`, `import_academic_year`, `eligible_set_by`, `created_by/closed_by` | source of truth ของโครงสร้างตาราง |
| `prisma/migrations/` (17 ชุด) | `migrate dev`, `migrate deploy`, `add_reviewer_role`, `add_exam_result_unique_and_indexes`, `add_audit_actor_columns`, `add_unique_round_year_attempt`, `remove_sessions_table` | ประวัติแก้ตาราง (ชื่อ = วันที่_ชื่อ) |
| `prisma/seed.js` | `db seed`, `ข้อมูลตัวอย่าง`, `roles`, `faculties`, `rooms`, `subjects`, `บัญชี officer/executive`, `SEED_ACCOUNT` | ข้อมูลตั้งต้น (บัญชีทดสอบข้ามบังคับเปลี่ยนรหัส) |
| `prisma/demoSeed.js` | `เดโม`, `20 คน 3 ปี`, `approved ทั้งหมด` | ข้อมูลเดโมให้อาจารย์ดู |
| `prisma/seedCohort.js` | `ทั้งรุ่น`, `จำนวนคน`, `ห้องแรก` | `npm run seed:cohort -- 2570 100 70` |
| `prisma/seedDemoYears.js` | `หลายรุ่น`, `5 รุ่น`, `จำลองปริมาณจริง`, `รอบ 1/2/3` | ข้อมูลจำลอง 2565–2569 ไว้ทดสอบ dashboard |
| `scripts/update-subjects.js` | `MAP`, `NUR01→1101`, `เปลี่ยนรหัสวิชา` | สคริปต์ครั้งเดียว: เปลี่ยนรหัสวิชาเก่า → ใหม่ |

## 16. เทส

| ไฟล์ | คีย์เวิร์ด | ทดสอบเรื่อง |
|---|---|---|
| `tests/smoke-phase1-3.mjs` … `smoke-phase33-full-audit.mjs` | `smoke test`, `phase N`, `BASE=http://localhost:3000` | ต้องรัน server ก่อน · แยกตามหัวข้อ: 1–3 auth/me + subjects + users · 4–6 endpoint phase 4–6 · 9 rooms + import CSV (win874) · 10 `subject_ids` ของรอบ · 11 carry-forward · 12 ตีกลับแล้วแก้ · 13 รอบซ้ำ/เปิดทีละรอบ · 14 ข่าวตามรุ่น · 15 reviewer + review_logs · 16 ซ้ำชั้น/ปีจบ · 17 import ระบุปี · 18 วันที่รอบ + `phase` · 19 guards คำขอไม่ครบ · 20 hardening ตรวจบั๊กทั้งระบบ 24 ก.ย. · 21 pending accounts · 22 exports · 23 ลบ user · 24 วงจรรุ่น รอบ 1→2→3 · 25 flow จริงของคณะ · 26 edge cases · 27 security · 28 actor/ผู้ดำเนินการ · 29 สถิติฐานคนของรอบ · 30 ตารางสิทธิ์ทุก endpoint × role · 31 ตรวจรอบ 3 (4 ต.ค.) + ล็อกขนาน · 32 reopen · 33 บั๊กจากตรวจโค้ดทั้งระบบ |
| `tests/run-clean.mjs` | `test:clean`, `schema สะอาด` | รันเทสบน schema ว่าง |
| `tests/e2e/*.e2e.mjs`, `run-e2e.mjs` | `Playwright`, `lifecycle`, `browsers`, `devices`, `perf`, `real-data` | เทสผ่านหน้าเว็บ |
| `tests/cleanupYears.mjs`, `autoEvidence.mjs`, `fixtures/*.xlsx` | `ล้างข้อมูลเทส`, `ไฟล์หลักฐานอัตโนมัติ`, `xlsx หลายแบบ` | ตัวช่วยเทส |

## 17. คำสั่ง npm

| คำสั่ง | ทำอะไร |
|---|---|
| `npm start` | รัน server ปกติ |
| `npm run dev` | รัน + restart อัตโนมัติเมื่อแก้โค้ด (`node --watch`) |
| `npm test` | รัน smoke ทุก phase ต่อกัน |
| `npm run test:clean` | รันเทสบน schema สะอาด |
| `npm run test:e2e` (+ `:lifecycle` `:browsers` `:import` `:devices`) | เทสผ่านเบราว์เซอร์ |
| `npm run test:real` / `test:perf` | เทสกับข้อมูลจริงที่คัดลอก / เทสประสิทธิภาพ |
| `npm run demo:seed` / `seed:cohort` / `seed:demo-years` | เติมข้อมูลตัวอย่าง |
| `npx prisma migrate dev` / `generate` / `db seed` / `studio` | จัดการ DB (ดู BACKEND_GUIDE ส่วน 2) |
