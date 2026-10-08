# Backend 05 — Students: repository + controller

โฟลเดอร์: `backend/src/modules/students/`
ไฟล์ในเอกสารนี้: `student.repository.js` (299 บรรทัด), `student.controller.js` (916 บรรทัด)
ไฟล์ส่งออก (`student.export.controller.js`, `students.pdf.js`) อยู่ [เอกสาร 06](06-students-export.md)

> **ภาพรวม flow ของนักศึกษา:**
> 1. เจ้าหน้าที่ **import** รหัส + เลขบัตร ปชช. (CSV/Excel) หรือเพิ่มทีละคน → สร้างแค่แถว `users` (รหัสผ่าน = hash ของเลขบัตร)
> 2. นักศึกษา login ครั้งแรก → ถูกบังคับ **complete-profile** → สร้างแถว `students`
> 3. เจ้าหน้าที่เปิดสิทธิ์ `exam_eligible` → นักศึกษากรอกผลสอบได้

---

## A. `student.repository.js`

| บรรทัด | ฟังก์ชัน | ทำอะไร |
|---|---|---|
| 1-2 | import | `prisma`, `ACTOR_SELECT`, `toActor` |
| 5-12 | `PUBLIC_USER_FIELDS` | field ของ user ที่ส่งออกได้ — **ห้ามมี `password_hash`** |
| 14-21 | `findAll` | นักศึกษาทุกคน + user + faculty + room เรียง ปีจบ (ใหม่ก่อน) แล้วรหัส (ต้องเรียงเอง ไม่งั้น Postgres คืนตามลำดับ disk ซึ่งสลับทุกครั้งที่ UPDATE) |
| 29-69 | `findMatchingSubjectResult({subjectCode, passed, roundId, year})` | นักศึกษาที่ผล **ที่ยืนยันแล้ว (`approved`)** ตรงตามวิชา+ผ่าน/ไม่ผ่าน ใช้ทำ export จากปุ่มบนการ์ดอัตราผ่านรายวิชา. (30-32) ระบุ `roundId` → ดูรอบเดียว, ไม่งั้นรวมทั้งปี. (34-40) ดึงใบทั้งหมดที่เข้าเงื่อนไข + student + subject_results. (42-50) โหมดรอบเดียว: `filter` ใบที่มีวิชารหัสนั้น `is_passed === passed` และ **ไม่ใช่ `carried_forward`** (ยกผลมา ไม่ใช่สอบจริง). (52-68) โหมดทั้งปี: ใช้ `Map` ต่อ `student_id` ยุบหลายรอบเหลือ 1 แถว; `everPassed` = เคยผ่านสักรอบ; เก็บ `submitted_at` ล่าสุด; แล้ว `filter(everPassed === passed)` |
| 70-82 | `findById(id)` | หา 1 คน + user/faculty/room + `eligible_setter` (ใคร เปิด/ปิดสิทธิ์) แปลงด้วย `toActor` ในนี้เลย hash จะไม่หลุดจาก repository |
| 86-90 | `findEligibilityYear` | select แค่ `academic_year` + `exam_eligible` — เบาสุด เพราะกระดิ่งแจ้งเตือน poll ทุก 30 วินาที |
| 93-97 | `bulkSetEligible(ids, value, setBy)` | `updateMany` เปิด/ปิดสิทธิ์หลายคน พร้อมบันทึกผู้ทำ+เวลา |
| 101-111 | `findExistingStudentIds` | กรองรหัสให้เหลือที่มีจริง (loop สร้าง array) — `createMany` แจ้งเตือนที่มีรหัสปลอมแม้ตัวเดียวจะล้มทั้งชุด |
| 113-124 | `findRoleByName`, `findFaculty`, `findAllRooms`, `findRoomById`, `findByPsuId` | query เล็ก ๆ |
| 127-131 | `setPassword(studentId, hash)` | อัปเดต hash ของ user ที่ `psu_passport_id = studentId` (รีเซ็ตรหัส) |
| 136-146 | `createFromImport(...)` | สร้างเฉพาะ `users`: `must_change_password: false` (รหัส = เลขบัตรถาวร), `import_academic_year` (ปีจบที่เจ้าหน้าที่ระบุ null = คำนวณเอง) — ยังไม่มีแถว students |
| 149-181 | `completeProfile(...)` | **nested write** คำสั่งเดียว: `user.update` (ชื่อ/อีเมล/เบอร์) + `student: { create: {...} }` สร้างแถว students พร้อมกัน |
| 185-199 | `updateProfile(student_id, {user, student})` | แก้ทั้งฝั่ง user และ student ใน `update` เดียว: แยก `room_id` ออก (`const { room_id, ...rest }`) เพราะ Prisma ต้องเขียน FK ผ่าน `room: { connect }`; `...(เงื่อนไข ? {...} : {})` = ใส่ key เมื่อเงื่อนไขจริง |
| 203-204 | `countExamResults` | นับใบผลสอบของนักศึกษา |
| 207-217 | `summarizeResults(ids)` | `groupBy` ตาม `student_id` + `_count` → `{studentsWithResults, resultCount}` (`reduce` รวมจำนวน) |
| 224-253 | `removeStudentsCascade(ids)` | ลบนักศึกษา **พร้อมทุกอย่างที่ผูก** ใน `prisma.$transaction([...])` ก้อนเดียว (พังกลางทาง = ย้อนทั้งหมด). ลำดับ ลูก→แม่ (FK): reviewLog → certificate → subjectResult → examResult → notification → student → user. ก่อนลบเก็บ `file_path` ของ certificate ไว้ คืน `{deletedIds, resultCount, filePaths}` ให้ controller ลบไฟล์บน disk **หลัง** DB สำเร็จ (ลบไฟล์ก่อนแล้ว DB พัง = หลักฐานหายทั้งที่ข้อมูลอยู่) |
| 257-262 | `findPendingAccounts` | user role student ที่ `student: null` (import แล้วยังไม่กรอกโปรไฟล์) |
| 267-270 | `removePendingAccounts(psuIds)` | `deleteMany` โดย `where` กันไว้ในตัว: ต้องเป็น student role **และยังไม่มีแถว students** — คนกรอกแล้วไม่ถูกแตะ |
| 276-299 | `findForExport({ids, year})` | `select` เฉพาะ field ที่ส่งออกได้ **ไม่ดึง `national_id`/hash**; ดึงใบผลสอบทุกรอบให้ controller เลือกใบล่าสุดเอง |

---

## B. `student.controller.js`

### B1. ค่าคงที่และตัวตรวจ (บรรทัด 1-59)
| บรรทัด | ทำอะไร |
|---|---|
| 1-9 | import: `fs/promises`, `path`, `bcrypt`, `csv-parse` (`parse`), `iconv-lite` (แปลง encoding ไทย), `readSheet` (อ่าน .xlsx), repository ของ student + notifications, ฟังก์ชันปีจบ |
| 12-16 | `httpError` |
| 18 | `REQUIRED_COLUMNS` = `student_id`, `national_id` |
| 19 | `NATIONAL_ID_PATTERN = /^\d{13}$/` เลขบัตร 13 หลัก |
| 23-24 | `STUDENT_ID_PATTERN = /^\d{10}$/` รหัสนักศึกษา 10 หลัก (ใช้ทั้งเพิ่มทีละคน/import/dry-run กฎตรงกัน) |
| 26 | `SCIENTIFIC_NOTATION_PATTERN` จับรูป `1.23457E+12` ที่ Excel แปลงเลขยาว |
| 27 | `SALT_ROUNDS = 10` |
| 32-41 | `PROFILE_TEXT_FIELDS` — `[field, ป้ายชื่อ, ความยาวสูงสุด]` ของชื่อ/นามสกุล (ไทย/อังกฤษ)/อีเมล/เบอร์; `EMAIL_PATTERN`, `PHONE_PATTERN` |
| 43-59 | `cleanProfileInput(body, requireAll)` — วนทุก field: ข้ามถ้าไม่ส่งและไม่บังคับครบ; ต้องเป็น string ไม่ว่าง; ห้ามยาวเกิน; ตัดช่องว่าง; แล้วตรวจรูปแบบอีเมล/เบอร์. ใช้ร่วม completeProfile (ต้องครบ) กับ update (เฉพาะที่ส่ง) |

### B2. `getAll` (61-68), `getById` (70-113)
- `getAll` ส่งรายชื่อทั้งหมด
- `getById`: ถ้าผู้เรียกเป็น `student` และ `req.user.studentId !== req.params.id` → 403 (**ตรวจเจ้าของข้อมูล**); หา 1 คน; ถ้าผู้เรียกเป็นนักศึกษาตัดข้อมูลผู้เปิดสิทธิ์ทิ้ง (`delete student.eligible_setter` ฯลฯ — ข้อมูลภายในคณะ); ไม่เจอ → 404; คำนวณ `academic_year_derived` (ปีจบตามรหัส) และ `exam_result_count` ฝั่ง server ด้วย `Promise.all` (frontend ห้ามคิดสูตร +4 เอง); ตอบ

### B3. `create` (118-184) — เพิ่มทีละคน
ตรวจเป็น string/ไม่ว่าง → เลขบัตร 13 หลัก → รหัส 10 หลัก → ปีจบ (ถ้าใส่: `validateGraduationYear`; เก็บ `importYear` เฉพาะตอนต่างจากสูตร) → ซ้ำ 409 → หา role student → `createFromImport` (`bcrypt.hash(national_id)` เป็นรหัสผ่าน) → `201`

### B4. `completeProfile` (188-241) — นักศึกษากรอกโปรไฟล์ครั้งแรก
| บรรทัด | ทำอะไร |
|---|---|
| 191-195 | `req.user.studentId` มีค่าแล้ว = กรอกไปแล้ว → 409 |
| 197-200 | `cleanProfileInput(body, true)` + ต้องมี `room_id` |
| 202-214 | หาห้อง (400 ถ้าไม่มี), หา faculty |
| 219-221 | `student_id = req.user.username` (PSU id = รหัสนักศึกษา); `academic_year = account?.import_academic_year ?? calcGraduationYear(student_id)` — **ปีจบกำหนดฝั่ง server เท่านั้น** ไม่รับจาก client (คุมว่าเห็นรอบสอบไหน) |
| 223-237 | `repo.completeProfile` → 201 |

### B5. `update` (244-320) — เจ้าหน้าที่แก้ข้อมูล
หา existing (404) → `cleanProfileInput(body, false)` → ตรวจห้อง → ประกอบ `userData` (ชื่อ/อีเมล/เบอร์) กับ `studentData` (ชื่ออังกฤษ/ห้อง) เฉพาะที่ส่งมา → **เปลี่ยนปีจบ = ย้ายรุ่น** ตรวจเฉพาะตอนปีเปลี่ยนจริง (ฟอร์มส่งปีเดิมมาเสมอ): (1) `validateGraduationYear`; (2) ถ้ามีผลสอบแล้ว (`countExamResults > 0`) ห้ามย้าย — ไม่งั้นตัวหารของรุ่นเดิมลด ตัวตั้งเท่าเดิม สถิติเกิน 100% → `updateProfile`

### B6. `bulkSetEligible` (322-367)
- ตรวจ `student_ids` เป็น array ไม่ว่าง, `exam_eligible` เป็น boolean, ทุก id เป็น string — **สำคัญ:** Prisma ตีความ `{ in: undefined }` ว่า "ไม่มีเงื่อนไข" → `updateMany` จะแก้ทุกแถว (ปิดสิทธิ์ทั้งระบบ) ถ้าลืมตรวจ
- `repo.bulkSetEligible(ids, value, req.user.userId)`
- ถ้า**เปิด**สิทธิ์: สร้างแจ้งเตือน `eligible` แบบ fire-and-forget (`.then().catch()` ไม่ `await` — ล้มก็ไม่ทำให้ request หลักพัง) เฉพาะรหัสที่มีจริง

### B7. ระบบ import — จับคู่คอลัมน์ (369-440)
| บรรทัด | ทำอะไร |
|---|---|
| 374-387 | `COLUMN_FIELDS`, `COLUMN_KEYWORDS` (คำสำคัญไทย/อังกฤษของแต่ละช่อง), `EXACT_NAMES` (ปีจบรับ "ปีการศึกษา" ตรงเป๊ะเท่านั้น กัน "ปีการศึกษาที่เข้า" เข้าใจผิด) |
| 388 | `normalizeHeader` — trim, ตัวเล็ก, ช่องว่าง/ขีด → `_` |
| 392-406 | `guessColumns(headers)` — แต่ละช่อง: ถ้ามีชื่อตรงเป๊ะ ใช้; ไม่งั้นหาที่มีคำสำคัญอยู่ข้างใน; ตัดคอลัมน์ที่ถูกช่องอื่นใช้แล้ว (`used` Set); **ได้พอดี 1 = เลือก; 0 หรือหลาย = `null` (กำกวม ให้เจ้าหน้าที่เลือกเอง ดีกว่าเดาผิดเงียบ ๆ)** |
| 409-428 | `resolveColumns(headers, requested)` — ผสมที่เดา + ที่เจ้าหน้าที่เลือกเอง (เลือกเองชนะ); `""`/null = ไม่ใช้ช่องนี้; คอลัมน์ไม่มีในไฟล์ → 400; 1 คอลัมน์ใช้ได้ช่องเดียว (เช็คด้วย `Set` เทียบจำนวน) |
| 431-440 | `parseMappingParam` — multipart ส่ง mapping เป็นสตริง JSON → `JSON.parse` ใน try/catch |

### B8. ล้างค่าในเซลล์ (442-480)
| บรรทัด | ทำอะไร |
|---|---|
| 450-457 | `plainNumberText` — `"1412.0"` → `"1412"`; `"6.610210001E9"` → `"6610210001"` **เฉพาะเมื่อตัวเลขหลังจุดครบตามเลขชี้กำลังพอดี และไม่เติม 0 เด็ดขาด** (`1.23457E+12` จาก CSV ของ Excel หายไปแล้ว ห้ามเดา — เดาผิด = เลขบัตร/รหัสผ่านผิดคนเงียบ ๆ) |
| 464-477 | `cleanIdText` — แปลงเลขไทย (`๐-๙`) และเลขเต็มความกว้าง (`０-９`) เป็นเลขอารบิก; ผ่าน `plainNumberText`; ถ้าเป็นรูปวิทยาศาสตร์ส่งต่อทั้งอย่างนั้น (ให้ผู้เรียกบอกสาเหตุ); ที่เหลือ **ตัดทุกอย่างที่ไม่ใช่ตัวอักษร/ตัวเลข** (`/[^\p{L}\p{N}]/gu`) — ตัวอักษรไม่ตัด ให้ regex 13 หลักปฏิเสธเอง ("abc123" ไม่เป็น "123" เงียบ ๆ) |
| 480 | `isXlsxFile` — .xlsx คือ zip ขึ้นต้น byte `0x50 0x4B` ("PK") เช็คจากเนื้อไฟล์ ไม่เชื่อนามสกุล |

### B9. อ่านไฟล์ (482-557)
- `rowsFromCsv(buffer)` (483-520): ลอง decode UTF-8 แบบ `fatal: true` (throw ถ้า byte ผิดกฎ) ไม่ผ่านใช้ `iconv.decode(buffer, "win874")` (CSV ไทยจาก Excel). `csv-parse` ตัวเลือก: `columns` ตัดช่องว่างหัวคอลัมน์, `delimiter: [",", ";", "\t"]`, `skip_empty_lines`, `skip_records_with_empty_values`, `trim`, `bom`, `relax_column_count` (แถวยาว/สั้นไม่ล้มทั้งไฟล์). parse พัง → log จริง + ตอบไทย 400
- `rowsFromXlsx(buffer)` (529-557): `readSheet` พร้อม `parseNumber: text => text` (เก็บตัวเลขเป็นข้อความตามไฟล์ ไม่ผ่าน float). **เหตุผลที่รองรับ .xlsx:** Excel บันทึกเลขบัตร 13 หลักลง CSV เป็น `1.23457E+12` หายถาวร แต่ .xlsx เก็บเลขเต็ม. แถวแรก = header; `cellText` แปลงเป็นข้อความ (วันที่/ว่าง = ว่าง); ข้ามแถวว่างท้ายไฟล์; สร้าง object ต่อแถว

### B10. `bulkImport` (561-749) — `POST /api/students/import[?dry_run=true]`
| บรรทัด | ทำอะไร |
|---|---|
| 566 | `dryRun = req.query.dry_run === "true"` (query เป็นสตริงเสมอ) — **dry run = ตรวจอย่างเดียว ไม่บันทึก** หน้าเว็บใช้ทำกล่องสรุปก่อนกดยืนยัน |
| 569-573 | ต้องแนบไฟล์ (multer `memoryStorage` ใส่ `req.file.buffer`) |
| 582-590 | เลือก parser ตามเนื้อไฟล์; ไฟล์ว่าง → 400 |
| 593-606 | `resolveColumns`; ขาดคอลัมน์บังคับ → ตอบ 400 `code: "missing_columns"` พร้อมรายชื่อคอลัมน์ให้หน้าจอทำช่องเลือก |
| 609-614 | ดึง role student ครั้งเดียวนอกลูป |
| 616-623 | `imported`, `skipped`, `yearOverrides`, `seenInFile` (Map: รหัส → เลขแถวแรก จับรหัสซ้ำในไฟล์ — dry run ไม่เขียน DB เช็คซ้ำจาก DB ไม่ได้) |
| 625-726 | **วนทีละแถว ไม่ใช้ transaction เดียว** (แถวเดียวพลาดไม่ล้มทั้งไฟล์). `rowNum = i + 2` (header + นับจาก 1 ตรงกับ Excel). แต่ละแถว: อ่านค่าผ่าน `cleanIdText`/`plainNumberText` → ขาดข้อมูล → เลขบัตรไม่ใช่ 13 หลัก (ถ้าเป็นรูปวิทยาศาสตร์ บอกสาเหตุ Excel ชัด) → รหัสไม่ใช่ 10 หลัก → ซ้ำในไฟล์ → ปีจบ (ผิด = ข้าม; ต่างจากสูตร = เก็บ + ใส่ `yearOverrides`) → มีในระบบแล้ว → ถ้า dry run แค่นับ → ไม่งั้น `createFromImport` ใน `try/catch` (race condition → "บันทึกไม่สำเร็จ") |
| 729-730 | ตัด `yearOverrides` ของคนที่สุดท้ายถูกข้าม (กันกล่องสรุปนับเกิน) |
| 734-745 | ตอบ 200 (dry run) หรือ 201 พร้อมสรุป `{dry_run, imported_count, skipped_count, imported, skipped, year_overrides, columns_used}` |

### B11. ลบนักศึกษา (751-884)
| บรรทัด | ทำอะไร |
|---|---|
| 756-779 | `deleteStudents(res, ids, confirmDeleteResults)` ใช้ร่วมลบเดี่ยว/หลายคน: `summarizeResults`; ถ้ามีคนมีผลสอบ **และยังไม่ยืนยัน** → 409 `code: "has_exam_results"` พร้อมจำนวน (หน้าจอขึ้นเตือนแล้วส่งซ้ำพร้อมยืนยัน); `removeStudentsCascade`; ไม่มีใครถูกลบ → 404; ลบไฟล์ PDF บน disk **หลัง** DB สำเร็จ (`Promise.all` + `fs.rm({force:true})` ล้มไม่ throw แค่ log); ถ้าลบผลสอบด้วย `console.warn("[AUDIT]...")` ลงร่องรอย |
| 782-811 | `bulkRemove` — ตรวจ array ไม่ว่าง สูงสุด `MAX_BULK_DELETE = 1000`; `new Set` ตัดซ้ำ; ถ้า `deleteStudents` ตอบ 409 ไปแล้ว (`!done`) `return` |
| 814-830 | `listPendingAccounts` — บัญชีที่ import แล้วยังไม่กรอกโปรไฟล์ พร้อมปีจบที่จะใช้ + `year_overridden` |
| 835-861 | `removePendingAccounts` — ลบเฉพาะบัญชีที่ยังไม่มีโปรไฟล์ (repository กันใน where); `count === 0` → 404; ตอบ `deleted_count`, `skipped_count` |
| 866-884 | `remove` — ลบทีละคน ใช้ `?delete_results=true` เป็นการยืนยัน |

### B12. `resetPassword` (888-916)
หานักศึกษา (404) → `national_id` ต้องเป็น string 13 หลัก → `setPassword(id, bcrypt.hash(national_id))`. รหัสผ่านนักศึกษา = เลขบัตร **เสมอ** ไม่มีรหัสชั่วคราว ไม่บังคับเปลี่ยน (ต่างจาก officer/executive)
