# Frontend 09 — เจ้าหน้าที่: จัดการรอบสอบ + รายวิชา + ผู้ใช้งาน

ไฟล์ (`frontend/src/design/`): `manageRoundsSubjectsReal.jsx` (450), `manageUsersReal.jsx` (267)
backend: `/rounds` (GET/POST/PUT/DELETE), `/subjects`, `/students` (นับรุ่น), `/users` (GET/POST, `/:id/role`, `/:id/revoke`, `/:id/reset-password`, DELETE) — ดู backend [03](../backend/03-subjects-rooms-rounds.md), [04](../backend/04-users.md)

---

## 1. `manageRoundsSubjectsReal.jsx` — 2 แท็บ: รอบสอบ / รายวิชา

### เวลาไทย (14-39)
backend เก็บ UTC และตีความค่าที่ส่งไปเป็น **เวลาไทย** — หน้าจอต้องใช้เวลาไทยเหมือนกัน ไม่ใช่ timezone ของเครื่องเจ้าหน้าที่ (ไม่งั้นเปิดจากเครื่องที่ตั้ง timezone ผิดจะเห็นเวลาไม่ตรงกับที่บันทึก)
| บรรทัด | อธิบาย |
|---|---|
| 18 | `ICT_OFFSET_MS` = 7 ชม. |
| 21-25 | `toDateTimeInput(iso)` — ISO (UTC) → ค่า `<input type="datetime-local">` = `"YYYY-MM-DDTHH:mm"` เวลาไทย: **บวก 7 ชม. แล้วอ่านแบบ UTC** (`toISOString().slice(0, 16)`) ได้ตัวเลขหน้าปัดเวลาไทยพอดี |
| 28-35 | `showThaiDateTime(iso)` — `toLocaleString('th-TH', {timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short'})` เช่น "9 ส.ค. 2569 23:59"; ไม่มีค่า → `'-'` |
| 38-39 | `todayAt('00:00')` — วันนี้ตามเวลาไทยตามด้วยเวลาที่ระบุ (ค่าเริ่มต้นรอบใหม่) |

### `ManageRoundsSubjectsReal({ toast, lang })` — state (41-56)
`tab` (`'rounds'`/`'subjects'`), `rounds`, `subs` (null = กำลังโหลด), `roundModal` (`'new'` / round / `null`), `subjectModal` (`{}` ใหม่ / วิชา / `null`), `deleteRound`, `deleteSubjectTarget` (ยืนยันก่อนลบ — เดิมกดถังขยะแล้วลบทันที พลาดทีเดียวหายทั้งวิชา กระทบรอบ/ผลสอบเก่าย้อนหลัง), **`saving`** (กำลังรอ API — ปุ่มบันทึก/ลบกดซ้ำไม่ได้ ไม่งั้นกดรัวสร้างซ้ำ), `cohorts` (`[{year, count}]` รุ่นนักศึกษาที่มีจริง), `yearFilter` (`'open'` = เฉพาะรอบที่ยังเปิด / `'all'` / ปีเจาะจง)

### โหลดข้อมูล (58-69)
`loadRounds`, `loadSubs`; `useEffect([])` โหลดทั้งคู่ + `GET /students` เพื่อสร้าง `cohorts`: `Map` นับต่อ `academic_year` (`(byYear.get(s.academic_year) || 0) + 1`) → `[...byYear.entries()].map(([year, count]) => ({year, count})).sort((a,b) => b.year - a.year)`; ใช้เฉพาะปีที่ import นักศึกษาแล้วจริง ไม่เดาปีปัจจุบัน (รุ่นที่ยังไม่ import ใช้ "กรอกเอง" ในฟอร์ม)

### ตัวบันทึก/ลบ (71-146) — pattern เดียวกันทุกตัว
`if (saving) return; setSaving(true); try {...} catch (e) { toast(ApiError ? e.message : ข้อความกลาง) } finally { setSaving(false) }`
- `saveRound(form)` — `'new'` → `POST /rounds`; ไม่งั้น `PUT /rounds/:id`. **บล็อกที่สำคัญ (82-89):** รอบที่เพิ่งบันทึกต้องเห็นได้เสมอ (ไม่งั้นดูเหมือนบันทึกไม่สำเร็จแล้วกดซ้ำ) — `visibleAfterSave` ตรวจว่าตัวกรองปัจจุบันครอบรอบนี้ไหม (ทั้ง 'all', 'open' + `status==='open'`, หรือปีตรง); ไม่ครอบ → `setYearFilter(ปีของรอบนั้น)` สลับให้อัตโนมัติ
- `confirmDeleteRound`, `saveSubject` (มี `subject_id` → PUT, ไม่มี → POST), `deleteSubject`

### กรอง+แบ่งหน้า (148-167)
- `visibleRounds` = `.filter` ตาม `yearFilter` แล้ว `.sort` ปีมาก→น้อย `||` ครั้งมาก→น้อย: `'open'` ใช้ `phaseOf(r) !== 'closed'` — **ต้องรวม scheduled (ยังไม่ถึงวันเปิด) กับ expired (เลยวันปิดแต่ยังไม่กดปิด)** ไม่งั้นรอบที่ตั้งวันผิดหายจากหน้าจอ เจ้าหน้าที่หาไม่เจอว่าจะไปแก้ที่ไหน
- `usePagedList(visibleRounds, 9, yearFilter)` / `usePagedList(subs ?? [], 15)` — เรียก hook ก่อน early return เสมอ
- `filterYears` = ปีที่ **มีรอบอยู่จริง** (ไม่ใช่รุ่นนักศึกษาทั้งหมด — เลือกปีที่ไม่มีรอบจะได้หน้าว่าง)

### JSX (169-287)
- ปุ่มหัวหน้าเปลี่ยนตามแท็บ (สร้างรอบ / เพิ่มวิชา); แท็บสลับ 2 ปุ่ม
- **แท็บรอบ:** `<Select>` ตัวกรอง; การ์ดรอบ (กริด `g-3`): ป้าย `phaseBadgeClass(r)` + `phaseLabel(r, tt)`, ปุ่มแก้/ลบ (มี `aria-label`), "รอบที่ n/ปี", ผู้สร้าง `actorLabel(r.creator)`, ผู้แก้ล่าสุด+วันที่ (ถ้าเคยแก้), วันเปิด/ปิด (เวลาไทย), กล่องอธิบายสำหรับ `scheduled` ("จะเปิดวันที่…") และ `expired` ("เลยกำหนด ให้ไปกดปิดรอบ") — บอกให้ชัดว่าทำไมนักศึกษากรอกไม่ได้ทั้งที่ขึ้นว่าเปิด
- **แท็บวิชา:** ตาราง; ลำดับ `subsPage.page * 15 + i + 1` นับต่อจากหน้าก่อน ไม่เริ่ม 1 ใหม่ทุกหน้า
- Modal ลบวิชา/ลบรอบ (`tone="danger"`); `<RoundModal>`, `<SubjectModal>`

### `RoundModal` (291-407) — ฟอร์มสร้าง/แก้รอบ
| บรรทัด | อธิบาย |
|---|---|
| 292-293 | `isNew = round === 'new'`; `r = isNew ? {} : (round || {})` |
| 294-300 | state ฟอร์ม: ปี, ครั้งที่, วันเปิด/ปิด, สถานะ, `subjectIds`, `customYear` (เปิดรอบให้รุ่นที่ยังไม่มีนักศึกษา) |
| 302-314 | `useEffect([round])` เติมค่าฟอร์มทุกครั้งที่เปิด: รอบใหม่ = เปิดวันนี้ 00:00 ปิดวันนี้ 23:59; รอบเดิม = `toDateTimeInput(...)`; **รอบเก่าที่ `subject_ids` ว่าง = ถือว่าเลือกครบทุกวิชา** |
| 316-317 | `toggleSubject(id)` — `includes ? filter ออก : [...ids, id]` |
| 320 | **`subjectsLocked = !isNew && r.status === 'open'`** — รอบที่เปิดอยู่แล้ว backend ล็อกไม่ให้แก้วิชา (400) → ปิด checkbox ให้ตรงกัน |
| 323 | `isValid` — ครบทุกช่อง + เลือกวิชา ≥ 1 (ปุ่มบันทึก disabled ถ้าไม่ครบ กันส่งวันที่ว่าง) |
| 329-335 | `onSave({academic_year, attempt_number, open_date, close_date, status, ...(subjectsLocked ? {} : {subject_ids})})` — วันที่ส่งเป็น `"YYYY-MM-DDTHH:mm"` ตรง ๆ backend ตีความเป็นเวลาไทย; **รอบที่เปิดอยู่ห้ามส่ง `subject_ids`** (ไม่งั้น 400) ใช้ spread แบบมีเงื่อนไข |
| 340-362 | ช่อง "รุ่น": `<Select>` รุ่นที่มีจริง พร้อมจำนวนคน + ตัวเลือก "กรอกเอง" (`'__custom'`) สลับเป็นช่องตัวเลข + ลิงก์กลับไปเลือกจากลิสต์ |
| 371-389 | รายการวิชา checkbox (เลื่อนได้ `maxHeight: 200`) |
| 391-393 | checkbox "เปิดรับ" (เฉพาะตอนแก้; รอบใหม่ไม่แสดงเพราะกำหนดเอง) |
| 401-402 | `<CohortPreview>` เมื่อพิมพ์ปีครบ 4 หลัก (ไม่งั้นเตือน "ไม่มีรุ่น 25" ตั้งแต่ตัวที่สอง) และเป็นรอบใหม่ หรือสถานะ open (ตอนกำลังปิดรอบ ไม่โชว์ "จะเปิดให้ N คน" เพราะขัดกับที่กำลังจะเกิด) |

### `CohortPreview` (413-434)
กล่องสรุป "รอบนี้จะเปิดให้ใคร" — `cohorts.find(c => c.year === year)`; มีคน → เขียว (จำนวนคน); 0 คน → ส้มเตือน "เปิดไปก็ไม่มีใครกรอกได้ (มักแปลว่าพิมพ์ปีผิด)" (รอบผูกกับรุ่นเดียว backend เปิดให้เฉพาะ `academic_year` ตรง — พิมพ์ผิดตัวเดียวเปิดให้คนผิดรุ่นหรือไม่เปิดให้ใครเลย เดิมไม่มีทางรู้จนนักศึกษาโทรมาถาม)

### `SubjectModal` (436-450)
รหัส + ชื่อวิชา; `useEffect([subject])` เติมค่าตอนเปิด; ส่ง `{subject_code, subject_name}`

---

## 2. `manageUsersReal.jsx` — บัญชีเจ้าหน้าที่ / ผู้ช่วยตรวจสอบ / ผู้บริหาร

บัญชีที่จัดการได้: `officer`, `executive`, `reviewer` (`MANAGED_ROLES`) — **นักศึกษาไม่อยู่ที่นี่** (นำเข้าผ่านหน้า import)

### state (18-37)
`users` (null = โหลด), `modal` (เพิ่มผู้ใช้), `form`, `saving`, `error`, **`confirm`** `{user, action: 'reset'|'revoke'|'delete'}`, `resetPassword`, `confirmError`, `roleEdit` `{user, role_name}`, `roleSaving`, `roleError`, `roleFilter`
- `ROLE_LABEL` ชื่อบทบาทแปลภาษา
- `shown` = กรองตาม `roleFilter` — `(users ?? []).filter(u => u.role.role_name === roleFilter)`; `usePagedList(shown, 15, roleFilter)` เรียกก่อน early return
- `load` = `GET /users` แล้ว **`.filter(u => MANAGED_ROLES.includes(...))`** ตัดนักศึกษาออก

### ฟังก์ชัน
| บรรทัด | อธิบาย |
|---|---|
| 44-69 | `runConfirmed` — ตัวเดียวรับ 3 action (กระทำที่ย้อนกลับไม่ได้ จึงถามยืนยันก่อนเสมอ): `reset` ต้องรหัส ≥ 8 (ตรวจก่อนยิง) → `POST /users/:id/reset-password {new_password}`; `delete` → `DELETE /users/:id`; ไม่งั้น (`revoke`) `POST /users/:id/revoke`; ล้ม → `setConfirmError` ข้อความ backend (เช่น ลบไม่ได้เพราะมีประวัติ 409 → ให้ถอนสิทธิ์แทน) |
| 72-85 | `saveRole` — `POST /users/:id/role {role_name}`; backend อ่าน role จาก DB ทุก request จึงมีผลทันที |
| 87-103 | `submit` — สร้างบัญชี: **ผู้บริหารไม่ส่งอีเมล/เบอร์** (`{...form, email:'', phone:''}` — ช่องถูกซ่อน แต่ state อาจเหลือค่าที่พิมพ์ไว้ก่อนสลับ role); สำเร็จ → ล้างฟอร์มกลับค่าเริ่ม |
| 108 | `countOf(role)` นับจาก `users` ทั้งหมด (ไม่ใช่ที่กรองแล้ว) โชว์เลขบนปุ่มกรอง |

### JSX (110-265)
- **ปุ่มกรองบทบาท:** array ซ้อน `[['all', label, n], ...MANAGED_ROLES.map(r => [r, ROLE_LABEL[r], countOf(r)])].map(([key, label, n]) => ...)` (destructure ใน parameter)
- **ตาราง:** ชื่อ + "สร้างโดย" (`u.creator`), username, อีเมล, บทบาท, **สถานะ 3 แบบ**: `is_revoked` (ถอนสิทธิ์แล้ว — แยกจาก `must_change_password` เพราะบัญชีใหม่ก็ `true` เหมือนกัน; โชว์ "ปิดโดย ใคร เมื่อไหร่") / `must_change_password` (รอตั้งรหัสใหม่) / ใช้งานอยู่; `tbody key={roleFilter}` เล่นแอนิเมชันใหม่เมื่อเปลี่ยนตัวกรอง
- **ปุ่มรายแถว 3 ปุ่ม:** รีเซ็ตรหัส, เปลี่ยนบทบาท, ถอนสิทธิ์ — **`disabled={u.user_id === currentUserId}`** (แก้ตัวเองไม่ได้ กันล็อกตัวเองออก ตรงกับ backend) และเปลี่ยนบทบาท/ถอนสิทธิ์ `disabled` เมื่อ `is_revoked` (+ tooltip บอกให้รีเซ็ตรหัสเพื่อเปิดคืน)
  > หมายเหตุ: `runConfirmed` รองรับ action `delete` และ backend มี `DELETE /users/:id` แต่ **ตารางนี้ไม่มีปุ่มที่เรียก `delete`** (มีแค่ 3 ปุ่มข้างบน) — โค้ดส่วนลบเป็นของเผื่อไว้
- **Modal เพิ่มผู้ใช้:** เลือกบทบาท + แสดงสิทธิ์ของแต่ละบทบาทบรรทัดเดียว (ไฮไลต์อันที่เลือก ใช้ `tt('usersMgmt.roleHint.' + role)`), username, รหัสชั่วคราว (`type="text"` ให้เจ้าหน้าที่เห็นว่าพิมพ์อะไร ต้อง ≥ 8 ตัว), ชื่อ-นามสกุล, อีเมล/เบอร์ **ซ่อนเมื่อเป็นผู้บริหาร**
- **Modal ยืนยัน** (ใช้ร่วม reset/revoke/delete): หัวข้อ/ข้อความ/ปุ่มเปลี่ยนตาม `confirm.action` (ternary ซ้อน); ช่องรหัสชั่วคราวเฉพาะ `reset` (`autoFocus`)
- **Modal เปลี่ยนบทบาท:** ปุ่มยืนยัน `disabled` ถ้าไม่ได้เปลี่ยนจริง (`roleEdit.role_name === roleEdit.user.role.role_name`)
