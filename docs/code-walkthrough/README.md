# คู่มืออ่านโค้ดทีละบล็อก — ระบบบันทึกใบอนุญาตประกอบวิชาชีพ

เอกสารชุดนี้ชี้ **ทุกไฟล์โค้ดหลัก** ของ `backend/` และ `frontend/` พร้อมอธิบาย "บรรทัดไหนทำอะไร ทำงานยังไง ทำไมเขียนแบบนี้" เป็นกลุ่มบรรทัด (ส่วนที่ logic หนักอธิบายละเอียดขึ้น)
เขียนจากโค้ดจริง ณ วันที่ 8 ต.ค. 2569 — เลขบรรทัดอิงไฟล์ใน working tree ตอนนั้น (ไฟล์ frontend บางไฟล์ยังมีการแก้ที่ไม่ได้ commit ถ้าบรรทัดเลื่อน ให้ดูจากชื่อฟังก์ชัน)

> ชุดนี้ **เสริม** `docs/study/` (บทเรียน/อัลกอริทึม/ข้อสอบกรรมการ) และ `backend/BACKEND_GUIDE.md`, `frontend/FRONTEND_GUIDE.md` — ชุดนี้เน้น "ไล่ตามไฟล์และบรรทัด" ใช้เป็นแผนที่ค้นโค้ดตอนอ่าน/ตอบคำถามกรรมการ

## วิธีอ่านเร็ว
1. อยากรู้ว่า **request หนึ่งเส้นวิ่งอย่างไร** → [backend 01](backend/01-แกนกลาง-server-config-middleware-utils.md) (ลำดับ middleware) → [02](backend/02-auth-และแผนที่-routes.md) (URL → ใครเข้าได้ → controller ไหน) → ไฟล์โมดูลที่เกี่ยวข้อง
2. อยากรู้ว่า **หน้าจอหนึ่งหน้าเรียก API อะไร** → ดูหัวไฟล์ frontend ของหน้านั้น (บรรทัด "backend:") แล้วตาม link ไปไฟล์ backend ที่ตรงกัน
3. คำถามกรรมการ "ทำไมตัวเลขไม่ตรง / ทำไมกรอกไม่ได้" → [backend 10](backend/10-dashboard-สถิติ.md) (กฎสถิติ) + [backend 07](backend/07-examResults-ผลสอบ.md) (วงจรสถานะใบ) + [frontend 10](frontend/10-dashboard-สถิติ.md)

---

## ฝั่ง Backend (Express + Prisma + PostgreSQL) — `backend/`

| ไฟล์เอกสาร | โค้ดที่ครอบคลุม |
|---|---|
| [01 แกนกลาง](backend/01-แกนกลาง-server-config-middleware-utils.md) | `src/server.js`, `app.js`, `config/{db,env}.js`, `middlewares/{auth,requireRole,errorHandler,rateLimit,upload}.js`, `utils/*.js` (ปีจบ, actor, phase, roundSubjects, xlsx, pdfReport) |
| [02 auth + แผนที่ routes](backend/02-auth-และแผนที่-routes.md) | `controllers/authController.js`, `modules/auth/auth.routes.js` และตาราง URL/role ของ **ทุก** `*.routes.js` |
| [03 subjects / rooms / rounds](backend/03-subjects-rooms-rounds.md) | `modules/{subjects,rooms,rounds}/*` (รวมการแปลงเวลาไทย, กฎเปิด/ปิดรอบ) |
| [04 users](backend/04-users.md) | `modules/users/*` |
| [05 students (repo + controller)](backend/05-students-repository-และ-controller.md) | `student.repository.js`, `student.controller.js` (นำเข้าไฟล์ CSV/Excel, จับคู่คอลัมน์, ลบ cascade) |
| [06 students ส่งออก](backend/06-students-export.md) | `student.export.controller.js`, `students.pdf.js` |
| [07 examResults](backend/07-examResults-ผลสอบ.md) | `modules/examResults/*` (วงจรสถานะ, row lock, carry-forward, เวอร์ชันของใบ) |
| [08 certificates](backend/08-certificates-ไฟล์หลักฐาน.md) | `modules/certificates/*` (magic bytes, ช่วงผ่อนผัน 15 นาที) |
| [09 news + notifications](backend/09-news-และ-notifications.md) | `modules/news/*`, `modules/notifications/*` |
| [10 dashboard](backend/10-dashboard-สถิติ.md) | `modules/dashboard/*` (สูตรสถิติทั้งหมด, alerts, PDF/Excel) |
| [11 ฐานข้อมูล/seed/เทส](backend/11-database-schema-seed-tests.md) | `prisma/schema.prisma`, `migrations/`, `seed*.js`, `demoSeed.js`, `tests/` |

## ฝั่ง Frontend (React 19 + Vite) — `frontend/`

| ไฟล์เอกสาร | โค้ดที่ครอบคลุม |
|---|---|
| [01 entry / api / app](frontend/01-entry-api-app-helpers.md) | `index.html`, `vite.config.js`, `main.jsx`, `App.jsx`, `design/app.jsx` (routing เอง, session, แจ้งเตือน), `api.js`, `roundPhase.js`, `usePagedList.js`, `yearExports.js` |
| [02 login / บังคับเปลี่ยนรหัส / โปรไฟล์](frontend/02-login-forcechange-completeprofile.md) | `login.jsx`, `forceChangePassword.jsx`, `completeProfile.jsx` |
| [03 คอมโพเนนต์ UI กลาง](frontend/03-components-ui-กลาง.md) | `components.jsx`, `data.jsx`, `logos.jsx`, `skeletons.jsx`, `tweaks-panel.jsx`, `subjectResultModal.jsx` |
| [04 ตัวช่วย](frontend/04-helpers-notifications-evidence-pdf.md) | `notifications.js`, `evidenceFiles.js`, `importTemplate.js`, `exportReportPdf.js`, สรุป CSS |
| [05 หน้านักศึกษา](frontend/05-student-กรอกผลสอบ-สถานะ-ประวัติ.md) | `student.jsx` (เฉพาะ `FormIntro`), `examFormReal.jsx`, `studentStatusReal.jsx` |
| [06 ข่าวสาร](frontend/06-news-ข่าวสาร.md) | `newsReal.jsx` |
| [07 รายชื่อนักศึกษา](frontend/07-officer-รายชื่อนักศึกษา.md) | `officerStudentsReal.jsx` |
| [08 คิวตรวจ + รายละเอียด](frontend/08-officer-รายละเอียดนักศึกษา-และ-คิวตรวจ.md) | `officerReviewReal.jsx`, `studentDetailReal.jsx` |
| [09 จัดการรอบ/วิชา/ผู้ใช้](frontend/09-officer-จัดการรอบ-วิชา-ผู้ใช้.md) | `manageRoundsSubjectsReal.jsx`, `manageUsersReal.jsx` |
| [10 Dashboard](frontend/10-dashboard-สถิติ.md) | `dashboardReal.jsx` |
| [11 รายงานสรุป](frontend/11-รายงานสรุป-officer-และ-executive.md) | `reportsReal.jsx`, `executiveReportReal.jsx` |
| [12 นำเข้ารายชื่อ](frontend/12-officer-นำเข้ารายชื่อนักศึกษา.md) | `studentImport.jsx` |
| [13 คู่มือ + ภาพสาธิต](frontend/13-คู่มือการใช้งาน-และ-ภาพสาธิต.md) | `userManual*.jsx`, `manualParts.jsx`, `manualDemo*.jsx`, `manualDemoEn.js` |
| [14 สองภาษา](frontend/14-i18n-สองภาษา.md) | `i18n.js` |

---

## สิ่งที่ "ไม่ได้" อธิบายทีละบรรทัด (และเหตุผล)
| รายการ | เหตุผล / ที่ดูแทน |
|---|---|
| ข้อความในพจนานุกรม `i18n.js`, `manualDemoEn.js` และเนื้อหาคู่มือ `userManual*.jsx` | เป็นข้อความล้วน — อธิบายโครงสร้างและกลไกแล้ว (frontend 13, 14) |
| CSS (`design/styles.css` 776 บรรทัด ฯลฯ) | อธิบายแนวทาง/ตัวแปร/class หลักใน [frontend 04 §5](frontend/04-helpers-notifications-evidence-pdf.md) |
| `prisma/migrations/*.sql` | SQL ที่ Prisma สร้างให้ — สรุปเป็นตารางประวัติใน [backend 11 §2](backend/11-database-schema-seed-tests.md) |
| `prisma/seedCohort.js`, `demoSeed.js`, `seedDemoYears.js` | สคริปต์ข้อมูลทดสอบ/เดโม — สรุปหน้าที่และวิธีรันใน backend 11 (ตัวหลัก `seed.js` ไล่ละเอียด) |
| `tests/*.mjs` (smoke test 30+ ไฟล์) | สรุปว่าไฟล์ไหนเทสอะไรใน backend 11 §4 |
| `frontend/src/design/student.jsx` ส่วน mock (ยกเว้น `FormIntro`) | ไม่ได้ถูกเรียกใช้ในแอปจริงแล้ว — ระบุไว้ใน frontend 05 |
| `node_modules/`, `dist/`, `uploads/`, `assets/fonts` | ไม่ใช่โค้ดของโปรเจกต์ |

## ข้อสังเกตที่พบระหว่างอ่านโค้ด (ไม่ได้แก้ — ไว้ให้เจ้าของตัดสินใจ)
1. **`RoundBar` (frontend 10)** นับ "วันที่เหลือ" ด้วย `setHours` (timezone เครื่องผู้ใช้) ขณะที่ฝั่ง backend จงใจเลี่ยง `setHours` และใช้ UTC+7 คงที่ — ผู้ใช้ในไทยผลเหมือนกัน แต่ต่างได้ 1 วันถ้า timezone เครื่องไม่ใช่ไทย
2. **`manageUsersReal.jsx` (frontend 09)** รองรับ action `delete` ใน `runConfirmed` และ backend มี `DELETE /users/:id` แต่ตารางไม่มีปุ่มที่เรียกลบบัญชี (มีแค่ รีเซ็ตรหัส / เปลี่ยนบทบาท / ถอนสิทธิ์)
3. **โค้ด mock ที่ไม่ถูกเรียกใช้** — `student.jsx` ส่วนใหญ่ (StudentNews, ExamForm, UploadSlots, StudentStatus, StudentHistory), mock ใน `data.jsx` (`STUDENTS`, `NEWS`, `YEARLY`…), `src/App.css`, `src/styles/styles.css` (ไม่ถูก import)
4. **ชื่อฟังก์ชันสะกดเดิม** `updatasubject` (controller) / `updata` (repository) ใน subjects — ใช้ตามโค้ดจริง (อย่าเปลี่ยนเฉพาะที่เดียว ต้องแก้ routes + controller + repository พร้อมกัน)
5. `authController.js` `changePassword`/`getme` ใช้ `try/catch` ตอบ 500 เอง ไม่ใช้ `next(err)` เหมือนโมดูลอื่น — พฤติกรรมต่างกันเล็กน้อย (ไม่แปลง Prisma error เป็น status ละเอียด)

## ศัพท์พื้นฐานที่เจอบ่อย
| คำ | ความหมายสั้น ๆ |
|---|---|
| middleware | ฟังก์ชัน `(req, res, next)` ที่ request ต้องผ่านก่อนถึง controller (`authenticate`, `requireRole`, `rateLimit`, multer) |
| controller / repository | รับ-ตอบ HTTP + ตรวจ input / คุย Prisma อย่างเดียว |
| JWT + httpOnly cookie | token ยืนยันตัวตนเก็บใน cookie ที่ JavaScript อ่านไม่ได้ (กัน XSS) |
| row lock (`FOR UPDATE`) | จองแถวใน DB ระหว่าง transaction ไม่ให้สองคนแก้ใบเดียวกันพร้อมกัน |
| carry-forward | วิชาที่ผ่านแล้วถูกบันทึกต่อเป็น "ผ่าน" ในรอบถัดไปพร้อมธง `carried_forward` |
| phase ของรอบ | `scheduled / active / expired / closed` คำนวณจาก status + วันที่ (ไม่ได้เก็บใน DB) |
| controlled input | ช่องกรอกที่ค่ามาจาก React state เสมอ (`value` + `onChange`) |
| lazy initial state | `useState(() => ...)` ส่งฟังก์ชันให้คำนวณค่าเริ่มครั้งเดียว |
| dropped flag | ตัวแปร `let dropped=false` ใน `useEffect` กัน response เก่ามาทับของใหม่ (race condition) |
