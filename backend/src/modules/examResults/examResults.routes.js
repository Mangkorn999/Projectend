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
// ─── เจ้าหน้าที่ ───
// executive ไม่มีสิทธิ์ดูผลสอบรายบุคคล — ดูได้แค่สถิติรวมที่ /api/dashboard
router.get("/", authenticate, requireRole("officer"), getAll);
router.patch("/:id/approve", authenticate, requireRole("officer"), approve);
router.patch("/:id/reject", authenticate, requireRole("officer"), reject);

export default router;
