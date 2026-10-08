# วิธีไล่โค้ด: หน้าเว็บ → frontend → backend → DB

เอกสารสั้นสำหรับตอบคำถามว่า "ปุ่ม/ตัวเลขนี้มาจากไหน" ใช้ได้กับทุกหน้าในระบบ
ตัวอย่างหลักคือปุ่ม **"ยืนยัน"** ผลสอบ (เจ้าหน้าที่) ตัวอย่างรองคือแถว **"รายชื่อนักศึกษาที่สอบผ่านภายในปี 2569"**

---

## ภาพรวม 1 บรรทัด

```
หน้าเว็บ → ไฟล์ .jsx → apiFetch/downloadFile → [HTTP] → routes → controller → service → repository → Prisma → ตาราง DB
```

ตัวเชื่อมแต่ละชั้นคือ **"ชื่อ"**: ข้อความ → key → ฟังก์ชัน → path → ฟังก์ชัน → โมเดล → ตาราง
ไล่ตามชื่อไปเรื่อยๆ ก็เจอ

---

## ส่วน A: หน้าเว็บ → ไฟล์ frontend

1. **ดูว่าอยู่เมนูไหน** เช่น เจ้าหน้าที่ → เมนู "ตรวจผลสอบ"
2. เปิด `frontend/src/design/app.jsx` ค้นชื่อเมนู จะเจอ `k:'review'` และบรรทัด `if(page==='review') return <OfficerReviewReal .../>`
   → รู้ว่าเมนูนี้เปิดไฟล์ไหน (`officerReviewReal.jsx`)
3. **ถ้ารู้แค่ข้อความบนจอ** กด `Ctrl+Shift+F` ค้นข้อความนั้นทั้งโปรเจกต์
   - ข้อความไทย/อังกฤษส่วนใหญ่เก็บใน `frontend/src/design/i18n.js` เป็น key เช่น `'export.rowFirstYearPass'`
   - ให้ค้น **ชื่อ key** ต่อ จะเจอไฟล์หน้าที่ใช้จริง (`reportsReal.jsx`)

**จบส่วน A เมื่อ:** รู้ชื่อไฟล์ `*.jsx` ของหน้า

---

## ส่วน B: ในไฟล์หน้า → จุดที่ยิง API

4. ในไฟล์หน้า หาปุ่ม (`onClick=...`) แล้วกด `F12` (Go to Definition) ที่ชื่อฟังก์ชัน
5. ไล่ต่อจนเจอบรรทัดที่เรียก **`apiFetch(`** หรือ **`downloadFile(`** (นิยามอยู่ใน `frontend/src/design/api.js`)
6. ในวงเล็บคือ **path + method** ซึ่งคือจุดเชื่อมไป backend:

| ปุ่ม | ไฟล์ | บรรทัดที่ยิง API |
|---|---|---|
| ยืนยัน/ตีกลับ | `studentDetailReal.jsx` (`review()`) | `apiFetch('/exam-results/${id}/approve', { method: 'PATCH', body })` |
| ส่งออกรายชื่อผ่านภายในปี | `yearExports.js` | `downloadFile('/dashboard/export-first-year?year=…&passed=…&format=…')` |

> เคล็ดลับ: `import` บนสุดของไฟล์บอกว่าฟังก์ชันที่ใช้มาจากไฟล์ไหน
> (เช่น `import { downloadFirstYearList } from './yearExports.js'`)

**จบส่วน B เมื่อ:** ได้ path เช่น `/exam-results/12/approve` และ method `PATCH`

---

## ส่วน C: path → backend

Base URL คือ `http://localhost:3000/api` ดังนั้น `/exam-results/12/approve` คือ `PATCH /api/exam-results/12/approve`

7. **path ส่วนแรก = โฟลเดอร์โมดูล** ดูจาก `backend/src/app.js`:
   `app.use("/api/exam-results", examResultsRouter)` → โฟลเดอร์ `backend/src/modules/examResults/`
8. เปิด `xxx.routes.js` ในโฟลเดอร์นั้น หา path ส่วนที่เหลือ (`/:id/approve`) + method ที่ตรงกัน
   ทุกบรรทัดมี comment `// ปุ่ม "..." → ...` กำกับไว้
   ```js
   router.patch("/:id/approve", authenticate, requireRole("officer","reviewer"), approve);
   ```
   - `authenticate` = ต้อง login (เช็ค cookie), `requireRole(...)` = เช็คสิทธิ์
   - ชื่อสุดท้าย (`approve`) = ฟังก์ชันที่จะทำงานต่อ
9. กด `F12` ที่ `approve` ไป **controller** (`examResults.controller.js`)
   - controller รับค่าจาก `req.params/req.query/req.body` ตรวจค่า แล้วเรียกชั้นล่าง
   - มองหาบรรทัดที่ขึ้นต้นด้วย `xxxService.` / `xxxRepo.` = ชั้นถัดไป (ชื่อ import อยู่บนสุดของไฟล์)
10. **service** (`xxx.service.js`, ถ้ามี) = คำนวณ/กฎธุรกิจ เช่น `buildHistory` ในโมดูล dashboard
    บางโมดูลไม่มี service (controller เรียก repository ตรง)
11. **repository** (`xxx.repository.js`) = ชั้นล่างสุดที่คุยกับ DB ผ่าน Prisma
    ```js
    prisma.examResult.updateMany({ where: {...}, data: { staff_status, remark, ... } })
    ```

| ชั้น | หน้าที่ | ถามตัวเอง |
|---|---|---|
| routes | จับคู่ URL + เช็คสิทธิ์ | URL นี้ใครเรียกได้ |
| controller | รับ request / ส่ง response | รับอะไร ส่งอะไรกลับ |
| service | คำนวณ / กฎธุรกิจ | คิดยังไง นับเฉพาะอะไร |
| repository | อ่าน/เขียน DB | ใช้ตารางไหน |

**จบส่วน C เมื่อ:** เจอบรรทัด `prisma.<ชื่อโมเดล>.<คำสั่ง>`

---

## ส่วน D: Prisma → ตาราง DB

12. ชื่อหลัง `prisma.` คือชื่อ **model** (ตัวแรกเล็ก): `prisma.examResult` = model `ExamResult`
13. เปิด `backend/prisma/schema.prisma` ค้น `model ExamResult` จะเห็นคอลัมน์ทั้งหมด
    บรรทัด `@@map("exam_results")` ท้าย model บอกชื่อ **ตารางจริงใน PostgreSQL**
14. คำสั่ง Prisma ↔ SQL

| Prisma | SQL |
|---|---|
| `findMany` / `findUnique` | `SELECT` |
| `create` | `INSERT` |
| `update` / `updateMany` | `UPDATE` |
| `delete` / `deleteMany` | `DELETE` |
| `$transaction([...])` | `BEGIN … COMMIT` (ทำพร้อมกัน พังก็ย้อนทั้งก้อน) |

**จบส่วน D เมื่อ:** รู้ชื่อตาราง เช่น `exam_results`

---

## ตัวอย่างเต็ม: ปุ่ม "ยืนยัน"

| ชั้น | ไฟล์ | ทำอะไร |
|---|---|---|
| หน้าเว็บ | หน้ารายละเอียดนักศึกษา (เจ้าหน้าที่) | กดปุ่ม "ยืนยัน" |
| frontend | `studentDetailReal.jsx` → `review('approve')` | เตรียม body แล้วเรียก `apiFetch` |
| ตัวเชื่อม | `api.js` → `apiFetch` | ยิง `PATCH /api/exam-results/12/approve` พร้อม cookie |
| route | `examResults.routes.js` | `authenticate` → `requireRole("officer","reviewer")` → `approve` |
| controller | `examResults.controller.js` → `approve` → `reviewExamResult` | ตรวจกฎ (เช่น ต้องมีไฟล์หลักฐาน) |
| repository | `examResults.repository.js` → `reviewWithLock` | ใน transaction: ล็อกแถว → ตรวจซ้ำ → `updateMany` |
| DB | ตาราง `exam_results` | `staff_status = 'approved'`, `confirmed_by`, `confirmed_at` |
| ผลข้างเคียง | `reviewLogRepo.create`, `notifRepo.create` | เขียน `review_logs` (ใครทำ) + `notifications` (แจ้งนักศึกษา) |
| ตอบกลับ | controller → `res.json({ success: true, data })` | frontend โหลดข้อมูลใหม่ ป้ายเปลี่ยนเป็น "ยืนยันแล้ว" |

## ตัวอย่างรอง: ตัวเลข/กราฟที่มาจากการคำนวณ

`GET /api/dashboard/history?years=3` (หน้า Dashboard)

```
dashboard.routes.js        router.get("/history", ..., getHistory)
dashboard.controller.js    getHistory      → dashService.buildHistory(3)
dashboard.service.js       buildHistory    → dashRepo.findAcademicYears() แล้ว buildYearSummary() คำนวณผ่าน/ไม่ผ่าน
dashboard.repository.js    findAcademicYears → prisma.submissionRound.findMany(...)
DB                         ตาราง submission_rounds (model SubmissionRound)
```

---

## ทางลัดที่ใช้ได้ตลอด

| ต้องการ | ทำ |
|---|---|
| ไปที่ที่ฟังก์ชันถูกเขียน | คลิกที่ชื่อ → `F12` |
| ดูว่าใครเรียกฟังก์ชันนี้ | คลิกที่ชื่อ → `Shift+F12` |
| ค้นทั้งโปรเจกต์ | `Ctrl+Shift+F` |
| ดู request ตอนกดจริง | terminal backend จะพิมพ์ `PATCH /api/exam-results/12/approve -> 200 (…ms) user=… role=…` |
| ดูใน browser | F12 → แท็บ Network → เลือก Fetch/XHR → รีเฟรช (ติ๊ก Preserve log) |

## ถ้าไล่แล้วติด

- **หา path ไม่เจอใน frontend:** ค้น `apiFetch(` ในไฟล์หน้านั้น หรือดู terminal backend ตอนกดปุ่ม จะเห็น path ทันที
- **หา route ไม่เจอ:** path ที่มี `:id` เปลี่ยนตัวเลขเป็น `:id` ก่อนค้น (`/12/approve` → `/:id/approve`)
- **สับสนว่าตารางไหน:** ดู `schema.prisma` ค้นชื่อ model ที่เห็นหลัง `prisma.`
- **เอกสารอื่นที่ช่วย:** `docs/api-demo-map.md` (ตาราง ปุ่ม → API → ตาราง ครบทุก role), `backend/BACKEND_GUIDE.md` (อธิบาย backend ละเอียด)
