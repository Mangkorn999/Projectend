# Frontend 12 — เจ้าหน้าที่: เพิ่มนักศึกษาเข้าระบบ (`studentImport.jsx`, 710 บรรทัด)

หน้าเดียว 3 แท็บ: **นำเข้าไฟล์ (CSV/Excel)** · **เพิ่มทีละคน** · **บัญชีที่ยังไม่เข้าระบบ (pending)**
backend: `POST /students/import[?dry_run=true]`, `POST /students`, `GET /students/pending-accounts`, `POST /students/pending-accounts/delete` (ดู backend [05](../backend/05-students-repository-และ-controller.md) หัวข้อ B7-B10)

> **หลักการ:** หน้านี้ **ไม่อ่านไฟล์เอง** — ส่งไฟล์ให้ backend ตรวจทั้งสองรอบ (ตรวจ → ยืนยัน) กฎ (เลขบัตร/รหัส/ปีจบ/encoding ไทย/จับคู่คอลัมน์) อยู่ที่ backend ที่เดียว ถ้าเขียนซ้ำที่นี่ สักวันสองที่จะตรวจไม่ตรงกัน
> นักศึกษาที่นำเข้า = สร้างแค่ `users` (รหัสผ่าน = เลขบัตร) — นักศึกษากรอกโปรไฟล์เองตอน login ครั้งแรก

---

## ค่าคงที่ (14-15)
`BOM = '﻿'` — ตัวอักษรล่องหนหัวไฟล์ บอก Excel ว่าเป็น UTF-8 (ไม่งั้นภาษาไทยเพี้ยน) ใช้ตอนสร้าง CSV ให้ดาวน์โหลด

## `StudentImport({ toast, lang })` (17-48) — ตัวห่อ 3 แท็บ
- state `tab` (`'csv'|'manual'|'pending'`), `pendingCount` (null = ยังไม่รู้) — โหลดตอนเปิดหน้าให้เลขโชว์บนแท็บตั้งแต่ยังไม่กดเข้าไป (`.catch(() => {})` ล้มเงียบ ๆ ไม่สำคัญ)
- `tabBtnStyle(active)` (183-191) — คืน object สไตล์ปุ่มแท็บ (ฟังก์ชันคืนสไตล์ตามค่า `active`)
- แสดง `CsvImport` / `ManualAdd` / `PendingAccounts` ด้วย ternary ซ้อน; ส่ง `onCount={setPendingCount}` ให้ pending รายงานค่าใหม่กลับ

---

## `PendingAccounts` (53-181) — บัญชีที่นำเข้าแล้วแต่ยังไม่กรอกโปรไฟล์
ยังไม่มีแถว `students` จึงไม่โผล่ในหน้า "ข้อมูลนักศึกษา" — ไว้ตรวจว่า import ถูกไหม และลบรหัสที่พิมพ์ผิด (เช่นจาก Google Form) ก่อนมีใคร login (backend กันไว้: บัญชีที่มีโปรไฟล์แล้วจะไม่ถูกลบจากหน้านี้)
| บรรทัด | อธิบาย |
|---|---|
| 54-62 | state: `rows` (null = โหลด), `q`, `yearFilter`, `picked` (`Set`), `confirmOpen`, `busy`, `error`, **`now = useState(() => Date.now())`** (จับเวลาครั้งเดียว — เรียก `Date.now()` ใน render ทุกรอบได้ค่าใหม่ ผลไม่นิ่ง) |
| 64-67 | `load` — โหลดรายการ + `onCount(data.length)` + ล้าง `picked`/`error`; `useEffect(() => { load(); }, [])` |
| 70-74 | `yearCounts` — object นับคนต่อปี (`(yearCounts[y] \|\| 0) + 1`); `years` เรียงใหม่→เก่า; **`activeYear`** — ปีที่เลือกไว้หายไปจากรายชื่อ (ลบคนปีนั้นหมด) ให้กลับ `'ALL'` ไม่ใช่ค้างตารางว่าง |
| 76-79 | `filtered` (ค้นรหัส `includes(q.trim())` + ปี); `usePagedList(filtered, 15, q + '|' + activeYear)`; `allOnPage` |
| 81-82 | `toggle(id)`, `togglePage()` — functional update สร้าง `Set` ใหม่ทุกครั้ง |
| 84-96 | `remove` — `POST /students/pending-accounts/delete {student_ids}` → toast จำนวน → ปิด modal → `await load()` |
| 98-101 | `fmt` วันที่; **`daysSince(iso)`** = `max(0, floor((now - เวลานำเข้า) / 86400000))`; `daysText` ("วันนี้" / "N วัน") |
| 105-114 | `downloadList` — สร้าง CSV ของรายชื่อที่กรองอยู่ ไว้เอาไปตามนักศึกษา (หัวไทย; `new Blob([BOM + header + body])` → `createObjectURL` → `<a download>` → `revokeObjectURL`) |
| 116-179 | JSX: คำอธิบาย; ช่องค้นหา + ตัวกรองปี + "แสดง N จาก M" + ปุ่มดาวน์โหลด/เลือกทั้งหมด/ล้าง/ลบ (ปุ่มลบแดงเมื่อมีที่ติ๊ก); ตาราง (ติ๊กหัวตารางเลือกทั้งหน้า, รหัส, ปีจบ + ป้าย "กำหนดเอง" ถ้า `year_overridden`, วันที่นำเข้า, "N วัน" **สีเตือนตัวหนาเมื่อ ≥ 3 วัน** = ควรตามให้เข้ามากรอก); `colSpan={5}` แถว "ไม่พบ"; Modal ยืนยันลบ (`tone="danger"`) |

---

## ตัวช่วยของแท็บนำเข้า (193-252)
- **`REASON_MATCHERS`** (195-203) — array ของ `{match, labelKey, tone}` จัดกลุ่มข้อความเหตุผลยาว ๆ จาก backend เป็นป้ายสั้น ๆ (มีในระบบแล้ว / ซ้ำในไฟล์ / ปีจบ / เลขบัตร / รหัส / ข้อมูลไม่ครบ / บันทึกไม่สำเร็จ) กวาดตาเห็นว่าปัญหาประเภทไหนเยอะสุด
- `tagForReason(reason, tt)` — `REASON_MATCHERS.find(r => reason?.includes(r.match))` ไม่เจอ = "อื่น ๆ"
- `skippedToCsv(skipped)` — สร้างข้อความ CSV: `"${reason.replace(/"/g, '""')}"` (escape เครื่องหมายคำพูดด้วยการซ้ำ 2 ตัว ตามมาตรฐาน CSV) ให้เจ้าหน้าที่โหลดไปแก้เฉพาะแถวที่พลาดแล้วอัปใหม่
- `RESULT_PER_PAGE = 20`
- **`ImportingNotice({count, tt})`** (226-252) — แถบ "กำลังนำเข้า": นำเข้าหลายร้อยคนใช้เวลาเป็นนาที (hash รหัสผ่านทีละคน); `setInterval` นับวินาทีที่ผ่านไป (cleanup `clearInterval`); **`beforeunload` listener** `e.preventDefault(); e.returnValue = ''` — browser ถามยืนยันก่อนปิดแท็บ/รีเฟรช (cleanup ถอด listener); ประมาณเวลา `max(5, round(count * 0.065))` วินาที (วัดจากเทส 1,000 แถว = 62 วินาที); `role="status" aria-live="polite"`

---

## `CsvImport` (254-512) — นำเข้าไฟล์ **2 ขั้น**
**ทำไม 2 ขั้น:** กันนำเข้าผิดแล้วต้องไล่ลบทีหลัง — ① "ตรวจไฟล์" = ส่ง `?dry_run=true` (ตรวจทุกแถว **ไม่บันทึก**) โชว์สรุป ② "ยืนยันนำเข้า" = ส่งไฟล์เดิมอีกรอบบันทึกจริง

### state (255-263)
`file`, `busy`, `preview` (ผล dry run — มีค่า = อยู่ขั้นรอยืนยัน), `result` (ผลนำเข้าจริง), `view` (`'imported'|'skipped'` ตารางไหนโชว์), `error`, **`columnPick`** `{columns}` (backend จับคู่คอลัมน์ไม่ได้ → ให้เจ้าหน้าที่เลือกเอง), `mapping` `{student_id, national_id, academic_year}`

### ฟังก์ชัน
| บรรทัด | อธิบาย |
|---|---|
| 267 | `pickFile(f)` — **เปลี่ยนไฟล์ = ล้างผลเดิมทั้งหมด** (preview/result/error/columnPick/mapping) ไม่งั้นกด "ยืนยัน" จะนำเข้าไฟล์ใหม่ทั้งที่ผู้ใช้เห็นสรุปของไฟล์เก่า |
| 270-272 | `downloadTemplate` → `downloadImportTemplate()` ([frontend 04](04-helpers-notifications-evidence-pdf.md)) |
| 274-281 | `downloadSkipped` — CSV ของแถวที่ข้าม |
| 284-292 | **`send(dryRun)`** — `FormData` (`file` + `mapping` เป็น JSON string ถ้าเลือกคอลัมน์เอง — **ส่งซ้ำทั้งตอนตรวจและตอนยืนยัน** ไม่งั้นสองรอบอ่านไฟล์คนละแบบ); URL `/students/import?dry_run=true` หรือ `/students/import` |
| 295-314 | `check` — ไม่มีไฟล์ → error; `await send(true)`; สำเร็จ → `setPreview`, `view` = skipped ถ้ามีแถวข้าม (ให้เห็นก่อน). **`catch`: `e.payload?.code === 'missing_columns'`** (backend ตอบ 400 พร้อมรายชื่อคอลัมน์) → เปิด `columnPick` + **เติมช่องที่เดาได้แล้วไว้ให้** `Object.fromEntries(Object.entries(e.payload.mapping).filter(([, v]) => v))` (เจ้าหน้าที่แก้เฉพาะช่องที่เหลือ) |
| 317-330 | `confirm` — `await send(false)` → `setResult`, ล้าง preview, toast (`info` ถ้ามีแถวข้าม ไม่งั้น `success`) |
| 333-339 | `shown = preview \|\| result`; `resultKey` เปลี่ยนเมื่อได้ผลชุดใหม่ → `usePagedList` 2 ตัว (สำเร็จ/ข้าม) เด้งกลับหน้า 1 (ไฟล์เป็นพันแถวต้องแบ่งหน้า) |

### JSX (341-511)
- กล่องคำอธิบาย (คอลัมน์ที่ต้องมี — ชื่อไทย ไม่ใช่ชื่อ field ใน DB; หมายเหตุ Excel; ชื่อคอลัมน์อะไรก็ได้)
- แถวควบคุม: ปุ่มดาวน์โหลดแบบฟอร์ม; ไฟล์ที่เลือก (ชื่อตัดด้วย `…` + ปุ่ม ✕ `aria-label`) หรือปุ่มเลือกไฟล์ (`<input type="file" accept=".xlsx,.csv,...">` ซ่อนใน `<label>`); ยังไม่ตรวจ → "ตรวจไฟล์" / ตรวจแล้ว → "ยกเลิก" + "ยืนยันนำเข้า N คน" (`disabled={busy || preview.imported_count === 0}`)
- `busy && preview` (กำลังนำเข้าจริง) → `ImportingNotice`
- **ช่องเลือกคอลัมน์ (`columnPick`):** array ของ `[field, labelKey, optional]` `.map` สร้าง `<Select>` 3 ตัว (ปีจบ optional มีตัวเลือก "ไม่ใช้"); ปุ่ม "ตรวจใหม่" `disabled` จนกว่าจะเลือกรหัส+เลขบัตร
- ผล: `ResultBanner` (ซ่อนระหว่างกำลังนำเข้าจริง), บรรทัด "คอลัมน์ที่ใช้" (`columns_used` — ให้เห็นก่อนยืนยัน กันจับคู่ผิดเงียบ ๆ; `.replace(' *','')` ตัดดอกจัน), `OverridesCard` (คนที่ปีจบไม่ตรงรหัส), การ์ดสลับ 2 ตาราง ด้วย `StatToggle`, ปุ่มดาวน์โหลดแถวที่ข้าม; ตารางสำเร็จ (ลำดับนับต่อหน้า `page * RESULT_PER_PAGE + i + 1`; ป้าย "จะนำเข้า"/"เข้าระบบแล้ว" ตาม `preview`) และตารางข้าม (แถว/รหัส/ป้ายประเภท/เหตุผล)

### คอมโพเนนต์ย่อย
- `OverridesCard({rows})` (515-544) — ตารางคนที่ใส่ปีจบไม่ตรงสูตรรหัส (เคสซ้ำชั้น/ลาพัก): ปีตามรหัส vs ปีที่จะใช้จริง — ต้องเห็นก่อนยืนยันเพราะเป็นตัวตัดสินว่านักศึกษาจะเห็นรอบสอบไหน
- `StatToggle` (547-569) — การ์ดตัวเลขที่กดสลับตารางได้; `aria-pressed`; active มีกรอบ+พื้นหลังตัดกันชัด (ไม่พึ่งแค่สีตัวเลข คนตาบอดสีก็แยกออก); `var(--${tone})` ต่อชื่อตัวแปร CSS แบบไดนามิก
- `EmptyRows` (571-573)
- **`ResultBanner`** (577-608) — แถบสรุปโทนสีตามผลจริง (success ≠ ไม่มีปัญหาเสมอไป): `isPreview` = ผลตรวจ ข้อความต้องบอกชัดว่ายังไม่ได้นำเข้า; 3 กรณี (ไม่มีใครผ่าน → แดง / ผ่านบางส่วน → เหลือง / ผ่านหมด → เขียว) × (ตรวจ / นำเข้าจริง); ใช้ `let tone, icon, message;` แล้วกำหนดใน `if/else if` — เขียนแบบธรรมดาไม่ใช้ ternary ซ้อน

---

## `ManualAdd` (614-697) — เพิ่มทีละคน
- `EMPTY_FORM = {student_id, national_id, academic_year}`; `set(field)` curried handler
- `submit`: ต้องมีรหัส+เลขบัตร; `POST /students` — **ส่ง `academic_year` เฉพาะตอนกรอกมา** (`academic_year.trim() ? {...3 ช่อง} : {...2 ช่อง}`) เว้นว่าง = backend คำนวณจากรหัส; สำเร็จ → ล้างฟอร์ม
- ช่องปีจบ: `onChange` **กรองเอาแต่ตัวเลขก่อนแล้วค่อย `.slice(0, 4)`** (`replace(/[^0-9]/g, '')`) — ห้ามใช้ `maxLength` เพราะ browser ตัดข้อความ "ก่อน" กรอง (วาง "พ.ศ. 2572" จะเหลือ "พ.ศ." แล้วกรองทิ้งหมดกลายเป็นช่องว่าง); `inputMode="numeric"` ให้มือถือโชว์แป้นตัวเลข
- `Req` (699) = ดอกจันแดง; `FormSection` (702-710) หัวข้อกลุ่มช่อง
