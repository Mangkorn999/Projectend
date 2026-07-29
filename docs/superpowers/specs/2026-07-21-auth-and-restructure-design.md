# Design — จัดโครงสร้าง Frontend + Auth ด้วย Email/Password

วันที่: 2026-07-21
เจ้าของงาน: มังกร (backend) / แก้ม (frontend)

---

## ที่มา

ระบบจริงจะ login ผ่าน PSU One Passport (SSO) แต่ตอนนี้ยังไม่มี SSO ให้ใช้
อาจารย์ที่ปรึกษาต้องการเห็นระบบทำงานจริงก่อน จึงทำ login ด้วย email + password
ไปพลาง แล้วค่อยสลับเป็น SSO ทีหลัง

หลักสำคัญ: **ออกแบบให้ถอด password ออกได้โดยแก้ไฟล์เดียว**

```
authController.login()
  ├─ verifyPassword()   ← ตอนนี้: bcrypt / อนาคต: ลบทิ้ง เปลี่ยนเป็น verifySSO()
  └─ issueJWT()         ← ไม่ต้องแก้เลย
```

JWT / role / middleware / frontend ทั้งหมดไม่ต้องแตะตอนเปลี่ยนไป SSO

---

## การตัดสินใจที่ตกลงกันแล้ว

| # | เรื่อง | ผลสรุป |
|---|---|---|
| 1 | วิธี login | email + password (bcrypt) |
| 2 | ตัด role `admin` | ตัด เหลือ student / officer / executive |
| 3 | รหัสผ่านเริ่มต้น | student = รหัสนักศึกษา · officer/executive = กำหนดใน seed |
| 4 | หน้าเปลี่ยนรหัสผ่าน | **ไม่ทำ** — ระบบจริงเปลี่ยนที่มหาวิทยาลัย |
| 5 | บัญชี officer | สร้างใน `seed.js` ไม่มีหน้า UI |
| 6 | บัญชี executive | officer เพิ่มทีละคนผ่านหน้าจัดการผู้ใช้ (Step 3) |
| 7 | import นักศึกษา | Excel (Step 2) |
| 8 | รหัสสภาการพยาบาล | **ตัดออกทั้งหมด** |

### ทำไมตัดรหัสสภาการพยาบาล

1. **PDPA** — เก็บ credential ของเว็บอื่นแบบถอดกลับได้ เสี่ยงเกินความจำเป็น
2. **ใช้จริงไม่ได้** — ถ้านักศึกษาไม่ยินยอม เจ้าหน้าที่ก็เข้าไปดูไม่ได้อยู่ดี
3. **ซ้ำซ้อน** — การตรวจสอบใช้ PDF ที่นักศึกษาอัปโหลด (ตาราง `certificates`) อยู่แล้ว

ผลกระทบ: schema ไม่ตรงรายงานบทที่ 3.4 ต้องแก้รายงานตามรายการท้ายเอกสาร

---

## แบ่งงาน 2 ก้อน

แยกกันเพื่อให้ diff อ่านออก ถ้าทำรวดเดียวจะปนกันเกิน 2000 บรรทัด

### Step 0 — จัดโครงสร้าง Frontend (ไม่แก้ logic)

`src/design/` เป็นชื่อจากตอนทำ prototype ไม่ใช่โครงแอปจริง จัดใหม่เป็น:

```
frontend/src/
├── api/                       (Step 1 ค่อยสร้าง)
├── components/
│   ├── Icon.jsx               ← แยกจาก design/data.jsx
│   ├── Logo.jsx               ← design/logos.jsx
│   ├── Layout.jsx             ← TopBar + Sidebar
│   ├── ui.jsx                 ← Modal, Toast, Badge, Empty, Stepper, StatCard, PageHead
│   └── charts.jsx             ← Donut, BarRow, ColumnChart, LineChart, MultiLineChart
├── pages/
│   ├── LoginPage.jsx
│   ├── student/               StudentNews, ExamForm, StudentStatus, StudentHistory
│   ├── officer/               OfficerDashboard, OfficerReview, OfficerStudents,
│   │                          StudentDetail, ManageRounds, ManageSubjects,
│   │                          ManageUsers, ManageNews
│   └── executive/             ExecutiveDashboard, Reports
├── mock/mockData.js           ← ข้อมูลปลอมชั่วคราว ลบทีละก้อนตอนต่อ API
├── styles/styles.css
├── App.jsx                    ← routing ตาม role
└── main.jsx
```

**ลบทิ้ง:**

| ของที่ลบ | เหตุผล |
|---|---|
| `src/design/` | ย้ายไป structure ใหม่หมดแล้ว |
| `src/design/admin.jsx` | ตัด role admin |
| `src/design/tweaks-panel.jsx` | แผงปรับแต่งเดโม ไม่ใช่ feature จริง |
| `public/design/` | สำเนาซ้ำของ `src/design/` ไม่มีใคร import |
| `src/pages/Login/` | หน้า login เก่าที่ไม่ได้ใช้ |
| `nurse-login-new/` | โปรเจกต์เก่าค้าง |

ลบ tweaks panel แล้วต้องล็อกค่าตายตัว: ฟอร์มกรอกผลสอบ = `toggle`, dashboard = `kpi`

**เกณฑ์ว่าเสร็จ:** เปิดเว็บแล้วหน้าตาเหมือนเดิมทุกหน้า (ยกเว้นไม่มี role admin กับแผง tweaks)

**เปลี่ยนแปลงระหว่างทำ:** ลบขั้นตอน "กรอกรหัสเว็บสภาการพยาบาล" ออกจาก `ExamForm` ตั้งแต่ Step 0
(เดิมวางแผนไว้ที่ Step 3) เพราะ mock data ตัด `councilEmail` / `councilSet` ออกไปแล้ว
ถ้าปล่อยไว้จะเหลือโค้ดที่อ้างถึงข้อมูลที่ไม่มีอยู่ ฟอร์มจึงเหลือ 3 ขั้นตอน:
กรอกผลสอบ → แนบหลักฐาน → ตรวจทาน

### Step 1 — Auth

#### Schema

```prisma
model User {
  email         String @unique @db.VarChar(100)   // เพิ่ม @unique
  password_hash String @db.VarChar(255)           // เพิ่มใหม่
}

model Student {
  // ลบ nursing_council_email
  // ลบ nursing_council_password
}
```

> migration นี้ลบคอลัมน์ถาวร ข้อมูลรหัสสภาที่มีจะหายหมด กู้ไม่ได้
> ต้องรันตอน DB ยังมีแค่ข้อมูล seed

#### Backend

| ไฟล์ | ทำอะไร |
|---|---|
| `src/utils/password.js` | ใหม่ — `hashPassword()` / `verifyPassword()` (bcryptjs) |
| `src/controllers/authController.js` | เขียนใหม่ — login ด้วย email + password |
| `src/app.js` | แก้ CORS `5173` → `5174` (vite รันที่ 5174) |
| `src/config/env.js` | เอา `AES_KEY` ออกจาก REQUIRED_VARS |
| `src/utils/crypto.js` | ลบ — ใช้เข้ารหัสรหัสสภาอย่างเดียว |
| `prisma/seed.js` | เอา field รหัสสภาออก + ใส่ `password_hash` ครบ 3 role |
| `requests.http` | ลบ section 5c |

API:

| Method | URL | รับ | คืน |
|---|---|---|---|
| `POST` | `/api/auth/login` | `{ email, password }` | `{ success, data: { token, user } }` |
| `GET` | `/api/auth/me` | Bearer token | `{ success, data: user }` |

ไม่มี `/api/auth/logout` — JWT เป็น stateless ฝั่ง frontend ลบ token เอง

#### Frontend

| ไฟล์ | ทำอะไร |
|---|---|
| `src/api/client.js` | ใหม่ — fetch wrapper แนบ Bearer token, เจอ 401 → ลบ token เตะออก |
| `src/api/auth.js` | ใหม่ — `login()` / `getMe()` |
| `src/pages/LoginPage.jsx` | ปุ่มเลือก role → ช่อง email + password |
| `src/App.jsx` | เก็บ user จริงจาก API, ตัดปุ่มสลับ role เหลือ logout |

token เก็บที่ `localStorage` → refresh หน้าแล้ว session ยังอยู่

#### Flow

```
กรอก email + password
      ↓  POST /api/auth/login
หา user จาก email → verifyPassword() → sign JWT { userId, role, studentId }
      ↓
frontend เก็บ token ใน localStorage → setUser → เข้าหน้าตาม role
      ↓
ทุก request ต่อไป client.js แนบ Authorization: Bearer <token>
      ↓  เจอ 401
ลบ token → เด้งกลับหน้า login
```

#### เกณฑ์ว่าเสร็จ

- [ ] login ครบ 3 role → เข้าหน้าตรงตาม role
- [ ] รหัสผิด → ขึ้น error ไม่เข้าระบบ
- [ ] refresh หน้า → ยังอยู่ ไม่เด้งออก
- [ ] logout → กลับหน้า login, localStorage ว่าง
- [ ] `GET /api/auth/me` ไม่มี token → 401
- [ ] grep หา `admin` / `nursing_council` ในโค้ดไม่เจอแล้ว

---

## ยังไม่ทำใน Step 0-1

- Step 2 — import นักศึกษาจาก Excel
- Step 3 — ต่อ API หน้าที่เหลือทีละหน้า (ตอนนี้ยังเป็น mock data)
- ลบ STEP 0 ของ ExamForm (ฟอร์มกรอกรหัสสภา) — ทำตอน Step 3

---

## รายการที่ต้องแก้ในรายงาน .docx

1. **บทที่ 3.4 data dictionary** ตาราง `students` — ลบแถว `nursing_council_email`, `nursing_council_password`
2. **บทที่ 3.4 data dictionary** ตาราง `users` — เพิ่มแถว `password_hash` (VARCHAR(255))
3. **สิทธิ์นักศึกษา** — ลบข้อ "กรอกรหัสเว็บสภาการพยาบาล"
4. **สิทธิ์เจ้าหน้าที่** — ลบข้อ "ดูรหัสสภาของนักศึกษา"
5. **บทที่ 4 หน้าจอนักศึกษา** — ลบหน้า "กรอกรหัสเว็บสภา" ออกจาก flow
6. **หัวข้อ Auth** — เพิ่มหมายเหตุว่าเวอร์ชันปัจจุบันใช้ email + password ระหว่างรอเชื่อม PSU One Passport
7. **ER Diagram** — อัปเดตให้ตรงกับ 1 และ 2
