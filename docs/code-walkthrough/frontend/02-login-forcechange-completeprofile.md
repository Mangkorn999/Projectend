# Frontend 02 — หน้า Login, บังคับเปลี่ยนรหัสผ่าน, กรอกโปรไฟล์ครั้งแรก

ไฟล์ (`frontend/src/design/`): `login.jsx` (291), `forceChangePassword.jsx` (79), `completeProfile.jsx` (178)
backend ที่เกี่ยวข้อง: `POST /api/auth/login`, `PATCH /api/auth/password`, `POST /api/students/complete-profile` (ดู backend [02](../backend/02-auth-และแผนที่-routes.md), [05](../backend/05-students-repository-และ-controller.md))

> **ลำดับ 3 หน้าจอก่อนเข้าแอป** (ตัดสินที่ `app.jsx` — ดู [frontend 01](01-entry-api-app-helpers.md))
> `Login` → (ถ้า `must_change_password`) `ForceChangePassword` → ต้อง login ใหม่ → (ถ้านักศึกษา `profile_incomplete`) `CompleteProfile` → เข้าแอป
> ระหว่างรอ backend **บล็อกทุก endpoint** (403) ยกเว้นที่จำเป็น — frontend บังคับหน้าจอ แต่ backend ล็อกจริงอีกชั้น

## React พื้นฐานที่ต้องรู้ก่อนอ่าน
- **คอมโพเนนต์ (component)** = ฟังก์ชันที่คืน JSX (HTML-ใน-JS) เช่น `export function Login({ onLogin }) {...}`; `{ onLogin }` = destructure props
- **`useState(ค่าเริ่ม)`** → คืน `[ค่า, ฟังก์ชันเปลี่ยนค่า]` — เปลี่ยนค่าแล้ว React วาดหน้าใหม่
- **`useEffect(fn, [dep])`** → รัน `fn` หลังวาดจอ และรันซ้ำเมื่อ dep เปลี่ยน; `[]` = รันครั้งเดียวตอนเริ่ม
- **controlled input** = `<input value={x} onChange={e => setX(e.target.value)} />` ค่าในช่องมาจาก state เสมอ
- **`cond && <div/>`** = แสดงเมื่อ cond จริง; **`a ? b : c`** = เลือกอย่างใดอย่างหนึ่ง

---

## 1. `login.jsx`

### ส่วนค่าคงที่ (1-50)
| บรรทัด | อธิบาย |
|---|---|
| 6-9 | import `useState`, ไอคอน `Icon` (data.jsx), `Logo`, และ `apiFetch/setSession/ApiError` (api.js) |
| 12-18, 25-29 | ข้อความภาษาอังกฤษของหน้า suffix `_EN` ไทยเขียนอยู่ในตำแหน่งที่ใช้ (หน้า login มีระบบ TH/EN ของตัวเอง เพราะยังไม่ login จึงยังไม่มี `lang` จาก app.jsx) |
| 23-24 | `CONTACT_EMAIL` / `CONTACT_URL` อ่านจาก `.env` ของ vite (`import.meta.env.VITE_*`); `\|\| ''` ถ้าไม่ตั้งใช้สตริงว่าง — ไม่ตั้ง = ข้อความเฉย ๆ ไม่ใส่ลิงก์มั่วให้กดผิดที่ |
| 33-46 | `BUBBLES` — ตารางตำแหน่ง/ขนาด/ความเร็วของลูกกลมตกแต่ง (ปรับดีไซน์แก้ตรงนี้) `delay` ติดลบ = เหมือนลอยมาก่อนแล้ว |
| 50 | `REMEMBER_KEY` — key ใน localStorage ที่จำ **เฉพาะ username** (ไม่เก็บรหัสผ่านเด็ดขาด เสี่ยง XSS ปล่อยให้ password manager ของ browser จัดการผ่าน `autoComplete`) |

### `Login({ onLogin })` (53-290)
| บรรทัด | อธิบาย |
|---|---|
| 54-61 | state: `loading`, `lang`, `username` (เริ่มจาก localStorage ด้วยฟังก์ชัน `() => ...` = **lazy initial state** อ่านครั้งเดียวตอนเริ่ม), `password`, `showPassword`, `rememberMe` (`!!` แปลงเป็น boolean), `error` |
| 56 | `isEN = lang === 'EN'` ใช้เลือกข้อความทั้งหน้า |
| 64-85 | **`submit`**: ล้าง error; ช่องว่างตัวใดตัวหนึ่ง → ตั้ง error แล้ว `return`; `setLoading(true)`; `apiFetch('/auth/login', {method:'POST', auth:false, body:{psu_passport_id: username, password}})` (backend ใช้ชื่อ field `psu_passport_id` — เป็นรหัสนักศึกษาหรือรหัสที่เจ้าหน้าที่ตั้ง); สำเร็จ → จำ/ลบ username ตาม checkbox; `setSession(data.user, data.must_change_password, data.profile_incomplete)` เก็บ user ลง localStorage; `onLogin(...)` แจ้ง app.jsx. `catch`: ถ้าเป็น `ApiError` โชว์ข้อความไทยจาก backend (`e.message`) ไม่งั้นข้อความกลาง; `finally` ปิด loading เสมอ. **ไม่มี token ใน response** — อยู่ใน cookie ที่ backend ตั้งให้ |
| 88 | wrapper ทั้งหน้า `display:flex` (ซ้าย brand / ขวาฟอร์ม) |
| 90-98 | ปุ่มสลับภาษา TH/EN มุมขวาบน: `onClick={() => setLang('TH')}`; สีปุ่มตาม `isEN` |
| 101-149 | **แผง brand ซ้าย:** พื้นหลังไล่สี; (106-125) ชั้นตกแต่ง — `lg-aurora` 4 ก้อน, `lg-dots`, `BUBBLES.map(...)` สร้างลูกกลมจากตาราง (`key={i}`), `<svg>` เส้น ECG 3 ชั้น (base/glow/pulse) ใช้ `pathLength="100"` + `stroke-dasharray` ให้แสงวิ่งตามเส้น; (127-133) โลโก้+ชื่อคณะ; (136-145) หัวเรื่อง + เส้นทอง + ชื่อระบบอีกภาษา; (146-148) ลิขสิทธิ์ |
| 152-213 | **ฟอร์มขวา:** (155-158) ก้อนสีเบลอพื้นหลังห่อ `overflow:hidden` กัน scrollbar; (162) หัวข้อ; (164-168) ช่อง username `autoComplete="username"`, **`onKeyDown={e => e.key==='Enter' && submit()}`** กด Enter ส่งฟอร์ม; (169-182) ช่องรหัสผ่าน `type={showPassword ? 'text':'password'}` + ปุ่มตา `setShowPassword(v => !v)` (functional update); (183-186) checkbox จดจำ; (187) แสดง error ถ้ามี; (190-207) ลิงก์ติดต่อเจ้าหน้าที่ — 3 กรณี: มีอีเมล → `mailto:`, มี URL → ลิงก์ใหม่ (`rel="noopener noreferrer"` กันหน้าที่เปิดใหม่คุมหน้าเดิม), ไม่มีอะไร → ข้อความเฉย; (209-211) ปุ่มเข้าสู่ระบบ `disabled={loading}` กดซ้ำไม่ได้ ข้อความเปลี่ยนเป็น "กำลังเข้าสู่ระบบ…" |
| 214-287 | `<style>{\`...\`}</style>` CSS เฉพาะหน้านี้: `@media(max-width:860px)` ซ่อนแผง brand บนจอเล็ก; keyframes drift/float/pulse/rise/shimmer ใช้เฉพาะ `transform`/`opacity` (ลื่น GPU); `@media (prefers-reduced-motion: reduce)` ปิดแอนิเมชันทั้งหมดสำหรับคนตั้ง "ลดการเคลื่อนไหว" (accessibility) |

---

## 2. `forceChangePassword.jsx` (79 บรรทัด)
ใช้กับบัญชี officer/executive/reviewer ที่เจ้าหน้าที่สร้าง/รีเซ็ตให้ (รหัสชั่วคราว → `must_change_password = true`)

| บรรทัด | อธิบาย |
|---|---|
| 8-11 | import |
| 13-18 | `ForceChangePassword({ onDone })` + state: รหัสเดิม, รหัสใหม่, ยืนยัน, loading, error |
| 20-40 | **`submit`**: ตรวจ 3 ข้อฝั่งหน้าจอก่อน (กรอกครบ / ยาว ≥ 8 / สองช่องตรงกัน — เป็นแค่ UX; backend ตรวจซ้ำเป็นด่านจริง); `PATCH /auth/password` ส่ง `current_password`, `new_password`; **สำเร็จแล้ว `await logout()`** แล้ว `onDone()` — token เดิมมีธง `mustChangePassword: true` ฝังอยู่ใน JWT ใช้ต่อไม่ได้ ต้องให้ backend ลบ cookie แล้ว login ใหม่เพื่อรับ cookie ใหม่ |
| 42-79 | ฟอร์ม 3 ช่อง `type="password"`; กล่อง error พื้นแดงอ่อน; ปุ่มเปลี่ยนรหัส `disabled={loading}` |

---

## 3. `completeProfile.jsx` (178 บรรทัด)
นักศึกษาที่เจ้าหน้าที่ import มา (มีแค่รหัส+เลขบัตร) ต้องกรอกโปรไฟล์ก่อน — **3 ขั้นในหน้าเดียว** ควบคุมด้วย state `step`: `'form'` → `'review'` → `'done'`

| บรรทัด | อธิบาย |
|---|---|
| 14-17 | `EMPTY` = ค่าเริ่มของฟอร์ม (ทุกช่องสตริงว่าง) |
| 19-26 | state: `step`, `form` (object เดียวเก็บทุกช่อง), `rooms`, `loadingRooms`, `saving`, `error`, `result` |
| 28-34 | `useEffect(..., [])` โหลดห้องจาก `GET /rooms` ตอนเปิดหน้า; `.then(setRooms)` (ส่งฟังก์ชันตรง ๆ ได้) `.catch` ตั้ง error (ไม่งั้น dropdown ว่างเฉย ๆ ไม่รู้สาเหตุ) `.finally` ปิด loading |
| 36 | **`set(field)`** = ฟังก์ชันที่คืนฟังก์ชัน (curried): `set('first_name')` → `(e) => setForm(f => ({...f, first_name: e.target.value}))` — ใช้กับทุกช่องบรรทัดเดียว. `{...f, [key]: ค่า}` = ก๊อป object แล้วเขียนทับ key เดียว (React ห้ามแก้ state ตรง ๆ ต้องสร้าง object ใหม่) |
| 38 | `roomName` — หาชื่อห้องจาก id ที่เลือก ด้วย `rooms.find(...)?.room_name \|\| ''` (`String()` ทั้งสองข้างเพราะ id จาก `<select>` เป็นสตริง) ใช้โชว์ในขั้น review |
| 40-48 | `goReview` — destructure ฟอร์ม; ขาดช่องใดช่องหนึ่ง → error; ผ่าน → `setStep('review')` |
| 50-66 | **`submit`**: `POST /students/complete-profile` ส่ง `{...form, room_id: Number(form.room_id)}` (แปลง id เป็นตัวเลข); สำเร็จ → `setResult(data)`, `step='done'`; ล้ม → โชว์ error แล้วกลับ `'form'` |
| 68 | wrapper กลางจอพื้นไล่สี |
| 75-84 | **ขั้น `done`:** โชว์ "ปีการศึกษาที่จบ" จาก `result?.student?.academic_year` — ค่านี้ **backend กำหนด** นักศึกษาแก้เองไม่ได้ (คุมว่าเห็นรอบสอบไหน); ปุ่ม "เข้าสู่ระบบ" เรียก `onDone` |
| 85-109 | **ขั้น `review`:** แสดงสรุปข้อมูลด้วย `<ReviewRow>` ทีละบรรทัด (กรอกครั้งเดียว แก้ภายหลังต้องให้เจ้าหน้าที่แก้) ปุ่ม "← แก้ไข" (`setStep('form')`) / "ยืนยันข้อมูล" (`submit`) ทั้งคู่ `disabled={saving}` |
| 111-163 | **ขั้น `form`:** ช่องชื่อ/นามสกุล (ไทย), First/Last (EN) จัดแถวละ 2 ช่องด้วย `display:flex` + `flex:1`; อีเมล `type="email"`; เบอร์ `className="input tnum"` (`tnum` = ตัวเลขกว้างเท่ากัน); ห้องเรียนใช้ `<Select>` (คอมโพเนนต์เอง จาก components.jsx) `options` = ตัวเลือกว่าง + `rooms.map(...)` (spread `...` ต่อ array); ปุ่ม "ตรวจสอบข้อมูล" → `goReview` |
| 170-178 | `ReviewRow({label, value, last})` — คอมโพเนนต์ย่อยแถว "ป้าย: ค่า"; `last` ตัดเส้นคั่นแถวสุดท้าย; `value \|\| '-'` ถ้าว่างใส่ขีด |
