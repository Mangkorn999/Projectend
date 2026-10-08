import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { uploadImage } from "../../middlewares/upload.js";
import {
  getAll,
  createNews,
  updateNews,
  deleteNews,
  uploadNewsImage,
  deleteNewsImage,
  serveNewsImage,
} from "./news.controller.js";

const router = express.Router();

// หน้าข่าว/ประกาศ → list ข่าว
router.get("/", authenticate, getAll);
// รูปประกอบข่าว → ส่งไฟล์รูป
router.get("/:id/image", authenticate, serveNewsImage);
// อัปโหลดรูปข่าว → เก็บ path ลง DB
router.post("/:id/image", authenticate, requireRole("officer"), uploadImage.single("image"), uploadNewsImage);
// ลบรูปข่าว
router.delete("/:id/image", authenticate, requireRole("officer"), deleteNewsImage);
// ปุ่ม "โพสต์ข่าว"
router.post("/", authenticate, requireRole("officer"), createNews);
// ปุ่ม "แก้ไขข่าว"
router.put("/:id", authenticate, requireRole("officer"), updateNews);
// ปุ่ม "ลบข่าว"
router.delete("/:id", authenticate, requireRole("officer"), deleteNews);

export default router;
