import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import {
  getAll,
  create,
  updateRole,
  revokeAccess,
  resetPassword,
  deleteUser,
} from "./users.controller.js";
const router = express.Router();

// หน้าจัดการผู้ใช้ → list ผู้ใช้
router.get("/", authenticate, requireRole("officer"), getAll);
// ปุ่ม "เพิ่มผู้ใช้" (เจ้าหน้าที่/ผู้บริหาร/ผู้ช่วยตรวจ)
router.post("/", authenticate, requireRole("officer"), create);
// ปุ่มเปลี่ยนสิทธิ์ → อัปเดต role_id
router.post("/:id/role", authenticate, requireRole("officer"), updateRole);
// ปุ่ม "ถอนสิทธิ์" → ปิดการเข้าใช้ของบัญชี
router.post("/:id/revoke", authenticate, requireRole("officer"), revokeAccess);
// ปุ่ม "ลบผู้ใช้" (ลบไม่ได้ถ้ามีข้อมูลอ้างอิง → 409)
router.delete("/:id", authenticate, requireRole("officer"), deleteUser);
// เจ้าหน้าที่รีเซ็ตรหัสให้ officer/executive ที่ลืมรหัส — ไม่มี self-service reset ในระบบ
router.post(
  "/:id/reset-password",
  authenticate,
  requireRole("officer"),
  resetPassword,
);

export default router;
