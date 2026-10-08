# Frontend 04 — ไฟล์ตัวช่วย: แจ้งเตือน, ไฟล์หลักฐาน, แบบฟอร์ม import, PDF จากหน้าจอ

ไฟล์ (`frontend/src/design/`): `notifications.js` (197), `evidenceFiles.js` (108), `importTemplate.js` (67), `exportReportPdf.js` (88)
(ตัวช่วยอื่น `api.js`, `roundPhase.js`, `usePagedList.js`, `yearExports.js` อยู่ [frontend 01](01-entry-api-app-helpers.md))

---

## 1. `notifications.js` — ระบบแจ้งเตือน (กระดิ่ง)

**แหล่งข้อมูล 2 แหล่ง รวมเป็นลิสต์เดียวรูปทรงเดียวกัน** `{ key, tone, icon, page, title, sub, at }`:
1. ตาราง `notifications` ใน DB (นักศึกษาเท่านั้น) — ผลถูกยืนยัน/ตีกลับ/เปิดสิทธิ์/รอบเปิด; อ่านแล้วเก็บที่ **server** (`is_read`)
2. ประกาศ `/news` (ทุก role) — อ่านแล้วเก็บที่ **localStorage** ของเครื่อง
+ (3) alert สดของเจ้าหน้าที่ จาก `/dashboard/alerts` ผ่าน `fromAlerts`

| บรรทัด | ฟังก์ชัน/ค่า | อธิบาย |
|---|---|---|
| 17-20 | `READ_PREFIX`, `TOAST_PREFIX`, `DISMISS_PREFIX`, `NEWS_LIMIT=5` | คำนำหน้า key ของ storage (ต่อ userId ต่อท้าย → แต่ละคนแยกกัน) |
| 24-25 | `examKey`, `newsKey` | key แจ้งเตือน; `exam:id:สถานะ` ใส่สถานะใน key ให้ ตีกลับ→แก้→ยืนยัน เป็นแจ้งเตือน **ใหม่** ไม่ใช่ของเก่าที่เคยกดอ่าน |
| 27-33 | `readKeys(userId)` | อ่านรายการ key ที่อ่านแล้วจาก localStorage; `try/catch` พัง → `[]` |
| 35-39 | `markAllRead(userId, keys)` | รวม key เก่า+ใหม่ด้วย `[...new Set([...a, ...b])]` (ตัดซ้ำ) เก็บ 200 อันล่าสุด `slice(-200)` กัน storage โตไม่จำกัด |
| 48-59 | `dismissedKeys`, `dismissAll` | "ล้างทั้งหมด" = ซ่อนถาวร (ต่างจากแค่ "อ่านแล้ว"); เก็บ 300 |
| 63-74 | `toastedKeys`, `markToasted` | key ที่เด้ง popup แล้ว เก็บ **sessionStorage** (หายเมื่อปิดแท็บ) — popup เด้งครั้งเดียวพอ แม้ยังไม่ได้กดดู |
| 78-87 | `SERVER_TYPES` | ชนิดแจ้งเตือนจาก backend → `{tone, icon, page ที่กดแล้วไป}`: approved→status, rejected→form, eligible→form, revoked→status, round_open→form; `FALLBACK_TYPE` กรณีไม่รู้จัก |
| 90-105 | `fromServer(rows)` | แปลง `rows` จาก `/notifications/me`: `n.message.split("\n")` → `[mainLine, ...subLines]` (บรรทัดแรก = หัวข้อ ที่เหลือ = คำอธิบายตัวเล็ก); `key: 'notif:id'`; `is_read` มาจาก server |
| 116-121 | `ALERT_PAGES` | alert แต่ละชนิดพาไปหน้าไหน (ผู้บริหารพาไป dashboard หมด) |
| 123-135 | `fromAlerts(alerts, role)` | **key มีตัวเลขต่อท้าย** `alert:${a.key}:${a.count ?? a.detail ?? ''}` เพราะเป็น "สถานะ ณ ตอนนี้" ถ้า key คงที่ กด "ล้างทั้งหมด" ตอนค้าง 13 ใบ แล้ววันหลังค้าง 50 ใบจะยังถูกซ่อนด้วย key เดิม; พอตัวเลขเปลี่ยน key เปลี่ยน แจ้งเตือนโผล่กลับเอง; `at:null` (ไม่มีวันที่); `live:true` ดันขึ้นบนสุด |
| 141-184 | `buildNotifications({role, examResults, news, lang, userId})` | สร้างจากข่าว (และผลสอบถ้าส่งมา — ฝั่งนักศึกษาไม่ส่งแล้วเพราะมาจาก DB ไม่งั้นขึ้นซ้ำ): ตัดประกาศที่ **ตัวเองโพสต์** (`posted_by !== userId`) **ก่อน** `slice(0, 5)` (ถ้าตัดหลัง เจ้าหน้าที่ที่โพสต์รวด 5 ข่าวจะเหลือ 0); `newsPage` เลือกตาม role (student→news, officer→newsmgmt, อื่นๆ→dashboard) |
| 187-189 | `sortByNewest` | `[...items].sort((a,b) => new Date(b.at \|\| 0) - new Date(a.at \|\| 0))` ใหม่สุดก่อน ไม่มีวันที่ไปท้าย |
| 193-197 | `countUnread(items, read)` | `is_read === undefined` (ประกาศ) ใช้ localStorage; อย่างอื่นใช้ `!n.is_read` จาก server |

---

## 2. `evidenceFiles.js` — ค่ากลางของไฟล์หลักฐาน
backend เก็บเป็นคำอังกฤษ (`exam_result`, `license`, `pdf`, `jpg`, `png`) — **ห้ามโชว์บนจอตรง ๆ** (ผู้ใช้เป็นพยาบาล) แปลงผ่านฟังก์ชันที่นี่
| บรรทัด | อธิบาย |
|---|---|
| 10-11 | `MAX_EVIDENCE_FILES = 5`, `MAX_FILE_SIZE_MB = 10` — **ต้องตรงกับ backend** (`certificates.controller.js`, `upload.js`) |
| 15 | `EVIDENCE_ACCEPT` — ค่าให้ `<input accept>`: นามสกุล + MIME (บางมือถือดูแค่ MIME; มี `image/*` ทำให้เลือก "ถ่ายรูป" ได้) |
| 18-28 | `certificateTypeLabel(tt, type)` — `exam_result`→"ใบผลสอบ", `license`→"ใบประกอบ", อื่น→คำกลาง |
| 31-39 | `extensionOf(fileName)` — `lastIndexOf('.')` ตัดหลังจุด `toLowerCase()` ไม่มีจุด = `''` |
| 46-72 | `fileKindOf(typeText, fileName)` — ดู **typeText ก่อน** (`file_type` จาก backend หรือ `file.type` ที่เพิ่งเลือก) ด้วย `includes('pdf'/'png'/'jpg'/'jpeg')` ไม่ชัดค่อยดูนามสกุล (มือถือบางรุ่นไม่ส่ง `file.type`) คืน `'pdf'/'png'/'jpg'/''` |
| 75-87 | `fileKindLabel(tt, kind)` |
| 90-97 | `fileKindIcon(kind)` — pdf→`pdf`, รูป→`image`, อื่น→`doc` |
| 101-108 | `fileSizeText(bytes)` — ≥ 1MB: `toFixed(2)+' MB'`; ไม่ถึง: `max(1, round(bytes/1024))+' KB'` (ไม่ให้ "0 KB") |

---

## 3. `importTemplate.js` — ไฟล์ตัวอย่างนำเข้ารายชื่อ
| บรรทัด | อธิบาย |
|---|---|
| 1-12 | เหตุผล: ไฟล์ Excel ตัวอย่าง (หัวไทย: รหัสนักศึกษา / เลขบัตร / ปีจบ ไม่บังคับ) ทุกคอลัมน์เป็น **ข้อความ** พิมพ์เลขบัตร 13 หลักไม่ถูกแปลงเป็น `1.23E+12`; แถวตัวอย่างที่ 2 เป็นคนซ้ำชั้น; backend จับคู่หัวไทยได้เอง (`COLUMN_KEYWORDS`) |
| 13-16 | **ทำไมเก็บเป็น base64 ในไฟล์ `.js`:** `.gitignore` ไม่เก็บ `*.xlsx` (กันไฟล์รายชื่อจริงหลุดเข้า repo) ถ้าเป็น `.xlsx` แยกจะไม่ถูก commit และเครื่องอื่น build ไม่ผ่าน |
| 19-51 | `TEMPLATE_BASE64` — array ของสตริง base64 หลายท่อน `.join('')` ต่อกัน (xlsx คือไฟล์ zip) |
| 56-72 | `downloadImportTemplate()` — 3 ขั้น: (1) `atob(base64)` ได้สตริงของไบต์; (2) วน `charCodeAt(i)` ใส่ `Uint8Array` (เลข 0-255); (3) `new Blob([bytes], {type})` → `URL.createObjectURL` → สร้าง `<a download>` คลิกเอง → `revokeObjectURL` |

---

## 4. `exportReportPdf.js` — บันทึกรายงานบนจอเป็น PDF (ฝั่ง browser)
ใช้กับรายงานที่ออกจากหน้าจอโดยตรง (ไม่ผ่าน backend): ถ่ายภาพกล่องรายงานด้วย `html2canvas` → หั่นเป็นหน้า A4 → ใส่ `jsPDF` ไฟล์ที่ได้หน้าตาเหมือนบนจอ (สี ฟอนต์ ตาราง)
| บรรทัด | อธิบาย |
|---|---|
| 12-15 | ขนาดกระดาษ A4 (210×297 mm), ขอบ 10 mm, `SCALE=2` ความคมของภาพ |
| 17-25 | `findBreakPoints(box)` — จุดที่ตัดหน้าได้ = **ขอบล่างของแต่ละส่วน** (ลูกตรงของกล่อง) วัดด้วย `getBoundingClientRect().bottom - boxTop`; **ไม่นับหัวข้อ** (`.sec-title`) เป็นจุดตัด (หัวข้อจะได้ไม่ค้างท้ายหน้าแยกจากตารางของมัน) |
| 27-29 | `saveElementAsPdf(box, filename)` |
| 30 | **`await Promise.all([import('html2canvas'), import('jspdf')])`** — dynamic import: โหลดไลบรารีใหญ่ 2 ตัว **ตอนกดปุ่มเท่านั้น** ไม่ถ่วงการเปิดแอป (`{ default: html2canvas }`, `{ jsPDF }` = destructure จาก module) |
| 33-49 | `html2canvas(box, {...})`: `onclone` แก้เฉพาะ **สำเนาที่ถ่าย** — ตัดเงา/ขอบมน; ฉีด `<style>` ปิด `letter-spacing`/`animation`/`transition` (letter-spacing ทำให้สระ-วรรณยุกต์ไทยทับตัวอักษร, แถวตารางมี animation ไล่โผล่ถ่ายทันทีจะจาง) และซ่อน `.no-print` |
| 52-57 | คำนวณ: `contentW/H` (พื้นที่ใช้งาน mm), `pageHpx = floor(contentH/contentW * canvas.width)` ความสูง 1 หน้าเป็น px ของ canvas (สัดส่วนเดียวกับกระดาษ), แปลง breakpoints คูณ `SCALE` |
| 59-86 | **ลูปหั่นหน้า:** `start`=บนสุดของหน้า, `limit = start + pageHpx`; ถ้าที่เหลือพอในหน้าเดียว `end = canvas.height`; ไม่งั้นหา breakpoint ที่ **ไกลที่สุดที่ยังอยู่ในหน้านี้** และเนื้อหาไม่น้อยกว่าครึ่งหน้า (`p > start + pageHpx*0.5 && p <= limit`) ไม่มี → ตัดที่ขอบหน้า; สร้าง `<canvas>` ชิ้นย่อย พื้นขาว `drawImage` ตัดส่วน `[start, end)`; `pdf.addPage()` (ยกเว้นหน้าแรก); `addImage(toDataURL('image/jpeg', 0.92))`; `start = end` |
| 88 | `pdf.save(filename)` |

---

## 5. CSS (`index.css`, `App.css`, `styles/styles.css`, `design/styles.css`)
ไม่อธิบายทีละบรรทัด (ข้อความ CSS ล้วน) — สรุปแนวทาง:
- **`design/styles.css` (776 บรรทัด)** = สไตล์หลักของแอป: ตัวแปรสี/ขนาดบน `:root` (`--navy-700`, `--ink-50..900`, `--gold-*`, `--status-ok/wait/reject-bg/fg/dot`, `--sh-sm/md/lg` เงา, `--r-md` ขอบมน, `--header-h`), class ร่วม (`.card`, `.btn .btn-primary .btn-ghost .btn-sm .btn-lg .btn-block`, `.badge .ok .wait .reject .draft .pass .fail`, `.tbl` ตาราง, `.input`, `.field`, `.select`, `.empty`, `.skeleton`, `.pbar`, `.grid .g-3 .g-4`), layout (`.app-shell`, `.app-header`, `.app-sidebar`, `.app-main`), อนิเมชัน (`fade-up`, `page-enter`, `blur-in`, `lang-fade`), และ media query มือถือ (`.only-mobile`/`.only-desktop`)
- **`src/index.css`** (ถูก import ใน `main.jsx`) = ตัวแปร/ฟอนต์พื้นฐานตั้งต้นของ Vite (ตั้งฟอนต์ LINE Seed Sans TH)
- **`src/App.css` และ `src/styles/styles.css`** = **ไม่ได้ถูก import ที่ไหนเลย** (ไฟล์ตั้งต้นของ Vite/ต้นแบบเก่า ไม่มีผลกับแอป) — สไตล์ที่ใช้จริงมีแค่ `index.css` + `design/styles.css` (import ใน `App.jsx`)
- ข้อกำหนด accessibility ที่ใช้: `aria-label` ที่ปุ่มไอคอนล้วน, `role`/`aria-*` ใน Select/Modal/Toast, รองรับคีย์บอร์ด, `prefers-reduced-motion`
