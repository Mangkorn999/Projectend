import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { getMine, markRead, markAllRead } from "./notifications.controller.js";

const router = express.Router();

// ทุก route ต้องเป็น student เท่านั้น
// ถ้าปล่อยให้ officer/executive เข้ามาได้ req.user.studentId จะเป็น undefined
// แล้ว Prisma จะมองว่า "ไม่ต้องกรอง" → getMine เห็นแจ้งเตือนของทุกคน
// และ markAllRead จะ mark ว่าอ่านแล้วของทั้งระบบ
// กระดิ่งแจ้งเตือน → list ของตัวเอง
router.get("/me", authenticate, requireRole("student"), getMine);
// ปุ่ม "อ่านทั้งหมด" → is_read = true
router.patch("/read-all", authenticate, requireRole("student"), markAllRead);
// กดอ่านทีละอัน
router.patch("/:id/read", authenticate, requireRole("student"), markRead);

export default router;
