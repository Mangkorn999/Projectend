# Frontend Guide — ระบบบันทึกใบอนุญาตประกอบวิชาชีพ

คู่มืออธิบาย frontend ทั้งหมด แบบลึกถึงระดับไฟล์ ใช้คู่กับ [`backend/BACKEND_GUIDE.md`](../backend/BACKEND_GUIDE.md)
(README.md/.env.example ที่ root โปรเจกต์เป็นของเก่า SyntaxCraft — ไม่เกี่ยวกับที่นี่)

Path จริง: `frontend/` (React 19 + Vite 8) ชื่อ package คือ `nurse-login-new`

---

## 1. ภาพรวมโครงสร้างโฟลเดอร์

```
frontend/
├── src/
│   ├── main.jsx           ← entry point จริง (Vite ชี้มาที่นี่)
│   ├── App.jsx             ← wrapper บางๆ ห่อ design/app.jsx
│   ├── App.css, index.css  ← CSS เดิมจาก Vite template (แทบไม่ได้ใช้)
│   ├── styles/styles.css   ← ไฟล์ซ้ำเก่า ไม่ได้ import ที่ไหน (dead)
│   └── design/              ← **โค้ดจริงเกือบทั้งหมดอยู่ที่นี่**
│       ├── app.jsx                      ← shell หลัก: routing, auth state, layout
│       ├── api.js                       ← HTTP client กลาง
│       ├── i18n.js                      ← dictionary แปล TH/EN
│       ├── notifications.js             ← รวมแจ้งเตือนจาก DB + ประกาศ
│       ├── data.jsx                     ← Icon component + mock data เก่า (ส่วนใหญ่ dead)
│       ├── logos.jsx                    ← โลโก้ SVG
│       ├── tweaks-panel.jsx             ← panel ปรับแต่ง UI (dev-only, ไม่เกี่ยว backend)
│       ├── components.jsx               ← UI ที่ใช้ร่วมกันทุกหน้า (การ์ด, กราฟ, modal, ...)
│       ├── login.jsx                    ← หน้า signin
│       ├── firstSetup.jsx               ← ตั้งรหัสผ่านครั้งแรก
│       ├── forceChangePassword.jsx      ← บังคับเปลี่ยนรหัสชั่วคราว
│       ├── student.jsx                  ← ส่วนใหญ่ legacy (ดูหัวข้อ 6)
│       ├── studentImport.jsx            ← จนท. นำเข้านักศึกษา (CSV/manual)
│       ├── studentStatusReal.jsx        ← นศ. ดูสถานะ + ประวัติ
│       ├── examFormReal.jsx             ← นศ. กรอกผลสอบ 8 วิชา
│       ├── newsReal.jsx                 ← ข่าวสาร (นศ. อ่าน / จนท. CRUD)
│       ├── officerStudentsReal.jsx      ← จนท. รายชื่อนักศึกษา
│       ├── officerReviewReal.jsx        ← จนท. คิวตรวจสอบ/ยืนยันผล
│       ├── studentDetailReal.jsx        ← จนท./ผู้บริหาร ดูผลรายบุคคล
│       ├── manageRoundsSubjectsReal.jsx ← จนท. จัดการรอบสอบ+รายวิชา
│       ├── manageUsersReal.jsx          ← จนท. จัดการบัญชี จนท./ผู้บริหาร
│       ├── dashboardReal.jsx            ← แดชบอร์ด (จนท. + ผู้บริหาร) — ไฟล์ใหญ่สุด
│       └── reportsReal.jsx              ← รายงาน + export PDF
```

หลักการตั้งชื่อ: ไฟล์ที่ลงท้าย **`Real`** = ต่อ backend จริงผ่าน `apiFetch` (ใช้งานจริงในแอป) ส่วนไฟล์ไม่มี `Real` ต่อท้าย (เช่น `student.jsx` บางส่วน) มักเป็นโครงเก่า/ตัวอย่าง demo ที่ยังไม่ได้ลบ

---

## 2. Entry point chain

```
main.jsx  →  App.jsx  →  design/app.jsx (App component จริง)
```

**`main.jsx`** — จุดเริ่มของ React, `createRoot(...).render(<App/>)` ใน `<StrictMode>`

**`App.jsx`** — ไม่มี logic อะไรเลย แค่ import CSS + ห่อ `design/app.jsx`'s `App`:
```jsx
function App() { return <DesignApp />; }
```

**`design/app.jsx`** — ตัวจริงที่ทำทุกอย่าง: authentication state, role-based routing (ไม่ใช้ react-router!), layout (TopBar+Sidebar), แจ้งเตือน, badge นับเลข

---

## 3. Routing — ไม่มี react-router, ทำ URL เองด้วย History API

โปรเจกต์นี้ตั้งใจไม่ใช้ react-router (เช็ค `package.json` แล้วไม่มี dependency นี้) หน้าปัจจุบันเก็บเป็น React state ชื่อ `page` (string เช่น `'dashboard'`, `'students'`) แล้ว **map เข้ากับ URL เองด้วยมือ** ผ่านตาราง `PAGE_PATH` ใน `design/app.jsx`:

```js
const PAGE_PATH = {
  news: '/news', dashboard: '/dashboard', students: '/students', ...
};
```

กลไก:
- **`go(page)`** — ฟังก์ชันเปลี่ยนหน้าหลัก ใช้ทุกที่แทน react-router's `navigate()`: `setPage(p)` + `window.history.pushState(...)` (เขียน URL แบบไม่ reload หน้า)
- **`pageFromPath(role, path)`** — แปลง URL → ชื่อหน้า ตรวจด้วยว่า role นี้เข้าหน้านั้นได้ไหม (`ROLE_PAGES`) ไม่งั้นเด้งกลับหน้าเริ่มต้นของ role
- **refresh หน้าเว็บ** — อ่าน `window.location.pathname` ตอน mount (`bootPath`) แล้วรอ `/auth/me` ตอบกลับก่อนค่อยตั้งหน้าตาม URL (เพราะ role ยังไม่รู้จนกว่าจะเช็ค cookie เสร็จ)
- **ปุ่ม back/forward** — ฟัง event `popstate` แล้ว sync `page` state ให้ตรงกับ URL ใหม่
- **login/logout** — ใช้ `replaceUrl` (ทับ history เดิม) ไม่ใช่ `pushUrl` กัน "back" แล้วย้อนกลับไปหน้า login/หน้าที่ออกจากระบบไปแล้ว
- หน้าที่ต้องมี state พิเศษก่อนเปิดได้ (เช่น `detail` ต้องมี `sel` = นักศึกษาที่เลือกไว้) ถูกกันไม่ให้เปิดตรงจาก URL (`NEEDS_SELECTION`) เพราะ state นั้นหายไปตอน refresh

---

## 4. Infra layer (ไม่มี UI เอง แต่ทุกหน้าพึ่งพา)

### `api.js` — HTTP client กลาง
- `apiFetch(path, {method, body, auth})` — ยิง `fetch()` ไป `http://localhost:3000/api${path}` เสมอ, ใส่ `credentials:'include'` (แนบ httpOnly cookie อัตโนมัติ — token อยู่ใน cookie ที่ JS แตะไม่ได้ กัน XSS ขโมย token)
- อ่าน response รูปแบบ `{success, data}` ของ backend, error → throw `ApiError`
- ถ้า backend ตอบ `code: "auth_required"` (401 เฉพาะกรณี session หมดจริง) → `forceLogout()`: เคลียร์ localStorage + reload หน้า ให้ `app.jsx` เห็นว่าไม่มี user แล้วตกไปหน้า login เอง (401 กรณีอื่น เช่น login รหัสผิด ไม่ reload — แค่โยน error ให้หน้าโชว์เอง)
- `getStoredUser/setSession/clearSession` — จัดการ **แค่ user object** ใน `localStorage['nursing_user']` (ไม่ใช่ token — token อยู่ cookie คนละที่)
- `logout()` — ยิง `POST /auth/logout` (ให้ backend ลบ cookie) แล้วค่อยเคลียร์ localStorage
- `fetchAuthedObjectUrl` / `openAuthedFile` — โหลดไฟล์ที่ต้อง login (PDF/รูปข่าว) เป็น blob URL เพราะ `<img src>`/`<a href>` ตรงๆ แนบ cookie เองไม่ได้

### `i18n.js` — dictionary คำแปล TH/EN
- `DICT = { TH: {...741 keys}, EN: {...741 keys} }` — ทุก key มีคู่ TH/EN ครบ (เช็คแล้วในเซสชันนี้)
- `t(lang, key, vars)` — ดึงคำแปล + แทน `{var}` ในสตริงด้วย `vars`
- `subjectName(lang, code, fallbackName)` — แปลชื่อวิชา (มี dictionary แยก `SUBJECT_NAME_EN` keyed ด้วยรหัสวิชา)
- `roomName(lang, name)` — แปลชื่อห้อง (`ห้องเรียนปกติ`/`ห้องเรียนอังกฤษ` → EN) — **ห้ามใช้ตรงจุดที่ค่าต้อง match กับ DB เป๊ะ** (เช่น import CSV, ตัวกรอง room ที่ compare กับ raw value)
- `pick(lang, obj, field)` — เลือก field ปกติ vs `field_en` (ใช้กับ mock data เก่าที่เก็บคู่ TH/EN ในอ็อบเจกต์เดียว — ปัจจุบันแทบไม่มีที่ใช้จริงแล้ว)

### `notifications.js` — รวมแจ้งเตือน 2 แหล่งเป็น list เดียว
1. ตาราง `notifications` ใน DB (นักศึกษาเท่านั้น — ผลถูกยืนยัน/ตีกลับ, เปิดสิทธิ์กรอก) → `fromServer(rows)`, อ่านแล้ว/ยังไม่อ่านมาจาก DB (`is_read`)
2. ประกาศจาก `/news` (ทุก role) → `buildNotifications({role, news, lang})`, อ่านแล้ว/ยังไม่อ่านเก็บที่ `localStorage['notif_read_<userId>']`
- `sortByNewest`, `countUnread` — helper รวม/เรียง/นับ

### `data.jsx` — ยังใช้จริงแค่ 2 อย่าง
- `Icon({name, size, stroke})` — SVG icon set ใช้ทุกหน้า (มี ~50 ไอคอนใน object `ICONS`)
- `STATUS` — label สถานะ (ใช้ใน `StatusBadge`)
- ที่เหลือ (`STUDENTS`, `YEARLY`, `NEWS`, `ROUNDS`, `ME`, `computeStats`, ฯลฯ) เป็น **mock data ตั้งแต่ก่อนต่อ backend จริง** — dead code เกือบหมด เหลือใช้แค่ใน `student.jsx` (ไฟล์ legacy ด้วยกัน)

### `logos.jsx` — `NurseEmblem` (SVG โลโก้หัวใจ+กากบาท) + `Logo` (wrapper ใช้จริง)

### `tweaks-panel.jsx` — panel ลอยมุมขวาล่าง (ปุ่มเฟือง ⚙) สำหรับสลับ theme/layout ตอน demo เท่านั้น ไม่เกี่ยวกับข้อมูลจริง (`useTweaks` hook เก็บ state ใน React memory ล้วน ไม่ persist)

---

## 5. `components.jsx` — UI ที่ใช้ร่วมกันทุกหน้า

| Component | หน้าที่ |
|---|---|
| `StatusBadge` / `PassBadge` | ป้ายสถานะสี (รอตรวจ/ยืนยัน/ตีกลับ) / ป้ายผ่าน-ไม่ผ่าน |
| `Avatar` | วงกลมตัวอักษรแรกของชื่อ |
| `TopBar` | แถบบนสุด: โลโก้, สลับภาษา, กระดิ่งแจ้งเตือน (มี modal), เมนู user/logout |
| `Sidebar` | เมนูด้านข้าง ตาม role |
| `StatCard` | การ์ดตัวเลขสรุป |
| `Donut` | กราฟวงแหวน |
| `BarRow` | แถบเดี่ยวแนวนอน — **มี animation**: เปิดหน้ามาไล่จาก 0 (เขียวจากซ้าย, track สีแดงจากขวา พร้อมกัน หน่วง 600ms รอ `.blur-in` จบก่อน) |
| `ColumnChart` | กราฟแท่งตั้ง |
| `LineChart` | กราฟเส้นเดี่ยว |
| `MultiLineChart` | กราฟเส้นหลายเส้น (เทียบปี) — มี tooltip hover, **animation เลื้อยซ้าย→ขวาตามความยาวเส้นจริง** (`stroke-dasharray`/`dashoffset`), รองรับค่า `null` (ข้ามจุด ไม่ลากไปหา 0), **กด legend ปีไหนดันเส้นปีนั้นขึ้นมาวาดบนสุด** (`front` state) |
| `FirstAttemptSubjectTable` | ตารางผลสอบครั้งแรกแยกรายวิชา (รูปแบบสภาการพยาบาล) |
| `PageHead` | หัวข้อหน้า + breadcrumb + ปุ่ม action |
| `Toast` / `useToast` | ข้อความแจ้งเตือนสั้นมุมจอ |
| `Modal` | หน้าต่างป๊อปอัป (ใช้ `createPortal`) |
| `Empty` | หน้าจอไม่มีข้อมูล |
| `Pagination` | ปุ่มเปลี่ยนหน้า |
| `Stepper` | แถบขั้นตอน |

---

## 6. หน้า Auth (ทุก role ใช้ร่วมกัน)

### `login.jsx`
- ฟอร์ม signin ธรรมดา (ไม่ใช่ PSU SSO แล้ว — advisor ตัดออก, role key ยังเผื่อสลับกลับ SSO ในอนาคต)
- `POST /auth/login` ด้วย `{psu_passport_id, password}`
- checkbox "จดจำรหัสผ่าน" — **เก็บแค่ username** ใน `localStorage['nurse_remember_username']` ไม่เก็บรหัสผ่านจริง (เสี่ยง XSS) ใช้ `autoComplete` ให้ browser จำรหัสผ่านแทน
- ลิงก์ "ลืมรหัสผ่าน" → `ForgotPassword` (component ในไฟล์เดียวกัน) — placeholder แจ้งให้ติดต่อเจ้าหน้าที่ (ยังไม่มี self-service reset ใน backend)

### `firstSetup.jsx` — `FirstSetup`
- นักศึกษาที่ถูก import เข้าระบบแล้ว ตั้งรหัสผ่านครั้งแรกที่นี่
- ยืนยันตัวตนด้วย รหัสนักศึกษา+ชื่อ+นามสกุล ต้องตรงกับที่ import ไว้เป๊ะ
- `POST /auth/first-setup`

### `forceChangePassword.jsx` — `ForceChangePassword`
- บัญชีที่ จนท. สร้างให้ (officer/executive) ยังใช้รหัสชั่วคราวอยู่ (`must_change_password=true`) — บล็อกทั้งแอปจนกว่าจะเปลี่ยนสำเร็จ
- `PATCH /auth/password`
- **หมายเหตุ:** ไฟล์นี้ไม่มี `lang` prop เลย ข้อความ hardcode เป็นไทยล้วน สลับภาษาไม่ได้ (รู้อยู่แล้ว ยังไม่ได้แก้)

---

## 7. หน้าฝั่งนักศึกษา

### `newsReal.jsx` → `StudentNewsReal`
- `GET /news` (ประกาศทั้งหมด) + `GET /rounds/active` (รอบที่เปิดอยู่ ถ้าไม่มีจะ error → เก็บเป็นข้อความ `blocked`)
- มี `NewsImage`/`Lightbox` — โหลดรูปประกาศเป็น blob (ต้อง login ก่อนถึงเห็นรูป), Lightbox ซูมได้ (scroll wheel/ปุ่ม, ลากตอนซูม, กด Escape ปิด)

### `student.jsx` → `FormIntro` (**อันเดียวที่ใช้จริงในไฟล์นี้**)
- หน้าแนะนำก่อนเข้าฟอร์มกรอกผล (3 ขั้นตอน) กดแล้วไป `examFormReal.jsx`
- ฟังก์ชัน/component อื่นในไฟล์เดียวกัน (`StudentNews`, `ExamForm`, `StudentStatus`, `StudentHistory`, `UploadSlots`) เป็น mock เก่า **ไม่มีใคร import แล้ว** (ดูหัวข้อ 10)

### `examFormReal.jsx` → `ExamFormReal`
- `GET /rounds/active` — ได้รอบ+รายวิชาของรอบนั้น พร้อม flag `already_passed` ต่อวิชา (วิชาที่เคยผ่านแล้วจากรอบก่อนไม่ต้องกรอกซ้ำ)
  และ `can_fix_rejected` — ถ้า `true` ฟอร์มเปิดให้แก้ได้แม้ `phase` เป็น closed/expired (ใบที่ถูกตีกลับแก้ส่งใหม่ได้หลังปิดรอบ) ฟอร์มกรอกได้เมื่อ `phase === "active" || can_fix_rejected`
- เช็ค `GET /exam-results/me` หาใบเก่าของรอบนี้ — ถ้า `approved` แล้วล็อกแก้ไม่ได้, ถ้า `pending`/`rejected` ดึงคำตอบเดิมมาเติมในฟอร์ม
- **ไฟล์หลักฐาน (แก้ 1 ต.ค. 2569):** แนบได้หลายไฟล์ PDF/JPG/PNG รวมไม่เกิน 5 ไฟล์ ไฟล์ละไม่เกิน 10 MB (ค่าคงที่ + ป้ายภาษาไทยอยู่ที่ `evidenceFiles.js`)
  ไฟล์เดิมของใบแสดงพร้อมปุ่ม "นำออก" (ลบจริงตอนกดส่ง), ไฟล์ใหม่ที่เลือกแสดงเป็นรายการ, ตรวจชนิด/ขนาด/จำนวนฝั่งหน้าจอก่อน (backend ตรวจซ้ำจากเนื้อไฟล์จริง)
- **ลำดับตอนกดส่ง** (เพราะ backend ให้แก้ไฟล์ได้เฉพาะตอนรอบเปิดหรือใบถูกตีกลับ):
  - ใบใหม่: `POST /exam-results` (ได้ `result_id`) → อัปโหลดทีละไฟล์ `POST /exam-results/:id/certificates`
  - ใบเดิม: `DELETE /certificates/:id` ไฟล์ที่นำออก → อัปโหลดไฟล์ใหม่ → `POST /exam-results` (ถ้าส่งผลก่อน ใบจะกลายเป็นรอตรวจ แล้วแก้ไฟล์ไม่ได้ในกรณีรอบปิดแล้ว)

### `studentStatusReal.jsx` → `StudentStatusReal` + `StudentHistoryReal`
- ทั้งคู่ใช้ `GET /exam-results/me` ตัวเดียวกัน (เรียง `submitted_at desc` มาจาก backend)
- `StudentStatusReal` — โชว์ผลล่าสุด (results[0]) + timeline (ส่ง→ตรวจ→ยืนยัน/ตีกลับ)
- `StudentHistoryReal` — ตารางประวัติทุกรอบ

---

## 8. หน้าฝั่งเจ้าหน้าที่คณะ (officer)

### `studentImport.jsx` → `StudentImport`
2 แท็บ:
- **CSV import** (`CsvImport`) — `POST /students/import` (multipart), โชว์ผลลัพธ์แยก "สำเร็จ"/"ข้าม" (จัดหมวดเหตุผลที่ข้ามด้วย pattern matching ข้อความจาก backend), ดาวน์โหลด template/รายการที่ข้ามกลับไปแก้ (ใส่ BOM กัน Excel อ่านภาษาไทยเพี้ยน)
- **กรอกเอง** (`ManualAdd`) — `POST /students` ทีละคน, ห้องเลือกจาก `GET /rooms` จริง (กันพิมพ์ชื่อห้องผิด)

### `officerStudentsReal.jsx` → `OfficerStudentsReal`
- `GET /students` + `GET /exam-results` (join ฝั่ง client เอาผลล่าสุดของแต่ละคน)
- filter: ค้นหา, สถานะ, ห้อง, ปี, สิทธิ์กรอก
- เปิด/ปิดสิทธิ์กรอกทีละคนหรือหลายคนพร้อมกัน (`PATCH /students/bulk-eligible`)
- ลบนักศึกษา (`DELETE /students/:id`) — ทำได้เฉพาะคนที่ยังไม่มีผลสอบ (DRAFT เท่านั้น, backend กันซ้ำอีกชั้น)
- ปุ่ม "รีเซ็ตรหัส" ต่อแถว — `POST /users/:user_id/reset-password` (endpoint เดียวกับที่ `manageUsersReal.jsx` ใช้ ไม่ได้จำกัด role ปลายทาง)

### `officerReviewReal.jsx` → `OfficerReviewReal`
- คิวตรวจสอบผล **ทำงานทีละรอบเสมอ** (dropdown เลือกรอบ) — ไม่รวมทุกรอบทุกปี กันเลข badge ไม่ตรงกับ Dashboard
- 4 แท็บ: รอตรวจสอบ / ตีกลับ / ยืนยันแล้ว / ยังไม่กรอก
- ดึง `/exam-results?round_id=` คู่กับ `/dashboard/stats?round_id=` (stats ล้มได้โดยไม่ทำให้ทั้งหน้าเด้ง error — ใช้แค่ตัดชื่อคนที่ผ่านครบแล้วออกจากแท็บ "ยังไม่กรอก")
- "ยังไม่กรอก" = รุ่นเดียวกับรอบ + เปิดสิทธิ์ + ไม่มีผลสอบรอบนี้ + **ยังไม่เคยผ่านครบทุกวิชามาก่อน** (คนที่ผ่านครบตั้งแต่รอบก่อนไม่ต้องมาโผล่ค้างทุกรอบถัดไป)

### `studentDetailReal.jsx` → `StudentDetailReal`
- ดูผลรายบุคคล — `GET /subjects` + `GET /exam-results?student_id=`
- ถ้ามาจากหน้าคิวตรวจสอบ จะระบุ `student.resultId` มาด้วย (เปิดใบที่กดมาเป๊ะๆ ไม่ใช่ใบล่าสุด)
- ปุ่มยืนยัน/ตีกลับ (`PATCH /exam-results/:id/approve` หรือ `/reject`) — **ไม่โชว์ถ้า `readonly`** (ผู้บริหารเข้าหน้านี้ไม่ได้ตั้งแต่ต้นอยู่แล้ว แต่ prop เผื่อไว้)
- ดูไฟล์แนบผ่าน `openAuthedFile` (ต้อง login ก่อนเห็นไฟล์)

### `manageRoundsSubjectsReal.jsx` → `ManageRoundsSubjectsReal`
2 แท็บ (รอบสอบ / รายวิชา):
- รอบสอบ: filter เริ่มต้น "เฉพาะรอบที่เปิดอยู่" (ปิดรอบแล้วไม่หายจาก list — สลับ filter ไปปีนั้นให้อัตโนมัติ), สร้าง/แก้/ลบรอบ, เลือกวิชาที่รอบนั้นสอบ (ล็อกแก้ไม่ได้ถ้ารอบเปิดอยู่แล้ว)
- เวลาทั้งหมดยึด **เวลาไทย (ICT, UTC+7)** เสมอ ไม่ใช่ timezone เครื่อง จนท. (มี helper แปลงไป-กลับ `toDateTimeInput`/`showThaiDateTime`)
- รายวิชา: CRUD ธรรมดา

### `manageUsersReal.jsx` → `ManageUsersReal`
- จัดการบัญชี officer/executive เท่านั้น (`GET /users` filter เอาแค่ 2 role นี้)
- สร้างบัญชีไม่ต้องตั้งรหัส (เจ้าตัวไปตั้งเองที่ `firstSetup.jsx` — เหมือน flow นักศึกษา)
- รีเซ็ตรหัส/ถอนสิทธิ์ ต้องยืนยันก่อนเสมอ (กระทบผู้ใช้ทันที ย้อนกลับเองไม่ได้)

### `newsReal.jsx` → `ManageNewsReal`
- CRUD ข่าว + แนบรูปแยก request (multipart, ต้องมี `news_id` ก่อนถึงอัปโหลดรูปได้ — สร้างข่าวก่อนแล้วค่อยยิงรูปตาม)

---

## 9. `dashboardReal.jsx` — ไฟล์ใหญ่สุด (~1,050 บรรทัด)

ใช้ทั้ง officer (`readonly=false`) และ executive (`readonly=true`) โดย component หลักตัวเดียวกัน `DashboardReal({go, readonly, lang})`

**โหลดข้อมูล:** `GET /rounds` + `GET /dashboard/history?years=20` ตอน mount, แล้วยิง `GET /dashboard/stats?round_id=` เพิ่มตามรอบ/ปีที่เลือก

**โครงหน้าเจ้าหน้าที่** (ไม่ readonly):
- โซน "ผลการกรอกตามรอบ" — `RoundTabs` (รอบที่1/รอบที่2/.../รวมทั้งปี) คุม StatCard 5 ใบ + แถบวันปิดรับ
- แท็บกลาง (`MainTabs`): สัดส่วนสถานะ / อัตราผ่านรายวิชา / สรุปผลสอบผ่านครั้งแรกจำแนกรายวิชา / จำนวนและร้อยละผู้สอบผ่านครั้งแรก / สถิติเชิงรายงาน
  - **2 แท็บกลาง (firstBySubject, firstCount) หายไปจากแถบเลย** ถ้าไม่ได้เลือก "รวมทั้งปี" (เป็นตัวเลขระดับปี ไม่มีมุมมองรายรอบให้โชว์คู่กัน) — มี `useEffect` สลับกลับแท็บ `status` อัตโนมัติถ้าเผลอค้างอยู่แท็บที่หายไป
  - "สถิติเชิงรายงาน" มี sub-tab ของตัวเอง (`reportTab`): ร้อยละผ่านครั้งแรกย้อนหลัง / อัตราผ่านรายวิชาย้อนหลัง / ผ่านครบทุกวิชา — มี `YearMultiPicker` ติ๊กเลือกได้สูงสุด 3 ปี แยกอิสระจากปีที่เลือกด้านบน

**โครงหน้าผู้บริหาร** (readonly): `ExecutiveOverview` (hero การ์ด 3 ช่อง + กราฟรายครั้งสอบ + กราฟเทียบปี) ตามด้วย Section "สถิติเชิงรายงาน" (5 sub-tab เหมือนฝั่ง จนท. แต่ไม่มีโซนเลือกรอบ — เป็นระดับปีเสมอ)

**Component ย่อยสำคัญในไฟล์:**
| ชื่อ | ทำอะไร |
|---|---|
| `StatusDonut` | การ์ด Donut สัดส่วนสถานะ ใช้ทั้งมุมมองรอบเดียวและรวมทั้งปี |
| `SubjectRateCard` | แท่งอัตราผ่านรายวิชา |
| `PassDistribution` | ตาราง "ผ่านกี่วิชา" แยกห้อง (เฉพาะรอบแรกของปี) |
| `SubjectHistoryChart` | กราฟเส้นอัตราผ่านรายวิชาย้อนหลัง 3 ปี — union วิชาจากทุกปี (กันวิชาหายถ้าปีล่าสุดสอบไม่ครบ), ปีที่ไม่ได้เปิดสอบวิชานั้นข้ามจุดไปเลย |
| `YearCompare` | ตาราง "ผ่านครบทุกวิชา" แยกห้อง ย้อนหลังหลายปี |
| `FirstAttemptPassRate` | การ์ดปี (คลิกได้!) — กดปีไหนเปิด modal โชว์กราฟแยกทุกรอบของปีนั้น (`RoundBreakdownTable`) |
| `yearStatus` (state ใน component หลัก) | ไม่มี endpoint สรุปสถานะรวมทั้งปีตรงๆ — ยิง `/dashboard/stats` ทีละรอบของปีนั้นแล้วรวมเอง (cache ต่อปี) |

---

## 10. `reportsReal.jsx` — รายงาน + export PDF

- โหลดปี/รอบแยกจาก dashboard (มี dropdown เลือกเองในหน้านี้)
- `GET /dashboard/stats?round_id=` แสดงบนจอ, ปุ่ม "พิมพ์" (`window.print()` + CSS `@media print`) และปุ่ม "ดาวน์โหลด PDF"
  ซึ่งถ่ายภาพกล่องรายงานบนจอเป็น PDF ฝั่งเบราว์เซอร์ (`exportReportPdf.js` — html2canvas + jsPDF โหลดตอนกดเท่านั้น) จึงได้หน้าตาเหมือนบนจอ
  (endpoint PDF ฝั่ง server `GET /dashboard/export?round_id=` ยังอยู่ แต่ปุ่มบนหน้านี้ไม่ได้ใช้แล้ว)
- แผง "ส่งออกข้อมูล" (officer): รายงานสรุป, ผ่าน/ไม่ผ่านครั้งแรก, ผ่าน/ไม่ผ่านภายในปีแรก (`yearExports.js` → `GET /dashboard/export-first-year`), ข้อมูลนักศึกษาทั้งรุ่น

---

## 11. ไฟล์/โค้ด legacy (ไม่มีผลต่อแอปที่รันจริง)

- **`student.jsx`** — export `StudentNews`, `ExamForm`, `StudentStatus`, `StudentHistory`, `UploadSlots` ไม่มีใคร import แล้ว (ถูกแทนด้วย `*Real.jsx`) เหลือแค่ `FormIntro` ที่ยังใช้จริง
- **`data.jsx`** — mock data ส่วนใหญ่ (`STUDENTS`, `YEARLY`, `TREND`, ฯลฯ) ไม่มีที่ใช้ นอกจาก `Icon`/`STATUS`
- **`src/styles/styles.css`**, **`src/App.css`**, **`src/index.css`** — เศษจาก Vite template เดิม, สไตล์จริงอยู่ที่ `design/styles.css` (import ใน `design/app.jsx`)

ไม่ต้องแก้/ลบไฟล์พวกนี้เอง (เผื่อใครยัง reference อยู่ที่อื่น) แต่ไม่ต้องเสียเวลาอ่านถ้าจะเข้าใจว่าแอปทำงานยังไงจริงๆ

---

## 12. Contract กับ backend (สรุปสั้น)

- ทุก request ผ่าน `apiFetch` เท่านั้น (ไม่มีที่ไหนเรียก `fetch()` ตรงๆ ยกเว้นดาวน์โหลดไฟล์)
- Response format: `{success: true, data}` หรือ error throw ผ่าน `ApiError`
- Field ทุกตัวเป็น `snake_case` ตรงกับ backend (ไม่แปลงเป็น camelCase ฝั่ง frontend)
- Logic คำนวณ (สถานะผ่าน/ไม่ผ่าน, %, สถิติ) **ทำที่ backend ทั้งหมด** — frontend แค่หยิบมาแสดง ไม่คำนวณซ้ำ (ยกเว้น `yearStatus` ใน dashboard ที่รวมเองจาก stats หลายรอบ เพราะไม่มี endpoint ให้ตรงๆ)
