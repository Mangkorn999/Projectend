import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { uploadPdf } from "../../middlewares/upload.js";
import {
  create,
  getMine,
  getAll,
  approve,
  reject,
  revokeApproval,
} from "./examResults.controller.js";
import { upload as uploadCertificate } from "../certificates/certificates.controller.js";

const router = express.Router();

router.post("/", authenticate, requireRole("student"), create);
router.get("/me", authenticate, requireRole("student"), getMine);
router.post(
  "/:id/certificates",
  authenticate,
  requireRole("student"),
  uploadPdf.single("file"),
  uploadCertificate,
);
// ─── เจ้าหน้าที่ / เจ้าหน้าที่ตรวจสอบ ───
// executive ไม่มีสิทธิ์ดูผลสอบรายบุคคล — ดูได้แค่สถิติรวมที่ /api/dashboard
// reviewer ตรวจได้เหมือน officer (pooled queue เดียวกัน ไม่มี assignment)
router.get("/", authenticate, requireRole("officer", "reviewer"), getAll);
router.patch("/:id/approve", authenticate, requireRole("officer", "reviewer"), approve);
router.patch("/:id/reject", authenticate, requireRole("officer", "reviewer"), reject);
// ถอนการยืนยัน (ยืนยันผิด) — เฉพาะ officer
router.patch("/:id/revoke-approval", authenticate, requireRole("officer"), revokeApproval);

export default router;
