# Flowchart ของ logic ใน backend (เน้น dashboard)

ไฟล์นี้วาด logic ที่งงที่สุดเป็น flowchart (Mermaid) — เปิดดูได้ใน VS Code (ลง extension "Markdown Preview Mermaid Support") หรือบน GitLab/GitHub ได้เลย

สร้างจากการอ่านโค้ดจริงวันที่ 9 ต.ค. 2569 — ไฟล์ที่ครอบคลุม:
`middlewares/auth.js`, `requireRole.js`, `errorHandler.js` · `utils/roundPhase.js`, `academicYear.js` · `modules/rounds/*` · `modules/examResults/*` · `modules/students/*` (เฉพาะ logic หลัก) · `modules/dashboard/dashboard.service.js` + `dashboard.repository.js`

**ยังไม่ครอบคลุม:** `upload.js`, `rateLimit.js`, `requestLogger.js`, `student.export.controller.js`, `dashboard.pdf.js`, `dashboard.controller.js`

## สารบัญ

| # | เรื่อง | ไฟล์ต้นทาง |
|---|---|---|
| 1 | ทุก request ผ่านอะไรบ้าง | middlewares |
| 2 | `authenticate` ทีละด่าน | `auth.js` |
| 3 | `errorHandler` แปลง error → status | `errorHandler.js` |
| 4 | Phase ของรอบ (4 สถานะ) | `roundPhase.js`, `rounds.repository.js` |
| 5 | นักศึกษาส่งได้รอบไหน (`findSubmittableRound`) | `examResults.service.js` |
| 6 | นักศึกษากดส่งผลสอบ (`create`) | `examResults.controller.js` |
| 7 | วงจรสถานะของใบผลสอบ | `examResults.*` |
| 8 | เจ้าหน้าที่ยืนยัน/ตีกลับ + ล็อกแถว | `examResults.controller.js`, `.repository.js` |
| 9 | สร้าง/แก้/ลบรอบ | `rounds.controller.js` |
| 10 | นักศึกษา: import / โปรไฟล์ / เปิดสิทธิ์ / ลบ | `student.controller.js` |
| 11 | **Dashboard: ตัวเลขทุกตัวมาจากไหน** | `dashboard.service.js` |
| 12 | Dashboard: `buildStats` (รายรอบ) | `dashboard.service.js` |
| 13 | Dashboard: `buildYearSummary` (รายปี) | `dashboard.service.js` |
| 14 | Dashboard: ตัวอย่างคำนวณด้วยตัวเลขจริง | — |
| 15 | Dashboard: แจ้งเตือน (`buildAlerts`) | `dashboard.service.js` |

---

## 1. ทุก request ผ่านอะไรบ้าง

```mermaid
flowchart LR
    A["Browser ส่ง request<br/>(แนบ cookie ชื่อ token)"] --> B["authenticate<br/>ใครคือคนนี้?"]
    B -->|"ไม่ผ่าน"| X1["401 / 403<br/>จบ ไม่ถึง controller"]
    B -->|"ผ่าน: มี req.user"| C["requireRole<br/>role นี้เข้า route นี้ได้ไหม?"]
    C -->|"ไม่ผ่าน"| X2["403 ไม่มีสิทธิ์"]
    C -->|"ผ่าน"| D["controller<br/>ตรวจข้อมูล + กฎธุรกิจ"]
    D --> E["repository<br/>คุย Prisma / DB"]
    E --> D
    D -->|"สำเร็จ"| F["res.json success true"]
    D -->|"throw / next err"| G["errorHandler<br/>แปลง error เป็น status + ข้อความไทย"]
```

จำ 3 ข้อ:
1. `authenticate` ต้องมาก่อน `requireRole` เสมอ (requireRole อ่าน `req.user` ที่ authenticate สร้าง)
2. controller ไม่ส่ง error เอง ใช้ `throw httpError(msg, code)` → `catch → next(err)` → errorHandler
3. role อ่านจาก **DB** ทุก request (ไม่เชื่อ role ใน token, ไม่เชื่อ body)

---

## 2. `authenticate` ทีละด่าน (`middlewares/auth.js`)

```mermaid
flowchart TD
    S["request เข้ามา"] --> T{"มี cookie token ไหม?"}
    T -->|"ไม่มี"| R1["401 code auth_required"]
    T -->|"มี"| V{"jwt.verify ผ่านไหม?<br/>(ลายเซ็นถูก + ยังไม่หมดอายุ)"}
    V -->|"ไม่ผ่าน"| R2["401 code auth_required<br/>หมดอายุ/ปลอม"]
    V -->|"ผ่าน ได้ decoded.userId"| D["ไปถาม DB: user_id นี้ยังอยู่ไหม?<br/>(ดึง role, student_id, must_change_password)"]
    D --> U{"เจอ user<br/>และ password_hash ไม่ว่าง?"}
    U -->|"ไม่เจอ / ถูกถอนสิทธิ์<br/>(password_hash = null)"| R3["401 code auth_required"]
    U -->|"ใช่"| Q["สร้าง req.user จากค่าใน DB<br/>userId, username, role, studentId, mustChangePassword"]
    Q --> M{"mustChangePassword<br/>และ path ไม่ใช่ /me, /password ?"}
    M -->|"ใช่"| R4["403 must_change_password"]
    M -->|"ไม่"| P{"role = student<br/>และยังไม่มี student row<br/>และ path ไม่ใช่ /me, /complete-profile<br/>และไม่ใช่ router /api/rooms ?"}
    P -->|"ใช่"| R5["403 profile_incomplete"]
    P -->|"ไม่"| OK["next() ไปต่อ"]
```

ทำไมต้องถาม DB ทุกครั้ง: token ที่ถูกต้องไม่ได้แปลว่าเจ้าของยังอยู่ (เช่น ถูกถอนสิทธิ์, seed ใหม่แล้ว user_id เปลี่ยน) และเปลี่ยน role แล้วมีผลทันที

`requireRole(...roles)` ง่ายกว่านี้: ไม่มี `req.user` → 401, role ไม่อยู่ใน list → 403, ไม่งั้น `next()`

---

## 3. `errorHandler` แปลง error → status (`errorHandler.js`)

ลำดับการตัดสิน status (เจอข้อไหนก่อนใช้ข้อนั้น):

```mermaid
flowchart TD
    E["next err มาถึง errorHandler"] --> A{"err.statusCode<br/>(controller ตั้งเองด้วย httpError)"}
    A -->|"มี"| S1["ใช้ค่านั้น + ข้อความไทยที่เขียนไว้"]
    A -->|"ไม่มี"| B{"MulterError?"}
    B -->|"ใช่"| S2["400 + แปลข้อความเป็นไทย<br/>(ไฟล์ใหญ่เกิน ฯลฯ)"]
    B -->|"ไม่"| C{"Prisma P2002<br/>(unique ซ้ำ)"}
    C -->|"ใช่"| S3["409"]
    C -->|"ไม่"| D{"Prisma P2025<br/>(หาแถวไม่เจอ)"}
    D -->|"ใช่"| S4["404"]
    D -->|"ไม่"| F{"P2003 หรือ RESTRICT<br/>(ถูกตารางอื่นอ้างอยู่)"}
    F -->|"ใช่"| S5["409"]
    F -->|"ไม่"| G{"ข้อมูลเข้า Prisma ไม่ได้<br/>(Validation / P2000 / เลขใหญ่เกิน / NUL byte)"}
    G -->|"ใช่"| S6["400"]
    G -->|"ไม่"| S7["500 = บั๊กของเรา<br/>ไม่ใช่ development → ข้อความกลาง<br/>(ไม่ปล่อย query ภายในออกไป)"]
```

กฎสำคัญ: ถ้า controller ตั้ง `statusCode` เอง → ข้อความของ controller **ห้ามถูกเขียนทับ** ด้วยข้อความกลางของ Prisma

---

## 4. Phase ของรอบ (`utils/roundPhase.js`)

DB เก็บ `status` แค่ `open`/`closed` (เจ้าหน้าที่กดเอง) แต่ **phase คำนวณสดตามเวลา** ไม่เก็บลง DB

```mermaid
flowchart TD
    R["รอบ 1 รอบ + เวลาตอนนี้ (now)"] --> A{"status = open ?"}
    A -->|"ไม่ (closed)"| P1["phase = closed<br/>เจ้าหน้าที่ปิดแล้ว"]
    A -->|"ใช่"| B{"now < open_date ?"}
    B -->|"ใช่"| P2["phase = scheduled<br/>ตั้งเปิดไว้ล่วงหน้า ยังไม่ถึงวัน"]
    B -->|"ไม่"| C{"now > close_date ?"}
    C -->|"ใช่"| P3["phase = expired<br/>เลยวันปิดแต่ยังไม่ได้กดปิด"]
    C -->|"ไม่"| P4["phase = active<br/>เปิดรับจริง กรอกได้"]
```

**สำคัญ:** `active` ต้องตรงกับเงื่อนไข `findActive()` ใน `rounds.repository.js` เป๊ะ:

```
status = "open"  AND  open_date <= now <= close_date  AND  academic_year = ปีของนักศึกษา
```

ฟังก์ชันค้นรอบใน `rounds.repository.js` ต่างกันตรงไหน:

| ฟังก์ชัน | เงื่อนไข | ใช้ทำอะไร |
|---|---|---|
| `findActive(year)` | open + อยู่ในช่วงวันที่ + ปีนี้ | **ตอนรับผลสอบจริง** |
| `findOpenForYear(year)` | open + ปีนี้ (ไม่ดูวันที่) | โชว์ "รอบหน้าเปิดวันที่…" เท่านั้น ห้ามใช้รับผล |
| `findLatestStarted(year)` | `open_date <= now` และ (status=open หรือ มีใบผลสอบ ≥ 1 ใบ) เอา attempt สูงสุด | หารอบล่าสุดสำหรับแก้ใบที่ถูกตีกลับ |
| `findOpen()` | status = open ทั้งระบบ | กันเปิด 2 รอบพร้อมกัน |
| `findNewerRoundWithResults` | ปีเดียวกัน, attempt มากกว่า, มีใบแล้ว | กันเปิดรอบเก่าซ้ำ |

---

## 5. นักศึกษา "ส่งได้" รอบไหน — `findSubmittableRound` (`examResults.service.js`)

ใช้ร่วมกัน 2 ที่: ตอนกดส่ง (`create`) และตอนโหลดหน้ากรอก (`getActive`) เพื่อให้หน้าจอกับ backend ตัดสินตรงกัน

```mermaid
flowchart TD
    S["student (มี academic_year)"] --> A["findActive(ปีของ student)"]
    A --> B{"เจอรอบที่เปิดรับอยู่จริง?"}
    B -->|"เจอ"| R1["คืน round, fixingRejected = false<br/>กรอก/แก้ได้ปกติ"]
    B -->|"ไม่เจอ"| C["findLatestStarted(ปีของ student)"]
    C --> D{"มีรอบที่เริ่มแล้ว?"}
    D -->|"ไม่มี"| N1["คืน null = ส่งไม่ได้"]
    D -->|"มี (เอารอบล่าสุดเท่านั้น<br/>ไม่ย้อนรอบเก่า)"| E["หาใบของ student ในรอบนั้น"]
    E --> F{"ใบมีอยู่ และ<br/>staff_status = rejected ?"}
    F -->|"ใช่"| R2["คืน round, fixingRejected = true<br/>แก้ใบที่ถูกตีกลับได้ แม้รอบปิดแล้ว"]
    F -->|"ไม่"| N2["คืน null = ส่งไม่ได้"]
```

ทำไมดูแค่รอบล่าสุด: ถ้าย้อนไปแก้ใบรอบเก่า ผลที่ถูก "ยกไปรอบหลัง" (carry-forward) จะไม่ตรงกับใบต้นทาง

---

## 6. นักศึกษากดส่งผลสอบ (`examResults.controller.js` → `create`)

เป็นฟังก์ชันที่มีด่านเยอะสุด ไล่ตามลำดับในโค้ด:

```mermaid
flowchart TD
    S["POST /api/exam-results<br/>body: subject_results = [{subject_id, is_passed}]"] --> A{"subject_results เป็น array<br/>และไม่ว่าง?"}
    A -->|"ไม่"| E1["400 ต้องส่งอย่างน้อย 1 วิชา"]
    A -->|"ใช่"| B{"หา student ตาม req.user.studentId<br/>เจอไหม?"}
    B -->|"ไม่"| E2["404"]
    B -->|"เจอ"| C{"student.exam_eligible = true ?"}
    C -->|"ไม่"| E3["403 ยังไม่ได้รับสิทธิ์"]
    C -->|"ใช่"| D["findSubmittableRound(student)"]
    D --> D1{"ได้รอบไหม?"}
    D1 -->|"null"| E4["400 ไม่มีรอบที่เปิดอยู่"]
    D1 -->|"ได้ round"| F["existing = ใบเดิมของ student ในรอบนี้"]
    F --> G{"existing.staff_status<br/>= approved ?"}
    G -->|"ใช่"| E5["409 ยืนยันแล้ว แก้ไม่ได้"]
    G -->|"ไม่"| H{"fixingRejected = true ?"}
    H -->|"ใช่"| H1{"existing ยัง rejected อยู่?"}
    H1 -->|"ไม่"| E4
    H1 -->|"ใช่"| I
    H -->|"ไม่"| I["isRedo = มี existing หรือไม่"]
    I --> J["roundSubjectIds = วิชาของรอบนี้<br/>passedIds = วิชาที่เคยผ่านจริงจากรอบอื่น<br/>mustAnswer = roundSubjectIds ลบ passedIds"]
    J --> K{"roundSubjectIds ว่าง?"}
    K -->|"ใช่"| E6["400 รอบนี้ไม่มีรายวิชา"]
    K -->|"ไม่"| L{"mustAnswer ว่าง?<br/>(ผ่านครบแล้ว)"}
    L -->|"ใช่"| E7["400 ผ่านครบแล้ว ไม่ต้องกรอก"]
    L -->|"ไม่"| M["วนตรวจ subject_results ทีละรายการ"]
    M --> M1{"วิชาอยู่ในรอบ?<br/>is_passed เป็น boolean จริง?<br/>วิชาไม่ซ้ำ?"}
    M1 -->|"ผิดข้อใดข้อหนึ่ง"| E8["400"]
    M1 -->|"ผ่านหมด"| N{"mustAnswer ทุกวิชา<br/>มีคำตอบครบ?"}
    N -->|"ขาด"| E9["400 กรอกไม่ครบ ขาดอีก n วิชา"]
    N -->|"ครบ"| O["สร้าง finalResults ครบทุกวิชาของรอบ<br/>วิชาที่เคยผ่าน → is_passed = true, carried_forward = true<br/>(ไม่เชื่อค่าที่ client ส่ง)<br/>วิชาอื่น → ใช้คำตอบที่กรอก"]
    O --> P{"isRedo ?"}
    P -->|"ใช่"| P1["resubmitWithSubjects<br/>ล็อกแถว → เช็คซ้ำ → ทับผล"]
    P -->|"ไม่"| P2["createWithSubjects<br/>student_status = submitted<br/>staff_status = pending"]
    P1 --> Z["res.json success true"]
    P2 --> Z
```

แนวคิดที่ต้องเข้าใจ:
- **carry-forward**: วิชาที่เคยผ่านแล้ว ระบบ copy มาเป็น "ผ่าน" ให้เองโดยติด `carried_forward = true` — สถิติจะ **ไม่นับ** แถวนี้เป็นการสอบจริง
- `findPassedSubjectIds` นับเป็น "เคยผ่าน" เมื่อ: `is_passed = true` + `carried_forward = false` + ใบนั้น **ไม่ถูกตีกลับ** (pending ยังนับ) + ไม่ใช่ใบของรอบที่กำลังกรอก
- ด่าน controller เป็นด่านแรกให้ข้อความชัด ส่วน **ด่านที่กันกดพร้อมกันจริงอยู่ใน repository** (`resubmitWithSubjects` ล็อกแถวแล้วเช็คซ้ำ)

---

## 7. วงจรสถานะของใบผลสอบ

ใบหนึ่งมี 2 คอลัมน์สถานะ: `student_status` (draft/submitted) กับ `staff_status` (pending/approved/rejected). ตอนนี้ `create` ตั้ง `student_status = submitted` เสมอ ดังนั้นสถานะที่เปลี่ยนจริงคือ `staff_status`

```mermaid
stateDiagram-v2
    [*] --> pending : นักศึกษากดส่ง (create)
    pending --> approved : approve (officer หรือ reviewer)
    pending --> rejected : reject (ต้องมี remark)
    pending --> pending : นักศึกษาส่งทับ (รอบยังเปิด) submitted_at ใหม่
    rejected --> pending : นักศึกษาแก้ส่งใหม่ (รอบเปิด หรือ fixingRejected)
    rejected --> pending : officer กด reopen (ต้องมีเหตุผล)
    approved --> pending : officer กด reopen หรือ revoke-approval (ต้องมีเหตุผล)
    approved --> approved : นักศึกษาแก้ไม่ได้ (409)
```

ตารางสิทธิ์ (จาก `examResults.routes.js`):

| การกระทำ | route | role |
|---|---|---|
| ส่งผลสอบ | `POST /` | student |
| ดูของตัวเอง | `GET /me` | student |
| อัปโหลด PDF | `POST /:id/certificates` | student |
| ดูทุกใบ | `GET /` | officer, reviewer |
| ยืนยัน / ตีกลับ | `PATCH /:id/approve` `/reject` | officer, reviewer |
| ถอนยืนยัน / แก้ผลการตรวจ | `PATCH /:id/revoke-approval` `/reopen` | **officer เท่านั้น** |

`executive` เข้า exam-results ไม่ได้เลย — ดูได้แค่สถิติที่ `/api/dashboard`

---

## 8. เจ้าหน้าที่ยืนยัน/ตีกลับ + ล็อกแถว (`reviewExamResult`)

approve กับ reject ใช้ฟังก์ชันเดียวกัน ต่างกันแค่ `staff_status` และ `requireRemark`

```mermaid
flowchart TD
    S["PATCH /:id/approve หรือ /reject"] --> A{"หาใบตาม id เจอ?"}
    A -->|"ไม่"| E1["404"]
    A -->|"เจอ"| B{"staff_status = pending ?"}
    B -->|"ไม่"| E2["409 ถูกตรวจไปแล้ว"]
    B -->|"ใช่"| C{"requireRemark (reject)<br/>แต่ remark ว่าง?"}
    C -->|"ใช่"| E3["400 ต้องระบุเหตุผล"]
    C -->|"ไม่"| D{"remark ยาว > 500 ?"}
    D -->|"ใช่"| E4["400"]
    D -->|"ไม่"| F["อ่าน expected_submitted_at / expected_certificate_ids<br/>(ลายนิ้วมือของใบที่ผู้ตรวจเห็นบนจอ)<br/>รูปแบบผิด = 400"]
    F --> G["reviewWithLock — เปิด transaction"]
    G --> H["1 ล็อกแถว exam_results ด้วย SELECT ... FOR UPDATE<br/>(ใครจะแก้ใบนี้ต้องรอ)"]
    H --> I["2 อ่านใบล่าสุดตอนถือล็อก"]
    I --> J{"checkBeforeSave"}
    J -->|"ไม่มีใบ"| E5["404"]
    J -->|"ไม่ใช่ pending แล้ว"| E6["409"]
    J -->|"submitted_at หรือชุดไฟล์ไม่ตรงที่ผู้ตรวจเห็น"| E7["409 นักศึกษาแก้ระหว่างตรวจ โหลดใหม่"]
    J -->|"approve แต่ไม่มีไฟล์หลักฐานเลย"| E8["409 ตีกลับให้แนบไฟล์ก่อน"]
    J -->|"ผ่านหมด"| K["3 updateMany WHERE staff_status = pending<br/>ตั้ง staff_status, remark, confirmed_by, confirmed_at"]
    K --> L{"count = 0 ?"}
    L -->|"ใช่"| E2
    L -->|"ไม่"| M["commit"]
    M --> N["บันทึก review_logs (พลาดแค่ log error ไม่ล้ม)"]
    N --> O["สร้างแจ้งเตือนนักศึกษา (พลาดแค่ log error ไม่ล้ม)"]
    O --> Z["res.json ใบล่าสุด"]
```

ทำไมต้องล็อก: ผู้ตรวจเปิดใบดูอยู่ → นักศึกษาลบไฟล์/ส่งทับ → ผู้ตรวจกดยืนยัน = ยืนยันใบที่ไม่ตรงกับที่เห็น
ทุกงานที่ **เปลี่ยนเนื้อหาใบ** หรือ **ตัดสินใบ** ล็อกแถว `exam_results` ก่อนเสมอ ลำดับเหมือนกันทุกที่ (แถวแม่ก่อน ตารางลูกทีหลัง) → ไม่เกิด deadlock

**แก้ผลการตรวจ (`reopen` / `revoke-approval`)**: ใบ approved/rejected → pending
- ต้องมีเหตุผล (≤ 500 ตัวอักษร) → `updateMany WHERE staff_status = <สถานะที่เพิ่งอ่านมา>` → count 0 = 409
- ล้าง remark / confirmed_by / confirmed_at → บันทึก `review_logs` → แจ้งเตือน type `revoked`
- นักศึกษาแก้ได้อีกไหม = ขึ้นกับรอบ: รอบปิดแล้วต้องให้เจ้าหน้าที่เลื่อนวันปิดก่อน

---

## 9. สร้าง / แก้ / ลบรอบ (`rounds.controller.js`)

### 9.1 สร้างรอบ (`create`)

```mermaid
flowchart TD
    S["POST /api/rounds"] --> A{"ปี, ครั้งที่, วันเปิด, วันปิด<br/>ครบทั้ง 4 ช่อง?"}
    A -->|"ไม่"| E1["400 กรอกไม่ครบ"]
    A -->|"ครบ"| B["parseAcademicYear: จำนวนเต็ม 2500-2700<br/>parseAttemptNumber: จำนวนเต็ม >= 1"]
    B --> C["status ต้องเป็น open / closed เท่านั้น"]
    C --> D{"ปี + ครั้งที่ นี้มีอยู่แล้ว?"}
    D -->|"มี"| E2["400 ซ้ำ"]
    D -->|"ไม่"| F{"status = open ?"}
    F -->|"ใช่"| F1{"มีรอบอื่น open ค้างอยู่?<br/>(เปิดได้ทีละรอบทั้งระบบ)"}
    F1 -->|"มี"| E3["400 ต้องปิดรอบนั้นก่อน"]
    F1 -->|"ไม่"| G
    F -->|"ไม่"| G["subject_ids: ไม่ส่ง = ทุกวิชา<br/>ส่งมา = ต้องไม่ว่าง ไม่ซ้ำ มีจริงใน DB"]
    G --> H["แปลงวันที่เป็นเวลาไทย (UTC+7)<br/>วันเปิดไม่ระบุเวลา = 00:00:00<br/>วันปิดไม่ระบุเวลา = 23:59:59.999"]
    H --> I{"วันเปิด < วันปิด ?"}
    I -->|"ไม่"| E4["400"]
    I -->|"ใช่"| J{"status = open และ<br/>วันปิดผ่านไปแล้ว?"}
    J -->|"ใช่"| E5["400 เปิดไม่ได้ แก้วันปิดก่อน"]
    J -->|"ไม่"| K["roundsRepo.create<br/>created_by = req.user.userId (จาก JWT)<br/>status ไม่ส่ง = closed"]
```

### 9.2 แก้รอบ (`update`) — ด่านที่คนงงบ่อย

```mermaid
flowchart TD
    S["PUT /api/rounds/:id"] --> A{"รอบมีอยู่?"}
    A -->|"ไม่"| E0["404"]
    A -->|"มี"| B{"ส่ง subject_ids มา?"}
    B -->|"ใช่"| B1{"รอบนี้ status = open อยู่?"}
    B1 -->|"ใช่"| E1["400 ต้องปิดรอบก่อนแก้วิชา"]
    B1 -->|"ไม่"| B2{"ชุดวิชาใหม่ ≠ ชุดเดิม?<br/>(sameIdSet เทียบแบบไม่สนลำดับ)"}
    B2 -->|"ต่าง"| B3{"รอบนี้มีใบผลสอบแล้ว?"}
    B3 -->|"มี"| E2["409 แก้วิชาไม่ได้"]
    B3 -->|"ไม่มี"| B4["data.subject_ids = ชุดใหม่"]
    B2 -->|"เหมือนเดิม"| C
    B -->|"ไม่"| C
    B4 --> C
    C{"ปี หรือ ครั้งที่ เปลี่ยนจากเดิม?"}
    C -->|"ใช่"| C1{"รอบนี้มีใบผลสอบแล้ว?"}
    C1 -->|"มี"| E3["409 เปลี่ยนไม่ได้ แก้ได้แค่วันที่"]
    C1 -->|"ไม่มี"| D
    C -->|"ไม่"| D["เช็คซ้ำปี+ครั้งที่ (ข้ามตัวเอง)"]
    D --> E["เช็ควันเปิด < วันปิด จาก 'ค่าหลังแก้'<br/>(ส่งมาแค่วันปิดก็ทำให้พังได้ถ้าชนวันเปิดเดิม)"]
    E --> F{"ส่ง status = open ?"}
    F -->|"ไม่"| Z["updated_by, updated_at = ตอนนี้ → update"]
    F -->|"ใช่"| G{"มีรอบอื่น open อยู่?"}
    G -->|"มี"| E4["400"]
    G -->|"ไม่"| H{"เดิมเป็น closed?"}
    H -->|"ไม่ (เปิดอยู่แล้ว กดบันทึกซ้ำ)"| Z
    H -->|"ใช่ (กำลังเปิดใหม่)"| I{"วันปิดผ่านไปแล้ว?"}
    I -->|"ใช่"| E5["400"]
    I -->|"ไม่"| J{"มีรอบที่ 'ใหม่กว่า' ของปีเดียวกัน<br/>และมีใบผลสอบแล้ว?"}
    J -->|"มี"| E6["409 เปิดรอบเก่าซ้ำไม่ได้<br/>(carry-forward จะเพี้ยน)"]
    J -->|"ไม่"| Z
```

### 9.3 ลบรอบ (`remove`)

```mermaid
flowchart TD
    S["DELETE /api/rounds/:id"] --> A{"รอบมีอยู่?"}
    A -->|"ไม่"| E0["404"]
    A -->|"มี"| B{"status = open และ<br/>close_date ยังไม่ถึง?"}
    B -->|"ใช่"| E1["400 กำลังเปิดรับ ต้องปิดก่อน"]
    B -->|"ไม่"| C["นับ ผลสอบ + ประกาศ ที่ผูกกับรอบ"]
    C --> D{"ทั้งคู่ = 0 ?"}
    D -->|"ใช่"| Z1["ลบรอบ + แจ้งเตือนที่ผูก"]
    D -->|"ไม่"| E{"query delete_linked = true ?"}
    E -->|"ไม่"| E2["409 code has_linked_data<br/>บอกจำนวน ให้หน้าจอถามยืนยัน"]
    E -->|"ใช่"| F["removeCascade ใน transaction เดียว<br/>ลบจากลูกขึ้นแม่: review_logs → certificates → subject_results → exam_results → news → notifications → รอบ"]
    F --> G["ลบไฟล์บน disk หลัง DB สำเร็จ<br/>(กลับด้านไม่ได้: ลบไฟล์ก่อนแล้ว DB พัง = ไฟล์หายแต่ข้อมูลยังอยู่)"]
    G --> H["console.warn [AUDIT] ใครลบอะไร"]
```

---

## 10. นักศึกษา: import / โปรไฟล์ / เปิดสิทธิ์ / ลบ

### 10.1 ปีการศึกษาที่จบ (`utils/academicYear.js`)

```
ปีจบ = 2500 + (2 หลักแรกของรหัส) + 4        เช่น 66xxxxxxxx → 2566 + 4 = 2570
```

ปีจบคือตัวกำหนด **รุ่น** → กำหนดว่านักศึกษาเห็นรอบสอบไหน และเป็นตัวหารของสถิติ จึงห้ามนักศึกษาตั้งเอง

```mermaid
flowchart TD
    A["ปีจบที่ใช้จริง"] --> B{"เจ้าหน้าที่ใส่ปีจบตอน import?<br/>(users.import_academic_year)"}
    B -->|"มี"| C["ใช้ค่านั้น"]
    B -->|"ไม่มี (null)"| D["คำนวณ รหัส + 4"]
    E["validateGraduationYear (ตอน import / แก้ข้อมูล)"] --> E1{"เป็นเลข 4 หลัก?"}
    E1 -->|"ไม่"| X1["error"]
    E1 -->|"ใช่"| E2{"ปี < ปีที่คำนวณจากรหัส?"}
    E2 -->|"ใช่"| X2["error: อาจใส่ปีที่เข้าแทนปีที่จบ"]
    E2 -->|"ไม่"| OK["ผ่าน"]
```

### 10.2 import รายชื่อ (`bulkImport`) — ทำทีละแถว ไม่ใช่ transaction เดียว

```mermaid
flowchart TD
    S["POST /import (CSV หรือ xlsx)<br/>?dry_run=true = ตรวจอย่างเดียว"] --> A{"แนบไฟล์?"}
    A -->|"ไม่"| E1["400"]
    A -->|"ใช่"| B["อ่านไฟล์ → rows<br/>(xlsx ดูจาก byte PK / ไม่ใช่ = CSV)"]
    B --> C{"rows ว่าง?"}
    C -->|"ใช่"| E2["400"]
    C -->|"ไม่"| D["จับคู่คอลัมน์: student_id, national_id, academic_year<br/>ลำดับ: เจ้าหน้าที่เลือกเอง → ชื่อตรง → มีคำสำคัญ"]
    D --> D1{"ขาดคอลัมน์บังคับ?"}
    D1 -->|"ใช่"| E3["400 code missing_columns + รายชื่อคอลัมน์<br/>หน้าจอให้เลือกเอง"]
    D1 -->|"ไม่"| L["วนทีละแถว"]
    L --> R1{"รหัส และ เลขบัตร ครบ?"}
    R1 -->|"ไม่"| K["skipped ข้อมูลไม่ครบ"]
    R1 -->|"ใช่"| R2{"เลขบัตร 13 หลัก?"}
    R2 -->|"ไม่"| K2["skipped (เช็คกรณี Excel แปลงเป็น 1.23E+12)"]
    R2 -->|"ใช่"| R3{"รูปแบบรหัสนักศึกษาถูก?"}
    R3 -->|"ไม่"| K3["skipped"]
    R3 -->|"ใช่"| R4{"รหัสซ้ำกับแถวก่อนในไฟล์?"}
    R4 -->|"ซ้ำ"| K4["skipped"]
    R4 -->|"ไม่"| R5{"ใส่ปีจบมา?"}
    R5 -->|"ใช่"| R5a{"validateGraduationYear ผ่าน?"}
    R5a -->|"ไม่"| K5["skipped"]
    R5a -->|"ใช่"| R5b["ปี ≠ สูตร → เก็บเป็น import_academic_year<br/>และใส่ year_overrides"]
    R5 -->|"ไม่"| R6
    R5b --> R6{"มี user รหัสนี้ในระบบแล้ว?"}
    R6 -->|"มี"| K6["skipped มีในระบบแล้ว (ไม่ทับของเดิม)"]
    R6 -->|"ไม่"| R7{"dry_run ?"}
    R7 -->|"ใช่"| I1["นับเป็น imported เฉยๆ ไม่เขียน DB"]
    R7 -->|"ไม่"| I2["สร้าง user: password_hash = bcrypt(เลขบัตร)<br/>ยังไม่สร้าง student row"]
    I2 -->|"พังกลางทาง"| K7["skipped บันทึกไม่สำเร็จ แถวอื่นไปต่อ"]
```

สรุปความหมาย: **import สร้างแค่ `users`** (บัญชีที่ยังไม่มี `students` row) → คนกลุ่มนี้เรียก "pending account" → dashboard นับเป็นสมาชิกรุ่นที่ "ยังไม่กรอก" (ดู `countStudentsByYear` ข้อ 11)

### 10.3 นักศึกษากรอกโปรไฟล์ครั้งแรก (`completeProfile`)

```mermaid
flowchart TD
    S["POST /complete-profile"] --> A{"req.user.studentId มีแล้ว?"}
    A -->|"มี"| E1["409 กรอกไปแล้ว"]
    A -->|"ไม่มี"| B["ตรวจชื่อ/อีเมล/เบอร์ + room_id"]
    B --> C{"ห้องมีจริง? faculty ตั้งค่าแล้ว?"}
    C -->|"ไม่"| E2["400 / 500"]
    C -->|"ใช่"| D["student_id = req.user.username (รหัสที่ login)<br/>academic_year = import_academic_year ?? รหัส + 4<br/>(ไม่รับค่าจาก client)"]
    D --> E["สร้างแถว students ผูก user"]
    E --> Z["201"]
```

### 10.4 เปิด/ปิดสิทธิ์กรอกผล (`bulkSetEligible`)

กับดักที่สำคัญ: Prisma ตีความ `{ in: undefined }` ว่า **"ไม่มีเงื่อนไข"** → `updateMany` กวาดทั้งตาราง

```mermaid
flowchart TD
    S["PATCH /bulk-eligible"] --> A{"student_ids เป็น array ไม่ว่าง?"}
    A -->|"ไม่"| E1["400 (กันปิดสิทธิ์ทั้งระบบ)"]
    A -->|"ใช่"| B{"exam_eligible เป็น boolean จริง?"}
    B -->|"ไม่"| E2["400"]
    B -->|"ใช่"| C{"ทุก id เป็นข้อความไม่ว่าง?"}
    C -->|"ไม่"| E3["400"]
    C -->|"ใช่"| D["updateMany exam_eligible"]
    D --> F{"เปิดสิทธิ์ (true) ?"}
    F -->|"ใช่"| G["สร้างแจ้งเตือนเฉพาะรหัสที่มีจริง<br/>(ไม่รอ ไม่ทำให้ request ล้ม)"]
    F -->|"ไม่ (ปิด)"| H["ไม่แจ้ง"]
```

### 10.5 ลบนักศึกษา (`deleteStudents`)

```mermaid
flowchart TD
    S["DELETE /:id หรือ POST /bulk-delete"] --> A["summarizeResults: มีกี่คนที่มีผลสอบ"]
    A --> B{"มีผลสอบ และ<br/>ยังไม่ส่ง delete_results = true ?"}
    B -->|"ใช่"| E1["409 code has_exam_results<br/>หน้าจอถามยืนยัน"]
    B -->|"ไม่"| C["removeStudentsCascade (transaction)<br/>ได้ deletedIds + filePaths"]
    C --> D{"deletedIds ว่าง?"}
    D -->|"ใช่"| E2["404"]
    D -->|"ไม่"| F["ลบไฟล์ PDF บน disk หลัง DB สำเร็จ"]
    F --> G{"ลบผลสอบไปด้วย?"}
    G -->|"ใช่"| H["console.warn [AUDIT]"]
```

---

## 11. Dashboard: ตัวเลขทุกตัวมาจากไหน

**อ่านข้อนี้ก่อนข้อ 12–13 — ถ้าเข้าใจ 3 ตัวกรอง + ตัวหาร ก็เข้าใจ dashboard 80% แล้ว**

### 11.1 ตัวกรองใบผลสอบ 4 ตัว (ฟังก์ชันเล็กๆ ที่ต้นไฟล์ `dashboard.service.js`)

| ฟังก์ชัน | เก็บใบที่... | ตัดออก | ใช้กับ |
|---|---|---|---|
| `onlySent` | `student_status ≠ draft` | draft | ฐานของทุกอย่าง ("ส่งแล้ว") |
| `notRejected` | `staff_status ≠ rejected` | ถูกตีกลับ | fillRate รายปี |
| **`onlyConfirmed`** | **`staff_status = approved`** | pending, rejected | **ทุกตัวเลขที่แปลว่า "ผ่าน"** |

**กฎทอง:** ตัวเลขที่แปลว่า "ผ่าน" นับ **เฉพาะใบ approved** เท่านั้น (ผลที่นักศึกษากรอกเองยังไม่มีใครเทียบกับใบรายงานผลสอบ)
ใบ pending ไม่ได้หายไป — ยังนับเป็น "ส่งแล้ว" และหน้าจอเตือนว่ามีกี่ใบที่ยังไม่นับ

### 11.2 `carried_forward` — แถวที่ "ไม่ใช่การสอบจริง"

วิชาที่ถูกยกมาจากรอบก่อนมี `carried_forward = true` กฎ: **ไม่นับเป็นผู้เข้าสอบวิชานั้น** ทั้งในรายวิชา, ตารางรอบแรก, และสะสมรายปี
(เหตุผลบั๊ก B1: ถ้าใบต้นทางถูกตีกลับทีหลัง สำเนาที่ยกมาจะค้างเป็น "ผ่าน" ผิดๆ)

### 11.3 ตัวหาร (denominator)

```mermaid
flowchart TD
    T["total = countStudentsByYear(ปีของรอบ)<br/>= นักศึกษาที่มี students row ในปีนั้น<br/>+ บัญชี import ที่ยังไม่กรอกโปรไฟล์ (ปีจบตรง)"]
    T --> U["ตัวหารของ % ส่วนใหญ่ = total (ทั้งรุ่น)<br/>ไม่ใช่ 'คนที่ส่งผล' และไม่กรอง exam_eligible"]
    U --> W["เหตุผล: คนที่ไม่ส่งผลก็นับว่ายังไม่ผ่าน<br/>(สูตรที่คณะรายงานสภาการพยาบาล)"]
```

มีตัวหารที่ **ต่างจาก total** 3 ตัว (ต้องติดป้ายให้ชัด):

| ตัวเลข | ตัวหาร |
|---|---|
| `passRateOfSitters` | `confirmed.length` (คนที่ยืนยันแล้วในรอบนี้) |
| รายวิชา `perSubject[].rate` | `pass + fail` (คนที่สอบวิชานั้นจริง ไม่รวม carried_forward) |
| `roundFillRate` | `roundTotal` (คนที่ต้องกรอกในรอบนี้) |

### 11.4 ตารางสูตรทั้งหมด

| ตัวเลขใน response | สูตร | ฐาน (ตัวตั้ง) | ตัวหาร |
|---|---|---|---|
| `submitted` | นับ | `onlySent(results)` | — |
| `fillRate` | `percent(submitted, total)` | ส่งแล้ว (รวม pending/rejected) | `total` |
| `confirmed` | นับ | ใบ approved ในรอบ | — |
| `fullyPassed` | `countFullyPassed(confirmed, subjectIds)` | approved + ผ่านทุกวิชาของรอบ | — |
| `fullyPassedRate` | `percent(fullyPassed, total)` | | `total` |
| `passRateOfSitters` | `percent(fullyPassed, confirmed.length)` | | คนที่ยืนยันแล้ว |
| `perSubject[i]` | pass / fail / rate | approved + ไม่ carried_forward | `pass+fail` (rate = null ถ้าไม่มีคนสอบ) |
| `subjectPassRate` | `percent(totalPass, totalMarks)` | รวมทุกวิชาที่มีคนสอบ | ผลสอบรวม |
| `by` | draft / submitted(=pending) / approved / rejected | ทุกใบในรอบ | — |
| `not_started` | `max(total − results.length, 0)` | | |
| `canSubmit` | เปิดสิทธิ์ และ ยังผ่านไม่ครบวิชาของรอบ | | |
| `roundTotal` | canSubmitIds ∪ คนที่มีใบในรอบ | | |
| `firstAttempt.passed` (รายปี) | ใบรอบ 1 approved + ผ่านครบ | | `total` |
| `firstYear.passed` (รายปี) | ผลสะสม approved ทุกรอบของปี ครบวิชาของรอบ 1 | | `total` |

หมายเหตุสูตร:
- `percent` = ปัดเป็นจำนวนเต็ม; `rate2` = ทศนิยม 2 ตำแหน่ง (ใช้กับตัวเลขที่ส่งสภาการพยาบาล) ทั้งคู่ตัวหาร 0 → คืน 0
- `countFullyPassed` ถ้ารอบไม่มีวิชาเลย (`subjectIds` ว่าง) คืน **0** — เพราะ `[].every()` ให้ `true` เสมอ จะทำให้ทุกคนถูกนับว่าผ่านครบทั้งที่ไม่ได้สอบ

### 11.5 `by` แยกสถานะ (`countByStatus`) — ลำดับ if สำคัญ

```mermaid
flowchart TD
    R["ใบ 1 ใบ"] --> A{"student_status = draft ?"}
    A -->|"ใช่"| D["by.draft++"]
    A -->|"ไม่"| B{"staff_status = approved ?"}
    B -->|"ใช่"| P["by.approved++"]
    B -->|"ไม่"| C{"staff_status = rejected ?"}
    C -->|"ใช่"| J["by.rejected++"]
    C -->|"ไม่ (pending)"| S["by.submitted++<br/>= ส่งแล้ว รอเจ้าหน้าที่ตรวจ"]
```

ชื่อ `submitted` ใน `by` **ไม่ใช่** "ส่งแล้วทั้งหมด" แต่คือ "ส่งแล้วและยังรอตรวจ" (ต่างจากตัวแปร `submitted` ตัวเลข ซึ่งรวมทั้งหมด)
5 ช่อง `approved + submitted + rejected + draft + not_started` บวกกันได้ `total` พอดีเสมอ

---

## 12. Dashboard: `buildStats` (รายรอบ) — `GET /api/dashboard/stats?round_id=`

```mermaid
flowchart TD
    S["buildStats(roundId)"] --> A{"ส่ง round_id มา?"}
    A -->|"ใช่"| A1["findRoundById"]
    A -->|"ไม่"| A2["findDefaultRound<br/>รอบที่ open ก่อน (ใหม่สุด) ไม่มีค่อยรอบล่าสุด"]
    A1 --> B{"เจอรอบ?"}
    A2 --> B
    B -->|"ไม่"| E["404 ไม่พบรอบ"]
    B -->|"เจอ"| C["ดึงพร้อมกัน (Promise.all):<br/>total, pendingAccounts, eligible,<br/>allSubjects, results ของรอบ,<br/>eligibleStudents + วิชาที่เคยผ่านก่อนรอบนี้"]
    C --> D["subjects = วิชาของรอบนี้ (subjectsOfRound)"]
    D --> F["sent = onlySent(results)<br/>confirmed = onlyConfirmed(sent)"]
    F --> G["perSubject = buildPerSubject(confirmed, subjects)<br/>fullyPassed = countFullyPassed(confirmed, subjectIds)"]
    G --> H["subjectPassRate = รวม pass / รวมผลสอบ<br/>ของวิชาที่มีคนสอบจริง (rate ≠ null)"]
    H --> I["วนนักศึกษาที่เปิดสิทธิ์"]
    I --> I1{"ผ่านครบทุกวิชาของรอบนี้แล้ว<br/>จากรอบก่อนหน้า?<br/>(รอบไม่มีวิชา = ไม่นับว่าผ่าน)"}
    I1 -->|"ผ่านครบแล้ว"| I2["alreadyPassedStudentIds"]
    I1 -->|"ยัง"| I3["canSubmit++ , canSubmitIds"]
    I2 --> J
    I3 --> J["roundPeople = canSubmitIds ∪ ทุกคนที่มีใบในรอบ<br/>roundTotal = ขนาด roundPeople"]
    J --> K["ประกอบ response:<br/>round + phase, total, by, not_started,<br/>roundTotal, roundNotStarted, roundFillRate,<br/>submitted, fillRate, fullyPassed, fullyPassedRate,<br/>passRateOfSitters, subjectPassRate, perSubject ฯลฯ"]
```

**ทำไมมี `roundTotal` แยกจาก `total`**: รอบ 2 ขึ้นไป คนที่ผ่านครบแล้วไม่ต้องกรอกอีก ถ้าเอามาอยู่ในตัวหารของแถบความคืบหน้า จะได้เช่น "29/155" ทั้งที่คนที่ต้องกรอกจริงมี 42 คน → มุมมองรายรอบใช้ `roundTotal` ส่วนสูตร "ผ่าน" ใช้ `total` ทั้งรุ่น

**วิชาที่เคยผ่านก่อนรอบนี้** (`findEligibleWithPassedSubjects`) นับจากรอบที่ "มาก่อน" เท่านั้น (ปีเก่ากว่า หรือปีเดียวกันแต่ attempt น้อยกว่า) — ห้ามเอารอบอนาคตมาตัดสินอดีต. เงื่อนไขเหมือน `findPassedSubjectIds`: `is_passed`, ไม่ carried_forward, ไม่ rejected

---

## 13. Dashboard: `buildYearSummary` (รายปี) — `GET /api/dashboard/history`

หัวใจ: **นับ "รายคน" ไม่ใช่ "รายใบ"** เพราะคนเดียวส่งได้หลายรอบในปีเดียว

```mermaid
flowchart TD
    S["buildYearSummary(year)"] --> A["rounds ของปีนั้น (ใหม่ → เก่า)<br/>total, pending, eligible, roomTotals"]
    A --> L["วนทีละรอบ"]
    L --> L1["results = ใบของรอบ<br/>sent / counted(notRejected) / confirmed"]
    L1 --> L2["addConfirmedRealPasses → passedByStudent<br/>(เฉพาะ approved และไม่ carried_forward สะสมข้ามรอบ)"]
    L2 --> L3["everStarted += ทุกคนที่มีใบ<br/>latestPaperOf: ใบแรกที่เจอของแต่ละคน = ใบล่าสุด"]
    L3 --> L4{"attempt_number = 1 ?"}
    L4 -->|"ใช่"| L5["เก็บ firstRound, firstRoundSent,<br/>firstRoundConfirmed, วิชาของรอบ 1"]
    L4 -->|"ไม่"| L6
    L5 --> L6["everSubmitted += คนที่ counted<br/>passedByStudentConfirmed / attemptedByStudentConfirmed<br/>(ไว้ทำ perSubject รายปี)"]
    L6 --> L7["roundSummaries.push (submitted, confirmed, fullyPassed ของรอบ)"]
    L7 --> L
    L --> M["requiredSubjectIds = วิชาของรอบ 1<br/>(ไม่มีรอบ 1 = ทุกวิชา)"]
    M --> N["fullyPassedStudents = คนที่ passedSet ครอบคลุม requiredSubjectIds ครบ<br/>(hasPassedAll)"]
    N --> O["byRoom: ส่งแล้ว/ผ่านครบ ต่อห้อง<br/>ตัวหาร = นักศึกษาทั้งห้อง"]
    N --> P["firstAttempt.passed = countFullyPassed(firstRoundConfirmed)<br/>firstYear.passed = fullyPassedStudents.size<br/>ทั้งคู่ rate2 หาร total"]
    N --> Q["passDistribution + firstAttemptBySubject<br/>(เฉพาะถ้ามีรอบ 1)"]
    N --> R["statusByStudent = countByStatus(ใบล่าสุดของแต่ละคน)<br/>+ not_started = total − คนที่มีใบ"]
```

### 13.1 ผ่านครั้งแรก vs ผ่านภายในปีแรก

```mermaid
flowchart LR
    subgraph FA["firstAttempt (ผ่านครั้งแรก)"]
        A1["ดูเฉพาะใบ รอบที่ 1"] --> A2["approved + ผ่านครบวิชารอบ 1"]
    end
    subgraph FY["firstYear (ผ่านภายในปีแรก)"]
        B1["รวมผล approved ของทุกรอบในปี<br/>(1+2+3) ไม่นับ carried_forward"] --> B2["Set วิชาที่ผ่านจริงของแต่ละคน<br/>ครอบคลุมวิชารอบ 1 ครบ"]
    end
    FA --> C["firstYear ≥ firstAttempt เสมอ<br/>(คนผ่านรอบ 1 ถูกนับในปีแรกด้วย)"]
    FY --> C
```

ใช้ฟังก์ชันชุดเดียวกัน (`addConfirmedRealPasses`, `getRequiredSubjectIds`, `hasPassedAll`) ทั้งตัวเลขบนการ์ดและไฟล์ส่งออกรายชื่อ (`buildFirstYearList`) → ตัวเลขต้องตรงกันเสมอ ถ้าจะแก้กฎ แก้ที่เดียว

### 13.2 ตารางผ่านกี่วิชา (`buildPassDistribution`)

```mermaid
flowchart TD
    S["ใบรอบ 1 ที่ approved"] --> A["นับรายคนว่าผ่านกี่วิชา (n)"]
    A --> B["rows[n][ห้อง]++"]
    B --> C["สร้างแถว n = จำนวนวิชา ... 0 (แถวที่ไม่มีคนก็ยังแสดง 0)"]
    C --> D["แถวท้าย not_submitted<br/>= นักศึกษาทั้งห้อง − คนที่ approved รอบ 1 ของห้องนั้น"]
    D --> E["ผลรวมทุกแถว = นักศึกษาทั้งรุ่น เสมอ"]
```

`not_submitted` จึงรวมทั้งคนที่ไม่ส่ง, ค้างรอตรวจ, และถูกตีกลับ (เพราะฐานคือ approved)

### 13.3 ตารางรายวิชารอบแรก (`buildFirstAttemptBySubject`)

ต่อวิชา 3 ช่อง **บวกกัน = ทั้งรุ่น เสมอ**:
- `pass` = approved + ไม่ carried_forward + ผ่าน
- `fail` = approved + ไม่ carried_forward + ไม่ผ่าน
- `not_submitted` = `cohortTotal − pass − fail`

เศษทศนิยม: `notSubmittedRate = 100 − passRate − failRate` (ยกเศษมาช่องสุดท้าย ให้รวมได้ 100.00 พอดี ไม่เป็น 99.99)
`sat = pass + fail` ถ้า 0 = ไม่มีใครสอบวิชานี้ → หน้าจอขึ้นขีด ไม่ใช่ 0.00%
`average_pass_rate` เฉลี่ยเฉพาะวิชาที่ `sat > 0`
แถวรวม: `passed_all` / `failed_any` **นับเป็นคน** ไม่ใช่บวกคอลัมน์ (บวกคอลัมน์จะได้ 156×8 = 1248 ที่ไม่ใช่จำนวนคน)

---

## 14. Dashboard: ตัวอย่างคำนวณด้วยตัวเลข (สมมติ)

รุ่น 2570 มี **100 คน** (`total = 100`) รอบ 1 มี 3 วิชา A B C

| สถานะใบรอบ 1 | จำนวนคน |
|---|---|
| approved ผ่านครบ A B C | 60 |
| approved ผ่าน A B ตก C | 15 |
| pending (รอตรวจ) | 10 |
| rejected | 5 |
| ไม่ส่งเลย | 10 |

คำนวณ:

| ตัวเลข | ค่า | วิธีได้ |
|---|---|---|
| `submitted` | 90 | 60+15+10+5 (ไม่รวมคนไม่ส่ง) |
| `fillRate` | 90% | 90/100 |
| `confirmed` | 75 | 60+15 |
| `fullyPassed` | 60 | approved ผ่านครบ |
| `fullyPassedRate` | 60% | 60/**100** (ทั้งรุ่น) |
| `passRateOfSitters` | 80% | 60/**75** (คนที่ยืนยันแล้ว) |
| `perSubject` C | pass 60, fail 15, rate 80% | นับจาก approved 75 คน |
| `by` | approved 75, submitted 10, rejected 5, draft 0 | |
| `not_started` | 10 | 100 − 90 ใบ |
| `firstAttempt` | 60 คน, 60.00% | |

สังเกต: 60% กับ 80% ไม่ขัดกัน — แค่ตัวหารต่างกัน (ทั้งรุ่น vs คนที่ยืนยันแล้ว) จึงต้องติดป้ายกำกับบนหน้าจอเสมอ
ถ้าเจ้าหน้าที่ยืนยัน pending 10 ใบเพิ่ม (ผ่านครบ 6 ใบ) → `fullyPassed` = 66, `fullyPassedRate` = 66%

---

## 15. Dashboard: แจ้งเตือนของเจ้าหน้าที่/ผู้บริหาร (`buildAlerts`)

คำนวณสดทุกครั้ง **ไม่เก็บลง DB** (เป็น "สถานะตอนนี้" ไม่ใช่เหตุการณ์ จึงไม่มีแจ้งเตือนเก่าค้าง)

```mermaid
flowchart TD
    S["buildAlerts(role)"] --> A{"ไม่มีรอบเลย?"}
    A -->|"ใช่"| Z0["alerts = []"]
    A -->|"ไม่"| B["วนทุกรอบที่ status = open"]
    B --> C["left = วันที่เหลือก่อน close_date<br/>นับเป็น 'วัน' ตามเวลาไทย UTC+7"]
    C --> D{"left < 0 ?"}
    D -->|"ใช่"| D1["เตือน round_overdue<br/>เลยกำหนดแล้ว n วัน ยังไม่ปิด"]
    D -->|"ไม่"| E{"left ≤ 7 ?"}
    E -->|"ใช่"| E1["เตือน round_closing<br/>เหลือ n วัน / วันนี้วันสุดท้าย"]
    E -->|"ไม่"| F
    D1 --> F
    E1 --> F{"0 ≤ left ≤ 7 ?"}
    F -->|"ใช่"| G["buildStats(รอบ)<br/>missing = roundNotStarted + by.draft"]
    G --> G1{"missing > 0 ?"}
    G1 -->|"ใช่"| G2["เตือน not_submitted<br/>(ฐาน = roundTotal ไม่ใช่ทั้งรุ่น)"]
    F -->|"ไม่"| H
    G2 --> H{"role = officer ?"}
    G1 -->|"ไม่"| H
    H -->|"ใช่"| I["วน 'ทุกรอบ' (ไม่ใช่เฉพาะที่เปิด)<br/>pending = by.submitted"]
    I --> J{"pending > 0 ?"}
    J -->|"ใช่"| K["เตือน pending_review<br/>(ใบค้างตรวจของรอบเก่าไม่หาย)"]
    H -->|"ไม่ (executive)"| Z["คืน alerts"]
```

---

## จุดที่คนมักเข้าใจผิด (สรุป)

1. **status กับ phase ไม่ใช่ตัวเดียวกัน** — status เก็บใน DB (เจ้าหน้าที่กด), phase คำนวณตามเวลา
2. **`by.submitted` = รอตรวจ ไม่ใช่ส่งทั้งหมด**
3. **"ผ่าน" ทุกตัว = นับเฉพาะ approved** — pending ไม่เข้า แต่ยังนับเป็น "ส่งแล้ว"
4. **ตัวหารทั้งรุ่น (`total`) รวมบัญชี import ที่ยังไม่เคย login** และไม่กรอง `exam_eligible`
5. **carried_forward ไม่ใช่การสอบจริง** — ไม่นับผู้เข้าสอบ ไม่นับผ่านสะสม
6. **ใบ rejected ไม่นับเป็น "เคยผ่าน"** (เปิดให้กรอกวิชานั้นใหม่) แต่ **pending นับ** (ไม่งั้นต้องกรอกซ้ำก่อนเจ้าหน้าที่ตรวจ)
7. รายปีนับ **รายคน** ถือใบล่าสุดเป็นสถานะปัจจุบัน — ห้ามเอา `by` รายรอบมาบวกกัน (จะเกิน 100%)
8. ทุกที่ที่เปลี่ยนใบ ต้อง **ล็อกแถว `exam_results` ก่อน** แล้วเช็คสถานะซ้ำ — เช็คใน controller เป็นแค่ด่านแรกให้ข้อความชัด
9. `updateMany` ที่ where เป็น `undefined` = กวาดทั้งตาราง (กับดัก Prisma) จึงต้องเช็ค input ก่อนเสมอ
