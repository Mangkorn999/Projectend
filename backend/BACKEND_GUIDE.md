# คู่มือ Backend ฉบับละเอียด

เอกสารนี้อธิบาย backend **ทั้งหมด** ของระบบบันทึกใบอนุญาตประกอบวิชาชีพ: ไฟล์ไหนอยู่ตรงไหน ทำหน้าที่อะไร โค้ดทำงานยังไง คำสั่งไหนใช้ตอนไหน.
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
   │  Cookie: token=eyJhbGci...   ← httpOnly cookie เบราว์เซอร์แนบมาเอง
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
| **JWT** | บัตรผ่านที่ backend ออกให้ตอน login. ข้างในเก็บ userId + role. เก็บไว้ใน httpOnly cookie |
| **httpOnly cookie** | cookie ที่ JavaScript ในหน้าเว็บอ่านไม่ได้ มีแต่เบราว์เซอร์กับ server ที่เห็น — กัน XSS ขโมย token |
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
npm run test:clean   # แนะนำ — สร้าง schema ชั่วคราวใหม่ รันครบ 11 ไฟล์ แล้วลบทิ้ง ไม่แตะข้อมูล demo
```
`npm test` แบบเดิมยังมีอยู่ แต่ยิงใส่ DB ตัวที่ใช้อยู่จริง ต้อง `npx prisma db seed` ก่อนเสมอ
และจะ fail หลายตัวถ้า DB มีข้อมูล demo ค้าง (ดูหัวข้อ 12).

### ตัวแปรลับใน `.env` (ห้าม commit)
| ชื่อ | ใช้ทำอะไร | ขาดแล้วเป็นไง |
|---|---|---|
| `DATABASE_URL` | ที่อยู่ + รหัสผ่าน PostgreSQL | server ไม่ยอมเริ่ม |
| `JWT_SECRET` | กุญแจเซ็น/ตรวจ token | server ไม่ยอมเริ่ม |
| `CORS_ORIGIN` | URL ของ frontend ที่ยิงเข้ามาได้ (คั่น comma ได้หลายอัน) | server ไม่ยอมเริ่ม |
| `COOKIE_SECURE` | `"true"` เมื่อเว็บเป็น HTTPS / `"false"` ตอน dev บน http | server ไม่ยอมเริ่ม |
| `AES_KEY` | เหลือจากตอนเข้ารหัสข้อมูลสภาการพยาบาล (เลิกใช้แล้ว) | ไม่มีผล |
| `PORT` | port ที่จะรัน (ไม่ใส่ = 3000) | ใช้ 3000 |
| `NODE_ENV` | `"development"` = ส่ง stack trace กลับไปด้วยตอน error | ไม่ส่ง stack |

ตัวที่บังคับมีกำหนดไว้ที่ `src/config/env.js` → `REQUIRED_VARS`.
**คัดลอกค่าเริ่มต้นได้จาก `backend/.env.example`** (`cp .env.example .env` แล้วแก้ค่า).

⚠️ `COOKIE_SECURE="true"` ตอนเว็บยังเป็น http จะ **login ไม่ติด** — browser ไม่ยอมส่ง cookie ที่ secure ผ่าน http

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
   │  ├─ actor.js            ชื่อ "ผู้ดำเนินการ" (ผู้สร้างรอบ/ผู้โพสต์ข่าว/ผู้ตรวจ) + is_closed ตัด hash ก่อนส่งออก
   │  ├─ supabaseMirror.js   คัดลอกข้อมูลทั้งฐาน local -> Supabase อัตโนมัติหลังมีการเขียนข้อมูล (ปิดถ้าไม่ตั้ง SUPABASE_DATABASE_URL)
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
2. `cors({ origin: "http://localhost:5174", credentials: true })` — อนุญาตให้เว็บ frontend เรียก API ข้าม port ได้
   → **ถ้าเปลี่ยน port ของ frontend ต้องมาแก้บรรทัดนี้ด้วย** ไม่งั้นเบราว์เซอร์บล็อกทุก request
   → `credentials: true` จำเป็นสำหรับ cookie: ถ้าไม่มี เบราว์เซอร์จะไม่ส่ง cookie ข้าม origin ให้เลย และต้องระบุ origin เป็น URL จริง **ห้ามใช้ `*`**
3. `express.json()` — แปลง JSON ใน body ให้เป็น object ใน `req.body` (ไม่มีบรรทัดนี้ `req.body` จะเป็น undefined)
4. `cookieParser()` — อ่าน cookie ที่เบราว์เซอร์ส่งมาใส่ไว้ที่ `req.cookies`
   → **ต้องอยู่ก่อน router ทุกตัว** ไม่งั้น `req.cookies` เป็น undefined แล้ว `authenticate` หา token ไม่เจอ = 401 ทุก request
5. `app.use("/api/xxx", xxxRouter)` — ผูก 11 router
6. `app.use(errorHandler)` — **ต้องอยู่ท้ายสุดเสมอ** Express ถือว่า middleware ที่มี 4 พารามิเตอร์ `(err, req, res, next)` คือตัวจัดการ error

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

### `src/config/env.js`
```js
const REQUIRED_VARS = ["DATABASE_URL", "JWT_SECRET", "CORS_ORIGIN", "COOKIE_SECURE"];
const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) throw new Error(`Missing required environment variables: ...`);
// COOKIE_SECURE รับแค่ "true"/"false" — พิมพ์ผิดเป็น "True"/"1" จะกลายเป็น false เงียบๆ
if (!["true", "false"].includes(process.env.COOKIE_SECURE)) throw new Error(...);
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
// token อยู่ใน httpOnly cookie ชื่อ "token" — เบราว์เซอร์แนบมาให้เองทุก request
let token = null;
if (req.cookies) {
  token = req.cookies.token;
}
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

### `uploadEvidence` / `uploadImage` — `src/middlewares/upload.js`
ดูรายละเอียดที่ [ส่วนที่ 11](#11-ไฟล์อัปโหลด).

---

## 7. โมดูลทั้ง 10 ตัว

สัญลักษณ์ในตาราง: 🔓 = ไม่ต้อง login · 🔑 = ต้อง login · 👤 นักศึกษา · 🧑‍💼 เจ้าหน้าที่ · 👔 ผู้บริหาร · 🔍 เจ้าหน้าที่ตรวจสอบ (reviewer)

### 7.1 auth — เข้าสู่ระบบ

**ไฟล์:** `modules/auth/auth.routes.js` + `controllers/authController.js`

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| POST | `/api/auth/first-setup` | 🔓 | นักศึกษาตั้งรหัสผ่านครั้งแรก |
| POST | `/api/auth/login` | 🔓 | เข้าสู่ระบบ — ตั้ง httpOnly cookie ชื่อ `token` ให้ |
| POST | `/api/auth/logout` | 🔓 | ออกจากระบบ — สั่งลบ cookie |
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
- **ไม่ส่ง token กลับใน JSON body** — ส่งลง cookie ด้วย `res.cookie("token", token, TOKEN_COOKIE_OPTIONS)`

**`TOKEN_COOKIE_OPTIONS`** (บนสุดของ `authController.js`) — ต้องใช้ชุดเดียวกันทั้งตอนตั้งและตอนลบ ถ้าไม่ตรงกันเบราว์เซอร์ถือว่าเป็น cookie คนละใบแล้วลบไม่ออก

| ตัวเลือก | ค่า | ทำไม |
|---|---|---|
| `httpOnly` | `true` | JavaScript ในหน้าเว็บอ่านไม่ได้ → XSS ขโมย token ไปไม่ได้ (นี่คือเหตุผลหลักที่ย้ายมาจาก localStorage) |
| `secure` | `false` | dev ยังเป็น http ธรรมดา — **ขึ้น production (HTTPS) ต้องเปลี่ยนเป็น `true`** |
| `sameSite` | `"lax"` | เว็บอื่นยิง request ข้ามเว็บมา เบราว์เซอร์ไม่แนบ cookie ให้ = กัน CSRF |
| `path` | `"/"` | ใช้ได้ทุก path |
| `maxAge` | `86400000` (1 วัน) | ต้องเท่ากับ `expiresIn` ของ JWT ไม่งั้น cookie ค้างแต่ token หมดอายุ |

**`logout`** — `res.clearCookie("token", TOKEN_COOKIE_OPTIONS)` แล้วตอบ 200
- **ไม่ผ่าน `authenticate`** เพราะ token หมดอายุ/พังแล้วก็ยังต้องกด logout ให้ cookie หลุดได้
- เดิมไม่มี endpoint นี้ (frontend ลบ localStorage เองได้) แต่ httpOnly cookie ฝั่ง JS แตะไม่ได้ ต้องให้ server สั่งลบเท่านั้น
- **ข้อจำกัดที่ต้องรู้:** JWT เป็น stateless — logout ลบแค่ cookie ในเบราว์เซอร์ ตัว token ยังใช้ได้จนหมดอายุถ้ามีใครก๊อปไว้. ด่านที่ปิดช่องนี้จริงคือด่าน 2 ของ `authenticate` (เช็ค DB ทุก request) ถ้าจะ revoke แบบตรงๆ ต้องเอาตาราง `sessions` มาใช้ (ยังไม่ทำ)

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
| POST | `/api/users` | 🧑‍💼 | สร้างบัญชี officer/executive/reviewer (executive ไม่ต้องส่ง email/phone) |
| POST | `/api/users/:id/role` | 🧑‍💼 | เปลี่ยน role (เปลี่ยนตัวเองไม่ได้ → 400) · หน้าเว็บมีปุ่ม "เปลี่ยนบทบาท" · `GET /api/users` คืน `creator` (ใครสร้างบัญชี) + `closer`/`closed_at` (ใครปิด เมื่อไหร่) |
| POST | `/api/users/:id/revoke` | 🧑‍💼 | ปิดบัญชี/ถอนสิทธิ์ (ล็อก ไม่ลบ record) · บันทึก `closed_at` + `closed_by` |
| POST | `/api/users/:id/reset-password` | 🧑‍💼 | รีเซ็ตรหัสให้ไปตั้งใหม่เอง · ถ้าบัญชีเคยถูกปิด = เปิดคืน (ล้าง `closed_at` / `closed_by`) |
| DELETE | `/api/users/:id` | 🧑‍💼 | ลบบัญชีจริง (เฉพาะบัญชีที่ไม่เคยมีประวัติผูกไว้) |

**กฎสำคัญ**
- สร้างได้แค่ `officer` / `executive` / `reviewer` (`CREATABLE_ROLES` ใน `users.controller.js`) — บัญชีนักศึกษาต้องมาทาง import CSV เท่านั้น
- **`password` ไม่บังคับตอนสร้าง** — ไม่ส่งมา = `password_hash: null` เจ้าตัวไปตั้งรหัสเองที่ `POST /api/auth/first-setup` (flow เดียวกับนักศึกษาที่ import เข้ามา) เจ้าหน้าที่จึงไม่เคยรู้รหัสของใคร
- `reset-password` ใช้กลไกเดียวกับ `revoke` (ล้าง `password_hash`) ต่างกันที่เจตนา — reset = ลืมรหัส ตั้งใหม่ได้, revoke = ไม่ให้ใช้งานต่อ
- **ห้ามเปลี่ยน role / ถอนสิทธิ์ / ลบบัญชีตัวเอง** (เช็ค `targetId === req.user.userId` ทั้ง 3 endpoint) — กันเจ้าหน้าที่ล็อกตัวเองออกจากระบบจนไม่มีใครเข้าได้
- **ถอนสิทธิ์ ≠ ลบบัญชี**: `revokeAccess` แค่ล้าง `password_hash` เป็น null → login ไม่ได้ แต่ประวัติที่คนนี้เคยยืนยัน/โพสต์ยังอยู่ครบ. `DELETE /api/users/:id` (`UserRepo.remove`) ลบ record จริงไม่ตั้ง `onDelete: Cascade` ที่ไหนเลย — บัญชีที่เคยสร้างรอบ/โพสต์ข่าว/ยืนยันผลสอบ (`created_rounds`, `news`, `confirmed_exams`, `review_logs`) ลบไม่ได้ **เช็คก่อนลบเสมอด้วย `UserRepo.countLinkedHistory()`** (นับ `submission_rounds`+`news`+`review_logs`) แล้ว throw 409 เอง — ห้ามพึ่ง Prisma แปลง FK error เป็น `P2003` ให้ เพราะทุก FK ในระบบนี้ประกาศเป็น `ON DELETE RESTRICT` ซึ่ง Postgres ตอบ SQLSTATE `23001` ไม่ใช่ `23503` ที่ Prisma รู้จัก (พังจริงมาแล้ว: หลุดเป็น 500 พร้อม raw SQL error message ทั้งชื่อ table/constraint) catch ท้าย controller เป็นแค่ fallback กันเคส race condition — ใช้ได้จริงกับบัญชีที่สร้างผิด/ซ้ำแล้วยังไม่เคยใช้งานอะไรเลยเท่านั้น
- `PUBLIC_USER_FIELDS` ใน repository = รายการ field ที่ส่งออกได้ **ไม่มี `password_hash`** — ใช้ `select` แทน `include` เพื่อให้ column ใหม่ที่เพิ่มทีหลังไม่หลุดออกไปเอง

### 7.5 students — นักศึกษา

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| GET | `/api/students` | 🧑‍💼 🔍 | รายชื่อนักศึกษาทั้งหมด (reviewer ใช้ทำแท็บ "ยังไม่กรอก" ในคิวตรวจ) |
| GET | `/api/students/subject-result-list` | 🧑‍💼 | รายชื่อคนที่ผ่าน/ไม่ผ่านวิชาหนึ่ง (JSON) — query: `subject_code`, `passed=true\|false`, และ `round_id` (รอบเดียว) **หรือ** `year` (รวมทั้งปี) |
| GET | `/api/students/export-subject` | 🧑‍💼 | รายการเดียวกันเป็นไฟล์ (query เหมือนข้างบน + `format=pdf\|xlsx` — ไม่ส่ง = PDF เหมือนเดิม) — ต้องอยู่ก่อน `/:id` ใน routes เสมอ |
| POST | `/api/students/export` | 🧑‍💼 | ข้อมูลนักศึกษาเป็น Excel — body `{ student_ids: [...] }` (รายชื่อที่กรองอยู่บนหน้าจอ, 1–5000 รหัส) หรือ `{ year: 2569 }` (ทั้งรุ่น) + ส่ง `by_round: true` ได้เพื่อให้ได้ Excel หลายชีต (ชีตแรกข้อมูลนักศึกษา + 1 ชีตต่อรอบสอบ) **ไม่มีเลขบัตรประชาชน/password_hash ในไฟล์** — ต้องอยู่ก่อน `/:id` |
| GET | `/api/students/:id` | 🧑‍💼 👤 🔍 | ดูรายคน (นักศึกษาดูได้แค่ตัวเอง) — เพิ่ม `academic_year_derived` + `exam_result_count` ให้ด้วย (คำนวณตอนส่งออก ไม่ใช่คอลัมน์ใน DB) |
| POST | `/api/students` | 🧑‍💼 | เพิ่มทีละคน — body: `student_id`, `national_id`, `academic_year` (ไม่บังคับ — ปีจบถ้าซ้ำชั้น/ลาพัก) |
| PATCH | `/api/students/:id` | 🧑‍💼 | แก้ข้อมูลรายคน — **เปลี่ยน `academic_year` ได้เฉพาะคนที่ยังไม่มีผลสอบ** (มีแล้วตอบ 400) |
| PATCH | `/api/students/bulk-eligible` | 🧑‍💼 | เปิด/ปิดสิทธิ์กรอกผลสอบหลายคนพร้อมกัน |
| POST | `/api/students/import` | 🧑‍💼 | import **Excel (.xlsx) หรือ CSV** (ดูจากเนื้อไฟล์ ไม่ใช่นามสกุล; .xlsx อ่านชีตแรก เลข 13 หลักที่เป็น Number ในเซลล์อ่านครบทุกหลัก — CSV จาก Excel เลขหาย `1.23E+12`) — คอลัมน์บังคับ `student_id, national_id` + `academic_year` ไม่บังคับ · `?dry_run=true` = ตรวจไฟล์อย่างเดียวไม่บันทึก (ตอบ 200) · ผลมี `year_overrides` = คนที่ปีไม่ตรงกับรหัส |
| POST | `/api/students/:id/reset-password` | 🧑‍💼 | ล้างรหัสผ่านให้ไปตั้งใหม่ |
| DELETE | `/api/students/:id` | 🧑‍💼 | **ลบนักศึกษาพร้อมทุกอย่างที่ผูกอยู่** (ผลสอบ, ผลรายวิชา, เอกสาร PDF + ไฟล์บน disk, ประวัติตรวจ, แจ้งเตือน, บัญชี) — ลบได้ทุกกรณี รวมคนที่มีผลสอบแล้ว แต่ถ้ามีผลสอบต้องส่ง `?delete_results=true` ไม่งั้นตอบ `409 { code: "has_exam_results", students_with_results, result_count }` (กันคลิก/ยิง API พลาด). ตอบ `{ message, deleted_result_count }` |
| POST | `/api/students/bulk-delete` | 🧑‍💼 | **ลบนักศึกษาหลายคน** body `{ student_ids: [...] (≤1000), delete_results?: true }` — กติกาเดียวกับลบทีละคน (มีคนมีผลสอบปนต้องส่ง `delete_results: true` เป็น boolean จริง ไม่งั้น 409 และ **ไม่ลบใครเลย** ไม่ลบครึ่งๆ) ตอบ `{ deleted_count, deleted_ids, deleted_result_count, not_found_count }`; ไม่เจอใครเลย = 404; ทำใน transaction เดียว |
| GET | `/api/students/pending-accounts` | 🧑‍💼 | **บัญชีที่ import แล้วยังไม่กรอกโปรไฟล์** (มีแค่ `users` ไม่มีแถว `students` — ไม่อยู่ใน `GET /students`) พร้อม `academic_year` ที่จะใช้ + `year_overridden` + `imported_at` |
| POST | `/api/students/pending-accounts/delete` | 🧑‍💼 | ลบบัญชีกลุ่มนั้น body `{ student_ids: [...] }` (≤1000) — `where` กันไว้ในตัว: เฉพาะ role นักศึกษาที่ยังไม่มี `students` คนที่กรอกโปรไฟล์แล้วไม่ถูกแตะ; ตอบ `{ deleted_count, skipped_count }`, ไม่มีอะไรลบได้ = 404 |

> **`academic_year` = รุ่น และเป็นตัวตัดสินว่านักศึกษาเห็นรอบไหน** — `GET /api/rounds/active` หารอบที่ `academic_year` ตรงกับของนักศึกษาเท่านั้น
> ค่าถูกตั้งตอนนักศึกษากรอกโปรไฟล์ครั้งแรก: ใช้ `users.import_academic_year` (ปีที่เจ้าหน้าที่ระบุตอน import/เพิ่มทีละคน) ถ้ามี ไม่งั้นคำนวณด้วย `calcGraduationYear` (2 หลักแรกของรหัส + 4) ซึ่ง**ผิดสำหรับคนซ้ำชั้น/ลาพัก**
> ทางหลักคือใส่ปีตั้งแต่ตอน import — แก้ทีหลังผ่าน `PATCH /api/students/:id` ได้ (เช่นลาพักหลัง import)
> ทุกช่องทางตรวจปีด้วย `validateGraduationYear` (`utils/academicYear.js`): ต้องเป็น พ.ศ. 4 หลัก และ**ไม่น้อยกว่าปีตามรหัส** (จับเคสพิมพ์ปีที่เข้าแทนปีที่จบ)
> แก้ได้เฉพาะตอนยังไม่มีผลสอบ เพราะใบผลสอบผูกกับ `round_id` ไม่ได้ผูกกับรุ่น — ย้ายทีหลังตัวหารลดแต่ตัวตั้งเท่าเดิม สถิติรุ่นเดิมทะลุ 100%

> **executive เข้าไม่ได้ทั้ง 2 เส้น** — ผู้บริหารดูได้แค่ภาพรวมที่ `/api/dashboard/stats|history` ไม่เห็นข้อมูลนักศึกษารายบุคคล

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
| GET | `/api/rounds/active` | 👤 | รอบที่นักศึกษา**ส่งผลได้ตอนนี้** (`findSubmittableRound`) — ถ้าไม่มี ใช้รอบ `status=open` ของรุ่นตัวเอง (**รวมรอบที่ยังไม่ถึงวันเปิด/เลยวันปิด** — ดู `phase` ว่ากรอกได้จริงไหม) + วิชาที่ต้องกรอก + **`can_fix_rejected`** (true = รอบปิดแล้วแต่ใบถูกตีกลับ แก้ส่งใหม่ได้ แม้ `phase` จะเป็น closed/expired) · ไม่มีรอบเลย = `null` |
| GET | `/api/rounds` | 🔑 | รอบทั้งหมด (ใหม่→เก่า) + `creator` (ผู้สร้างรอบ: `user_id, first_name, last_name, is_closed`) — **นักศึกษาไม่ได้ `creator`** (ตัดใน controller ตาม role ใน JWT) |
| POST | `/api/rounds` | 🧑‍💼 | สร้างรอบ — `status` (ถ้าส่งมา) ต้องเป็น `"open"` หรือ `"closed"` เท่านั้น ค่าอื่น → 400 |
| PUT | `/api/rounds/:id` | 🧑‍💼 | แก้ไขรอบ — `status` ต้องเป็น `"open"` หรือ `"closed"` เท่านั้น ค่าอื่น → 400 (ตรวจด้วย `ensureValidStatus`) |
| DELETE | `/api/rounds/:id` | 🧑‍💼 | ลบรอบ |

> **ลำดับใน routes สำคัญ:** `/active` ต้องประกาศ**ก่อน** `/:id` ไม่งั้น Express จะอ่านคำว่า "active" เป็นค่า id.

**`getActive`** ผ่าน 3 ด่าน: มี student profile → `exam_eligible` เป็น true → หารอบของ `academic_year` ตัวเอง:
1. `findSubmittableRound(student)` (`examResults.service.js` — ตัวเดียวกับที่ `POST /api/exam-results` ใช้):
   รอบที่เปิดรับอยู่จริง → `can_fix_rejected: false` · ไม่มีรอบเปิดแต่ใบของคนนี้ใน**รอบล่าสุดที่เริ่มแล้ว**ถูกตีกลับ → `can_fix_rejected: true`
2. ไม่เข้าข้อ 1 → `findOpenForYear` แบบเดิม (ให้เห็นรอบที่ตั้งไว้ล่วงหน้า) + `can_fix_rejected: false`

ตอบกลับ: field ของ round + `phase` + `subjects[]` (แต่ละวิชามี `already_passed`) + `all_passed` + `can_fix_rejected`
> หน้ากรอกผลต้องเปิดฟอร์มให้กรอกเมื่อ `phase === "active"` **หรือ** `can_fix_rejected === true`

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
- **หนึ่งปีการศึกษามี "ครั้งที่ n" ได้รอบเดียว** — `ensureNotDuplicate()` เช็คทั้งตอน `create` และ `update` (ตอน update ข้ามรอบตัวเองด้วย `exceptRoundId` ไม่งั้นกดบันทึกค่าเดิมจะโดนบล็อก) ตอบ 400 พร้อมข้อความว่าปีไหนครั้งที่เท่าไรที่ชนอยู่
  กันซ้ำอีกชั้นที่ DB ด้วย `@@unique([academic_year, attempt_number])` — เผื่อกดสร้างพร้อมกันสองหน้าจอ แล้วแปลง Prisma `P2002` เป็น 400 ผ่าน `asDuplicateRoundError()` ไม่งั้นจะเด้ง 500
- `update` ดึงรอบเดิมมาก่อนเสมอ ไม่เจอ = 404 (เดิมดึงเฉพาะตอนส่ง `subject_ids` มา กรณีอื่นจะพังเป็น 500 ที่ Prisma)
- **ทั้งระบบมีรอบที่ `status = "open"` ได้ทีละรอบเดียว** — `ensureNoOtherOpenRound()` เช็คทั้งตอน `create` (ถ้าส่ง `status: "open"` มาเลย) และตอน `update` ที่เปลี่ยนเป็น open
  ตอบ 400 บอกว่ารอบไหนเปิดค้างอยู่ ต้องไปปิดก่อน. รอบที่เปิดอยู่แล้วกดบันทึกซ้ำไม่โดนบล็อก (ข้ามตัวเองด้วย `exceptRoundId`)
  เหตุผล: `findActive` หยิบรอบเดียวมาให้นักศึกษาโดยเรียง `attempt_number desc` — เปิดค้างหลายรอบในรุ่นเดียวกัน นักศึกษาจะได้รอบที่ไม่ตั้งใจ
  **ข้อจำกัดที่ตามมา:** รุ่นเก่าที่สอบแก้ตัวกับรุ่นใหม่ที่สอบครั้งแรก เปิดรับพร้อมกันไม่ได้ ต้องสลับกันเปิด (เจ้าของ repo ตัดสินใจแบบนี้ 2026-08-12)
  ไม่ได้กันที่ DB — Postgres ต้องใช้ partial unique index ซึ่ง Prisma schema ประกาศไม่ได้ ถ้าจะกันต้องเขียน migration ดิบเอง

**`remove`** ลบได้เฉพาะรอบที่ยังไม่มีใครใช้ เช็ค 3 อย่าง: ไม่ได้เปิดอยู่ → ไม่มีผลสอบผูก → ไม่มีประกาศผูก (foreign key กันให้อยู่แล้ว แต่ error ดิบอ่านไม่รู้เรื่อง จึงเช็คเองเพื่อบอกสาเหตุชัดๆ)

### 7.7 examResults — ผลสอบ ⭐ หัวใจของระบบ

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| POST | `/api/exam-results` | 👤 | ส่ง/แก้ผลสอบของรอบที่เปิดอยู่ — **หรือแก้ใบที่ถูกตีกลับของรอบล่าสุดแม้รอบปิดแล้ว** (`findSubmittableRound`) — **ผ่านครบทุกวิชาของรอบแล้ว (ไม่มีวิชาที่ต้องกรอก) → 400 "ผ่านครบทุกวิชาของรอบนี้แล้ว ไม่ต้องกรอกผลสอบอีก"** ไม่สร้างใบว่าง (เคสแก้ใบที่ถูกตีกลับไม่โดน เพราะใบของรอบนี้ไม่นับเป็น "ผ่านแล้ว") |
| GET | `/api/exam-results/me` | 👤 | ประวัติของตัวเอง |
| POST | `/api/exam-results/:id/certificates` | 👤 | แนบไฟล์หลักฐาน PDF/JPG/PNG (สูงสุด 5 ไฟล์ต่อใบ — ดู 7.8) |
| GET | `/api/exam-results` | 🧑‍💼 🔍 | ดูทั้งหมด (กรองได้) + `confirmer` (ผู้ตรวจล่าสุด) + `review_logs` (ประวัติตรวจทุกครั้ง เก่า→ใหม่ พร้อม `reviewer`) — แต่ละคนมี `is_closed` |
| PATCH | `/api/exam-results/:id/approve` | 🧑‍💼 🔍 | ยืนยันผล — `remark` ไม่บังคับ (ว่าง/ไม่ใช่ข้อความ → เก็บ `null`) ยาวเกิน 500 ตัวอักษร → 400 |
| PATCH | `/api/exam-results/:id/reject` | 🧑‍💼 🔍 | ตีกลับ (ต้องมี `remark` เป็นข้อความ ไม่ว่าง ไม่เกิน 500 ตัวอักษร — ส่งตัวเลข/object/array มา → 400 ไม่ใช่ 500) |
| PATCH | `/api/exam-results/:id/revoke-approval` | 🧑‍💼 | **ถอนการยืนยัน** (ยืนยันผิด) approved → pending · ต้องมี `remark` (≤500) · เฉพาะ officer (reviewer ไม่ได้) · บันทึก `review_logs` action `revoked` + แจ้งเตือนนักศึกษา (`type: "revoked"`) · ใบที่ไม่ใช่ approved ตอบ 409 |

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
4. ต้องมีรอบที่ส่งได้ของรุ่นตัวเอง — `findSubmittableRound(student)` ใน **`examResults.service.js`** (ไม่มี → **400** "ขณะนี้ไม่มีรอบกรอกผลสอบที่เปิดอยู่ ... กรุณาติดต่อเจ้าหน้าที่คณะ") — **หารอบจากรุ่นตั้งแต่ต้น กรอกข้ามรุ่นจึงเป็นไปไม่ได้**
   - ขั้น 1: `roundsRepo.findActive(year)` รอบที่เปิดรับอยู่จริง → `{ round, fixingRejected: false }`
   - ขั้น 2: ไม่มีรอบเปิด → `roundsRepo.findLatestStarted(year)` (รอบล่าสุดที่ `open_date <= ตอนนี้`, สถานะอะไรก็ได้) ถ้าใบของคนนี้ในรอบนั้น `staff_status = rejected` → `{ round, fixingRejected: true }` (ตัดสินใจโดยเจ้าของงาน 1 ต.ค. 2569: ใบที่ถูกตีกลับหลังปิดรอบแก้ส่งใหม่ได้)
   - ไม่เข้าทั้ง 2 ขั้น → `null` (คนไม่เคยส่ง / ใบรอตรวจ / ใบยืนยันแล้ว หลังปิดรอบ ส่งไม่ได้เหมือนเดิม)
   - ดูเฉพาะ**รอบล่าสุด** ไม่ย้อนไปรอบเก่า — มีรอบใหม่กว่าแล้วย้อนไปแก้รอบเก่าจะทำให้ carry-forward ของรอบหลังเพี้ยน
5. **หน้าต่างแก้ไข** — ถ้าใบของรอบนี้ `staff_status = approved` → **409** ล็อก. นอกนั้น (`pending` / `rejected`) ส่งทับได้เรื่อยๆ (`isRedo`) ขณะรอบเปิด. ถ้ามาทาง `fixingRejected` ใบเดิมต้องยัง `rejected` อยู่จริง ไม่งั้น **400** (ส่งแก้ไปแล้วใบกลับเป็น `pending` → แก้ซ้ำหลังปิดรอบไม่ได้)
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
dashboard นับอัตราผ่านรายวิชาเฉพาะแถวที่เป็น `false` (คนที่สอบจริง). "ผ่านครบทุกวิชา" **รายรอบ** (`fullyPassed` ของ `buildStats` / `rounds[]`) นับแถวยกมาด้วย แต่ตัวเลข**ระดับปี** (`firstYear`, `fullyPassed` ของปี) ไม่นับ (บั๊ก B1 ด้านล่าง).

> **บั๊ก B1 (แก้ 1 ต.ค. 2569) — `findPassedSubjectIds` นับเฉพาะ `carried_forward: false`**
> ลำดับเหตุการณ์: ใบรอบ 1 ยังรอตรวจ (วิชา A ผ่าน) → เปิดรอบ 2 → รอบ 2 ยกวิชา A มาเป็นผ่าน → เจ้าหน้าที่**ตีกลับใบรอบ 1** → ยืนยันใบรอบ 2.
> เดิมแถวยกมาในรอบ 2 ยังนับเป็น "ผ่านวิชา A" → รอบ 3 ล็อกวิชา A และ "ผ่านภายในปีแรก" สูงเกินจริง ทั้งที่หลักฐานวิชา A ถูกตีกลับ.
> ตัดแถวยกมาทิ้งแล้วไม่เสียอะไร: ถ้าใบต้นทางยังดีอยู่ แถวผ่านจริงในใบต้นทางถูกนับให้อยู่แล้ว.
> ใช้กฎเดียวกันใน `dashboard.repository.js → findEligibleWithPassedSubjects` (คิวตรวจ/`canSubmit`) และ `dashboard.service.js → addConfirmedRealPasses` (`firstYear` + ไฟล์ส่งออกผ่านภายในปีแรก).

**`resubmitWithSubjects`** (ส่งทับใบเดิม) — ลบผลรายวิชาชุดเดิมทิ้งทั้งชุด ใส่ชุดใหม่ แล้ว**ล้าง `remark` + `confirmed_by` + `confirmed_at`** พร้อมตั้ง `staff_status` กลับเป็น `pending` ไม่งั้นใบที่แก้แล้วยังติดเหตุผลตีกลับรอบก่อนค้างอยู่.

**`getAll`** รับ query 3 ตัว: `?round_id=` `?staff_status=` `?student_id=` (ผสมกันได้) เรียงจาก `submitted_at` ใหม่→เก่า.
> ⚠️ **ไม่ส่ง `round_id` = ได้ผลสอบทุกรอบทุกปีปนกัน** นักศึกษา 1 คนมีได้หลายใบ. ฝั่งหน้าเว็บต้องระบุรอบเสมอ ไม่งั้นตัวเลขจะไม่ตรงกับ dashboard ที่นับรอบเดียว.

**`approve` / `reject`** ใช้ฟังก์ชันเดียวกัน (`reviewExamResult`) ต่างแค่ค่าสถานะกับ "บังคับมี remark ไหม". บันทึก `confirmed_by` จาก JWT + `confirmed_at` เป็นเวลาปัจจุบัน. เข้าได้ทั้ง `officer` และ `reviewer` — คิวเดียวกันหมด (pooled) ไม่มี assignment ว่าใครตรวจของใคร.

**Guard กันตรวจซ้อน (`staff_status` ต้องเป็น `pending` เท่านั้น):**
```js
if (existing.staff_status !== STAFF_STATUS.PENDING) throw httpError(..., 409); // ด่านแรก ข้อความชัดเจน
const { count } = await examRepo.updateStaffStatusIfPending(id, {...});        // updateMany + where staff_status='pending'
if (count === 0) throw httpError(..., 409); // ด่านสอง กัน race จริง — อีกคนแทรกพอดีระหว่างด่านแรกกับตอนนี้
```
`updateMany` (ไม่ใช่ `update` ธรรมดา) เพราะต้องใส่เงื่อนไข `staff_status` ลง `where` — `update` รับแค่ unique field ใส่เงื่อนไขสถานะเพิ่มไม่ได้ ด่านแรกอย่างเดียวไม่พอกันจริง (มี gap ระหว่างเช็คกับเขียน) ต้องมีด่านสองเช็ค `count`.

⚠️ **ผลข้างเคียงที่ตั้งใจ:** ใบที่ถูก approve/reject ไปแล้วครั้งหนึ่ง แก้คำตัดสินตรงๆ ผ่าน API อีกไม่ได้แล้ว (จะได้ 409 เสมอ ไม่ว่าใครเป็นคนกด) — ต้องให้นักศึกษา resubmit ก่อน (`staff_status` กลับเป็น `pending` ผ่าน `resubmitWithSubjects`) ถึงจะตรวจซ้ำได้อีก **เปลี่ยนจากพฤติกรรมเดิมก่อนมี reviewer** (เดิม reject แล้วกด approve ทันทีโดยไม่ resubmit ทำได้) — เหตุผล: ทางเดียวที่แยกแยะ "แก้คำตัดสินตัวเองโดยตั้งใจ" กับ "อีกคนมาแทรกแบบไม่รู้ตัว (race)" ได้แน่นอนคือปิดทางแรกไปด้วยเลย ไม่งั้น guard กันชนจริงไม่ได้ (ทดสอบแล้วด้วย `Promise.all` ยิงพร้อมกันจริง — ถ้าไม่ hardcode "pending" การ์ดหลุด ทั้งสองคำขอผ่านหมด). `tests/smoke-phase4-6.mjs` แก้ให้ resubmit ก่อน approve ตามนี้แล้ว.

**Audit log (`review_logs`, insert-only)** — บันทึก**ทุกครั้ง**ที่ approve/reject ไม่ทับของเดิมเหมือน `exam_results.confirmed_by` (`reviewLog.repository.js`, เรียกหลัง guard ผ่านเท่านั้น, ห่อ `try/catch` เอง — insert log พลาดไม่ทำให้ request ทั้งเส้น error เพราะการตรวจสำเร็จไปแล้วจริง):
```js
await reviewLogRepo.create({ result_id, reviewer_id: req.user.userId, action: staff_status, remark });
```
ยังไม่มี endpoint อ่าน — query ผ่าน DB ตรงถ้าต้องใช้ก่อนมี UI. `tests/cleanupYears.mjs` และสคริปต์ seed ทุกตัว (`seed.js`, `demoSeed.js`, `seedDemoYears.js`, `seedCohort.js`) ต้องลบ `review_logs` ก่อน `exam_results` เสมอ ไม่งั้น FK พัง (`review_logs_result_id_fkey`).

### 7.8 certificates — ไฟล์หลักฐาน

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| POST | `/api/exam-results/:id/certificates` | 👤 | แนบไฟล์หลักฐาน **PDF / JPG / PNG** ≤10MB (อยู่ใน routes ของ examResults) — **ต่อท้าย ไม่แทนที่ไฟล์เดิม** สูงสุด **5 ไฟล์ต่อใบ** |
| DELETE | `/api/certificates/:id` | 👤 | ลบไฟล์หลักฐานของตัวเองทีละไฟล์ → `{ success: true, data: null }` (ลบแถว DB ก่อน แล้วลบไฟล์บน disk) · ไม่พบ → 404 |
| GET | `/api/certificates/:id/file` | 🔑 + 🔍 | เปิด/ดาวน์โหลดไฟล์ (เจ้าของใบ, officer, reviewer — executive ไม่ได้) · `Content-Type` ตาม `file_type`: pdf→`application/pdf`, jpg→`image/jpeg`, png→`image/png` (ค่าอื่น/ไฟล์เก่า = PDF) |

- `certificate_type` ต้องเป็น `exam_result` (ใบผลสอบ) หรือ `license` (ใบประกอบวิชาชีพ) เท่านั้น → ไม่ใช่ 400 "ประเภทเอกสารไม่ถูกต้อง ..." · ไม่แนบไฟล์ → 400 "กรุณาเลือกไฟล์ที่ต้องการแนบ"
- **ชนิดไฟล์ตรวจจาก "หัวไฟล์" (magic bytes) จริง** ไม่เชื่อนามสกุล/mimetype (`detectFileType`): `%PDF-` → `pdf` · `FF D8 FF` → `jpg` · `89 50 4E 47 0D 0A 1A 0A` → `png` → บันทึกเป็น `file_type` · ไม่ตรงทั้ง 3 → ลบไฟล์ทิ้ง + 400 "ไฟล์ที่แนบต้องเป็น PDF, JPG หรือ PNG เท่านั้น กรุณาเลือกไฟล์ใหม่"
- ครบ 5 ไฟล์แล้ว (`countByResult`) → 400 "แนบไฟล์ได้ไม่เกิน 5 ไฟล์ต่อใบผลสอบ กรุณาลบไฟล์เดิมก่อนเพิ่มไฟล์ใหม่" (`MAX_FILES_PER_RESULT`)
- **ตรวจซ้ำหลังบันทึก (กัน race):** หลัง `certRepo.create` นับไฟล์ใหม่อีกรอบ + อ่านสถานะใบล่าสุด — ถ้าเกิน 5 ไฟล์ (กดแนบพร้อมกันหลาย request) หรือใบเพิ่งถูกยืนยันระหว่างอัปโหลด → ถอนแถวที่เพิ่งบันทึก (`removeById`) + ลบไฟล์ แล้วตอบ 400/409 ตามลำดับ · request ที่นับแล้วเห็นเกินจะถอนตัวเอง จึงไม่มีทางค้างเกิน 5 ไฟล์ (บางครั้งทุก request ที่ชนกันถูกปฏิเสธหมด — ผู้ใช้กดแนบใหม่ได้)
- **ใครเปลี่ยนเอกสารได้ (ทั้งแนบและลบ ใช้ `ensureCanChangeEvidence` ตัวเดียวกัน — เป็น async):**
  1. เจ้าของใบเท่านั้น → ไม่ใช่ 403 (route ลบเป็น `requireRole("student")` — officer/reviewer ลบไม่ได้ 403)
  2. ใบที่ `approved` แล้ว → 409 "เจ้าหน้าที่ยืนยันผลสอบนี้แล้ว เปลี่ยนเอกสารไม่ได้"
  3. ใบต้องอยู่ใน**รอบที่ส่งผลได้ตอนนี้** = `findSubmittableRound(student).round.round_id === examResult.round_id` (ตัวเดียวกับ `POST /api/exam-results`) → ใบของรอบที่ active อยู่ (รอตรวจ/ตีกลับ) หรือใบตีกลับของ**รอบล่าสุด**หลังปิดรอบ · นอกนั้น 409 "รอบนี้ปิดรับแล้ว เปลี่ยนเอกสารไม่ได้ กรุณาติดต่อเจ้าหน้าที่คณะ" — รวมใบรอตรวจหลังปิดรอบ และ**ใบตีกลับของรอบเก่าที่มีรอบใหม่กว่าแล้ว** (เดิมเช็คแค่ `staff_status === "rejected"` → ใบตีกลับรอบเก่าเปลี่ยนหลักฐานได้ตลอดไป)
- **ไฟล์ที่ไม่ได้บันทึกถูกลบจาก disk ทุกทาง:** `upload` ใช้ตัวแปร `saved` — พังที่ขั้นไหนก่อนบันทึกสำเร็จ (validate ไม่ผ่าน, เลขใบแปลก/ใหญ่เกินจน Prisma error, บันทึก DB ไม่สำเร็จ, ตรวจซ้ำหลังบันทึกไม่ผ่าน) `catch` เรียก `discard(req.file)` ให้เสมอ (`discard` ห่อ try/catch — ลบไม่ได้ก็ไม่ทำให้ request ค้าง) · multer error (ไฟล์ใหญ่เกิน/ชื่อช่องผิด) multer ลบไฟล์เองก่อนถึง controller
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
  - `notifications.controller.js` → `notifyIfRoundJustOpened` (ตอนนักศึกษา poll `GET /me`) สร้าง `type: "round_open"` ครั้งเดียวต่อรอบ — **ไม่สร้างให้คนที่ผ่านครบทุกวิชาของรอบนั้นแล้ว** (ใช้ `findPassedSubjectIds` + `subjectsOfRound` เหมือนตอนส่งผล) ส่วนคนที่ใบถูกตีกลับยังได้ตามปกติ
- ยิงแบบ fire-and-forget (`.catch(console.error)`) — แจ้งเตือนพลาดต้องไม่ทำให้ approve/reject ล้มไปด้วย
- `markRead` ใช้ `updateMany` ที่ where ด้วย `student_id` เสมอ — เดา `notification_id` ถูกก็ mark ของคนอื่นไม่ได้
- **`serveFile` เช็คสิทธิ์ก่อนส่งไฟล์เสมอ:** เจ้าของ หรือ officer เท่านั้น (executive ไม่ได้) — ไฟล์ไม่ได้เปิด public ให้เดา id เอา

### 7.9 news — ข่าว/ประกาศ

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| GET | `/api/news` | 🔑 | ข่าว (ใหม่→เก่า) — **นักศึกษาเห็นเฉพาะของรุ่นตัวเอง** · `poster` มี `is_closed` (ปิดบัญชีแล้วหน้าจอต่อท้าย "(ปิดบัญชีแล้ว)") |
| POST | `/api/news` | 🧑‍💼 | โพสต์ |
| PUT | `/api/news/:id` | 🧑‍💼 | แก้ไข |
| DELETE | `/api/news/:id` | 🧑‍💼 | ลบ |
| GET | `/api/news/:id/image` | 🔑 | ดูรูป |
| POST | `/api/news/:id/image` | 🧑‍💼 | แนบ/เปลี่ยนรูป |
| DELETE | `/api/news/:id/image` | 🧑‍💼 | เอารูปออก |

- ต้องมี `title` + `content` + `round_id` ครบ. `posted_by` มาจาก JWT
- **`getAll` กรองตามรุ่นให้นักศึกษา** — ประกาศผูกกับ `round_id` และรอบเป็นของรุ่นใดรุ่นหนึ่ง จึงรู้ปีอยู่แล้ว
  นักศึกษาได้เฉพาะประกาศที่ `round.academic_year` ตรงกับรุ่นตัวเอง / เจ้าหน้าที่+ผู้บริหารได้ครบทุกรุ่น (`findAll(academicYear)` ไม่ส่ง = ไม่กรอง)
  **ผลข้างเคียง:** รุ่นที่ยังไม่มีรอบสอบเลย จะไม่เห็นประกาศอะไรเลย และ**ยังไม่มีวิธีโพสต์ "ประกาศถึงทุกรุ่น"** เพราะ `round_id` เป็น NOT NULL
  ถ้าจะทำ ต้องเปลี่ยน `news.round_id` เป็น nullable แล้วให้ `null` = ประกาศกลาง (ยังไม่ได้ทำ รอเจ้าของ repo ตัดสินใจ)
- แจ้งเตือนฝั่งนักศึกษา (`buildNotifications` ที่ frontend) อ่านจาก endpoint เดียวกัน จึงถูกกรองตามรุ่นไปด้วยเอง
- **1 ประกาศ = 1 รูป** เปลี่ยนรูปใหม่ → ลบไฟล์เก่าที่ disk ทิ้งทันที. ลบประกาศ → ลบรูปตามไปด้วย (`removeImageFile`) ไม่ให้เหลือไฟล์กำพร้า
- `update` ใช้ท่า partial update: ส่ง field ไหนมาก็แก้เฉพาะ field นั้น
  ```js
  if (title !== undefined) data.title = title;   // เช็ค !== undefined ไม่ใช่ if (title)
  ```
  ต้องเช็คแบบนี้เพราะค่าว่าง `""` ก็ถือว่า "ส่งมาแล้ว" ควรแก้ให้

### 7.10 dashboard — สถิติ + รายงาน

มี `service.js` เพราะการคำนวณซับซ้อนพอที่จะแยกออกมา และใช้ซ้ำทั้งหน้าเว็บกับ PDF (อีกโมดูลที่มี service คือ `examResults.service.js` → `findSubmittableRound`).

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| GET | `/api/dashboard/alerts` | 🧑‍💼 👔 | แจ้งเตือนสถานะปัจจุบัน (คำนวณสด ไม่เก็บ DB) — "ยังไม่ส่งผลสอบ N คน" นับจาก**ฐานคนของรอบ** = `roundNotStarted + by.draft` ของ `buildStats` (detail: "จากผู้ที่ต้องกรอกในรอบนี้ {roundTotal} คน") ไม่ใช่ทั้งรุ่น |
| GET | `/api/dashboard/stats?round_id=` | 🧑‍💼 👔 | สถิติของ 1 รอบ — **ผู้บริหารไม่ได้ field `alreadyPassedStudentIds`** (รหัสนักศึกษารายคน ตัดใน controller ตาม role ใน JWT, ยังได้ตัวเลข `alreadyPassed`) |
| GET | `/api/dashboard/history?years=3` | 🧑‍💼 👔 | สรุปย้อนหลังรายปี |
| GET | `/api/dashboard/export?round_id=` | 🧑‍💼 | โหลดรายงาน PDF — ส่วนสถานะรายรอบใช้ฐานคนของรอบ (`roundTotal`/`roundNotStarted`/`roundFillRate`) + แถว "ค้างร่าง" ถ้ามี + หมายเหตุ `alreadyPassed` ถ้า > 0 · ตัวเลขสภาการพยาบาล (`firstAttempt`/`firstYear`/`passDistribution`/`firstAttemptBySubject`) ตัวหารยังเป็นทั้งรุ่นเหมือนเดิม |
| GET | `/api/dashboard/export-first-attempt?year=&passed=true\|false&format=xlsx\|pdf` | 🧑‍💼 | รายชื่อนักศึกษา "ผ่านครั้งแรก" / "ไม่ผ่านครั้งแรก" ของปีการศึกษา (ไม่ส่ง `format` = xlsx) — กฎเดียวกับ `firstAttempt.passed` ใน `/history` ผ่าน + ไม่ผ่าน = ทั้งรุ่น ปีที่ไม่มีรอบที่ 1 → 404 |
| GET | `/api/dashboard/export-first-year?year=&passed=true\|false&format=xlsx\|pdf` | 🧑‍💼 | รายชื่อนักศึกษา "ผ่านภายในปีแรก" / "ไม่ผ่านภายในปีแรก" (รวมทุกรอบของปี) — `buildFirstYearList` กฎเดียวกับ `firstYear.passed` ใน `/history` (ใช้ `addConfirmedRealPasses` / `getRequiredSubjectIds` / `hasPassedAll` ตัวเดียวกัน) ผ่าน + ไม่ผ่าน = ทั้งรุ่น ปีที่ไม่มีรอบเลย → 404 |

**ไฟล์ส่งออกรายชื่อผ่าน/ไม่ผ่าน (2 endpoint ข้างบน)**
- ตรวจ query ด้วย `readListExportQuery` ตัวเดียวกัน: ปีไม่ใช่ พ.ศ. 2400–2700 / `passed` ไม่ใช่ true|false / `format` ไม่ใช่ xlsx|pdf → 400 ข้อความไทยไม่มีชื่อ field
- คอลัมน์ Excel (`listColumns`): ลำดับ, รหัสนักศึกษา, ชื่อ, นามสกุล, ชื่อ (อังกฤษ), นามสกุล (อังกฤษ), ห้อง, เบอร์โทร, อีเมล, สถานะใบ (ผ่านครั้งแรก = "สถานะใบผลสอบรอบแรก" · ภายในปีแรก = "สถานะใบล่าสุด"), ผ่านกี่วิชา, วิชาที่ไม่ผ่าน / วิชาที่ยังไม่ผ่าน — **ไม่มีเลขบัตรประชาชน**
- ภายในปีแรก: "ผ่านกี่วิชา" นับเฉพาะวิชาที่ผ่านจริงในใบที่ยืนยันแล้ว เทียบกับวิชาที่ต้องผ่าน (คนที่ไม่เคยส่ง = `0/N`)
- PDF ใช้ `buildPassListPdf({ label, subtitle, note, total, rows, res })` ตัวเดียวกันทั้ง 2 แบบ (เดิมชื่อ `buildFirstAttemptListPdf`)

**`buildStats(roundId)`** — ไม่ส่ง `round_id` มา จะใช้ `findDefaultRound()` = รอบที่เปิดอยู่ ถ้าไม่มีก็รอบล่าสุด

ค่าที่คำนวณและความหมาย:

| field | หมายถึง | สูตร |
|---|---|---|
| `total` | นักศึกษาทั้งรุ่น | นับจาก `academic_year` ของรอบ |
| `eligible` | คนที่เปิดสิทธิ์กรอกแล้ว | `exam_eligible = true` |
| `canSubmit` | รอบนี้กรอกฟอร์มได้กี่คน | เปิดสิทธิ์ **และ** ยังผ่านวิชาของรอบนี้ไม่ครบ — ลดลงทุกรอบ |
| `alreadyPassedStudentIds` | `student_id[]` ของคนที่ผ่านครบไปแล้วตั้งแต่รอบก่อน — **เฉพาะ officer** (executive ไม่ได้ field นี้ เพราะเป็นรายบุคคล) | อีกครึ่งของ loop เดียวกับ `canSubmit` (คนที่ `passedAll`) |
| `by` | แยกตามสถานะ | `{ draft, submitted, approved, rejected }` |
| `not_started` | ยังไม่กรอกเลย | `eligible − จำนวนใบในรอบ` |
| `roundTotal` | **คนของรอบนี้** — ฐานของโดนัท/แถบความคืบหน้ารายรอบบน dashboard | คนที่กรอกได้ในรอบนี้ (`canSubmit`) ∪ คนที่มีใบในรอบนี้ — ไม่รวมคนที่ผ่านครบแล้ว |
| `roundNotStarted` | ยังไม่เริ่มกรอก (เฉพาะคนของรอบนี้) | `roundTotal − จำนวนใบในรอบ` · 5 ช่อง (approved+submitted+rejected+draft+`roundNotStarted`) รวมกันได้ `roundTotal` พอดี |
| `roundFillRate` | % ส่งแล้วของคนของรอบนี้ | `submitted / roundTotal` (รอบ 1 เท่ากับ `fillRate` ถ้าเปิดสิทธิ์ทั้งรุ่น) |
| `alreadyPassed` | จำนวนคนที่ผ่านครบตั้งแต่รอบก่อน | `alreadyPassedStudentIds.length` — หน้าจอใช้เป็นบรรทัดหมายเหตุใต้โดนัท |
| `fillRate` | % คนที่ส่งแล้ว | `submitted / eligible` ← **หารด้วย eligible ไม่ใช่ total** |
| `fullyPassed` | คนที่ผ่านครบทุกวิชาของรอบ | เทียบทีละ `subject_id` ไม่ใช่นับจำนวน |
| `fullyPassedRate` | % ผ่านครบ (รายคน) | `fullyPassed / submitted` |
| `subjectPassRate` | % ผลรายวิชาที่ผ่าน (รายวิชา) | ผลรวม pass ÷ ผลรวมทั้งหมด |
| `perSubject` | ผ่าน/ไม่ผ่าน แยกรายวิชา | นับเฉพาะคนที่**สอบวิชานั้นจริงในรอบนี้** (`carried_forward = false`) |

> `fullyPassedRate` (รายคน) กับ `subjectPassRate` (รายวิชา) **คนละตัวกัน** — 20 คนสอบ 8 วิชา ผ่านคนละ 7 วิชา จะได้ subjectPassRate 87.5% แต่ fullyPassedRate 0%.

**3 กติกาที่ต้องไม่ลืม:**

1. **สถิติทุกตัวนับเฉพาะนักศึกษาที่ `exam_eligible = true`** — `findResultsByRound` กรองที่ repository เลย
   รับประกันว่า `by.approved + by.submitted + by.rejected + by.draft + not_started === eligible` เสมอ
   (ถ้าไม่กรอง คนที่ส่งแล้วโดนปิดสิทธิ์ทีหลังจะทำให้ผลรวมเกิน `eligible` แล้ว `Math.max` ใน `not_started` ตัดเป็น 0 → วง donut กับตัวเลขตรงกลางไม่ตรงกัน)

2. **`perSubject[].rate` เป็น `null` ได้** เมื่อไม่มีใครสอบวิชานั้นจริงในรอบ (ทุกคนยกผลผ่านมาจากรอบก่อน)
   `null` = "ไม่มีข้อมูล" คนละเรื่องกับ `0` = "สอบแล้วตกหมด" — หน้าเว็บต้องแสดง `—` ไม่ใช่ 0%
   `subjectPassRate` ก็ข้ามวิชาพวกนี้ ไม่เอามาเป็นตัวหาร
   `fullyPassed` **ไม่**ตัด carry-forward ออก เพราะผ่านวิชานั้นตั้งแต่รอบก่อนก็นับว่าผ่านครบจริง

3. **`not_started` กับแท็บ "ยังไม่กรอก" ในหน้าคิวตรวจ ตั้งใจให้ไม่เท่ากัน**
   `not_started` ที่นี่ต้องรวมคนที่ผ่านครบไปแล้วด้วย ไม่งั้น 5 ช่องบวกกันไม่เท่า `total` (กติกาข้อ 1)
   ส่วนหน้าคิวตรวจตอบคำถาม "เหลืองานต้องตาม **กี่คน**" เลยเอา `alreadyPassedStudentIds` ไปลบออก
   → รอบ 2 เป็นต้นไป เลขสองที่จะต่างกัน **อย่าไปแก้ให้เท่ากัน** มันคนละคำถาม (frontend ติด tooltip อธิบายไว้ที่แท็บแล้ว)

**`buildHistory(yearCount)`** — สรุปรายปีย้อนหลัง (ค่าเริ่มต้น 3 ปี, จำกัด 1–10 ที่ controller)
**นับเป็น "รายคน" ไม่ใช่ "รายใบ"** ด้วย `Set` ของ `student_id` — คนที่กรอก 2 รอบในปีเดียวต้องนับครั้งเดียว ไม่งั้นตัวเลขเกินจำนวนคนที่มีจริง.

ค่าที่แต่ละปีส่งกลับ (`years[]`):

| field | หมายถึง | สูตร |
|---|---|---|
| `submitted` / `fullyPassed` | คนที่ส่ง / ผ่านครบ อย่างน้อย 1 รอบในปีนั้น | นับรายคน (`Set`) |
| `statusByStudent` | สัดส่วนสถานะ **รายคน** `{ draft, submitted, approved, rejected, not_started }` | ยึดใบล่าสุดของแต่ละคน — 5 ช่องบวกกัน = `total` เสมอ **ห้ามเอา `by` รายรอบมาบวกแทน** (นั่นเป็นจำนวนใบ คนกรอกหลายรอบจะถูกนับซ้ำจนเกิน 100%) |
| `fillRate` | % คนที่ส่ง | `submitted / eligible` |
| `passRate` | % ผ่านครบ เทียบกับคนที่ส่ง | `fullyPassed / submitted` |
| `firstAttempt` | **ร้อยละผ่านครั้งแรก** (ตัวเลขที่คณะส่งสภาการพยาบาล) | `ผ่านครบในรอบ attempt_number = 1 / total` |
| `firstYear` | **ร้อยละผ่านภายในปีแรก** | `fullyPassed (ทุกรอบของปี) / total` — รวมวิชาที่ผ่านจริงจากใบที่ยืนยันแล้วทุกรอบ **ไม่นับแถว `carried_forward`** (บั๊ก B1) |
| `byRoom` | ส่ง/ผ่านครบ แยกตามห้องเรียน | นับรายคน |
| `passDistribution` | ตาราง "ผ่านกี่วิชา" ของรอบแรก แยกห้อง | `buildPassDistribution()` — `null` ถ้าปีนั้นยังไม่มีรอบที่ 1 |
| `firstAttemptBySubject` | ตารางผลรายวิชาของรอบแรก **ตัวหาร = นักศึกษาทั้งรุ่น** | `buildFirstAttemptBySubject()` — `null` ถ้าไม่มีรอบที่ 1 หรือ `total = 0` |
| `started` | คนที่มีใบในปีนี้กี่คน (รวม `draft`) | นับรายคน (`Set`) — `total − started` = ยังไม่เริ่มกรอก |
| `perSubject` | อัตราผ่านรายวิชา รวมทุกรอบของปี | เหมือน `buildStats` |

> **ตัวหารของ `firstAttempt` / `firstYear` คือ `total` (นักศึกษาทั้งรุ่น) ไม่ใช่ `submitted`**
> เพราะสูตรของคณะหารด้วย "จำนวนผู้สำเร็จการศึกษาในปีนั้น" — คนที่ไม่ส่งผลก็ถือว่ายังสอบไม่ผ่าน ต้องอยู่ในตัวหารด้วย
> ระบบใช้ `total` แทนได้เพราะเจ้าหน้าที่ import รายชื่อเข้าระบบเฉพาะคนที่จบแล้วเท่านั้น
> 2 ตัวนี้เป็น % ทศนิยม 2 ตำแหน่ง (`rate2`) ต่างจาก field อื่นที่เป็นจำนวนเต็ม (`percent`)

**`buildPassDistribution(sent, subjectIds)`** — ตารางสรุป "ผ่าน 8 วิชา / 7 วิชา / …" ของ**รอบแรกเท่านั้น**
นับรายคน 1 คนอยู่ได้แถวเดียว. คืน `{ subject_count, total, rooms[], rows[] }` โดย `rows` ไล่จากผ่านมากไปน้อย
และคงแถวที่ไม่มีใครไว้เป็น 0 ด้วย (ตารางในรายงานต้องมีครบทุกแถว).

**`buildFirstAttemptBySubject(sent, subjects, cohortTotal)`** — ตารางผลรายวิชาของ**รอบแรกเท่านั้น**
รูปแบบเดียวกับตารางที่คณะส่งสภาการพยาบาล คืน
`{ cohort_total, submitted, average_pass_rate, subjects[] }` โดยแต่ละวิชามี
`pass / pass_rate / fail / fail_rate / not_submitted / not_submitted_rate / sat`

| จุดต่าง | `buildPerSubject` | `buildFirstAttemptBySubject` |
|---|---|---|
| ตัวหาร | คนที่สอบวิชานั้นจริง | **นักศึกษาทั้งรุ่น** (`total`) |
| ทศนิยม | จำนวนเต็ม (`percent`) | 2 ตำแหน่ง (`rate2`) |
| ขอบเขต | รอบที่เลือก / ทุกรอบของปี | รอบ `attempt_number = 1` เท่านั้น |

- 3 ช่องต่อวิชา (`pass` / `fail` / `not_submitted`) บวกกันได้เท่า `cohort_total` เสมอ
  และ 3 rate รวมกันได้ `100.00` เป๊ะ — เศษจากการปัดยกไปไว้ที่ `not_submitted_rate`
- `fail` นับ**เฉพาะคนที่กรอกมาว่าตกจริง** ไม่กลืนคนที่ยังไม่ส่งผลเข้ามา
  (เอกสารของสภารวม 2 อย่างนี้เป็นช่องเดียว ตอนทำ PDF ต้องบวก `fail + not_submitted` กลับ)
- `sat = 0` แปลว่าไม่มีใครสอบวิชานั้นเลย หน้าจอต้องขึ้น `—` ไม่ใช่ `0.00%`
- `average_pass_rate` เฉลี่ยเฉพาะวิชาที่ `sat > 0` — หน้าจอใช้เป็นเส้นอ้างอิงว่าวิชาไหนต้องเฝ้าระวัง

**`dashboard.pdf.js`** — สร้าง PDF ด้วย pdfkit แล้ว `doc.pipe(res)` ส่งเป็น stream ตรงถึงเบราว์เซอร์ ไม่เขียนไฟล์ลง disk.
ต้อง `registerFont` ฟอนต์ Sarabun จาก `assets/fonts/` ไม่งั้นภาษาไทยกลายเป็นสี่เหลี่ยม □□□.

`drawTable({ y, widths, aligns, header, rows, groups })` — 2 กติกาของทุกตารางในไฟล์นี้:
- **ผลรวมของ `widths` ต้องเท่า `CONTENT_WIDTH` (500) พอดี** เกินแล้วตารางล้นขอบขวากระดาษ A4
- `groups` (ไม่บังคับ) = หัวตารางชั้นบนแบบ merge cell เช่น `[{label:"",span:2},{label:"สอบผ่าน",span:2}]`
  ผลรวมของ `span` ต้องเท่าจำนวนคอลัมน์ ไม่งั้นหัวเลื่อนไม่ตรงช่อง — กลุ่มที่ `label` ว่างคือคอลัมน์ที่ไม่มีหัวชั้นบน

---

## 8. ฐานข้อมูล

### ตารางทั้งหมด (13 model ใน `prisma/schema.prisma`)

| model | ตารางจริง | เก็บอะไร |
|---|---|---|
| `Role` | `roles` | 4 บทบาท: student / officer / executive / reviewer |
| `User` | `users` | ทุกคนที่เข้าระบบได้ + `password_hash` + audit: `created_by` / `closed_at` / `closed_by` |
| `Faculty` | `faculties` | คณะ (ตอนนี้มีแค่คณะพยาบาลศาสตร์) |
| `Room` | `rooms` | ห้องเรียนปกติ / ห้องเรียนอังกฤษ |
| `Student` | `students` | ข้อมูลนักศึกษา + `exam_eligible` + audit: `eligible_set_by` / `eligible_set_at` |
| `Subject` | `subjects` | รายวิชา 8 วิชา |
| `SubmissionRound` | `submission_rounds` | รอบการกรอก + `subject_ids` + audit: `updated_by` / `updated_at` |
| `ExamResult` | `exam_results` | 1 ใบ = 1 คน 1 รอบ |
| `SubjectResult` | `subject_results` | ผ่าน/ไม่ผ่าน รายวิชา + `carried_forward` (ยกผลมาจากรอบก่อน ไม่ได้สอบรอบนี้) |
| `Certificate` | `certificates` | ไฟล์หลักฐาน (เก็บแค่ path) |
| `News` | `news` | ข่าว/ประกาศ + audit: `updated_by` (`updated_at` มีเดิม) |
| `Notification` | `notifications` | แจ้งเตือนรายคน (`type` = `approved` / `rejected` / `eligible`) |
| `ReviewLog` | `review_logs` | audit log insert-only ของทุกครั้งที่ approve/reject (`reviewer_id`, `action`, `remark` ตอนนั้น) |

> ตาราง `sessions` เคยมี (ตอนคิดจะทำ session-based auth) แต่ **ลบทิ้งแล้ว** — auth ใช้ JWT ใน httpOnly cookie ล้วน ไม่ต้องเก็บ session ใน DB

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
| `users.import_academic_year` | `null` | ไม่ได้ระบุปีจบตอน import → complete-profile คำนวณจากรหัส · มีค่า = เจ้าหน้าที่ระบุไว้ (เก็บเฉพาะตอนต่างจากสูตร) — อยู่ที่ `users` เพราะตอน import ยังไม่มีแถว `students` |
| `students.exam_eligible` | `false` (ค่าเริ่มต้น) | กรอกผลสอบไม่ได้จนเจ้าหน้าที่เปิดให้ |
| `submission_rounds.status` | `"open"` / `"closed"` | ต้องเป็น open **และ** อยู่ในช่วงวันที่ ถึงจะกรอกได้ |
| `submission_rounds.subject_ids` | `[]` | รอบเก่าก่อนมี column นี้ = ใช้ทุกวิชา |
| `exam_results.student_status` | `draft` / `submitted` | ตอนนี้เป็น submitted เสมอ |
| `exam_results.staff_status` | `pending` / `approved` / `rejected` | สถานะการตรวจ |
| `certificates.file_path` | เช่น `uploads/certificates/1712-999.pdf` | **เก็บแค่ path ห้ามเก็บ binary ลง DB** |

### migration (ประวัติการแก้ตาราง)

10 migration เรียงตามเวลา — อ่านแล้วเห็นว่าระบบเปลี่ยนอะไรมาบ้าง:

| migration | เพิ่ม/แก้อะไร |
|---|---|
| `20260709175349_project_end` | สร้างตารางทั้งหมดครั้งแรก |
| `20260710151958_add_sessions_table` | เพิ่มตาราง sessions (ภายหลังลบทิ้ง) |
| `20260719122910_add_exam_eligible` | เพิ่ม `students.exam_eligible` |
| `20260722001256_remove_nursing_council_credentials` | เอาข้อมูลสภาการพยาบาลออก (เลิกใช้) |
| `20260722223556_add_local_password_auth` | เพิ่ม `password_hash` + `must_change_password` (ย้ายจาก PSU SSO มา login เอง) |
| `20260801135930_add_round_subject_ids` | เพิ่ม `submission_rounds.subject_ids` |
| `20260803092859_add_news_image_path` | เพิ่ม `news.image_path` |
| `20260804045833_add_carried_forward_to_subject_results` | เพิ่ม `subject_results.carried_forward` |
| `20260809114723_add_notifications` | เพิ่มตาราง `notifications` |
| `20260810171137_remove_sessions_table` | ลบตาราง `sessions` ที่ไม่ได้ใช้ |
| `20260812000000_add_unique_round_year_attempt` | unique `submission_rounds(academic_year, attempt_number)` — กันรอบซ้ำ |
| `20260921112343_add_reviewer_role` | `review_logs` + ชื่ออังกฤษนักศึกษา + ข้อมูล user ว่างได้ |
| `20261003100000_add_audit_actor_columns` | คอลัมน์ "ใครทำอะไร": `users.created_by/closed_at/closed_by`, `students.eligible_set_by/eligible_set_at`, `submission_rounds.updated_by/updated_at`, `news.updated_by` — ทุกช่องว่างได้, FK `ON DELETE SET NULL` (ลบบัญชีผู้ทำแล้วช่องกลับเป็นว่าง ไม่ทำให้ลบไม่ได้) |
| `20260922120000_add_user_import_academic_year` | เพิ่ม `users.import_academic_year` (ว่างได้) — ปีจบที่เจ้าหน้าที่ระบุตอน import |

**ขั้นตอนแก้ตาราง**: แก้ `prisma/schema.prisma` → `npx prisma migrate dev --name อธิบายสั้นๆ` → Prisma สร้างโฟลเดอร์ migration ใหม่ + อัปเดต DB + สร้าง client ใหม่ให้อัตโนมัติ.

> ⚠️ **`review_logs` (2026-09-20) ไม่มี migration file** — dev DB drift จาก `migrate dev` เดิมอยู่แล้ว (ดู changelog 17 ก.ย.) ใช้ `npx prisma db push` แทนสำหรับตารางนี้ (sync schema ตรงๆ ไม่สร้างประวัติ) ตามด้วย `npx prisma generate` (ต้องปิด server ก่อน ไม่งั้น query engine dll ถูกล็อกอยู่ rename ไม่ได้บน Windows).
**ห้ามแก้ไฟล์ใน `migrations/` ที่รันไปแล้วด้วยมือ** — DB กับประวัติจะไม่ตรงกัน.

### `prisma/seed.js` — ข้อมูลตัวอย่าง

ลำดับ: ลบข้อมูลเก่าทุกตาราง (เรียงจากตารางลูกไปแม่ ไม่งั้น foreign key ขวาง — `review_logs` ต้องมาก่อน `exam_results`) → 4 roles → คณะ + 2 ห้อง → 4 users → student profile → 8 รายวิชา

บัญชีทดสอบ (รหัสผ่าน = รหัสผู้ใช้ตัวเอง, ข้ามการบังคับเปลี่ยนรหัส):

| role | psu_passport_id | รหัสผ่าน |
|---|---|---|
| student | `6610210631` | `6610210631` |
| officer | `456` | `456` |
| executive | `789` | `789` |
| reviewer | `321` | `321` |

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

### `prisma/seedDemoYears.js` — ข้อมูลปริมาณจริง 5 รุ่น

รัน: `npm run seed:demo-years` (หรือระบุช่วงปีเอง `npm run seed:demo-years -- 2565 2569`)

ตัวนี้ไว้ทดสอบ dashboard/รายงาน/PDF กับข้อมูลขนาดจริง ต่างจาก `demoSeed.js` ที่มีแค่ 20 คน

- นักศึกษา **150–200 คนต่อรุ่น** 5 รุ่น (~900 คน) แบ่ง 2 ห้อง 70/30
- รุ่นที่จบแล้ว: รอบ 1 (8 วิชา) → รอบ 2 (เฉพาะวิชาที่มีคนตก) → รอบ 3 ถ้ายังเหลือคนตก > 8% — ตรวจครบ ปิดทุกรอบ
- **รุ่นล่าสุด: รอบ 2 เปิดค้างไว้กลางคัน** มีทั้งใบรอตรวจ/ตีกลับ/ยืนยันแล้ว/ยังไม่กรอก → คิวตรวจมีงานจริง
- ประกาศผูกรอบแรกของทุกปี + แจ้งเตือนของใบที่ถูกตีกลับ

**กติกาที่ต้องรักษาเวลาแก้สคริปต์นี้:**
- คุมผลจาก "สัดส่วนที่อยากได้" (ผ่านครบรอบแรก 72%) ไม่ใช่สุ่มทีละวิชาแล้วคูณกัน — คูณ 8 ครั้งแล้วสัดส่วนจะยุบเหลือไม่กี่ % ไม่เหมือนของจริง
- ปิดรอบที่ค้างเปิดอยู่ก่อนเสมอ — สคริปต์เขียนผ่าน Prisma ตรงๆ ข้าม `ensureNoOtherOpenRound` ถ้าไม่ปิดเองจะได้ DB ที่ผิดกติกา "เปิดได้ทีละรอบเดียว"
- ล้างเฉพาะรหัสนักศึกษาที่ตัวเองกำลังจะสร้าง (`psu_passport_id` เป็น unique ข้ามรุ่น) ไม่กวาดทั้งปี
- PRNG fix seed ไว้ → รันกี่ครั้งก็ได้ข้อมูลชุดเดิม เทียบผลลัพธ์ได้

รหัสผ่านนักศึกษาทุกคน = `demo1234`, `must_change_password = false`

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

3. POST /api/auth/login  → server ตอบ Set-Cookie: token=... (อายุ 1 วัน, httpOnly)

4. ทุก request ถัดไปเบราว์เซอร์แนบ cookie มาเอง
      (frontend แค่ใส่ credentials: 'include' ใน fetch ไม่ต้องจับ token เลย)

5. เจ้าหน้าที่เปิดสิทธิ์ให้ (PATCH /api/students/bulk-eligible)
      → exam_eligible = true → ถึงจะกรอกผลสอบได้
```

### สำหรับ officer/executive
เจ้าหน้าที่สร้างบัญชีให้ (`POST /api/users`) พร้อมตั้งรหัสชั่วคราว → `must_change_password: true` → login ครั้งแรกใช้งานอะไรไม่ได้จนกว่าจะ `PATCH /api/auth/password` → เปลี่ยนเสร็จต้อง logout แล้ว login ใหม่เพื่อรับ cookie ใบใหม่ที่ไม่มีธงบังคับแล้ว.

### กติกาความปลอดภัยที่ต้องรักษาไว้
1. **role อ่านจาก JWT เท่านั้น** — ห้ามเชื่อ role ที่ client ส่งมาใน body
2. `JWT_SECRET` / `DATABASE_URL` อยู่ใน `.env` เท่านั้น **ห้าม commit**
3. ทุก endpoint ที่ไม่ public ต้องมี `authenticate` **ก่อน** `requireRole`
4. `password_hash` ห้ามหลุดออก response — ใช้ `select` ที่ระบุ field ชัดเจน (`PUBLIC_USER_FIELDS`)
5. ข้อความ error ตอน login/first-setup ต้องเหมือนกันทุกกรณี ไม่บอกว่าผิดตรงไหน
6. **executive เห็นได้แค่ตัวเลขรวม** — ทุก endpoint ที่คืนข้อมูลนักศึกษารายบุคคล (students, exam-results, ไฟล์ certificate, export PDF) ต้องเป็น `requireRole("officer")` เท่านั้น
7. เจ้าของข้อมูล (ownership) ต้องเช็คใน controller — `requireRole` บอกได้แค่ "เป็นนักศึกษา" ไม่ได้บอกว่า "เป็นนักศึกษาคนนี้"
8. **token อยู่ใน httpOnly cookie เท่านั้น** — ห้ามส่ง token กลับใน JSON body และห้ามให้ frontend เก็บใน localStorage อีก (ย้อนกลับไปเปิดช่อง XSS)
9. `cors` ต้องระบุ `origin` เป็น URL จริงคู่กับ `credentials: true` — **ห้ามใช้ `origin: "*"`** เบราว์เซอร์ไม่ยอมส่ง cookie ให้ และเป็นการเปิดให้ทุกเว็บยิง API พร้อม cookie ของผู้ใช้
10. `sameSite: "lax"` คือด่านกัน CSRF เดียวที่มี — ถ้าเปลี่ยนเป็น `"none"` (เช่นตอน deploy แยก domain) ต้องเพิ่ม CSRF token ด้วย

---

## 10. รูปแบบ response และ error

### สำเร็จ
```json
{ "success": true, "data": { ... } }
```
`data` เป็น object / array / `null` ก็ได้. **ข้อยกเว้น:** `POST /api/auth/login` ตอบรูปแบบเก่า (`{ message, must_change_password, user }` — ไม่มี `token` แล้ว ย้ายไป cookie) ไม่มี `success` — frontend ผูกกับรูปแบบนี้อยู่ ถ้าจะแก้ต้องแก้พร้อมกันทั้งสองฝั่ง.

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
| หลักฐาน (ใบคะแนน) | `uploadEvidence` | `uploads/certificates/` | `application/pdf`, `image/jpeg`, `image/png` (ด่านจริงคือตรวจหัวไฟล์ใน controller) · ตั้งนามสกุล .pdf/.jpg/.png ตาม mimetype | 10 MB |
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
  uploadEvidence.single("file"),   // "file" = ชื่อ field ในฟอร์ม ต้องตรงกับที่ frontend ส่ง
  uploadCertificate);
```
หลังผ่าน multer → ข้อมูลไฟล์อยู่ที่ `req.file` (`.path`, `.originalname`, `.mimetype`, `.buffer`)

---

## 12. การทดสอบ

ไฟล์เทสอยู่ที่ `tests/*.mjs` — เป็น **smoke test** ยิง API จริงผ่าน HTTP ไม่ใช่ unit test.

```bash
npm run test:clean     # ← ใช้อันนี้
```

`tests/run-clean.mjs` ทำให้ครบทุกขั้นเอง: สร้าง PostgreSQL schema `verify_tmp` ใหม่ →
`migrate deploy` → `seed` → เปิด server ชั่วคราวที่พอร์ต **3100** → รันเทสทีละไฟล์ → ลบ schema ทิ้ง.
**ไม่แตะฐานข้อมูลที่ใช้ทำ demo เลย** และไม่ต้อง seed ก่อนเอง.

ทำไมต้องมี:
- `npm test` เดิมยิงใส่ DB ตัวที่ใช้จริง ซึ่งมีนักศึกษา 900+ คนกับรอบที่เปิดค้างอยู่
  เทสหลายตัวเขียนคาดว่า "มีนักศึกษา 1 คน" / "เปิดรอบใหม่ได้" เลย fail ทั้งที่โค้ดไม่ได้พัง
- `npm test` ต่อไฟล์ด้วย `&&` — ไฟล์แรกพังแล้วที่เหลือไม่ได้รันเลย
  `test:clean` รันครบทุกไฟล์เสมอแล้วค่อยสรุปว่าอันไหนไม่ผ่าน

ข้อควรรู้:
- ใช้ PostgreSQL **schema** (`verify_tmp`) ไม่ใช่ database ใหม่ เพราะ user ของเราไม่มีสิทธิ์ `CREATE DATABASE`
  (เหตุผลเดียวกับที่ `prisma migrate dev` ใช้ไม่ได้ ต้องใช้ `migrate diff` + `migrate deploy` แทน)
- สคริปต์**เปิด server ใหม่ก่อนทุกไฟล์** เพราะ rate limiter นับจำนวน login ไว้ใน memory
  (officer ได้ 10 ครั้ง/15 นาที) รัน 11 ไฟล์ติดกันด้วย server ตัวเดียวแล้วไฟล์ท้ายๆ จะโดน 429
- ถ้ามี server ค้างจองพอร์ต 3100 อยู่ สคริปต์จะเตือนแล้วหยุด — ปิดก่อนแล้วรันใหม่:
  `netstat -ano | findstr :3100` แล้ว `taskkill /PID <เลข> /T /F`
- เทสทุกไฟล์อ่าน `process.env.BASE` ได้ (ไม่ใส่ = `http://localhost:3000`) จะได้ชี้ไป server ชั่วคราวได้

| ไฟล์ | ครอบคลุม |
|---|---|
| `smoke-phase1-3.mjs` | auth, subjects, users |
| `smoke-phase4-6.mjs` | students, rounds, exam results |
| `smoke-phase9-import.mjs` | import CSV |
| `smoke-phase10-round-subjects.mjs` | รอบที่เลือกเฉพาะบางวิชา |
| `smoke-phase11-carry-forward.mjs` | วิชาที่เคยผ่านแล้วไม่ต้องกรอกซ้ำ |
| `smoke-phase12-reject-edit.mjs` | ตีกลับแล้วนักศึกษาแก้ใบเดิม |
| `smoke-phase13-duplicate-round.mjs` | ปีเดียวกัน + ครั้งที่เดียวกัน สร้างซ้ำไม่ได้ + เปิดรอบได้ทีละรอบเดียว (ลบของที่สร้างทิ้งเองตอนจบ) |
| `smoke-phase14-news-scope.mjs` | นักศึกษาเห็นประกาศเฉพาะรุ่นตัวเอง เจ้าหน้าที่เห็นครบ (ลบของที่สร้างทิ้งเองตอนจบ) |
| `smoke-phase15-reviewer.mjs` | reviewer role (สิทธิ์เข้า/บล็อก), guard กันตรวจซ้อนแบบ race จริง (`Promise.all`), audit log ทางอ้อม (ลบของที่สร้างทิ้งเองตอนจบ) |
| `smoke-phase16-cohort-year.mjs` | ย้ายรุ่น → รอบที่นักศึกษาเห็นเปลี่ยนตามจริง, ส่งผลแล้วย้ายไม่ได้, สิทธิ์ `/dashboard/alerts` + `PATCH /students/:id` ครบ 4 role (ลบของที่สร้างทิ้งเองตอนจบ) |
| `smoke-phase17-import-year.mjs` | ปีจบตอน import: dry run ไม่บันทึก, ปีที่ใส่ถูกใช้ตอนกรอกโปรไฟล์, ปีผิด/ปีเข้าแทนปีจบถูกข้าม, เพิ่มทีละคน + PATCH ใช้กฎเดียวกัน (ลบของที่สร้างทิ้งเองตอนจบ) |

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
| 2026-10-03 | **เก็บกวาดจากรอบตรวจ (11 เรื่อง)** — (1) `GET /dashboard/stats`: executive ไม่ได้ `alreadyPassedStudentIds` (รหัสรายคน) officer ยังได้เหมือนเดิม (`dashboard.controller.js`). (2) `POST /exam-results`: ผ่านครบทุกวิชาของรอบแล้ว → 400 ไม่สร้างใบว่าง (`examResults.controller.js`). (3) approve/reject: `remark` ชนิดผิด (ตัวเลข/object) ไม่ 500 แล้ว — reject → 400, approve → เก็บ null; ยาวเกิน 500 → 400 (`examResults.controller.js`). (4) `errorHandler`: error อักขระ NUL จาก Postgres (22021 / "invalid byte sequence" / "0x00") → 400 เหมือน `isBadInput`; `login` ส่ง error เข้า `next(err)` แทนตอบ 500 เอง ไม่งั้น errorHandler ไม่เห็น (`errorHandler.js`, `authController.js`). (5) `POST/PUT /rounds`: `status` ต้องเป็น open/closed (`rounds.controller.js`) — ยังไม่ได้ล็อกปี/ครั้งที่/วิชาของรอบที่มีผลสอบ (รอเจ้าของระบบตัดสินใจ). (6) แจ้งเตือน "เปิดรับผลสอบรอบ N" ไม่สร้างให้คนที่ผ่านครบแล้ว (`notifications.controller.js`). (7) alert "ยังไม่ส่งผลสอบ N คน" ใช้ฐานคนของรอบ (`roundNotStarted + by.draft`) แทนทั้งรุ่น และเปลี่ยนข้อความ detail (`dashboard.service.js`). (8) PDF รายงานรายรอบใช้ `roundTotal/roundNotStarted/roundFillRate` + แถวค้างร่าง + หมายเหตุ `alreadyPassed`, ป้าย "ส่งผลการสอบรอบแรก" → "ยืนยันผลการสอบรอบแรก" (`dashboard.pdf.js`). (9) ลบ field `overallPassRate` ที่ไม่มีใครใช้ออกจาก `buildStats` + ลบคอมเมนต์ล้าสมัยของ `getAlerts`. (10)(11) เทสเพิ่มใน `smoke-phase29/30` และเพิ่มสองไฟล์นี้ต่อท้ายสคริปต์ `npm test` |
| 2026-10-03 | `/dashboard/stats` เพิ่ม `roundTotal`, `roundNotStarted`, `roundFillRate`, `alreadyPassed` — มุมมองรายรอบของ dashboard เดิมหารด้วยทั้งรุ่น (155) ทั้งที่รอบ 2 มีแค่ 42 คนที่ต้องกรอก (อีก 113 ผ่านครบแล้ว) ทำให้แถบบอก 19% และโดนัทมีวง "ยังไม่เริ่ม" 126 คน. **field เดิม (`total`, `not_started`, `fillRate`) ไม่แก้** — หน้ารายงาน/PDF ยังใช้อยู่และยังรวมกันได้เท่า `total`. % ผ่านทุกตัวยังหารทั้งรุ่น (`dashboard.service.js`, `dashboardReal.jsx`, `i18n.js`) |
| 2026-10-03 | **กระจกสะท้อน local -> Supabase (`utils/supabaseMirror.js`)** — ตั้ง `SUPABASE_DATABASE_URL` ใน `.env` แล้วหลังมีการ POST/PUT/PATCH/DELETE ที่สำเร็จ (ยกเว้น login/logout) รอเงียบ 5 วินาที (debounce) แล้วคัดลอก**ทุกตาราง**ขึ้น Supabase ให้เหมือน local: อ่านต้นทางใน transaction เดียว → ปลายทาง `TRUNCATE ... RESTART IDENTITY CASCADE` + `INSERT ... SELECT * FROM jsonb_populate_recordset(...)` ใน transaction เดียว (ล้มเหลวกลางทางไม่เหลือข้อมูลครึ่งๆ) แล้ว `setval` ตัวนับ id. **ทางเดียว** local → Supabase (ปลายทางถูกล้างแล้วเขียนใหม่ทุกครั้ง ห้ามแก้ที่ Supabase ตรงๆ); ไม่คัดลอกไฟล์ใน `uploads/`; ปฏิเสธถ้า migration สองฐานไม่ตรงกัน (`npm run supabase:migrate` ก่อน); ผิดพลาดแค่ log + ลองใหม่ใน 1 นาที ไม่กระทบคำขอจริง; ปิดเองเมื่อต้นทางเป็น schema ชั่วคราวของเทส/ปลายทางซ้ำต้นทาง และ `run-clean.mjs` ตั้ง `SUPABASE_DATABASE_URL` ว่างให้ server ทดสอบอีกชั้น. คำสั่งใหม่: `npm run supabase:migrate` (สร้างตารางบน Supabase), `npm run sync:supabase` (คัดลอกทันที 1 ครั้ง) — ใช้ connection string แบบ Session pooler/Direct พอร์ต 5432 (ไม่ใช่ 6543). **`supabase:migrate` ล็อกตารางด้วย:** เปิด Row Level Security ทุกตาราง + `REVOKE` สิทธิ์ `anon`/`authenticated` — ไม่งั้น Supabase เปิดตารางใน schema `public` ให้เรียกผ่าน REST API ด้วย publishable key (คีย์สาธารณะ) ได้ ข้อมูลนักศึกษารั่ว (ตรวจแล้ว: เรียก REST ด้วย key นั้นได้ `permission denied for table users`); backend เข้าด้วย role `postgres` (เจ้าของตาราง) ซึ่งข้าม RLS จึงใช้งานปกติ. **รหัสผ่านใน `SUPABASE_DATABASE_URL` ที่มีอักขระพิเศษต้องเข้ารหัส %** (`#`→`%23`, `@`→`%40`, `:`→`%3A`, `/`→`%2F`, `?`→`%3F`) ไม่งั้น URL ไม่ถูกต้อง. ทดสอบแล้ว: 2 schema ในเครื่อง (เนื้อหาเหมือนเป๊ะ, แก้/ลบ/เพิ่มตามทัน, sequence ไม่ชน, ปฏิเสธเมื่อ migrate ไม่ครบ) และ Supabase จริง (สร้างข่าวผ่าน API → ขึ้นที่ Supabase เองใน ~5 วินาที, ลบแล้วกลับเท่าเดิม). **การเทียบข้อมูลสองฐานต้องใช้ `to_jsonb(row)::text` ไม่ใช่ `row::text`** เพราะ `row::text` ใส่เครื่องหมาย `"` ครอบข้อความไทยต่างกันตาม locale ของเครื่อง ทำให้ md5 ไม่ตรงทั้งที่ข้อมูลเหมือนกัน (`scripts/syncSupabase.js`, `scripts/migrateSupabase.js`, `app.js`, `package.json`, `.env.example`, `tests/run-clean.mjs`) |
| 2026-10-03 | **ผู้ดำเนินการ (ใครทำอะไร) + ปิดบัญชีแล้วประวัติไม่หาย (ข้อเสนอแนะอาจารย์ที่ปรึกษา; เทส `smoke-phase28-actor.mjs`)** — `utils/actor.js` ใหม่: `ACTOR_SELECT` + `toActor()` (ดึง `password_hash` มาแค่คำนวณ `is_closed` แล้วตัดทิ้งก่อนส่งออก ใช้ร่วมกันทุกที่) → `GET /api/rounds` แนบ `creator` (นักศึกษาไม่เห็น), `GET /api/news` `poster` มี `is_closed`, `GET /api/exam-results` แนบ `confirmer` + `review_logs` (`news.repository.js`, `rounds.repository.js` + `rounds.controller.js`, `examResults.repository.js`). (รอบแรกไม่แก้ schema เพราะ `created_by` / `posted_by` / `confirmed_by` / `review_logs` มีอยู่แล้ว). **รอบต่อมา (ข้อเสนอแนะอาจารย์ "เพิ่มคอลัมน์ใน DB") เพิ่มคอลัมน์ audit + migration `20261003100000_add_audit_actor_columns`:** `users.created_by/closed_at/closed_by`, `students.eligible_set_by/eligible_set_at`, `submission_rounds.updated_by/updated_at`, `news.updated_by` — controller อ่านผู้ทำจาก JWT (`req.user.userId`) แล้วบันทึกตอนสร้างบัญชี / ปิดบัญชี (`revokeAccess`) / รีเซ็ตรหัส (ล้าง closed_*) / แก้รอบ / แก้ข่าว (รวมเปลี่ยน/ลบรูป) / เปิด-ปิดสิทธิ์กรอก (`bulkSetEligible`); API คืนเป็น actor (ตัด hash ผ่าน `toActor`) — **นักศึกษาไม่เห็น** `creator`/`updater` ของรอบ, `updater` ของข่าว, `eligible_setter`; `studentRepo.findById` แปลง actor ใน repository เองกัน hash หลุด. หน้าเว็บ: ปุ่ม "เปลี่ยนบทบาท" (ใช้ `POST /users/:id/role` เดิม), "สร้างโดย"/"ปิดโดย" ในหน้าผู้ใช้, "แก้ไขล่าสุดโดย" ในรอบ/ข่าว, "เปิดสิทธิ์โดย" ในหน้านักศึกษา, คอลัมน์ "ผู้ตรวจ/ตรวจเมื่อ" ในแท็บยืนยันแล้ว/ถูกตีกลับ, ปุ่มยืนยัน/ตีกลับใน modal ดูไฟล์. **ต้องรัน `npx prisma migrate deploy` + `npx prisma generate` กับ DB จริงก่อนใช้ (generate จะ EPERM ถ้า backend ยังรันอยู่ — ปิดก่อน)**; `seedDemoYears.js` เติมค่าคอลัมน์ใหม่ + เจ้าหน้าที่/ผู้ช่วยตรวจตัวอย่างหลายคน (รวม 2 บัญชีที่ปิดแล้ว) + `review_logs`. frontend: ซ่อนปุ่ม "ลบบัญชี" เหลือ "ปิดบัญชี" (= `revoke` เดิม), โชว์ผู้สร้างรอบ / ผู้โพสต์ข่าว / ประวัติผู้ตรวจ พร้อมป้าย "(ปิดบัญชีแล้ว)" |
| 2026-10-01 | **security review (เทส `smoke-phase27-security.mjs`)** — (1) `ensureCanChangeEvidence` ใช้ `findSubmittableRound` ตัวเดียวกับตอนส่งผล: ใบที่ถูกตีกลับของ**รอบเก่า** (มีรอบใหม่กว่าแล้ว) แนบ/ลบไฟล์ไม่ได้อีก → 409 (เดิมเปลี่ยนหลักฐานได้ตลอดไป) (2) กดแนบพร้อมกันหลายไฟล์เคยได้เกิน 5 ไฟล์ (10 request ได้ 6 ไฟล์) → นับซ้ำหลังบันทึก เกินแล้วถอนแถว + ตรวจซ้ำว่าใบไม่ถูกยืนยันระหว่างอัปโหลด (3) `upload` ลบไฟล์บน disk ทุกทางที่ไม่ได้บันทึก (ตัวแปร `saved` + `catch`) — เดิมเลขใบผลสอบแปลก/ใหญ่เกินทำให้ไฟล์ค้างที่ disk (4) `errorHandler`: เลข id ใหญ่เกิน INT4 (`PrismaClientUnknownRequestError` "Unable to fit integer value") → 400 ข้อความไทย แทน 500 ที่มีข้อความดิบของ Prisma (`certificates.controller.js`, `middlewares/errorHandler.js`, `tests/smoke-phase27-security.mjs`, `tests/run-clean.mjs`, `package.json`) |
| 2026-10-01 | **flow จริงของคณะ (docs/test-plan.md, เทส `smoke-phase25-real-flow.mjs`)** — (1) **แนบหลักฐานหลายไฟล์ PDF/JPG/PNG** สูงสุด 5 ไฟล์ต่อใบ แนบเพิ่ม = ต่อท้าย (เลิกแทนที่ไฟล์ประเภทเดิม) ตรวจชนิดจากหัวไฟล์จริง (`detectFileType`) + **`DELETE /api/certificates/:id`** ให้นักศึกษาลบทีละไฟล์ + `serveFile` ส่ง Content-Type ตาม `file_type`; แนบ/ลบได้เฉพาะเจ้าของ ใบยังไม่ยืนยัน และรอบ active **หรือ** ใบถูกตีกลับ (แก้บั๊ก: ใบรอตรวจเพิ่มไฟล์ได้หลังปิดรอบ) (`certificates.controller.js`, `.repository.js` — `countByResult` แทน `findByResultAndType`, `.routes.js`, `upload.js` → `uploadEvidence`) (2) **ใบที่ถูกตีกลับแก้ส่งใหม่ได้แม้รอบปิด** — `examResults.service.js` ใหม่ → `findSubmittableRound` (รอบ active ก่อน, ไม่มีค่อยดูรอบล่าสุดที่เริ่มแล้วซึ่งใบถูกตีกลับ) ใช้ทั้ง `POST /api/exam-results` และ `GET /api/rounds/active` (เพิ่ม field `can_fix_rejected`), `rounds.repository.js → findLatestStarted` (3) **บั๊ก B1** — `findPassedSubjectIds`, `findEligibleWithPassedSubjects` และ `firstYear` ของ `buildYearSummary` ไม่นับแถว `carried_forward` (วิชาที่ยกมาจากใบที่ถูกตีกลับภายหลังเคยถูกนับว่าผ่าน) (4) **`GET /api/dashboard/export-first-year`** รายชื่อผ่าน/ไม่ผ่านภายในปีแรก (`buildFirstYearList` ใช้ helper กฎเดียวกับ `firstYear`) + export-first-attempt เพิ่มคอลัมน์ชื่อ/นามสกุลอังกฤษ เบอร์โทร อีเมล (`findStudentsByYear`), PDF รวมเป็น `buildPassListPdf` (5) ข้อความ error ทางการไม่มีชื่อ field/ศัพท์เทคนิค: errorHandler 500 → "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง", auth/requireRole/authController/users/students/subjects/news/dashboard, seed reviewer → "ผู้ช่วยตรวจสอบ" (6) แจ้งเตือนหลังยืนยัน/ตีกลับ/ถอนการยืนยัน `await` ก่อนตอบ (ห่อ try/catch) — เดิม fire-and-forget ทำให้ phase20 สะดุดเป็นครั้งคราว · `smoke-phase22-exports.mjs` ปรับหัวคอลัมน์ตามข้อ 4 |
| 2026-09-30 | **ส่งออกข้อมูลนักศึกษาแยกตามรอบ + ชื่อภาษาอังกฤษ + ผู้บริหารไม่ต้องมีอีเมล/เบอร์** — (1) `POST /students/export` รับ `by_round: true` เพิ่ม (ต้องเป็น boolean `true` เท่านั้น) → Excel **หลายชีต**: ชีตแรก "ข้อมูลนักศึกษา" เหมือนเดิม + 1 ชีตต่อ 1 รอบสอบ ("รอบ 1-2569" …) มีเฉพาะนักศึกษาที่มีใบผลสอบในรอบนั้น (สถานะใบ/ผ่านกี่วิชา/ส่งเมื่อ/ยืนยันเมื่อ) เรียงรอบใหม่→เก่า. `utils/xlsxExport.js` เพิ่ม `buildXlsxWorkbook(sheets)` (รูปแบบเดียวกับ `buildXlsx` ทีละชีต). (2) ไฟล์ข้อมูลนักศึกษาเพิ่มคอลัมน์ "ชื่อ (อังกฤษ)"/"นามสกุล (อังกฤษ)" (`students.first_name_en/last_name_en` ที่เก็บอยู่แล้วตั้งแต่ complete-profile; `findForExport` select เพิ่ม + `submitted_at`/`confirmed_at`). (3) `POST /users` — **role `executive` ไม่ต้องส่ง `email`/`phone`** (เก็บเป็น null; คอลัมน์เป็น nullable อยู่แล้ว ไม่แตะ schema) role อื่นยังบังคับเหมือนเดิม. เทส: `tests/smoke-phase24-lifecycle.mjs` ใหม่ — วงจรเต็มของรุ่นหนึ่ง รอบ 1→2→3 (กรอก/ตีกลับ/ส่งใหม่/ยืนยัน/ยกผลรอบก่อน carry-forward/ประกาศ/สถิติผ่านครั้งแรก 2 จาก 5 · ผ่านภายในปีแรก 4 จาก 5/ส่งออกแยกรอบ/สร้างบัญชีผู้บริหาร) 70 ข้อ + เพิ่มตัวเลือก `ONLY=phase24 npm run test:clean` รันไฟล์เดียว, `smoke-phase22` อัปเดตหัวคอลัมน์ใหม่. **ผลเทส: `test:clean` ผ่านทุกไฟล์**. (`utils/xlsxExport.js`, `students/student.controller.js`, `student.repository.js`, `users/users.controller.js`, `tests/*`) — frontend: `officerStudentsReal.jsx` ปุ่มส่งออกเป็นเมนู (ข้อมูล / แยกรอบ / ผู้สอบไม่ผ่านครั้งแรก), ตัวนับ "แสดง N จาก M"; `manageUsersReal.jsx` ซ่อนอีเมล/เบอร์เมื่อเลือกผู้บริหาร; รายงานสรุปบันทึก PDF จากภาพรายงานบนจอ (`exportReportPdf.js`). **ข้อควรรู้:** backend ที่รันค้างอยู่ต้อง restart ถึงจะได้โค้ดนี้ (`npm start` ไม่มี auto-reload) |
| 2026-09-29 | **แก้ `DELETE /api/users/:id` หลุด 500 พร้อม raw SQL error แทน 409** — ทดสอบด้วยข้อมูลจำลองจำนวนมากแล้วพบว่าลบบัญชีที่มี `review_logs` ผูกอยู่ (เคยตรวจ/ยืนยันผลสอบ) ตอบ 500 พร้อมข้อความ Postgres ดิบ (ชื่อ table/constraint จริงหลุดออกไปให้ client เห็น) แทนที่จะเป็น 409 ตามที่ตั้งใจ. **สาเหตุ:** ทุก FK ที่เกี่ยวข้อง (`submission_rounds.created_by`, `news.posted_by`, `review_logs.reviewer_id`) ประกาศเป็น `ON DELETE RESTRICT` ใน migration ซึ่ง Postgres ตอบกลับเป็น SQLSTATE `23001` (restrict_violation) ไม่ใช่ `23503` ที่ Prisma แปลงเป็น `P2003` ให้ — เงื่อนไข `err.code === "P2003"` เดิมจึงไม่จับ กลายเป็น `PrismaClientUnknownRequestError` หลุดไป 500 ตรงๆ. **แก้:** เพิ่ม `UserRepo.countLinkedHistory()` เช็คก่อนลบเสมอ (นับ `submission_rounds`+`news`+`review_logs` ของ user นั้น) แล้ว throw 409 ทันทีถ้ามี — ไม่พึ่ง DB error เป็นด่านหลักอีกต่อไป, catch ท้าย controller เหลือไว้เป็น fallback กันเคส race condition เท่านั้น (ครอบทั้ง `P2003` และข้อความ `restrict...foreign key constraint` ดิบ). เพิ่ม `tests/smoke-phase23-delete-user.mjs` (เคสสำคัญ: ลบสำเร็จ/ซ้ำ/ตัวเอง/role อื่น/ไม่ login/id ผิด/**ลบคนมีประวัติผูก → ต้อง 409 ไม่ใช่ raw error**) เข้า `npm test` + `test:clean`. **ผลเทส: `test:clean` 17/17 ไฟล์** (`users.controller.js`, `users.repository.js`, `tests/smoke-phase23-delete-user.mjs` ใหม่, `package.json`, `run-clean.mjs`) |
| 2026-09-29 | **`DELETE /api/users/:id` — ลบบัญชี officer/executive/reviewer จริง** — เดิมมีแค่ `revoke` (ล็อกไม่ให้ login แต่ record ยังอยู่) เจ้าหน้าที่ต้องการปุ่ม "ลบบัญชี" จริงๆ ด้วยสำหรับบัญชีที่สร้างผิด/ซ้ำแล้วยังไม่เคยใช้งาน. `UserRepo.remove()` = `prisma.user.delete` ตรงๆ ไม่ตั้ง cascade ที่ไหน — บัญชีที่เคยสร้างรอบ/โพสต์ข่าว/ยืนยันผลสอบ/มี `review_logs` ชนกำแพง FK ตอบ `409` บอกให้กดถอนสิทธิ์แทน (วิธีเช็คแก้ใหม่ในรายการถัดขึ้นไป — ดูก่อน). กันลบตัวเอง (`targetId === req.user.userId`) เหมือน revoke/role. frontend: ปุ่ม "ลบบัญชี" แยกจาก "ถอนสิทธิ์" ในหน้าจัดการผู้ใช้ + โมดัลยืนยัน (`users.repository/controller/routes.js`, `manageUsersReal.jsx`, `i18n.js`). และเพิ่มข้อความ "ยังไม่มีข้อมูลนักศึกษา" ตอนตารางว่างในหน้าข้อมูลนักศึกษา (`officerStudentsReal.jsx`) — ก่อนหน้านี้กรองแล้วไม่มีคนตรง ตารางว่างเปล่าไม่มีข้อความอะไรเลย |
| 2026-09-25 | **สถิติ "ผ่าน" ทุกตัวนับเฉพาะใบที่ยืนยันแล้ว (เจ้าของระบบตัดสินใจ)** — เดิมนับไม่ตรงกัน: อัตราผ่านรายวิชานับเฉพาะ approved แต่ผ่านครบ/ผ่านครั้งแรก/ผ่านภายในปีแรก/ตารางผ่านกี่วิชา/ยอดแยกห้อง นับใบ pending ด้วย → ตัวเลขในหน้าเดียวกันขัดกันเอง (วิชาหนึ่งผ่าน 40 แต่ผ่านครบ 45). ตอนนี้ใช้ `onlyConfirmed()` (staff_status = approved) ตัวเดียวเป็นฐานของทุกตัวเลข "ผ่าน" ใน `dashboard.service.js`: `buildStats` (fullyPassed, perSubject, passRateOfSitters), `buildYearSummary` (passedByStudent → fullyPassed/byRoom/firstYear, firstAttempt, passDistribution), `buildFirstAttemptBySubject`, รายชื่อ export ผ่านครั้งแรก. **ตัวหาร % ยังเป็นทั้งรุ่นเหมือนเดิม**; ใบ pending/rejected/draft/ไม่ส่ง ไปอยู่ช่อง "ยังไม่ส่ง/ยังไม่ยืนยัน" (`not_submitted`) และในไฟล์ export อยู่กลุ่ม "ไม่ผ่านครั้งแรก" พร้อมสถานะ "รอตรวจสอบ" (โชว์ผ่านกี่วิชาให้ดูได้). **ไม่แตะ:** `fillRate`/`submitted`/สัดส่วนสถานะ (ยังนับใบรอตรวจเป็น "ส่งผลแล้ว" — `notRejected` ยังใช้กับ `everSubmitted`), `canSubmit`/`alreadyPassedStudentIds` และ carry-forward ฝั่งนักศึกษา (เป็นเรื่องสิทธิ์กรอก ไม่ใช่สถิติ). **field ใหม่:** `stats.confirmed` และ `roundSummaries[].confirmed` = ใบที่ยืนยันแล้วของรอบ = ตัวหารของ `passRateOfSitters`/อัตราผ่านรายรอบ (เดิมหารด้วย `submitted` ที่รวมใบรอตรวจ — ตัวตั้งกับตัวหารต้องฐานเดียวกัน). PDF รายงานเพิ่มหมายเหตุ + จำนวนใบรอตรวจที่ยังไม่นับ. frontend: แถบเหลือง "ยังมีใบรอตรวจสอบ N ใบ ยังไม่นับ" บน Dashboard + หมายเหตุในรายงาน, ป้ายตัวหาร/แถวท้ายตารางผ่านกี่วิชาเปลี่ยนเป็น "ยืนยันแล้ว"/"ยังไม่ส่ง / ยังไม่ยืนยัน" (`dashboardReal.jsx`, `reportsReal.jsx`, `i18n.js`, `userManual.jsx`). เทสที่ปรับ: `smoke-phase11` (ใบรอตรวจยังไม่นับ → approve แล้วนับ), `smoke-phase22` (B รอตรวจอยู่ไม่ผ่าน → approve แล้วเป็นผ่านทั้งไฟล์/history/stats). **ผลเทส: `test:clean` 16/16 ไฟล์**. |
| 2026-09-25 | **Export: รายชื่อผ่าน/ไม่ผ่านรอบแรก + ข้อมูลนักศึกษา (Excel) + รวมการส่งออกไว้ที่เดียว** — เจ้าหน้าที่ขอ export ข้อมูลนักศึกษา และรายชื่อผ่าน/ไม่ผ่านรอบแรกของแต่ละปี (การ์ดเทียบรายปีบน Dashboard) และรู้สึกว่า export กระจายหลายที่. (1) **`GET /dashboard/export-first-attempt`** — `buildFirstAttemptList()` ใน `dashboard.service.js` ใช้กฎเดียวกับ `buildYearSummary` เป๊ะ: รอบแรก = attempt 1 ของปี, ผ่าน = ส่งแล้ว + ไม่ถูกตีกลับ + ผ่านครบวิชาของรอบ (**ใบรอตรวจก็นับ** เหมือนตัวเลขบนการ์ด), ไม่ผ่าน = ทั้งรุ่นที่เหลือ (รวมคนไม่ส่ง/ค้าง draft/ถูกตีกลับ) จึงมีคอลัมน์ "สถานะใบผลสอบรอบแรก" + "วิชาที่ไม่ผ่าน" — ผ่าน + ไม่ผ่าน = ทั้งรุ่นเสมอ ตรงกับ `firstAttempt.passed` (เทสเทียบกับ `/history` ตรงๆ). Excel หรือ PDF (`buildFirstAttemptListPdf` ใน `dashboard.pdf.js`). (2) **`POST /students/export`** — Excel ข้อมูลนักศึกษา (ชื่อ ห้อง ปีจบ อีเมล เบอร์ สิทธิ์กรอก รอบ/สถานะ/ผ่านกี่วิชาของ "ใบล่าสุด" = ปีล่าสุดแล้วครั้งที่สอบมากสุด) รับ `student_ids` (ตัวกรองทำฝั่งหน้าจอ ส่งรายชื่อที่เห็นมา ไม่เขียนตัวกรองซ้ำที่ backend) หรือ `year` — **ไม่ดึง `national_id`** (= รหัสผ่านเริ่มต้น) เทสตรวจว่าไม่หลุดในไฟล์. (3) **`GET /students/export-subject?format=xlsx`** — รายชื่อผ่าน/ไม่ผ่านรายวิชาเพิ่ม Excel (ไม่ส่ง format = PDF เหมือนเดิม). (4) **`utils/xlsxExport.js`** (ใหม่, ใช้ไลบรารี `write-excel-file`) — `buildXlsx()` + `sendXlsx()` ตัวเดียวทุก export: ทุกเซลล์เป็นข้อความยกเว้นคอลัมน์ `type: "number"` (กัน Excel ตัดเลข 0 หน้าเบอร์โทร/แปลงรหัสเป็น E+), แถวหัวตรึง, ชื่อไฟล์ไทยผ่าน `filename*=UTF-8''`. (`utils/xlsxExport.js`, `dashboard.service/controller/routes/repository/pdf.js`, `student.controller/repository.js`, `students.routes.js`, `package.json`, `tests/smoke-phase22-exports.mjs` + เพิ่มใน `run-clean.mjs`) — frontend: `api.js` `downloadFile()` ตัวเดียว, `components.jsx` `ExportMenu`, ปุ่มส่งออกที่การ์ดเทียบรายปี (`dashboardReal.jsx`), หน้ารายชื่อนักศึกษา, แผง "ส่งออกข้อมูล" ในหน้ารายงานสรุป **ผลเทส: `test:clean` 16/16 ไฟล์**. **ข้อควรรู้:** ปุ่ม "ดูรายชื่อ" ของการ์ดเดียวกัน (หน้านักศึกษา) กรองฝั่งหน้าจอเฉพาะใบที่ *ยืนยันแล้ว* จึงอาจน้อยกว่าไฟล์ export (ที่นับใบรอตรวจ/ไม่ส่งด้วยตามตัวเลขบนการ์ด) |
| 2026-09-25 | **ลบนักศึกษาได้ทุกกรณี รวมคนที่มีผลสอบแล้ว (เจ้าของระบบตัดสินใจ)** — เดิมกันไว้ (409) เพราะลบแล้วสถิติของรุ่นเปลี่ยนย้อนหลัง; ผู้ใช้ยืนยันว่าต้องการให้ลบได้หมด. `removeStudentsCascade()` ลบจากตารางลูกขึ้นแม่ใน `$transaction` เดียว: `review_logs` → `certificates` → `subject_results` → `exam_results` → `notifications` → `students` → `users` แล้วค่อยลบไฟล์ PDF บน disk **หลัง** transaction สำเร็จ (ลบไฟล์ก่อนแล้ว DB พัง = หลักฐานหายทั้งที่ข้อมูลยังอยู่). **ตัวกันที่ยังเหลือ = ต้องยืนยันชัดเจน:** มีคนมีผลสอบปนอยู่แล้วไม่ส่ง `delete_results` (เป็น boolean `true` เท่านั้น — ข้อความ "true" ไม่นับ) → 409 `has_exam_results` พร้อมจำนวน และ **ไม่ลบใครเลยแม้คนที่ไม่มีผลสอบในชุดเดียวกัน**. ลบคนที่มีผลสอบบันทึก `[AUDIT]` ใน log ของ server (ใคร/กี่คน/กี่รอบ). ลบเฉพาะนักศึกษา ไม่ลบรอบสอบ. bulk-delete เลิกแบบ "ข้ามคนที่มีผลสอบ" ที่ทำไว้ก่อนหน้า (`skipped_count` → `not_found_count`). **หน้าจอ:** ปุ่ม "ลบ" รายแถวโชว์ทุกคน, หน้ารายละเอียดปุ่มกดได้เสมอ, โมดัลยืนยัน (รายคน/หลายคน) ขึ้นกล่องแดงเตือนแรงเมื่อมีผลสอบ (ลบผลสอบ/เอกสาร/ประวัติตรวจ สถิติเปลี่ยนย้อนหลัง รายงานที่ออกไปแล้วจะไม่ตรงระบบ กู้คืนไม่ได้). **ตัวกรองปีที่จบ** ในแท็บ "บัญชีที่ยังไม่เข้าระบบ" (หน้านำเข้า): เลือกปี พร้อมจำนวนคนต่อปี ใช้ร่วมกับค้นหา/เลือกทั้งหมด/ดาวน์โหลด CSV และกลับไปแสดงทุกปีเองเมื่อปีที่เลือกไม่เหลือแล้ว (`student.repository/controller.js`, `tests/smoke-phase21` ปรับกติกา + เคสใหม่ (ไฟล์ PDF บน disk ถูกลบตาม, ไม่ลบครึ่งๆ, reviewer/executive 403), `officerStudentsReal.jsx`, `studentDetailReal.jsx`, `studentImport.jsx`, `i18n.js`) **ผลเทส: 15/15 ไฟล์ + Playwright end-to-end บน Chrome จริง 22/22** (import → ตัวกรองปี → นักศึกษา login ครั้งแรก+กรอกโปรไฟล์ → ลบบัญชีที่ยังไม่เข้าระบบ → ลบนักศึกษาที่มีผลสอบ) |
| 2026-09-25 | **ปุ่มลบนักศึกษา: หน้ารายละเอียด + ลบหลายคนพร้อมกัน** — เดิมมีแค่ปุ่ม "ลบ" รายแถวในตาราง (เฉพาะคนที่ยังไม่มีผลสอบ). เพิ่ม (1) ปุ่ม **"ลบนักศึกษา"** ในหน้ารายละเอียด (officer เท่านั้น; คนที่มีผลสอบแล้วโชว์ปุ่มแบบกดไม่ได้พร้อม tooltip เหตุผล) ลบแล้วกลับหน้ารายชื่อ; (2) **ลบหลายคน**ในแถบเลือกหลายคนของหน้ารายชื่อ → `POST /students/bulk-delete` (repository `removeManyWithUsers`: หาเฉพาะคนที่ไม่มีผลสอบ แล้วลบแจ้งเตือน + นักศึกษา + user ใน `$transaction` เดียว) modal บอกว่าจะลบกี่คน และมีกี่คนที่ถูกข้ามเพราะมีผลสอบ. กติกาเดิมไม่เปลี่ยน: คนที่มีผลสอบแล้วลบไม่ได้ (สถิติรุ่นเปลี่ยนย้อนหลัง). **แก้ lint ของเอง:** `studentDetailReal.jsx` ใช้ `Date.now()` ระหว่าง render (คำเตือนรอบใกล้ปิดของฟีเจอร์ถอนการยืนยัน) → จับเวลาครั้งเดียวด้วย `useState(() => Date.now())` (`student.repository/controller/routes.js`, `tests/smoke-phase21` +16 เคส) — frontend: `studentDetailReal.jsx`, `officerStudentsReal.jsx`, `i18n.js` **ผลเทส: 15/15 ไฟล์ + Playwright บน Chrome จริง 16/16** |
| 2026-09-25 | **แท็บ "บัญชีที่ยังไม่เข้าระบบ" ใช้ตามนักศึกษาได้** — เจ้าหน้าที่อยากเห็นรายชื่อคนที่ยังไม่ login กรอกโปรไฟล์ครั้งแรกเพื่อตามให้เข้ามา. **ไม่เปลี่ยน backend** (ใช้ `GET /students/pending-accounts` เดิม) — frontend เพิ่ม: เลขจำนวนบนแท็บตั้งแต่เปิดหน้า, คอลัมน์ "ผ่านมาแล้ว N วัน" (≥ 3 วันตัวหนาสีเตือน), ปุ่มดาวน์โหลดรายชื่อที่กำลังแสดงเป็น CSV (`student_id, academic_year, imported_at, days_since_import` — บัญชีกลุ่มนี้ยังไม่มีชื่อ/เบอร์ เพราะยังไม่กรอกโปรไฟล์ มีแค่รหัส). **เรื่องลบนักศึกษาที่มีผลสอบแล้ว:** ยังกันไว้ (409) ตามเดิม — ผู้ใช้ยืนยันว่าคนที่ต้องลบคือรหัสที่ import ผิด ซึ่งไม่มีผลสอบอยู่แล้ว จึงไม่ต้องเปลี่ยนกติกา (`studentImport.jsx`, `i18n.js`) **ผลเทส: Playwright บน Chrome จริง 7/7** |
| 2026-09-25 | **ลบบัญชีนักศึกษาที่ import แล้วยังไม่กรอกโปรไฟล์ได้** — บัญชีกลุ่มนี้มีแค่แถว `users` ไม่มี `students` เลยไม่โผล่ในหน้า "ข้อมูลนักศึกษา" และ `DELETE /students/:id` (หาจาก `students`) ลบไม่ได้ → import รหัสผิด (เช่นจาก Google Form) แล้วไม่มีทางเอาออก. เพิ่ม `GET /students/pending-accounts` + `POST /students/pending-accounts/delete` (route อยู่ก่อน `/:id`). ลบผ่าน `user.deleteMany` ที่ `where` มี `student: null` + role นักศึกษา จึงลบคนที่กรอกโปรไฟล์แล้วไม่ได้แม้ส่งรหัสมา (ต้องไปลบที่หน้านักศึกษา ซึ่งกันคนที่มีผลสอบไว้เหมือนเดิม — **ตั้งใจไม่ให้ลบคนที่มีผลสอบแล้ว** เพราะสถิติย้อนหลังของรุ่นจะเปลี่ยน). ตารางอื่นไม่ได้ชี้มาที่ user กลุ่มนี้ (ไม่มีผลสอบ/แจ้งเตือน/ประกาศ) จึงไม่ติด FK (`students.repository.js`, `student.controller.js`, `students.routes.js`, `tests/smoke-phase21-pending-accounts.mjs` ใหม่ ~26 เคส, `run-clean.mjs`, `package.json`) — frontend: แท็บ "บัญชีที่ยังไม่เข้าระบบ" ในหน้านำเข้า (ค้นหา เลือกหลายคน ยืนยันก่อนลบ) `studentImport.jsx`, `i18n.js` **ผลเทส: 15/15 ไฟล์ + Playwright บน Chrome จริง 11/11** |
| 2026-09-25 | **import: ทดสอบกับไฟล์ Google Sheets จริง → แก้ 3 เรื่อง** (ไฟล์ `ฟอร์มไม่มีชื่อ (การตอบกลับ).xlsx` ของเจ้าหน้าที่) — (1) **Google Sheets เขียนตัวเลขใน .xlsx เป็น `1412.0` / `2570.0`** ทำให้รหัสนักศึกษา "ต้องเป็นตัวเลข" และปีจบ "ต้องเป็นตัวเลข 4 หลัก" ถูกปฏิเสธทั้งที่เป็นเลขปกติ (ไฟล์จำลองที่ทดสอบก่อนหน้าไม่เคยมีรูปนี้) → `plainNumberText()` ตัด `.0` ท้าย. (2) **Sheets เขียนเลขยาวเป็น `6.610210001E9` แต่ครบทุกหลัก** (ต่างจาก Excel CSV ที่ตัดเหลือ 6 หลัก) → แปลงกลับเมื่อตัวเลขหลังจุดครบตามเลขชี้กำลังพอดี. **ยกเลิกการเติม 0 ให้ E-notation ใน .xlsx** ที่เพิ่มไว้ก่อนหน้า (`1.92990E+12` → `1929900000000`): ไฟล์ที่เคยเป็น CSV (ตัดหลักแล้ว) แล้วเปิดใน Excel บันทึกเป็น .xlsx หน้าตาเป็นเซลล์ตัวเลขปกติ แยกไม่ออกจากเลขเต็ม → เติม 0 = เลขบัตร (รหัสผ่าน) ผิดคนเงียบๆ; ตอนนี้ไม่เติมทุกกรณี ถูกปฏิเสธพร้อมบอกให้ใช้ไฟล์ .xlsx ต้นฉบับ. (3) หัวคอลัมน์ `รหัส` เฉยๆ (ตรงเป๊ะ) = รหัสนักศึกษา; หัวอื่นที่เดาไม่ได้ (`13 หลัก`, `ปีพศ`) ให้เลือกเองผ่านแผงเลือกคอลัมน์ตามเดิม (`student.controller.js`, `tests/smoke-phase9-import.mjs` +5 เคส + fixture `students-google-sheets-style.xlsx` จำลองรูปแบบเดียวกัน — ไม่ commit ไฟล์จริงเพราะมีข้อมูลทดสอบ) **ผลเทส: 14/14 ไฟล์ + ยิงไฟล์จริง 3 แบบผ่าน** |
| 2026-09-25 | **import: จับคู่คอลัมน์อัตโนมัติ + ให้เจ้าหน้าที่เลือกคอลัมน์เอง** — Google Form ใช้ชื่อคำถามเป็นหัวคอลัมน์ (เช่น `student_id(รหัสนักศึกษา)`) ซึ่งตารางชื่อที่ระบบรู้ (`COLUMN_ALIASES`) เพิ่มเท่าไรก็ไม่ครบ. เปลี่ยนเป็น: (1) เก็บหัวคอลัมน์ดิบตามไฟล์ แล้ว `guessColumns()` เดาจาก **ชื่อตรงเป๊ะ → มีคำสำคัญอยู่ข้างใน** (`student_id`/`รหัสนักศึกษา`, `national_id`/`เลขบัตร`/`ปชช`, `academic_year`/`ปีจบ`/`graduation`) — ช่องหนึ่งตรงหลายคอลัมน์ = กำกวมไม่เดา; `ปีการศึกษา` เฉยๆ รับเฉพาะตรงเป๊ะ เพราะ `ปีการศึกษาที่เข้า` คือปีเข้าเรียน (เดาเป็นปีจบ = นักศึกษาเห็นรอบสอบผิดรุ่นเงียบๆ). (2) เดาไม่ได้ → `400 { code: "missing_columns", columns, mapping, missing }` (`columns` = หัวในไฟล์) หน้าจอทำช่องเลือก 3 ช่อง แล้วส่ง **field `mapping`** (JSON ในฟอร์ม multipart: `{"student_id":"หัวคอลัมน์",...}`) มาทั้งตอน dry_run และตอนยืนยัน — เลือกเองชนะการเดาเสมอ, เลือกซ้ำ/ไม่มีในไฟล์ = 400. (3) response เพิ่ม `columns_used` (คอลัมน์ที่ถูกใช้จริง) ให้หน้าจอโชว์ก่อนยืนยัน. ApiError ฝั่ง frontend เก็บ `payload` ทั้งก้อนไว้ (`student.controller.js`, `tests/smoke-phase9-import.mjs` +11 เคส) — frontend: `studentImport.jsx` แผงเลือกคอลัมน์ + บรรทัด "คอลัมน์ที่ใช้", `api.js` `ApiError.payload`, ไฟล์ตัวอย่าง `.xlsx` ที่ตั้งคอลัมน์เป็น Text (`frontend/public/student_import_template.xlsx` — ยกเว้นใน `.gitignore`) **ผลเทส: 14/14 ไฟล์ + Playwright บน Chrome จริง 10/10** |
| 2026-09-25 | **import รับเลขบัตรได้หลายรูปแบบ** — `cleanIdText()` ตัดสัญลักษณ์ทุกชนิดเหลือเฉพาะตัวอักษร/ตัวเลข (ขีด ช่องว่าง จุด `'` นำหน้าแบบ Excel อักขระล่องหน) + แปลงเลขไทย/เลขเต็มความกว้าง + `1234567890123.0` → ตัดแล้วต้องเป็นตัวเลข 13 หลักเท่านั้น. ตัวอักษรปน (`12345abc90123`) ไม่ถูกตัดทิ้ง ยังถูกปฏิเสธ. `1.23E+12` (เลขหายจาก CSV) ตรวจก่อนตัดสัญลักษณ์ ยังบอกสาเหตุเรื่อง Excel เหมือนเดิม ; คีย์เวิร์ดหัวคอลัมน์ปีจบเพิ่ม `จบ` (รับ `ปีการศึกษาที่จบ` / `ปีการศึกษา จบ` ที่เดิมเดาไม่ได้แล้วช่องปีจบถูกเมินเงียบๆ) (`student.controller.js`, `tests/smoke-phase9-import.mjs` +17 เคส) **ผลเทส: 15/15 ไฟล์ผ่าน** |
| 2026-09-25 | **import รับข้อมูลจาก Google Form (Sheets → ดาวน์โหลด .xlsx/CSV)** — คนกรอกเองมักพิมพ์เลขบัตรมีขีดคั่น/ช่องว่าง (`1-9299-00326-09-1`) หรือเป็นเลขไทย (`๑๙๒๙...`) ซึ่งเดิมถูกปฏิเสธ "ต้องเป็นตัวเลข 13 หลัก". เพิ่ม `cleanIdText()` ตัดขีดคั่น/ช่องว่างและแปลงเลขไทยเป็นเลขอารบิกก่อนตรวจ (ไม่เดาตัวเลข — ถ้ายังไม่ครบ 13 หลักก็ปฏิเสธเหมือนเดิม). คอลัมน์เกิน (Timestamp, ชื่อ, อีเมล ฯลฯ) ถูกข้ามอยู่แล้ว อ่านเฉพาะ `student_id, national_id, academic_year` (`student.controller.js`, `tests/smoke-phase9-import.mjs` +2 เคส) **ผลเทส: 14/14 ไฟล์ผ่าน** |
| 2026-09-25 | **import ทนไฟล์ที่เจ้าหน้าที่พิมพ์เองมากขึ้น** — เจ้าหน้าที่พิมพ์เลข `1929900326091` ใน Excel แล้วนำเข้าไม่ได้ (ยังไม่รู้ข้อความที่เห็น). (1) **หัวคอลัมน์ยืดหยุ่น:** รับ `Student ID` / `รหัสนักศึกษา` / `เลขบัตรประชาชน` / `national id` / `ปีการศึกษา` ฯลฯ เป็นชื่อเดียวกับที่ระบบรู้จัก (`COLUMN_ALIASES` + `canonicalColumn` — trim, ตัวเล็ก, ช่องว่าง/ขีดกลาง → `_`) ใช้ทั้ง CSV และ .xlsx; ถ้าหัวไม่ตรงจริงยังบอกว่าไฟล์มีคอลัมน์อะไรบ้าง. (2) **.xlsx: เลขที่ไฟล์เขียนเป็น `1.929900326091E+12`** แปลงกลับเป็นจำนวนเต็มเมื่อเป็น safe integer (ใน .xlsx ค่านี้คือเลขเต็ม ต่างจาก CSV ที่เป็นแค่ข้อความที่แสดง จึงปลอดภัย). (`student.controller.js`, `tests/smoke-phase9-import.mjs` +3 เคส + fixture `students-sci-notation-thai-headers.xlsx`; เคสเดิม "หัวคอลัมน์ผิด" เปลี่ยนไปใช้หัวที่ผิดจริงเพราะ `รหัส,เลขบัตร` เป็น alias แล้ว) **ผลเทส: 14/14 ไฟล์ผ่าน** |
| 2026-09-25 | **ถอนการยืนยัน + import Excel (.xlsx)** — (1) **`PATCH /exam-results/:id/revoke-approval`** (เจ้าหน้าที่ยืนยันผิด): เดิมใบที่ approved แล้วแก้/ตรวจซ้ำไม่ได้เลย (409 ทั้งนักศึกษาและเจ้าหน้าที่) ต้องพึ่งการแก้ DB. ตอนนี้ officer ถอนได้ → ใบกลับเป็น `pending` (ล้าง `confirmed_by/at/remark`) ต้องใส่เหตุผลเสมอ บันทึก `review_logs` (`action = "revoked"`) แจ้งเตือนนักศึกษา; `updateMany where staff_status = approved` กันกดซ้ำ/พร้อมกัน. **กติกาเวลาไม่เปลี่ยน:** ใบ `pending` นักศึกษาแก้ได้เฉพาะตอนรอบเปิดรับ — รอบปิด/หมดเวลาแล้วต้องให้เจ้าหน้าที่เลื่อนวันปิด + ติ๊กเปิดรอบในหน้าแก้รอบก่อน (เปิดรอบที่เลยวันปิดแล้วจะถูกปฏิเสธ ต้องแก้วันปิดพร้อมกัน). frontend เตือนตอนตีกลับ/ถอนถ้ารอบปิดแล้วหรือเหลือ < 3 วัน. (2) **import รับไฟล์ `.xlsx`** (`read-excel-file`): Excel บันทึก CSV ตามที่ *แสดง* → เลขบัตร 13 หลักกลายเป็น `1.23457E+12` เลขหายจริง กู้ไม่ได้ (เดาแล้วผิด = รหัสผ่าน/ตัวตนผิดคนเงียบๆ) แต่ .xlsx เก็บเลขเต็ม — อ่านตรงด้วย `parseNumber: (s) => s` (ไม่ผ่าน float) ตรวจชนิดจาก magic bytes `PK`. ข้อความ error เลข E+12 บอกให้ใช้ .xlsx. (3) `run-clean.mjs` ลบไฟล์อัปโหลดที่เทสสร้างค้างไว้ (ลบ schema แต่ไฟล์ยังค้าง) (`examResults.controller/repository/routes.js`, `student.controller.js`, `package.json`, `schema.prisma` คอมเมนต์ action, `tests/smoke-phase20` +10 เคส, `tests/smoke-phase9` +5 เคส + `tests/fixtures/students-numeric-ids.xlsx`, `tests/run-clean.mjs`) — frontend: `studentDetailReal.jsx` ปุ่ม+โมดัลถอนการยืนยัน + คำเตือนรอบปิด, `studentImport.jsx` รับ .xlsx, `userManual.jsx` แก้หน้านำเข้า (เดิมเขียนคอลัมน์แบบเก่า `first_name, room_name` ที่ระบบเลิกใช้แล้ว), `notifications.js`, `i18n.js` **ผลเทส: 14/14 ไฟล์ผ่าน** |
| 2026-09-25 | **ตรวจบั๊กรอบ 2 (ส่วนที่เหลือของระบบ + กดจริงใน Chrome ทุกหน้า) แล้วแก้** — (1) **รายชื่อนักศึกษา/รายวิชา/ห้องไม่มี `orderBy`:** Postgres คืนตามลำดับที่เก็บบน disk ซึ่งเปลี่ยนทุกครั้งที่ UPDATE → แก้ข้อมูลนักศึกษา/วิชาแล้วแถวโดดไปท้ายตาราง และหน้ากรอกผลสอบของนักศึกษาเรียงวิชาสลับ. ตอนนี้ นักศึกษา = รุ่นใหม่ก่อนแล้วตามรหัส, วิชา = ตามรหัสวิชา, ห้อง = ตาม id. (2) **เวลาปิดรับระดับนาที:** ฟอร์มส่ง `2090-06-30T23:59` (ไม่มีวินาที) เดิมเก็บ `23:59:00` → นักศึกษาที่ส่งตอน 23:59:30 ถูกปฏิเสธทั้งที่หน้าจอบอกว่ายังไม่ปิด. ตอนนี้ปิดรับที่ไม่ระบุวินาที = สิ้นนาทีนั้น `:59.999` (เปิดรับยังเป็น `:00`; ระบุวินาทีมาก็ใช้ตามนั้น) — **ผลข้างเคียง:** เปิดรับ=ปิดรับนาทีเดียวกันกลายเป็นช่วง 1 นาทีที่ถูกต้อง (เทสเดิมที่คาดว่า 400 เปลี่ยนเป็น "ปิดก่อนเปิด 1 นาที"). (3) **`daysUntil` ของแจ้งเตือนรอบใกล้ปิดใช้ `setHours`** (timezone เครื่อง server — กับดักเดียวกับที่ `roundPhase.js` เตือนไว้) deploy บนเครื่อง UTC แล้วจำนวนวันเหลือเพี้ยน 1 วัน; PDF รายงาน 3 จุดใช้ `toLocaleString("th-TH")` ไม่ระบุ timezone เวลาเพี้ยน 7 ชม. → ใช้เวลาไทย (UTC+7) ตายตัว. (4) **โปรไฟล์นักศึกษา (กรอกครั้งแรก + เจ้าหน้าที่แก้) ไม่ตรวจอะไรเลย:** ชื่อเป็นช่องว่าง, อีเมล/เบอร์ผิดรูปแบบ, ยาวเกิน VarChar(100/20) ผ่านหรือพังเป็น 500 → `cleanProfileInput()` ใช้ร่วมสองจุด. `resetPassword` ของนักศึกษารับ `national_id` เป็นตัวเลขแล้ว bcrypt พัง 500. (5) **ข้อความ error ของ multer เป็นอังกฤษ** ("File too large") → แปลไทยใน `errorHandler`; ข้อความโพสต์ประกาศว่างเดิมเป็น "ต้องส่ง title, content และ round_id" → ไทย (`student.repository/controller`, `subjects.repository`, `rooms.repository`, `rounds.controller`, `dashboard.service/pdf`, `students.pdf`, `news.controller`, `errorHandler`, `tests/smoke-phase18` เพิ่ม 3 เคส + `smoke-phase20` เพิ่ม ~13 เคส, `tests/cleanupYears.mjs` ลบไฟล์ PDF บน disk ด้วย — เดิมลบแต่แถวใน DB ไฟล์เทสค้างสะสม 58 ไฟล์) — frontend: **`index.css` เหลือบล็อก `prefers-color-scheme: dark` จาก template Vite** แอปมีแต่โหมดสว่าง ผู้ใช้ที่เปิด dark mode ในเครื่องเห็นตัวอักษรที่ไม่ได้ระบุสีเป็นสีอ่อนบนพื้นสว่าง + scrollbar/ช่องวันที่เป็นสีมืด (ต้นเหตุจริงของหัวข้อ "กรอกโปรไฟล์สำเร็จ" ที่จาง) → `color-scheme: light` + ลบบล็อก dark; รหัสนักศึกษาในตาราง `--ink-400` คอนทราสต์ 2.6:1 → `--ink-500`; ปุ่มเมนูมือถือไม่มี `aria-label`; ปุ่มในโมดัลแก้ประกาศเขียน "เผยแพร่" → "บันทึกการแก้ไข" **ผลเทส: 14/14 ไฟล์ผ่าน** |
| 2026-09-24 | **ตรวจบั๊กทั้งระบบ (อ่านโค้ดทุก module + เทสใน Chrome ทุก role) แล้วแก้** — (1) **นักศึกษาเขียนทับใบที่ยืนยันแล้วได้ (race):** controller เช็ค `approved` แล้วค่อยเรียก `resubmitWithSubjects` แต่ระหว่างนั้นเจ้าหน้าที่กดยืนยันได้พอดี → ใบที่ถูกเซ็นกลับเป็น "รอตรวจ" ผลถูกเปลี่ยน. ย้ายด่านเข้า repository เป็น transaction: `updateMany where staff_status ≠ approved` count=0 → 409. (2) **อัปโหลด/เปลี่ยนเอกสารหลังยืนยันแล้วได้** → 409 + เช็ค magic bytes `%PDF-` (mimetype มาจาก client แก้ได้) + สร้างใบใหม่ก่อนลบใบเก่า (เดิม create พังแล้วหายทั้งคู่) + `Content-Disposition` ใช้ `filename*=UTF-8''` (ชื่อไทยเดิมเพี้ยน). (3) **ลบวิชาที่รอบใช้อยู่ได้** (`subject_ids` เป็น `Int[]` ไม่มี FK คุม) → รอบเหลือ 0 วิชา + `all_passed = [].every()` = true นักศึกษาเห็น "ผ่านครบ" ผิดๆ. ตอนนี้ลบไม่ได้ (409 บอกรอบ) และ `all_passed` ต้องมีวิชา ≥ 1. (4) **วิชา/ประกาศ/ผู้ใช้/login/นักศึกษา ไม่ตรวจ input:** ส่ง `req.body` ลง Prisma ตรงๆ (ขาด field/ผิดชนิด/ยาวเกิน = 500, แอบส่ง field แปลกมาแก้ได้), รหัสวิชาซ้ำได้, ประกาศชี้รอบที่ไม่มี = FK พัง 500, ส่ง object/ตัวเลขแทนข้อความ = 500 → ตอนนี้ 400/409. (5) **`errorHandler`:** Prisma `P2003` → 409, `PrismaClientValidationError`/`P2000` → 400, และ **500 ใน production ไม่ส่งข้อความดิบ** (เดิมหลุดชื่อตาราง/คอลัมน์/query ให้ client) (`examResults.repository.js`, `certificates.controller.js`, `subjects.controller.js/repository.js`, `news.controller.js`, `users.controller.js`, `authController.js`, `student.controller.js`, `rounds.controller.js`, `errorHandler.js`, `tests/smoke-phase20-hardening.mjs` ใหม่ ~23 เคส) — frontend: `app.jsx` ตอนเปิดหน้าเทียบ user ใน localStorage กับ `/auth/me` (เดิมทิ้งผล /me: เจ้าหน้าที่เปลี่ยน role ให้คนที่ login อยู่ = หน้ายังโชว์เมนู role เก่า กดอะไรก็ 403) + badge "รอตรวจ" นับใหม่ทันทีหลังยืนยัน/ตีกลับ, `completeProfile.jsx` หัวข้อสำเร็จสีจางมองไม่เห็น (ไม่ได้ระบุสี รับ `h2` จาก index.css), `login.jsx` ป้าย TH "จดจำรหัสผ่าน" ทั้งที่จำแค่ username **ผลเทส: 14/14 ไฟล์ผ่าน + เดินหน้าจอจริงใน Chrome ครบทั้ง 4 role** |
| 2026-09-24 | **แก้ import CSV ให้ทนไฟล์ที่ Excel สร้างจริง** — (1) **แถวรหัสนักศึกษาซ้ำกันเองในไฟล์เดียว:** dry run (ตรวจไฟล์) ไม่เขียน DB จึงเช็คซ้ำจาก DB ไม่ได้ ใบตรวจบอกว่านำเข้าได้ 2 คน แต่ตอนนำเข้าจริงเข้าแค่ 1 (ตัวเลขที่เจ้าหน้าที่เห็นก่อนกดยืนยันไม่ตรงความจริง). เพิ่ม `seenInFile` ข้ามแถวหลังพร้อมบอก "ซ้ำกับแถว N ในไฟล์เดียวกัน". (2) **เลขบัตร Excel แปลงเป็น `1.23457E+12`:** เดิมบอกแค่ "ต้องเป็นตัวเลข 13 หลัก" ทั้งที่ในช่อง Excel ดูเป็นตัวเลขอยู่ → ตอนนี้บอกสาเหตุ + วิธีแก้ (ตั้งคอลัมน์เป็น Text). (3) **รับ delimiter `,` `;` tab** (Excel บางภาษา save คั่นด้วย `;` เดิมได้ error "ขาดคอลัมน์") + **ชื่อคอลัมน์ไม่สนตัวพิมพ์/ช่องว่าง** + error "ขาดคอลัมน์" บอกด้วยว่าไฟล์มีคอลัมน์อะไร. (4) **ข้ามแถวว่าง `,,`** ท้ายไฟล์ที่ Excel ทิ้งไว้ (เดิมขึ้น "ข้อมูลไม่ครบ" เป็นสิบแถว) + `trim()` ค่าในเครื่องหมายคำพูดซ้ำอีกชั้น (`student.controller.js`, `tests/smoke-phase9-import.mjs` เพิ่ม 8 เคส dry_run) — frontend: `studentImport.jsx` + `i18n.js` เพิ่มป้าย "ซ้ำในไฟล์" **ผลเทส: 13/13 ไฟล์ผ่าน** |
| 2026-09-24 | **แก้บั๊กนักศึกษาใหม่กรอกโปรไฟล์ไม่ได้ (เลือกห้องเรียนไม่ได้)** — commit `fff32de` ใส่ `authenticate` ให้ `GET /api/rooms` แต่ `authenticate` บล็อกนักศึกษาที่ยังไม่มี student row ทุก path ยกเว้น `/me` กับ `/complete-profile` → หน้ากรอกโปรไฟล์โดน 403 ตอนดึงห้อง dropdown ว่าง = **นักศึกษาใหม่ทุกคนเข้าระบบไม่ได้**. เพิ่ม `PROFILE_SETUP_ROUTERS = ["/api/rooms"]` เช็คจาก `req.baseUrl` (endpoint อื่นยังโดนกันเหมือนเดิม). เทสเดิมไม่จับเพราะดึงห้องด้วย token เจ้าหน้าที่ (`middlewares/auth.js`, `tests/smoke-phase16` เพิ่มเคสดึงห้องด้วย token นักศึกษาก่อนกรอกโปรไฟล์) — frontend: `completeProfile.jsx` โหลดห้องพังให้ขึ้นข้อความ ไม่กลืน error เงียบ **ผลเทส: 13/13 ไฟล์ผ่าน** |
| 2026-09-24 | **`GET /rounds/active` ส่งรอบที่ตั้งเปิดไว้ล่วงหน้ามาด้วย** — เดิมใช้ `findActive()` (กรองวันที่) รอบที่เจ้าหน้าที่กดเปิดไว้แต่ยังไม่ถึงวันเปิดจึงได้ `null` นักศึกษาเห็นแค่ "ไม่มีรอบเปิด" ไม่รู้ว่าต้องรอถึงเมื่อไหร่. ตอนนี้ใช้ `findOpenForYear()` ใหม่ (ไม่กรองวันที่) แล้วแปะ `phase` มา — หน้าจอบอก "รอบที่ N จะเปิดวันที่ ..." / "หมดเวลากรอก". **ความปลอดภัยไม่เปลี่ยน:** `POST /exam-results` ยังใช้ `findActive()` ส่งก่อนวันเปิดถูกปฏิเสธเหมือนเดิม (`rounds.repository.js`, `rounds.controller.js`, `tests/smoke-phase16` เพิ่มข้อ 4.1) — frontend: `student.jsx`, `examFormReal.jsx`, `newsReal.jsx` เช็ค `phase` ก่อนให้กรอก, `i18n.js` **ผลเทส: 13/13 ไฟล์ผ่าน** |
| 2026-09-23 | **ปิด 3 ช่องโหว่ที่เหลือใน Security Checklist** — (1) **เพิ่ม `helmet`** ใส่ security header ให้ทุก response (`X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Referrer-Policy`, HSTS ฯลฯ) วางไว้บนสุดก่อน middleware อื่นเพื่อให้ครอบ error response ด้วย. ปิด 2 ตัวที่ชนการใช้งานจริง: `contentSecurityPolicy` (frontend 5174 กับ backend 3000 คนละ origin) และตั้ง `crossOriginResourcePolicy: cross-origin` (ไม่งั้น PDF/รูปที่ frontend ดึงจาก backend โดนบล็อก — ทดสอบแล้วว่า `/certificates/:id/file` ยังส่ง `application/pdf` ได้ปกติ). (2) **`PATCH /api/auth/password` ไม่เคยมี rate limit เลย** — ขโมย cookie มาได้แล้วไล่เดา `current_password` กี่ครั้งก็ได้เพื่อยึดบัญชีถาวร ตอนนี้ 10 ครั้ง/15 นาที นับตาม IP (body ไม่มี id ให้แยก รู้ตัวตนจาก token อยู่แล้ว). **`POST /api/auth/login` เพิ่มชั้นที่ 2 นับตาม IP** (60 ครั้ง/15 นาที) — ชั้นเดิมนับตาม `psu_passport_id` ซึ่งกันการหมุนเปลี่ยน id ไปเรื่อยๆ ไม่ได้ (credential stuffing) ตั้งไว้สูงเผื่อทั้งห้องใช้เน็ตตัวเดียวกัน. (3) **`GET /api/rooms` ไม่ public อีกต่อไป** — เปิดไว้ตั้งแต่ตอนมีหน้าสมัครสมาชิก ซึ่งถูกตัดออกไปแล้ว ที่เรียกจริง 2 จุด (`completeProfile.jsx`, `studentDetailReal.jsx`) อยู่หลัง login ทั้งคู่. ⚠️ `tests/run-clean.mjs` ใช้ endpoint นี้เป็น health check — แก้ `waitForServer()` ให้ถือว่า "ตอบอะไรกลับมาก็คือขึ้นแล้ว" ไม่เช็ค `res.ok` (401 ก็แปลว่า server รับ request ได้) ไม่งั้นรอจนหมดเวลาแล้วคิดว่า server ไม่ขึ้น (`package.json` +helmet, `app.js`, `modules/auth/auth.routes.js`, `modules/rooms/rooms.routes.js`, `tests/run-clean.mjs`, `tests/smoke-phase9-import.mjs` เพิ่มเคส 401 ตอนไม่ login) **ผลเทส: 13/13 ไฟล์ผ่าน** |
| 2026-09-23 | **กติกาวันที่ของรอบ + `phase` + ด่านกันคำขอไม่ครบ** — (1) **รอบ: เปิดรับต้องมาก่อนปิดรับ** เดิมไม่มีการเทียบเลยทั้ง create และ update เจอรอบจริงในระบบที่ เปิดรับ 26 ก.ย. / ปิดรับ 23 ก.ย. และ `status="open"` → `findActive()` ต้องการ `open_date <= now <= close_date` จึงหาไม่เจอตลอดกาล นักศึกษากรอกไม่ได้สักคน และเปิดรอบอื่นก็ไม่ได้ (ระบบยอมให้เปิดทีละรอบ) = ล็อกตายโดยไม่มี error ขึ้นเลย. `update` ตรวจจาก **ค่าหลังแก้** ไม่ใช่เฉพาะ field ที่ส่งมา (ส่งแค่ `close_date` ก็ทำให้ช่วงพังได้). เพิ่ม `ensureNotAlreadyExpired` — กดเปิดรอบที่เลยวันปิดแล้วไม่ได้ (เปิดไปก็ไม่มีใครกรอกได้). (2) **`phase` = สถานะจริง ณ ตอนนี้** (`utils/roundPhase.js`): `closed` / `scheduled` (ยังไม่ถึงวันเปิด) / `active` (รับกรอกได้จริง) / `expired` (เลยวันปิดแต่ยังไม่กดปิด) คำนวณตอนส่งออกทุกครั้ง ไม่ใช่คอลัมน์ใน DB (ค่าเปลี่ยนเองตามเวลาโดยไม่มีใครกดอะไร). แปะให้ `GET /rounds`, `GET /rounds/active`, `POST/PUT /rounds` และ **`/dashboard/stats` + `/dashboard/history`** — dashboard เดิมส่ง `round` มาแค่ `{round_id, academic_year, attempt_number, status}` **ไม่มีวันที่** หน้าจอเลยเขียน "เปิดรับอยู่" ให้รอบที่ยังไม่ถึงวันเปิด แล้วนับถอยหลังวันปิดด้วย. (3) **`PATCH /students/bulk-eligible` ไม่ตรวจ body เลย** — repository ใช้ `updateMany({ where: { student_id: { in: student_ids } } })` และ Prisma ตีความ `{ in: undefined }` ว่า "ไม่มีเงื่อนไขนี้" ไม่ใช่ "ไม่ตรงกับอะไร" → ส่ง `{"exam_eligible": false}` มาโดยลืม `student_ids` = **ปิดสิทธิ์กรอกผลสอบของนักศึกษาทั้งระบบในคำสั่งเดียว** แล้วตอบ 200 เหมือนปกติ. ตอนนี้บังคับ `student_ids` เป็น array ไม่ว่าง + `exam_eligible` เป็น boolean แท้. (4) **`errorHandler` ดัก Prisma `P2025` → 404** (เดิมหลุดเป็น 500 พร้อม error ดิบที่เผยชื่อตาราง/คอลัมน์) — กระทบทุก endpoint ที่ PUT/DELETE ด้วย id ที่ไม่มีจริง (`utils/roundPhase.js` ใหม่, `rounds.controller.js`, `dashboard.service.js`, `students/student.controller.js`, `middlewares/errorHandler.js`, `tests/smoke-phase18-round-dates.mjs` + `smoke-phase19-guards.mjs` ใหม่, `tests/smoke-phase10/13` เปลี่ยนวันที่รอบทดสอบจากปี 2020 เป็นอนาคต เพราะกดเปิดรอบที่หมดอายุไม่ได้แล้ว, `package.json`, `tests/run-clean.mjs`) — frontend: `roundPhase.js` ใหม่ (helper อ่าน phase + สีป้าย), `usePagedList.js` ใหม่, `skeletons.jsx` ใหม่, และ `dashboardReal/manageRoundsSubjectsReal/newsReal/manageUsersReal/components/app/login/i18n` **ผลเทส: 13/13 ไฟล์ผ่านบน schema สะอาด** |
| 2026-09-23 | **เก็บกวาดความเสถียร 5 เรื่อง ก่อนนำเสนอ (ยังไม่ deploy)** — (1) **PrismaClient เหลือตัวเดียวทั้งระบบ**: เดิม 13 ไฟล์ต่าง `new PrismaClient()` ของตัวเอง ทั้งที่ `config/db.js` เขียน singleton ไว้แล้วแต่ไม่มีใครใช้ แต่ละ client เปิด connection pool ของตัวเอง (default = core×2+1) เครื่อง 8 core = 17×14 ≈ 238 connection แต่ PostgreSQL `max_connections` default 100 → คนใช้พร้อมกันหลายคนแล้วเจอ `too many clients already`. ตอนนี้ทุก repository + `middlewares/auth.js` + `controllers/authController.js` `import prisma from ".../config/db.js"` (`config/db.js` เขียนกฎห้ามสร้างเองไว้ในคอมเมนต์แล้ว — `prisma/*.js` กับ `scripts/*.js` ยกเว้นได้ เพราะเป็น script รันจบแล้วปิดเอง). (2) **reviewer เปิดไฟล์ PDF หลักฐานได้แล้ว**: `certificates.controller.js` เช็ค `role === "officer"` ตัวเดียว แต่ reviewer กด approve/reject ได้ (`examResults.routes.js`) และหน้า `studentDetailReal.jsx` โชว์ปุ่มเปิดไฟล์ให้ → reviewer กดแล้วได้ 403 ตรวจโดยไม่เห็นหลักฐาน. เปลี่ยนเป็น `CAN_VIEW_OTHERS_FILES = ["officer", "reviewer"]` (executive ยังเข้าไม่ได้เหมือนเดิม). (3) **schema: `exam_results` เพิ่ม `@@unique([student_id, round_id])`** — เดิมกันใบซ้ำด้วย `findByStudentAndRound()` ใน controller อย่างเดียว กดส่งรัวๆ 2 ครั้งได้ 2 ใบในรอบเดียว แล้ว `findFirst` หยิบใบไหนก็ไม่แน่นอน. เพิ่ม index บน FK ที่ query จริงด้วย: `exam_results(round_id)`, `exam_results(staff_status)`, `subject_results(result_id)`, `subject_results(subject_id)`, `certificates(result_id)`, `review_logs(result_id)`, `notifications(student_id)`, `news(round_id)`, `students(academic_year)` (migration `20260923120000_add_exam_result_unique_and_indexes` — สร้างด้วย `prisma migrate diff` + `migrate deploy` เพราะ user DB ไม่มีสิทธิ์สร้าง shadow database, `prisma migrate dev` ใช้ไม่ได้). `findByStudentAndRound` เปลี่ยนเป็น `findUnique({ where: { student_id_round_id: {...} } })` ตาม constraint ใหม่. `errorHandler` ดัก Prisma `P2002` → 409 พร้อมข้อความไทย (เดิมหลุดเป็น 500 พร้อม error ดิบภาษาอังกฤษ). (4) **เพิ่ม 404 handler** — path ที่ไม่ตรง route ไหนเลยเคยได้หน้า HTML ของ Express แล้ว `res.json()` ฝั่ง frontend parse ไม่ได้ ผู้ใช้เห็น error มั่ว. ตอนนี้ตอบ JSON ตาม format เดิม. (5) **ย้ายค่า hardcode ไป .env** — `CORS_ORIGIN` (เดิมฝัง `http://localhost:5174` ใน `app.js`, ใส่หลายอันได้คั่น comma) + `COOKIE_SECURE` (เดิมฝัง `secure: false` ใน `authController.js` — ต้องเป็น `"true"` เมื่อขึ้น HTTPS). `config/env.js` บังคับให้มีครบ 4 ตัวก่อน server เริ่ม + ตรวจว่า `COOKIE_SECURE` เป็น `"true"`/`"false"` เท่านั้น. เพิ่ม `backend/.env.example` (ไม่เคยมี — คนใหม่ clone มา setup ไม่ได้) (`config/db.js`, `config/env.js`, `app.js`, `controllers/authController.js`, `middlewares/auth.js`, `middlewares/errorHandler.js`, `modules/*/*.repository.js` 11 ไฟล์, `modules/certificates/certificates.controller.js`, `modules/examResults/examResults.repository.js`, `prisma/schema.prisma`, `.env.example`) — frontend: `api.js` อ่าน `import.meta.env.VITE_API_BASE` + `frontend/.env.example` |
| 2026-09-23 | **เพิ่ม `npm run test:clean` — รันเทสทั้งชุดบน schema สะอาด** (`tests/run-clean.mjs`). เดิม `npm test` ยิงใส่ DB ตัวที่ใช้ทำ demo (นักศึกษา 900+ คน, รอบเปิดค้าง) เทสหลายตัวเลย fail ทั้งที่โค้ดไม่ได้พัง — แยกไม่ออกว่าอันไหนบัคจริง (ก่อนแก้: 37/54 ที่ phase4-6, 9/13 ที่ phase9). สคริปต์สร้าง PostgreSQL schema `verify_tmp` ใหม่ทั้งก้อน → `migrate deploy` → `seed` → เปิด server ชั่วคราวพอร์ต 3100 → รันทีละไฟล์ → ลบ schema ทิ้ง (ใช้ schema ไม่ใช่ database เพราะ user ไม่มีสิทธิ์ CREATE DATABASE). 3 จุดที่ต้องระวังและแก้ไว้แล้วในสคริปต์: (ก) เทส 9 ไฟล์ hardcode `localhost:3000` — เปลี่ยนเป็น `process.env.BASE || "http://localhost:3000"` ทั้ง 11 ไฟล์ ไม่งั้นยิงผิดพอร์ต; (ข) **เปิด server ใหม่ก่อนทุกไฟล์** เพราะ rate limiter นับ login ไว้ใน memory (officer 10 ครั้ง/15 นาที) รัน 11 ไฟล์ติดกันแล้วไฟล์ท้ายๆ โดน 429; (ค) เช็คว่าพอร์ต 3100 ว่างก่อนเริ่ม — ถ้ามี server ค้างจากรอบก่อน `waitForServer` จะเห็นว่า "ต่อได้" แล้วเทสทั้งชุดวิ่งไปคุยกับ server ตัวเก่าที่ชี้ไป schema ที่ถูกลบแล้ว fail แบบงงๆ ทั้ง 11 ไฟล์. บน Windows ปิด server ต้องใช้ `taskkill /T` ฆ่าทั้ง process tree — `proc.kill()` ฆ่าแค่ cmd ตัวนอก node ข้างในรอดแล้วจองพอร์ตต่อ. **ผลหลังแก้ทั้งหมด: ผ่าน 11/11 ไฟล์ (phase1-3 19/19, phase4-6 54/54, phase9 13/13, ที่เหลือ ALL PASSED)** (`tests/run-clean.mjs` ใหม่, `tests/smoke-phase*.mjs` 11 ไฟล์, `package.json`) |
| 2026-09-23 | **แก้เทส `smoke-phase16-cohort-year.mjs` ปิดรอบจริงทิ้งแล้วไม่เปิดคืน** — เทสต้องปิดรอบที่เปิดอยู่ก่อน (เปิดได้ทีละรอบ) แต่ลืมเปิดคืนตอนจบ → รอบ 2/2569 ที่เจ้าหน้าที่เปิดรับอยู่จริงถูกปิดทุกครั้งที่รันเทส (เจอจากการเทสผ่าน browser: dashboard ไม่มีรอบเปิด). ตอนนี้ `finally` ลบรอบทดสอบก่อนแล้วค่อยเปิดรอบเดิมคืน (ลำดับสำคัญ — เปิดคืนก่อนลบจะชนรอบทดสอบที่ยังเปิดอยู่). phase13/15 ทำถูกอยู่แล้ว. เปิดรอบ 172 คืนให้แล้วด้วยมือ (`tests/smoke-phase16-cohort-year.mjs`) |
| 2026-09-23 | **เจ้าหน้าที่ระบุปีจบได้ตั้งแต่ตอนนำเข้า (เคสซ้ำชั้น/ลาพัก)** — เดิมปีจบคำนวณจากรหัสอย่างเดียว คนซ้ำชั้นได้ปีผิดตั้งแต่ต้น และเจ้าหน้าที่แก้ได้ก็ต่อเมื่อนักศึกษา login กรอกโปรไฟล์แล้ว (ก่อนหน้านั้นไม่มีแถว `students` ให้แก้) → ช่วงก่อน login ครั้งแรกไม่มีทางกัน. **schema:** เพิ่ม `users.import_academic_year Int?` (migration `20260922120000_add_user_import_academic_year` — ว่างได้ แถวเดิมไม่ต้อง backfill) — **data dictionary ในรายงานบท 3.4 ต้องเพิ่มคอลัมน์นี้**. `POST /api/students/import` รับคอลัมน์ `academic_year` แบบไม่บังคับ (ไฟล์เก่า 2 คอลัมน์ใช้ได้เหมือนเดิม), เพิ่ม `?dry_run=true` ตรวจอย่างเดียวไม่บันทึก (ตอบ 200, นำเข้าจริงยังตอบ 201), response เพิ่ม `dry_run` + `year_overrides` [{row, student_id, derived, academic_year}] (เพิ่มอย่างเดียว field เดิมไม่เปลี่ยน). `POST /api/students` รับ `academic_year` ไม่บังคับ. `completeProfile` ใช้ `import_academic_year ?? calcGraduationYear()`. เพิ่ม `validateGraduationYear` + `isBlankYear` (`utils/academicYear.js`) ใช้ร่วม 3 ที่: พ.ศ. 4 หลัก + ไม่น้อยกว่าปีตามรหัส. **แก้บั๊กแฝง:** `PATCH /api/students/:id` ส่ง `academic_year` เป็นตัวอักษรเดิมได้ 500 (Number→NaN) ตอนนี้ 400 — ตรวจเฉพาะตอนปีเปลี่ยนจริง ไม่งั้นนักศึกษาเก่าที่ปีในระบบน้อยกว่าสูตรปัจจุบัน (seed เก่าใช้สูตร −3) จะแก้แม้แต่เบอร์โทรไม่ได้. ข้อความ 400 ตอนย้ายรุ่นหลังส่งผลเอาประโยค "ลบผลสอบก่อน" ออก (ระบบไม่มีทางลบผลสอบ). `tests/cleanupYears.mjs` ลบบัญชีที่ import แล้วยังไม่กรอกโปรไฟล์ของปีทดสอบด้วย (หาจาก `import_academic_year` และ prefix รหัส) (`schema.prisma`, `utils/academicYear.js`, `students/student.controller.js`, `student.repository.js`, `tests/smoke-phase17-import-year.mjs` ใหม่ 21 เคส, `tests/cleanupYears.mjs`, `package.json`) — frontend: `studentImport.jsx` 2 ขั้น ตรวจไฟล์→ยืนยัน + ตารางปีไม่ตรงรหัส + ช่องปีในฟอร์มเพิ่มทีละคน, `completeProfile.jsx` โชว์ปีเฉยๆ ไม่มีกล่องเตือน, `i18n.js` |
| 2026-09-22 | **กันสถิติเพี้ยนจากการย้ายรุ่น (เคสนักศึกษาซ้ำชั้น/ลาพัก)** — `academic_year` เป็นทั้ง "รุ่น" และตัวจับคู่ว่านักศึกษาเห็นรอบไหน (`rounds.controller.js` `getActive` หารอบที่ปีตรงกับ `student.academic_year`) ค่ามาจาก `calcGraduationYear` (รหัส+4) ซึ่งผิดสำหรับคนที่ซ้ำชั้น → รอบของรุ่นเดิมเปิดให้ทั้งที่ยังไม่จบ ส่วนรอบที่ควรสอบกลับไม่เห็น. `PATCH /api/students/:id` แก้ปีได้อยู่แล้วแต่**ไม่มีด่านกันเลย** — ย้ายรุ่นหลังส่งผลสอบแล้วทำให้ตัวหาร (`countStudentsByYear`) ลดแต่ตัวตั้ง (ใบในรอบของปีนั้น ซึ่งผูกกับ `round_id` ไม่ใช่รุ่นของนักศึกษา) เท่าเดิม → `fillRate`/`passRate` ของรุ่นเดิมทะลุ 100% เงียบๆ. ตอนนี้ `update()` เทียบกับค่าเดิมก่อน ถ้าเปลี่ยนจริงและ `countExamResults > 0` ตอบ 400 พร้อมบอกจำนวนใบ (ส่งค่าเท่าเดิมมายังผ่าน — กดบันทึกทั้งฟอร์มโดยไม่แตะช่องปีต้องไม่ติด guard). `GET /api/students/:id` เพิ่ม 2 field คำนวณตอนส่งออก (ไม่ใช่คอลัมน์ใน DB): `academic_year_derived` (ปีตามรหัส ใช้บอกหน้าจอว่าค่าปัจจุบันถูกแก้มือไปแล้ว) + `exam_result_count` (>0 = ย้ายรุ่นไม่ได้ หน้าจอปิดช่องให้ล่วงหน้าแทนที่จะให้พิมพ์จนเสร็จแล้วเด้ง error). **ไม่แตะ schema** (`students/student.controller.js`, `tests/smoke-phase16-cohort-year.mjs` ใหม่ — 22 เคส ครอบคลุมย้ายรุ่นสำเร็จ→รอบที่เห็นเปลี่ยนตามจริง, ย้ายหลังส่งผล→400, สิทธิ์ `/dashboard/alerts` และ `PATCH /students/:id` ครบ 4 role, `package.json`) — frontend ต่อครบแล้ว (`studentDetailReal.jsx` hint+ล็อกช่อง, `manageRoundsSubjectsReal.jsx` พรีวิว "รอบนี้จะเปิดให้กี่คน" ก่อนบันทึก) |
| 2026-09-22 | **กระดิ่งแจ้งเตือนของ officer/executive ใช้ `GET /api/dashboard/alerts` แล้ว** — endpoint นี้มีมาตั้งแต่เดิมแต่ frontend ไม่เคยเรียก กระดิ่ง 2 role นี้เลยมีแต่ "ประกาศใหม่" ที่ตัวเองเป็นคนโพสต์. **ฝั่ง backend ไม่เปลี่ยนโค้ด** — บันทึกไว้เพราะ `alerts` กลายเป็น contract ที่ frontend พึ่งแล้ว: เปลี่ยน `key`/`count`/`detail` ของ alert ตัวไหนต้องแจ้ง เพราะฝั่งหน้าจอเอา `count ?? detail` ไปต่อท้าย `key` เป็นลายเซ็นของค่าปัจจุบัน (ปุ่ม "ล้างทั้งหมด" ซ่อนตาม key — พอตัวเลขเปลี่ยน key เปลี่ยน แจ้งเตือนจึงโผล่กลับมาเอง) |
| 2026-09-21 | **แก้ตัวเลข "ผ่าน/ไม่ผ่านรายวิชา" มุมมอง "รวมทั้งปี" ให้นับรายคน** — เดิม `buildYearSummary` ส่ง array ใบทั้งปีเข้า `buildPerSubject` (นับตามใบ) คนที่สอบซ้ำหลายรอบถูกนับเกิน (ทดสอบจริง: badge 9 แต่คนจริง 5) ทั้งที่คอมเมนต์หัวฟังก์ชันเดียวกันเขียนไว้ว่า "รวมทุกรอบนับรายคน". ใหม่: `buildPerSubjectByStudent` + map `passedByStudentConfirmed`/`attemptedByStudentConfirmed` (เฉพาะใบ approved, ไม่นับ carried_forward, **เคยผ่านสักรอบ = นับผ่าน ชนะเสมอ**) — ไม่แตะ `passedByStudent` เดิมที่ใช้กับ "ผ่านครบทุกวิชา" (นับ pending ด้วยโดยตั้งใจ) ลบ `yearCounted` ที่ไม่ใช้แล้ว. ตัวเลขรายรอบ (`buildPerSubject` เดิม) ไม่เปลี่ยน — 1 คนมีได้ใบเดียวต่อรอบอยู่แล้ว. **เพิ่ม endpoint** `GET /api/students/subject-result-list` (JSON) + `GET /api/students/export-subject` (PDF) รายชื่อผ่าน/ไม่ผ่านรายวิชา ใช้ logic เดียวกับตัวเลขบัตรเป๊ะ (`findMatchingSubjectResult` ใน `student.repository.js`, `resolveSubjectQuery` ใน controller ใช้ร่วมกัน 2 endpoint) เฉพาะ officer (ผู้บริหารไม่มีสิทธิ์ดูรายบุคคล). **แยกชิ้นส่วน PDF ใช้ร่วม** ออกเป็น `utils/pdfReport.js` (ฟอนต์/ตาราง/ช่องลงนาม/เลขหน้า) — `dashboard.pdf.js` ใช้ของกลางแทนโค้ดเดิม (ตรวจแล้วรายงานเดิมออกมาเหมือนเดิม) + `students/students.pdf.js` ใหม่. ชื่อไฟล์ดาวน์โหลดที่เป็นภาษาไทยต้องใส่ `filename*=UTF-8''...` (RFC 5987) คู่ `filename` ASCII สำรอง. **ข้อจำกัดที่รู้แล้ว:** เลเยอร์ข้อความที่ซ่อนใน PDF (ใช้ copy/ค้นหา) เรียงสระ+วรรณยุกต์ไทยที่ซ้อนกัน 2 ชั้นสลับตำแหน่ง (เช่น "ทั้ง") เป็นข้อจำกัดของ pdfkit/fontkit — ภาพที่มองเห็น/พิมพ์ถูกต้อง 100% (`schema.prisma` ไม่เปลี่ยน, `dashboard.service.js`, `dashboard.pdf.js`, `utils/pdfReport.js` ใหม่, `students/student.controller.js`, `student.repository.js`, `students.pdf.js` ใหม่, `students.routes.js`, `subjects.repository.js` เพิ่ม `findByCode`) |
| 2026-09-20 | **เพิ่ม role `reviewer` (เจ้าหน้าที่ตรวจสอบ) + audit log `review_logs`** — ตามสเปก [`docs/superpowers/specs/2026-09-19-reviewer-role-design.md`](../docs/superpowers/specs/2026-09-19-reviewer-role-design.md). Pooled queue เดียวกับ officer ไม่มี assignment รายคน/รายห้อง. เพิ่ม role ใน seed (`321`/`321`), `CREATABLE_ROLES`/`ASSIGNABLE_ROLES` ใน `users.controller.js`, เปิด route ให้ reviewer เข้า `GET/PATCH /api/exam-results*` + `GET /api/students*` (`requireRole`). **แก้ guard กันตรวจซ้อน** — `examResults.controller.js` `reviewExamResult` เดิม update ตรงๆ ไม่เช็คสถานะก่อนเลย (บั๊กแฝงเดิม ไม่ใช่ของใหม่) ตอนนี้บังคับ `staff_status` ต้องเป็น `pending` เท่านั้นถึงตรวจได้ ผ่าน `updateStaffStatusIfPending` (`updateMany` + where กันชน — ด่านสองเช็ค `count===0` กัน race จริงที่ด่านแรกเช็คไม่ทัน ทดสอบยืนยันด้วย `Promise.all` ยิงพร้อมกันจริงใน `smoke-phase15-reviewer.mjs`) **ผลข้างเคียงที่ตั้งใจ (breaking change เล็กน้อย):** ใบที่ตรวจไปแล้วครั้งหนึ่งจะแก้คำตัดสินตรงๆ ผ่าน API อีกไม่ได้ (409 เสมอ) ต้องรอนักศึกษา resubmit ก่อน — เดิม reject แล้ว approve ทันทีไม่ resubmit ทำได้ (`smoke-phase4-6.mjs` แก้เพิ่ม resubmit-before-approve ตามนี้แล้ว). เพิ่ม `review_logs` (insert-only, ทุกครั้งที่ approve/reject) ผ่าน `reviewLog.repository.js` เรียกหลัง guard ผ่านเท่านั้น. **`review_logs` ต้องลบก่อน `exam_results` เสมอ** (FK) — แก้ `tests/cleanupYears.mjs` และสคริปต์ seed ทุกตัว (`seed.js`, `demoSeed.js`, `seedDemoYears.js` ×2 จุด, `seedCohort.js`) ที่ยังไม่ครอบคลุม (`schema.prisma` — `db push` ไม่มี migration file ดู 8. ฐานข้อมูล, `seed.js`, `demoSeed.js`, `seedDemoYears.js`, `seedCohort.js`, `users.controller.js`, `examResults.controller.js`, `examResults.repository.js`, `examResults/reviewLog.repository.js` ใหม่, `students.routes.js`, `examResults.routes.js`, `tests/cleanupYears.mjs`, `tests/smoke-phase4-6.mjs`, `tests/smoke-phase15-reviewer.mjs` ใหม่, `package.json`) — frontend ต่อครบแล้ว (`app.jsx`, `studentDetailReal.jsx`, `manageUsersReal.jsx`, `i18n.js`) |
| 2026-09-17 | **แก้ bug `PATCH /api/students/:id` (`updateProfile`) 500 ทุกครั้งที่ส่ง `room_id` มา** — เดิม spread `room_id` เป็น scalar ตรงๆ ลง `prisma.student.update()` แต่ schema กำหนด `room` เป็น relation (`@relation(fields:[room_id])`) ต้องเขียนผ่าน `room:{connect:{room_id}}` เท่านั้น. จุดนี้ไม่มี smoke test คลุมเลย เจอจากทดสอบ UI จริงผ่านหน้า "แก้ไขข้อมูลนักศึกษา" ที่เพิ่งต่อ frontend เข้ากับ endpoint นี้เป็นครั้งแรก (`student.repository.js`). เพิ่ม `first_name_en`/`last_name_en` placeholder ใน `demoSeed.js`/`seedDemoYears.js` ด้วย — สองสคริปต์นี้เขียนก่อน schema บังคับ field นี้เป็น NOT NULL เลย seed ไม่ผ่านมาตั้งแต่รอบก่อนแล้วไม่มีใครรัน demo seed เจอจนตอนนี้ |
| 2026-09-17 | **ตัด first-setup (name-match) ทิ้งทั้งระบบ** — ไม่มีใครใช้แล้วหลังนักศึกษาเปลี่ยนไป login ด้วยเลขบัตร ปชช โดยตรง (ดู entry ด้านล่าง). officer/executive เปลี่ยนมาใช้กลไกเดียวกับ student: `POST /api/users` **บังคับ** ส่ง `password` มาด้วยแล้ว (เจ้าหน้าที่ตั้งรหัสชั่วคราวให้ตอนสร้างบัญชี) + `must_change_password: true` เสมอ → login ครั้งแรกเจอ `ForceChangePassword` (มีอยู่แล้ว ไม่ต้องสร้างใหม่) บังคับเปลี่ยนเอง. `POST /api/users/:id/reset-password` เปลี่ยนจาก "ล้าง password เป็น null แล้วให้ไป first-setup" เป็น **รับ `new_password` ตั้งรหัสชั่วคราวใหม่ให้ทันที** (`UserRepo.setPassword` — ฟังก์ชันใหม่ แยกจาก `revokeAccess` ที่ยังล้างเป็น null ถาวรเหมือนเดิมสำหรับกรณีถอนสิทธิ์จริง). เพิ่ม `POST /api/students/:id/reset-password` **ใหม่** (ของเดิมเป็น dead code ไม่มี frontend เรียกเลย ลบไปแล้วสร้างใหม่ให้ถูก semantics) — รับ `national_id` แล้ว re-hash ตรงๆ **ไม่ตั้ง `must_change_password`** เพราะ password นักศึกษาต้องเป็นเลขบัตร ปชช เสมอ ไม่มีรหัสชั่วคราวแบบ officer/executive. ลบ `POST /api/auth/first-setup` + controller `firstSetup` ทิ้งทั้งหมด (`authController.js`, `auth.routes.js`, `users.controller.js`, `users.repository.js`, `students.routes.js`, `student.controller.js`, `student.repository.js`) |
| 2026-09-17 | **Login นักศึกษาเปลี่ยนเป็น username=รหัสนักศึกษา + password=เลขบัตร ปชช (hash bcrypt) ใช้แทน password ทุกครั้ง ไม่ใช่แค่ first-setup** — เจ้าหน้าที่ import แค่ `student_id`+เลขบัตร ปชช สร้างแค่ `User` row (ยังไม่มี `Student`), login ครั้งแรกผ่าน `/api/auth/login` ปกติเลย ไม่มี first-setup แยกสำหรับนักศึกษาอีกต่อไป. หลัง login แล้วไม่มี `Student` row → gate ไปกรอกโปรไฟล์ (`POST /api/students/complete-profile`) — ปีการศึกษาจบคำนวณฝั่ง server จาก 2 หลักแรกของ `student_id` เท่านั้น (`utils/academicYear.js`, สูตร entry+4). เพิ่ม endpoint แก้ข้อมูลนักศึกษาทีหลัง (`PATCH /api/students/:id`) ครอบคลุมเคสซ้ำชั้น/ลาพัก. `User.first_name/last_name/email/phone` เปลี่ยนเป็น nullable (ไม่มีตอน import แล้ว), เพิ่ม `Student.first_name_en/last_name_en`. เพิ่ม validate format `student_id` (ตัวเลขล้วนอย่างน้อย 2 หลัก) ทั้ง `create()`/`bulkImport()`, กัน crash 500 ตอน first-setup (name-match) ถ้า `first_name`/`last_name` เป็น null สำหรับนักศึกษาที่ import ด้วย flow ใหม่ — role อื่น (officer/executive) ยังใช้ first-setup name-match แบบเดิม. `academicYear.js` validation error ใส่ `statusCode 400`. `prisma/seed.js` เพิ่ม `notification.deleteMany()` ก่อนลบ students (ไม่งั้น FK restrict violation ทุกครั้งที่มี notifications ค้าง). **ยังไม่มี migration ใน `prisma/migrations` สำหรับ schema diff นี้** — dev DB สร้างด้วย `db push` มาตลอดไม่เคย apply migration history จริง ต้องจัดการแยกก่อนขึ้น production (`schema.prisma`, `seed.js`, `seedCohort.js`, `authController.js`, `middlewares/auth.js`, `modules/students/*`, `utils/academicYear.js`, `tests/smoke-phase4-6/9/11/12/14.mjs`) |
| 2026-09-13 | **อัตราการผ่านรายวิชา (`buildPerSubject`) นับเฉพาะใบที่ยืนยันแล้วเท่านั้น** — กลับกฎเดิมจาก 2026-08-09 ที่ตั้งใจนับ pending ด้วยกันกราฟว่าง ตอนนี้เปลี่ยนตามที่เจ้าหน้าที่ต้องการ: รอตรวจสอบไม่นับ ทั้งระดับรอบ (`round-level`) และระดับปี (`buildYearSummary`). เพิ่ม `onlyConfirmed` filter (`staff_status === "approved"`) ใช้เฉพาะจุดนี้ — สถิติอื่น (`fullyPassed`, สัดส่วนสถานะ ฯลฯ) ยังนับ pending เหมือนเดิม. ผลข้างเคียง: วิชาที่ยังไม่มีใครถูกยืนยันเลยในรอบนั้นจะโชว์ `rate: null` แทนตัวเลขจาก pending. `smoke-phase12-reject-edit.mjs` เพิ่มขั้น approve ก่อนเช็ค stats ให้ตรงกฎใหม่ (`dashboard.service.js`, `tests/smoke-phase12-reject-edit.mjs`) |
| 2026-08-12 | **การ์ดสถานะรวมทั้งปีเคยโชว์เกิน 100%** — frontend เอา `by.*` ของแต่ละรอบมาบวกกัน ซึ่งเป็นจำนวน "ใบ" (คนกรอก 2 รอบถูกนับ 2 ครั้ง) แล้วหารด้วย `total` ที่เป็นจำนวน "คน" → รุ่น 2569 ขึ้น "ยืนยันแล้ว 162 (103.85%)" จากนักศึกษา 156 คน. `buildYearSummary` เพิ่ม `statusByStudent` นับรายคนจาก **ใบล่าสุดของแต่ละคน** (rounds เรียงใหม่→เก่า ใบแรกที่เจอคือใบล่าสุด) 5 ช่องบวกกัน = `total` เสมอ. frontend เลิกยิง `/dashboard/stats` ทีละรอบไปเลย (`dashboard.service.js`, `dashboardReal.jsx`, `i18n.js`) |
| 2026-08-12 | ตาราง "สรุปผลสอบผ่านครั้งแรก จำแนกรายวิชา" แถวรวมเคยเอาคอลัมน์รายวิชามาบวกกัน ได้ตัวหาร `cohort × จำนวนวิชา` (156×8 = 1,248) ไปนั่งใต้หัวคอลัมน์ "ผู้สมัครสอบ" อ่านเป็นคน 1,248 คน. `buildFirstAttemptBySubject` เพิ่ม `passed_all` / `failed_any` (+ rate) นับเป็นคน — ผ่านครบทุกวิชา / ส่งผลแล้วแต่ตกอย่างน้อย 1 วิชา. แก้ทั้งหน้าจอและ PDF (`dashboard.service.js`, `dashboard.pdf.js`, `components.jsx`, `smoke-phase12`) |
| 2026-08-12 | เทสที่สร้างนักศึกษา/รอบ ล้างของตัวเองผ่าน Prisma ด้วย `tests/cleanupYears.mjs` — เดิม `smoke-phase11/12` แค่ปิดรอบไม่ลบ ปีสมมติ (2597/2599) เลยค้างใน DB แล้วไปโผล่เป็นปีการศึกษาปลอมบน dashboard เบียดปีจริงออกจากกราฟย้อนหลัง. ล้างผ่าน API ไม่ได้เพราะระบบกันลบนักศึกษา/รอบที่มีผลสอบแล้ว helper จึงกันไว้ให้รับเฉพาะปี 2590 ขึ้นไป |
| 2026-08-12 | **`GET /api/news` กรองตามรุ่นให้นักศึกษา** — เดิม `findAll()` คืนทุกประกาศให้ทุกคน นักศึกษารุ่น 2570 จึงเห็นประกาศของรุ่น 2565–2569 ปนมาหมด ทั้งที่ไม่เกี่ยวกับตัวเอง. ประกาศผูกกับ `round_id` อยู่แล้วจึงกรองด้วย `round.academic_year` ได้เลย ไม่ต้องแก้ schema. เจ้าหน้าที่/ผู้บริหารยังเห็นครบ. **ยังโพสต์ "ประกาศถึงทุกรุ่น" ไม่ได้** เพราะ `round_id` เป็น NOT NULL (`news.controller.js`, `news.repository.js`, `tests/smoke-phase14-news-scope.mjs`) |
| 2026-08-12 | เพิ่ม `prisma/seedDemoYears.js` + npm script `seed:demo-years` — ข้อมูลจำลอง 5 รุ่น รุ่นละ 150–200 คน (~900 คน, ผลรายวิชา ~9,000 แถว) มีรอบ 2–3 รอบต่อปีและรุ่นล่าสุดค้างกลางคัน ไว้ทดสอบ dashboard/PDF กับข้อมูลขนาดจริง. ไม่แตะ roles/faculties/rooms/subjects/บัญชีเจ้าหน้าที่ (`prisma/seedDemoYears.js`, `package.json`) |
| 2026-08-12 | **เปิดรอบได้ทีละรอบเดียวทั้งระบบ** — เดิมกดเปิดกี่รอบก็ได้ พอเปิดค้างหลายรอบในรุ่นเดียว `findActive` หยิบ `attempt_number` สูงสุดมาให้ นักศึกษาเลยเจอรอบที่ไม่ตั้งใจ (โค้ดเดิมรู้ปัญหานี้ เขียนคอมเมนต์ไว้ว่า "ไม่ควรเกิด" แต่ไม่เคยกัน). เพิ่ม `findOpen()` + `ensureNoOtherOpenRound()` เช็คทั้ง create/update ตอบ 400 บอกรอบที่เปิดค้าง. **แลกมาด้วย:** รุ่นเก่าสอบแก้ตัวพร้อมรุ่นใหม่ไม่ได้ (`rounds.controller.js`, `rounds.repository.js`, `smoke-phase13`, `smoke-phase10` ต้องเพิ่ม park/restore) |
| 2026-08-12 | **ใบที่ถูกตีกลับเคยถูกนับว่า "ผ่าน"** — `countFullyPassed`/`buildPassDistribution` รับ `sent` (ตัดแค่ draft) ทั้งที่ `buildPerSubject`/`buildFirstAttemptBySubject` ใช้ `counted` (ตัดใบตีกลับ) มาตลอด. เจ้าหน้าที่ตีกลับใบที่กรอกว่าผ่านครบ แล้ว dashboard ยังนับให้ผ่าน กระทบ `fullyPassed`, `fullyPassedRate`, `passRateOfSitters`, `years[].rounds[].fullyPassed` และ **`firstAttempt` % ที่ส่งสภาการพยาบาล**. เปลี่ยนเป็น `counted` ทั้ง 4 จุด + เพิ่ม `firstRoundCounted` คู่กับ `firstRoundSent`. คนที่ใบถูกตีกลับจะไปอยู่แถว "ไม่ได้ส่งผล" ตรงกับที่ `firstAttemptBySubject` นับอยู่แล้ว (`dashboard.service.js`) |
| 2026-08-12 | ตาราง "สรุปผลสอบผ่านครั้งแรก จำแนกรายวิชา" ใน PDF ตัดคอลัมน์ "ไม่ส่งผล" ออก + หัวตาราง 2 ชั้นแบบ merge cell ให้ตรงกับตารางบนหน้าจอที่รื้อใหม่. `drawTable()` รับ `groups` เพิ่ม (หัวชั้นบน) — ตารางอื่นไม่ส่งมาก็ทำงานเหมือนเดิม. **ร้อยละผ่าน + ไม่ผ่าน ไม่ครบ 100% แล้ว** ส่วนที่ขาดคือคนไม่ส่งผล เขียนบอกไว้ใต้ตารางพร้อมยอดรวมแบบสภาการพยาบาล (`dashboard.pdf.js`) |
| 2026-08-12 | `/dashboard/stats` เพิ่ม `alreadyPassedStudentIds` (งานแก้ม — merge จาก `feature/update-app`) — คนที่ผ่านครบทุกวิชาไปแล้วตั้งแต่รอบก่อน ไม่มีแถวใน `exam_results` ของรอบถัดไป เลยค้างโชว์ในแท็บ "ยังไม่กรอก" ของหน้าคิวตรวจทุกรอบ ทั้งที่ไม่มีอะไรต้องทำแล้ว. ได้มาจาก loop เดิมของ `canSubmit` (เก็บอีกครึ่งที่ `passedAll`) ไม่มี query เพิ่ม. **`not_started` ไม่แก้** — ต้องคงผลรวมให้เท่า `total` (ดูกติกาข้อ 3 หัวข้อ 7.10) (`dashboard.service.js`, `officerReviewReal.jsx`, `i18n.js`) |
| 2026-08-12 | **กันสร้างรอบซ้ำ** — เดิมสร้าง "ปี 2569 ครั้งที่ 1" กี่รอบก็ได้ ไม่มีอะไรกันเลยทั้งใน controller และ DB ทำให้ `findActive` เจอสองรอบแล้วเลือกมาแค่รอบเดียว ผลสอบเลยกระจายไปคนละรอบ. เพิ่ม `ensureNotDuplicate()` ใน `create`+`update` (update ข้ามรอบตัวเองด้วย `exceptRoundId`), `findByYearAndAttempt()` ใน repository, unique index ที่ DB (`@@unique([academic_year, attempt_number])`, migration `20260812000000_add_unique_round_year_attempt`) และแปลง `P2002` เป็น 400 ด้วย `asDuplicateRoundError()`. `update` ดึงรอบเดิมมาก่อนเสมอ → ไม่เจอตอบ 404 แทน 500 (`rounds.controller.js`, `rounds.repository.js`, `schema.prisma`, `tests/smoke-phase13-duplicate-round.mjs`) |
| 2026-08-12 | **แก้ `canSubmit` นับผิด** — เดิมตัดออกแค่รอบที่กำลังดู เลยนับผลของ "รอบที่มาทีหลัง" เข้ามาด้วย คนที่ผ่านครบตอนรอบ 2 ถูกมองว่าผ่านครบตั้งแต่ตอนคำนวณรอบ 1 ทำให้รอบ 1 มีคนกรอกได้ **น้อยกว่า** รอบ 2 ซึ่งเป็นไปไม่ได้. ตอนนี้กรองด้วยลำดับเวลา (ปีเก่ากว่า หรือปีเดียวกันแต่ `attempt_number` น้อยกว่า) — `findEligibleWithPassedSubjects(round)` รับ round object แทน `(year, roundId)`. **`findPassedSubjectIds` ฝั่ง examResults ไม่ต้องแก้** เพราะตอนนักศึกษากดส่ง รอบถัดไปยังไม่เกิด (`dashboard.repository.js`, `dashboard.service.js`) |
| 2026-08-12 | PDF เพิ่มตาราง "สรุปผลสอบผ่านครั้งแรก จำแนกรายวิชา" (จาก `yearStats.firstAttemptBySubject`) — ตารางนี้เดิมมีแต่บนหน้าจอ ไฟล์ที่ export ออกไปไม่มี ทั้งที่เป็นตัวเลขที่ส่งสภาการพยาบาล. มีแถวรวมทุกวิชา + หมายเหตุยอด "ไม่ผ่าน + ไม่ส่งผล" รวมกัน (เอกสารของสภานับ 2 อย่างนี้เป็นช่องเดียว) (`dashboard.pdf.js`) |
| 2026-08-12 | **เขียน `dashboard.pdf.js` ใหม่ทั้งไฟล์** — เพิ่ม `drawTable()` ที่จัดการขึ้นหน้าใหม่ + วาดหัวตารางซ้ำเองทุกหน้า. แก้ 5 อาการ: ชื่อวิชายาวเคย wrap ลงบรรทัด 2 แล้วทับแถวถัดไป (ตอนนี้ `lineBreak:false` + `ellipsis:true`), หน้าแรกไม่เคยเช็คกระดาษเต็มจนตารางทะลุขอบ, ตารางข้ามหน้าแล้วหัวตารางหาย, ตัวเลขชิดซ้ายเทียบหลักไม่ได้ (มี `aligns` ต่อคอลัมน์แล้ว), ไม่มีเลขหน้า (ใช้ `bufferPages: true` + `bufferedPageRange()`). เพิ่มช่องลงนาม 2 ช่อง + บรรทัด `canSubmit` ในสรุปภาพรวม. **เนื้อหาหยุดที่ y=770 ไม่ใช่ขอบล่างจริง 801.89** — เขียนชิดกว่านี้ pdfkit จะแถมหน้าเปล่าท้ายไฟล์ |
| 2026-08-12 | `/dashboard/stats` เพิ่ม `canSubmit` — "รอบนี้เปิดฟอร์มให้กรอกได้กี่คน" = เปิดสิทธิ์อยู่ **และ** ยังผ่านวิชาของรอบนี้ไม่ครบ. ต่างจาก `eligible` ที่เป็นยอดทั้งรุ่นเท่าเดิมทุกรอบ — ตัวนี้ลดลงเรื่อยๆ (รอบ 1 = ทุกคนที่เปิดสิทธิ์, รอบ 2 = เหลือเฉพาะคนที่ยังสอบไม่ผ่าน). เงื่อนไข "ผ่านแล้ว" ต้องตรงกับ `findPassedSubjectIds` ทุกข้อ (ตัดใบตีกลับ, ไม่จำกัดปี, ไม่นับใบของรอบที่กำลังดู) ไม่งั้นเลขบน dashboard ไม่ตรงกับคนที่กรอกได้จริง (`dashboard.repository.js` — เพิ่ม `findEligibleWithPassedSubjects`, `dashboard.service.js`). **frontend ใช้เป็นการ์ดใบแรกของมุมมองรอบ** |
| 2026-08-12 | อัปโหลดเอกสารประเภทเดิมซ้ำ = **แทนที่ใบเก่า** ไม่ใช่เพิ่มใบที่สอง — ลบทั้งแถวใน DB และไฟล์บน disk ก่อนสร้างใบใหม่. เดิมนักศึกษาที่ถูกตีกลับแล้วส่งใหม่จะเหลือเอกสาร 2 ใบในผลสอบเดียว (resubmit ใช้ `result_id` เดิม) เจ้าหน้าที่แยกไม่ออกว่าใบไหนล่าสุด (`certificates.controller.js`, `certificates.repository.js` — เพิ่ม `findByResultAndType`, `removeById`) |
| 2026-08-12 | 401 ที่แปลว่า "ต้อง login ใหม่" ติด `code: "auth_required"` มาด้วย (`middlewares/auth.js` ทั้ง 3 จุด, `middlewares/requireRole.js`) — frontend เดิมเจอ 401 ทุกกรณีแล้ว `window.location.reload()` ทำให้กรอกรหัสผิดตอน login แล้วหน้ารีทิ้ง error ที่เพิ่งขึ้น และกรอกรหัสเดิมผิดตอนเปลี่ยนรหัสแล้วโดนเตะออก. 401 จากการเช็ครหัสผ่าน (`authController.js`) **ต้องไม่มี code นี้**. **frontend แก้พร้อมกัน** (`api.js`) — ต้องแจ้งแก้ม |
| 2026-08-12 | `/dashboard/history` เพิ่ม 2 ค่าต่อปี: `firstAttemptBySubject` (ตารางผลรายวิชาของรอบแรก รูปแบบเดียวกับที่คณะส่งสภาการพยาบาล — **ตัวหารเป็นนักศึกษาทั้งรุ่น** ทศนิยม 2 ตำแหน่ง แยกช่อง `not_submitted` ออกจาก `fail` ให้เห็นตามจริง) และ `started` (คนที่มีใบในปีนี้ รวม `draft` — ใช้หา "ยังไม่เริ่มกรอก" โดยไม่นับคนที่กรอกค้างซ้ำสองช่อง) ไม่แตะ schema/repository (`dashboard.service.js`) |
| 2026-08-11 | `/dashboard/history` เพิ่ม 3 ค่าต่อปี: `firstAttempt` (ร้อยละผ่านครั้งแรก = ผ่านครบในรอบ `attempt_number=1` ÷ `total`), `firstYear` (ผ่านครบในรอบไหนก็ได้ของปีนั้น ÷ `total`) และ `passDistribution` (ตารางผ่าน 8/7/6… วิชา ของรอบแรก แยกตามห้องเรียน + คอลัมน์รวม) ตามสูตรที่คณะใช้รายงานสภาการพยาบาล. **ตัวหารเป็น `total` ไม่ใช่ `submitted`** และ 2 ค่านี้เป็น % ทศนิยม 2 ตำแหน่ง (`rate2`) ต่างจาก field เดิมที่ปัดจำนวนเต็ม. ไม่แตะ schema/repository (`dashboard.service.js`) |
| 2026-08-11 | **สถิติ dashboard ใช้ตัวหารเดียวกันทั้งหมด** = นักศึกษาทั้งรุ่นที่ import (= ผู้สำเร็จการศึกษา ตามสูตรที่ส่งสภาการพยาบาล). `firstYear` นับจากวิชาที่ผ่านสะสมข้ามรอบ ไม่ใช่ดูทีละรอบ, ตารางแจกแจงหารด้วยจำนวนคนทั้งห้อง + มีแถว "ไม่ได้ส่งผล", `findResultsByRound` เลิกกรอง `exam_eligible`, โดนัทบวกกันได้เท่า `total` (`dashboard.service.js`, `dashboard.repository.js`, `smoke-phase12`) |
| 2026-08-11 | ตัดแจ้งเตือน "สรุปรอบที่เพิ่งปิด" ออกจาก `/api/dashboard/alerts` — สรุปผลดูได้จาก dashboard และหน้ารายงานอยู่แล้ว ไม่ใช่เรื่องที่ต้องลงมือทำ กล่องแจ้งเตือนเหลือเฉพาะงานที่ต้องทำจริง 3 แบบ |
| 2026-08-11 | เพิ่ม `GET /api/dashboard/alerts` — แจ้งเตือนเจ้าหน้าที่/ผู้บริหาร 4 แบบ (รอบใกล้ปิด/เลยกำหนด, ยังไม่ส่งผลกี่คน, ใบรอตรวจ, สรุปรอบที่เพิ่งปิด) **คำนวณสดทุกครั้ง ไม่เก็บลง DB** เพราะเป็นสถานะ ณ ตอนนี้ ไม่ใช่เหตุการณ์ — ไม่ต้องแก้ schema และไม่มีแจ้งเตือนเก่าค้าง. executive ไม่ได้รับเรื่อง "ใบรอตรวจ" |
| 2026-08-11 | บัญชี officer/executive ตั้งรหัสเอง — `POST /api/users` ไม่บังคับ `password`, `first-setup` เปิดให้ทุก role ใช้ (เดิมล็อกเฉพาะ student), เพิ่ม `POST /api/users/:id/reset-password`. ตัดหน้า "ลืมรหัสผ่าน" ฝั่ง frontend ออก เจ้าหน้าที่เป็นคนรีเซ็ตให้ทั้งหมด |
| 2026-08-11 | เพิ่ม `DELETE /api/students/:id` — ลบได้เฉพาะคนที่ยังไม่มีผลสอบ (มีแล้วตอบ 409) ป้องกันสถิติปีเก่าเปลี่ยนย้อนหลัง. แก้ `GET /api/students/:id` ที่ไม่เจอให้ตอบ 404 แทน 200 + `data:null` |
| 2026-08-10 | merge `feature/update-app` (งานแก้ม) — `students.exam_eligible` เปลี่ยน default เป็น `true` (migration `20260809152219_eligible_default_true`) เจ้าหน้าที่ค่อยกดถอนสิทธิ์เองแทนกดเปิดทีละคน, `/dashboard/history` เพิ่ม `byRoom` (ผ่านครบ/ส่งแล้ว แยกตามห้องเรียน) ใน `dashboard.service.js` + ดึง `room` มาใน `dashboard.repository.js`, ข้อความแจ้งเตือนตอนตีกลับต่อท้าย `\nกรุณากรอกผลสอบของท่านใหม่อีกครั้ง` (`examResults.controller.js`). **เทสต์ `smoke-phase4-6.mjs` ต้องถอนสิทธิ์ก่อนถึงจะเช็ค 403 ได้** เพราะ default เป็น true แล้ว |
| 2026-08-10 | **ลบตาราง `sessions`** — เหลือมาจากตอนคิดจะทำ session-based auth ไม่มี code ไหนใช้เลย (auth เป็น JWT ใน httpOnly cookie ล้วน) และไม่มีใน data dictionary ของรายงาน. ลบ `model Session` + relation `sessions` ใน `User` + `prisma.session.deleteMany()` ใน seed, migration `20260810171137_remove_sessions_table` (`schema.prisma`, `prisma/seed.js`) |
| 2026-08-10 | **ตัดสิทธิ์ executive จากข้อมูลนักศึกษารายบุคคล** — `GET /api/students`, `GET /api/students/:id`, `GET /api/exam-results` และไฟล์ certificate (`serveFile`) เหลือ officer เท่านั้น. ผู้บริหารเห็นได้แค่ตัวเลขรวมที่ `/api/dashboard/stats|history` (data minimization — ผู้บริหารไม่ต้องแตะ PII). **รายงานบทที่ 4.3 ต้องแก้ตาม** เพราะเดิมระบุว่าผู้บริหารมีหน้า "รายละเอียดนักศึกษา" (`students.routes.js`, `examResults.routes.js`, `certificates.controller.js`, `tests/smoke-phase4-6.mjs`). **frontend ต้องซ่อนเมนูของผู้บริหารให้เหลือ Dashboard — แจ้งแก้ม** |
| 2026-08-10 | **ย้าย JWT จาก localStorage ไป httpOnly cookie** — `login` ตั้ง cookie ด้วย `TOKEN_COOKIE_OPTIONS` (httpOnly + sameSite lax + maxAge 1 วัน) และไม่ส่ง `token` กลับใน body อีก, `authenticate` อ่าน token จาก `req.cookies.token` แทน `Authorization` header, เพิ่ม `POST /api/auth/logout` (public) สั่ง `clearCookie`, `app.js` เพิ่ม `cookieParser()`. เหตุผล: localStorage โดน XSS อ่านได้ httpOnly ไม่ได้. **ต้องเปลี่ยน `secure: false` เป็น `true` ก่อนขึ้น production** (`authController.js`, `middlewares/auth.js`, `app.js`, `auth.routes.js`, `package.json`) |
| 2026-08-10 | tests ทั้ง 6 ไฟล์: ตัวช่วย `call` ส่ง `Cookie` header แทน `Authorization`, `call` คืน `cookie` ที่แกะจาก `set-cookie` ให้ (ค่าที่ส่งเข้า param `token` ตอนนี้คือข้อความ cookie เต็ม เช่น `token=eyJ...`), เพิ่มเทสต์ logout ใน `smoke-phase1-3.mjs`. **frontend แก้พร้อมกัน** (`api.js`, `login.jsx`, `app.jsx`, `forceChangePassword.jsx`, `reportsReal.jsx`) — ต้องแจ้งแก้ม |
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
