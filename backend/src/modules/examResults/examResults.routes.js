import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { uploadEvidence } from "../../middlewares/upload.js";
import {
  create,
  getMine,
  getAll,
  approve,
  reject,
  revokeApproval,
  reopen,
} from "./examResults.controller.js";
import { upload as uploadCertificate } from "../certificates/certificates.controller.js";

const router = express.Router();

// ปุ่ม "ส่งผลสอบ" → สร้างใบ pending + ผลรายวิชา (transaction)
router.post("/", authenticate, requireRole("student"), create);
// หน้าสถานะ/ประวัติของฉัน → ดึงใบผลสอบของตัวเอง
router.get("/me", authenticate, requireRole("student"), getMine);
// ปุ่มอัปโหลด PDF → multer รับไฟล์ลง disk → เก็บ path ลง certificates
router.post(
  "/:id/certificates",
  authenticate,
  requireRole("student"),
  uploadEvidence.single("file"),
  uploadCertificate,
);
// ─── เจ้าหน้าที่ / เจ้าหน้าที่ตรวจสอบ ───
// executive ไม่มีสิทธิ์ดูผลสอบรายบุคคล — ดูได้แค่สถิติรวมที่ /api/dashboard
// reviewer ตรวจได้เหมือน officer (pooled queue เดียวกัน ไม่มี assignment)
// หน้าตรวจผลสอบ → list ใบทั้งหมด (กรองด้วย query)
router.get("/", authenticate, requireRole("officer", "reviewer"), getAll);
// ปุ่ม "ยืนยัน" → approved + บันทึก review_logs + แจ้งนักศึกษา
router.patch("/:id/approve", authenticate, requireRole("officer", "reviewer"), approve);
// ปุ่ม "ตีกลับ" (ต้องมี remark) → rejected + บันทึก review_logs + แจ้งนักศึกษา
router.patch("/:id/reject", authenticate, requireRole("officer", "reviewer"), reject);
// ถอนการยืนยัน (ยืนยันผิด) — เฉพาะ officer
router.patch("/:id/revoke-approval", authenticate, requireRole("officer"), revokeApproval);
// แก้ไขผลการตรวจ — ใบที่ยืนยันแล้ว/ถูกตีกลับ → กลับเป็นรอตรวจ (เฉพาะ officer) ปุ่มเดียวบนหน้าจอแทนการแยกถอนยืนยัน/ถอนตีกลับ
router.patch("/:id/reopen", authenticate, requireRole("officer"), reopen);

export default router;
