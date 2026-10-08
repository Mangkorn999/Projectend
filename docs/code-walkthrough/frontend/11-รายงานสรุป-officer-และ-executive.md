# Frontend 11 — รายงานสรุปผลสอบ: ฉบับเจ้าหน้าที่ + ฉบับผู้บริหาร

ไฟล์ (`frontend/src/design/`): `reportsReal.jsx` (362), `executiveReportReal.jsx` (192)
backend: `/rounds`, `/dashboard/history`, `/dashboard/stats`, ส่งออก `/dashboard/export-first-attempt`, `/dashboard/export-first-year`, `/students/export` (ดู backend [06](../backend/06-students-export.md), [10](../backend/10-dashboard-สถิติ.md))

> **หลักการ:** ตัวเลขทุกตัวมาจาก endpoint เดียวกับหน้า Dashboard → รายงานตรงกับที่เห็นบนจอเสมอ
> **ปุ่ม "ดาวน์โหลด PDF" ไม่เรียก backend** — ถ่ายภาพกล่องรายงานบนจอด้วย `saveElementAsPdf` ([frontend 04](04-helpers-notifications-evidence-pdf.md)) ผู้บริหารก็ดาวน์โหลดได้ (ไม่ต้องใช้ endpoint ของเจ้าหน้าที่)
> ส่วนแผง "ส่งออกข้อมูล" (officer เท่านั้น) เรียก backend ได้ไฟล์ Excel/PDF

---

## 1. `reportsReal.jsx` — `ReportsReal({ toast, readonly, lang })`

### state + โหลด (19-60)
| บรรทัด | อธิบาย |
|---|---|
| 19-32 | `stats` (ของรอบที่เลือก), `error`, `subjectModal`, `history`, `rounds`, `year`, `roundId` (รอบที่รายงานแสดง = รอบที่จะ export), `roundsLoaded` (แยก "ยังโหลดอยู่" จาก "ยังไม่มีรอบเลย") |
| 25 | `reportRef = useRef(null)` — ชี้กล่องรายงาน ให้ PDF ถ่ายจากกล่องนี้ |
| 35-50 | `useEffect([])`: `Promise.all([/rounds, /dashboard/history?years=3])`; ตั้งค่าเริ่ม = รอบที่เปิด (`find`) ไม่มีก็รอบล่าสุด (`[...roundList].sort(ปี มาก→น้อย \|\| ครั้ง มาก→น้อย)[0]`) |
| 53-60 | `useEffect([roundId])` โหลด `/dashboard/stats?round_id=`; `dropped` flag กัน race |
| 62-66 | `roundsInYear` (เรียงครั้ง), `yearOptions` (`new Set` ตัดซ้ำ), `yearStats` = สรุปรายปีของปีที่เลือก |
| 69-75 | `changeYear` — เปลี่ยนปี = เด้งไปรอบแรกของปีนั้น (round_id ปีเก่าไม่อยู่ในปีใหม่) |
| 79-88 | `downloadReportPdf` — `saveElementAsPdf(reportRef.current, 'exam-report-ครั้ง-ปี.pdf')` ใน `try/catch/finally` (`pdfBusy` กันกดซ้ำ) |

### early return (90-102)
error → ไม่มีรอบเลย (`roundsLoaded && rounds.length === 0` → `<Empty>` บอกตรง ๆ ไม่ใช่หมุนค้าง) → ยังไม่มี `stats` → `<Loading>`

### ข้อมูลที่เตรียม (104-165)
- destructure จาก `stats`: `round, total, by, submitted, fullyPassed, fullyPassedRate, passRateOfSitters, confirmed, perSubject, roundTotal, roundNotStarted, roundFillRate, alreadyPassed`
- **`summaryCards`** (array ของ `[ป้าย, ค่า, คำอธิบายตัวหาร, tone]`): ทั้งรุ่น / ส่งแล้ว (หารด้วย `roundTotal` ให้ตรงตารางสถานะ) / ผ่านครบ (จำนวนวิชา = `perSubject.length` ไม่ใช่ 8 ตายตัว — รอบที่สอบ 3 วิชาจะไม่ขึ้น "ผ่านครบ 8 วิชา"; หารทั้งรุ่น) / % ผู้สอบผ่าน (`confirmed > 0 ? passRateOfSitters + '%' : '—'` — `confirmed = 0` ไม่มีฐานหาร **ขึ้นขีด ไม่ใช่ 0%**); **คำอธิบายตัวหารใต้ทุกใบ** ไม่งั้น % 2 ตัวหารคนละฐานดูเหมือนเทียบกันได้
- **`byStatus`** 5 แถว (ยืนยัน/รอตรวจ/ตีกลับ/ร่าง/ยังไม่เริ่ม `roundNotStarted`) บวกกันได้เท่า `roundTotal` (คนที่ผ่านครบจากรอบก่อนไม่ต้องกรอก จึงไม่อยู่ในฐาน — บอกจำนวนไว้ใต้ตารางด้วย `alreadyPassed`)
- **แผง "ส่งออกข้อมูล" (128-165)** `exportRows` = array ของแถวส่งออก: ผ่าน/ไม่ผ่านครั้งแรก (`firstAttemptItems(passed)` → `GET /dashboard/export-first-attempt?year&passed&format` ผ่าน `downloadFile`), ผ่าน/ไม่ผ่านภายในปีแรก (`firstYearItems(passed)` → `downloadFirstYearList` จาก `yearExports.js`; เขียนด้วย `for...of` + `items.push`), ข้อมูลนักศึกษา (`POST /students/export` body `{year}` หรือ `{year, by_round: true}`) — แต่ละแถวมี `ExportMenu` ของตัวเอง

### JSX (167-361)
- **หัว:** กว้างเท่าการ์ด (900) ไม่งั้นชื่ออยู่ซ้ายสุดจอ ปุ่มอยู่ขวาสุด; `className="no-print"` ซ่อนตอนพิมพ์/บันทึก PDF (CSS `.no-print { display:none }` ฉีดใน `onclone`); เลือกปี + รอบ (รายงานบนจอกับ PDF เป็นรอบเดียวกันเสมอ), ปุ่มพิมพ์ (`window.print()`), ปุ่มดาวน์โหลด PDF
- **แผงส่งออก** เฉพาะ `!readonly`
- **กล่องรายงาน** (`className="report-sheet" ref={reportRef}`): หัวกระดาษ (โลโก้/ชื่อรายงาน/รอบ/วันที่ออก `new Date().toLocaleDateString('th-TH')`); บรรทัดหมายเหตุ "ผ่านนับเฉพาะที่ยืนยัน" (มีใบรอตรวจ → ตัวหนาสีเตือนบอกจำนวน — ถูกพิมพ์ออกไปด้วย); ส่วนที่ 1 การ์ดสรุป 4 ใบ (`report-grid` 4 คอลัมน์, แถบสีซ้ายตาม tone); **ส่วน "ตัวเลขรายงานสภาการพยาบาล"** (ถ้ามี `yearStats`): ตัวหาร + 2 แถว (ผ่านครั้งแรก/ภายในปีแรก: `passed / total` + `rate.toFixed(2)%`); ส่วนที่ 2 ตารางสถานะ (% = `round(n / roundTotal * 10000) / 100` ถ้า roundTotal เป็น 0 → `'0.00'`); ส่วนที่ 3 ตารางผลรายวิชา (ตัวเลข ผ่าน/ไม่ผ่าน **คลิกได้เฉพาะ officer** (`!readonly`) และมี ≥ 1 คน → เปิด `SubjectResultModal` scope `{roundId}`; `rate === null` → ป้าย `—`; ป้ายสีตามเกณฑ์ ≥ 80 เขียว / ≥ 60 ทอง / อื่น แดง); คำแนะนำ `no-print`; `FirstAttemptSubjectTable` (ระดับปี/รอบแรก คนละตัวหารกับตารางด้านบน จึงแยกกัน ไม่ใช่แก้ของเดิม); ตาราง "จำแนกจำนวนวิชาที่ผ่าน" (`rows.filter(r => r.count > 0)` ซ่อนแถวว่างในรายงาน — ต่างจากหน้า Dashboard ที่โชว์แถว 0 จาง ๆ)

---

## 2. `executiveReportReal.jsx` — `ExecutiveReport({ toast, lang })` (ฉบับผู้บริหาร)

**ต่างจากฉบับเจ้าหน้าที่:** ระดับ **ปีการศึกษา** (ไม่มีตัวเลือกรอบ), ไม่มีเรื่องงานเจ้าหน้าที่ (สถานะการตรวจ, ส่งกี่ใบ, ยังไม่เริ่มกรอก), ไม่มีรายชื่อรายบุคคล, เฉพาะตัวเลขที่ผู้บริหารใช้ตัดสินใจ: อัตราผ่านครั้งแรก/ภายในปีแรก เทียบย้อนหลัง รายวิชา; ใช้ `GET /dashboard/history` อย่างเดียว
| บรรทัด | อธิบาย |
|---|---|
| 20 | `showRate(value)` — `null/undefined` → `'—'` ไม่ใช่ 0% (ค่าที่ไม่มี เช่น ยังไม่มีผู้ยืนยัน), มีค่า → `toFixed(2) + '%'` |
| 22-30 | state: `history`, `year`, `error`, `pdfBusy`, `reportRef` |
| 31-41 | โหลด `/dashboard/history?years=20` ครั้งเดียว ตั้ง `year` = ปีล่าสุด (`Math.max(...)`) |
| 43-52 | error / โหลด / ไม่มีข้อมูล |
| 54-65 | `yearOptions`; `yearStats`; **`trendYears`** = ปีที่เลือก + อีกไม่เกิน 2 ปีก่อนหน้า (`.filter(<= year).sort(ใหม่→เก่า).slice(0, 3)`); `prevYear`, `firstDelta` (ผลต่างเทียบปีก่อน — null ถ้าไม่มีปีก่อน); `attempts` เรียงครั้ง; `pending` ใบรอตรวจ (นับเป็นคน) |
| 67-76 | `downloadPdf` — ชื่อไฟล์ `executive-report-ปี.pdf` |
| 78-190 | JSX กล่องรายงาน 5 ส่วน: **(1)** ตัวเลขหลัก 2 ตัวสำหรับสภาการพยาบาล (ตัวหาร = ทั้งรุ่น) + ▲▼ เทียบปีก่อน; **(2)** อัตราผ่านแยกตามครั้งที่สอบ — **ตัวหารคือผู้ที่ยืนยันแล้วของครั้งนั้น** (คนละตัวหารกับข้อ 1 — มีหมายเหตุอธิบาย); `showRate(r.confirmed ? (r.fullyPassed / r.confirmed) * 100 : null)`; **(3)** เทียบย้อนหลัง (แนวโน้ม ดีขึ้นหรือแย่ลง) — แถวปีที่เลือกตัวหนา; **(4)** `FirstAttemptSubjectTable` (ตารางเดียวกับ Dashboard); **(5)** `PassDistribution` (import มาจาก `dashboardReal.jsx` — คอมโพเนนต์ที่ `export` ไว้ใช้ข้ามไฟล์) |
