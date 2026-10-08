# Frontend 07 — เจ้าหน้าที่: รายชื่อนักศึกษา (`officerStudentsReal.jsx`, 543 บรรทัด)

หน้า "ข้อมูลนักศึกษา" ของ officer (มี prop `readonly` สำหรับโหมดอ่านอย่างเดียว — ซ่อนปุ่มแก้ทั้งหมด)
backend: `GET /students`, `GET /exam-results`, `PATCH /students/bulk-eligible`, `DELETE /students/:id[?delete_results=true]`, `POST /students/bulk-delete`, `POST /students/:id/reset-password`, `POST /students/export`, `GET /students/export-subject`, `GET /dashboard/export-first-attempt` (ดู backend [05](../backend/05-students-repository-และ-controller.md), [06](../backend/06-students-export.md))

> **หน้านี้ทำการ "join" ฝั่ง client**: ดึงนักศึกษากับผลสอบมาแยกกัน แล้วจับคู่ในหน้าจอ (ไม่มี endpoint รวม)

---

## Props (22)
`go`, `setSel` (เลือกนักศึกษาส่งให้หน้า detail), `setDetailFrom`, `toast`, `readonly`, `lang`, `initialFilter` (ตัวกรองที่ Dashboard ส่งมาตอนคลิก), `onInitialFilterConsumed` (แจ้ง parent เคลียร์), `onBackToDashboard`

## State (24-57)
| ตัวแปร | เก็บอะไร |
|---|---|
| `students`, `rooms` | ข้อมูลที่ join แล้ว / รายชื่อห้อง |
| `loading`, `error` | สถานะโหลด |
| `q`, `status`, `room`, `year`, `eligible` | ตัวกรองหลัก (ค้นหา/สถานะ/ห้อง/ปี/สิทธิ์) — ค่าเริ่ม `'ALL'` |
| `subjectFilter` | `{subjectCode, passed, subjectFullName, roundId, year}` กรองรายวิชา — **มาจากการคลิก "ผ่าน/ไม่ผ่าน" ในการ์ดที่ Dashboard เท่านั้น** (ไม่มี dropdown ให้เลือกเอง); ตั้งค่าเริ่มด้วย **lazy init** `useState(() => ...)` จาก `initialFilter` (ไม่ต้อง `setState` ใน effect); `roundId = null` = "รวมทั้งปี" |
| `firstAttemptFilter` | `{year, passed}` กรอง "ผ่าน/ไม่ผ่านครั้งแรก" จากปุ่มใน Dashboard |
| `returnView` | วิดเจ็ตเดิมของ Dashboard (ปี/แท็บ) เก็บไว้ให้ปุ่ม "กลับไปแดชบอร์ด" (เก็บแยกจาก filter เพราะผู้ใช้เคลียร์ filter แล้วปุ่มกลับยังต้องอยู่) |
| `page`, `selected` (`Set` ของ `student_id` ที่ติ๊ก), `saving` | แบ่งหน้า (`per = 10`) / ที่เลือก / กำลังบันทึก |
| `deleting`, `bulkDeleteOpen`, `resetting`, `resetNationalId`, `resetError`, `exportingStudents` | state ของ modal ลบ/ลบหลายคน/รีเซ็ตรหัส และการส่งออก |

## โหลดข้อมูล (59-127)
- (59-63) `useEffect([])` — ถ้ามี `initialFilter` แค่แจ้ง parent เคลียร์ทิ้ง (กันคลิกลิงก์เดิมซ้ำจาก history) — `subjectFilter` อ่านค่าไปแล้วตอน init
- (65-127) **`Promise.all([GET /students, GET /exam-results])`** แล้ว join:
  - สร้าง 3 `Map`: `latestByStudent` (ใบล่าสุด — `findAll` ฝั่ง backend เรียง `submitted_at` ใหม่→เก่าอยู่แล้ว จึงใบแรกที่เจอ = ล่าสุด), `round1ByStudent` (ใบของรอบที่ 1 — "ผ่านครั้งแรก" ต้องดูเฉพาะรอบแรก ไม่ใช่ใบล่าสุด), `allResultsByStudent` (ทุกใบ — `subjectFilter` ต้องเช็คใบของรอบที่ Dashboard กำลังดูจริง ใช้แค่ล่าสุดไม่พอ)
  - `setStudents(studentList.map(...))` สร้าง object ต่อคน: ชื่อ/ห้อง/ปี/สิทธิ์, `status` (map ผ่าน `STAFF_STATUS_TO_BADGE`; ไม่มีใบ = `'DRAFT'`), `passedCount`, `subjectCount` (ตัวหาร = วิชาที่ใบนั้นเก็บจริง บางรอบสอบไม่ครบ), `allPass`, `allResults` (มี `academicYear` + `carriedForward` ต่อวิชา — ไม่งั้น "รวมทั้งปี" กรองปีไม่ได้ และนับคนที่ยกผลมาเป็น "สอบจริง" ผิด), `firstAttempt` (`{year, passed (every), confirmed}`)
  - `rooms` = `[...new Set(... .filter(Boolean))]` ห้องที่ไม่ซ้ำ

## การกรอง (129-168)
- `searchText = q.replace(/\s+/g, '').toLowerCase()` ตัดช่องว่างทั้งสองฝั่งก่อนเทียบ (เดิมพิมพ์เว้นวรรคแล้วไม่เจอ เพราะชื่อกับนามสกุลต่อกันไม่มีช่องว่าง) และไม่สนตัวพิมพ์
- `filtered = students.filter(s => {...})` ทำทีละเงื่อนไข `return false` ถ้าไม่ตรง:
  - สถานะ/ห้อง/ปี/สิทธิ์ ตรง ๆ
  - **`subjectFilter` — ต้องใช้กฎ "เดียวกันเป๊ะ" กับ `dashboard.service.js`** (ไม่งั้นตัวเลขบนการ์ดกับจำนวนคนในลิสต์ไม่ตรง — เคยเจอบั๊ก 2 รอบ: รอบแรกเช็คแค่ผลล่าสุดไม่กรองรอบ/ปี; รอบสอง "รวมทั้งปี" เช็คทุกปีและใช้ `.some()` แยกอิสระ ทำให้คนที่ตกแล้วสอบแก้ตัวผ่านยังติดลิสต์ "ไม่ผ่าน" — 57 คนหลุดเข้ามาทั้งที่การ์ดบอก 5):
    1. `relevant` = ใบของรอบที่ระบุ (`roundId`) หรือใบของ**ปีที่กำลังดู** (ไม่ใช่ทุกปี)
    2. `approved` = เฉพาะที่ยืนยันแล้ว
    3. `sitReal(sub)` = รหัสตรงวิชา **และไม่ใช่ `carriedForward`**
    4. `everPassed` / `everAttempted` ด้วย `.some()` ซ้อน
    5. ไม่เคยสอบจริง → ตัดออก (`return false`); **เคยผ่านสักครั้ง = ผ่านเสมอ** (ชนะการตกก่อนหน้า) ต้อง `=== subjectFilter.passed`
  - `firstAttemptFilter`: ต้องมีใบรอบ 1 ของปีนั้น + **ยืนยันแล้ว** + `passed` ตรง
  - ค้นหา: `` `${firstName}${lastName}${sid}`.toLowerCase().includes(searchText) ``
- (163-166) `pages = ceil(filtered.length / per)`; **`safePage = Math.min(page, Math.max(pages - 1, 0))`** กันหน้าค้างเกินช่วงเมื่อลบคนสุดท้ายของหน้าสุดท้าย; `pageRows = filtered.slice(...)`
- (168) `useEffect(() => setPage(0), [ตัวกรองทั้งหมด])` เปลี่ยนตัวกรอง → กลับหน้า 1
- (171) `years` = ปีที่มีจริง `[...new Set(...)].sort((a,b) => b - a)` ใหม่→เก่า

## เลือก/สิทธิ์ (173-210)
- `allFilteredSelected = filtered.length > 0 && filtered.every(s => selected.has(s.sid))`
- `toggleOne(sid)` — functional update: `new Set(prev)` copy แล้ว `next.has(sid) ? next.delete(sid) : next.add(sid)`
- `toggleAllFiltered` — ติ๊กทั้งที่ **ถูกกรองอยู่ทั้งหมด** (ไม่ใช่แค่หน้าปัจจุบัน — เปิดสิทธิ์ทั้งรุ่นได้ทีเดียว): ถ้าติ๊กครบแล้ว → เอาที่กรองออกทั้งหมด; ไม่งั้นรวม `new Set([...prev, ...filtered.map(s => s.sid)])`
- `setEligibilityFor(ids, value)` — `PATCH /students/bulk-eligible {student_ids, exam_eligible}`; **อัปเดตตารางในหน้าเลย** (ไม่ reload ทั้งชุด): `prev.map(s => touched.has(s.sid) ? {...s, eligible: value} : s)`; ล้างที่เลือก; toast

## ลบ/รีเซ็ต (211-271)
- `confirmDelete` — `withResults = deleting.status !== 'DRAFT'` มีผลสอบ → ต่อ `?delete_results=true` (ผู้ใช้เห็นคำเตือนแรงใน modal แล้ว; ไม่ส่ง backend ตอบ 409); สำเร็จ → เอาออกจาก state
- `confirmBulkDelete` — body `{ student_ids, ...(bulkWithResults > 0 ? { delete_results: true } : {}) }` (spread แบบมีเงื่อนไข); ใช้ `data.deleted_ids` จาก backend อัปเดตตาราง (ตาม backend จริง ไม่ใช่ที่ขอ)
- `confirmReset` — ตรวจ `/^\d{13}$/` ก่อน (UX; backend ตรวจซ้ำ) → `POST /students/:id/reset-password {national_id}` (รีเซ็ต = กรอกเลขบัตรเดิมซ้ำ)

## ส่งออก (273-312)
- `subjectExportItems` — เมื่อมี `subjectFilter` สร้างรายการ PDF/Excel ด้วย `.map` → `downloadFile('/students/export-subject?subject_code=..&passed=..&round_id|year=..&format=..')`
- `exportStudents(byRound)` — `POST /students/export` body `{student_ids: filtered.map(...), by_round?}` (**ส่งรายชื่อรหัสที่กรองอยู่** ไม่ต้องเขียนตัวกรองซ้ำที่ backend; ไฟล์ไม่มีเลขบัตร); `studentExportItems` 2 แบบ: ปกติ / แยกรอบ (หลายชีต)
- `toggleOneEligibility(s)` — กลับค่าสิทธิ์รายคน

## JSX (314-543)
- early return: โหลด → `<SkeletonTable>`; error
- **หัวหน้า:** "แสดง N จาก M คน" (+ "ทั้งหมด X คน" เมื่อกรองอยู่) — รูปแบบนี้ตรงกับที่เทส e2e และคู่มือใช้อ่านหา; ปุ่ม "กลับไปแดชบอร์ด" (`returnView`); `ExportMenu` (ซ่อนเมื่อ `readonly`)
- แถบ chip "ตัวกรองรายวิชา/ครั้งแรก" (สีเขียว=ผ่าน, แดง=ไม่ผ่าน) + ปุ่มล้างตัวกรอง + `ExportMenu` ของชุดนั้น
- **แถบตัวกรอง:** ช่องค้นหา + `<Select>` 4 ตัว
- **แถบจัดการ** (โผล่เฉพาะเมื่อติ๊ก `selected.size > 0` และไม่ `readonly`): ลบ / ถอนสิทธิ์ / เปิดสิทธิ์
- **ตาราง:** `<tbody key={[ตัวกรอง...].join('|')}>` — key เปลี่ยนตามตัวกรอง/หน้า ให้แถวทั้งชุดเล่นแอนิเมชันไล่โผล่ใหม่ (ไม่ใส่ `q` ใน key เพราะจะกะพริบทุกตัวอักษรที่พิมพ์); แถวคลิกได้ → `setSel(s); setDetailFrom('students'); go('detail')`; `<td onClick={e => e.stopPropagation()}>` ที่ช่องติ๊ก/ปุ่ม กันคลิกทะลุไปเปิดรายละเอียด; checkbox มี `aria-label`
- ปุ่มรายแถว: รีเซ็ตรหัส / ถอนสิทธิ์ (เฉพาะที่มีสิทธิ์) / ลบ (ลบได้ทุกคนรวมที่มีผลสอบ — modal เตือนแรง + backend บังคับค่ายืนยัน)
- 3 Modal: ลบ 1 คน (เตือนแดงถ้ามีผลสอบ), ลบหลายคน (`tone="danger"` + เตือนจำนวนคนที่มีผลสอบ), รีเซ็ตรหัส (ช่องเลขบัตร `autoFocus`)
