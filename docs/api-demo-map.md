# แผนที่ "กดปุ่ม → API → ตาราง" (ใช้พรีเซนต์)

อ่านจากโค้ดจริง: `backend/src/modules/*/*.routes.js` + repository + `frontend/src/design/*.jsx`
Base URL: `http://localhost:3000/api` · ทุก endpoint ที่ไม่ public ผ่าน `authenticate` → `requireRole`
Token อยู่ใน **httpOnly cookie** (ไม่อยู่ใน response body — DevTools → Application → Cookies ดู flag HttpOnly ได้)

ตัวย่อ: **R** = อ่าน, **W** = เขียน (insert/update/delete)
Flow ทุกปุ่ม: `หน้าเว็บ → apiFetch → routes → controller → (service) → repository → Prisma → DB → res.json({ success, data })`

> หมายเหตุ: ตารางจริงมี **13 ตาราง** (นอกจาก 11 ในรายงาน มี `review_logs`, `notifications` เพิ่ม)

---

## 0. เข้าสู่ระบบ (ทุก role)

| กดอะไร | หน้าจอ | Request | ตาราง | เกิดอะไร |
|---|---|---|---|---|
| ปุ่มเข้าสู่ระบบ | `login.jsx` | `POST /auth/login` | `users` R (+`roles`) | เทียบ bcrypt hash → ออก JWT → set cookie |
| เปิดเว็บ/refresh | `app.jsx` | `GET /auth/me` | `users` R | cookie ยังใช้ได้ไหม + role อะไร |
| ปุ่มออกจากระบบ | `api.js` | `POST /auth/logout` | – | ลบ cookie |
| เปลี่ยนรหัสผ่านครั้งแรก | `forceChangePassword.jsx` | `PATCH /auth/password` | `users` W | เปลี่ยน hash, `must_change_password=false` |
| นักศึกษากรอกโปรไฟล์ครั้งแรก | `completeProfile.jsx` | `GET /rooms` → `POST /students/complete-profile` | `rooms` R, `students` W, `users` W | สร้างแถว `students` ผูก `users` |

## 1. นักศึกษา

| กดอะไร | หน้าจอ | Request | ตาราง | เกิดอะไร |
|---|---|---|---|---|
| เปิดหน้าข่าว/แจ้งเตือน | `newsReal.jsx`, `app.jsx` | `GET /news`, `GET /notifications/me`, `GET /rounds/active` | `news` R, `notifications` R, `submission_rounds` R | โชว์ข่าว + กระดิ่ง + รอบที่เปิดให้ |
| เปิดหน้ากรอกผลสอบ | `examFormReal.jsx` | `GET /rounds/active`, `GET /exam-results/me` | `submission_rounds` R, `exam_results` R, `subject_results` R | หารอบที่ส่งได้ + วิชาที่ผ่านแล้ว (carry-forward) |
| **กดส่งผลสอบ 8 วิชา** | `examFormReal.jsx` | `POST /exam-results` body `{subject_results}` | `exam_results` W, `subject_results` W (transaction) | สร้างใบ `staff_status=pending`; ถ้าถูกตีกลับ = ลบ/สร้างรายวิชาใหม่ใน transaction เดียว |
| อัปโหลด PDF หลักฐาน | `examFormReal.jsx` | `POST /exam-results/:id/certificates` (multipart) | `certificates` W, `exam_results` R | ไฟล์ลงดิสก์ `uploads/` — DB เก็บแค่ `file_path` |
| ลบ PDF | `examFormReal.jsx` | `DELETE /certificates/:id` | `certificates` W | ลบแถว+ไฟล์ (เฉพาะใบที่ยังแก้ได้) |
| ดูสถานะ/ประวัติ | `studentStatusReal.jsx` | `GET /exam-results/me` | `exam_results` R, `subject_results` R, `certificates` R | เห็น pending / approved / rejected + remark |
| เปิดดูไฟล์ PDF | `studentDetailReal.jsx` | `GET /certificates/:id/file` | `certificates` R | stream ไฟล์ (เช็คสิทธิ์เจ้าของ) |
| กดอ่านแจ้งเตือน | `app.jsx` | `PATCH /notifications/read-all` , `PATCH /notifications/:id/read` | `notifications` W | ตั้ง `is_read` |

## 2. เจ้าหน้าที่คณะ (officer)

### ตรวจผลสอบ — จุดโชว์หลัก
| กดอะไร | หน้าจอ | Request | ตาราง | เกิดอะไร |
|---|---|---|---|---|
| เปิดหน้าตรวจ | `officerReviewReal.jsx` | `GET /rounds`, `/students`, `/subjects`, `/exam-results?round_id=`, `/dashboard/stats` | R หลายตาราง | list คิวรอตรวจ |
| **กดยืนยัน** | `studentDetailReal.jsx` | `PATCH /exam-results/:id/approve` | `exam_results` W (row lock `FOR UPDATE`), `review_logs` W, `notifications` W | `staff_status=approved` + บันทึกใครทำ + แจ้งนักศึกษา · **ใบที่ไม่มีไฟล์หลักฐานยืนยันไม่ได้ (409)** |
| **กดตีกลับ + remark** | `studentDetailReal.jsx` | `PATCH /exam-results/:id/reject` body `{remark}` | เหมือน approve | `staff_status=rejected` + remark + แจ้งนักศึกษา |
| กดแก้ไขผลตรวจ (ถอนยืนยัน/ถอนตีกลับ) | `studentDetailReal.jsx` | `PATCH /exam-results/:id/reopen` body `{remark}` (**บังคับ**) | `exam_results` W, `review_logs` W (`action=reopened`), `notifications` W (`type=revoked`) | กลับเป็น pending · ไม่ใส่เหตุผล → 400 |
| ถอนการยืนยัน | – | `PATCH /exam-results/:id/revoke-approval` | เหมือน reopen | เฉพาะ officer |

### นักศึกษา / import
| กดอะไร | หน้าจอ | Request | ตาราง | เกิดอะไร |
|---|---|---|---|---|
| ดูรายชื่อ | `officerStudentsReal.jsx` | `GET /students`, `GET /exam-results` | `students` R, `exam_results` R | |
| นำเข้า CSV | `studentImport.jsx` | `POST /students/import` (multipart) | `users` W, `students` W, `roles` R, `faculties` R, `rooms` R | สร้างบัญชี (รหัสผ่านตั้งต้น = เลขบัตร, hash bcrypt) |
| เพิ่มทีละคน | `studentImport.jsx` | `POST /students` | `users` W, `students` W | |
| แก้ข้อมูล | `studentDetailReal.jsx` | `PATCH /students/:id` | `students` W, `users` W | |
| เปิด/ปิดสิทธิ์กรอก | `officerStudentsReal.jsx` | `PATCH /students/bulk-eligible` | `students` W | `exam_eligible` |
| รีเซ็ตรหัสผ่านนักศึกษา | `officerStudentsReal.jsx` | `POST /students/:id/reset-password` | `users` W | |
| ลบนักศึกษา | `officerStudentsReal.jsx` | `DELETE /students/:id[?delete_results=true]`, `POST /students/bulk-delete` | ลบต่อเนื่อง `review_logs`→`certificates`→`subject_results`→`exam_results`→`notifications`→`students`→`users` | ลบเรียงตาม FK |
| ลบบัญชีที่ยังไม่เคย login | `studentImport.jsx` | `GET /students/pending-accounts`, `POST /students/pending-accounts/delete` | `users`, `students` | |

### รอบ / วิชา / ข่าว / ผู้ใช้
| กดอะไร | หน้าจอ | Request | ตาราง | เกิดอะไร |
|---|---|---|---|---|
| สร้าง/แก้/ลบรอบ | `manageRoundsSubjectsReal.jsx` | `POST/PUT/DELETE /rounds[/:id]` | `submission_rounds` W; ลบ: เช็ค `exam_results`, `news` R ก่อน | ลบไม่ได้ถ้ามีผลสอบ/ข่าวผูกอยู่ (409) |
| เพิ่ม/แก้/ลบวิชา | `manageRoundsSubjectsReal.jsx` | `POST/PUT/DELETE /subjects[/:id]` | `subjects` W; เช็ค `subject_results`, `submission_rounds` | |
| โพสต์/แก้/ลบข่าว | `newsReal.jsx` | `POST/PUT/DELETE /news[/:id]` | `news` W | |
| แนบ/ลบรูปข่าว | `newsReal.jsx` | `POST/DELETE /news/:id/image` | `news` W | เก็บ path |
| เพิ่มผู้ใช้ (reviewer/executive) | `manageUsersReal.jsx` | `POST /users` | `users` W, `roles` R | |
| เปลี่ยน role / ถอนสิทธิ์ / รีเซ็ตรหัส / ลบ | `manageUsersReal.jsx` | `POST /users/:id/role`, `/revoke`, `/reset-password`, `DELETE /users/:id` | `users` W | ลบไม่ได้ถ้ามี `review_logs`/`news` อ้างอยู่ (409) |
| Dashboard | `dashboardReal.jsx` | `GET /dashboard/stats?round_id=`, `/history`, `/alerts` | `exam_results`, `subject_results`, `students`, `subjects`, `rooms`, `submission_rounds` R | อัตราผ่านนับเฉพาะ approved |
| ส่งออกรายงาน | `reportsReal.jsx` | `GET /dashboard/export`, `/export-first-attempt`, `/export-first-year`, `GET /students/export-subject`, `POST /students/export` | R | ไฟล์ Excel/PDF |

## 3. ผู้ตรวจสอบ (reviewer) / ผู้บริหาร (executive)

| role | ทำได้ | Endpoint | ทำไม่ได้ (ลองโชว์ให้เห็น 403) |
|---|---|---|---|
| reviewer | ดูรายชื่อ, ดูใบ, approve/reject | `GET /students`, `GET /exam-results`, `PATCH .../approve`, `.../reject` | reopen / revoke / import / จัดการรอบ-วิชา-ผู้ใช้ / `GET /dashboard/*` (dashboard เปิดแค่ officer + executive) |
| executive | Dashboard + รายงานสถิติ (read-only) | `GET /dashboard/stats`, `/history`, `/alerts` | `GET /exam-results`, `GET /students` (ดูรายบุคคลไม่ได้) |

---

## สถานะการยืนยัน

ยิง flow นี้จริง 55 ข้อกับ schema ชั่วคราว (seed + `seedDemoYears 2568 2569`, ไม่แตะ DB หลัก) แล้วนับแถวทุกตารางก่อน/หลังแต่ละขั้น:
ตารางที่เปลี่ยนตรงกับที่เขียนไว้ทุกขั้น (ส่งผล `exam_results +1 / subject_results +8`, อัปโหลด `certificates +1`, ตีกลับ/ยืนยัน/แก้ไขผลตรวจ `review_logs +1 / notifications +1`, ข่าว/ผู้ใช้ +1 แล้ว −1). กรณีสิทธิ์ผิดทุกข้อ DB ไม่เปลี่ยน.
ข้อที่ต้องแก้ความเข้าใจจากรอบแรก: `reopen` บังคับ `remark`, `review_logs.action` ของ reopen คือ `reopened` (คอมเมนต์ใน `schema.prisma` ยังเขียน `revoked`).

## ก่อนเดโม: ตรวจรอบสอบ

ข้อมูลจาก `seedDemoYears` ตั้งวันปิดรอบ 2/2569 ไว้ **30 ก.ย. 2569** → วันนี้ส่งผลสอบไม่ได้ (400 "ไม่มีรอบกรอกผลสอบที่เปิดอยู่") แม้ `status=open`
ต้องเลื่อนวันปิดผ่านหน้า "จัดการรอบสอบ" หรือ `PUT /rounds/:id {close_date}` ก่อนทุกครั้ง (ใส่เป็นขั้น 0 ในสคริปต์ได้)
ลบรอบที่เปิดอยู่ไม่ได้ (400 "ต้องปิดรอบก่อน") · สร้างรอบซ้ำปี+ครั้งที่เดิมไม่ได้ (400)

## สคริปต์โชว์ 1 รอบ (แนะนำ ~5 นาที)

เตรียม: จอซ้าย = เว็บ + DevTools Network (filter **Fetch/XHR**) · จอขวา = `npx prisma studio` · `npm run demo:seed` ก่อนเริ่ม

1. **Login** นักศึกษา → Network: `POST /auth/login` → Application: cookie `token` (HttpOnly)
2. **ส่งผลสอบ** → ชี้ `POST /exam-results` → Studio refresh: `exam_results` +1 แถว, `subject_results` +8 แถว
3. **อัปโหลด PDF** → `POST .../certificates` → Studio: `certificates` มีแค่ `file_path` (ไม่มี binary)
4. สลับเป็น **officer** → เปิดคิวตรวจ → **กดตีกลับ + remark** → `PATCH .../reject` → Studio: `exam_results.staff_status=rejected`, `review_logs` +1, `notifications` +1
5. กลับ **นักศึกษา** → เห็นกระดิ่ง + สถานะตีกลับ → แก้ส่งใหม่ → officer **กดยืนยัน**
6. **Dashboard** → `GET /dashboard/stats` → ตัวเลขเปลี่ยน (นับเฉพาะ approved)
7. ปิดท้าย **ลองสิทธิ์**: executive เรียก `GET /exam-results` → 403

## ข้อควรระวัง
- `backend/requests.http` เขียนใหม่แล้ว (login ด้วย cookie, เรียงเป็น 5 ส่วน A–E ตาม flow ข้างบน, ใช้ `{{createResult.response.body.$.data.result_id}}` ต่อ id ข้าม request). ไฟล์ PDF ตัวอย่าง `backend/assets/demo-evidence.pdf` ถูก `.gitignore` (`*.pdf`) ต้องมีในเครื่อง
- ไวยากรณ์ตัวแปร/cookie ของ REST Client ผมยังไม่ได้เปิดใน VS Code จริง (ยิงค่าเทียบเท่าด้วยสคริปต์แล้ว) — ลองกดหนึ่งรอบก่อนวันจริง
- ข้อมูลส่วนตัว (เลขบัตร, ชื่อ) ใน Prisma Studio — ใช้ข้อมูล demo ไม่ใช่ข้อมูลจริงตอนพรีเซนต์
