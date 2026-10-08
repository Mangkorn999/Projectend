import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { getAll, getActive, create, update, remove } from "./rounds.controller.js";

const router = express.Router();

// "/active" ต้องมาก่อน "/:id" เสมอ ไม่งั้นจะโดน match เป็น id
router.get("/active", authenticate, requireRole("student"), getActive);
// หน้าจัดการรอบ/ตัวเลือกรอบ → list รอบพร้อม phase
router.get("/", authenticate, getAll);
// ปุ่ม "สร้างรอบ"
router.post("/", authenticate, requireRole("officer"), create);
// ปุ่ม "แก้รอบ/เปิด/ปิดรอบ"
router.put("/:id", authenticate, requireRole("officer"), update);
// ปุ่ม "ลบรอบ"
router.delete("/:id", authenticate, requireRole("officer"), remove);

export default router;
