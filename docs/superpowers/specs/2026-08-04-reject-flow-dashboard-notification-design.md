# แก้ flow ตีกลับ + Dashboard stats + แจ้งเตือน + ซูมรูปประกาศ — Design

วันที่: 2026-08-04

## Problem

พบ 4 เรื่องจากการใช้งานจริง:

1. **ใบที่ถูกตีกลับ แก้ผลสอบไม่ได้ทุกวิชา** — นักศึกษาถูกตีกลับในรอบที่ 1/2568 (รอบแรก ไม่มีรอบก่อนหน้า) แต่หน้ากรอกผลสอบแสดง 5 จาก 8 วิชาเป็น "ผ่านแล้วจากรอบก่อน" ล็อกไว้แก้ไม่ได้ เหลือกรอกแค่ 3 วิชา
2. **Dashboard บาร์อัตราผ่านรายวิชาเพี้ยน** — วิชาที่ไม่มีใครสอบจริงในรอบนี้ขึ้น 100%
3. **Dashboard ตัวหาร / "ยังไม่เริ่มกรอก" ผิด** — สัดส่วนใน donut ไม่ตรงกับตัวเลขตรงกลาง
4. **ไม่มีแจ้งเตือนให้นักศึกษาเมื่อถูกตีกลับ** — กระดิ่งบน TopBar เป็น mock (`notif=3` hardcode, modal ว่างเปล่า)
5. **รูปประกอบประกาศดูไม่รู้เรื่อง** — รูปไดอะแกรมถูก `object-fit: cover` crop และไม่มีทางขยายดู

### Root cause (ข้อ 1 และ 2 เป็นต้นตอเดียวกัน)

`findPassedSubjectIds(student_id)` ใน `backend/src/modules/examResults/examResults.repository.js:43`
ดึงวิชาที่ `is_passed: true` จาก **ทุก** `exam_result` ของนักศึกษาคนนั้น — รวมใบของ**รอบปัจจุบันที่เพิ่งถูกตีกลับ**ด้วย

ผลลัพธ์เป็นลูกโซ่:
- นักศึกษาส่งผล → ติ๊กผ่าน 5 วิชา → เจ้าหน้าที่ตีกลับ
- กลับเข้าหน้ากรอก → `findPassedSubjectIds` เห็น 5 วิชานั้นจากใบตัวเอง → ล็อกเป็น "ผ่านแล้วจากรอบก่อน"
- copy-forward ยิงต่อไปที่ `subject_results` → dashboard นับเป็นผ่านจริง → บาร์ขึ้น 100%

## Scope

- Backend: `examResults` (repository + controller), `rounds` (active endpoint), `dashboard` (service + repository), Prisma migration 1 ตัว
- Frontend: `dashboardReal.jsx`, `examFormReal.jsx`, `newsReal.jsx`, `components.jsx` (TopBar), `app.jsx`, `i18n.js`
- ไม่แตะ: auth, rooms, certificates, users, subjects

---

## Design

### A. แก้ carry-forward ล็อกวิชาผิด

เปลี่ยน signature:

```js
// backend/src/modules/examResults/examResults.repository.js
export const findPassedSubjectIds = async (student_id, excludeRoundId = null) => {
  const rows = await prisma.subjectResult.findMany({
    where: {
      is_passed: true,
      exam_result: {
        student_id,
        // ตัดใบของรอบปัจจุบันออก — ไม่งั้นผลที่ตัวเองเพิ่งกรอก (แล้วถูกตีกลับ)
        // จะกลายเป็น "ผ่านแล้วจากรอบก่อน" ล็อกตัวเองไว้แก้ไม่ได้
        ...(excludeRoundId ? { NOT: { round_id: Number(excludeRoundId) } } : {}),
      },
    },
    select: { subject_id: true },
  });
  return [...new Set(rows.map((r) => r.subject_id))];
};
```

จุดที่ต้องส่ง `excludeRoundId` เข้าไป:
- `POST /api/exam-results` (`examResults.controller.js` `create`) → ส่ง `round.round_id`
- `GET /api/rounds/active` (`rounds.controller.js`) → ส่ง `round.round_id` เพื่อให้ flag `already_passed` ที่ frontend เห็นตรงกับที่ backend validate

**ผลลัพธ์:** ใบถูกตีกลับ → วิชาที่กรอกในรอบนี้ปลดล็อกหมด แก้ได้ทุกวิชา ทั้งที่ตอบผ่านและไม่ผ่าน
ส่วนวิชาที่ผ่านจาก**รอบก่อนหน้าจริงๆ** ยังล็อกเหมือนเดิม (ยืนยันกับผู้ใช้แล้ว)

---

### B. หน้าต่างแก้ไขผลสอบ

กติกาที่ตกลง: **แก้ได้จนกว่าเจ้าหน้าที่จะยืนยัน หรือรอบปิด — อย่างใดอย่างหนึ่งมาก่อน**

แก้ `examResults.controller.js:40-42`:

| สถานะใบเดิม | รอบ | ผลลัพธ์ |
|---|---|---|
| ไม่มีใบ | open | สร้างใหม่ |
| `staff_status = pending` | open | ส่งทับได้ |
| `staff_status = rejected` | open | ส่งทับได้ |
| `staff_status = approved` | open | 409 `"เจ้าหน้าที่ยืนยันผลสอบรอบนี้แล้ว แก้ไขไม่ได้"` |
| ใดๆ | closed | 400 `"ขณะนี้ไม่มีรอบกรอกผลสอบที่เปิดอยู่"` (เดิม — `findActive` คืน null อยู่แล้ว) |

ตอนส่งทับต้อง reset: `staff_status = pending`, `remark = null`, `confirmed_by = null`
(ขยาย `resubmitWithSubjects` ให้ครอบคลุมเคส pending ด้วย ไม่ใช่แค่ rejected)

Frontend `examFormReal.jsx` — ป้ายปุ่มตามสถานะ:
- ยังไม่เคยส่ง → "ส่งผลสอบ"
- `pending` → "แก้ไขผลสอบ" + hint "เจ้าหน้าที่ยังไม่ตรวจ แก้ไขได้จนกว่าจะยืนยันหรือรอบปิด"
- `rejected` → "ส่งผลสอบใหม่" (เดิม)
- `approved` → ไม่มีปุ่ม แสดง read-only

---

### C. บาร์อัตราผ่านรายวิชา — ตัด carry-forward ออกจากสถิติ

ตอนนี้แยกไม่ออกว่า `subject_result` แถวไหนคือ "สอบจริงในรอบนี้" กับ "copy มาจากรอบก่อน" เพราะหน้าตาเหมือนกันหมด

**Migration:** เพิ่ม column ใน `subject_results`

```prisma
model SubjectResult {
  // ...fields เดิม
  carried_forward Boolean @default(false)  // true = ไม่ได้สอบรอบนี้ ผลผ่านยกมาจากรอบก่อน
}
```

`default(false)` ทำให้ข้อมูลเก่าไม่พัง — ถือว่าสอบจริงทั้งหมด

`examResults.controller.js` `create` ตั้งค่าตอนบันทึก:

```js
const finalResults = roundSubjectIds.map((id) => ({
  subject_id: id,
  is_passed: passedIds.includes(id) ? true : answers.get(id),
  carried_forward: passedIds.includes(id),
}));
```

`dashboard.service.js` `buildPerSubject` — กรองก่อนนับ:

```js
const marks = sent
  .map((r) => r.subject_results.find((x) => x.subject_id === sub.subject_id))
  .filter((m) => m && !m.carried_forward);   // นับเฉพาะคนที่สอบวิชานี้จริงในรอบ
```

- `marks.length === 0` → `rate: null` (ไม่ใช่ 0) — บอกว่า "ไม่มีข้อมูล" คนละเรื่องกับ "ตกหมด"
- `subjectPassRate` (เฉลี่ยทุกวิชา) รวมเฉพาะวิชาที่ `rate !== null`
- **`countFullyPassed` ไม่แตะ** — "ผ่านครบทุกวิชา" ต้องนับวิชาที่ผ่านจากรอบก่อนด้วย ถึงจะถูก
- `buildStudentRows` (PDF) ไม่แตะ ด้วยเหตุผลเดียวกัน

Frontend `dashboardReal.jsx`:

```jsx
{perSubject.map(sub => sub.rate === null
  ? <BarRow ... value={0} color="var(--ink-200)" right="—" sub={tt('dashReal.noExamThisRound')} />
  : <BarRow ... />)}
```

เพิ่ม i18n key `dashReal.noExamThisRound` = "ไม่มีผู้สอบวิชานี้ในรอบ" / "No one sat this subject this round"

---

### D. Donut และตัวหาร "ยังไม่เริ่มกรอก"

ปัญหา: `not_started = Math.max(eligible - results.length, 0)`

`results` = ทุก `exam_result` ในรอบ ไม่ได้กรองว่านักศึกษาคนนั้นยัง `exam_eligible` อยู่ไหม
ถ้าเจ้าหน้าที่ปิดสิทธิ์คนที่ส่งไปแล้ว → `results.length > eligible` → `Math.max` ตัดเป็น 0 →
ผลรวมทุก segment ของ donut ไม่เท่ากับตัวเลข `eligible` ตรงกลาง

**แก้:** กรอง `results` ให้เหลือเฉพาะนักศึกษาที่ `exam_eligible = true` ตั้งแต่ต้น แล้วสถิติทุกตัวจะตรงกันเอง

`dashboard.repository.js`:

```js
// ผลสอบในรอบ เฉพาะนักศึกษาที่ยังมีสิทธิ์กรอก — ตัวหารของ donut/fillRate จะได้ตรงกับ eligible
export const findResultsByRound = (roundId) =>
  prisma.examResult.findMany({
    where: {
      round_id: Number(roundId),
      student: { exam_eligible: true },
    },
    include: { /* เดิม */ },
    orderBy: { student_id: "asc" },
  });
```

ผลที่ได้ (invariant ที่ต้องเป็นจริงเสมอ):

```
by.approved + by.submitted + by.rejected + by.draft + not_started === eligible
```

`buildStudentRows` (PDF) เรียก `findResultsByRound` ตัวเดียวกัน — ยอมรับได้ เพราะรายงานควรมีเฉพาะคนที่มีสิทธิ์กรอกอยู่

---

### E. แจ้งเตือนนักศึกษา

**ตัดสินใจ: ไม่ทำตาราง `notifications` ใน DB**
เหตุผล — ข้อมูล "ถูกตีกลับ + remark" กับ "ประกาศใหม่" มีอยู่ครบใน `exam_results` และ `news` แล้ว
ตารางใหม่จะเป็นข้อมูลซ้ำที่ต้อง sync และรายงานไม่ได้ระบุไว้ ถ้าอนาคตต้องแจ้งเตือนเรื่องที่ไม่มีที่มาชัดเจนค่อยเพิ่ม

**Hook ใหม่** `useNotifications()` ใน `app.jsx` — ประกอบจาก endpoint ที่มีอยู่ ไม่มี endpoint ใหม่:

| แหล่ง | เงื่อนไข | หัวข้อ | กดแล้วไป |
|---|---|---|---|
| `GET /api/exam-results/mine` | `staff_status = 'rejected'` | "ผลสอบถูกตีกลับ" + `remark` | หน้ากรอกผลสอบ |
| `GET /api/exam-results/mine` | `staff_status = 'approved'` | "ผลสอบได้รับการยืนยัน" | หน้าสถานะการกรอก |
| `GET /api/news` | 5 รายการล่าสุด | หัวข้อประกาศ | หน้าข่าวสาร |

- key ของแต่ละรายการ: `exam:<result_id>:<staff_status>` / `news:<news_id>`
  (ใส่ `staff_status` ใน key ด้วย เพื่อให้ตีกลับ → แก้ → ยืนยัน ขึ้นเป็นแจ้งเตือนใหม่ ไม่ใช่ของที่อ่านไปแล้ว)
- อ่านแล้วเก็บที่ `localStorage['notif_read_' + user_id]` = array ของ key
- badge = จำนวน key ที่ยังไม่อยู่ใน list → เปิด modal = mark อ่านทั้งหมด
- เรียงใหม่ → เก่า ตาม timestamp

`components.jsx` `TopBar` — รับ prop `notifications` (array) แทน `notif = 3` ที่ hardcode
เจ้าหน้าที่/ผู้บริหารเห็นเฉพาะประกาศ (ไม่มี `exam-results/mine`)

---

### F. แว่นขยายรูปประกาศ

`newsReal.jsx` — `NewsImage` โหลดรูปเป็น blob URL อยู่แล้ว (เพราะ endpoint ต้องมี `Authorization` header)
lightbox ใช้ blob URL ตัวเดิมได้เลย ไม่ต้องโหลดซ้ำ

- แก้ `objectFit: 'cover'` → `'contain'` ใน modal รายละเอียดประกาศ (`newsReal.jsx:95`)
  ตอนนี้ crop รูปไดอะแกรมจนอ่านไม่ออก — thumbnail ในลิสต์ยังใช้ `cover` ได้ตามเดิม
- คลิกรูป → overlay เต็มจอ (`position: fixed; inset: 0`) พื้นหลังดำโปร่ง
- ควบคุม: ปุ่ม `+` / `−` / `reset`, scroll wheel zoom, ลากเลื่อนเมื่อ `scale > 1`
- ปิด: ปุ่ม `×`, กด `Esc`, คลิกพื้นหลัง
- scale จำกัด `1` ถึง `5`
- ใช้ CSS `transform: scale() translate()` ล้วน **ไม่เพิ่ม library**
- cursor: `zoom-in` บนรูปเดิม, `grab` / `grabbing` ใน overlay ตอน zoom

---

## Testing

| # | เคส | คาดหวัง |
|---|---|---|
| 1 | ส่งผล 8 วิชา (ผ่าน 5) → เจ้าหน้าที่ตีกลับ → เปิดหน้ากรอก | กรอกได้ครบ 8 วิชา ไม่มี "ผ่านแล้วจากรอบก่อน" |
| 2 | รอบ 1 ผ่าน NUR01-05 → รอบ 2 เปิด | NUR01-05 ล็อก กรอกได้ 3 วิชา |
| 3 | รอบ 2 ถูกตีกลับ | NUR01-05 **ยังล็อก**, NUR06-08 แก้ได้หมด |
| 4 | ส่งแล้ว `pending` → ส่งทับ | สำเร็จ, `staff_status` ยังเป็น pending |
| 5 | เจ้าหน้าที่ยืนยัน → นักศึกษาส่งทับ | 409 |
| 6 | รอบปิด → ส่งทับ | 400 |
| 7 | รอบ 2 มี 3 วิชา, 1 คนส่ง | บาร์แสดง 3 วิชามีเลข, 5 วิชาขึ้น `—` |
| 8 | ปิดสิทธิ์คนที่ส่งไปแล้ว → ดู dashboard | segment รวม = `eligible` เป๊ะ |
| 9 | ถูกตีกลับ | กระดิ่งมี badge, modal โชว์ remark |
| 10 | เปิดแล้วปิด modal, reload | badge หาย |
| 11 | คลิกรูปประกาศ | overlay เปิด, zoom/ลาก/Esc ทำงาน |

รัน `backend/tests/` ทั้งชุด — reseed ก่อนรันทุกครั้ง (ดู `smoke-phase11-carry-forward.mjs` ต้องอัปเดตตาม A และ C)

## Out of scope

- ตาราง `notifications` ใน DB
- แจ้งเตือนทาง email / push
- แจ้งเตือนฝั่งเจ้าหน้าที่ว่ามีใบใหม่รอตรวจ (badge บนเมนูมีอยู่แล้ว)
- แก้ไขผลสอบหลังรอบปิด (ยืนยันแล้วว่าไม่ต้องการ)
- zoom รูปในหน้าอื่นนอกจากประกาศ

## Follow-up

- `carried_forward` ทำให้แยก "ผ่านจากการสอบจริง" กับ "ยกมา" ได้แล้ว — ถ้าอนาคตอยากทำรายงาน "อัตราผ่านต่อครั้งที่สอบ" ใช้ column นี้ได้เลย
- ต้องอัปเดต `backend/BACKEND_GUIDE.md` (endpoint, กฎธุรกิจ, schema, Changelog) ในคอมมิตเดียวกับโค้ด
