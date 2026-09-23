# Role เจ้าหน้าที่ตรวจสอบ (reviewer) + audit log — Design

วันที่: 2026-09-19

## Problem

เจ้าหน้าที่คณะมีคนเดียวจริง ต้องตรวจนักศึกษา 200+ คนต่อรอบคนเดียว — คอขวด อาจารย์ที่ปรึกษาสั่งให้ทำระบบแบ่งงานตรวจช่วย โจทย์จริงคือ "เพิ่มคนช่วยตรวจ" ไม่ใช่ "คุมว่าใครตรวจใคร" — ยืนยันกับเจ้าของ repo แล้วว่าไม่ต้องมี assignment รายคน/รายห้อง แค่เปิดให้เจ้าหน้าที่ตรวจสอบคนใหม่หยิบงานจาก queue เดียวกันได้ (pooled)

พ่วงมา 2 เรื่อง:
- ต้องมี audit log ว่าใครตรวจใบไหน เมื่อไหร่ (accountability เมื่อมีคนตรวจมากกว่า 1 คน)
- pooled queue ทำให้ 2 คนเปิดใบเดียวกันพร้อมกันได้ง่ายขึ้น — ปัจจุบันไม่มี guard กันทับกัน (`examResults.controller.js` `reviewExamResult` update ตรงๆ ไม่เช็คสถานะก่อน) ต้องปิดช่องนี้ไปพร้อมกัน ไม่งั้นเป็นบัคแฝงที่ยิ่งมีคนตรวจเยอะยิ่งเจอบ่อย

## Scope

- Backend: `prisma/schema.prisma` (+1 table `review_logs`, apply ด้วย `db push` — dev DB ไม่มี migration history จริงอยู่แล้ว ตาม known gap ใน `BACKEND_GUIDE.md` changelog 17 ก.ย. ไม่ใช้ `migrate dev` เพราะจะพยายามไล่ตาม drift เก่าที่ไม่เกี่ยวกับ feature นี้), `prisma/seed.js` (+role row), `users` module (role allowlists), `examResults` module (repository+controller — guarded update + log), `students.routes.js` (เพิ่ม role ที่เข้าถึง `GET /:id`), `examResults.routes.js` (เพิ่ม role เข้าถึง GET all/approve/reject), `tests/cleanupYears.mjs` (ลบ `review_logs` ก่อน `exam_results` กัน FK พัง)
- Frontend: `app.jsx` (`ROLE_PAGES`, `DEFAULT_PAGE`, `NAV`), `studentDetailReal.jsx` (แยก edit/review permission), `manageUsersReal.jsx` (เพิ่ม role เข้า `load()` filter + `ROLE_LABEL` + dropdown — 3 จุด ดู E), `i18n.js` (+`role.reviewer` TH/EN)
- ไม่แตะ: dashboard, rounds, subjects, news, certificates upload, student self-service flow, ตาราง `exam_results`/`students` เดิม (ไม่เพิ่ม column)

---

## Design

### A. Role ใหม่ `reviewer` — เห็นแค่คิวตรวจ

`prisma/seed.js` เพิ่ม 1 แถวใน roles seed:

```js
{ role_name: "reviewer", description: "เจ้าหน้าที่ตรวจสอบ" },
```

(เช็คแล้ว — `demoSeed.js`/`seedDemoYears.js` ไม่มี roles array ของตัวเอง แค่ `findFirst` role ที่ `seed.js` สร้างไว้ ไม่ต้องแก้ 2 ไฟล์นี้)

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
| `GET /api/students` | `requireRole("officer")` | `requireRole("officer", "reviewer")` |

`GET /api/students` ต้องเปิดด้วย — คิวตรวจ (`OfficerReviewReal`, reuse ตัวเดิมกับ reviewer) ต้องใช้ roster เต็มทำแท็บ "ยังไม่กรอก" (หาว่าใครในรุ่นยังไม่มีผลสอบเลย) ข้อมูลที่คืนเป็น field ปลอดภัยชุดเดียวกับที่ reviewer เห็นอยู่แล้วผ่าน exam-results (ชื่อ/ห้อง ไม่มี national_id/password_hash) ไม่ใช่ข้อมูลเพิ่มเติมจริง

Route ที่**ไม่แตะ** (ยัง officer/executive เท่านั้น ตาม `requireRole` เดิม): `/api/dashboard/*` (**สำคัญ** — reviewer ต้องไม่เห็นสถิติ ตามโจทย์), `/api/rounds*`, `/api/subjects*`, `/api/users*` (ยกเว้น allowlist ข้างบน), `/api/news*` (จัดการ), `/api/students/import`, `/api/students/bulk-eligible`

**ผลข้างเคียงที่ยอมรับ:** `OfficerReviewReal` ยิง `GET /dashboard/stats` คู่กับ `/exam-results` เพื่อเอา `alreadyPassedStudentIds` มาตัดคนที่ผ่านครบไปแล้วออกจากแท็บ "ยังไม่กรอก" — reviewer เรียกแล้วจะ 403 (ตั้งใจ ไม่เปิดให้ตามข้อบนนี้) โค้ดเดิมมี `.catch(() => ({}))` ดักไว้แล้วจึงไม่พังทั้งหน้า แค่แท็บนั้นของ reviewer อาจมีชื่อคนที่ผ่านครบแล้วติดมาบ้าง (เหมือนกรณี `/dashboard/stats` ล้มด้วยเหตุอื่นที่มีอยู่แล้วในโค้ดเดิม) ยอมรับได้ ไม่ต้องแก้เพิ่ม

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

`app.jsx` มีอีกจุดที่ต้องเพิ่ม `reviewer` ที่ spec รอบแรกพลาดไป — `NAV` (object คุมเมนู sidebar จริง แยกจาก `ROLE_PAGES` ที่คุมแค่ URL-refresh guard) ไม่มี key `reviewer` เลย ถ้าไม่เพิ่ม `nav = NAV(lang, pendingCount)[role]` จะได้ `undefined` แล้ว `Sidebar` พังตอน map:

```js
const NAV = (lang, pendingCount)=>({
  student: [...],
  officer: [...],
  executive: [...],
  reviewer: [
    { k:'review', label:translate(lang,'nav.officer.review'), icon:'checkCircle' }, // ใช้ key เดิม ข้อความเดียวกับของ officer
  ],
});
```

และ `render()` ต้องเพิ่ม block `if(role==='reviewer')` ใหม่ทั้งก้อน (reuse component เดิม ไม่มีของใหม่):

```jsx
if(role==='reviewer'){
  if(page==='review') return <OfficerReviewReal go={go} setSel={setSel} lang={lang} />;
  if(page==='detail') return <StudentDetailReal student={sel} go={go} toast={showToast} canEdit={false} canReview lang={lang} />;
}
```

---

### B. แยกสิทธิ์ "แก้ไขข้อมูล" กับ "ตรวจสอบ" ใน `studentDetailReal.jsx`

ตอนนี้ component รับ prop `readonly` แต่**ไม่มีใครเรียกส่ง prop นี้จริง** — `app.jsx` มี call site เดียว (officer, บรรทัด 373) ผู้บริหารไม่มีสิทธิ์เข้าหน้านี้แล้ว (data minimization, ตัดออกไปก่อนหน้านี้) คอมเมนต์ในไฟล์ที่พูดถึง executive เป็นของเก่าที่ไม่ตรงกับ `app.jsx` จริงแล้ว. reviewer ต้องการ **เห็นปุ่มยืนยัน/ตีกลับ แต่ไม่เห็นปุ่มแก้ไขข้อมูล** — `readonly` ตัวเดียวไม่พอ (all-or-nothing) ต้องแยกเป็น 2 flag

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

จุดเรียกใน `app.jsx` (2 จุด — officer เดิม 1 + reviewer ใหม่ 1, executive ไม่มีเพราะเข้าหน้านี้ไม่ได้อยู่แล้ว):

```jsx
// officer (เดิมบรรทัด 373 — เพิ่ม canEdit canReview)
<StudentDetailReal student={sel} go={go} toast={showToast} canEdit canReview lang={lang} />
// reviewer (ใหม่ — เพิ่ม if(role==='reviewer') block ทั้งก้อน)
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

**ห้ามหาย:** `reviewExamResult` เดิม (ก่อนแก้) มี `notifRepo.create(...)` แจ้งนักศึกษาเจ้าของผลสอบหลัง approve/reject (ใช้ `existing.round.attempt_number`/`academic_year` ทำ label ข้อความ, fire-and-forget `.catch(...)` เดิม) — snippet C/D ข้างบนโชว์แค่ guard+updateMany+log เพื่อไม่ให้รก ไม่ได้แปลว่าตัดบล็อกนี้ทิ้ง ต้องคงไว้ต่อจาก guard `count === 0` ผ่านแล้ว ใช้ `existing` (fetch ไว้ก่อน guard) ได้เลย ไม่ต้อง fetch ซ้ำ — ถ้าตัดออกจริง นักศึกษาจะไม่ได้แจ้งเตือนตอนใบถูกยืนยัน/ตีกลับอีกเลย (silent, ไม่มี error ให้เห็น)

**ไม่ทำ endpoint อ่าน log** ตอนนี้ (ดู Out of scope) — เจ้าของ repo query ผ่าน DB ตรงได้ถ้าต้องใช้ก่อนมี UI

---

### E. หน้าจัดการผู้ใช้งาน (`manageUsersReal.jsx`)

ไม่ใช่แค่เพิ่ม `<option>` — เช็คโค้ดจริงแล้วมี 3 จุดต้องแก้ ไม่งั้นสร้างบัญชี reviewer ได้แต่จัดการต่อไม่ได้เลย:

1. **`load()` (บรรทัด 27)** — `apiFetch('/users').then(all => setUsers(all.filter(u => u.role.role_name === 'officer' || u.role.role_name === 'executive')))` filter ตัด reviewer ออกจากตารางตั้งแต่ดึงมา ต้องเพิ่ม `|| u.role.role_name === 'reviewer'` ไม่งั้นบัญชี reviewer ที่สร้างไปจะไม่โผล่ในตารางเลย → กด reset-password/revoke จาก row ไม่ได้ (ปุ่มพวกนี้ทำงานกับ `user.user_id` ที่มาจากตารางนี้เท่านั้น)
2. **`ROLE_LABEL` (บรรทัด 25)** — `{ officer: tt('role.officer'), executive: tt('role.executive') }` ไม่มี key `reviewer` → chip label ในตาราง (บรรทัด 86, `ROLE_LABEL[u.role.role_name]`) จะว่างเปล่าถ้าไม่เพิ่ม `reviewer: tt('role.reviewer')`
3. **dropdown สร้าง/เปลี่ยน role (บรรทัด 112-114)** — เพิ่ม `<option value="reviewer">{tt('role.reviewer')}</option>` ตาม pattern เดิม (อันนี้เดียวที่เป็นงานเล็กจริง)

**`i18n.js`** — เพิ่ม key `role.reviewer` 2 จุด (TH บรรทัด ~32 ต่อจาก `role.executive`, EN บรรทัด ~895) จำเป็นไม่ใช่แค่หน้านี้ — `TopBar` (`app.jsx:393`, `roleLabel={translate(lang,'role.'+role)}`) ใช้โชว์ role ของ**คนที่ login เอง**ในหัวเว็บด้วย ถ้าไม่เพิ่ม reviewer login แล้วเห็น key ดิบๆ แทนชื่อ role

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
| 8 | officer เปิดหน้า detail (regression) | เห็นทั้งปุ่มแก้ไขและยืนยัน/ตีกลับเหมือนเดิม |
| 9 | executive พิมพ์ URL `/students/detail` ตรงๆ (regression) | เด้งกลับ `dashboard` เหมือนเดิม — role นี้เข้าหน้านี้ไม่ได้อยู่แล้ว ไม่เกี่ยวกับ feature นี้ |
| 10 | reviewer กด approve/reject → เช็คฝั่งนักศึกษา (หรือแถว `notifications`) | นักศึกษาได้รับแจ้งเตือนเหมือน officer กดเป๊ะ (regression ของ `notifRepo.create` เดิมใน `reviewExamResult` — ห้ามหายตอนใส่ guard/log ใหม่) |
| 11 | officer สร้างบัญชี reviewer แล้วกลับไปหน้า "จัดการผู้ใช้งาน" | บัญชี reviewer โผล่ในตาราง, chip role ขึ้น "เจ้าหน้าที่ตรวจสอบ" ไม่ใช่ค่าว่าง, กด reset-password/revoke ได้ |
| 12 | reviewer login แล้วดู header (TopBar) | โชว์ label role เป็นข้อความแปล ("เจ้าหน้าที่ตรวจสอบ" / EN) ไม่ใช่ key ดิบ `role.reviewer` |

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
- ต้องเพิ่ม `backend/SYNTAX_NOTES.md` ด้วย — `updateMany` แบบมีเงื่อนไขกันชน (guard) เป็น syntax/pattern ใหม่ของโปรเจกต์นี้ ยังไม่เคยอธิบายไว้ (โค้ดทั้งฟีเจอร์นี้เขียนแบบ syntax พื้นฐาน ไม่ใช้ chaining ซับซ้อน — ตาม [[code-style-beginner-friendly]])
- ถ้าจำนวน reviewer เพิ่มจนคิวรวมเริ่มชนกันบ่อย (409 ขึ้นถี่) ค่อยพิจารณา assignment จริงจังตอนนั้น
