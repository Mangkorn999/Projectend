# Backend 02 — Auth (เข้าสู่ระบบ) และแผนที่ routes ทุกโมดูล

ไฟล์ที่ครอบคลุม:
- `backend/src/controllers/authController.js` — login / logout / เปลี่ยนรหัส / getme
- `backend/src/modules/*/\*.routes.js` — ตาราง "URL → ใครเข้าได้ → ฟังก์ชันไหน" ของทั้งระบบ

> **Pattern ของระบบ:** `routes.js` (ผูก URL + ด่านตรวจ) → `controller.js` (รับ req / ตอบ res) → `service.js` (กฎธุรกิจ บางโมดูล) → `repository.js` (คุย Prisma อย่างเดียว)
> role ที่มีในระบบ: `student`, `officer` (เจ้าหน้าที่), `executive` (ผู้บริหาร — read-only), `reviewer` (เจ้าหน้าที่ตรวจสอบ)

---

## `controllers/authController.js` (204 บรรทัด)

| บรรทัด | ทำอะไร |
|---|---|
| 1-3 | import `jsonwebtoken` (ออก token), `bcryptjs` (hash/เทียบรหัส), `prisma` |
| 5-7 | `SALT_ROUNDS = 10` (ความแรงของ hash — สูง = ช้าแต่เดายาก), `MIN_PASSWORD_LENGTH = 8` |
| 16 | `COOKIE_SECURE` — อ่าน `.env` เป็นสตริง แล้วเทียบ `=== "true"` ได้ boolean |
| 18-24 | `TOKEN_COOKIE_OPTIONS`: `httpOnly` (JS ในเว็บอ่านไม่ได้ กัน XSS ขโมย token), `secure` (ส่งเฉพาะ HTTPS), `sameSite: "lax"` (กัน CSRF), `path: "/"`, `maxAge` 1 วันเป็น ms. **ใช้ชุดเดียวกันตอน set และ clear cookie** ไม่งั้น logout ไม่ลบ |

### `login` (บรรทัด 28-102) — `POST /api/auth/login`
| บรรทัด | ทำอะไร |
|---|---|
| 30 | destructuring ดึง `psu_passport_id`, `password` จาก `req.body` |
| 33-43 | ต้องเป็น string และไม่ว่างทั้งคู่ — ส่ง object มาเดิม Prisma พังเป็น 500 → ตอนนี้ตอบ 400 |
| 45-48 | หา user ด้วย `psu_passport_id` พร้อม `include` role และ student |
| 51-54 | `invalid()` ตอบ 401 ข้อความเดียว **ไม่บอกว่าผิด username หรือ password** (กันคนไล่เดาว่ามีบัญชี) |
| 56 | ไม่มี user → `invalid()` |
| 59-64 | ไม่มี `password_hash` (ถูกถอนสิทธิ์/ยังไม่ตั้งรหัส) → 403 |
| 66-67 | `bcrypt.compare(password, hash)` เทียบรหัสที่พิมพ์กับ hash ใน DB → ผิด = `invalid()` |
| 69-79 | `jwt.sign({userId, role, studentId, mustChangePassword}, JWT_SECRET, {expiresIn:"1d"})` ออก token 1 วัน |
| 83 | `res.cookie("token", token, options)` ฝัง token ใน httpOnly cookie **ไม่ส่ง token ใน body** |
| 85-96 | ตอบข้อมูลที่ frontend ต้องใช้: `must_change_password`, `profile_incomplete` (นักศึกษาที่ import แล้วยังไม่กรอกโปรไฟล์), `user {id,name,role}` |
| 97-101 | error → `next(error)` ให้ errorHandler กลางตัดสิน status |

### `logout` (104-111) — `POST /api/auth/logout`
`res.clearCookie("token", options)` แล้วตอบ success. ไม่ผ่าน `authenticate` เพื่อให้ token พังแล้วก็ยัง logout ได้

### `changePassword` (113-179) — `PATCH /api/auth/password`
| บรรทัด | ทำอะไร |
|---|---|
| 117-129 | ตรวจ `current_password`, `new_password` เป็น string ไม่ว่าง → 400 |
| 131-137 | รหัสใหม่ต้อง ≥ 8 ตัว |
| 138-145 | หา user จาก `req.user.userId` (id จาก token ที่ผ่าน authenticate) ไม่เจอ → 404 |
| 147-152 | เทียบรหัสเดิม ผิด → 401 (ไม่มี `code: auth_required` เพื่อไม่ให้หน้า reload ทิ้ง) |
| 154-160 | รหัสใหม่ห้ามซ้ำรหัสเดิม |
| 162-169 | `update` ตั้ง `password_hash` ใหม่ (hash ด้วย bcrypt) + `must_change_password: false` |
| 170-174 | ตอบให้ login ใหม่ (token เก่ายังมี flag เก่า) |
| 175-178 | error → log + 500 (ไฟล์นี้ยังไม่ใช้ `next(err)` ตรงนี้) |

### `getme` (181-204) — `GET /api/auth/me`
ดึง user ของ `req.user.userId` + role + student ส่ง `{ id, name, role, must_change_password, profile_incomplete }`. frontend เรียกตอนเปิดหน้าเพื่อรู้ว่ายัง login อยู่ไหมและเป็น role อะไร

---

## `modules/auth/auth.routes.js` (37 บรรทัด)

| บรรทัด | ทำอะไร |
|---|---|
| 1-9 | import express, controller, `authenticate`, `rateLimit` |
| 11 | `express.Router()` — router ย่อยของโมดูล (ถูก mount ที่ `/api/auth` ใน app.js) |
| 18-23 | `POST /login` ผ่าน rate limit 2 ชั้นก่อน `login`: ชั้น IP (60 ครั้ง/15 นาที) กัน credential stuffing, ชั้น `psu_passport_id` (10 ครั้ง/15 นาที) กันเดารหัสของบัญชีเดียว |
| 25 | `POST /logout` public |
| 26 | `GET /me` ต้อง `authenticate` |
| 30-35 | `PATCH /password` — `authenticate` + rate limit 10/15 นาทีตาม IP (กันขโมย cookie มาไล่เดารหัสเดิม) |

---

## แผนที่ routes ทุกโมดูล

อ่านตารางนี้เป็นแผนที่หลัก: ไฟล์ routes อยู่ที่ `backend/src/modules/<โมดูล>/<โมดูล>.routes.js`
**ลำดับ route สำคัญ:** path เฉพาะ (เช่น `/active`, `/export`) ต้องมาก่อน `/:id` ไม่งั้น Express เอาคำเหล่านั้นไปเป็นค่า `:id`

### `rounds` — `/api/rounds` (`rounds.routes.js`, 15 บรรทัด)
| Method + Path | Role | Controller |
|---|---|---|
| GET `/active` | student | `getActive` — รอบที่กรอกได้ตอนนี้ |
| GET `/` | ทุกคนที่ login | `getAll` |
| POST `/` | officer | `create` |
| PUT `/:id` | officer | `update` |
| DELETE `/:id` | officer | `remove` |

### `subjects` — `/api/subjects` (17 บรรทัด)
| Method + Path | Role | Controller |
|---|---|---|
| GET `/` | ทุกคนที่ login | `getAll` |
| POST `/` | officer | `createAll` |
| PUT `/:id` | officer | `updatasubject` |
| DELETE `/:id` | officer | `deleteSubject` |

### `users` — `/api/users` (27 บรรทัด) — จัดการบัญชีเจ้าหน้าที่/ผู้บริหาร/ผู้ตรวจ
| Method + Path | Role | Controller |
|---|---|---|
| GET `/` | officer | `getAll` |
| POST `/` | officer | `create` |
| POST `/:id/role` | officer | `updateRole` |
| POST `/:id/revoke` | officer | `revokeAccess` |
| DELETE `/:id` | officer | `deleteUser` |
| POST `/:id/reset-password` | officer | `resetPassword` |

### `students` — `/api/students` (81 บรรทัด)
บรรทัด 26-29 ตั้ง multer เก็บไฟล์ใน **memory** (`memoryStorage`) จำกัด 5 MB — ใช้แค่ parse CSV แล้วทิ้ง ไม่เขียน disk

| Method + Path | Role | Controller |
|---|---|---|
| GET `/` | officer, reviewer | `getAll` |
| GET `/export-subject` | officer | `exportSubjectList` |
| POST `/export` | officer | `exportStudents` (POST เพราะส่งรายชื่อที่กรองไว้ใน body) |
| GET `/subject-result-list` | officer | `getSubjectResultList` |
| GET `/pending-accounts` | officer | `listPendingAccounts` |
| POST `/pending-accounts/delete` | officer | `removePendingAccounts` |
| POST `/bulk-delete` | officer | `bulkRemove` |
| GET `/:id` | officer, student, reviewer | `getById` (student เช็คเจ้าของข้อมูลใน controller) |
| POST `/` | officer | `create` |
| POST `/complete-profile` | student | `completeProfile` |
| PATCH `/bulk-eligible` | officer | `bulkSetEligible` |
| POST `/import` | officer | `bulkImport` (`upload.single("file")` ก่อน) |
| POST `/:id/reset-password` | officer | `resetPassword` |
| DELETE `/:id` | officer | `remove` |
| PATCH `/:id` | officer | `update` (ท้ายสุด กัน `/:id` ชิดจับ) |

### `examResults` — `/api/exam-results` (38 บรรทัด)
| Method + Path | Role | Controller |
|---|---|---|
| POST `/` | student | `create` — ส่งผลสอบ |
| GET `/me` | student | `getMine` |
| POST `/:id/certificates` | student | `uploadEvidence.single("file")` แล้ว `uploadCertificate` |
| GET `/` | officer, reviewer | `getAll` (executive ไม่เห็นรายบุคคล) |
| PATCH `/:id/approve` | officer, reviewer | `approve` |
| PATCH `/:id/reject` | officer, reviewer | `reject` |
| PATCH `/:id/revoke-approval` | officer | `revokeApproval` |
| PATCH `/:id/reopen` | officer | `reopen` — กลับเป็นรอตรวจ |

### `certificates` — `/api/certificates` (13 บรรทัด)
| Method + Path | Role | Controller |
|---|---|---|
| GET `/:id/file` | ทุกคนที่ login | `serveFile` (สิทธิ์เช็คใน controller) |
| DELETE `/:id` | student | `remove` — นักศึกษาลบหลักฐานตัวเอง |

### `news` — `/api/news` (25 บรรทัด)
| Method + Path | Role | Controller |
|---|---|---|
| GET `/` | ทุกคนที่ login | `getAll` |
| GET `/:id/image` | ทุกคนที่ login | `serveNewsImage` |
| POST `/:id/image` | officer | `uploadImage.single("image")` + `uploadNewsImage` |
| DELETE `/:id/image` | officer | `deleteNewsImage` |
| POST `/`, PUT `/:id`, DELETE `/:id` | officer | `createNews`, `updateNews`, `deleteNews` |

### `dashboard` — `/api/dashboard` (39 บรรทัด)
| Method + Path | Role | Controller |
|---|---|---|
| GET `/stats`, `/history`, `/alerts` | officer, executive | `getStats`, `getHistory`, `getAlerts` |
| GET `/export` | officer | `exportReport` |
| GET `/export-first-attempt` | officer | `exportFirstAttempt` |
| GET `/export-first-year` | officer | `exportFirstYear` |

(export เป็นข้อมูลรายบุคคล จึงให้เฉพาะ officer — executive เห็นแค่สถิติรวม)

### `notifications` — `/api/notifications` (16 บรรทัด)
| Method + Path | Role | Controller |
|---|---|---|
| GET `/me` | student | `getMine` |
| PATCH `/read-all` | student | `markAllRead` |
| PATCH `/:id/read` | student | `markRead` |

ทุก route จำกัด `student` เพราะถ้า officer เข้า `req.user.studentId` เป็น undefined → Prisma ตีความว่า "ไม่กรอง" → เห็น/อ่านแจ้งเตือนของทุกคน

### `rooms` — `/api/rooms` (14 บรรทัด)
| Method + Path | Role | Controller |
|---|---|---|
| GET `/` | ทุกคนที่ login | `getAll` — รายชื่อห้อง (ใช้ตอนกรอกโปรไฟล์ + เจ้าหน้าที่แก้ข้อมูล) |
