# Backend 08 — Certificates (ไฟล์หลักฐาน PDF/JPG/PNG)

โฟลเดอร์: `backend/src/modules/certificates/`
ไฟล์: `certificates.repository.js` (57), `certificates.controller.js` (372)
ด่านรับไฟล์ (multer): `middlewares/upload.js` — [เอกสาร 01](01-แกนกลาง-server-config-middleware-utils.md)

> **กฎเหล็ก:** ไฟล์จริงอยู่บน disk (`uploads/certificates/`) ใน DB เก็บแค่ `file_path` **ห้ามเก็บ binary ใน DB**
> **ลำดับการอัปโหลด:** multer เขียนไฟล์ลง disk ก่อน → controller ตรวจหลายด่าน → ถ้าพังที่ใดให้ **ลบไฟล์ทิ้ง** ไม่ให้ค้างบน disk

---

## `certificates.repository.js`

| บรรทัด | ทำอะไร |
|---|---|
| 2 | import `lockExamResultRow` จาก examResults (ใช้ล็อกใบเดียวกัน — ดูแนวคิด row lock ใน [07](07-examResults-ผลสอบ.md)) |
| 5-8 | `CERTIFICATE_TYPE` = `exam_result` (ใบผลสอบ) / `license` (ใบประกอบวิชาชีพ) |
| 10-11 | `findById` |
| 23-37 | `createWithLock(data, checkBeforeSave)` — `$transaction`: (25) ล็อกแถวใบผลสอบ; (27-33) อ่านสถานะใบ + **นับไฟล์ที่มีอยู่ตอนถือล็อก** (นับแม่นเสมอ คนอื่นแนบแทรกไม่ได้); (34) เรียก `checkBeforeSave(current, fileCount)` ของ controller (throw = ยกเลิกทั้งก้อน); (36) `certificate.create`. ทำให้กดแนบพร้อมกัน 10 ไฟล์ จะเข้าแถวทีละไฟล์และได้แค่ 5 |
| 43-57 | `removeWithLock(certificate_id, result_id, checkBeforeSave)` — ล็อก → อ่านใบ → `checkBeforeSave(current)` → `deleteMany` (ใช้ `deleteMany` ไม่ใช่ `delete` เพื่อให้ไฟล์ที่ถูกลบไปแล้ว (กดลบ 2 แท็บ) ได้ `count = 0` แทน error) → คืน `count` |

---

## `certificates.controller.js`

### ค่าคงที่ + ตัวช่วย (1-148)
| บรรทัด | ทำอะไร |
|---|---|
| 1-6 | import `fs/promises`, `path`, repo ของ certificates/examResults/students, `findSubmittableRound` |
| 9-13 | `httpError` |
| 16 | `MAX_FILES_PER_RESULT = 5` ต่อใบ |
| 24-28 | `FILE_SIGNATURES` — **magic bytes** (ไบต์ต้นไฟล์ที่บอกชนิดจริง): PDF `%PDF-` = `25 50 44 46 2D`, JPG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A` (นามสกุลและ mimetype ที่ browser บอกปลอมได้ทั้งคู่) |
| 31-35 | `CONTENT_TYPE_OF` — แปลงชนิดไฟล์ → Content-Type ตอนเปิดไฟล์ |
| 38-47 | `discard(file)` — ลบไฟล์ที่เพิ่งอัปโหลดทิ้ง; `try/catch` กันลบไม่สำเร็จ (Windows เปิดค้าง) แล้ว request ค้าง |
| 50-54 | `tooManyFilesError` |
| 57-92 | `detectFileType(filePath)` — `Buffer.alloc(8)` + `fs.open` อ่าน 8 ไบต์แรก (หัวไฟล์ยาวสุดคือ PNG = 8) ใน `try/finally` ปิด handle เสมอ; วน `FILE_SIGNATURES`: ไฟล์สั้นกว่าหัวไฟล์ → ข้าม; เทียบทีละไบต์ ต้องตรงทุกตัว; ตรง → คืนชนิด; ไม่ตรงอะไรเลย → `null` |

### ช่วงผ่อนผัน (94-129)
| บรรทัด | ทำอะไร |
|---|---|
| 99 | `EVIDENCE_GRACE_MINUTES = 15` — ผ่อนผัน **แนบไฟล์เพิ่ม** 15 นาทีหลังปิดรอบ (เพราะหน้าจอส่งผลก่อนแล้วอัปโหลดไฟล์ตามทีละไฟล์ คนกดส่งนาทีสุดท้ายไฟล์อาจถึงหลังปิด) ลบไฟล์ไม่ได้รับผ่อนผัน |
| 103-129 | `isInEvidenceGrace(examResult)` ต้องครบ: ใบยัง `pending`; มี `round`; **ส่งผลก่อน/ตรงเวลาปิด** (ส่งหลังปิดไม่เข้าข่าย); **ตอนนี้เลยเวลาปิดแล้ว** (ยังไม่ปิด = ไม่ใช่เรื่องผ่อนผัน); **ไม่เกิน graceEnd** (`close + 15*60*1000` ms) |

### `ensureCanChangeEvidence(examResult, user, isAdding)` (137-185)
ตรวจว่านักศึกษา "เปลี่ยนเอกสาร" ของใบนี้ได้ไหม — กฎเดียวกันทั้งแนบและลบ
| ข้อ | ตรวจ | ผล |
|---|---|---|
| 1 | `examResult.student_id !== user.studentId` | 403 — กันเดา id ไปแตะใบคนอื่น |
| 2 | หา student; ไม่เจอ 404; `exam_eligible` false → 403 | ผู้ถูกถอนสิทธิ์เปลี่ยนเอกสารไม่ได้ |
| 3 | ใบ `approved` | 409 — ล็อกหลักฐานหลังเซ็นรับรอง |
| 4 | `findSubmittableRound(student)`: ต้อง `submittable.round.round_id === examResult.round_id` | ใบต้องอยู่ใน "รอบที่ส่งผลได้ตอนนี้" (รอบเปิดอยู่ หรือรอบล่าสุดที่ใบถูกตีกลับ) — กันใบตีกลับของรอบเก่าถูกสลับหลักฐานทีหลัง |
| 5 | ไม่ใช่รอบที่ส่งได้ แต่ `isAdding` และ `isInEvidenceGrace` | ยอมให้ผ่อนผัน |
| สรุป | ไม่ใช่ทั้ง 4 และ 5 | 409 "รอบนี้ปิดรับแล้ว" |
ด่านเหล่านี้ตรวจ **ก่อน** ล็อก; สถานะ approved ตรวจซ้ำ **ระหว่างถือล็อก** อีกชั้น

### `upload` (246-327) — `POST /api/exam-results/:id/certificates`
| บรรทัด | ทำอะไร |
|---|---|
| 250 | `saved = false` — ธงว่าบันทึกแถวลง DB แล้ว (ถ้า `false` ตอน catch = ลบไฟล์บน disk ทิ้งทุกกรณี; แทนที่จะลบทีละจุดแล้วตกหล่น) |
| 252-254 | ไม่มี `req.file` → 400 |
| 257-264 | `certificate_type` ต้องอยู่ใน `Object.values(CERTIFICATE_TYPE)` |
| 266-269 | หาใบ (404) |
| 273 | `ensureCanChangeEvidence(examResult, req.user, true)` |
| 276-282 | `detectFileType` ดูเนื้อไฟล์จริง ไม่ใช่ PDF/JPG/PNG → 400 |
| 285 | `Buffer.from(originalname, "latin1").toString("utf8")` — multer อ่านชื่อไฟล์เป็น latin1 ชื่อไทยเพี้ยน ต้องแปลงกลับ |
| 287 | `path.relative(cwd, req.file.path).split(path.sep).join("/")` เก็บ path แบบ `/` เสมอ ไม่ผูก Windows |
| 293-303 | `checkBeforeSave(current, fileCount)` รันระหว่างถือล็อก: ใบหาย 404; `approved` 409; `fileCount >= 5` → `tooManyFilesError` |
| 307-316 | `createWithLock({result_id, certificate_type, file_name, file_path, file_type}, checkBeforeSave)` — `file_type` = ชนิดจริงจากหัวไฟล์ |
| 318-319 | `saved = true` แล้วตอบ |
| 320-326 | `catch`: ถ้า `!saved` → `discard(req.file)` แล้ว `next(err)` |

### `remove` (331-382) — `DELETE /api/certificates/:id` (นักศึกษาลบเอง)
หาไฟล์ (404) → หาใบ (404) → `ensureCanChangeEvidence(..., false)` (ไม่ผ่อนผัน) → `removeWithLock` (ลบแถวใน DB ก่อนระหว่างถือล็อก) → `count === 0` → 404 → **ลบไฟล์บน disk ภายหลัง** ใน `try/catch` (ลบ disk ก่อนแล้ว DB พัง = แถวชี้ไฟล์ที่ไม่มีอยู่; ลบ disk ล้มไม่ตอบ error เพราะแถวหายไปแล้วจริง) ผลลัพธ์พร้อมกันกับผู้ตรวจที่กดยืนยัน: ได้อย่างใดอย่างหนึ่งเท่านั้น ไม่มี "ยืนยันแล้วแต่ไฟล์ที่ผู้ตรวจเห็นหาย"

### `serveFile` (387-429) — `GET /api/certificates/:id/file`
| บรรทัด | ทำอะไร |
|---|---|
| 387 | `CAN_VIEW_OTHERS_FILES = ["officer","reviewer"]` — คนที่ต้องตรวจใบจริง (executive เข้าไม่ได้) |
| 392-398 | หาไฟล์ → หาใบ |
| 400-404 | `isOwner` (เจ้าของใบ) หรือ `isStaff` ไม่ใช่ทั้งคู่ → 403 (กันเดา id ดูไฟล์คนอื่น) |
| 408-411 | `contentType` จาก `file_type`; ไฟล์เก่าก่อนรองรับรูป/ค่าไม่รู้จัก = PDF |
| 413-419 | `path.resolve(file_path)`; ตั้ง `Content-Type` และ `Content-Disposition: inline; filename*=UTF-8''...` (ชื่อไทย) |
| 420-425 | `res.sendFile(path, callback)`: ไฟล์หายจาก disk → `next(404)` (เช็ค `!res.headersSent` ก่อน กันตอบซ้ำ) |
