import express from "express";
import multer from "multer";
import { authenticate } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import {
  getAll,
  getById,
  create,
  update,
  completeProfile,
  bulkSetEligible,
  bulkImport,
  resetPassword,
  remove,
  listPendingAccounts,
  bulkRemove,
  removePendingAccounts,
} from "./student.controller.js";
import {
  exportSubjectList,
  exportStudents,
  getSubjectResultList,
} from "./student.export.controller.js";

// เก็บไฟล์ใน memory ไม่เขียนลง disk — ใช้ครั้งเดียวตอน parse แล้วทิ้ง
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB พอสำหรับ CSV รายชื่อ
});

const router = express.Router();
// executive ไม่มีสิทธิ์ดูข้อมูลรายบุคคล — ดูได้แค่ภาพรวมที่ /api/dashboard
// reviewer เห็น roster เต็มด้วย — คิวตรวจใช้ทำแท็บ "ยังไม่กรอก" (หาคนที่ยังไม่มีผลสอบเลย)
// หน้ารายชื่อนักศึกษา → list ทั้งหมด
router.get("/", authenticate, requireRole("officer", "reviewer"), getAll);
// ต้องอยู่ก่อน "/:id" เสมอ ไม่งั้น express จับ "export-subject"/"subject-result-list" เป็นค่า :id แทน
// เฉพาะ officer เท่านั้น (เหมือน /api/dashboard/export) — ดูรายชื่อรายบุคคล ผู้บริหารไม่มีสิทธิ์ (data minimization)
router.get("/export-subject", authenticate, requireRole("officer"), exportSubjectList);
// รายชื่อ/ข้อมูลนักศึกษาเป็น Excel (ไม่มีเลขบัตร) — POST เพราะส่งรายชื่อรหัสที่กรองอยู่มาเป็น body
router.post("/export", authenticate, requireRole("officer"), exportStudents);
// หน้าสรุป/รายงาน: ดูรายชื่อนักศึกษาที่ผ่าน-ไม่ผ่านรายวิชา (modal รายชื่อ)
router.get("/subject-result-list", authenticate, requireRole("officer"), getSubjectResultList);
// บัญชีที่ import แล้วยังไม่กรอกโปรไฟล์ — ต้องอยู่ก่อน /:id ไม่งั้น "pending-accounts" ถูกตีเป็นรหัสนักศึกษา
router.get("/pending-accounts", authenticate, requireRole("officer"), listPendingAccounts);
// ปุ่มลบบัญชีที่ยังไม่เคย login (เลือกหลายรายการ)
router.post("/pending-accounts/delete", authenticate, requireRole("officer"), removePendingAccounts);
// ลบนักศึกษาหลายคนพร้อมกัน (เฉพาะคนที่ยังไม่มีผลสอบ)
router.post("/bulk-delete", authenticate, requireRole("officer"), bulkRemove);
// หน้ารายละเอียดนักศึกษา → ข้อมูลรายคน
router.get("/:id", authenticate, requireRole("officer", "student", "reviewer"), getById); // student เช็ค ownership ต่อใน controller
// เพิ่มนักศึกษาทีละคน (พิมพ์เอง) — คู่กับ import CSV ด้านล่าง
router.post("/", authenticate, requireRole("officer"), create); // ปุ่ม "เพิ่มนักศึกษา" → สร้าง users + students
// นักศึกษากรอกโปรไฟล์ครั้งแรกหลัง login (บังคับผ่าน middleware ถ้ายังไม่มี student row)
// หน้ากรอกโปรไฟล์ครั้งแรก → สร้างแถว students ผูก users
router.post(
  "/complete-profile",
  authenticate,
  requireRole("student"),
  completeProfile,
);
// ปุ่มเปิด/ปิดสิทธิ์กรอกผล (ทีละคน/ทั้งรุ่น) → exam_eligible
router.patch(
  "/bulk-eligible",
  authenticate,
  requireRole("officer"),
  bulkSetEligible,
);
// officer อัปโหลด CSV รายชื่อ — multer แปะไฟล์ที่ req.file ให้ controller อ่านต่อ
// ปุ่ม "นำเข้า CSV" → parse ไฟล์ → สร้างบัญชีทีละแถว (bcrypt)
router.post(
  "/import",
  authenticate,
  requireRole("officer"),
  upload.single("file"),
  bulkImport,
);
// เจ้าหน้าที่ "รีเซ็ต" รหัสผ่าน = กรอกเลขบัตร ปชช เดิมซ้ำ (password นักศึกษา = เลขบัตร ปชช เสมอ ไม่มีรหัสชั่วคราว)
router.post(
  "/:id/reset-password",
  authenticate,
  requireRole("officer"),
  resetPassword,
);
// ลบนักศึกษาที่ import ผิด — controller กันไว้ไม่ให้ลบคนที่มีผลสอบแล้ว
// ปุ่ม "ลบนักศึกษา"
router.delete("/:id", authenticate, requireRole("officer"), remove);
// เจ้าหน้าที่แก้ข้อมูลนักศึกษาทีหลัง — แก้ได้ทุก field (ต้องอยู่ท้ายสุดหลัง path เฉพาะทั้งหมด กัน "/:id" ชิงจับ)
router.patch("/:id", authenticate, requireRole("officer"), update);
export default router;
