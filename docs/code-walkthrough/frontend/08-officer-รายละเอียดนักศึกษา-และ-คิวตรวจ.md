# Frontend 08 — เจ้าหน้าที่/ผู้ตรวจ: คิวตรวจสอบ + รายละเอียดนักศึกษา (ยืนยัน/ตีกลับ)

ไฟล์ (`frontend/src/design/`): `officerReviewReal.jsx` (216), `studentDetailReal.jsx` (596)
backend: `GET /exam-results[?round_id|student_id|staff_status]`, `PATCH /exam-results/:id/{approve|reject|reopen}`, `GET /students/:id`, `PATCH /students/:id`, `GET /certificates/:id/file` (ดู backend [07](../backend/07-examResults-ผลสอบ.md), [08](../backend/08-certificates-ไฟล์หลักฐาน.md))
**Role:** officer ใช้ทั้งสองหน้า (`canEdit` + `canReview`); reviewer ใช้ได้เฉพาะ `canReview` (ไม่แก้ข้อมูลนักศึกษา, ไม่เห็นแท็บ "ยังไม่กรอก"); executive เข้าไม่ได้ (backend 403)

---

## 1. `officerReviewReal.jsx` — คิวตรวจสอบ

**ทำงานทีละ "รอบ" เสมอ** (เลือกจาก dropdown) — ถ้ารวมทุกรอบ คนที่ถูกตีกลับรอบเก่าจะปนกับคิวรอตรวจรอบปัจจุบัน และเลข badge ไม่ตรงกับ Dashboard
**4 แท็บ:** รอตรวจสอบ (`SUBMITTED`) / ตีกลับ (`REJECTED`) / ยืนยันแล้ว (`CONFIRMED`) / ยังไม่กรอก (`NOT_STARTED` — นักศึกษารุ่นเดียวกับรอบ เปิดสิทธิ์แล้ว ยังไม่มีใบในรอบนี้ **และยังไม่เคยผ่านครบมาก่อน**)

### ค่าคงที่ (21-26)
- `STAFF_STATUS_TO_TAB` map `pending/approved/rejected` → ชื่อแท็บ
- `TABS`, `PER_PAGE = 10`
- `defaultRound(rounds)` — รอบที่เปิดรับ ถ้าไม่มีใช้รอบล่าสุด (`rounds.find(r => r.status==='open') || rounds[0]`; backend เรียงใหม่→เก่าแล้ว)

### state และ props
| ตัวแปร | อธิบาย |
|---|---|
| `restoreView` | ตำแหน่ง (แท็บ/รอบ/หน้า) ที่ฝากไว้ตอนกดเข้ารายละเอียด — กลับมาแล้วอยู่ที่เดิม (อ่านครั้งเดียวแล้ว `onRestoreConsumed`) |
| `canSeeNotStarted = role !== 'reviewer'` | reviewer ไม่มีแท็บ "ยังไม่กรอก" และไม่เรียก `/dashboard/stats` (เรียกแล้วได้ 403) |
| `tab` (lazy init) | เริ่มจาก `restoreView?.tab \|\| 'SUBMITTED'`; role ที่ไม่มีแท็บนั้นตกกลับ `SUBMITTED` |
| `page`, `rounds`, `roundId`, `results`, `alreadyPassedIds`, `students`, `subjects`, `loading`, `error` | ข้อมูล/สถานะ |

### โหลดข้อมูล
1. (51-61) `useEffect([])`: **`Promise.all`** `/rounds`, `/students`, `/subjects` (ไม่เปลี่ยนตามรอบ โหลดครั้งเดียว); ตั้ง `roundId` = รอบที่ restore หรือ default
2. (66-85) `useEffect([roundId, canSeeNotStarted])`: ดึงผลสอบเฉพาะรอบที่เลือก `?round_id=` (ให้ backend กรอง) + `/dashboard/stats?round_id=` เพื่อเอา `alreadyPassedStudentIds` (**stats `.catch(() => ({}))` — เป็นของเสริม ล้มก็ต้องไม่ทำให้คิวตรวจทั้งหน้าดับ**); **`dropped` flag** กัน race: สลับรอบไปแล้วก่อน response เก่ากลับมา → ทิ้งผลเก่า ไม่ให้ทับรอบใหม่; cleanup `dropped = true`

### คำนวณ (88-145)
- `selectTab`, `selectRound` — เปลี่ยนแล้ว `setPage(0)` (ไม่งั้นค้างหน้า 5 ของลิสต์ที่มี 2 หน้า)
- early return 4 ชั้น: error → ไม่มีรอบ (`<Empty>`) → ยังไม่มี results → skeleton
- `roundSubjectIds` = `round.subject_ids` ถ้ามีค่า ไม่งั้นวิชาทั้งหมด; `subjectCount` ตัวหาร (รอบอาจสอบไม่ครบทุกวิชา — ไม่ใช่ 8 ตายตัว)
- **`notStarted`** = `students.filter(ปีตรงรอบ && exam_eligible && !submittedIds.has(id) && !alreadyPassedSet.has(id))` (reviewer = `[]`) — `Set` ทำให้ `.has` เร็ว
- `counts` นับแท็บละกี่รายการ (badge เลขบนแท็บ)
- `rows` = `results.filter(แท็บตรง).map(...)`: **ส่ง `resultId` ไปด้วย** (ไม่งั้นหน้า detail จะเดาใบล่าสุดของคนนั้นแทนใบที่กด); `passedCount` นับเฉพาะวิชาของรอบนี้ (ผลที่ copy-forward อาจมีวิชานอกรอบติดมา); `reviewer: r.confirmer`; แล้ว `rows.forEach(r => { r.allPass = ... })`
- `showReviewer` = แท็บ CONFIRMED/REJECTED (แท็บรอตรวจยังไม่มีผู้ตรวจ)
- `list`, `pages`, `safePage` (บีบหน้าให้อยู่ในช่วง), `pageRows`
- `openDetail(row)`: `setSel(row)`, `setDetailFrom('review')`, **`onLeave({tab, roundId, page})`** ฝากตำแหน่ง, `go('detail')`

### JSX
- หัวหน้า: `<Select>` เลือกรอบ (ป้าย "รอบ n/ปี" + ต่อท้ายเมื่อเปิดอยู่)
- ปุ่มแท็บ + badge เลข; แท็บ "ยังไม่กรอก" มี `title` (tooltip) บอกว่าคนที่ผ่านครบแล้วไม่ถูกนับ
- ตาราง: `NOT_STARTED` = 3 คอลัมน์ (คน/ห้อง/ปี); แท็บอื่น = คน/ห้อง/ผ่าน N/ทั้งหมด/จำนวนไฟล์/วันที่ส่ง (+ ผู้ตรวจ/วันที่ตรวจ ถ้าตรวจแล้ว) + ปุ่ม "ตรวจสอบ"; `<tbody key={`${roundId}|${tab}|${safePage}`}>` ให้แถวเล่นแอนิเมชันใหม่ทุกครั้งที่เปลี่ยน
- `<Pagination>` ท้ายการ์ด

---

## 2. `studentDetailReal.jsx` — รายละเอียดผลสอบนักศึกษา 1 คน + ตรวจ/ยืนยัน/ตีกลับ

**แสดงผลสอบ "ทุกรอบ"** ที่นักศึกษาคนนี้เคยส่ง เป็นบล็อกคลิกสลับได้ฝั่งขวา (ข้อมูลมีอยู่แล้วจาก `/exam-results?student_id=` ไม่ต้องยิง API เพิ่ม)
- `canEdit` = เห็นปุ่มแก้ข้อมูล/ลบ/แก้ไขผลการตรวจ; `canReview` = เห็นปุ่มยืนยัน/ตีกลับ (แยก flag เพราะ reviewer ต้องการ canReview แต่ไม่เอา canEdit)

### ค่าคงที่ (17-20)
- `REVIEW_LOG_LABEL` map `action` ใน `review_logs` (`approved/rejected/revoked/reopened`) → key ข้อความ
- `STAFF_STATUS_TO_BADGE`

### state (22-47)
`subjects`, `results` (ทุกรอบ ใหม่→เก่า), `selectedId` (result_id ของรอบที่ดู), `studentFull` (`GET /students/:id` เต็ม ไว้ prefill ฟอร์มแก้), `rooms`, `loading`, `error`, `reject`, `remark`, `deleteOpen`, **`nowMs = useState(() => Date.now())`** (จับ "ตอนนี้" ครั้งเดียวตอนเปิดหน้า — เรียก `Date.now()` ตรง ๆ ระหว่าง render ผลไม่นิ่ง), `reopenOpen`/`reopenRemark`, `busy`, `editOpen`/`editForm`/`editSaving`/`editError`, `preview {url, filename, kind, detail}`, `previewRejecting`, `previewLoadingId`

### ดูไฟล์หลักฐาน (49-61)
- `openPreview(certificate, kind, detail)` — `fetchAuthedObjectUrl('/certificates/:id/file')` → blob URL → เปิดใน modal (ดูในหน้าเดิม ไม่เปิดแท็บใหม่); `previewLoadingId` กันกดซ้ำ + สปินเนอร์
- `closePreview` — `URL.revokeObjectURL` คืน memory

### `load(keepResultId)` (65-90) — โหลดข้อมูลทั้งหมด
`Promise.all` 4 อย่าง: `/subjects`, `/exam-results?student_id=`, `/students/:id`, `/rooms`; เลือกใบที่ดู: **ใบที่กำหนด (`keepResultId` หลังตรวจ/409) → ใบที่กดมาจากคิว (`student.resultId`) → ใบล่าสุด** (`(picked || resultList[0])?.result_id ?? null`); `useEffect(load, [student.sid, student.resultId])`

### ค่าคำนวณ (92-104)
- `examResult` = ใบที่เลือก; `status`
- `roundSubjectIds` — วิชา **ของรอบนั้น** (ตัวหาร; เคยขึ้น "ผ่าน 2/8" ในรอบที่สอบ 3 วิชา)
- `passedCount`, `allPass`
- `hasEvidenceFile` — ใบไม่มีไฟล์ **ยืนยันไม่ได้** (backend 409) → ปิดปุ่มยืนยัน ให้ตีกลับเพื่อให้แนบ

### `review(action, reasonText)` (106-155) — ยืนยัน/ตีกลับ
| ขั้น | อธิบาย |
|---|---|
| 108 | `reviewingId` จำใบที่ตรวจไว้ก่อน — โหลดใหม่แล้วกลับมาเปิดใบเดิม |
| 113-124 | **แนบ "ลายนิ้วมือ" ของใบที่ผู้ตรวจเห็น**: `expected_submitted_at` + `expected_certificate_ids` (วนเก็บ id ไฟล์ทุกไฟล์ที่แสดงอยู่) + `remark` (เมื่อ reject) — backend เทียบกับของจริงใต้ row lock ถ้านักศึกษาแก้/เพิ่ม/ลบไฟล์ระหว่างที่ผู้ตรวจเปิดค้างไว้ → **409** (กันยืนยันใบที่ไม่ใช่ใบที่ดูจริง) |
| 126-137 | `PATCH /exam-results/:id/{approve|reject}`; สำเร็จ → **`window.dispatchEvent(new Event('review-changed'))`** บอก `app.jsx` นับ badge "รอตรวจ" ใหม่ทันที (ไม่งั้นเลขค้างจนเปลี่ยนหน้า); toast; `load(reviewingId)` ดึงสถานะล่าสุดจาก backend (ไม่เชื่อ state เดิมที่เดาเอง); `return true` |
| 138-151 | `catch`: **409** → โชว์ข้อความ backend, ปิดหน้าต่างที่เปิดค้าง (`closePreview`, `setReject(false)`), ยิง event, reload ใบเดิม (ผู้ตรวจเห็นของล่าสุดก่อนตัดสินอีกครั้ง; `remark` ที่พิมพ์ไม่ล้าง ใช้ซ้ำได้); อื่น ๆ → toast; `return false` |
| 152-154 | `finally` ปลด busy |

### อื่น ๆ
- `reviewFromPreview(action)` — ยืนยัน/ตีกลับจากใน modal ดูไฟล์ ใช้ `review()` ตัวเดียวกัน (กฎ/API เดียวกัน); สำเร็จปิด modal; `previewFooterExtra` คำนวณความสูงที่ footer เพิ่มขึ้น หักออกจากกรอบไฟล์ (ใช้ CSS custom property `--preview-footer-extra`)
- `reopen()` — `PATCH /exam-results/:id/reopen {remark}` ("แก้ไขผลการตรวจ": ใบยืนยันแล้ว/ตีกลับ → กลับเป็นรอตรวจ; ต้องมีเหตุผล); อยู่ใบเดิม
- `roundWarn` (IIFE) — `'closed'` (รอบปิด/เลยกำหนด) / `'soon'` (< 3 วัน) / `null`: ตีกลับหลังปิดรอบทำได้ (นักศึกษาแก้ใบตีกลับได้) แค่บอกให้รู้; "แก้ไขผลการตรวจ" ใบกลับเป็นรอตรวจซึ่งนักศึกษาแก้เองได้เฉพาะตอนรอบเปิด → เตือน
- `removeStudent()` — ลบ (มี `hasResults` → `?delete_results=true`), สำเร็จ `go(backTo)` (คนนี้ไม่อยู่แล้ว); error ปลด `busy` เองเพราะ modal ยังเปิด
- `openEdit()` — prefill `editForm` จาก `studentFull`
- `submitEdit()` — `PATCH /students/:id` (แปลง `room_id`, `academic_year` เป็น Number); **`setStudentFull(prev => ({ ...prev, ...updated }))` รวมของเดิมไว้** (PATCH ตอบแถวดิบไม่มี `academic_year_derived`/`exam_result_count` ที่ GET คำนวณเพิ่ม — ถ้าเขียนทับตรง ๆ ค่าหาย hint ใต้ช่องปีจะขึ้น '—')
- (259-266) `displayName/Room/Year`, **`yearLocked = (exam_result_count ?? 0) > 0`** — ส่งผลสอบแล้วย้ายรุ่นไม่ได้ ปิดช่องปีไว้ + บอกเหตุผล (ดีกว่าให้พิมพ์จนเสร็จแล้วเด้ง error); `hasResults`

### JSX (268-594)
- **หัวหน้า:** breadcrumb ย้อนกลับไปหน้าที่เข้ามา (`backTo`: `review` หรือ `students`); บรรทัดรอง: รหัส/ห้อง/ปี + ชื่ออังกฤษ + เบอร์ + "ใครเปิด/ปิดสิทธิ์ล่าสุด เมื่อไหร่" (`eligible_setter`); ปุ่ม แก้ไข/ลบ (เฉพาะ `canEdit`)
- **ซ้ายบน:** ตารางผลรายวิชา — `subjects.map` แต่ละวิชา หา `r` ใน `examResult.subject_results`; `PassBadge passed={r ? r.is_passed : undefined}` (ไม่มีผล = "ไม่มีข้อมูล")
- **ซ้ายล่าง:** รายการไฟล์หลักฐาน — ไอคอนตามชนิด (`fileKindOf`), ป้าย ประเภทเอกสาร · ชนิดไฟล์ (แปลงเป็นไทยเสมอ ห้ามโชว์ `exam_result`), ปุ่ม "ดู" (สปินเนอร์ระหว่างโหลด)
- **ขวา (aside):**
  - **สถานะการตรวจ** + เหตุผลตีกลับ (ถ้ามี); `canReview && status === 'SUBMITTED'`: ปุ่มยืนยัน (`disabled={busy || !hasEvidenceFile}` + คำอธิบาย) / ตีกลับ; `canEdit && (CONFIRMED||REJECTED)`: ปุ่ม **เดียว** "แก้ไขผลการตรวจ" (ใบที่ตัดสินแล้วต้องกดแก้ก่อนถึงตัดสินใหม่ → ยืนยันซ้ำ/ตีกลับซ้ำไม่ได้)
  - **บล็อกทุกรอบ** คลิกสลับ (`setSelectedId`) — รอบที่เลือกขอบน้ำเงิน; แต่ละอันมีผ่าน N/M + badge สถานะ
  - **ประวัติการตรวจ:** ขั้นแรก "ส่งผลสอบ" + ทุกครั้งใน `review_logs` (action, เวลา, ผู้ตรวจ ด้วย `actorLabel`, เหตุผลในเครื่องหมายคำพูด “ ”); ใบเก่าก่อนมี `review_logs` ใช้แถว "ตรวจสอบ" แบบเดิม — array ของ `[label, detail, icon]` 3 ตัว `.map(([l, d, ic], i) => ...)` (destructure ใน parameter)
- **Modal ตีกลับ:** ต้องมีเหตุผล (`disabled={!remark.trim() || busy}`) + ปุ่ม quick reason 3 อัน (`setRemark(r)`); ตีกลับหลังปิดรอบแสดงกล่องบอกให้รู้
- **Modal ลบนักศึกษา:** เตือนแดงถ้า `hasResults`
- **Modal แก้ไขผลการตรวจ (reopen):** ต้องมีเหตุผล `maxLength={500}` (ตรงกับ backend), ข้อความต่างกันตามสถานะเดิม (`REJECTED`/`APPROVED`), แสดง `roundWarnBox`
- **Modal แก้ข้อมูลนักศึกษา:** ชื่อ/นามสกุล (ไทย/อังกฤษ), อีเมล, เบอร์, ห้อง `<Select>`, **ปีการศึกษาที่จบ** (`type="number"`, `disabled={yearLocked}`, hint บอกค่าที่คำนวณจากรหัส); เตือนเมื่อค่าต่างจากที่คำนวณและพิมพ์ครบ 4 หลัก (กันพิมพ์ผิดแล้วนักศึกษาหายจากรุ่น); แก้ปีแล้วล้าง `editError` เดิม (ไม่งั้นข้อความแดงของค่าก่อนหน้าค้างคู่กับคำเตือนค่าใหม่)
- **Modal ดูไฟล์:** กว้าง 1240 เมื่อเป็น pdf/jpg/png (iframe หรือ `<img>`) ไม่งั้น 560; footer: คำเตือน "ยืนยัน/ตีกลับมีผลทั้งใบ ไม่ใช่เฉพาะไฟล์นี้" เมื่อมีหลายไฟล์, ช่องเหตุผล (เมื่อกดตีกลับ), ลิงก์เปิดแท็บใหม่ (`target="_blank" rel="noreferrer"`), ปุ่มตัดสิน (เงื่อนไขเดียวกับในหน้า); **`.preview-split`** แบ่งซ้ายไฟล์ ขวาผลที่นักศึกษาติ๊ก (เทียบใบกับที่กรอกได้ในจอเดียว ไม่ต้องปิดไปมา)
