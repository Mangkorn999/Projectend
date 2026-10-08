# Backend 01 — แกนกลาง: server, config, middlewares, utils

ไฟล์ที่ครอบคลุม (path อยู่ใต้ `backend/src/`):

| ไฟล์ | หน้าที่สั้น ๆ |
|---|---|
| `server.js` | จุดเริ่ม — เปิดพอร์ตรับ request |
| `app.js` | ประกอบ Express: middleware + route + error handler |
| `config/db.js` | PrismaClient ตัวเดียวของทั้งระบบ |
| `config/env.js` | ตรวจ `.env` ก่อน server เริ่ม |
| `middlewares/auth.js` | `authenticate` — ตรวจ cookie/JWT + เช็ค user กับ DB |
| `middlewares/requireRole.js` | ตรวจ role ต่อจาก authenticate |
| `middlewares/errorHandler.js` | แปลง error ทุกชนิดเป็น JSON + status ที่ถูก |
| `middlewares/rateLimit.js` | จำกัดจำนวนครั้งยิง (กัน brute-force) |
| `middlewares/upload.js` | multer — รับไฟล์หลักฐาน/รูปข่าว |
| `utils/*.js` | ฟังก์ชันช่วยใช้ร่วม (ปีจบ, ผู้ดำเนินการ, phase รอบ, PDF, Excel) |

> **อ่านก่อน:** ทุก request วิ่งผ่านลำดับนี้ → `helmet` → `cors` → `express.json` → `cookieParser` → router (ซึ่งมี `authenticate` → `requireRole` → controller) → ถ้ามี error ไป `errorHandler`

---

## `server.js` (7 บรรทัด)

| บรรทัด | ทำอะไร |
|---|---|
| 1 | `import app` — เอา Express app ที่ประกอบไว้ใน `app.js` มาใช้ |
| 3 | `PORT` = ค่าจาก `.env` ถ้าไม่มีใช้ 3000. `\|\|` = "ถ้าซ้ายเป็นค่าว่าง ใช้ขวา" |
| 5-7 | `app.listen` เปิดพอร์ตรอรับ request แล้วพิมพ์ข้อความใน terminal ว่าเริ่มแล้ว |

แยก `server.js` ออกจาก `app.js` เพราะ**เทสอัตโนมัติ import `app` ได้โดยไม่เปิดพอร์ตจริง**

---

## `app.js` (88 บรรทัด)

| บรรทัด | ทำอะไร |
|---|---|
| 1 | `dotenv/config` — อ่านไฟล์ `.env` ใส่ `process.env` (ต้องอยู่บรรทัดแรก ก่อนทุกอย่างอ่านค่า env) |
| 2-4 | import `express`, `validateEnv`, `errorHandler` |
| 6-17 | import router ของทุกโมดูล (auth, subjects, users, students, rounds, examResults, news, dashboard, rooms, certificates, notifications) |
| 19-21 | import `cors`, `cookie-parser`, `helmet` |
| 23-24 | `validateEnv()` ตรวจ `.env` — ขาดตัวแปรสำคัญ = throw ทันที server ไม่เริ่ม |
| 26 | `express()` สร้าง app |
| 28-41 | `helmet(...)` ใส่ HTTP security header ให้ทุกคำตอบ. ปิด `contentSecurityPolicy` (frontend/backend คนละ origin ตอน dev) และตั้ง `crossOriginResourcePolicy: cross-origin` (ให้ `<img>`/PDF ข้าม origin โหลดได้) |
| 43-48 | อ่าน `CORS_ORIGIN` จาก `.env` → `.split(",")` แยกเป็น array → `.map(o => o.trim())` ตัดช่องว่าง. ใส่ได้หลาย origin คั่น comma |
| 50-55 | `cors({ origin, credentials: true })` — อนุญาตเฉพาะ origin ที่ระบุ + ยอมให้ส่ง cookie ข้าม origin (จำเป็น เพราะ token อยู่ใน cookie) |
| 56 | `express.json()` — แปลง body ที่เป็น JSON เป็น `req.body` |
| 57-59 | `cookieParser()` — อ่าน cookie เป็น `req.cookies` (ต้องมาก่อน route ทุกตัว ไม่งั้น `authenticate` อ่าน token ไม่ได้) |
| 61-72 | ผูก router กับ URL นำหน้า เช่น `/api/auth`, `/api/students`, `/api/exam-results` ... |
| 74-83 | 404 กลางสำหรับ URL ที่ไม่ตรงอะไรเลย ตอบ JSON (ไม่งั้น Express ตอบ HTML แล้ว frontend parse ไม่ได้) |
| 85-86 | `errorHandler` — **ต้องอยู่ท้ายสุดเสมอ** Express รู้ว่าเป็นตัวจับ error เพราะรับ 4 พารามิเตอร์ |
| 88 | `export default app` |

---

## `config/db.js` (16 บรรทัด)

| บรรทัด | ทำอะไร |
|---|---|
| 1 | import `PrismaClient` |
| 3-13 | คอมเมนต์อธิบาย singleton: 1 client = 1 connection pool. ถ้าแต่ละไฟล์สร้างเอง connection เกิน limit ของ PostgreSQL (100) → error "too many clients" |
| 14 | `new PrismaClient()` สร้างครั้งเดียว |
| 16 | `export default prisma` — ทุก repository `import prisma from "../../config/db.js"` |

**กฎ:** ห้ามเขียน `new PrismaClient()` ที่อื่นใน `src/`

---

## `config/env.js` (34 บรรทัด)

| บรรทัด | ทำอะไร |
|---|---|
| 9-14 | `REQUIRED_VARS` — รายชื่อตัวแปรที่ต้องมี: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `COOKIE_SECURE` |
| 16 | `export function validateEnv()` |
| 17 | `.filter(key => !process.env[key])` เก็บเฉพาะชื่อที่ขาด |
| 18-23 | ถ้ามีขาด → `throw new Error` บอกชื่อที่ขาดทั้งหมด (`join(", ")`) |
| 27-31 | `COOKIE_SECURE` ต้องเป็นสตริง `"true"` หรือ `"false"` เป๊ะ. พิมพ์ `True`/`1` จะกลายเป็น false เงียบ ๆ จึงต้องตรวจ |
| 33 | log ว่าผ่าน |

---

## `middlewares/auth.js` — `authenticate` (116 บรรทัด)

หน้าที่: "คุณเป็นใคร" — ตรวจ token → เช็คกับ DB → แนบ `req.user`

| บรรทัด | ทำอะไร |
|---|---|
| 1-2 | import `jsonwebtoken` (ตรวจ JWT) กับ `prisma` |
| 8-14 | 3 รายการ "ทางเล็ดลอด" ที่ยังเข้าได้แม้ถูกบังคับ: `PASSWORD_SETUP_PATHS` (`/me`, `/password` — ตอนต้องเปลี่ยนรหัสผ่านครั้งแรก), `PROFILE_SETUP_PATHS` (`/me`, `/complete-profile` — นักศึกษาใหม่ยังไม่กรอกโปรไฟล์), `PROFILE_SETUP_ROUTERS` (`/api/rooms` — ต้องมีรายชื่อห้องให้เลือกในหน้ากรอกโปรไฟล์) |
| 16 | `export const authenticate = async (req, res, next)` — middleware มาตรฐาน 3 พารามิเตอร์ |
| 20-23 | อ่าน token จาก `req.cookies.token` (httpOnly cookie ที่ browser แนบเอง) — เช็ค `req.cookies` ก่อนกัน undefined |
| 27-33 | ไม่มี token → 401 พร้อม `code: "auth_required"` (frontend ใช้ code นี้ตัดสินใจเด้งไปหน้า login) |
| 35-45 | `jwt.verify(token, JWT_SECRET)` — ผิด/หมดอายุจะ throw → จับด้วย `try/catch` ตอบ 401 |
| 47-64 | **เช็คกับ DB ทุกครั้ง** ด้วย `findUnique` ตาม `decoded.userId` เลือกเฉพาะ field ที่ต้องใช้ (id, passport id, password_hash, must_change_password, role, student_id) — token ถูกต้องไม่ได้แปลว่าเจ้าของยังอยู่ (เช่น DB ถูก reseed / ถูกถอนสิทธิ์) |
| 66-73 | ไม่เจอ user หรือ `password_hash` เป็น null (= ถอนสิทธิ์/ปิดบัญชี) → 401 ให้ login ใหม่ |
| 75-83 | สร้าง `req.user = { userId, username, role, studentId, mustChangePassword }` **ใช้ค่าจาก DB ไม่ใช่จาก token** → เปลี่ยน role แล้วมีผลทันที. `?.` กับ `?? null` = ถ้าไม่มี student ให้เป็น null |
| 85-97 | ถ้า `mustChangePassword` และ path ไม่อยู่ใน `PASSWORD_SETUP_PATHS` → 403 `must_change_password: true` (ล็อกฝั่ง backend ไม่พึ่ง frontend) |
| 98-110 | ถ้าเป็น student ที่ยังไม่มี `studentId` และ path/router ไม่อยู่ในรายการยกเว้น → 403 `profile_incomplete: true` |
| 112 | `next()` ผ่านด่าน ไปตัวถัดไป |
| 113-115 | error ที่ไม่คาดคิด (เช่น DB ล่ม) → `next(err)` ส่งให้ errorHandler |

---

## `middlewares/requireRole.js` (33 บรรทัด)

| บรรทัด | ทำอะไร |
|---|---|
| 11 | `requireRole = (...allowedRoles) =>` — rest parameter รวม argument เป็น array เช่น `requireRole("officer","reviewer")` → `["officer","reviewer"]` |
| 12 | คืน "ฟังก์ชัน middleware" อีกชั้น (closure จำ `allowedRoles` ไว้) |
| 13-20 | ไม่มี `req.user` (ลืมใส่ `authenticate` ก่อน) → 401 |
| 24-29 | role ของ `req.user` ไม่อยู่ใน `allowedRoles` → 403 ข้อความไม่เปิดเผยชื่อ role |
| 31 | `next()` |

role อ่านจาก `req.user` (ที่ `authenticate` ยึดจาก DB) **ไม่เคยเชื่อ role ใน body**

---

## `middlewares/errorHandler.js` (128 บรรทัด)

รับ error ทุกชนิดจาก `next(err)` / `throw` → ตอบ `{ success: false, message }` พร้อม status ที่เหมาะสม

| บรรทัด | ทำอะไร |
|---|---|
| 4-5 | signature 4 พารามิเตอร์ `(err, req, res, next)` + log error ลง server |
| 24 | `hasOwnStatus` = controller ตั้ง `err.statusCode` เอง (ข้อความไทยเฉพาะเรื่อง — ห้ามเขียนทับ) |
| 25-29 | `isPrismaError` = ชื่อ error ขึ้นต้นด้วย `PrismaClient` |
| 30 | `rawMessage` = ข้อความ error (กัน non-string) |
| 32-33 | `P2002` = ข้อมูลซ้ำ (unique), `P2025` = หาแถวไม่เจอ |
| 34-42 | foreign key: `P2003` หรือข้อความ `23001`/`violates RESTRICT` (Prisma ไม่แปลง RESTRICT เป็น P2003 เอง) → `isForeignKey` |
| 43-48 | `isNumberTooBig` — id ใหญ่เกินคอลัมน์ int |
| 49-64 | `isNulByte` — มีอักขระ NUL (0x00) Postgres เก็บไม่ได้ ดูเฉพาะ Prisma error ที่ไม่มี statusCode |
| 65-67 | `isBadInput` = validation error / P2000 / เลขใหญ่ / NUL → ความผิดของ request |
| 69-84 | เลือก `statusCode` ตามลำดับ: ตั้งเอง → MulterError 400 → P2002 409 → P2025 404 → FK 409 → bad input 400 → อื่น ๆ 500 |
| 86-110 | เลือก `message`: ใช้ข้อความกลางเป็นไทยแทนข้อความดิบของ Prisma (เฉพาะกรณี controller ไม่ได้ตั้งเอง). MulterError แปลรหัสเป็นไทย (`LIMIT_FILE_SIZE` ฯลฯ) |
| 111-117 | 500 นอกโหมด development → ข้อความกลาง ไม่ส่งข้อความดิบ (มีชื่อตาราง/query). ข้อความว่าง → ข้อความกลาง |
| 119-127 | ส่ง JSON. `...(cond && {stack})` = "ใส่ key นี้เมื่อเป็น development เท่านั้น" (`...false` ไม่เพิ่มอะไร) |

---

## `middlewares/rateLimit.js` (49 บรรทัด)

| บรรทัด | ทำอะไร |
|---|---|
| 4 | `buckets = new Map()` — ถังนับต่อ key เก็บใน memory ของ process |
| 8-16 | `setInterval` ทุก 10 นาที ลบ bucket ที่หมดเวลา (กัน memory โต). `.unref()` = ไม่ให้ timer นี้ค้าง process ตอนปิด |
| 21 | `rateLimit({windowMs, max, keyField})` คืน middleware |
| 25 | `identity` = ค่า field ใน body (เช่น `student_id`) ถ้ากำหนด `keyField` ไม่งั้นใช้ IP |
| 27 | `key` = `path:identity` แยกถังต่อ endpoint ต่อคน |
| 30-35 | ไม่มีถัง/หมดเวลา → เริ่มนับใหม่ `{count:1, resetAt}` แล้ว `next()` |
| 38-44 | `count >= max` → 429 บอกต้องรอกี่วินาที (`Math.ceil` ปัดขึ้น) |
| 46-47 | ยังไม่เกิน → `count += 1` แล้ว `next()` |

ข้อจำกัด: memory เดียว — ถ้ารันหลาย instance ต้องย้ายไป Redis

---

## `middlewares/upload.js` (89 บรรทัด)

| บรรทัด | ทำอะไร |
|---|---|
| 1-3 | import `multer` (รับ multipart), `fs`, `path` |
| 6 | `UPLOAD_DIR` = `uploads/certificates` (ไฟล์จริงอยู่ disk ใน DB เก็บแค่ path) |
| 8-18 | `destination` — สร้างโฟลเดอร์ทุกครั้ง (`mkdirSync recursive`) แล้วบอก multer ให้เก็บที่นี่ |
| 19-30 | `filename` — ตั้งชื่อเอง `เวลา-เลขสุ่ม` + นามสกุลตาม mimetype (pdf/jpg/png) ป้องกันชื่อซ้ำ + path traversal |
| 34 | `EVIDENCE_TYPES` = pdf/jpeg/png |
| 36-43 | `fileFilter` — ชนิดไม่ตรง → error 400 (ด่านนี้เชื่อ mimetype จาก browser ซึ่งปลอมได้ ด่านจริงตรวจ byte ใน `certificates.controller.js`) |
| 45-49 | `uploadEvidence` = multer + limit 10 MB |
| 52-60 | โฟลเดอร์ + แผนที่ mimetype→นามสกุลของรูปข่าว (jpg/png/webp/gif) |
| 62-76 | `imageStorage` เหมือน storage ข้างบน แต่โฟลเดอร์ `uploads/news` |
| 78-89 | `uploadImage` — รับเฉพาะรูป จำกัด 5 MB |

---

## `utils/academicYear.js` (43 บรรทัด)

| บรรทัด | ทำอะไร |
|---|---|
| 3 | `calcGraduationYear(studentId)` |
| 4 | เอา 2 หลักแรกของรหัสเป็นตัวเลข (เช่น `6610...` → 66) |
| 5-9 | ไม่ใช่จำนวนเต็ม/สั้นเกิน → throw 400 |
| 10-11 | ปีเข้า = 2500 + 66 = 2566 → ปีจบ = +4 = **2570** |
| 25 | `validateGraduationYear(value, studentId)` ตรวจปีจบที่เจ้าหน้าที่พิมพ์เอง — **คืน object ไม่ throw** (import ต้องข้ามแค่แถวผิด) |
| 26-29 | ต้องเป็นเลข 4 หลักตาม regex `/^\d{4}$/` |
| 30-37 | ปีที่ใส่ต้อง ≥ ปีที่คำนวณ (จับกรณีพิมพ์ปีเข้าแทนปีจบ) → `{error}` หรือ `{year}` |
| 42-43 | `isBlankYear` — ว่าง/null/undefined/สตริงว่าง = ให้ระบบคำนวณเอง |

---

## `utils/actor.js` (19 บรรทัด)

| บรรทัด | ทำอะไร |
|---|---|
| 6-11 | `ACTOR_SELECT` — field ที่ select ตอนดึง "ผู้ทำรายการ" (id, ชื่อ, นามสกุล, `password_hash` ไว้ดูว่าปิดบัญชีหรือยัง) |
| 15-19 | `toActor(user)` — `null` → null. ตัด `password_hash` ออกด้วย destructuring `{password_hash, ...rest}` แล้วใส่ `is_closed = (hash === null)` — **ห้าม return user ตรง ๆ ไม่งั้น hash หลุด** |

---

## `utils/roundPhase.js` (31 บรรทัด)

| บรรทัด | ทำอะไร |
|---|---|
| 12-17 | `ROUND_PHASE` = `closed / scheduled / active / expired` |
| 19-24 | `getRoundPhase(round, now)` — status ไม่ใช่ open → `closed`; ยังไม่ถึง `open_date` → `scheduled`; เลย `close_date` → `expired`; นอกนั้น `active` |
| 28-31 | `withPhase(round)` แปะ `phase` เข้าก้อนข้อมูล (คำนวณตอนส่งทุกครั้ง เก็บ DB ไม่ได้เพราะเปลี่ยนตามเวลา) |

สูตรต้องตรงกับ `findActive()` ใน `rounds.repository.js`

---

## `utils/roundSubjects.js` (15 บรรทัด)

`subjectsOfRound(round, allSubjects)` — รอบนี้สอบวิชาอะไร: ถ้า `round.subject_ids` มีค่า ใช้ตามนั้น, ว่าง (รอบเก่า) = ทุกวิชา. แล้ว `filter` จาก `allSubjects` จึงเรียงตามลำดับในระบบ ไม่ใช่ลำดับที่เจ้าหน้าที่กด

---

## `utils/xlsxExport.js` (83 บรรทัด)

| บรรทัด | ทำอะไร |
|---|---|
| 19 | import `write-excel-file/node` |
| 25-31 | `safeSheetName` — ลบอักขระต้องห้าม `\ / ? * [ ] :` ตัดให้ ≤ 31 ตัว ว่าง → `"Sheet1"` |
| 33-37 | `toCell` — ว่างเป็น null; `type:"number"` เป็นเลข; นอกนั้นเป็น**ข้อความ** (กัน Excel ตัดเลข 0 หน้าเบอร์โทร) |
| 39-52 | `buildXlsx` — header ตัวหนา+พื้นเทา, body จาก rows ตาม columns, ความกว้างคอลัมน์ (default 16), ตรึงแถวแรก, คืน buffer |
| 56-73 | `buildXlsxWorkbook` — หลายชีตในไฟล์เดียว (logic เหมือน buildXlsx ทีละชีต) |
| 76-83 | `sendXlsx` — ตั้ง header ดาวน์โหลด; `filename="export.xlsx"` สำรอง ASCII + `filename*=UTF-8''...` สำหรับชื่อไทย (RFC 5987) |

---

## `utils/pdfReport.js` (173 บรรทัด)

ชิ้นส่วนสร้างรายงาน PDF ด้วย pdfkit ใช้ร่วมกัน (`dashboard.pdf.js`, `students.pdf.js`)

| บรรทัด | ทำอะไร |
|---|---|
| 6-12 | หาโฟลเดอร์ฟอนต์ Sarabun (ไทย) จากตำแหน่งไฟล์นี้ (`fileURLToPath(import.meta.url)` แทน `__dirname` ที่ ES module ไม่มี) |
| 14-21 | ค่าคงที่ layout: `LEFT=50`, `CONTENT_WIDTH=500`, เนื้อหาหยุดที่ `BOTTOM=770`, เลขหน้าที่ `FOOTER_Y=780`, `TOP=50` |
| 24-27 | `registerThaiFonts` — ลงทะเบียนฟอนต์ไทย (ไม่งั้นตัวอักษรเป็นสี่เหลี่ยม) |
| 34-41 | `fitText` — ข้อความยาวเกินช่อง ตัดท้ายทีละตัวแล้วใส่ `…` จนพอดี (กันตกบรรทัดทับแถวถัดไป) |
| 43-55 | `drawRow` — วาดข้อความทีละคอลัมน์ คำนวณ x ตาม align (left/right/center) |
| 58-67 | `rule` — เส้นคั่นแนวนอน |
| 78-135 | `drawTable` — วาดตาราง: (79-81) ความกว้างรวม/ความสูงแถว; (85-103) `drawGroups` หัวชั้นบนแบบ merge; (105-112) `drawHeader`; (114) วาดหัว; (117-131) วนวาดแต่ละแถว ถ้าที่ไม่พอ (`cursor + ROW_H > BOTTOM`) → `addPage()` + วาดหัวซ้ำ, แถวคู่ใส่สีพื้นอ่อน; (133-134) เส้นปิดท้าย คืนค่า y ล่าสุด |
| 139-143 | `section` — หัวข้อ; ถ้าที่เหลือน้อยขึ้นหน้าใหม่ก่อน |
| 146-160 | `drawSignatureLines` — ช่องลงนาม 2 ช่อง ซ้าย-ขวา |
| 164-173 | `drawPageNumbers` — วนทุกหน้า `switchToPage` เขียน "หน้า X / Y" (ต้องเปิด doc ด้วย `bufferPages: true`) |
