# คู่มือ Backend ฉบับละเอียด

เอกสารนี้อธิบาย backend **ทั้งหมด** ของระบบบันทึกใบประกอบวิชาชีพ: ไฟล์ไหนอยู่ตรงไหน ทำหน้าที่อะไร โค้ดทำงานยังไง คำสั่งไหนใช้ตอนไหน.
เขียนสำหรับคนที่เพิ่งเริ่มเขียนโค้ด — อ่านจากบนลงล่างได้เลย.

**เอกสารพี่น้องกัน**
| ไฟล์ | ใช้ตอนไหน |
|---|---|
| `BACKEND_GUIDE.md` (ไฟล์นี้) | อยากรู้ว่า "โค้ดทำงานยังไง อยู่ตรงไหน" |
| [`SYNTAX_NOTES.md`](SYNTAX_NOTES.md) | อ่านโค้ดไม่ออก ติดสัญลักษณ์แปลกๆ (`...` `?.` `=>`) |
| [`Backend.md`](Backend.md) | แผนงาน phase + รายการ endpoint แบบย่อ |
| [`../CLAUDE.md`](../CLAUDE.md) | ภาพรวมโปรเจกต์ + การแบ่งงานในทีม |

> **กฎการดูแลเอกสารนี้:** แก้โค้ด backend เมื่อไหร่ (เพิ่ม endpoint / เปลี่ยน schema / เปลี่ยน logic / เพิ่มไฟล์) **ต้องอัปเดตไฟล์นี้ในคอมมิตเดียวกัน** และเพิ่มบรรทัดใน [ส่วนที่ 14 Changelog](#14-changelog).

---

## สารบัญ

1. [ภาพรวม — request 1 ครั้งเดินทางยังไง](#1-ภาพรวม--request-1-ครั้งเดินทางยังไง)
2. [คำสั่งทั้งหมดที่ใช้จริง](#2-คำสั่งทั้งหมดที่ใช้จริง)
3. [แผนผังไฟล์ทั้งหมด](#3-แผนผังไฟล์ทั้งหมด)
4. [สถาปัตยกรรม 4 ชั้น](#4-สถาปัตยกรรม-4-ชั้น)
5. [ไฟล์แกนกลาง](#5-ไฟล์แกนกลาง)
6. [Middleware ทุกตัว](#6-middleware-ทุกตัว)
7. [โมดูลทั้ง 10 ตัว](#7-โมดูลทั้ง-10-ตัว)
8. [ฐานข้อมูล](#8-ฐานข้อมูล)
9. [Auth — ระบบล็อกอินทั้งเส้น](#9-auth--ระบบล็อกอินทั้งเส้น)
10. [รูปแบบ response และ error](#10-รูปแบบ-response-และ-error)
11. [ไฟล์อัปโหลด](#11-ไฟล์อัปโหลด)
12. [การทดสอบ](#12-การทดสอบ)
13. [วิธีเพิ่ม endpoint ใหม่ (ทีละขั้น)](#13-วิธีเพิ่ม-endpoint-ใหม่-ทีละขั้น)
14. [Changelog](#14-changelog)

---

## 1. ภาพรวม — request 1 ครั้งเดินทางยังไง

ตัวอย่างจริง: เจ้าหน้าที่กดปุ่ม "ยืนยันผล" บนหน้าเว็บ

```
เบราว์เซอร์
   │  PATCH /api/exam-results/12/approve
   │  Header: Authorization: Bearer eyJhbGci...
   ▼
src/server.js          ← เปิด port รอรับ request
   ▼
src/app.js             ← จับคู่ URL: ขึ้นต้นด้วย /api/exam-results → ส่งให้ examResultsRouter
   ▼
src/middlewares/auth.js         ← authenticate: แกะ JWT ดูว่าใคร ถ้าไม่ผ่าน → 401 จบ
   ▼
src/middlewares/requireRole.js  ← requireRole("officer"): ไม่ใช่เจ้าหน้าที่ → 403 จบ
   ▼
src/modules/examResults/examResults.routes.js    ← ตรงกับ .patch("/:id/approve") → เรียก approve
   ▼
src/modules/examResults/examResults.controller.js ← ตรวจ input, ตัดสินใจ, กำหนด logic
   ▼
src/modules/examResults/examResults.repository.js ← คุย Prisma (ที่เดียวที่แตะ DB ได้)
   ▼
PostgreSQL (ฐานข้อมูล ProjectEnd)
   ▼
ย้อนกลับทางเดิม → res.json({ success: true, data: {...} }) → เบราว์เซอร์
```

ถ้ามี error ตรงไหนก็ตาม controller เรียก `next(err)` → เด้งไป `src/middlewares/errorHandler.js` ตัวเดียว แปลงเป็น JSON แล้วตอบกลับ.

**คำศัพท์ที่ต้องรู้ก่อน**

| คำ | แปลว่า |
|---|---|
| **endpoint** | 1 URL + 1 method (เช่น `GET /api/subjects`) = 1 งานที่ backend ทำได้ |
| **route** | ตารางจับคู่ "URL ไหน → ฟังก์ชันไหน" |
| **middleware** | ฟังก์ชันที่ทำงาน **ก่อน** ถึง controller เช่น ตรวจ token. เรียก `next()` = ผ่านไปตัวถัดไป |
| **controller** | สมองของ endpoint — ตรวจ input, ตัดสินใจ, เลือกเรียก repository |
| **repository** | คนที่คุยกับฐานข้อมูล **ที่เดียวในระบบ** |
| **service** | คำนวณที่ซับซ้อนจนไม่ควรอยู่ใน controller (มีแค่ dashboard) |
| **JWT** | บัตรผ่านที่ backend ออกให้ตอน login. ข้างในเก็บ userId + role |
| **Prisma** | ตัวช่วยคุย PostgreSQL ด้วย JavaScript แทนการเขียน SQL เอง |

---

## 2. คำสั่งทั้งหมดที่ใช้จริง

รันจากโฟลเดอร์ `backend/` ทุกคำสั่ง.

### รันเซิร์ฟเวอร์
```bash
npm start                 # รัน backend (node src/server.js) — ปิดด้วย Ctrl+C
npx nodemon src/server.js # รันแบบ auto restart ทุกครั้งที่แก้ไฟล์ (สะดวกตอนพัฒนา)
```
ขึ้นข้อความ `Environment variables validated` แล้วตามด้วย `Server is running on http://localhost:3000` = สำเร็จ.

### ฐานข้อมูล (Prisma)
```bash
npx prisma migrate status   # DB ตรงกับ schema.prisma ไหม (เช็คก่อนเสมอเวลาสงสัย)
npx prisma migrate dev --name ชื่อสิ่งที่แก้   # แก้ schema.prisma แล้วสร้าง migration ใหม่
npx prisma generate         # สร้าง Prisma Client ใหม่ (ต้องรันหลัง git pull ที่มี schema เปลี่ยน)
npx prisma db seed          # ล้างข้อมูลแล้วใส่ข้อมูลตัวอย่างใหม่ (prisma/seed.js)
npx prisma studio           # เปิดหน้าเว็บดู/แก้ข้อมูลใน DB ที่ localhost:5555
```

> ⚠️ `npx prisma db seed` **ลบข้อมูลทุกตารางทิ้งก่อน** แล้วค่อยใส่ข้อมูลตัวอย่าง — ห้ามรันกับข้อมูลจริงที่ต้องเก็บไว้.

### ตัวฐานข้อมูลเอง (PostgreSQL บน Windows)
DB ติดตั้งเป็น Windows service ชื่อ `postgresql-x64-18` ตั้งค่าให้เปิดเองตอนบูตเครื่อง — ปกติไม่ต้องทำอะไร.
```powershell
Get-Service postgresql-x64-18      # ดูสถานะ (ควรเป็น Running)
Start-Service postgresql-x64-18    # สั่งเปิดถ้าดับอยู่
```

### ทดสอบ
```bash
npx prisma db seed && npm test   # ต้อง seed ใหม่ก่อนเสมอ ไม่งั้นเทสพัง
```

### ตัวแปรลับใน `.env` (ห้าม commit)
| ชื่อ | ใช้ทำอะไร | ขาดแล้วเป็นไง |
|---|---|---|
| `DATABASE_URL` | ที่อยู่ + รหัสผ่าน PostgreSQL | server ไม่ยอมเริ่ม |
| `JWT_SECRET` | กุญแจเซ็น/ตรวจ token | server ไม่ยอมเริ่ม |
| `AES_KEY` | เหลือจากตอนเข้ารหัสข้อมูลสภาการพยาบาล (เลิกใช้แล้ว) | ไม่มีผล |
| `PORT` | port ที่จะรัน (ไม่ใส่ = 3000) | ใช้ 3000 |

ตัวที่บังคับมีกำหนดไว้ที่ `src/config/env.js` → `REQUIRED_VARS`.

---

## 3. แผนผังไฟล์ทั้งหมด

```
backend/
├─ package.json              คำสั่ง npm + รายชื่อ library ที่ใช้
├─ .env                      ค่าลับ (ห้าม commit)
├─ assets/fonts/             ฟอนต์ Sarabun สำหรับสร้าง PDF ภาษาไทย
├─ uploads/                  ไฟล์ที่ผู้ใช้อัปโหลดจริง (certificates/ = PDF, news/ = รูป)
├─ prisma/
│  ├─ schema.prisma          นิยามทุกตารางใน DB ← ต้นทางความจริงของฐานข้อมูล
│  ├─ migrations/            ประวัติการแก้ตาราง เรียงตามเวลา
│  └─ seed.js                สคริปต์ใส่ข้อมูลตัวอย่าง
├─ tests/                    ไฟล์เทสยิง API จริง (.mjs)
└─ src/
   ├─ server.js              เปิด port
   ├─ app.js                 ประกอบ Express + ผูก router ทุกตัว
   ├─ config/
   │  ├─ db.js               สร้าง PrismaClient ตัวกลาง
   │  └─ env.js              ตรวจ .env ครบไหมก่อน server เริ่ม
   ├─ middlewares/
   │  ├─ auth.js             ตรวจ JWT
   │  ├─ requireRole.js      ตรวจสิทธิ์ตาม role
   │  ├─ errorHandler.js     แปลง error เป็น JSON
   │  ├─ rateLimit.js        กันยิงรัวเดารหัส
   │  └─ upload.js           รับไฟล์ PDF / รูปภาพ
   ├─ utils/
   │  └─ roundSubjects.js    ตอบคำถาม "รอบนี้สอบวิชาอะไรบ้าง"
   ├─ controllers/
   │  └─ authController.js   login / ตั้งรหัสครั้งแรก / เปลี่ยนรหัส / ดูข้อมูลตัวเอง
   └─ modules/               1 โฟลเดอร์ = 1 เรื่อง
      ├─ auth/               (มีแค่ routes — controller อยู่ที่ ../controllers)
      ├─ subjects/           รายวิชา
      ├─ users/              บัญชี officer/executive
      ├─ students/           นักศึกษา + import CSV
      ├─ rounds/             รอบการกรอกผลสอบ
      ├─ examResults/        ผลสอบ + การตรวจ
      ├─ certificates/       ไฟล์หลักฐาน PDF
      ├─ news/               ข่าว/ประกาศ
      ├─ dashboard/          สถิติ + รายงาน PDF
      └─ rooms/              ห้องเรียน
```

> **จุดที่ไม่เข้าพวก:** `authController.js` อยู่ที่ `src/controllers/` ไม่ได้อยู่ใน `src/modules/auth/` เหมือนโมดูลอื่น เพราะเขียนไว้ตั้งแต่ก่อนวางโครง modules. ทำงานได้ปกติ แต่ถ้าจะจัดบ้านให้เรียบ ย้ายไป `modules/auth/auth.controller.js` แล้วแก้ path ใน `auth.routes.js` บรรทัดเดียวจบ.

---

## 4. สถาปัตยกรรม 4 ชั้น

ทุกโมดูลใช้โครงเดียวกัน:

```
xxx.routes.js  →  xxx.controller.js  →  (xxx.service.js)  →  xxx.repository.js  →  Prisma → DB
```

| ชั้น | ทำอะไร | **ห้าม**ทำอะไร |
|---|---|---|
| `routes.js` | บอกว่า URL ไหนไปฟังก์ชันไหน + ต่อ middleware | ห้ามมี logic |
| `controller.js` | ตรวจ input, เช็คสิทธิ์ระดับข้อมูล, ตัดสินใจ, ตอบ res | ห้ามเรียก `prisma.` ตรงๆ |
| `service.js` | คำนวณหนักๆ ที่ใช้ซ้ำหลายที่ (มีแค่ dashboard) | ห้ามแตะ `req`/`res` |
| `repository.js` | คุย Prisma เท่านั้น | ห้ามตัดสินใจเชิงธุรกิจ, ห้ามแตะ `req`/`res` |

**ทำไมต้องแบ่ง:** เวลาเปลี่ยนวิธีเก็บข้อมูล แก้แค่ repository. เวลาเปลี่ยนกฎ (เช่น ใครยืนยันผลได้) แก้แค่ controller. ไม่ต้องไล่หาทั้งโปรเจกต์.

**ท่าประจำของ controller ทุกตัว** — จำแค่นี้อ่านออกทั้งโปรเจกต์:
```js
export const ชื่อฟังก์ชัน = async (req, res, next) => {
  try {
    // 1. เอาข้อมูลจาก request
    //    req.body   = ข้อมูลที่ส่งมาใน body (POST/PUT/PATCH)
    //    req.params = ค่าใน URL เช่น /:id  → req.params.id
    //    req.query  = ค่าหลัง ? เช่น ?round_id=3 → req.query.round_id
    //    req.user   = ข้อมูลคนที่ login (auth.js ใส่ให้) — เชื่อถือได้ เพราะมาจาก JWT
    // 2. ตรวจว่าข้อมูลครบ/ถูกต้อง ถ้าไม่ → throw error
    // 3. เรียก repository
    // 4. res.json({ success: true, data: ... })
  } catch (err) {
    next(err);   // โยนให้ errorHandler จัดการที่เดียว
  }
};
```

---

## 5. ไฟล์แกนกลาง

### `src/server.js` (7 บรรทัด)
งานเดียว: เอา app ที่ประกอบเสร็จแล้วมาเปิด port.
```js
const PORT = process.env.PORT || 3000;   // ไม่ตั้ง PORT ใน .env → ใช้ 3000
app.listen(PORT, () => { ... });
```
แยกจาก `app.js` เพราะไฟล์เทสต้อง `import app` มาใช้โดย**ไม่**เปิด port จริง.

### `src/app.js` (50 บรรทัด)
ประกอบ Express ทั้งตัว **ลำดับสำคัญมาก** — Express ทำงานจากบนลงล่าง:

1. `validateEnv()` — เช็ค `.env` ครบก่อน ขาดแล้วพังทันทีตรงนี้ ดีกว่าไปพังกลางทางตอนมีคนใช้
2. `cors({ origin: "http://localhost:5174" })` — อนุญาตให้เว็บ frontend เรียก API ข้าม port ได้
   → **ถ้าเปลี่ยน port ของ frontend ต้องมาแก้บรรทัดนี้ด้วย** ไม่งั้นเบราว์เซอร์บล็อกทุก request
3. `express.json()` — แปลง JSON ใน body ให้เป็น object ใน `req.body` (ไม่มีบรรทัดนี้ `req.body` จะเป็น undefined)
4. `app.use("/api/xxx", xxxRouter)` — ผูก 10 router
5. `app.use(errorHandler)` — **ต้องอยู่ท้ายสุดเสมอ** Express ถือว่า middleware ที่มี 4 พารามิเตอร์ `(err, req, res, next)` คือตัวจัดการ error

**ตารางเส้นทางหลัก**

| URL ขึ้นต้นด้วย | ไปที่ไฟล์ |
|---|---|
| `/api/auth` | `modules/auth/auth.routes.js` |
| `/api/subjects` | `modules/subjects/subjects.routes.js` |
| `/api/users` | `modules/users/users.routes.js` |
| `/api/students` | `modules/students/students.routes.js` |
| `/api/rounds` | `modules/rounds/rounds.routes.js` |
| `/api/exam-results` | `modules/examResults/examResults.routes.js` |
| `/api/news` | `modules/news/news.routes.js` |
| `/api/dashboard` | `modules/dashboard/dashboard.routes.js` |
| `/api/rooms` | `modules/rooms/rooms.routes.js` |
| `/api/certificates` | `modules/certificates/certificates.routes.js` |
| `/api/notifications` | `modules/notifications/notifications.routes.js` |

### `src/config/db.js` (6 บรรทัด)
สร้าง `PrismaClient` ไว้ตัวเดียวแล้ว export ออกไป (singleton) — สร้างหลายตัวจะเปิด connection ซ้ำจนเปลือง.

> **หมายเหตุตามจริง:** ปัจจุบัน repository แต่ละไฟล์เขียน `new PrismaClient()` ของตัวเอง ไม่ได้ import ไฟล์นี้. ระบบยังทำงานปกติเพราะขนาดโปรเจกต์เล็ก แต่ถ้าจะทำให้เรียบร้อยควรเปลี่ยนทุก repository เป็น `import prisma from "../../config/db.js";`

### `src/config/env.js` (12 บรรทัด)
```js
const REQUIRED_VARS = ["DATABASE_URL", "JWT_SECRET"];
const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) throw new Error(`Missing required environment variables: ...`);
```
`process.env` = ตัวแปรจาก `.env` (โหลดด้วย `import "dotenv/config"` บรรทัดแรกของ `app.js`).

### `src/utils/roundSubjects.js` (15 บรรทัด)
ตอบคำถามเดียว: **"รอบนี้สอบวิชาอะไรบ้าง"** — ถูกเรียกจาก 3 ที่ (หน้ากรอกของนักศึกษา, ตอนตรวจผล, dashboard) และทั้ง 3 ที่ต้องได้คำตอบตรงกัน จึงรวมไว้ที่เดียว.

กติกา: `round.subject_ids` ว่าง `[]` = รอบเก่าที่สร้างก่อนมี column นี้ → ถือว่าใช้ทุกวิชา.

---

## 6. Middleware ทุกตัว

### `authenticate` — `src/middlewares/auth.js`
ใช้กับทุก endpoint ที่ไม่ public.

```js
const authHeader = req.headers["authorization"];   // "Bearer eyJhbGci..."
const token = authHeader && authHeader.split(" ")[1];  // ตัดคำว่า Bearer ทิ้ง เอาแต่ token
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = decoded;   // { userId, role, studentId, mustChangePassword }
next();
```
ทำงาน 3 ด่านตามลำดับ:

1. **ตรวจลายเซ็น token** (`jwt.verify`) — ไม่มี token / ผิด / หมดอายุ → **401**. ปลอม token เองไม่ได้เพราะไม่รู้ `JWT_SECRET`
2. **เช็คกับ DB ว่าเจ้าของ token ยังอยู่จริง** — token ถูกต้องไม่ได้แปลว่าเจ้าของยังใช้งานได้
   ```js
   const user = await prisma.user.findUnique({ where: { user_id: decoded.userId }, select: {...} });
   if (!user || !user.password_hash) → 401 "บัญชีนี้ใช้งานไม่ได้แล้ว กรุณาเข้าสู่ระบบใหม่"
   ```
   ปิด 2 เคสที่เกิดจริง:
   - รัน `prisma db seed` ล้าง users แล้วสร้างใหม่ → `user_id` เป็นชุดใหม่ แต่เบราว์เซอร์ยังถือ token เก่า. ถ้าปล่อยผ่าน controller จะเอา id ที่ไม่มีจริงไปเขียน DB แล้วพังเป็น `Foreign key constraint violated` (500 อ่านไม่รู้เรื่อง) แทนที่จะเป็น 401 ที่ frontend เด้งไปหน้า login ได้
   - เจ้าหน้าที่ถูกถอนสิทธิ์ (`POST /api/users/:id/revoke`) แต่ token ใบเก่ายังไม่หมดอายุ → เดิมใช้ได้ต่ออีกถึง 1 วัน ตอนนี้ตัดทันที
3. **ด่าน mustChangePassword** — เป็น true แล้วใช้ได้แค่ `/api/auth/me` กับ `/api/auth/password` (`PASSWORD_SETUP_PATHS`) นอกนั้น **403**

`req.user` ที่ได้ **สร้างจากค่าใน DB ไม่ใช่ค่าที่แช่อยู่ใน token** → เปลี่ยน role ให้ใครแล้วมีผลทันที ไม่ต้องรอ token เก่าหมดอายุ:
```js
req.user = { userId, role, studentId, mustChangePassword };
```

**หลังผ่าน middleware ตัวนี้ controller ใช้ `req.user` ได้ทุกที่** และต้องอ่าน role จากตรงนี้เท่านั้น ห้ามอ่านจาก `req.body`.

> **ต้นทุน:** เพิ่ม query 1 ครั้งต่อ request — ยอมรับได้ในระบบขนาดนี้ และแลกกับความถูกต้องด้านสิทธิ์.

### `requireRole` — `src/middlewares/requireRole.js`
```js
router.post("/", authenticate, requireRole("officer"), create);
//                 ↑ ต้องมาก่อนเสมอ   ↑ รับได้หลาย role: requireRole("officer", "executive")
```
- ยังไม่ login → 401 · role ไม่อยู่ในรายการ → 403
- `(...allowedRoles)` = rest parameter — รับกี่ตัวก็ได้ มัดเป็น array ให้

### `errorHandler` — `src/middlewares/errorHandler.js`
ดักทุก error ที่ controller ส่งมาด้วย `next(err)` แล้วแปลงเป็น JSON รูปแบบเดียวกัน:
```js
const statusCode = err.statusCode || (err.name === "MulterError" ? 400 : 500);
res.status(statusCode).json({ success: false, message });
```
- ไม่ได้ตั้ง `err.statusCode` → กลายเป็น 500 อัตโนมัติ
- error จาก multer (ไฟล์ใหญ่เกิน) ไม่มี statusCode → แปลงเป็น 400
- `...(process.env.NODE_ENV === "development" && { stack: err.stack })` = แนบ stack trace เฉพาะตอน dev (ไม่ปล่อยรายละเอียดภายในให้ผู้ใช้จริงเห็น)

### `rateLimit` — `src/middlewares/rateLimit.js`
กันคนยิงรัวๆ เพื่อเดารหัส. ใช้ที่ `/api/auth/login` (10 ครั้ง/15 นาที) และ `/api/auth/first-setup` (5 ครั้ง/15 นาที).

วิธีทำงาน: เก็บตัวนับไว้ใน `Map` ในหน่วยความจำ แยกตาม `path + student_id` (ไม่ใช่แยกตาม IP อย่างเดียว — คนใช้ Wi-Fi เดียวกันจะได้ไม่โดนบล็อกไปด้วย). เกินโควตา → **429** พร้อมบอกว่าต้องรออีกกี่วินาที.

> **อาการที่ต้องจำ:** รันเทสแล้วเจอ 401/429 รัวๆ ทั้งที่รหัสถูก = โดน rate limit เข้าให้ **แก้โดยรีสตาร์ท server** (ตัวนับอยู่ใน memory รีสตาร์ทแล้วล้างหมด).

### `uploadPdf` / `uploadImage` — `src/middlewares/upload.js`
ดูรายละเอียดที่ [ส่วนที่ 11](#11-ไฟล์อัปโหลด).

---

## 7. โมดูลทั้ง 10 ตัว

สัญลักษณ์ในตาราง: 🔓 = ไม่ต้อง login · 🔑 = ต้อง login · 👤 นักศึกษา · 🧑‍💼 เจ้าหน้าที่ · 👔 ผู้บริหาร

### 7.1 auth — เข้าสู่ระบบ

**ไฟล์:** `modules/auth/auth.routes.js` + `controllers/authController.js`

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| POST | `/api/auth/first-setup` | 🔓 | นักศึกษาตั้งรหัสผ่านครั้งแรก |
| POST | `/api/auth/login` | 🔓 | เข้าสู่ระบบ ได้ token กลับไป |
| GET | `/api/auth/me` | 🔑 | ดูข้อมูลตัวเอง |
| PATCH | `/api/auth/password` | 🔑 | เปลี่ยนรหัสผ่านตัวเอง |

**`firstSetup`** — ยืนยันตัวตนด้วย 3 อย่างพร้อมกัน: `student_id` + `first_name` + `last_name` ต้องตรงกับที่เจ้าหน้าที่ import ไว้เป๊ะ
- ทำไมต้องเช็คชื่อด้วย: รหัสนักศึกษาเรียงเป็นเลขรุ่น เดาง่ายมาก. ชื่อ-สกุลเป็น "รหัสผ่านชั้นที่สอง"
- ข้อความ error ทุกกรณีเหมือนกันหมด (`invalid()`) — ไม่บอกว่าผิดที่ฟิลด์ไหน กันคนไล่เดาทีละช่อง
- ตั้งรหัสไปแล้วมาซ้ำ → **409** ให้ไปติดต่อเจ้าหน้าที่ (ไม่มี self-service reset)
- รหัสผ่านต้อง ≥ 8 ตัว, เก็บด้วย `bcrypt.hash(password, 10)` — **ไม่เคยเก็บรหัสจริงลง DB**

**`login`**
```js
const ok = await bcrypt.compare(password, user.password_hash);  // เทียบรหัสกับ hash
const token = jwt.sign({ userId, role, studentId, mustChangePassword }, JWT_SECRET, { expiresIn: "1d" });
```
- `password_hash` เป็น `null` (ยังไม่เคยตั้งรหัส) → **403** บอกให้ไปตั้งรหัสก่อน
- รหัสผิด หรือไม่มีบัญชีนี้ → **401** ข้อความเดียวกัน ไม่บอกว่าผิดตรงไหน
- token อายุ **1 วัน** — หมดอายุแล้วต้อง login ใหม่
- ข้างใน token มี: `userId`, `role`, `studentId` (null ถ้าไม่ใช่นักศึกษา), `mustChangePassword`

**`changePassword`** — ต้องกรอกรหัสเดิมถูกก่อน + รหัสใหม่ห้ามซ้ำของเดิม. เปลี่ยนเสร็จ token ใบเก่ายังมี `mustChangePassword: true` ค้างอยู่ → **ต้อง login ใหม่**.

### 7.2 subjects — รายวิชา

**ไฟล์:** `modules/subjects/` (routes + controller + repository)

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| GET | `/api/subjects` | 🔑 ทุก role | รายวิชาทั้งหมด |
| POST | `/api/subjects` | 🧑‍💼 | เพิ่มวิชา |
| PUT | `/api/subjects/:id` | 🧑‍💼 | แก้ไขวิชา |
| DELETE | `/api/subjects/:id` | 🧑‍💼 | ลบวิชา |

โมดูลที่ง่ายที่สุดในระบบ — CRUD ตรงๆ ไม่มีกฎพิเศษ. **อ่านไฟล์นี้ก่อนถ้าเพิ่งเริ่มอ่านโค้ด.**

> ชื่อฟังก์ชันสะกดตกหล่นอยู่บ้าง (`updata`, `updatasubject`, `createAll`) — ทำงานถูกต้อง แต่ถ้าจะแก้ชื่อ ต้องแก้ทั้ง repository + controller + routes พร้อมกัน.

### 7.3 rooms — ห้องเรียน

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| GET | `/api/rooms` | 🔓 | รายชื่อห้องทั้งหมด |

public เพราะหน้าสมัคร/ตั้งรหัสครั้งแรกต้องใช้ตอนยังไม่มี token. ข้อมูลไม่มีอะไรอ่อนไหว.

### 7.4 users — บัญชีเจ้าหน้าที่/ผู้บริหาร

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| GET | `/api/users` | 🧑‍💼 | รายชื่อผู้ใช้ทั้งหมด |
| POST | `/api/users` | 🧑‍💼 | สร้างบัญชี officer/executive |
| POST | `/api/users/:id/role` | 🧑‍💼 | เปลี่ยน role |
| POST | `/api/users/:id/revoke` | 🧑‍💼 | ถอนสิทธิ์ |

**กฎสำคัญ**
- สร้างได้แค่ `officer` / `executive` (`CREATABLE_ROLES`) — บัญชีนักศึกษาต้องมาทาง import CSV เท่านั้น
- บัญชีที่สร้างจะถูกตั้ง `must_change_password: true` เสมอ — เจ้าหน้าที่ตั้งรหัสให้ เจ้าตัวต้องเปลี่ยนตอน login ครั้งแรก
- **ห้ามเปลี่ยน role / ถอนสิทธิ์ตัวเอง** (เช็ค `targetId === req.user.userId`) — กันเจ้าหน้าที่ล็อกตัวเองออกจากระบบจนไม่มีใครเข้าได้
- **ถอนสิทธิ์ ≠ ลบบัญชี**: `revokeAccess` แค่ล้าง `password_hash` เป็น null → login ไม่ได้ แต่ประวัติที่คนนี้เคยยืนยัน/โพสต์ยังอยู่ครบ (ลบ record จริงจะทำให้ foreign key พัง)
- `PUBLIC_USER_FIELDS` ใน repository = รายการ field ที่ส่งออกได้ **ไม่มี `password_hash`** — ใช้ `select` แทน `include` เพื่อให้ column ใหม่ที่เพิ่มทีหลังไม่หลุดออกไปเอง

### 7.5 students — นักศึกษา

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| GET | `/api/students` | 🧑‍💼 👔 | รายชื่อนักศึกษาทั้งหมด |
| GET | `/api/students/:id` | 🔑 | ดูรายคน (นักศึกษาดูได้แค่ตัวเอง) |
| POST | `/api/students` | 🧑‍💼 | เพิ่มทีละคน |
| PATCH | `/api/students/bulk-eligible` | 🧑‍💼 | เปิด/ปิดสิทธิ์กรอกผลสอบหลายคนพร้อมกัน |
| POST | `/api/students/import` | 🧑‍💼 | import CSV |
| POST | `/api/students/:id/reset-password` | 🧑‍💼 | ล้างรหัสผ่านให้ไปตั้งใหม่ |

**`getById` — เช็คสิทธิ์ระดับข้อมูล** (`requireRole` ทำแทนไม่ได้):
```js
if (req.user.role === "student" && req.user.studentId !== req.params.id) → 403
```

**`bulkImport` — import CSV** ส่วนที่ซับซ้อนที่สุดในโมดูลนี้:

1. **เดา encoding** — ไฟล์ CSV ภาษาไทยมาได้หลายแบบตามโปรแกรมที่เซฟ
   ```js
   try   { csvText = new TextDecoder("utf-8", { fatal: true }).decode(req.file.buffer); }
   catch { csvText = iconv.decode(req.file.buffer, "win874"); }   // ภาษาไทยแบบเก่าของ Excel
   ```
   `fatal: true` = ถ้าไม่ใช่ UTF-8 จริงให้ throw ออกมา เราจะได้รู้ว่าต้องถอดแบบ win874 แทน
2. **แปลง text → array of object** ด้วย `csv-parse` (`columns: true` = ใช้แถวแรกเป็นชื่อคอลัมน์)
3. **เช็ค header ครบก่อนวนลูป** — คอลัมน์ที่ต้องมี: `student_id, first_name, last_name, email, phone, room_name, academic_year`
4. **วนทีละแถว ไม่ใช้ transaction เดียวรวมไฟล์** — ไฟล์ 500 แถวจะได้ไม่พังทั้งไฟล์เพราะแถวเดียวผิด
   แถวที่ข้าม เก็บเหตุผลไว้ใน `skipped` แล้วรายงานกลับพร้อมเลขแถวที่ตรงกับที่เห็นใน Excel (`rowNum = i + 2`)
5. **ผลลัพธ์:** `{ imported_count, skipped_count, imported, skipped }`

นักศึกษาที่ import เข้ามาจะได้ `password_hash: null` — เข้าระบบครั้งแรกผ่าน `/api/auth/first-setup` เท่านั้น.

**`exam_eligible` — ประตูสำคัญ:** นักศึกษากรอกผลสอบไม่ได้จนกว่าเจ้าหน้าที่จะเปิดสิทธิ์ให้ผ่าน `bulk-eligible`. ค่าเริ่มต้นเป็น `false` เสมอ.

### 7.6 rounds — รอบการกรอกผลสอบ

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| GET | `/api/rounds/active` | 👤 | รอบที่เปิดอยู่ของรุ่นตัวเอง + วิชาที่ต้องกรอก |
| GET | `/api/rounds` | 🔑 | รอบทั้งหมด (ใหม่→เก่า) |
| POST | `/api/rounds` | 🧑‍💼 | สร้างรอบ |
| PUT | `/api/rounds/:id` | 🧑‍💼 | แก้ไขรอบ |
| DELETE | `/api/rounds/:id` | 🧑‍💼 | ลบรอบ |

> **ลำดับใน routes สำคัญ:** `/active` ต้องประกาศ**ก่อน** `/:id` ไม่งั้น Express จะอ่านคำว่า "active" เป็นค่า id.

**`getActive`** ผ่าน 3 ด่าน: มี student profile → `exam_eligible` เป็น true → มีรอบเปิดของ `academic_year` ตัวเอง
ตอบกลับ: field ของ round + `subjects[]` (แต่ละวิชามี `already_passed`) + `all_passed`

**`findActive` ในrepository** — เงื่อนไข "รอบเปิดอยู่จริง" มี 4 ข้อพร้อมกัน:
```js
status: "open"  และ  open_date <= ตอนนี้  และ  close_date >= ตอนนี้  และ  academic_year ตรงกับรุ่นนักศึกษา
```
ข้อสุดท้ายสำคัญ: รอบเป็นของ**รุ่นใดรุ่นหนึ่ง** ไม่ใช่รอบกลางของทั้งระบบ.

**`create` / `update`**
- `subject_ids` ต้องผ่าน `validateSubjectIds`: ต้องเป็น array ไม่ว่าง, เป็นจำนวนเต็มบวก, **ห้ามซ้ำ**, และต้องมีอยู่จริงใน DB
  (ต้องเช็คเองเพราะ `Int[]` ใน Postgres ไม่มี foreign key คอยกันให้)
- ไม่ส่ง `subject_ids` มาเลย = ใช้ทุกวิชาในระบบ
- วันที่ผ่าน `parseDate` — `new Date("อะไรก็ไม่รู้")` ได้ `Invalid Date` ซึ่งดูเหมือน Date ปกติแต่พังตอนลง DB จึงต้องเช็ค `isNaN(date.getTime())` ก่อน
- `created_by: req.user.userId` — เอาจาก JWT เท่านั้น ไม่เชื่อ body
- **รอบที่ `status === "open"` แล้ว ห้ามแก้รายวิชา** — นักศึกษาอาจกรอกไปแล้วตามรายการเดิม ต้องปิดรอบก่อน

**`remove`** ลบได้เฉพาะรอบที่ยังไม่มีใครใช้ เช็ค 3 อย่าง: ไม่ได้เปิดอยู่ → ไม่มีผลสอบผูก → ไม่มีประกาศผูก (foreign key กันให้อยู่แล้ว แต่ error ดิบอ่านไม่รู้เรื่อง จึงเช็คเองเพื่อบอกสาเหตุชัดๆ)

### 7.7 examResults — ผลสอบ ⭐ หัวใจของระบบ

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| POST | `/api/exam-results` | 👤 | ส่ง/แก้ผลสอบของรอบที่เปิดอยู่ |
| GET | `/api/exam-results/me` | 👤 | ประวัติของตัวเอง |
| POST | `/api/exam-results/:id/certificates` | 👤 | แนบ PDF |
| GET | `/api/exam-results` | 🧑‍💼 👔 | ดูทั้งหมด (กรองได้) |
| PATCH | `/api/exam-results/:id/approve` | 🧑‍💼 | ยืนยันผล |
| PATCH | `/api/exam-results/:id/reject` | 🧑‍💼 | ตีกลับ (ต้องมี remark) |

**สถานะ 2 ชุด แยกกันคนละเรื่อง**
```js
STUDENT_STATUS = { DRAFT: "draft", SUBMITTED: "submitted" }          // นักศึกษาส่งหรือยัง
STAFF_STATUS   = { PENDING: "pending", APPROVED: "approved", REJECTED: "rejected" }  // เจ้าหน้าที่ตรวจถึงไหน
```
ปัจจุบันสร้าง record เฉพาะตอนกดส่งจริง → `student_status` เป็น `"submitted"` เสมอ (ยังไม่มีฟีเจอร์บันทึกร่าง).

**`create` — 8 ด่านตามลำดับ**
1. `subject_results` ต้องเป็น array ไม่ว่าง
2. ต้องมี student profile
3. `exam_eligible` ต้องเป็น true → ไม่งั้น **403**
4. ต้องมีรอบเปิดของรุ่นตัวเอง (`findActive(student.academic_year)`) — **หารอบจากรุ่นตั้งแต่ต้น กรอกข้ามรุ่นจึงเป็นไปไม่ได้**
5. **หน้าต่างแก้ไข** — ถ้าใบของรอบนี้ `staff_status = approved` → **409** ล็อก. นอกนั้น (`pending` / `rejected`) ส่งทับได้เรื่อยๆ (`isRedo`). รอบปิดไม่ต้องเช็คตรงนี้ เพราะด่าน 4 คืน null ไปแล้ว → **400**
6. ทุก `subject_id` ที่ส่งมาต้องอยู่ในรอบนี้ · `is_passed` ต้องเป็น boolean แท้ๆ (string `"false"` จะกลายเป็น true) · ห้ามส่งวิชาซ้ำ
7. ต้องกรอกครบทุกวิชาที่ยังไม่เคยผ่าน (`mustAnswer = วิชาของรอบ − วิชาที่เคยผ่าน`)
8. บันทึก

**carry-forward (วิชาที่เคยผ่านแล้ว)** — จุดที่พลาดง่ายที่สุดในระบบ:
```js
const passedIds = await examRepo.findPassedSubjectIds(
  student.student_id,
  round.round_id,   // ⚠️ ต้องส่งเสมอ
);

const finalResults = roundSubjectIds.map((id) => ({
  subject_id: id,
  is_passed: passedIds.includes(id) ? true : answers.get(id),
  carried_forward: passedIds.includes(id),
}));
```
เก็บครบทุกวิชาของรอบเสมอ. วิชาที่เคยผ่านบันทึกเป็น `true` ให้เลย **ไม่เชื่อค่าที่ client ส่งมา** — กันคนแก้ผลที่ผ่านไปแล้วให้กลายเป็นไม่ผ่าน.

> ⚠️ **`findPassedSubjectIds(student_id, excludeRoundId)` ต้องส่ง `excludeRoundId` เสมอ** = รอบที่กำลังกรอกอยู่.
> ฟังก์ชันนี้กวาดทุก `exam_result` ของนักศึกษา ถ้าไม่ตัดรอบปัจจุบันออก ใบของรอบนี้เองที่ถูกตีกลับ
> จะย้อนมาล็อกวิชาที่ตัวเองเพิ่งติ๊กผ่านเป็น "ผ่านแล้วจากรอบก่อน" แล้วแก้ไม่ได้.
> เรียกจาก 2 ที่: `examResults.controller.js` (`create`) และ `rounds.controller.js` (`getActive`) — ต้องส่งทั้งคู่ ไม่งั้น `already_passed` ที่หน้าเว็บเห็นจะไม่ตรงกับที่ backend ตรวจ.

`carried_forward: true` แปลว่า **ไม่ได้สอบวิชานี้ในรอบนี้ ยกผลผ่านมาจากรอบก่อน**.
dashboard นับอัตราผ่านรายวิชาเฉพาะแถวที่เป็น `false` (คนที่สอบจริง) แต่ "ผ่านครบทุกวิชา" นับทั้งหมด.

**`resubmitWithSubjects`** (ส่งทับใบเดิม) — ลบผลรายวิชาชุดเดิมทิ้งทั้งชุด ใส่ชุดใหม่ แล้ว**ล้าง `remark` + `confirmed_by` + `confirmed_at`** พร้อมตั้ง `staff_status` กลับเป็น `pending` ไม่งั้นใบที่แก้แล้วยังติดเหตุผลตีกลับรอบก่อนค้างอยู่.

**`getAll`** รับ query 3 ตัว: `?round_id=` `?staff_status=` `?student_id=` (ผสมกันได้) เรียงจาก `submitted_at` ใหม่→เก่า.
> ⚠️ **ไม่ส่ง `round_id` = ได้ผลสอบทุกรอบทุกปีปนกัน** นักศึกษา 1 คนมีได้หลายใบ. ฝั่งหน้าเว็บต้องระบุรอบเสมอ ไม่งั้นตัวเลขจะไม่ตรงกับ dashboard ที่นับรอบเดียว.

**`approve` / `reject`** ใช้ฟังก์ชันเดียวกัน (`reviewExamResult`) ต่างแค่ค่าสถานะกับ "บังคับมี remark ไหม". บันทึก `confirmed_by` จาก JWT + `confirmed_at` เป็นเวลาปัจจุบัน.

### 7.8 certificates — ไฟล์หลักฐาน

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| POST | `/api/exam-results/:id/certificates` | 👤 | อัปโหลด PDF (อยู่ใน routes ของ examResults) |
| GET | `/api/certificates/:id/file` | 🔑 | เปิด/ดาวน์โหลดไฟล์ |

- `certificate_type` ต้องเป็น `exam_result` (ใบผลสอบ) หรือ `license` (ใบประกอบวิชาชีพ) เท่านั้น
- **ownership:** อัปโหลดใส่ผลสอบของคนอื่นไม่ได้ (`examResult.student_id !== req.user.studentId` → 403)
- validate ไม่ผ่าน → `discard(req.file)` **ลบไฟล์ที่เพิ่งเขียนลง disk ทิ้ง** ไม่ให้มีขยะค้าง
- ชื่อไฟล์ภาษาไทย: multer อ่านมาเป็น latin1 ต้องแปลงกลับ `Buffer.from(name, "latin1").toString("utf8")` ไม่งั้นชื่อเพี้ยน
- path เก็บเป็น `/` เสมอ (`.split(path.sep).join("/")`) ไม่ผูกกับ `\` ของ Windows

### 7.9 notifications — แจ้งเตือนนักศึกษา

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| GET | `/api/notifications/me` | 👤 | แจ้งเตือนของตัวเอง 50 อันล่าสุด ใหม่→เก่า |
| PATCH | `/api/notifications/read-all` | 👤 | mark ว่าอ่านแล้วทั้งหมด |
| PATCH | `/api/notifications/:id/read` | 👤 | mark อันเดียว |

- **ทุก route ต้องมี `requireRole("student")`** — ไม่ใช่แค่ `authenticate`. role อื่นไม่มี `req.user.studentId` แล้ว Prisma จะมองว่า `student_id: undefined` = "ไม่ต้องกรอง" (ไม่ใช่ "หาไม่เจอ") → เห็นแจ้งเตือนของทุกคน / mark อ่านทั้งระบบ. `notifications.repository.js` มี `requireStudentId()` กันไว้อีกชั้น
- ไม่มี endpoint ให้สร้างแจ้งเตือน — โมดูลอื่นเรียก `notifRepo.create()` / `createMany()` เอง
- คนที่ยิงแจ้งเตือนตอนนี้:
  - `examResults.controller.js` → เจ้าหน้าที่ approve/reject ผลสอบ (`type: "approved" | "rejected"`)
  - `student.controller.js` → `bulkSetEligible` ตอน **เปิด** สิทธิ์เท่านั้น (`type: "eligible"`) ปิดสิทธิ์ไม่แจ้ง
- ยิงแบบ fire-and-forget (`.catch(console.error)`) — แจ้งเตือนพลาดต้องไม่ทำให้ approve/reject ล้มไปด้วย
- `markRead` ใช้ `updateMany` ที่ where ด้วย `student_id` เสมอ — เดา `notification_id` ถูกก็ mark ของคนอื่นไม่ได้
- **`serveFile` เช็คสิทธิ์ก่อนส่งไฟล์เสมอ:** เจ้าของ หรือ officer/executive เท่านั้น — ไฟล์ไม่ได้เปิด public ให้เดา id เอา

### 7.9 news — ข่าว/ประกาศ

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| GET | `/api/news` | 🔑 | ข่าวทั้งหมด (ใหม่→เก่า) |
| POST | `/api/news` | 🧑‍💼 | โพสต์ |
| PUT | `/api/news/:id` | 🧑‍💼 | แก้ไข |
| DELETE | `/api/news/:id` | 🧑‍💼 | ลบ |
| GET | `/api/news/:id/image` | 🔑 | ดูรูป |
| POST | `/api/news/:id/image` | 🧑‍💼 | แนบ/เปลี่ยนรูป |
| DELETE | `/api/news/:id/image` | 🧑‍💼 | เอารูปออก |

- ต้องมี `title` + `content` + `round_id` ครบ. `posted_by` มาจาก JWT
- **1 ประกาศ = 1 รูป** เปลี่ยนรูปใหม่ → ลบไฟล์เก่าที่ disk ทิ้งทันที. ลบประกาศ → ลบรูปตามไปด้วย (`removeImageFile`) ไม่ให้เหลือไฟล์กำพร้า
- `update` ใช้ท่า partial update: ส่ง field ไหนมาก็แก้เฉพาะ field นั้น
  ```js
  if (title !== undefined) data.title = title;   // เช็ค !== undefined ไม่ใช่ if (title)
  ```
  ต้องเช็คแบบนี้เพราะค่าว่าง `""` ก็ถือว่า "ส่งมาแล้ว" ควรแก้ให้

### 7.10 dashboard — สถิติ + รายงาน

**โมดูลเดียวที่มี `service.js`** เพราะการคำนวณซับซ้อนพอที่จะแยกออกมา และใช้ซ้ำทั้งหน้าเว็บกับ PDF.

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| GET | `/api/dashboard/stats?round_id=` | 🧑‍💼 👔 | สถิติของ 1 รอบ |
| GET | `/api/dashboard/history?years=3` | 🧑‍💼 👔 | สรุปย้อนหลังรายปี |
| GET | `/api/dashboard/export?round_id=` | 🧑‍💼 | โหลดรายงาน PDF |

**`buildStats(roundId)`** — ไม่ส่ง `round_id` มา จะใช้ `findDefaultRound()` = รอบที่เปิดอยู่ ถ้าไม่มีก็รอบล่าสุด

ค่าที่คำนวณและความหมาย:

| field | หมายถึง | สูตร |
|---|---|---|
| `total` | นักศึกษาทั้งรุ่น | นับจาก `academic_year` ของรอบ |
| `eligible` | คนที่เปิดสิทธิ์กรอกแล้ว | `exam_eligible = true` |
| `by` | แยกตามสถานะ | `{ draft, submitted, approved, rejected }` |
| `not_started` | ยังไม่กรอกเลย | `eligible − จำนวนใบในรอบ` |
| `fillRate` | % คนที่ส่งแล้ว | `submitted / eligible` ← **หารด้วย eligible ไม่ใช่ total** |
| `fullyPassed` | คนที่ผ่านครบทุกวิชาของรอบ | เทียบทีละ `subject_id` ไม่ใช่นับจำนวน |
| `fullyPassedRate` | % ผ่านครบ (รายคน) | `fullyPassed / submitted` |
| `subjectPassRate` | % ผลรายวิชาที่ผ่าน (รายวิชา) | ผลรวม pass ÷ ผลรวมทั้งหมด |
| `perSubject` | ผ่าน/ไม่ผ่าน แยกรายวิชา | นับเฉพาะคนที่**สอบวิชานั้นจริงในรอบนี้** (`carried_forward = false`) |

> `fullyPassedRate` (รายคน) กับ `subjectPassRate` (รายวิชา) **คนละตัวกัน** — 20 คนสอบ 8 วิชา ผ่านคนละ 7 วิชา จะได้ subjectPassRate 87.5% แต่ fullyPassedRate 0%.

**2 กติกาที่ต้องไม่ลืม:**

1. **สถิติทุกตัวนับเฉพาะนักศึกษาที่ `exam_eligible = true`** — `findResultsByRound` กรองที่ repository เลย
   รับประกันว่า `by.approved + by.submitted + by.rejected + by.draft + not_started === eligible` เสมอ
   (ถ้าไม่กรอง คนที่ส่งแล้วโดนปิดสิทธิ์ทีหลังจะทำให้ผลรวมเกิน `eligible` แล้ว `Math.max` ใน `not_started` ตัดเป็น 0 → วง donut กับตัวเลขตรงกลางไม่ตรงกัน)

2. **`perSubject[].rate` เป็น `null` ได้** เมื่อไม่มีใครสอบวิชานั้นจริงในรอบ (ทุกคนยกผลผ่านมาจากรอบก่อน)
   `null` = "ไม่มีข้อมูล" คนละเรื่องกับ `0` = "สอบแล้วตกหมด" — หน้าเว็บต้องแสดง `—` ไม่ใช่ 0%
   `subjectPassRate` ก็ข้ามวิชาพวกนี้ ไม่เอามาเป็นตัวหาร
   `fullyPassed` **ไม่**ตัด carry-forward ออก เพราะผ่านวิชานั้นตั้งแต่รอบก่อนก็นับว่าผ่านครบจริง

**`buildHistory(yearCount)`** — สรุปรายปีย้อนหลัง (ค่าเริ่มต้น 3 ปี, จำกัด 1–10 ที่ controller)
**นับเป็น "รายคน" ไม่ใช่ "รายใบ"** ด้วย `Set` ของ `student_id` — คนที่กรอก 2 รอบในปีเดียวต้องนับครั้งเดียว ไม่งั้นตัวเลขเกินจำนวนคนที่มีจริง.

**`dashboard.pdf.js`** — สร้าง PDF ด้วย pdfkit แล้ว `doc.pipe(res)` ส่งเป็น stream ตรงถึงเบราว์เซอร์ ไม่เขียนไฟล์ลง disk.
ต้อง `registerFont` ฟอนต์ Sarabun จาก `assets/fonts/` ไม่งั้นภาษาไทยกลายเป็นสี่เหลี่ยม □□□.

---

## 8. ฐานข้อมูล

### ตารางทั้งหมด (12 model ใน `prisma/schema.prisma`)

| model | ตารางจริง | เก็บอะไร |
|---|---|---|
| `Role` | `roles` | 3 บทบาท: student / officer / executive |
| `User` | `users` | ทุกคนที่เข้าระบบได้ + `password_hash` |
| `Faculty` | `faculties` | คณะ (ตอนนี้มีแค่คณะพยาบาลศาสตร์) |
| `Room` | `rooms` | ห้องเรียนปกติ / ห้องเรียนอังกฤษ |
| `Student` | `students` | ข้อมูลนักศึกษา + `exam_eligible` |
| `Subject` | `subjects` | รายวิชา 8 วิชา |
| `SubmissionRound` | `submission_rounds` | รอบการกรอก + `subject_ids` |
| `ExamResult` | `exam_results` | 1 ใบ = 1 คน 1 รอบ |
| `SubjectResult` | `subject_results` | ผ่าน/ไม่ผ่าน รายวิชา + `carried_forward` (ยกผลมาจากรอบก่อน ไม่ได้สอบรอบนี้) |
| `Certificate` | `certificates` | ไฟล์หลักฐาน (เก็บแค่ path) |
| `News` | `news` | ข่าว/ประกาศ |
| `Notification` | `notifications` | แจ้งเตือนรายคน (`type` = `approved` / `rejected` / `eligible`) |
| `Session` | `sessions` | มีตารางแต่ยังไม่ได้ใช้ (auth ใช้ JWT ล้วน) |

`@@map("users")` = ชื่อ model ใน JS คือ `User` แต่ชื่อตารางจริงใน DB คือ `users`.

### ความสัมพันธ์

```
Role ──1:M── User ──1:0..1── Student ──1:M── ExamResult ──1:M── SubjectResult ──M:1── Subject
                                │                  │
                          Faculty, Room            └──1:M── Certificate

SubmissionRound ──1:M── ExamResult
SubmissionRound ──1:M── News ──M:1── User (poster)
User ──1:M── ExamResult (confirmer, ผ่าน confirmed_by)
User ──1:M── SubmissionRound (creator, ผ่าน created_by)
```

- `User → Student` เป็น **1 ต่อ 0-หรือ-1**: officer/executive ไม่มี student profile → `user.student` เป็น `null` (นี่คือเหตุผลที่ต้องใช้ `user.student?.student_id`)
- `Student.student_id` เป็น **String** (รหัสนักศึกษา) และเป็น primary key เอง — ไม่ใช่เลข auto increment
- ระบบตั้งให้ `student_id` = `psu_passport_id` ของ user คนนั้น
- `User` มี 2 relation ไป `ExamResult` และ `SubmissionRound` จึงต้องตั้งชื่อ relation (`"UserToExamResult"`, `"UserToRound"`) ให้ Prisma แยกออก

### field ที่มีกฎพิเศษ

| field | ค่า | ความหมาย |
|---|---|---|
| `users.password_hash` | `null` | ยังไม่เคยตั้งรหัส → login ไม่ได้ ต้องไป first-setup |
| `users.must_change_password` | `true` | ใช้ระบบไม่ได้จนกว่าจะตั้งรหัสใหม่ (ด่านอยู่ใน `auth.js`) |
| `students.exam_eligible` | `false` (ค่าเริ่มต้น) | กรอกผลสอบไม่ได้จนเจ้าหน้าที่เปิดให้ |
| `submission_rounds.status` | `"open"` / `"closed"` | ต้องเป็น open **และ** อยู่ในช่วงวันที่ ถึงจะกรอกได้ |
| `submission_rounds.subject_ids` | `[]` | รอบเก่าก่อนมี column นี้ = ใช้ทุกวิชา |
| `exam_results.student_status` | `draft` / `submitted` | ตอนนี้เป็น submitted เสมอ |
| `exam_results.staff_status` | `pending` / `approved` / `rejected` | สถานะการตรวจ |
| `certificates.file_path` | เช่น `uploads/certificates/1712-999.pdf` | **เก็บแค่ path ห้ามเก็บ binary ลง DB** |

### migration (ประวัติการแก้ตาราง)

7 migration เรียงตามเวลา — อ่านแล้วเห็นว่าระบบเปลี่ยนอะไรมาบ้าง:

| migration | เพิ่ม/แก้อะไร |
|---|---|
| `20260709175349_project_end` | สร้างตารางทั้งหมดครั้งแรก |
| `20260710151958_add_sessions_table` | เพิ่มตาราง sessions |
| `20260719122910_add_exam_eligible` | เพิ่ม `students.exam_eligible` |
| `20260722001256_remove_nursing_council_credentials` | เอาข้อมูลสภาการพยาบาลออก (เลิกใช้) |
| `20260722223556_add_local_password_auth` | เพิ่ม `password_hash` + `must_change_password` (ย้ายจาก PSU SSO มา login เอง) |
| `20260801135930_add_round_subject_ids` | เพิ่ม `submission_rounds.subject_ids` |
| `20260803092859_add_news_image_path` | เพิ่ม `news.image_path` |

**ขั้นตอนแก้ตาราง**: แก้ `prisma/schema.prisma` → `npx prisma migrate dev --name อธิบายสั้นๆ` → Prisma สร้างโฟลเดอร์ migration ใหม่ + อัปเดต DB + สร้าง client ใหม่ให้อัตโนมัติ.
**ห้ามแก้ไฟล์ใน `migrations/` ที่รันไปแล้วด้วยมือ** — DB กับประวัติจะไม่ตรงกัน.

### `prisma/seed.js` — ข้อมูลตัวอย่าง

ลำดับ: ลบข้อมูลเก่าทุกตาราง (เรียงจากตารางลูกไปแม่ ไม่งั้น foreign key ขวาง) → 3 roles → คณะ + 2 ห้อง → 3 users → student profile → 8 รายวิชา

บัญชีทดสอบ (รหัสผ่าน = รหัสผู้ใช้ตัวเอง, ข้ามการบังคับเปลี่ยนรหัส):

| role | psu_passport_id | รหัสผ่าน |
|---|---|---|
| student | `6610210631` | `6610210631` |
| officer | `456` | `456` |
| executive | `789` | `789` |

### `prisma/demoSeed.js` — ข้อมูลชุดใหญ่สำหรับเดโม

รัน: `npm run demo:seed`

ต่างจาก `seed.js` ตรงที่ **ไม่แตะ** roles / faculties / rooms / subjects / บัญชี officer+executive — ของพวกนี้ต้องมีอยู่ใน DB ก่อน (ไม่งั้น script โยน error บอกว่าขาดอะไร). รันซ้ำได้ ตอนเริ่มจะลบเฉพาะนักศึกษาเดโม 20 คน + ผลสอบของคนพวกนั้นทิ้งก่อน.

ใส่ให้: นักศึกษา 20 คน (2567 = 7, 2568 = 7, 2569 = 6, `exam_eligible = true` ทุกคน) → 5 รอบสอบ (`status = "closed"` ทั้งหมด) → ผลสอบ 27 ใบ **`staff_status = "approved"` ทุกใบ** → certificate 5 ไฟล์ (ชี้ PDF ที่มีจริงใน `uploads/certificates/`) → ข่าว 2 ชิ้น.

เคสที่ครอบไว้ให้เดโม:
- ผ่านครบ 8 วิชารอบเดียว
- ตก 1 / 2 / 3 วิชา
- รอบแก้ตัวที่ `subject_ids` เป็น subset (สอบไม่ครบ 8 วิชา) + แถวที่ `carried_forward = true`
- สอบแก้ตัวแล้วผ่าน กับ สอบแก้ตัวแล้วยังตก
- ปีที่มี 2 รอบ (2567, 2568) กับปีที่มีรอบเดียว (2569)

รหัสผ่านนักศึกษาเดโม = `student_id` ตัวเอง, `must_change_password = false`.

---

## 9. Auth — ระบบล็อกอินทั้งเส้น

> **เดิมแผนใช้ PSU One Passport** แต่ขอ credential จากมหาวิทยาลัยไม่ได้ จึงทำระบบ login เองด้วย bcrypt + JWT.

### เส้นทางของนักศึกษาคนหนึ่ง

```
1. เจ้าหน้าที่ import CSV
      → users: password_hash = null, must_change_password = true
      → students: exam_eligible = false

2. นักศึกษาเข้าเว็บครั้งแรก → POST /api/auth/first-setup
      ส่ง student_id + first_name + last_name + password ใหม่
      → ถูกทั้ง 3 อย่าง: เก็บ bcrypt hash, must_change_password = false

3. POST /api/auth/login  → ได้ token (อายุ 1 วัน)

4. ทุก request ถัดไปแนบ header:  Authorization: Bearer <token>

5. เจ้าหน้าที่เปิดสิทธิ์ให้ (PATCH /api/students/bulk-eligible)
      → exam_eligible = true → ถึงจะกรอกผลสอบได้
```

### สำหรับ officer/executive
เจ้าหน้าที่สร้างบัญชีให้ (`POST /api/users`) พร้อมตั้งรหัสชั่วคราว → `must_change_password: true` → login ครั้งแรกใช้งานอะไรไม่ได้จนกว่าจะ `PATCH /api/auth/password` → เปลี่ยนเสร็จต้อง login ใหม่เพื่อรับ token ที่ไม่มีธงบังคับแล้ว.

### กติกาความปลอดภัยที่ต้องรักษาไว้
1. **role อ่านจาก JWT เท่านั้น** — ห้ามเชื่อ role ที่ client ส่งมาใน body
2. `JWT_SECRET` / `DATABASE_URL` อยู่ใน `.env` เท่านั้น **ห้าม commit**
3. ทุก endpoint ที่ไม่ public ต้องมี `authenticate` **ก่อน** `requireRole`
4. `password_hash` ห้ามหลุดออก response — ใช้ `select` ที่ระบุ field ชัดเจน (`PUBLIC_USER_FIELDS`)
5. ข้อความ error ตอน login/first-setup ต้องเหมือนกันทุกกรณี ไม่บอกว่าผิดตรงไหน
6. เจ้าของข้อมูล (ownership) ต้องเช็คใน controller — `requireRole` บอกได้แค่ "เป็นนักศึกษา" ไม่ได้บอกว่า "เป็นนักศึกษาคนนี้"

---

## 10. รูปแบบ response และ error

### สำเร็จ
```json
{ "success": true, "data": { ... } }
```
`data` เป็น object / array / `null` ก็ได้. **ข้อยกเว้น:** `POST /api/auth/login` ตอบรูปแบบเก่า (`{ message, token, user }`) ไม่มี `success` — frontend ผูกกับรูปแบบนี้อยู่ ถ้าจะแก้ต้องแก้พร้อมกันทั้งสองฝั่ง.

### ผิดพลาด
```json
{ "success": false, "message": "ข้อความภาษาไทยที่ผู้ใช้อ่านรู้เรื่อง" }
```

### รหัสสถานะที่ใช้

| รหัส | ความหมาย | ตัวอย่างในระบบ |
|---|---|---|
| 200 | สำเร็จ | ทั่วไป |
| 201 | สร้างสำเร็จ | สร้าง user, import CSV, ตั้งรหัสครั้งแรก |
| 400 | ข้อมูลที่ส่งมาไม่ถูกต้อง | กรอกไม่ครบ, วันที่ผิด, วิชาซ้ำ |
| 401 | ยังไม่ login / token พัง | ไม่มี token, รหัสผ่านผิด |
| 403 | login แล้วแต่ไม่มีสิทธิ์ | นักศึกษาเรียก endpoint ของเจ้าหน้าที่, ยังไม่ `exam_eligible` |
| 404 | ไม่พบข้อมูล | ไม่พบผลสอบ/ประกาศ/นักศึกษา |
| 409 | ชนกับของที่มีอยู่แล้ว | กรอกรอบนี้ไปแล้ว, รหัสผู้ใช้ซ้ำ |
| 429 | ยิงถี่เกิน | โดน rate limit |
| 500 | server พังเอง | error ที่ไม่ได้ตั้ง statusCode |

### วิธีสร้าง error ในโค้ด
```js
// แบบ helper (โมดูลใหม่ๆ ใช้แบบนี้ — สั้นกว่า)
const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};
throw httpError("ไม่พบผลสอบที่ระบุ", 404);

// แบบเขียนเต็ม (โมดูลเก่าใช้แบบนี้ ผลเหมือนกัน)
const err = new Error("ไม่พบผู้ใช้");
err.statusCode = 404;
throw err;
```
`throw` ข้างใน `try` → ตกลง `catch` → `next(err)` → `errorHandler` ตอบ JSON ให้. **ไม่ต้อง `res.status(...).json(...)` เองในกรณี error.**

---

## 11. ไฟล์อัปโหลด

ใช้ library **multer**. หลักการ: **ไฟล์จริงอยู่ที่ disk, DB เก็บแค่ path**

| ชนิด | middleware | โฟลเดอร์ | ชนิดที่รับ | ขนาดสูงสุด |
|---|---|---|---|---|
| หลักฐาน PDF | `uploadPdf` | `uploads/certificates/` | `application/pdf` เท่านั้น | 10 MB |
| รูปประกอบข่าว | `uploadImage` | `uploads/news/` | JPG, PNG, WebP, GIF | 5 MB |
| CSV รายชื่อ | `multer.memoryStorage()` | **ไม่เขียน disk** | ทุกชนิด | 5 MB |

CSV ใช้ memoryStorage เพราะอ่านครั้งเดียวแล้วทิ้ง ไม่ต้องเก็บ — ได้ที่ `req.file.buffer`.

**การตั้งชื่อไฟล์** — ไม่ใช้ชื่อเดิมที่ผู้ใช้ส่งมาเด็ดขาด:
```js
const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
cb(null, `${unique}.pdf`);
```
กัน 2 เรื่อง: ชื่อซ้ำทับกัน, และ **path traversal** (ชื่อไฟล์แบบ `../../.env` เขียนทับไฟล์สำคัญ). ชื่อจริงที่ผู้ใช้ตั้งเก็บแยกไว้ที่ column `file_name` ไว้แสดงผลเท่านั้น.

**ต่อ middleware ใน route แบบนี้:**
```js
router.post("/:id/certificates", authenticate, requireRole("student"),
  uploadPdf.single("file"),   // "file" = ชื่อ field ในฟอร์ม ต้องตรงกับที่ frontend ส่ง
  uploadCertificate);
```
หลังผ่าน multer → ข้อมูลไฟล์อยู่ที่ `req.file` (`.path`, `.originalname`, `.mimetype`, `.buffer`)

---

## 12. การทดสอบ

ไฟล์เทสอยู่ที่ `tests/*.mjs` — เป็น **smoke test** ยิง API จริงผ่าน HTTP ไม่ใช่ unit test.

```bash
npx prisma db seed && npm test
```

| ไฟล์ | ครอบคลุม |
|---|---|
| `smoke-phase1-3.mjs` | auth, subjects, users |
| `smoke-phase4-6.mjs` | students, rounds, exam results |
| `smoke-phase9-import.mjs` | import CSV |
| `smoke-phase10-round-subjects.mjs` | รอบที่เลือกเฉพาะบางวิชา |
| `smoke-phase11-carry-forward.mjs` | วิชาที่เคยผ่านแล้วไม่ต้องกรอกซ้ำ |

**ต้องรัน server ค้างไว้ก่อน** แล้วค่อยรันเทสอีกหน้าต่าง.

### 3 ปัญหาที่เจอบ่อย
1. **ไม่ seed ใหม่ก่อนรัน** → เทสพังเพราะข้อมูลจากรอบก่อนค้างอยู่ (เช่น `students คืน 1 คน → 6`, หรือ "กรอกรอบนี้ไปแล้ว" 409)
2. **เจอ 401/429 รัวๆ ทั้งที่รหัสถูก** → โดน rate limiter ของ login (10 ครั้ง/15 นาที) **แก้โดยรีสตาร์ท server** ตัวนับอยู่ใน memory
3. **seed แล้วหน้าเว็บพัง 401 "บัญชีนี้ใช้งานไม่ได้แล้ว"** → ถูกต้องแล้ว. seed สร้าง `user_id` ชุดใหม่ token เก่าจึงใช้ไม่ได้ — **logout แล้ว login ใหม่** (หรือลบ token ใน Local Storage)

---

## 13. วิธีเพิ่ม endpoint ใหม่ (ทีละขั้น)

ตัวอย่าง: อยากได้ `GET /api/subjects/:id` ดูรายวิชาทีละตัว

**ขั้น 1 — repository** (`modules/subjects/subjects.repository.js`)
```js
export const findById = (id) =>
  prisma.subject.findUnique({ where: { subject_id: Number(id) } });
```
> `Number(id)` สำคัญ: ค่าจาก URL เป็น string เสมอ แต่ column เป็น Int

**ขั้น 2 — controller** (`modules/subjects/subjects.controller.js`)
```js
export const getById = async (req, res, next) => {
  try {
    const subject = await subjectrepo.findById(req.params.id);
    if (!subject) {
      const err = new Error("ไม่พบรายวิชา");
      err.statusCode = 404;
      throw err;
    }
    res.json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
};
```

**ขั้น 3 — routes** (`modules/subjects/subjects.routes.js`)
```js
import { getAll, getById, ... } from "./subjects.controller.js";
router.get("/:id", authenticate, getById);
```
> ระวังลำดับ: route แบบตายตัว (`/active`, `/me`, `/bulk-eligible`) ต้องอยู่**ก่อน** `/:id` เสมอ

**ขั้น 4 — ทดสอบ** ใช้ `test.http` / `requests.http` (VS Code REST Client) หรือ:
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/subjects/1
```

**ขั้น 5 — อัปเดตเอกสาร**
- เพิ่มแถวในตาราง endpoint ของโมดูลนั้นในไฟล์นี้ ([ส่วนที่ 7](#7-โมดูลทั้ง-10-ตัว))
- เพิ่มบรรทัดใน [Changelog](#14-changelog)
- ถ้ารูปร่าง response เปลี่ยน → **แจ้งฝั่ง frontend ก่อน** (กติกาใน `CLAUDE.md`)

### เพิ่มโมดูลใหม่ทั้งก้อน
1. สร้าง `src/modules/ชื่อ/` แล้วทำ 3 ไฟล์: `ชื่อ.routes.js`, `ชื่อ.controller.js`, `ชื่อ.repository.js`
2. เพิ่ม `import` + `app.use("/api/ชื่อ", ชื่อRouter)` ใน `src/app.js`
3. เพิ่มหัวข้อ 7.x ในไฟล์นี้

---

## 14. Changelog

บันทึกทุกครั้งที่ backend เปลี่ยน — บรรทัดเดียวพอ: `วันที่ — สิ่งที่เปลี่ยน (ไฟล์ที่แตะ)`

| วันที่ | เปลี่ยนอะไร |
|---|---|
| 2026-08-09 | merge `feature/update-app` เข้า main — รวมงานของแก้มเข้ากับ reject-flow ที่ main ทำไว้ |
| 2026-08-09 | เพิ่มโมดูล `notifications` + ตาราง `notifications` — แจ้งเตือนนักศึกษาตอนเจ้าหน้าที่ approve/reject และตอนเปิดสิทธิ์กรอก (migration `add_notifications`, `modules/notifications/*`, `examResults.controller.js`, `student.controller.js`, `app.js`) |
| 2026-08-09 | **แก้ช่องโหว่:** `/api/notifications/*` เดิมมีแค่ `authenticate` — officer/executive เรียกได้แล้วเห็น/แก้แจ้งเตือนของนักศึกษาทุกคน (เพราะ `student_id: undefined` = Prisma ไม่กรอง). เพิ่ม `requireRole("student")` + `requireStudentId()` ใน repository (`notifications.routes.js`, `notifications.repository.js`) |
| 2026-08-09 | `findPassedSubjectIds` ไม่นับใบที่ `staff_status = "rejected"` — ใบรอบก่อนที่โดนตีกลับไม่ล็อกวิชาในรอบถัดไปอีก (ใช้ร่วมกับ `excludeRoundId` เดิม). ส่วน `pending` ยังนับ ไม่งั้นเปิดรอบถัดไปก่อนตรวจเสร็จ นักศึกษาต้องกรอกวิชาที่เพิ่งผ่านซ้ำ (`examResults.repository.js`) |
| 2026-08-09 | dashboard อัตราผ่านรายวิชาใช้กฎเดียวกัน — ตัดเฉพาะใบที่ถูกตีกลับ (`notRejected`) ไม่ใช่เอาเฉพาะ approved ที่ทำให้กราฟว่างจนกว่าเจ้าหน้าที่จะตรวจครบ. เพิ่ม `perSubject` ใน `/dashboard/history` สำหรับกราฟย้อนหลัง (`dashboard.service.js`) |
| 2026-08-09 | `open_date` / `close_date` ตีความเป็นเวลาไทย (UTC+7) เสมอ ไม่ขึ้นกับ timezone ของ server — `parseThaiDateTime()` รับได้ทั้ง `"2026-08-09"` และ `"2026-08-09T14:30"`. ไม่ระบุเวลา: เปิดรับ = 00:00, ปิดรับ = 23:59:59.999. **ห้ามใช้ `setHours()`** เพราะใช้ timezone ของเครื่อง (`rounds.controller.js`) |
| 2026-08-09 | ลบรอบได้ถ้าเลย `close_date` แล้ว แม้ `status` จะยังเป็น `"open"` — `status` ไม่ auto ปิดตัวเอง (`rounds.controller.js`) |
| 2026-08-09 | แก้รหัส/ชื่อวิชา 8 วิชาให้ตรงหลักสูตรจริง `NUR01–08` → `1101–1108` + สคริปต์ `scripts/update-subjects.js` สำหรับ migrate ข้อมูลเดิม (`prisma/seed.js`) |
| 2026-08-04 | dashboard นับเฉพาะนักศึกษาที่ `exam_eligible` — สัดส่วนใน donut รวมได้เท่าตัวเลขกลางเสมอ (`dashboard.repository.js`) |
| 2026-08-04 | เพิ่ม `subject_results.carried_forward` — อัตราผ่านรายวิชานับเฉพาะคนที่สอบจริง วิชาที่ไม่มีผู้สอบคืน `rate: null` (migration `add_carried_forward_to_subject_results`, `dashboard.service.js`) |
| 2026-08-04 | นักศึกษาแก้ผลสอบทับได้จนกว่าเจ้าหน้าที่จะยืนยันหรือรอบปิด (เดิมส่งได้ครั้งเดียว) (`examResults.controller.js`) |
| 2026-08-04 | `findPassedSubjectIds` รับ `excludeRoundId` — ใบที่ถูกตีกลับไม่ล็อกวิชาของตัวเองอีก แก้ได้ครบทุกวิชา (`examResults.repository.js`, `examResults.controller.js`, `rounds.controller.js`) |
| 2026-08-04 | `authenticate` เช็คกับ DB ว่า user ยังอยู่/ยังไม่ถูกถอนสิทธิ์ และสร้าง `req.user` จาก DB แทนค่าใน token — แก้ 500 `Foreign key constraint violated: submission_rounds_created_by_fkey` ตอนใช้ token ค้างหลัง seed ให้เป็น 401 แทน (`middlewares/auth.js`) |
| 2026-08-04 | เพิ่ม `prisma/demoSeed.js` + npm script `demo:seed` — ข้อมูลเดโม 20 นักศึกษา 3 ปีการศึกษา ยืนยันครบทุกใบ (ไม่แตะ subjects/roles/officer/executive) |
| 2026-08-04 | สร้างเอกสารนี้ครั้งแรก ครอบคลุม backend ทั้งหมด ณ commit `46a266a` |
| 2026-08-03 | เพิ่ม `news.image_path` — แนบรูปในประกาศได้ (migration `add_news_image_path`, `news.controller.js`, `upload.js`) |
| 2026-08-01 | เพิ่ม `submission_rounds.subject_ids` — รอบเลือกได้ว่าสอบวิชาไหนบ้าง (migration `add_round_subject_ids`, `utils/roundSubjects.js`) |
| 2026-07-22 | ย้ายจาก PSU SSO มา login เอง — เพิ่ม `password_hash`, `must_change_password`, first-setup flow (migration `add_local_password_auth`) |
| 2026-07-19 | เพิ่ม `students.exam_eligible` — เจ้าหน้าที่เปิดสิทธิ์กรอกผลสอบให้ทีละคน/ทีละรุ่น |
