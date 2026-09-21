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
  exportSubjectList,
  getSubjectResultList,
} from "./student.controller.js";

// เก็บไฟล์ใน memory ไม่เขียนลง disk — ใช้ครั้งเดียวตอน parse แล้วทิ้ง
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB พอสำหรับ CSV รายชื่อ
});

const router = express.Router();
// executive ไม่มีสิทธิ์ดูข้อมูลรายบุคคล — ดูได้แค่ภาพรวมที่ /api/dashboard
// reviewer เห็น roster เต็มด้วย — คิวตรวจใช้ทำแท็บ "ยังไม่กรอก" (หาคนที่ยังไม่มีผลสอบเลย)
router.get("/", authenticate, requireRole("officer", "reviewer"), getAll);
// ต้องอยู่ก่อน "/:id" เสมอ ไม่งั้น express จับ "export-subject"/"subject-result-list" เป็นค่า :id แทน
// เฉพาะ officer เท่านั้น (เหมือน /api/dashboard/export) — ดูรายชื่อรายบุคคล ผู้บริหารไม่มีสิทธิ์ (data minimization)
router.get("/export-subject", authenticate, requireRole("officer"), exportSubjectList);
router.get("/subject-result-list", authenticate, requireRole("officer"), getSubjectResultList);
router.get("/:id", authenticate, requireRole("officer", "student", "reviewer"), getById); // student เช็ค ownership ต่อใน controller
// เพิ่มนักศึกษาทีละคน (พิมพ์เอง) — คู่กับ import CSV ด้านล่าง
router.post("/", authenticate, requireRole("officer"), create);
// นักศึกษากรอกโปรไฟล์ครั้งแรกหลัง login (บังคับผ่าน middleware ถ้ายังไม่มี student row)
router.post(
  "/complete-profile",
  authenticate,
  requireRole("student"),
  completeProfile,
);
router.patch(
  "/bulk-eligible",
  authenticate,
  requireRole("officer"),
  bulkSetEligible,
);
// officer อัปโหลด CSV รายชื่อ — multer แปะไฟล์ที่ req.file ให้ controller อ่านต่อ
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
router.delete("/:id", authenticate, requireRole("officer"), remove);
// เจ้าหน้าที่แก้ข้อมูลนักศึกษาทีหลัง — แก้ได้ทุก field (ต้องอยู่ท้ายสุดหลัง path เฉพาะทั้งหมด กัน "/:id" ชิงจับ)
router.patch("/:id", authenticate, requireRole("officer"), update);
export default router;
