# Frontend 01 — จุดเริ่ม, api.js, app.jsx (ตัวคุมหน้า), ตัวช่วยเล็ก ๆ

โฟลเดอร์: `frontend/` (React 19 + Vite) — โค้ดหน้าจอทั้งหมดอยู่ที่ `frontend/src/design/`
> เลขบรรทัดในเอกสารนี้อิงไฟล์ ณ วันที่เขียน (ไฟล์ `app.jsx`, `components.jsx` ฯลฯ มีการแก้ค้างในเครื่อง ยังไม่ commit — ถ้าเปิดแล้วบรรทัดเลื่อน ให้ดูจากชื่อฟังก์ชัน)

## ภาพรวมสถาปัตยกรรม frontend
- **ไม่ใช้ react-router** — หน้าปัจจุบันเก็บเป็น state ชื่อ `page` ใน `app.jsx` แล้วผูกกับ URL เองด้วย `history.pushState`
- **ทุก request ไป backend ผ่าน `apiFetch`** ใน `api.js` (แนบ cookie ให้เอง) — frontend **ไม่ถือ token** (อยู่ใน httpOnly cookie ที่ JS อ่านไม่ได้)
- **ตรรกะธุรกิจอยู่ backend** (เช่น คำนวณผ่าน/ไม่ผ่าน, สูตรปีจบ) — หน้าจอแค่แสดงผล
- **สองภาษา TH/EN**: ข้อความทุกอย่างอยู่ใน `i18n.js` เรียกด้วย `t(lang, 'key')`
- 4 role: `student`, `officer`, `executive`, `reviewer` — แต่ละ role เห็นเมนู/หน้าต่างกัน

---

## `index.html` (21 บรรทัด) และ `vite.config.js` (10 บรรทัด)
| ไฟล์ | อธิบาย |
|---|---|
| `index.html` | หน้า HTML เดียวของเว็บ (SPA): `<div id="root">` เป็นที่ให้ React วาด, `<script type="module" src="/src/main.jsx">` โหลดโค้ด; โหลดฟอนต์ LINE Seed Sans TH จาก CDN |
| `vite.config.js` | ตั้ง plugin React และ dev server ที่พอร์ต **5174** `strictPort: true` (ถ้าพอร์ตไม่ว่างให้ error ไม่ใช่เปลี่ยนพอร์ตเอง — เพราะ backend ตั้ง CORS ไว้ที่ 5174) |

## `src/main.jsx` (11 บรรทัด) และ `src/App.jsx` (8 บรรทัด)
| บรรทัด | อธิบาย |
|---|---|
| `main.jsx` 1-4 | import React, `createRoot`, CSS พื้นฐาน, `App` |
| `main.jsx` 6-10 | `createRoot(root).render(<StrictMode><App/></StrictMode>)` — เริ่มวาดแอปลงใน `#root`. `StrictMode` = โหมดตรวจโค้ดตอน dev (เรียก effect ซ้ำ 2 ครั้งเพื่อหาบั๊ก) |
| `App.jsx` 1-2 | import `design/styles.css` และ `App` ตัวจริงจาก `design/app.jsx` (ตั้งชื่อ `DesignApp`) |
| `App.jsx` 4-6 | คอมโพเนนต์ห่อ ส่งต่อให้ `DesignApp` — ใช้ชื่อ `design` เพราะมาจาก prototype ออกแบบของ UI |

---

## `src/design/api.js` (184 บรรทัด) — ตัวเดียวที่คุยกับ backend

| บรรทัด | อะไร | ทำงานยังไง |
|---|---|---|
| 10 | `API_BASE` | อ่านจาก `import.meta.env.VITE_API_BASE` (ไฟล์ `.env` ของ vite ต้องขึ้นต้น `VITE_`); `??` = ถ้า undefined ใช้ `http://localhost:3000/api` |
| 15 | `USER_KEY` | ชื่อ key ใน localStorage ที่เก็บ user (ไม่ใช่ความลับ ใช้วาด UI ตอน refresh) |
| 17-27 | `getStoredUser()` | อ่าน+`JSON.parse` ใน `try/catch`; พัง/ค่าเสีย → ลบทิ้งแล้วคืน `null` (ถือว่ายังไม่ login ดีกว่าหน้าขาว) |
| 30-33 | `setSession(user, mustChangePassword, profileIncomplete)` | เก็บ user พร้อมธง 2 ตัว (ต้องรู้ตอน refresh เพราะ backend ยัง block ทุก endpoint จนกว่าจะเปลี่ยนรหัส/กรอกโปรไฟล์) |
| 35-37 | `clearSession()` | ลบ user ฝั่ง browser (cookie ต้องให้ backend ลบ) |
| 40-48 | `logout()` | ยิง `POST /auth/logout` (`auth:false`) ให้ backend ลบ cookie; ล้มก็ยัง `clearSession()` ต่อ (กัน server ล่มแล้วออกจากระบบไม่ได้) |
| 53-73 | `fallbackMessage(status)` | ข้อความไทยทางการสำรองตามรหัส (0 = เน็ตหลุด, 401, 403, 404, 413, ≥500) ใช้เมื่อ backend ไม่ได้ส่ง message มา |
| 77-83 | `safeFetch(url, options)` | ห่อ `fetch`: ถ้าเชื่อมต่อไม่ได้เลย (TypeError "Failed to fetch") แปลงเป็น `ApiError(fallbackMessage(0), 0)` ไม่ให้ผู้ใช้เห็นอังกฤษ |
| 86-93 | `class ApiError extends Error` | เก็บ `message` (ไทยจาก backend), `status`, `payload` (JSON ทั้งก้อน — บาง error มีข้อมูลประกอบ เช่น import ตอบรายชื่อคอลัมน์) |
| 100-138 | `apiFetch(path, {method, body, auth})` | **ฟังก์ชันหลัก** — (102-103) ถ้า body ไม่ใช่ `FormData` ตั้ง `Content-Type: application/json`; (106-113) แปลง body: FormData ส่งดิบ, object → `JSON.stringify`; (115-122) `fetch(API_BASE+path)` ใส่ **`credentials: 'include'`** (ให้ browser แนบ cookie ข้าม origin 5174→3000; ลืมบรรทัดนี้ = ทุก request ได้ 401); (125) `res.json().catch(() => ({}))` ตอบไม่ใช่ JSON ก็ไม่พัง; (126-132) ถ้า `!res.ok` หรือ `success === false` → ถ้า **401 + `code === 'auth_required'`** เรียก `forceLogout()`; แล้ว `throw new ApiError(...)`; (136-137) **`'data' in json`** เช็คว่ามี key ชื่อ data ไหม (ไม่ใช่ truthy) — `data: null` เป็นคำตอบจริง (เช่น ไม่มีรอบเปิด) ต้องคืน null; ไม่มี key data (เช่น `/auth/login`) คืนทั้งก้อน |
| 143-146 | `forceLogout()` | `clearSession()` + `window.location.reload()` — `app.jsx` เห็นว่าไม่มี user แล้วตกไปหน้า login เอง |
| 150-154 | `fetchAuthedObjectUrl(path)` | โหลดไฟล์ที่ต้อง login (รูป/PDF) มาเป็น blob URL — `<img src>` ตรง ๆ ควบคุม credentials ไม่ได้; ผู้เรียกต้อง `URL.revokeObjectURL` เองไม่งั้น memory รั่ว |
| 162-184 | `downloadFile(path, {method, body, filename})` | ดาวน์โหลด Excel/PDF: `fetch` พร้อม cookie → `blob()` → `URL.createObjectURL` → สร้าง `<a download>` คลิกเอง → `setTimeout(revoke, 1000)` (Firefox/Safari ยังไม่เริ่มโหลดถ้าคืนทันที). `filename` ตั้งฝั่งนี้เพราะข้าม origin อ่าน `Content-Disposition` ไม่ได้ |

---

## `src/design/roundPhase.js` (46 บรรทัด)
สถานะรอบ ใช้ร่วมทุกหน้า — **backend คำนวณ `phase` มาให้แล้ว** นี่เป็นแค่ตัวช่วยแสดงผล
| บรรทัด | ทำอะไร |
|---|---|
| 199-208 | `phaseOf(round)` — ไม่มีรอบ → `closed`; ถ้ามี `round.phase` ใช้เลย; ไม่งั้นคำนวณสำรองจาก `status` + วันที่ด้วยกติกาเดียวกับ backend (`closed`/`scheduled`/`expired`/`active`) |
| 215-222 | `BADGE_CLASS` + `phaseBadgeClass(round)` — map phase → ชื่อ class สี (active เขียว `ok`, scheduled/closed `draft`, expired เหลือง `wait`) |
| 226 | `phaseLabel(round, tt)` — ป้ายภาษาตามภาษาปัจจุบัน `tt('roundPhase.active')` (`tt` = ฟังก์ชันแปลที่หน้าส่งเข้ามา) |
| 230 | `isAcceptingSubmissions(round)` — กรอกได้จริงไหม = `phase === 'active'` ตรงกับ `findActive()` ฝั่ง backend |

## `src/design/usePagedList.js` (28 บรรทัด) — custom hook แบ่งหน้า
`usePagedList(items, per = 20, resetKey = '')` คืน `{ page, setPage, pages, rows }` (ใช้คู่ `<Pagination>` ใน components.jsx)
| บรรทัด | ทำอะไร |
|---|---|
| 244-245 | state `page` (เริ่ม 0) และ `seenKey` (จำค่า resetKey ล่าสุด) |
| 247-250 | **ถ้า `resetKey` เปลี่ยน** (ค้นหา/กรอง/เปลี่ยนแท็บ) → รีเซ็ตกลับหน้า 1 **ตอน render** ไม่ใช่ใน `useEffect` (effect ทำงานหลังวาดจอ → ผู้ใช้เห็นหน้าว่างแวบหนึ่ง; setState ตอน render เป็นท่าที่ React แนะนำ React จะ render ซ้ำก่อนวาด) |
| 252 | `pages = max(1, ceil(items.length / per))` |
| 254 | `safePage = min(page, pages - 1)` กันหน้าค้างเกินช่วงเมื่อลบแถวสุดท้าย |
| 255 | `rows = items.slice(...)` |

## `src/design/yearExports.js` (51 บรรทัด)
ส่งออกรายชื่อ "ผ่าน/ไม่ผ่านภายในปีแรก" (3 หน้าใช้ร่วม)
| บรรทัด | ทำอะไร |
|---|---|
| 270-278 | `downloadFirstYearList(year, passed, format)` — เรียก `downloadFile('/dashboard/export-first-year?year=..&passed=..&format=..')` พร้อมตั้งชื่อไฟล์ไทย |
| 281-309 | `firstYearExportItem(tt, year, passed, format)` — คืน object 1 รายการของเมนู ExportMenu: เลือก `labelKey` ตามผ่าน/ไม่ผ่าน × xlsx/pdf (if-else ซ้อน), `icon` (`pdf`/`report`), `key` ไม่ซ้ำ, `run` = ฟังก์ชันดาวน์โหลด |

---

## `src/design/app.jsx` (540 บรรทัด) — **ตัวคุมทั้งแอป**

### import และค่าคงที่ (1-75)
| บรรทัด | ทำอะไร |
|---|---|
| 5-27 | import ทุกหน้า/ตัวช่วย (ชื่อ `*Real` = หน้าที่เชื่อม backend จริง) |
| 29-35 | `TWEAK_DEFAULTS` — ค่าตั้งต้นของแผง tweaks (สไตล์ฟอร์ม, dashboard, สีเน้น, ความหนาแน่น) |
| 38-43 | `navStudent(lang, rejectedCount)` — เมนูนักศึกษา (ข่าว/กรอกผล/สถานะ/ประวัติ); `badge: rejectedCount \|\| null` ขึ้นเลขเตือนถ้ามีใบถูกตีกลับ |
| 46-72 | `NAV(lang, pendingCount)` — เมนูของ officer (มี badge จำนวนใบรอตรวจ), executive (แค่ dashboard + รายงาน), reviewer (แค่คิวตรวจ); `{section:...}` = หัวข้อกลุ่มเมนู |
| 73 | `DEFAULT_PAGE` — หน้าแรกหลัง login ของแต่ละ role |
| 75 | `MAX_TOASTS = 3` |

### ระบบ URL ที่เขียนเอง (77-145)
| บรรทัด | ทำอะไร |
|---|---|
| 86-88 | path พิเศษ: `/login`, `/change-password`, `/complete-profile` |
| 91-107 | `PAGE_PATH` — ชื่อหน้า → URL (`dashboard: '/dashboard'` ...) |
| 108-110 | `PATH_PAGE` — กลับด้าน: `Object.entries(...).map(([page,path]) => [path,page])` → `Object.fromEntries` |
| 115-121 | `ROLE_PAGES` — role ไหนเข้าหน้าไหนได้ (เป็น UX เท่านั้น ตัวกันข้อมูลจริงคือ `requireRole` ที่ backend) |
| 125 | `NEEDS_SELECTION = ['detail']` — หน้าที่ต้องมีข้อมูลที่เลือก (`sel`) ซึ่งหายตอน refresh → พากลับหน้าเริ่มต้น |
| 128-135 | `pageFromPath(role, rawPath)` — ตัด `/` ท้าย; หาหน้า; ไม่รู้จัก/ไม่ใช่ของ role/ต้องมี selection → `DEFAULT_PAGE[role]` |
| 139-145 | `pushUrl` (เพิ่ม history; เช็ค path เดิมก่อนไม่กองซ้ำจนปุ่ม back กดไม่ออก) / `replaceUrl` (ทับรายการปัจจุบัน ใช้ตอน login/logout/refresh ไม่ให้ back ย้อนไปหน้าที่ออกมาแล้ว) |

### `App()` — state (147-187)
| ตัวแปร | เก็บอะไร |
|---|---|
| `t, setTweak` | ค่า tweaks (`useTweaks`) |
| `role`, `currentUser` | ผู้ใช้ที่ login (มาจาก backend จริง) |
| `mustChangePassword`, `profileIncomplete` | ธงบังคับเปลี่ยนรหัส / กรอกโปรไฟล์ |
| `page`, `bootPath`, `sel` | หน้าปัจจุบัน; URL ตอนเปิดเว็บ (จำไว้ก่อน เพราะ URL อาจถูกเขียนทับก่อน `/auth/me` ตอบ); นักศึกษาที่เลือกดู |
| `detailFrom`, `reviewRestore`, `studentsFilter`, `dashboardRestore` | "ฝากข้อมูล" ระหว่างหน้า เช่น ย้อนกลับมาหน้าเดิมแล้วคงแท็บ/ตัวกรองไว้ (อ่านครั้งเดียวแล้วเคลียร์) |
| `sbOpen`, `toast` | sidebar มือถือเปิดอยู่ไหม / ข้อความ toast |
| `lang`, `langBlurring`, `loggingOut` | ภาษา TH/EN + แอนิเมชันเบลอตอนสลับภาษา/ออกจากระบบ |
| `pendingCount`, `rejectedCount` | เลข badge ของเมนู |
| `notifications`, `unread`, `notifToasts` | กระดิ่งแจ้งเตือน |

### `changeLang` (175-182)
สลับภาษาแบบเบลอ: ตั้ง `langBlurring` → รอ 280ms → `setLang` → รอ 20ms → ปิดเบลอ

### Effect แจ้งเตือน (193-250)
- (194) ไม่มี role/user → ล้างแล้วจบ
- (200-204) **`Promise.all`** ยิง 3 เส้นพร้อมกัน (ข่าว, `/notifications/me` สำหรับนักศึกษา, `/dashboard/alerts` สำหรับ officer/executive); ทุกเส้น `.catch(() => [])` เส้นไหนล้มกระดิ่งไม่ว่างทั้งอัน
- (205) `dropped` = เปลี่ยนหน้า/ออกระบบระหว่างรอ ทิ้งผล (กัน setState หลัง unmount)
- (209-217) รวม `fromServer(rows)` + `buildNotifications(...)` เรียงใหม่สุดก่อน; alert สด (เรื่องที่ต้องลงมือทำ) ดันไว้บนสุด; ตัดรายการที่ผู้ใช้ปิด (`dismissedKeys`)
- (219-220) ตั้ง state + นับ unread
- (223-245) **popup (toast)**: เฉพาะที่ยังไม่อ่าน+ยังไม่เคยเด้ง; ถ้าเกิน `MAX_TOASTS` โชว์ (MAX−1) อัน + การ์ดสรุป "มีอีก N รายการ"; จำว่าเด้งแล้วทุกตัว (กัน poll รอบหน้าเด้งซ้ำ)
- (247-249) เรียกทันที + `setInterval(fetchNotifs, 30000)` poll ทุก 30 วินาที; **cleanup** `dropped = true; clearInterval` ตอน effect หมดอายุ
- dependency `[role, currentUser, page, lang]` → ดึงใหม่ทุกครั้งที่เปลี่ยนหน้า

### ตัวจัดการแจ้งเตือน (254-296)
- `openNotifications` — เปิดกระดิ่ง = อ่านหมด (localStorage สำหรับประกาศ + `PATCH /notifications/read-all` สำหรับนักศึกษา) + ล้าง toast
- `openNotifItem(targetPage, key)` — กดแจ้งเตือน: ลบออกจากลิสต์ + ลด unread + ไปหน้านั้น (เฉพาะหน้าที่ role เข้าได้ `ROLE_PAGES[role]?.includes`)
- `dismissNotification(key)` — ลากทิ้งอันเดียว (ไม่พาไปไหน)
- `clearAllNotifications` — ล้างทั้งหมด (ของนักศึกษาที่ใน DB ต้องสั่ง read-all ด้วย ไม่งั้นรีเฟรชแล้วกลับมาเป็นยังไม่อ่าน)

### Effect นับ badge (303-328)
- officer: `GET /exam-results?staff_status=pending` นับ `rows.length`; ฟัง event **`review-changed`** (หน้ารายละเอียดยิงหลังยืนยัน/ตีกลับ) เพื่อนับใหม่โดยไม่เปลี่ยนหน้า; cleanup `removeEventListener`
- student: `GET /exam-results/me` — นับเฉพาะ **ใบล่าสุดของแต่ละรอบ** (`Set seenRounds` กรองซ้ำ; rows เรียงใหม่ก่อน) ที่ `staff_status === 'rejected'`

### Effect อื่น (331-388)
- (331-332) ตั้งตัวแปร CSS `--gold-500` / `--gold-600` ตาม accent
- (337-374) **ตรวจ session ตอนเปิดเว็บ:** ไม่มี user ที่เก็บไว้ → ไป `/login`; ต้องเปลี่ยนรหัส/กรอกโปรไฟล์ → ไปหน้าบังคับ; ไม่งั้น `GET /auth/me` ถาม backend ว่า cookie ยังใช้ได้ไหม — ถ้าข้อมูลที่เก็บไม่ตรง backend (`stale`: id/role/ธงต่าง) เขียนทับด้วยค่า server แล้ว `reload`; ตรงกัน → ตั้ง user/role และกลับหน้าตาม URL (`pageFromPath`) — localStorage เป็นแค่ตัวช่วยวาดหน้า ความจริงอยู่ที่ backend
- (378-388) ฟัง `popstate` (ปุ่ม back/forward): แปลง URL เป็นหน้า + แก้ URL ให้ตรงหน้าที่แสดงจริง

### Handler login/โปรไฟล์ (390-425)
- `handleLogin(user, mustChange, profileIncompleteFlag)` — ต้องเปลี่ยนรหัส/กรอกโปรไฟล์ → หน้านั้น; ไม่งั้นตั้ง user/role/หน้าแรก + `replaceUrl` (ไม่ให้ back กลับ login)
- `handlePasswordChanged` — token เดิมมีธง mustChange ฝังอยู่ ใช้ต่อไม่ได้ → เคลียร์แล้วกลับ login
- `handleProfileCompleted` — `GET /auth/me` แล้วเข้าแอปต่อ (cookie เดิมยังใช้ได้)

### การเลือกหน้าจอ (427-486)
- (427-429) **Early return เรียงลำดับ:** `mustChangePassword` → `<ForceChangePassword>`; `profileIncomplete` → `<CompleteProfile>`; ไม่มี role → `<Login>`
- (431) เลือก nav ตาม role
- (432-436) `go(p, step)` — เปลี่ยนหน้า: ออกจากกลุ่ม review/detail ทิ้งตำแหน่งคิวที่จำไว้, `setPage`, `pushUrl`, `scrollTo(0,0)`
- (440-448) `switchRole('logout')` — เบลอ → `logout()` → ล้าง state → `/login`
- (450-486) `render()` — if ต่อ role ต่อ page คืนคอมโพเนนต์ที่ตรง; ส่ง props `go`, `lang`, `toast` ฯลฯ. ผู้บริหารส่ง `readonly` ให้ `DashboardReal`; reviewer ใช้ component เดียวกับ officer แต่ `canEdit={false}`; ไม่ตรงอะไร → `<Empty>`

### JSX ผลลัพธ์ (488-510)
`TopBar` (กระดิ่ง/ภาษา/เมนูผู้ใช้) + `Sidebar` + `<main>` ที่ใส่ `key={page}` ให้ React สร้างใหม่ทุกครั้งที่เปลี่ยนหน้า (ได้แอนิเมชัน `page-enter`) + `Toast` + `NotifToastStack`. ครอบด้วย `data-density` และ class `lang-fade-blur`/`logout-blur` สำหรับเอฟเฟกต์

### ท้ายไฟล์ (512-540)
- `TweaksUI` — แผงปรับแต่งสำหรับ dev/ออกแบบ (ไม่ได้ render ใน flow ใช้งานจริง)
- `shade(hex, pct)` — ทำสีเข้ม/อ่อนลง: แยก hex เป็น r,g,b ด้วย bit shift (`>> 16`, `>> 8`, `& 255`) ปรับตามเปอร์เซ็นต์ หนีบ 0-255 (`Math.max(0, Math.min(255, x))`) แปลงกลับเป็น hex ด้วย `toString(16).padStart(2,'0')`
