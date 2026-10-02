# 04 — Frontend: ตรรกะและวิธีคิดทั้งหมด

ไฟล์นี้ตอบคำถามว่า "หน้าเว็บนี้ทำงานยังไง" ตั้งแต่เปิดเว็บจนถึงกดปุ่มหนึ่งปุ่ม. อ่านคู่กับ `frontend/FRONTEND_GUIDE.md`
(โค้ดจริงเกือบทั้งหมดอยู่ที่ `frontend/src/design/`)

---

## 1. ห่วงโซ่เริ่มต้น

```
index.html → main.jsx (createRoot + StrictMode) → App.jsx (บาง ๆ) → design/app.jsx → export function App()
```
`design/app.jsx` คือ "ตัวจริง": เก็บ state ของผู้ใช้, เลือกว่าจะโชว์หน้าไหน, วาด layout (TopBar + Sidebar + เนื้อหา), จัดการแจ้งเตือน

**ตั้งใจไม่ใช้ react-router** — หน้าปัจจุบันเก็บเป็น state `page` (สตริงเช่น `'dashboard'`) แล้ว map เป็น URL เองด้วย History API
เหตุผลที่ตอบได้: แอปมีไม่กี่หน้า ต้องการคุมสิทธิ์ต่อ role ในที่เดียว และไม่อยากเพิ่ม dependency

---

## 2. `app.jsx` ทำอะไรบ้าง (ไล่ตามโค้ด)

### 2.1 state สำคัญ
| state | ความหมาย |
|---|---|
| `role`, `currentUser` | ผู้ใช้ที่ login (มาจากตอบของ backend ไม่ใช่ mock) |
| `page` | ชื่อหน้าปัจจุบัน |
| `mustChangePassword`, `profileIncomplete` | ธงที่บล็อกทั้งแอปจนกว่าจะเปลี่ยนรหัส/กรอกโปรไฟล์ → โชว์หน้า `ForceChangePassword` / `CompleteProfile` แทน |
| `sel` | นักศึกษาที่กดเข้าไปดูรายละเอียด (หายเมื่อรีเฟรช จึงอยู่ใน `NEEDS_SELECTION` = รีเฟรชแล้วกลับหน้าเริ่มต้น) |
| `notifications`, `unread` | กระดิ่ง |
| `lang` | `'TH'`/`'EN'` |
| state "restore" (`reviewRestore`, `studentsFilter`, `dashboardRestore`) | จำตำแหน่งที่ผู้ใช้อยู่ตอนกดเข้าหน้ารายละเอียด เพื่อ "กลับ" แล้วอยู่ที่เดิม (อ่านครั้งเดียวแล้วเคลียร์) |

### 2.2 Routing ด้วย History API
```js
const PAGE_PATH = { news:'/news', formIntro:'/exam', form:'/exam/form', status:'/status', ... dashboard:'/dashboard', ... };
const PATH_PAGE = Object.fromEntries(Object.entries(PAGE_PATH).map(([page, path]) => [path, page]));  // กลับด้าน
```
- `go(page)` = `setPage(page)` + `history.pushState(...)` (เปลี่ยน URL โดยไม่โหลดหน้าใหม่)
- `pageFromPath(role, path)` = URL → ชื่อหน้า; **ถ้าไม่รู้จัก / role นี้เข้าไม่ได้ / ต้องมี selection → กลับหน้าเริ่มต้นของ role**
- รีเฟรชหน้า: อ่าน `window.location.pathname` ไว้ก่อน (`bootPath`) แล้วรอ `/auth/me` ตอบ (เพราะยังไม่รู้ role) ค่อยตั้งหน้า
- ปุ่ม back/forward: ฟัง event `popstate`

### 2.3 ตารางสิทธิ์หน้าต่อ role (UX ไม่ใช่ความปลอดภัย)
```js
const ROLE_PAGES = {
  student:   ['news','formIntro','form','status','history'],
  officer:   ['dashboard','review','students','import','detail','rounds','usermgmt','newsmgmt','reports','manual'],
  executive: ['dashboard','reports'],
  reviewer:  ['review','detail'],
};
```
(ตรวจโค้ด 1 ต.ค.: ผู้บริหารมีแค่ `dashboard` กับ `reports` — ไม่มีหน้าคู่มือ · วิธีเพิ่มเมนูให้บทบาทดู `08` ข้อ G4)
พิมพ์ URL ของ role อื่น → เด้งกลับหน้าเริ่มต้น. **ข้อสำคัญ (กรรมการถามบ่อย):** นี่แค่ทำให้หน้าจอไม่สับสน ตัวที่กันข้อมูลจริงคือ `requireRole` ที่ backend — ผู้ใช้ปลอม frontend ได้ แต่ยิง API แล้วโดน 403

### 2.4 การ login ทั้งเส้น (ไล่ให้ได้)
1. `login.jsx` ส่ง `POST /auth/login` → backend ตั้ง httpOnly cookie
2. frontend เก็บ `{id,name,role,mustChangePassword,profileIncomplete}` ใน localStorage ด้วย `setSession` (ไม่ใช่ความลับ ไว้วาด UI ตอนรีเฟรช)
3. `app.jsx` ตัดสินใจ: ถ้า `mustChangePassword` → หน้าเปลี่ยนรหัส · ถ้า `profileIncomplete` → หน้าตั้งโปรไฟล์ · ไม่งั้น → หน้าเริ่มต้นตาม role (`DEFAULT_PAGE`)
4. ตอนรีเฟรช: ยิง `/auth/me` ยืนยัน cookie ยังใช้ได้; ถ้าไม่ได้ → ล้าง session แล้วกลับหน้า login
5. logout: `POST /auth/logout` (ให้ backend ลบ cookie เพราะ JS ลบ httpOnly cookie ไม่ได้) แล้วล้าง localStorage
**สังเกต:** ถ้า login ผ่าน API อย่างเดียวโดยไม่ผ่านหน้า login → จอจะไม่รู้ว่าล็อกอิน (ตัดสินจาก localStorage) — ไม่ใช่บั๊ก เป็นดีไซน์

---

## 3. `api.js` — ประตูเดียวที่คุยกับ backend

```js
export async function apiFetch(path, { method='GET', body, auth=true } = {}) {
  ... fetch(`${API_BASE}${path}`, { method, headers, body, credentials: 'include' })
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    if (res.status === 401 && json.code === 'auth_required') forceLogout();   // cookie หมดอายุ → กลับ login
    throw new ApiError(json.message || ..., res.status, json);
  }
  if (!('data' in json)) return json;
  return json.data;          // หน้าอื่นได้ข้อมูลตรง ๆ ไม่ต้องแกะ { success, data }
}
```
ประเด็นที่อธิบายได้:
- `credentials: 'include'` จำเป็น เพราะ frontend (:5174) กับ backend (:3000) คนละ origin — ไม่ใส่ cookie จะไม่ถูกส่ง ทุก request 401
- `API_BASE` อ่านจาก `VITE_API_BASE` (ตัวแปร build ของ Vite ต้องขึ้นต้น `VITE_`) — ย้ายเครื่อง/ขึ้นเซิร์ฟเวอร์จริงแก้แค่ `.env`
- เช็ค `'data' in json` ไม่ใช่ `json.data` เฉย ๆ เพราะ `data: null` คือคำตอบที่ตั้งใจ (เช่น ไม่มีรอบเปิด) ต้องคืน `null` ไม่ใช่ทั้งก้อน
- **`forceLogout` เฉพาะ `code:'auth_required'`** ไม่ใช่ 401 ทุกกรณี — ไม่งั้นกรอกรหัสผิดครั้งเดียวหน้าจะรีโหลดทิ้งข้อความ error
- `ApiError` ให้หน้าเรียก `catch (e)` แล้วอ่าน `e.message` (ข้อความไทยจาก backend) โชว์ผู้ใช้ตรง ๆ
- `downloadFile(path, {method, body, filename})` — ทุกปุ่ม "ส่งออก" ใช้ตัวนี้ตัวเดียว: fetch พร้อม cookie → blob → สร้างลิงก์ชั่วคราวกดเซฟ. ใช้ `<a href>` ตรง ๆ ไม่ได้ เพราะไฟล์ต้องแนบ cookie login
- `fetchAuthedObjectUrl` ใช้แสดงรูปที่ต้อง login (`<img src>` คุม credentials ไม่ได้) — ต้อง `revokeObjectURL` ตอนเลิกใช้ กัน memory รั่ว

---

## 4. รูปแบบหน้าจอมาตรฐาน (เจอซ้ำทุกไฟล์ `*Real.jsx`)

```jsx
export function OfficerStudentsReal(...) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');              // ตัวกรอง (คำค้น)
  useEffect(() => {                            // 1) ตอนเปิดหน้า: ดึงข้อมูล
    Promise.all([apiFetch('/students'), apiFetch('/exam-results')])
      .then(([list, results]) => setStudents(join(list, results)))   // 2) เก็บลง state
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const filtered = students.filter(s => match(s, q));                 // 3) กรองฝั่งหน้าจอ
  if (loading) return <SkeletonTable/>;                               // 4) โชว์โครงรอ
  return (<table>{pageRows.map(s => <tr key={s.sid}>…</tr>)}</table>);// 5) วาด
}
```
**ข้อสังเกต (ตอบกรรมการได้):**
- `Promise.all` ยิง 2 endpoint พร้อมกันแล้ว join ฝั่ง client (ใบผลสอบล่าสุดของแต่ละคน) — เร็วกว่ารอทีละเส้น
- ตัวกรอง/ค้นหา/แบ่งหน้าของหน้านักศึกษาทำฝั่งหน้าจอ เพราะข้อมูลหลักร้อยถึงพันคน (เครื่องรับไหว) และโต้ตอบไว; ตัวกรองที่มีผลต่อ "ความถูกต้องของตัวเลข" อย่างสถิติทำที่ backend (หลักการ: **logic สำคัญอยู่ backend**)
- มี 3 สถานะที่ต้องเขียนทุกหน้า: กำลังโหลด / error / ว่างเปล่า — ใช้ `Skeleton*`, ข้อความ error, `Empty`

### 4.1 หน้ากรอกผลสอบหลายไฟล์ (`examFormReal.jsx` + `evidenceFiles.js`) — **เขียนใหม่ 1 ต.ค.**
**ค่ากลาง** อยู่ที่ `evidenceFiles.js` ที่เดียว: `MAX_EVIDENCE_FILES = 5`, `MAX_FILE_SIZE_MB = 10`, `EVIDENCE_ACCEPT` (มี `image/*` → บนมือถือเลือก "ถ่ายรูป" ได้) และฟังก์ชันแปลงคำ (`certificateTypeLabel`, `fileKindOf`, `fileKindLabel`) — **ห้ามโชว์คำอังกฤษจาก DB** (`exam_result`, `pdf`) บนจอ ต้องแปลงเป็นไทยเสมอ (ใช้ร่วมกับ `studentDetailReal.jsx`)

**ตัดสินใจว่าจะเปิดฟอร์มไหม (`prepareForm`)**
```
ไม่มีรอบ → "ขณะนี้ไม่มีรอบ…"
phase ไม่ใช่ active และ can_fix_rejected ไม่ใช่ true → บอกเหตุผลตาม phase (รอเปิด/เลยกำหนด/ปิด)
all_passed → "ผ่านครบแล้ว"
ใบของรอบนี้ยืนยันแล้ว → "ยืนยันแล้ว แก้ไม่ได้"
รอบไม่ active แต่ใบไม่ใช่ rejected → บอกเหตุผล (กันกรณีข้อมูลไม่ตรงกัน)
มีใบเดิม → เติมคำตอบเดิมกลับเข้าฟอร์ม (ยกเว้นแถว carried_forward) + โหลดไฟล์เดิม
```
`fixingAfterClose = round.phase !== 'active'` → แสดงกล่อง "รอบนี้ปิดรับแล้ว แต่ใบที่ถูกตีกลับยังแก้ไขและส่งใหม่ได้ กรุณาส่งโดยเร็ว"

**ไฟล์แบ่ง 3 กลุ่มใน state:** `keptFiles` (ไฟล์เดิมที่ยังเก็บ) · `removedFiles` (ไฟล์เดิมที่กด "นำออก" — ยังไม่ลบจริง กดยกเลิกได้) · `newFiles` (เพิ่งเลือก ยังไม่อัปโหลด)
- `addFiles` ตรวจทีละไฟล์: ชนิด (`fileKindOf` ดูชนิด แล้วสำรองด้วยนามสกุล) → ขนาด → จำนวนรวม — ไฟล์ที่ไม่ผ่านขึ้นเหตุผล **รายไฟล์** เป็นภาษาไทย (`fileErrors`)
- ปุ่มส่งปิดเมื่อ: ยังตอบไม่ครบ / ไม่มีไฟล์เลย / เกินจำนวน / กำลังส่ง

**ลำดับการส่ง (`submit`) — กรรมการอาจถาม "ทำไมสองแบบไม่เหมือนกัน"**
| ใบใหม่ | ใบเดิม (รอตรวจ/ถูกตีกลับ) |
|---|---|
| 1) `POST /exam-results` ได้ `result_id` | 1) `DELETE /certificates/:id` ทีละไฟล์ที่กดนำออก (`deleteRemovedFiles`) |
| 2) อัปโหลดทีละไฟล์ (`uploadNewFiles`) | 2) อัปโหลดไฟล์ใหม่ทีละไฟล์ |
| | 3) `POST /exam-results` (ทับใบเดิม) |
เหตุผล: ส่งผลใบเดิม = ใบกลับเป็น "รอตรวจ" · ถ้ารอบปิดแล้ว backend ให้เปลี่ยนไฟล์ได้เฉพาะใบที่ **ยังถูกตีกลับ** → ต้องจัดการไฟล์ก่อน
ล้มกลางทาง: เก็บเฉพาะไฟล์ที่ยังไม่สำเร็จไว้ในรายการ + ดึงไฟล์จาก backend ใหม่ (`reloadPaperFiles`) → กดส่งอีกครั้งไม่อัปโหลดซ้ำ และไม่สร้างใบซ้ำ (ครั้งถัดไปเป็นการแก้ใบเดิม)

**ส่งออกปีแรก (`yearExports.js`):** `firstYearExportItem(tt, year, passed, format)` สร้าง 1 รายการให้ `ExportMenu` → เรียก `downloadFile('/dashboard/export-first-year?…')` · ใช้ร่วม 3 หน้า (ข้อมูลนักศึกษา, รายงานสรุป, แดชบอร์ด) หน้าจอไม่คำนวณรายชื่อเอง

### 4.2 `usePagedList(items, per, resetKey)` — hook แบ่งหน้า
> ความจริงในโค้ด: hook นี้ใช้ในหน้าจัดการผู้ใช้งาน (`manageUsersReal.jsx`, 15 แถว/หน้า) ส่วนหน้าข้อมูลนักศึกษา (`officerStudentsReal.jsx`, `per = 10`) และคิวตรวจ (`officerReviewReal.jsx`, `PER_PAGE = 10`) แบ่งหน้าเอง และรีเซ็ตหน้าด้วย `useEffect(() => setPage(0), [...])` / ตอนเปลี่ยนแท็บ — อธิบายความต่างได้ใน `09` หัวข้อ 11

รับ list ทั้งก้อน คืน `{ rows, page, pages, setPage }` และ **รีเซ็ตกลับหน้า 1 เมื่อ `resetKey` เปลี่ยน** (เช่น เปลี่ยนตัวกรอง)
- ทำ "รีเซ็ตตอน render" (เทียบค่าเก่า/ใหม่แล้ว `setState`) ไม่ใช่ใน `useEffect` — เพราะ effect ทำงาน **หลัง** วาดจอ ผู้ใช้จะเห็นหน้าว่างแวบหนึ่งก่อนเด้งกลับหน้า 1
- `safePage = Math.min(page, pages-1)` กันหน้าค้างเกินช่วงหลังลบแถว
ตัวนับ "แสดง N จาก M" = `Math.min((page+1)*per, total)` (หน้า 1 = 10, หน้า 2 = 20, …)

---

## 5. i18n (สองภาษา TH/EN) — `i18n.js`
```js
const DICT = { TH: { 'status.CONFIRMED': 'ยืนยันแล้ว', ... }, EN: { ... } };
t(lang, 'officer.students.sub', { shown: 10, found: 928 })   // แทน {shown} {found} ในข้อความ
```
- ทุกข้อความบนจอควรผ่าน `t(...)` ไม่ฝังในโค้ด (เพิ่ม/แก้คำที่เดียว) — บางข้อความเก่ายังฝังอยู่ (รู้ข้อจำกัดนี้ไว้)
- สลับภาษา: แอนิเมชันเบลอสั้น ๆ แล้ว `setLang` (ไม่โหลดหน้าใหม่)
- ข้อความฝั่ง backend (ข้อความ error) เป็นภาษาไทยอย่างเดียว

---

## 6. แจ้งเตือน (`notifications.js` + กระดิ่งใน `app.jsx`)
รวม 3 แหล่งเป็นรูปเดียว `{ key, tone, icon, page, title, sub, at, is_read?, live? }`:
1. ตารางแจ้งเตือนของนักศึกษา (`/notifications/me`) — เหตุการณ์ที่เกิดแล้ว
2. alert สดของเจ้าหน้าที่/ผู้บริหาร (`/dashboard/alerts`) — คำนวณตอนนั้น ไม่เก็บ DB
3. ประกาศ (`/news`) — ตัดประกาศที่ตัวเองโพสต์ออก
- **`key` ต้องเสถียร:** ผลสอบใช้ `exam:<result_id>:<สถานะ>` — ตีกลับ→แก้→ยืนยัน จึงเป็นแจ้งเตือน "ใหม่" ไม่ใช่ของเก่าที่อ่านแล้ว
- จัดการ "อ่านแล้ว/ปัดทิ้ง" ใน localStorage ผูกกับ userId (`notif_read_*`, `notif_dismissed_*`); popup ที่เด้งแล้วจำใน sessionStorage (ปิดแท็บแล้วล้าง)
- poll ทุก 30 วินาที + ดึงใหม่ทุกครั้งที่เปลี่ยนหน้า; ตัวแปร `dropped` กันเอาผลของ request เก่ามาเซ็ตหลังเปลี่ยนหน้า (race ฝั่ง UI)
- เด้ง popup ได้ไม่เกิน `MAX_TOASTS` อัน เกินรวมเป็นการ์ด "มีอีก N รายการ" (เคยเด้ง 7 อันบังครึ่งจอ)
- กดที่แจ้งเตือน → `openNotifItem`: ซ่อนอันนั้นแล้วไปหน้าเป้าหมาย — **หน้าเป้าหมายต้องอยู่ใน `ROLE_PAGES[role]`** ไม่งั้นไม่พาไป (เคยพาเจ้าหน้าที่ไปหน้า `news` ของนักศึกษา เจอ "ไม่พบหน้า")
- **ปัดแถวแจ้งเตือนทิ้ง** (`NotifRow` ใน `components.jsx`): ใช้ Pointer Events (`onPointerDown/Move/Up`) + `setPointerCapture` ให้เมาส์และนิ้วใช้โค้ดเดียวกัน, ระยะเกิน 90px = ลบ, `touch-action: pan-y` ให้เลื่อนแนวตั้งยังได้, `moved` ref แยก "ลาก" ออกจาก "คลิก", แถวสีแดงอยู่หลังแถว (transform `translate3d`), ลบแล้วเลื่อนออก → หดความสูง (`max-height`) → ค่อยลบจากลิสต์

---

## 7. Component กลาง (`components.jsx`) ที่ควรรู้
| Component | ทำอะไร / จุดที่น่าพูด |
|---|---|
| `TopBar`, `Sidebar` | โครง layout; กระดิ่ง + เมนูผู้ใช้ |
| `Modal` | วาดผ่าน `createPortal` ลง `document.body` (ไม่โดน CSS ของแม่บัง), คลิกพื้นหลังปิด |
| `Select` | dropdown ค้นหาได้แทน `<select>` ของเบราว์เซอร์ (ใช้ทุกที่) |
| `ExportMenu` | ปุ่มส่งออก: ถ้ามี 1 รายการ = กดโหลดเลย, หลายรายการ = เปิดเมนู; จัดการ busy/error เอง (ปิดเมื่อคลิกนอก/Esc) |
| `Pagination` | พิมพ์เลขหน้ากระโดดได้ |
| `Loading`, `Skeleton*` | สถานะรอ: วงกลมหมุน / โครงเทา |
| `StatusBadge`, `PassBadge` | ป้ายสถานะ (สี/ข้อความมาจากตารางเดียว) |
| `FirstAttemptSubjectTable` | ตารางผลรายวิชารอบแรก (ใช้ทั้ง Dashboard และรายงาน) |

**หลักการออกแบบ:** ของที่ใช้ซ้ำ ≥ 2 หน้าทำเป็น component กลาง → แก้ที่เดียวเปลี่ยนทั้งระบบ (เช่น ExportMenu ตัวเดียวทุกปุ่มส่งออก)

---

## 8. รายงาน: พิมพ์ กับ บันทึก PDF (`reportsReal.jsx`, `exportReportPdf.js`, `styles.css`)

| ปุ่ม | ทำอะไร | หลักการ |
|---|---|---|
| **พิมพ์** | `window.print()` | CSS `@media print` ซ่อน sidebar/header/ปุ่ม (`.no-print`), ทำกล่องรายงาน (`.report-sheet`) เต็มกระดาษ, ไม่ตัดตาราง/แถวกลางหน้า (`break-inside: avoid`) |
| **ดาวน์โหลด PDF** | `saveElementAsPdf(กล่องรายงาน, ชื่อไฟล์)` | ถ่ายภาพกล่องรายงาน (html2canvas) → หั่นเป็นหน้า A4 ที่รอยต่อระหว่างส่วน → ใส่ jsPDF → บันทึก |

ข้อควรรู้ที่เคยเป็นบั๊ก (เล่าได้ว่า "ทดสอบแล้วเจอ แก้แล้ว"):
- `letter-spacing`/`uppercase` ของหัวตาราง ทำให้สระ-วรรณยุกต์ไทยซ้อนกัน → ปิดใน print CSS และในสำเนาที่ถ่าย
- แอนิเมชัน "แถวไล่โผล่" ยังเล่นอยู่ตอนถ่ายภาพ → แถวตารางจาง/หาย → ปิด `animation/transition` ในสำเนาที่ถ่าย
- ข้อความช่วยเหลือบนจอ (คลิกตัวเลข…) ไม่ควรติดลง PDF → class `no-print` ซ่อนทั้งตอนพิมพ์และตอนบันทึก
- ไลบรารี html2canvas/jspdf ใหญ่ → `import()` ตอนกดปุ่มเท่านั้น ไม่ถ่วงการเปิดแอป (dynamic import / code splitting)

**ทำไมมี PDF 2 แบบ (client กับ server `dashboard.pdf.js`):** client = ได้หน้าตาเหมือนบนจอ ใช้งานทั่วไป; server = สร้างด้วย pdfkit จากข้อมูลดิบ ไม่ขึ้นกับเบราว์เซอร์ (ตอนนี้ปุ่มบนหน้าใช้แบบ client; endpoint ฝั่ง server ยังอยู่ใช้ได้)

---

## 9. สไตล์และแอนิเมชัน (`styles.css`)
- ตัวแปรสี/ขนาดกลางใน `:root` (`--navy-*`, `--ink-*`, `--pass`, `--fail`, `--sh-*`) → เปลี่ยนธีมที่เดียว
- คลาสสำเร็จรูป: `.btn .btn-primary .btn-ghost`, `.card`, `.tbl`, `.badge`, `.field`, `.chip`
- แอนิเมชันที่เพิ่ม: เปลี่ยนหน้า `page-enter`, modal เด้ง `modal-card`, แถวตาราง `rowIn`, ตัวโหลด `loading-spinner`, `scroll-behavior: smooth` — **ทุกตัวปิดเองเมื่อเครื่องตั้ง `prefers-reduced-motion`** (accessibility)
- รองรับจอเล็ก (มือถือ): breakpoint ที่ `.app-sidebar` เปลี่ยนเป็นเมนูเลื่อนออก

---

## 10. ข้อจำกัดของ frontend ที่รู้ (ตอบตรง ๆ ได้)
- lint ยังมีข้อเตือนจำนวนมาก (กฎ `react-refresh` และ `react-hooks` ของโค้ดเดิม) ยังไม่ได้เคลียร์ — ไม่กระทบการทำงาน
- ข้อความบางส่วนยังฝังในโค้ด ไม่ผ่าน i18n
- รายชื่อนักศึกษากรองฝั่งหน้าจอ (ดึงทั้งก้อน) — พอสำหรับหลักพัน; ถ้าเป็นหมื่นคนต้องย้ายไปแบ่งหน้าที่ backend
- การ "ติ๊กเลือกทั้งหมด" ในหน้านักศึกษาเลือกทุกคนที่ผ่านตัวกรองข้ามทุกหน้า (พร้อมปุ่มลบ/ถอนสิทธิ์ข้าง ๆ) — มีข้อเสนอให้เปลี่ยนเป็นเลือกเฉพาะหน้าก่อน (ยังไม่ได้ทำ)
- ไม่มี unit test ราย component ฝั่ง frontend — แต่มี **เทสผ่านเบราว์เซอร์จริงอัตโนมัติ** `npm run test:e2e` (19 หัวข้อ 166 ข้อตรวจ: ทุกบทบาท, จอมือถือ 390px, สลับภาษา, หาคำต้องห้ามบนจอ เช่น `undefined`, `NaN`, ชื่อ field) · ความถูกต้องของกฎธุรกิจคุมด้วยเทส backend
- ตัวเลข 8 (ความยาวรหัสผ่านขั้นต่ำ) ยังฝังหลายที่ในหน้าเว็บ (`forceChangePassword.jsx`, `manageUsersReal.jsx`) ไม่ได้รวมเป็นค่ากลางแบบ `evidenceFiles.js`

---

## 11. เช็คตัวเอง
1. ไล่ได้ไหมว่า refresh หน้า `/students` ตอนเป็น officer เกิดอะไรบ้าง (bootPath → /auth/me → pageFromPath → ROLE_PAGES)
2. ทำไม `forceLogout` ต้องเช็ค `code === 'auth_required'`
3. ทำไมซ่อนปุ่มฝั่ง frontend แล้วยังต้อง `requireRole` ที่ backend
4. ทำไมรีเซ็ตหน้าใน `usePagedList` ตอน render ไม่ใช้ `useEffect`
5. อธิบายได้ไหมว่าปุ่ม "ดาวน์โหลด PDF" ทำงานยังไงและเคยมีบั๊กอะไร
6. ทำไมใบเดิมต้อง "ลบไฟล์ → อัปโหลด → ส่งผล" แต่ใบใหม่ "ส่งผล → อัปโหลด"
7. หน้ากรอกรู้ได้ยังไงว่ารอบปิดแล้วแต่ยังแก้ได้ (`can_fix_rejected`) และทำไมหน้าเว็บไม่คำนวณเอง
