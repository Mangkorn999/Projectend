# Backend 06 — Students: ส่งออก (Excel / PDF)

โฟลเดอร์: `backend/src/modules/students/`
ไฟล์: `student.export.controller.js` (283 บรรทัด), `students.pdf.js` (58 บรรทัด)
ชิ้นส่วนที่ใช้ร่วม: `utils/xlsxExport.js`, `utils/pdfReport.js` (อธิบายใน [เอกสาร 01](01-แกนกลาง-server-config-middleware-utils.md))

> ทุก endpoint ที่นี่ จำกัด `officer` เท่านั้น (ข้อมูลรายบุคคล — ผู้บริหารเห็นแค่สถิติรวม = หลัก data minimization)
> ไฟล์ Excel **ไม่มีเลขบัตรประชาชน** (เลขบัตร = รหัสผ่านเริ่มต้น ห้ามหลุดในไฟล์ที่แชร์ต่อได้)

---

## `student.export.controller.js`

### ส่วนหัว (1-16)
| บรรทัด | ทำอะไร |
|---|---|
| 1-5 | คอมเมนต์ระบุ 3 endpoint ที่ไฟล์นี้ดูแล (แยกจาก `student.controller.js` เพื่อให้ไฟล์เดิมสั้นลง) |
| 6-10 | import repository ของ students/subjects/rounds, `buildSubjectListPdf`, `buildXlsx`, `buildXlsxWorkbook`, `sendXlsx` |
| 12-16 | `httpError` |

### `resolveSubjectQuery(query)` (19-63) — ตรวจ query ที่ใช้ร่วม 2 endpoint
ทำฟังก์ชันเดียวเพื่อไม่ให้ JSON list กับ export PDF เพี้ยนไม่ตรงกัน
| บรรทัด | ทำอะไร |
|---|---|
| 20 | destructuring `subject_code`, `passed`, `round_id`, `year` จาก query (ค่าทุกตัวเป็นสตริง) |
| 21-25 | ต้องมี `subject_code` และ `passed` เป็น `"true"`/`"false"` เท่านั้น → 400 |
| 26-30 | ต้องมี `round_id` หรือ `year` อย่างน้อยอย่างหนึ่ง → 400 |
| 32-37 | หาวิชาจากรหัส ไม่เจอ → 404 |
| 39-52 | ถ้ามี `round_id`: หารอบ (404) เก็บ `roundId` + `scopeLabel = "รอบ n/ปี"`; ไม่งั้นใช้ `"รวมทั้งปีการศึกษา ปี"` |
| 54-60 | `wantPassed = passed === "true"` (แปลงเป็น boolean) แล้วเรียก `findMatchingSubjectResult` (ดู [05](05-students-repository-และ-controller.md) — นับเฉพาะใบ approved และไม่ carried_forward) |
| 62 | คืน `{ subject, wantPassed, scopeLabel, rows }` |

### `getSubjectResultList` (66-88) — `GET /api/students/subject-result-list`
เรียก `resolveSubjectQuery` แล้วแปลง `rows` เป็น JSON เบา ๆ (รหัส/ชื่อ/นามสกุล/ห้อง/ปี/วันที่ส่ง) — หน้า "รายงานสรุปผล" ใช้โชว์ตัวอย่างก่อนกดดาวน์โหลด. `r.student.room?.room_name ?? null` = ถ้าไม่มีห้องเป็น null

### `exportSubjectList` (92-138) — `GET /api/students/export-subject`
| บรรทัด | ทำอะไร |
|---|---|
| 94 | ตรวจ query เหมือนข้างบน |
| 95-96 | `format` ค่าเริ่มต้น `pdf` (ปุ่มเดิมของหน้าจอไม่พัง); ถ้าไม่ใช่ `pdf`/`xlsx` → 400 |
| 98 | ชื่อไฟล์ เช่น `รายชื่อ-ผ่าน-1106.pdf` |
| 100-124 | **Excel:** `buildXlsx` กำหนดคอลัมน์ (ลำดับ, รหัส, ชื่อ, นามสกุล, ห้อง, ปี, วันที่ส่ง) แล้ว `rows.map` ใส่เลขลำดับ `i + 1`, วันที่แปลงด้วย `toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })` → `sendXlsx` แล้ว `return` |
| 126-134 | **PDF:** ตั้ง header `Content-Type: application/pdf` และ `Content-Disposition` แบบ ASCII สำรอง + `filename*=UTF-8''` (RFC 5987 รองรับชื่อไฟล์ไทย) แล้วเรียก `buildSubjectListPdf({..., res})` ซึ่ง **pipe PDF ลง `res` โดยตรง** ไม่ต้อง `res.send` |

### ตัวช่วยจัดรูปแบบ (140-152)
- `formatThaiDateTime(d)` — วันที่-เวลาไทย (`dateStyle/timeStyle: "short"`, timezone Asia/Bangkok); ไม่มีค่า = `""`
- `paperStatusLabel(r)` — แปลงสถานะใบเป็นไทย: `student_status==="draft"` → "ยังกรอกไม่เสร็จ"; `staff_status==="approved"` → "ยืนยันแล้ว"; `rejected` → "ถูกตีกลับ"; นอกนั้น "รอตรวจสอบ" (ลำดับ `if` สำคัญ — draft ตรวจก่อน)

### `exportStudents` (158-283) — `POST /api/students/export`
ใช้ POST เพราะรายชื่อรหัสยาวเกิน URL
| บรรทัด | ทำอะไร |
|---|---|
| 158 | `EXPORT_MAX_IDS = 5000` |
| 161 | `req.body ?? {}` กัน body ไม่มี; ดึง `student_ids`, `year`, `by_round` |
| 164-174 | **โหมดตามรายชื่อ** (รายชื่อที่กรองอยู่บนหน้าจอ): ต้องเป็น array 1-5000 รายการ และทุกตัวเป็น string ยาว 1-20 → `where = { ids: [...new Set(...)] }` (ตัดซ้ำ) |
| 175-177 | **โหมดทั้งรุ่น:** `year` เป็นจำนวนเต็ม 2400-2700 |
| 178-180 | ไม่เข้าทั้งสองโหมด → 400 |
| 182 | `findForExport(where)` (ไม่มีเลขบัตร) |
| 184-208 | `students.map`: **หา "ใบล่าสุด"** ด้วย `[...s.exam_results].sort((a,b) => ปีมาก→น้อย || ครั้งมาก→น้อย)[0]` (เรียงตามปี/ครั้งที่สอบของรอบ **ไม่ใช่วันที่ส่ง** — แก้ใบเก่าไม่ทำให้กลายเป็นล่าสุด; ใช้ `[...]` copy ก่อน `sort` เพราะ `sort` แก้ array เดิม; `\|\|` ใช้ตัวที่สองเมื่อผลลบเป็น 0 = ปีเท่ากัน). แล้วประกอบแถว: ชื่อ/ห้อง/ปี/อีเมล/เบอร์/สิทธิ์/รอบล่าสุด/สถานะ/`passed_text = ผ่าน/ทั้งหมด` |
| 210-228 | `studentSheet` — นิยามคอลัมน์ 13 คอลัมน์ของชีต "ข้อมูลนักศึกษา" |
| 230-278 | **ถ้า `by_round === true`** (แยกตามรอบ): ใช้ `Map` คีย์ `"ปี-ครั้ง"` เก็บแถวของแต่ละรอบ — วนนักศึกษา × ใบผลสอบทุกใบ (ไม่ใช่เฉพาะล่าสุด) ใส่แถวลงรอบนั้น; คอลัมน์ต่อรอบ `roundColumns` (มี ส่งเมื่อ/ยืนยันเมื่อ); เรียงรอบใหม่→เก่า (`b.year - a.year \|\| a.attempt - b.attempt` = ปีล่าสุดก่อน ในปีเดียวกันครั้งน้อยก่อน); `buildXlsxWorkbook([studentSheet, ...ชีตต่อรอบ])` ได้ไฟล์เดียวหลายแท็บ. **ไม่งั้น** `buildXlsx(studentSheet)` ชีตเดียว |
| 279 | `sendXlsx` ชื่อไฟล์ `ข้อมูลนักศึกษา-{ตามที่เลือก\|รุ่น ปี}{-แยกรอบ}.xlsx` |

---

## `students.pdf.js` (58 บรรทัด)

PDF รายชื่อนักศึกษาที่ผ่าน/ไม่ผ่านวิชาเดียว (ปุ่มบนการ์ดอัตราผ่านรายวิชาใน Dashboard)

| บรรทัด | ทำอะไร |
|---|---|
| 6-9 | import `PDFDocument` (pdfkit) + ชิ้นส่วนร่วมจาก `utils/pdfReport.js` |
| 13 | `buildSubjectListPdf({subject, passed, scopeLabel, rows, res})` |
| 14 | `new PDFDocument({ size: "A4", margin: 40, bufferPages: true })` — `bufferPages` จำเป็นเพื่อวาด "หน้า X / Y" ทีหลัง |
| 15-16 | `registerThaiFonts(doc)` ฟอนต์ไทย; `doc.pipe(res)` ส่งข้อมูลที่สร้างลง HTTP response ทันที |
| 18 | `resultLabel` "สอบผ่าน"/"สอบไม่ผ่าน" |
| 21-28 | หัวรายงานกึ่งกลาง: ชื่อรายงาน, รหัส+ชื่อวิชา, คณะ+ขอบเขต (สีเทา `fillColor("#555")`), วันเวลาออกรายงาน (`toLocaleString("th-TH", Asia/Bangkok)`) |
| 31-33 | `section(doc, "สรุป", 40)` + จำนวนคน |
| 36-54 | `section("รายชื่อ")`; ถ้า `rows.length===0` เขียนข้อความว่าง; ไม่งั้น `drawTable` ความกว้างคอลัมน์ `[90,130,100,90,90]` (รวม 500 = `CONTENT_WIDTH`) แล้ว `doc.y = endY` ให้เขียนต่อจากท้ายตาราง |
| 56-57 | `drawPageNumbers(doc)` (ต้องเรียกก่อน end) แล้ว `doc.end()` ปิดเอกสาร |
