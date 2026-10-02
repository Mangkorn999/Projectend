import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { serveFile, remove } from "./certificates.controller.js";

const router = express.Router();

router.get("/:id/file", authenticate, serveFile);
// นักศึกษาลบไฟล์หลักฐานของตัวเองทีละไฟล์ (แนบไฟล์อยู่ที่ POST /api/exam-results/:id/certificates)
// เจ้าหน้าที่/ผู้ช่วยตรวจลบไม่ได้ — หลักฐานเป็นของนักศึกษา ถ้าไฟล์ไม่ถูกต้องให้ตีกลับแทน
router.delete("/:id", authenticate, requireRole("student"), remove);

export default router;
