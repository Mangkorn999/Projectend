# Role เจ้าหน้าที่ตรวจสอบ (reviewer) + audit log — Design

วันที่: 2026-09-19

## Problem

เจ้าหน้าที่คณะมีคนเดียวจริง ต้องตรวจนักศึกษา 200+ คนต่อรอบคนเดียว — คอขวด อาจารย์ที่ปรึกษาสั่งให้ทำระบบแบ่งงานตรวจช่วย โจทย์จริงคือ "เพิ่มคนช่วยตรวจ" ไม่ใช่ "คุมว่าใครตรวจใคร" — ยืนยันกับเจ้าของ repo แล้วว่าไม่ต้องมี assignment รายคน/รายห้อง แค่เปิดให้เจ้าหน้าที่ตรวจสอบคนใหม่หยิบงานจาก queue เดียวกันได้ (pooled)

พ่วงมา 2 เรื่อง:
- ต้องมี audit log ว่าใครตรวจใบไหน เมื่อไหร่ (accountability เมื่อมีคนตรวจมากกว่า 1 คน)
- pooled queue ทำให้ 2 คนเปิดใบเดียวกันพร้อมกันได้ง่ายขึ้น — ปัจจุบันไม่มี guard กันทับกัน (`examResults.controller.js` `reviewExamResult` update ตรงๆ ไม่เช็คสถานะก่อน) ต้องปิดช่องนี้ไปพร้อมกัน ไม่งั้นเป็นบัคแฝงที่ยิ่งมีคนตรวจเยอะยิ่งเจอบ่อย

## Scope

- Backend: `prisma/schema.prisma` (+1 table `review_logs`, +1 migration), `prisma/seed.js` (+role row), `users` module (role allowlists), `examResults` module (repository+controller — guarded update + log), `students.routes.js` (เพิ่ม role ที่เข้าถึง `GET /:id`), `examResults.routes.js` (เพิ่ม role เข้าถึง GET all/approve/reject)
- Frontend: `app.jsx` (`ROLE_PAGES`, `DEFAULT_PAGE`), `studentDetailReal.jsx` (แยก edit/review permission), `manageUsersReal.jsx` (เพิ่มตัวเลือก role), `i18n.js`
- ไม่แตะ: dashboard, rounds, subjects, news, certificates upload, student self-service flow, ตาราง `exam_results`/`students` เดิม (ไม่เพิ่ม column)

---

## Design

### A. Role ใหม่ `reviewer` — เห็นแค่คิวตรวจ

`prisma/seed.js` เพิ่ม 1 แถวใน roles seed:

```js
{ role_name: "reviewer", description: "เจ้าหน้าที่ตรวจสอบ" },
```

(ต้องแก้ `demoSeed.js` / `seedDemoYears.js` ให้ seed role นี้ด้วยถ้ามี roles array แยก — เจอบัคลักษณะนี้มาก่อนแล้วตอน `first_name_en` ตอน 17 ก.ย.)

`users.controller.js` — เพิ่ม `"reviewer"` เข้า allowlist ทั้งสองจุด:

```js
const CREATABLE_ROLES = ["officer", "executive", "reviewer"];
...
const ASSIGNABLE_ROLES = ["student", "officer", "executive", "reviewer"];
```

Backend route ที่ reviewer ต้องเข้าได้ (เพิ่ม `"reviewer"` เข้า `requireRole(...)` เดิม ไม่สร้าง route ใหม่):

| Route | เดิม | แก้เป็น |
|---|---|---|
| `GET /api/exam-results` | `requireRole("officer")` | `requireRole("officer", "reviewer")` |
| `PATCH /api/exam-results/:id/approve` | `requireRole("officer")` | `requireRole("officer", "reviewer")` |
| `PATCH /api/exam-results/:id/reject` | `requireRole("officer")` | `requireRole("officer", "reviewer")` |
| `GET /api/students/:id` | `requireRole("officer", "student")` | `requireRole("officer", "student", "reviewer")` |

Route ที่**ไม่แตะ** (ยัง officer/executive เท่านั้น ตาม `requireRole` เดิม): `/api/dashboard/*`, `/api/rounds*`, `/api/subjects*`, `/api/users*` (ยกเว้น allowlist ข้างบน), `/api/news*` (จัดการ), `/api/students` (list ทั้งหมด), `/api/students/import`, `/api/students/bulk-eligible`

Frontend `app.jsx`:

```js
const DEFAULT_PAGE = { student:'news', officer:'dashboard', executive:'dashboard', reviewer:'review' };
const ROLE_PAGES = {
  student: [...],
  officer: [...],
  executive: ['dashboard', 'reports'],
  reviewer: ['review', 'detail'], // 'detail' ต้องมี — คลิกแถวในคิวตรวจพาไปหน้านี้ (ดู B)
};
```

`NEEDS_SELECTION` มี `'detail'` อยู่แล้ว — รีเฟรชหน้า detail ตรงๆ ไม่มี `sel` ก็เด้งกลับ `review` ให้เองเหมือน officer วันนี้ ไม่ต้องแก้

---

### B. แยกสิทธิ์ "แก้ไขข้อมูล" กับ "ตรวจสอบ" ใน `studentDetailReal.jsx`

ตอนนี้ component รับ prop `readonly` ตัวเดียว (executive ใช้ = `true` → ซ่อนทั้งปุ่มแก้ไขข้อมูล **และ** ปุ่มยืนยัน/ตีกลับพร้อมกัน) reviewer ต้องการสลับกัน: **เห็นปุ่มยืนยัน/ตีกลับ แต่ไม่เห็นปุ่มแก้ไขข้อมูล** — `readonly` ตัวเดียวไม่พอ ต้องแยกเป็น 2 flag

```jsx
// เดิม
export function StudentDetailReal({ student, go, toast, readonly, lang }) {
  ...
  {!readonly && <button onClick={openEdit}>แก้ไขข้อมูล</button>}
  ...
  {!readonly && status === 'SUBMITTED' && <div>...ปุ่มยืนยัน/ตีกลับ...</div>}

// ใหม่
export function StudentDetailReal({ student, go, toast, canEdit, canReview, lang }) {
  ...
  {canEdit && <button onClick={openEdit}>แก้ไขข้อมูล</button>}
  ...
  {canReview && status === 'SUBMITTED' && <div>...ปุ่มยืนยัน/ตีกลับ...</div>}
```

จุดเรียกใน `app.jsx` (3 จุด ตาม role ที่เปิดหน้านี้ได้):

```jsx
// officer
<StudentDetailReal student={sel} go={go} toast={showToast} canEdit canReview lang={lang} />
// executive (readonly เดิม)
<StudentDetailReal student={sel} go={go} toast={showToast} canEdit={false} canReview={false} lang={lang} />
// reviewer (ใหม่)
<StudentDetailReal student={sel} go={go} toast={showToast} canEdit={false} canReview lang={lang} />
```

หน้า "ข้อมูลนักศึกษา" (list เต็ม, filter, ลบ, รีเซ็ตรหัส) กับ "นำเข้ารายชื่อ" ไม่อยู่ใน `ROLE_PAGES.reviewer` อยู่แล้ว (ข้อ A) — reviewer เข้าไม่ได้ทั้งฝั่งหน้าจอและ backend (`requireRole("officer")` เดิมของ endpoint พวกนั้นไม่แตะ)

---

### C. กัน 2 คนตรวจใบเดียวกันทับกัน

ปัญหาปัจจุบัน (`examResults.controller.js` `reviewExamResult`): `findById` เช็คว่าใบมีอยู่ → `updateStaffStatus` เขียนทับตรงๆ ไม่เช็คว่าสถานะเปลี่ยนไปแล้วหรือยังระหว่างนั้น — คนกดทีหลังชนะเงียบๆ ไม่มี error ทั้งสองฝั่ง

`examResults.repository.js` — เปลี่ยนจาก `update` (where เฉพาะ unique key) เป็น `updateMany` (where เพิ่มเงื่อนไขสถานะได้ เป็น optimistic guard):

```js
// เดิม: update({ where: { result_id } }) — ไม่มีทางใส่เงื่อนไข staff_status ใน where ได้ (update ต้องการ unique field ล้วน)
// ใหม่: updateMany คืน { count } ให้เช็คว่าจริงๆ อัปเดตกี่แถว
export const updateStaffStatusIfSubmitted = (result_id, { staff_status, remark, confirmed_by }) =>
  prisma.examResult.updateMany({
    where: { result_id: Number(result_id), staff_status: "submitted" }, // เงื่อนไขกันชน
    data: { staff_status, remark: remark ?? null, confirmed_by, confirmed_at: new Date() },
  });
```

`examResults.controller.js` `reviewExamResult` — เพิ่มเช็ค `count`:

```js
const existing = await examRepo.findById(req.params.id);
if (!existing) throw httpError("ไม่พบผลสอบที่ระบุ", 404);
if (existing.staff_status !== "submitted") {
  throw httpError("ใบนี้ถูกตรวจไปแล้ว กรุณารีเฟรชหน้า", 409);
}
// ... (remark validation เดิม)

const { count } = await examRepo.updateStaffStatusIfSubmitted(req.params.id, {...});
if (count === 0) {
  // แพ้ race แม้ผ่านเช็คแรกมาแล้ว — อีกคนตรวจแทรกระหว่างนี้พอดี
  throw httpError("ใบนี้ถูกตรวจไปแล้ว กรุณารีเฟรชหน้า", 409);
}
const result = await examRepo.findById(req.params.id); // ดึงค่าล่าสุดไปตอบ response
```

Guard นี้มีผลกับ **ทุกคนที่ตรวจได้** (officer เดิมด้วย ไม่ใช่แค่ reviewer) — เป็นบัคแฝงที่มีอยู่แล้ว แก้ครั้งเดียวจบ

---

### D. Audit log — ตาราง `review_logs`

Insert-only แยกจาก `exam_results.confirmed_by/confirmed_at` (ที่ถูกทับได้ทุกครั้งที่ตรวจซ้ำ) เก็บ**ทุกครั้ง**ที่มีการ approve/reject ไม่ใช่แค่ครั้งล่าสุด

```prisma
model ReviewLog {
  log_id        Int        @id @default(autoincrement())
  result_id     Int
  reviewer_id   Int
  action        String     @db.VarChar(20) // "approved" | "rejected"
  remark        String?    @db.Text        // snapshot ของ remark ตอนตรวจครั้งนั้น (ถ้ามี)
  created_at    DateTime   @default(now())
  exam_result   ExamResult @relation(fields: [result_id], references: [result_id])
  reviewer      User       @relation(fields: [reviewer_id], references: [user_id])

  @@map("review_logs")
}
```

เพิ่ม relation ฝั่ง `ExamResult` และ `User` (`review_logs ReviewLog[]`) ตาม pattern เดิมของไฟล์นี้

Insert **หลัง** guard ใน C ผ่านแล้วเท่านั้น (`count > 0`) — ไม่ใช้ `prisma.$transaction` มัดสองคำสั่งเข้าด้วยกัน เพราะ `reviewLog.create` ต้องรู้ผลของ `updateMany` ก่อนว่าควร insert ไหม (ทำพร้อมกันในทรานแซกชันเดียวจะ insert log ไปก่อนรู้ผลจริง):

```js
const { count } = await examRepo.updateStaffStatusIfSubmitted(req.params.id, {
  staff_status, remark: remarkToSave, confirmed_by: req.user.userId,
});
if (count === 0) throw httpError("ใบนี้ถูกตรวจไปแล้ว กรุณารีเฟรชหน้า", 409);

// การตรวจสำเร็จแล้ว (DB commit ผ่าน) — insert log พลาดไม่ควรทำให้ request นี้ error
// (จะทำให้เจ้าหน้าที่เห็นว่าตัวเอง "ตรวจไม่สำเร็จ" ทั้งที่จริงสำเร็จแล้ว) log error ไว้ฝั่ง server แทน
try {
  await reviewLogRepo.create({
    result_id: Number(req.params.id),
    reviewer_id: req.user.userId,
    action: staff_status,
    remark: remarkToSave,
  });
} catch (e) {
  console.error("บันทึก review_logs ไม่สำเร็จ:", e.message);
}
```

**ไม่ทำ endpoint อ่าน log** ตอนนี้ (ดู Out of scope) — เจ้าของ repo query ผ่าน DB ตรงได้ถ้าต้องใช้ก่อนมี UI

---

### E. หน้าจัดการผู้ใช้งาน (`manageUsersReal.jsx`)

เพิ่มตัวเลือก role "เจ้าหน้าที่ตรวจสอบ" ในฟอร์มสร้างบัญชี/เปลี่ยน role (dropdown เดิมที่มี officer/executive อยู่แล้ว) — งานเล็ก ใช้ pattern เดียวกับที่มีอยู่ ไม่ต้องออกแบบ UI ใหม่

---

## Testing

| # | เคส | คาดหวัง |
|---|---|---|
| 1 | สร้างบัญชี role reviewer → login | เห็นแค่เมนู "ตรวจสอบ/ยืนยันผล" ในไซด์บาร์ |
| 2 | reviewer พิมพ์ URL `/dashboard`, `/students`, `/rounds` ตรงๆ | เด้งกลับหน้า `review` (frontend guard) |
| 3 | reviewer ยิง `GET /api/dashboard/stats` ตรงๆ (Postman) | 403 |
| 4 | reviewer เปิดใบ `submitted` → กดยืนยัน | สำเร็จ, `exam_results.confirmed_by` = reviewer, มีแถวใหม่ใน `review_logs` |
| 5 | reviewer เปิดหน้า detail นักศึกษา | เห็นปุ่มยืนยัน/ตีกลับ, **ไม่มี** ปุ่ม "แก้ไขข้อมูล" |
| 6 | officer กับ reviewer เปิดใบเดียวกัน (`submitted`) พร้อมกัน — คนแรกกด approve, คนสองกด reject ตามหลัง (ไม่รีเฟรช) | คนแรกสำเร็จ, คนสองได้ 409 "ถูกตรวจไปแล้ว" ไม่ทับ |
| 7 | ใบเดิมถูกตีกลับ → นักศึกษาส่งใหม่ → officer อีกคนยืนยัน | `review_logs` มี 2 แถวของใบเดียวกัน (reject ครั้งแรก + approve ครั้งหลัง) คนละ reviewer_id ได้ |
| 8 | executive เปิดหน้า detail (regression) | ยังเห็น readonly เหมือนเดิม ไม่มีทั้งปุ่มแก้ไขและยืนยัน/ตีกลับ |
| 9 | officer เปิดหน้า detail (regression) | เห็นทั้งปุ่มแก้ไขและยืนยัน/ตีกลับเหมือนเดิม |

รัน `backend/tests/` ทั้งชุดหลังแก้ (reseed ก่อน) — ต้องเพิ่มเคส reviewer ในชุด smoke test ด้วย (ไฟล์ใหม่ `smoke-phase15-reviewer.mjs` หรือรวมเข้า phase ที่ใกล้เคียง)

## Out of scope

- Assignment table / มอบหมายงานรายคน-รายห้อง (ยืนยันแล้วว่าไม่ต้องการ — โจทย์จริงคือเพิ่มคนช่วย ไม่ใช่คุมการกระจาย)
- Workload dashboard/สรุปรายคน (query จาก `review_logs` เอาได้ทีหลังถ้าต้องใช้จริง ไม่ต้องมี UI ตอนนี้)
- Endpoint อ่าน `review_logs`
- แจ้งเตือน officer/reviewer เวลามีคนตรวจซ้อน (409 ตอบกลับตรงๆ พอสำหรับตอนนี้)
- scope ตาม room/academic_year สำหรับ reviewer

## Follow-up

- `review_logs` ออกแบบไว้รองรับ "workload รายคน" อยู่แล้ว (`GROUP BY reviewer_id`) — ถ้าวันหน้าต้องการหน้าสรุป ไม่ต้องแก้ schema เพิ่ม
- ต้องอัปเดต `backend/BACKEND_GUIDE.md` (endpoint ใหม่/role ใหม่/schema/Changelog) ในคอมมิตเดียวกับโค้ด ตามกติกาใน `CLAUDE.md`
- ถ้าจำนวน reviewer เพิ่มจนคิวรวมเริ่มชนกันบ่อย (409 ขึ้นถี่) ค่อยพิจารณา assignment จริงจังตอนนั้น
