# Backend 09 — News (ข่าว/ประกาศ) และ Notifications (แจ้งเตือน)

โฟลเดอร์: `backend/src/modules/news/` และ `backend/src/modules/notifications/`

---

# ส่วน A — News

ประกาศ **ผูกกับรอบสอบ** (`round_id`) และรอบผูกกับรุ่น (`academic_year`) → นักศึกษาเห็นเฉพาะประกาศของรุ่นตัวเอง

## `news.repository.js` (45 บรรทัด)
| บรรทัด | ทำอะไร |
|---|---|
| 7-30 | `findAll(academicYear)` — ถ้า `academicYear === undefined` ไม่กรอง (`where: undefined`) ไม่งั้นกรอง `{ round: { academic_year } }` (filter ผ่าน relation); เรียงโพสต์ใหม่สุดก่อน; include ผู้โพสต์/ผู้แก้ (`ACTOR_SELECT`) และรอบ (เฉพาะ 4 field). (29) `map` ใช้ `{ ...n, poster: toActor(n.poster), ... }` — ก๊อป field ของข่าวแล้วเขียนทับ poster ด้วยเวอร์ชันตัด hash |
| 33-34 | `findById` — ใช้เช็คว่ามีจริงก่อน update/delete |
| 37, 40-41, 44-45 | `create`, `update`, `remove` |

## `news.controller.js` (178 บรรทัด)
| บรรทัด | ทำอะไร |
|---|---|
| 47-51 | import `fs/promises`, `path`, repos (news/students/rounds) |
| 54-58 | `httpError` |
| 61-65 | `ensureNewsText({title, content})` — ต้องเป็น string ไม่ว่าง; หัวข้อ ≤ 255 (ตรง `VarChar(255)`) |
| 68-73 | `ensureRoundExists` — `round_id` ต้องเป็นจำนวนเต็มและมีรอบนั้นจริง (เดิมเลขมั่ว FK พัง 500) |
| 79-94 | **`getAll`**: `academicYear` เริ่มเป็น `undefined`; ถ้าผู้เรียกเป็น `student` หา student แล้วใช้ปีของเขา → นักศึกษาเห็นเฉพาะรุ่นตัวเอง, เจ้าหน้าที่/ผู้บริหารเห็นครบ. นักศึกษาตัด `updater` ออกด้วย `news.map(({ updater, ...rest }) => rest)` (ผู้แก้เป็นข้อมูลภายใน; role มาจาก JWT/DB) |
| 97-117 | **`createNews`** (POST): ต้องมี title/content/round_id ครบ → `ensureNewsText` → `ensureRoundExists` → `create` โดย `posted_by: req.user.userId` (จาก JWT) → 201 |
| 120-144 | **`updateNews`** (PUT): หาข่าว (404); ถ้าแก้ title/content ตรวจข้อความรวมค่าเดิม (`title ?? existing.title` — กันแก้เป็นว่างแล้วการ์ดเปล่า); ใส่ `data` เฉพาะ field ที่ส่ง; `round_id` ตรวจมีจริง; `updated_by = req.user.userId` |
| 147-159 | **`deleteNews`**: หา (404) → ลบแถว → `removeImageFile` ลบรูปบน disk ตามไปด้วย (กันไฟล์กำพร้า) |
| 163-164 | `toStoredPath` — path สัมพัทธ์ + `/` เสมอ |
| 166-168 | `removeImageFile(storedPath)` — มี path ค่อย `fs.rm({force:true})` |
| 171-192 | **`uploadNewsImage`** (1 ประกาศ = 1 รูป): ไม่มีไฟล์ 400; ไม่พบประกาศ → ลบไฟล์ที่ multer เพิ่งเขียนทิ้ง + 404; `update` ตั้ง `image_path`; ลบรูปเก่าทิ้ง |
| 195-208 | **`deleteNewsImage`**: ตั้ง `image_path: null` แล้วลบไฟล์ |
| 211-223 | **`serveNewsImage`**: `sendFile` พร้อม callback — ไฟล์หาย → 404 |

---

# ส่วน B — Notifications

## `notifications.repository.js` (72 บรรทัด)
| บรรทัด | ฟังก์ชัน | ทำอะไร |
|---|---|---|
| 3-4 | `create` | สร้างแจ้งเตือน 1 รายการ (`round_id` ไม่บังคับ default null) |
| 7-11 | `hasRoundOpenNotice` | เคยแจ้ง "รอบนี้เปิด" ให้คนนี้แล้วหรือยัง (กันสร้างซ้ำทุกครั้งที่ poll) |
| 14-24 | `findRoundOpenNoticeIds` | id ของแจ้งเตือน round_open ทั้งหมดของคนนี้เรียง id น้อย→มาก (หาแถวซ้ำ) |
| 28-29 | `removeByIds(ids)` | `deleteMany` ตาม id (แถวหายไปแล้ว = count 0 ไม่ error). ⚠️ ผู้เรียกต้องรับประกันว่า `ids` มีของ (เพราะ `{ in: undefined }` = ไม่กรอง) |
| 32-35 | `createMany(student_ids, {type, message})` | สร้างหลายคนพร้อมกัน (ใช้ตอนเปิดสิทธิ์ทั้งรุ่น) |
| 41-48 | `requireStudentId` | **ด่านกัน undefined**: ถ้า `student_id` เป็น undefined Prisma "ไม่กรองเลย" → `findMany` คืนของทุกคน / `updateMany` แก้ของทุกคน. จึง throw 403 ถ้าไม่ใช่นักศึกษา |
| 50-55 | `findByStudent` | 50 รายการล่าสุด (`take: 50`) |
| 57-64 | `markRead` | `updateMany` where มีทั้ง `notification_id` **และ** `student_id` — mark ของคนอื่นไม่ได้แม้เดา id ถูก |
| 66-69 | `markAllRead` | ที่ `is_read: false` ของนักศึกษาคนนี้ |

## `notifications.controller.js` (94 บรรทัด)

### `notifyIfRoundJustOpened(studentId)` (305-340 ในไฟล์ต้นฉบับบรรทัด 9-48)
ไม่มี background job — อาศัย endpoint `getMine` ที่ frontend poll ทุก 30 วินาทีเป็นตัวเช็ค "รอบเพิ่งเปิดไหม" ถ้าใช่สร้างแจ้งเตือน ผ่านด่านตามลำดับ (เจอข้อใดไม่ผ่านก็ `return` เงียบ ๆ):
1. `findEligibilityYear` — ต้อง `exam_eligible` (select เบาสุด เพราะถูกเรียกบ่อย)
2. `findActive(academic_year)` มีรอบเปิดของรุ่นนี้ไหม
3. `hasRoundOpenNotice` เคยแจ้งแล้ว → ข้าม
4. มีใบในรอบนี้แล้ว → ข้าม (รู้อยู่แล้วว่ารอบเปิด; เช็คก่อนเพราะ query เดียวจบ)
5. ผ่านครบทุกวิชาของรอบแล้ว (`roundSubjectIds.length > 0 && mustAnswer.length === 0`) → ข้าม (สูตรเดียวกับตอนส่งผล)
6. `notifRepo.create({type:"round_open", round_id, message})` ในรูปแบบข้อความ 2 บรรทัด (`\n`) แล้ว `removeDuplicateRoundOpen`; `try/catch` log พลาดไม่ล้ม

### `removeDuplicateRoundOpen(studentId, roundId)` (349-360)
**ปัญหา race:** เปิดหลายแท็บ → ทุกแท็บ poll พร้อมกัน ทุกแท็บเห็น "ยังไม่เคยแจ้ง" ก่อนใครสร้างเสร็จ → ได้หลายแถว
**ทางแก้ (ไม่ต้องแก้ schema):** หลังสร้าง ดึง id ทั้งหมด (เรียงน้อย→มาก); ถ้า ≤ 1 จบ; ไม่งั้นเก็บ `ids[0]` ลบที่เหลือ. ทุกแท็บลบ "ที่ไม่ใช่แถวแรก" เหมือนกัน จึงไม่มีทางลบจนไม่เหลือสักแถว

### Handler
| ฟังก์ชัน | ทำอะไร |
|---|---|
| `getMine` (363-371) | เรียก `notifyIfRoundJustOpened` ก่อน แล้ว `findByStudent` ส่งกลับ |
| `markRead` (373-380) | `markRead(req.params.id, req.user.studentId)` |
| `markAllRead` (382-389) | `markAllRead(req.user.studentId)` |

> **ที่มาของแจ้งเตือนชนิดอื่น:** `eligible` (เปิดสิทธิ์ — `student.controller.js` `bulkSetEligible`), `approved`/`rejected` (ตรวจใบ — `examResults.controller.js`), `revoked` (reopen/revoke approval)
