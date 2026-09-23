import express from "express";
import { getAll } from "./rooms.controller.js";
import { authenticate } from "../../middlewares/auth.js";

const router = express.Router();

// เดิมเป็น public เพราะมีหน้าสมัครสมาชิกที่ต้องเลือกห้องก่อน login
// ตอนนี้ไม่มีหน้าสมัครแล้ว (นักศึกษาถูก import เข้าระบบโดยเจ้าหน้าที่)
// ที่เรียกจริงมี 2 จุด และทั้งคู่อยู่หลัง login แล้ว:
//   completeProfile.jsx (นักศึกษากรอกโปรไฟล์ครั้งแรก) · studentDetailReal.jsx (เจ้าหน้าที่แก้ข้อมูล)
// จึงไม่มีเหตุผลให้เปิดรายชื่อห้องเรียนของคณะให้คนนอกดูอีกต่อไป
router.get("/", authenticate, getAll);

export default router;
