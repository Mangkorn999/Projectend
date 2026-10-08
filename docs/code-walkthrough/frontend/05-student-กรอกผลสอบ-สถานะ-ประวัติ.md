# Frontend 05 — หน้านักศึกษา: เกริ่นกรอกผล, ฟอร์มกรอกผล+แนบไฟล์, สถานะ, ประวัติ

ไฟล์ (`frontend/src/design/`): `student.jsx` (579 — ใช้จริงเฉพาะ `FormIntro`), `examFormReal.jsx` (656), `studentStatusReal.jsx` (142)
ข่าวสาร (`newsReal.jsx`) อยู่ [frontend 06](06-news-ข่าวสาร.md)
backend ที่เกี่ยวข้อง: `GET /rounds/active`, `GET /exam-results/me`, `POST /exam-results`, `POST /exam-results/:id/certificates`, `DELETE /certificates/:id` (ดู backend [07](../backend/07-examResults-ผลสอบ.md), [08](../backend/08-certificates-ไฟล์หลักฐาน.md))

> **กฎ:** หน้าจอไม่คำนวณ ผ่าน/ไม่ผ่าน, สิทธิ์ หรือรอบที่กรอกได้เอง — **ถาม backend** แล้วแสดงผลตามที่ได้ (backend เช็คซ้ำทุกครั้งเป็นด่านจริง)

---

## 1. `student.jsx` — ไฟล์เก่าจากต้นแบบ (prototype)

ไฟล์นี้เป็น **ต้นแบบหน้าจอที่ใช้ข้อมูลปลอม** (`ROUNDS`, `NEWS`, `SUBJECTS`, `ME` จาก `data.jsx`) ตอนนี้ระบบจริงใช้เพียง **`FormIntro`** (import ใน `app.jsx` บรรทัด 14) ส่วนที่เหลือถูกแทนที่แล้ว:

| คอมโพเนนต์ในไฟล์ | สถานะ | ตัวจริงที่ใช้แทน |
|---|---|---|
| `StudentNews` (11) | เลิกใช้ (mock) | `StudentNewsReal` (newsReal.jsx) |
| **`FormIntro`** (89) | **ใช้จริง** | — (อธิบายด้านล่าง) |
| `ExamForm` (198) + `ExamToggle/Cards/Checklist` (337-418) + `LegendRow` | เลิกใช้ (mock 3 สไตล์ฟอร์ม ตามแผง Tweaks) | `ExamFormReal` |
| `UploadSlots` (421) | เลิกใช้ (สุ่มขนาดไฟล์ปลอมด้วย `Math.random()`) | แนบไฟล์ใน `ExamFormReal` |
| `StudentStatus` (469), `StudentHistory` (545) | เลิกใช้ (mock) | `StudentStatusReal`, `StudentHistoryReal` |

> ถ้ากรรมการถามว่าทำไมมีโค้ด mock อยู่: เป็นเศษจากการออกแบบ UI ก่อนต่อ backend (เหลือไว้ไม่ลบเพื่อกันกระทบ แต่ไม่ได้ถูกเรียกใช้)

### `FormIntro({ go, lang })` (89-195) — หน้าเกริ่นก่อนกรอกผลสอบ
**จุดประสงค์:** ถาม backend ก่อนว่า "รุ่นฉันกรอกได้ไหม" แล้วบอกเหตุผลตั้งแต่หน้านี้ (เดิมชวนกด "เริ่มกรอก" ทุกคน แล้วค่อยเจอว่ากรอกไม่ได้ เสียไป 1 หน้า)
| บรรทัด | อธิบาย |
|---|---|
| 90 | `tt = (key, vars) => t(lang, key, vars)` — ตัวแปลย่อ (ตัวแปรเทมเพลต `{attempt}` ใส่ผ่าน `vars`) |
| 91-98 | state: `loading`, `round`, `blocked` (เหตุผลที่กรอกไม่ได้; `''` = กรอกได้), `blockedSub` (คำอธิบายเสริม), `allPassed` (ผ่านครบแล้ว → พาไปดูสถานะแทนบอกให้รอ), `fixingRejected` (แก้ใบตีกลับ) |
| 100-145 | `useEffect([])` เรียก `GET /rounds/active` แล้ว **เรียงเงื่อนไขตามลำดับ** (เจอข้อไหนก่อน `return` ข้อนั้น): (103) `null` → ไม่มีรอบเปิด; (106) `can_fix_rejected === true` → โหมดแก้ใบตีกลับ ตั้ง round; (114) `phase === 'scheduled'` → บอก**วันที่เปิด** (`toLocaleDateString(lang==='EN'?'en-GB':'th-TH', {...})`) ดีกว่า "ไม่มีรอบ"; (125) `expired` → หมดเวลา; (132) `closed` → ปิดแล้ว; (138) `all_passed` → ผ่านครบ; ไม่งั้น `setRound`. `.catch`: 403 (ยังไม่มีสิทธิ์) backend ส่งข้อความไทยมาแล้ว โชว์ตรง ๆ (`e instanceof ApiError`); `.finally` ปิด loading |
| 147-149 | `closeText` วันปิดรอบ ถ้ามี `round?.close_date` (`cond ? x : ''`) |
| 151-195 | JSX 3 กรณี: กำลังโหลด / **blocked** (ไอคอน+เหตุผล+ปุ่มกลับไปข่าว หรือถ้า `allPassed` ปุ่มไปสถานะ) / **กรอกได้** (ปุ่ม "เริ่มกรอกผลสอบ" → `go('form')`; บอกจำนวนวิชา `round.subjects?.length ?? 8`; โหมดแก้ใบตีกลับเปลี่ยนข้อความเป็น "แก้ไขผลสอบ") |

---

## 2. `examFormReal.jsx` — ฟอร์มกรอกผลสอบรายวิชา + แนบไฟล์ (หน้าสำคัญที่สุดของนักศึกษา)

### กติกาที่หน้านี้ต้องรักษา
- กรอกได้เมื่อ: รอบของรุ่นเปิดรับ (`phase === 'active'`) + มีสิทธิ์ — ยกเว้นใบที่ถูกตีกลับ แก้ส่งใหม่ได้แม้รอบปิด (`can_fix_rejected`)
- แนบไฟล์ PDF/JPG/PNG ได้ **สูงสุด 5 ไฟล์ ไฟล์ละไม่เกิน 10 MB** (ค่าอยู่ `evidenceFiles.js` ตรงกับ backend) — **ต้องแนบ ≥ 1 ไฟล์ทุกครั้ง**
- **ลำดับการส่งสำคัญ** (เพราะ backend ให้แนบ/ลบไฟล์เฉพาะตอนรอบเปิด หรือใบยังถูกตีกลับ):
  - ใบใหม่: ① `POST /exam-results` (ได้ `result_id`) → ② อัปโหลดไฟล์ทีละไฟล์
  - ใบเดิม: ① ลบไฟล์ที่กด "นำออก" → ② อัปโหลดไฟล์ใหม่ → ③ `POST /exam-results`
    (ถ้าส่งผลก่อน ใบที่ถูกตีกลับจะกลับเป็น "รอตรวจ" แล้วถ้ารอบปิดไปจะแนบไฟล์ไม่ได้อีก)

### ค่าคงที่ (26-28)
`TYPE_EXAM_RESULT='exam_result'`, `TYPE_LICENSE='license'` — **ต้องตรงกับค่าที่ backend รับ**ใน `certificate_type`

### state (30-54)
| ตัวแปร | เก็บอะไร |
|---|---|
| `subjects`, `round` | วิชาของรอบ (จาก `/rounds/active` มี `already_passed` ต่อวิชา) |
| `blocked`, `blockedSub` | เหตุผลที่กรอกไม่ได้ |
| `existing` | ใบของรอบนี้ที่ส่งไปแล้ว (แก้ทับได้จนกว่าจะถูกยืนยัน) |
| `results` | `{ [subject_id]: true \| false }` คำตอบ |
| `keptFiles` | ไฟล์เดิมของใบที่ยังเก็บ (ข้อมูลจาก backend) |
| `removedFiles` | ไฟล์เดิมที่กด "นำออก" — **ลบจริงตอนกดส่ง** (กดยกเลิกได้จนกว่าจะส่ง) |
| `newFiles` | `[{ file, type }]` ไฟล์ที่เพิ่งเลือก — อัปโหลดตอนกดส่ง |
| `fileErrors` | ไฟล์ที่แนบไม่ได้ + เหตุผลรายไฟล์ |
| `loading`, `loadError`, `submitting`, `submitError` | สถานะโหลด/ส่ง/ข้อผิดพลาด |
| `answersAlreadySent` | คำตอบ (เป็น JSON string) ที่ **ส่งสำเร็จแล้วแต่แนบไฟล์ไม่ครบ** — กดส่งซ้ำถ้าคำตอบเดิมแค่แนบไฟล์ที่ค้าง ไม่ส่งผลซ้ำ (ถ้ารอบปิดระหว่างนั้น การส่งผลซ้ำจะถูกปฏิเสธทั้งที่ผลส่งแล้ว) |

### ตัวช่วยข้อความ/ค้นหา (56-90)
- `messageOf(error)` — `ApiError` → ข้อความไทยจาก backend; อื่น → ข้อความกลาง
- `findPaperOfRound(papers, roundId)` — วนหาใบของรอบ (ไม่เจอ `null`)
- `showRoundBlocked(activeRound)` — เลือกข้อความตาม `phase` (scheduled พร้อมวันที่ / expired / อื่น = closed)

### `prepareForm(activeRound)` (93-145) — เตรียมฟอร์ม
1. ไม่มีรอบ → blocked
2. รอบไม่ `active` และไม่มี `can_fix_rejected` → `showRoundBlocked` จบ
3. ตั้ง `round`, `subjects`; `all_passed` → blocked "ผ่านครบ"
4. `GET /exam-results/me` หาใบของรอบนี้; ถ้า `approved` → blocked "ยืนยันแล้ว แก้ไม่ได้" (pending/rejected ยังแก้ได้; backend เช็คซ้ำตอนส่ง)
5. รอบไม่เปิดแล้ว → แก้ได้เฉพาะใบ `rejected`
6. มีใบเดิม: `setExisting`, `setKeptFiles(paper.certificates)`, **เติมคำตอบเดิมกลับฟอร์ม** (ข้ามแถว `carried_forward` — ไม่ใช่คำตอบของนักศึกษา)

### โหลดตอนเปิดหน้า (148-161)
`useEffect([])`: `GET /rounds/active` → `prepareForm`; `.catch`: `ApiError` (เช่น 403) = เหตุผลที่กรอกไม่ได้ ไม่ใช่ระบบพัง → `setBlocked(e.message)`; อื่นๆ → `loadError`

### `reloadPaperFiles(stillToRemove)` (165-190)
หลังส่งล้มกลางทาง ดึงใบนี้ใหม่ให้ตรงของจริง: ไฟล์ที่เพิ่งอัปโหลดสำเร็จย้ายมาอยู่ "ไฟล์เดิม" ยกเว้นไฟล์ที่ยังรอลบ (ซ่อนไว้); `try/catch` ดึงไม่ได้ก็ไม่เป็นไร

### แยกวิชา + นับความคืบหน้า (194-231)
- แยกเป็น `toAnswer` (ต้องกรอก) กับ `passedBefore` (`already_passed` — backend เติม "ผ่าน" ให้เอง)
- วนนับ `filledCount`, `passCount`, `failCount` จาก `results[subject_id]` (`=== true/false`)
- `allAnswered = filledCount === toAnswer.length`
- `totalFiles`, `hasAttachment`, `filesFull`, `fixingAfterClose = round.phase !== 'active'`
- `setAnswer(id, passed)` — functional update สร้าง object ใหม่ `{...previous}` (React ห้ามแก้ state ตรง)

### จัดการไฟล์ (233-331) — เขียนแบบ loop ธรรมดา ไม่ chain
| ฟังก์ชัน | ทำอะไร |
|---|---|
| `addFiles(fileList)` | ตรวจ **ทีละไฟล์**: `fileKindOf` = '' → ชนิดผิด; `file.size > MAX*1024*1024` → ใหญ่เกิน; `countAfterAdd >= MAX` → เกินจำนวน; ผ่าน → ใส่ `accepted`. ไฟล์ใหม่ทุกไฟล์เริ่มที่ประเภท "ใบรายงานผลสอบ" ผู้ใช้เปลี่ยนที่แถวได้. ที่ไม่ผ่านบอกเหตุผลรายไฟล์ใน `fileErrors` (ไม่ล้มทั้งชุด) |
| `changeNewFileType(i, type)` | สร้าง array ใหม่ เปลี่ยนเฉพาะ index i |
| `removeNewFile(i)` | เอาออกจากรายการ (ยังไม่ได้อัปโหลด ไม่ต้องบอก backend) |
| `removeKeptFile(cert)` | **ไม่ลบจริง** ย้ายไป `removedFiles` รอลบตอนกดส่ง |
| `undoRemove()` | คืนไฟล์เดิมทั้งหมด — ถ้ารวมกับไฟล์ใหม่แล้วเกิน 5 ให้เอาไฟล์ใหม่ออกก่อน (แจ้ง error) |
| `deleteRemovedFiles()` | `while` ลบทีละไฟล์ `DELETE /certificates/:id`; ล้ม → เก็บคิวที่เหลือ + ข้อความ + `{ok:false, stillToRemove}`; สำเร็จทั้งหมด `{ok:true}`. `stillToRemove.shift()` เอาออกจากคิวเมื่อลบสำเร็จ |
| `uploadNewFiles(resultId, resultsSent)` | `while` อัปโหลดทีละไฟล์ด้วย **`FormData`** (`form.append('file', file)`, `form.append('certificate_type', item.type)`) → `POST /exam-results/:id/certificates` (apiFetch ไม่ตั้ง Content-Type เองเมื่อเป็น FormData ให้ browser ใส่ boundary); ล้มกลางทาง → เก็บเฉพาะไฟล์ที่ยังไม่ได้อัปโหลด (กดส่งซ้ำไม่อัปซ้ำ) + ข้อความต่างกันตาม `resultsSent` ("ส่งผลสอบแล้ว แต่แนบไฟล์ไม่สำเร็จ" ไม่ให้ผู้ใช้เข้าใจว่าผลยังไม่ถูกส่ง) |

### `submit` (363-419) — กดส่ง
| บรรทัด | อธิบาย |
|---|---|
| 364-366 | `submitting=true`, ล้าง error |
| 369-372 | สร้าง `subjectResults` เฉพาะวิชา `toAnswer` `{subject_id, is_passed}` |
| 376-380 | `answersText = JSON.stringify(subjectResults)`; `sameAnswersAlreadySent` = คำตอบชุดนี้เคยส่งสำเร็จแล้ว |
| 383-398 | **ใบเดิม:** ลบไฟล์ที่นำออก (ล้ม → reload แล้ว `return`) → อัปโหลดไฟล์ใหม่ (ล้ม → reload แล้ว `return`) → ถ้าคำตอบไม่ใช่ชุดที่ส่งแล้ว `POST /exam-results` |
| 399-411 | **ใบใหม่:** `POST /exam-results` ได้ `created.result_id` → อัปโหลดไฟล์; ล้ม → `setAnswersAlreadySent(answersText)` จำไว้ + reload (ครั้งถัดไปเป็นการแก้ใบเดิม ไม่สร้างใบซ้ำ) |
| 412-413 | สำเร็จ → toast + `go('status')` |
| 414-418 | `catch` ข้อความ error; `finally` `setSubmitting(false)` |

### JSX (421-634)
- early return: `loading` → `<Loading>`; `loadError`; `blocked` (การ์ดกลางจอไอคอน info + เหตุผล + คำอธิบาย)
- `submitLabel` เลือกตามสถานะ: กำลังส่ง / ส่งใหม่ (rejected) / แก้ไข (มีใบเดิม) / ส่ง
- การ์ดแจ้งเตือนบนหัว: ใบ **rejected** (แถบแดง + เหตุผล `existing.remark` + ถ้ารอบปิดแล้วเตือนให้รีบส่ง), ใบ **pending** (แถบเหลือง "แก้ไขได้จนกว่าเจ้าหน้าที่จะยืนยัน")
- **การ์ดผลรายวิชา:** `subjects.map` แต่ละแถว — วิชา `already_passed` ขึ้นป้าย "ผ่านแล้วจากรอบก่อน" (ไม่มีปุ่ม พื้นเทา); ไม่งั้นปุ่ม segmented ผ่าน/ไม่ผ่าน (`className={answer === true ? 'on pass' : ''}`)
- `<style>` ในไฟล์: `.exam-subject-row` (flex-wrap ปุ่มลงบรรทัดใหม่บนจอแคบ), `.seg`, `.evidence-row`
- **การ์ดแนบไฟล์:** `keptFiles` + `newFiles` แสดงด้วย `EvidenceRow` (ไฟล์ใหม่มี `<Select>` เลือกประเภทเอกสาร); ไม่มีไฟล์ = กล่องขอบประแจ้ง; ไฟล์ที่นำออกแสดงแถบเหลือง + ปุ่ม "ยกเลิกการนำออก"; **`<input type="file" multiple accept={EVIDENCE_ACCEPT}>`** ซ่อนไว้ใน `<label className="btn">` (กดปุ่ม = เปิดตัวเลือกไฟล์); `onChange` เรียก `addFiles` แล้ว `e.target.value = ''` (ให้เลือกไฟล์เดิมซ้ำได้หลังกดนำออก); `fileErrors` แสดงใน `role="alert"`
- **การ์ดความคืบหน้า (sticky):** โดนัท ผ่าน/ไม่ผ่าน/ยังไม่กรอก, ข้อความ error การส่ง; **ปุ่มส่ง `disabled={!allAnswered || !hasAttachment || totalFiles > MAX || submitting}`**

### `EvidenceRow` (638-656)
แถวไฟล์ 1 ไฟล์: ไอคอนตามชนิด (รูป = ฟ้า, PDF = แดงอ่อน) + ชื่อ (ตัดด้วย `…` ด้วย `minWidth:0` ไม่ดันปุ่มให้ล้นจอมือถือ) + รายละเอียด + `typeControl` (ถ้ามี) + ปุ่มนำออก; ไฟล์ใหม่ขอบประ (`is-new`)

---

## 3. `studentStatusReal.jsx` — สถานะล่าสุด + ประวัติ (142 บรรทัด)
ทั้ง 2 หน้าใช้ `GET /exam-results/me` (backend เรียง `submitted_at` ใหม่→เก่าอยู่แล้ว)

| บรรทัด | อธิบาย |
|---|---|
| 12 | `STAFF_STATUS_TO_BADGE` map: `pending→SUBMITTED`, `approved→CONFIRMED`, `rejected→REJECTED` (ชื่อของ `StatusBadge`) |
| 14-21 | **custom hook `useMyResults()`** — ดึงผลของตัวเอง คืน `{results, error}` (null = กำลังโหลด) ใช้ร่วม 2 หน้า ไม่ก๊อปโค้ด |
| 23-106 | **`StudentStatusReal`**: error/กำลังโหลด/ไม่มีผลเลย (`<Empty>` + ปุ่มประวัติ); `latest = results[0]`; `passed`/`total` นับจาก `subject_results`; `timeline` 3 ขั้น (ส่งผล → ตรวจสอบ → ยืนยัน/ตีกลับ) แต่ละขั้นมี `done/active/rejected` คำนวณจาก `status`; การ์ดสถานะ (แถบสีซ้ายตามสถานะ + เหตุผลตีกลับ `latest.remark` + โดนัทผ่าน/ทั้งหมด); การ์ดสรุปรายวิชา (`gridTemplateColumns: 'minmax(0, 1fr)'` ไม่ใช่ `1fr` — `1fr` ขยายตามความกว้างขั้นต่ำของเนื้อหา ชื่อวิชา nowrap ยาวดันการ์ดกว้างกว่าจอมือถือ เคยวัด 774px บนจอ 390px); timeline แนวตั้ง (วงกลม+เส้นเชื่อม) |
| 108-141 | **`StudentHistoryReal`**: ตารางทุกรอบ (รอบ, วันที่ส่ง, ผ่าน N/ทั้งหมด — สีเขียวถ้าผ่านครบ, สถานะ); `overflowX:'auto'` ตารางเลื่อนแนวนอนบนมือถือ |
