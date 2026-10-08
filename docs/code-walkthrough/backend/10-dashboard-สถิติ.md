# Backend 10 — Dashboard (สถิติ, แจ้งเตือนเจ้าหน้าที่, ส่งออก PDF/Excel)

โฟลเดอร์: `backend/src/modules/dashboard/`
ไฟล์: `dashboard.repository.js` (219), `dashboard.service.js` (968), `dashboard.controller.js` (221), `dashboard.pdf.js` (365)
routes ดู [เอกสาร 02](02-auth-และแผนที่-routes.md) — `/stats`, `/history`, `/alerts` = officer + executive; `/export*` = officer เท่านั้น

> ## กฎของสถิติ (สำคัญที่สุด — กรรมการมักถาม)
> 1. **ตัวเลข "ผ่าน" ทุกตัวนับเฉพาะใบที่เจ้าหน้าที่ยืนยันแล้ว (`staff_status = approved`)** — ผลที่นักศึกษากรอกเองยังไม่มีใครเทียบกับใบผลสอบจริง
> 2. **ตัวหารของ % = นักศึกษาทั้งรุ่น** (รวมคน import แล้วยังไม่เคย login) ตามสูตรที่คณะส่งสภาการพยาบาล — คนที่ไม่ส่งผลก็นับว่ายังไม่ผ่าน
> 3. **ไม่นับวิชาที่ยกผลมา (`carried_forward`)** เป็น "สอบผ่านจริง"
> 4. ใบรอตรวจ ไม่หาย: ยังนับใน "ส่งผลแล้ว" (fillRate) และสัดส่วนสถานะ แต่ไม่นับเป็น "ผ่าน"

---

## A. `dashboard.repository.js` (query อย่างเดียว ไม่มีสูตร)

| บรรทัด | ฟังก์ชัน | ทำอะไร |
|---|---|---|
| 4 | `NEWEST_FIRST` | ลำดับเรียงที่ใช้ซ้ำ: ปีใหม่→เก่า แล้วครั้งมาก→น้อย |
| 11-16 | `findDefaultRound` | เปิด dashboard โดยไม่เลือกรอบ → รอบที่ `open` ก่อน; ไม่มีค่อยรอบล่าสุด. `A ?? B` = ถ้า A เป็น null/undefined ใช้ B (เรียก query ที่สองเฉพาะเมื่อจำเป็น) |
| 19-23 | `findRoundsByYears(years)` | ทุกรอบของปีที่ระบุ (`in`) |
| 26-33 | `findAcademicYears` | ปีที่มีรอบจริง `distinct` เรียงใหม่→เก่า → `map` เอาแค่เลขปี |
| 36-37 | `findRoundById` | |
| 43-62 | `findPendingStudentIdsByYear(year)` | **รหัสที่ import แล้วยังไม่เคยกรอกโปรไฟล์** (ยังไม่มีแถว students) ของรุ่นนั้น — ต้องนับเป็นสมาชิกรุ่น (ไม่งั้นตัวหารต่ำเกินจริง % ผ่านสูงเกินจริง). ปีของรุ่น = `import_academic_year` ถ้า null คำนวณจากรหัส (+4); `try/catch` รหัสผิดรูปแบบข้าม ไม่ให้ทั้งหน้าพัง |
| 66 | `countPendingByYear` | แค่จำนวน (ผู้บริหารเห็นตัวเลขได้โดยไม่เห็นรายบุคคล) |
| 69-73 | `countStudentsByYear` | ตัวหารของรุ่น = กรอกโปรไฟล์แล้ว (`count`) + ยังไม่เข้าระบบ |
| 77-80 | `countEligibleByYear` | คนที่เปิดสิทธิ์แล้ว |
| 84-105 | `countStudentsByRoom` | `groupBy room_id` นับจากตาราง students (คนไม่ส่งผลก็ต้องอยู่ในตัวหาร) → ดึงชื่อห้อง → `Map` id→ชื่อ → `map` + `sort` ตามห้อง; ไม่มีชื่อใช้ `ห้อง N` (`\|\|`) |
| 108-109 | `findAllSubjects` | |
| 123-162 | `findEligibleWithPassedSubjects(round)` | นักศึกษาที่เปิดสิทธิ์ + วิชาที่ผ่านแล้ว **"ก่อนถึงรอบนี้"** — ใช้ `round: { OR: [ปีเก่ากว่า, หรือ ปีเดียวกันแต่ครั้งน้อยกว่า] }` ห้ามนับรอบหลัง (เอาผลอนาคตมาตัดสินอดีตไม่ได้). เงื่อนไขเหมือน `findPassedSubjectIds`: ตัดใบตีกลับ, ไม่นับ carried_forward. สร้าง `Map<student_id, Set<subject_id>>` แล้วคืน array `{student_id, passed_subject_ids}` (`?? []` กันคนไม่มีผ่านเลย) |
| 168-183 | `findResultsByRound` | ใบทั้งหมดของรอบ + ผลรายวิชา + student (ห้อง, ชื่อ) **ไม่กรอง `exam_eligible`** (ถอนสิทธิ์ทีหลังต้องไม่หายจากสถิติ) |
| 189-219 | `findStudentsByYear` | ทั้งรุ่นพร้อมชื่อ ไทย/อังกฤษ ห้อง เบอร์ อีเมล (`select` ระวังไม่เอา hash). เพิ่มแถวสำหรับบัญชีที่ยังไม่เข้าระบบ (ช่องว่างหมด) แล้ว `sort` ด้วย comparator `(a<b ? -1 : a>b ? 1 : 0)` |

---

## B. `dashboard.service.js` (สูตรสถิติทั้งหมด)

### B1. ตัวช่วยคำนวณ (บรรทัด 1-63)
| บรรทัด | ฟังก์ชัน | ทำอะไร |
|---|---|---|
| 6 | `percent(part, whole)` | % จำนวนเต็ม; `whole` เป็น 0 → 0 (กันหารศูนย์) |
| 10-13 | `rate2(part, whole)` | % ทศนิยม 2 ตำแหน่ง: `Math.round(part/whole*10000)/100` (คูณ 10000 ปัด หาร 100) — ตรงกับที่คณะส่งสภา (71.43 ไม่ใช่ 71) |
| 16 | `onlySent` | ตัด `draft` ออก |
| 21 | `notRejected` | ตัดใบตีกลับ (pending ยังนับ) |
| 30 | `onlyConfirmed` | **เฉพาะ `approved`** — ฐานของทุกตัวเลข "ผ่าน" |
| 33-42 | `countByStatus` | นับสถานะต่อใบ: `draft` / `approved` / `rejected` / อื่น ๆ = `submitted` (ส่งแล้วรอตรวจ) |
| 54-63 | `countFullyPassed(sent, subjectIds)` | นับคนที่ **ทุกวิชาของรอบ** `.every` มีผลที่ `.some` ตรงวิชาและผ่าน; `subjectIds` ว่างคืน 0 (เพราะ `[].every()` เป็น true เสมอ ถ้าไม่กันทุกใบ "ผ่านครบ") |

### B2. สถิติรายวิชา
| บรรทัด | ฟังก์ชัน | ทำอะไร |
|---|---|---|
| 68-82 | `buildPerSubject(sent, subjects)` | ต่อวิชา: หา mark ของแต่ละใบ → ตัด `carried_forward` (ไม่มีใครสอบจริง ต้องไม่ขึ้น 100%) → `pass`, `fail`, `rate`. **`rate: null`** = ไม่มีข้อมูล คนละความหมายกับ `0` (สอบแล้วตกหมด) |
| 87-104 | `buildPerSubjectByStudent(passedByStudent, attemptedByStudent, subjects)` | แบบรวมหลายรอบ นับ **คนละครั้งต่อวิชา** (เคยสอบจริง แล้วเคยผ่านไหม) — `buildPerSubject` นับตามใบ ใช้ได้เฉพาะรอบเดียวที่ 1 คน = 1 ใบ; คนสอบซ้ำ 3 รอบจะนับเกินคนจริง (บั๊กที่เคยเจอ) |

### B3. `buildPassDistribution(sent, subjectIds, roomTotals)` (113-181) — ตาราง "ผ่านกี่วิชา × ห้อง"
- วนทุกใบ: นับต่อห้องว่าส่งกี่คน (`submittedByRoom`); นับว่าผ่านกี่วิชา; เก็บใน `rows: Map<จำนวนวิชาที่ผ่าน, Map<room_id, คน>>`
- `total` = ผลรวมคนทุกห้อง (ตัวหาร)
- `buildRow(label, passed, countOf)` = สร้าง 1 แถว: นับต่อห้อง + `rate2(count, room.total)` + รวมแถว
- วน `n = ทั้งหมด → 0` (ผ่านมาก→น้อย) แถวที่ไม่มีใครก็ยังโชว์ 0
- แถวท้าย `"not_submitted"` = คนทั้งห้อง − คนที่ส่ง → **ยอดรวมทุกแถวเท่าทั้งรุ่นเสมอ**

### B4. `buildFirstAttemptBySubject(sent, subjects, cohortTotal)` (192-257) — ตารางผ่านครั้งแรกรายวิชา
- ตัวหาร = **ทั้งรุ่น** (ต่างจาก `buildPerSubject` ที่หารด้วยคนที่สอบจริง)
- `cohortTotal` เป็น 0 → `null`
- ต่อวิชา: นับ pass/fail จากใบ confirmed ที่ไม่ใช่ carried; `not_submitted = cohort − pass − fail`
- **ยกเศษ rounding ไว้ช่องสุดท้าย:** `notSubmittedRate = round((100 − pass − fail)*100)/100` ผลรวม 3 ช่องจะได้ 100.00 เป๊ะ (ไม่ใช่ 99.99/100.01)
- `sat` = จำนวนคนที่สอบจริง (0 = ไม่มีใครสอบ หน้าจอต้องขึ้นขีดไม่ใช่ 0.00%)
- เฉลี่ย เฉพาะวิชาที่ `sat > 0`
- แถว "รวม" **นับเป็นคน** (`passedAll` = ผ่านครบทุกวิชา) ไม่ใช่บวกคอลัมน์ (บวกคอลัมน์ได้ 156×8 = 1,248 ซึ่งไม่ใช่จำนวนคน)

### B5. กฎ "ผ่านภายในปีแรก" (265-324) — ใช้ร่วมกัน 2 ที่ ให้ตัวเลขตรงกันเสมอ
(1) `buildYearSummary` → การ์ดบน dashboard; (2) `buildFirstYearList` → ไฟล์ส่งออกรายชื่อ
| บรรทัด | ฟังก์ชัน | ทำอะไร |
|---|---|---|
| 280-297 | `addConfirmedRealPasses(passedByStudent, results)` | สะสมวิชาที่ผ่านจริงของแต่ละคนลง `Map<student, Set<subject>>`: ข้าม draft และข้ามใบที่ไม่ approved; ข้ามวิชาไม่ผ่านและ **ข้าม carried_forward** (บั๊ก B1: ถ้านับแถวยกมา ใบรอบ 2 ที่ยืนยันจะทำให้ "ผ่านวิชา A" ทั้งที่ใบต้นทางถูกตีกลับ) เรียกซ้ำทีละรอบเพื่อสะสมทั้งปี |
| 301-315 | `getRequiredSubjectIds(firstRound, allSubjects)` | วิชาที่ต้องผ่านครบ = วิชาของรอบแรก (ไม่มีรอบแรก/ไม่เหลือวิชา = ทุกวิชา) |
| 318-324 | `hasPassedAll(passedSet, required)` | `passedSet` ไม่มี = false; วนทุกวิชาที่ต้องผ่านต้องอยู่ใน Set |

### B6. `buildStats(roundId)` (327-438) — `GET /api/dashboard/stats`
| บรรทัด | ทำอะไร |
|---|---|
| 329-333 | เลือกรอบ (ระบุ / default); ไม่พบ → 404 |
| 335-343 | `Promise.all` ดึง 6 อย่างพร้อมกัน (ไม่รอทีละอัน): total, pending, eligible, subjects, results, eligibleStudents |
| 346-347 | วิชาเฉพาะรอบนี้ (`subjectsOfRound`) |
| 349-353 | `sent` → `confirmed` → `perSubject`, `fullyPassed` (จากใบ confirmed) |
| 357-366 | `subjectPassRate`: รวม pass/marks ข้ามวิชาที่มีคนสอบจริง |
| 372-387 | วนนักศึกษาที่เปิดสิทธิ์: ผ่านครบทุกวิชาของรอบแล้วหรือยัง (`subjectIds.length > 0` กัน `[].every`) → ยังไม่ผ่าน = `canSubmit` + `canSubmitIds`; ผ่านแล้ว = `alreadyPassedStudentIds` (หน้าคิวตรวจใช้ตัดออกจากแท็บ "ยังไม่กรอก") |
| 393-395 | `roundPeople` = `Set` ของ (คนที่กรอกได้ + คนที่มีใบในรอบ) → `roundTotal` ฐานของโดนัท/แถบความคืบหน้าของมุมมองรายรอบ (รอบ 2+ คนผ่านครบแล้วไม่ต้องอยู่ในตัวหาร) |
| 397-437 | คืน object: round (มีวันที่ + `phase`), `total`, `pending_accounts`, `eligible`, `canSubmit`, `alreadyPassedStudentIds`, `by` (นับสถานะ), `not_started = max(total − results, 0)`, `roundTotal`, `roundNotStarted`, `roundFillRate`, `submitted`, `fillRate`, `fullyPassed`, `fullyPassedRate` (หารทั้งรุ่น), `passRateOfSitters` (หารเฉพาะที่ยืนยันแล้ว — คนละตัวหาร ต้องติดป้ายชัด), `perSubject` |

### B7. `buildYearSummary(year, allSubjects)` (443-643) — สรุปทั้งปี
นับ **"รายคน"** ไม่ใช่รายใบ (นักศึกษาคนเดียวกรอกได้หลายรอบ)
| ช่วง | ทำอะไร |
|---|---|
| 444-453 | ดึงรอบของปี + total/pending/eligible/roomTotals พร้อมกัน |
| 455-482 | ตัวสะสม: `everSubmitted`, `everStarted` (รวม draft), `roomOfStudent`, `passedByStudent`, `passedByStudentConfirmed`/`attemptedByStudentConfirmed` (สำหรับ perSubject), `latestPaperOf`, และข้อมูลรอบแรก |
| 485-546 | วนทุกรอบ: `sent/counted/confirmed`; `addConfirmedRealPasses`; จดใบล่าสุดต่อคน (รอบเรียงใหม่→เก่า ใบแรกที่เจอ = ล่าสุด); เก็บข้อมูลรอบ `attempt_number === 1`; สะสม passed/attempted ต่อคนจากใบ approved; `roundSummaries.push` |
| 549-557 | `requiredSubjectIds` + `fullyPassedStudents` = คนที่ `hasPassedAll` (รวมผลทุกรอบ) |
| 560-576 | `byRoom`: ต่อห้อง — ส่งกี่คน, ผ่านครบกี่คน, `passRate` หารทั้งห้อง |
| 582-588 | `firstAttemptPassed` = `countFullyPassed(รอบแรก confirmed, วิชารอบแรก)` |
| 590-605 | `passDistribution`, `firstAttemptBySubject` (ถ้ามีรอบแรก) |
| 611-612 | `statusByStudent` = นับสถานะจาก **ใบล่าสุดของแต่ละคน** (ไม่บวก `by` ของแต่ละรอบ — จะนับคนที่กรอก 2 รอบสองครั้งแล้ว % เกิน 100) + `not_started = total − จำนวนคนที่มีใบ` → 5 ช่องบวกกันได้ `total` |
| 614-642 | คืน: total, pending, eligible, submitted, started, statusByStudent, fullyPassed, fillRate/passRate (`rate2` หารทั้งรุ่น), **`firstAttempt`** (ร้อยละผ่านครั้งแรก), **`firstYear`** (ร้อยละผ่านภายในปีแรก), passDistribution, firstAttemptBySubject, rounds, byRoom, perSubject |

### B8. Export อื่น ๆ
| บรรทัด | ฟังก์ชัน | ทำอะไร |
|---|---|---|
| 646-649 | `buildYearStats(year)` | ห่อ `buildYearSummary` ให้ PDF ใช้ |
| 652-664 | `buildHistory(yearCount = 3)` | ปีล่าสุด N ปี (`years.slice(0, N)`) วน `buildYearSummary` ทีละปี |

### B9. `buildAlerts(role)` (666-782) — แจ้งเตือนของเจ้าหน้าที่ (คำนวณสด ไม่เก็บ DB)
**ทำไมไม่เก็บ DB:** เป็น "สถานะ ณ ตอนนี้" ไม่ใช่เหตุการณ์ — เก็บแล้วต้องมีตัวรันอัปเดตและจะมีแจ้งเตือนเก่าที่ไม่จริงค้าง
| บรรทัด | ทำอะไร |
|---|---|
| 675-687 | `ictDayNumber(date)` = วันที่ (นับเป็นจำนวนวัน) ตามเวลาไทย: `floor((ms + 7h)/วัน)` ไม่ใช้ `setHours` (ใช้ timezone เครื่อง); `daysUntil` = ผลต่างจำนวนวัน → รอบปิด 23:59 วันนี้ไม่เหลือ "0 วัน" ตั้งแต่เช้า |
| 687 | `CLOSING_SOON_DAYS = 7` |
| 700-727 | วนรอบ `open`: `left < 0` → `round_overdue` (เลยกำหนด แต่ยังเปิดอยู่); `left <= 7` → `round_closing` ("วันนี้เป็นวันสุดท้าย" เมื่อ 0) |
| 730-748 | ใกล้ปิด (0-7 วัน): `buildStats` ของรอบนั้น `missing = roundNotStarted + by.draft` ถ้า > 0 → `not_submitted` (ฐาน = roundTotal คนที่ต้องกรอกจริง) |
| 755-777 | **เฉพาะ officer:** ดู **ทุกรอบ** (ไม่ใช่เฉพาะรอบเปิด — ใบค้างตรวจของรอบเก่าต้องไม่ถูกลืม) นับ `submitted` (รอตรวจ) → `pending_review` |
| 782 | `{ alerts }` — แต่ละอันมี `key`, `type`, `tone`, `icon`, `title`, `detail` |

### B10. ส่วนรายชื่อสำหรับ PDF/Excel
| บรรทัด | ฟังก์ชัน | ทำอะไร |
|---|---|---|
| 785-810 | `buildStudentRows(roundId)` | รายชื่อในรอบ: นับผ่านเฉพาะวิชาของรอบนี้ (ตัวหารตรงกับที่ต้องกรอก) |
| 813-819 | `paperStatusLabel` | สถานะใบเป็นไทย (ไม่มีใบ → "ยังไม่ได้กรอก") |
| 823-838 | `studentContactColumns(student)` | แถวข้อมูลติดต่อ (ไม่มีเลขบัตร) |
| 846-895 | `buildFirstAttemptList(year, wantPassed)` | **กฎเดียวกับ `firstAttempt.passed` เป๊ะ:** หารอบ 1 (ไม่มี → 404); `resultOf` Map; สำหรับนักศึกษาทั้งรุ่น: `counted` (ส่งแล้ว+ไม่ตีกลับ — โชว์ผลให้เห็นแม้รอตรวจ) แต่ `passedAll` ต้อง `approved` + ผ่านครบ; `if (passedAll !== wantPassed) continue`. "ไม่ผ่าน" = ทั้งรุ่นที่ไม่เข้าเงื่อนไข → **ผ่าน + ไม่ผ่าน = ทั้งรุ่นเสมอ** |
| 904-968 | `buildFirstYearList(year, wantPassed)` | 4 ขั้น: (1) ดึงรอบ/นักศึกษา/วิชา (ไม่มีรอบ → 404); (2) วนทุกรอบ `addConfirmedRealPasses` + จดใบล่าสุด; (3) `requiredSubjectIds` + Map id→รหัสวิชา; (4) ตัดสินทีละคนด้วย `hasPassedAll` เก็บเฉพาะกลุ่มที่ขอ + รายชื่อรหัสวิชาที่ยังไม่ผ่าน |

---

## C. `dashboard.controller.js`

| บรรทัด | ทำอะไร |
|---|---|
| 225-242 | `getStats` — `buildStats(req.query.round_id)`; ถ้า `role === "executive"` ทำสำเนา (`{...stats}`) แล้ว `delete data.alreadyPassedStudentIds` (รหัสรายคน ผู้บริหารเห็นแค่ภาพรวม; ไม่แก้ object ที่ service สร้าง) |
| 246-254 | `getHistory` — `years = Number(query.years) \|\| 3` แล้วหนีบ 1-10 ด้วย `Math.min(Math.max(...))` |
| 259-266 | `getAlerts` — ส่ง `req.user.role` ให้ service |
| 269-287 | `exportReport` (PDF รอบ): `buildStats` → `Promise.all([buildStudentRows, buildYearStats])` → header → `buildReportPdf(stats, rows, res, yearStats)` |
| 291-295 | `badRequest` |
| 299-320 | `readListExportQuery(query)` → `{year (2400-2700), wantPassed ("true"/"false"), format ("xlsx" default / "pdf")}` ผิด → 400 |
| 324-337 | `listColumns(statusHeader, failedHeader)` — 12 คอลัมน์ Excel |
| 340-348 | `withRowNumbers` — ใส่ `no` ลำดับ (ก๊อปแถว ไม่แก้ของเดิม) |
| 351-357 | `setPdfHeaders` — filename ASCII สำรอง + `filename*=UTF-8''` |
| 361-398 | `exportFirstAttempt` — อ่าน query → `buildFirstAttemptList` → PDF (`buildPassListPdf` + หมายเหตุสำหรับกลุ่มไม่ผ่าน) หรือ Excel (`buildXlsx`) |
| 403-440 | `exportFirstYear` — เหมือนกัน แต่ใช้ `buildFirstYearList` |

---

## D. `dashboard.pdf.js` — วาดรายงาน PDF

### `buildReportPdf(stats, rows, res, yearStats)` (18-309)
| บรรทัด | ทำอะไร |
|---|---|
| 1-14 | import pdfkit + ชิ้นส่วนใน `utils/pdfReport.js`; `STATUS_TH` แปลสถานะเป็นไทย |
| 21-24 | `new PDFDocument({A4, margin 40, bufferPages})`, ฟอนต์ไทย, `pipe(res)` |
| 29-43 | หัวรายงาน (ชื่อรายงาน, คณะ+รอบ, วันเวลาที่ออก) |
| 46-95 | "สรุปภาพรวม": array `summary` ของคู่ `[ป้าย, ค่า]`; ค้างร่างโชว์เมื่อ > 0; ผ่านครบ โชว์ทั้ง % ทั้งรุ่น และ % ของผู้ที่ยืนยันแล้ว (`—` ถ้ายังไม่มีใบยืนยัน ไม่ใช่ 0%); วนเขียนทีละบรรทัด ที่ไม่พอขึ้นหน้าใหม่; หมายเหตุ "ผ่านนับเฉพาะใบที่ยืนยัน" และจำนวนใบรอตรวจ; หมายเหตุคนที่ผ่านครบก่อนรอบนี้ |
| 98-126 | "ตัวเลขสำหรับรายงานสภาการพยาบาล": ผ่านครั้งแรก + ผ่านภายในปีแรก พร้อมตัวหาร |
| 131-207 | ตารางผ่านครั้งแรกรายวิชา: ความกว้างรวมต้อง = 500 พอดี (ไม่ล้นขอบ); `cell` ใส่ `—` ถ้า `sat === 0`; แถวรวมนับเป็นคน; `drawTable` มี `groups` หัว 2 ชั้น (สอบผ่าน/สอบไม่ผ่าน × จำนวน/ร้อยละ) |
| 210-254 | ตาราง "ผ่านกี่วิชา × ห้อง": ความกว้างคอลัมน์คำนวณ `floor((500−120)/(ห้อง+1))`; ตัดแถวว่างออกจาก PDF; ท้ายตารางเป็นหมายเหตุ |
| 257-277 | ตารางอัตราผ่านรายวิชา (`rate === null` → `—`) |
| 280-301 | หน้าใหม่: รายชื่อนักศึกษาในรอบ (สถานะแปลไทยผ่าน `STATUS_TH[...] ?? ดิบ`) |
| 304-308 | ช่องลงนาม + เลขหน้า + `doc.end()` |

### `buildPassListPdf({label, subtitle, note, total, rows, res})` (319-365)
PDF รายชื่อผ่าน/ไม่ผ่าน (ครั้งแรก/ภายในปีแรก) รูปแบบเดียวกับ `students.pdf.js`: หัว → สรุป (`จำนวน N จาก total (ร้อยละ x.xx)` ด้วย `toFixed(2)`) + หมายเหตุ → ตารางรายชื่อ 7 คอลัมน์ (ความกว้างรวม 500) → เลขหน้า
