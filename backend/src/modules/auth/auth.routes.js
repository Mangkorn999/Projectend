import express from "express";
import {
  getme,
  login,
  changePassword,
  logout,
} from "../../controllers/authController.js";
import { authenticate } from "../../middlewares/auth.js";
import { rateLimit } from "../../middlewares/rateLimit.js";

const router = express.Router();

// rate-limit 2 ชั้นสำหรับ login:
//   ชั้นที่ 1 (ตาม psu_passport_id) — กันไล่เดารหัสผ่านของบัญชีใดบัญชีหนึ่ง
//   ชั้นที่ 2 (ตาม IP)              — กันไล่เดาแบบหมุนเปลี่ยน id ไปเรื่อยๆ (credential stuffing)
//                                     ชั้นแรกกันไม่ได้ เพราะแต่ละ id นับแยกกัน ยิง 100 id ก็ผ่านหมด
// ตัวเลข IP ตั้งไว้สูงกว่า เผื่อคณะใช้เน็ตตัวเดียวกันทั้งห้อง แล้วนักศึกษา login พร้อมกันหลายคน
// ปุ่ม "เข้าสู่ระบบ" → เช็ค rate limit → เทียบรหัส bcrypt → ออก JWT ใส่ cookie
router.post(
  "/login",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 60 }), // ไม่ใส่ keyField = นับตาม IP
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyField: "psu_passport_id" }),
  login,
);
// public — แค่สั่งลบ cookie ไม่ได้แตะข้อมูลใคร ถึง token พังอยู่ก็ต้องกด logout ได้
// ปุ่ม "ออกจากระบบ" → ลบ cookie
router.post("/logout", logout);
// เปิดเว็บ/รีเฟรช → ถาม backend ว่า cookie ยังใช้ได้ไหม + role อะไร
router.get("/me", authenticate, getme);
// เปลี่ยนรหัสผ่านต้องกรอกรหัสเดิมมาด้วย = เดาได้เหมือนกัน ต้องมี rate limit เหมือนหน้า login
// เดิมไม่มีเลย: ขโมย cookie มาได้แล้วนั่งไล่เดารหัสเดิมกี่ครั้งก็ได้ เพื่อยึดบัญชีถาวร
// นับตาม IP เพราะ body ไม่มี id ให้แยก (รู้ว่าเป็นใครจาก token อยู่แล้ว)
// หน้า "เปลี่ยนรหัสผ่าน" → เช็ครหัสเดิม → เก็บ hash ใหม่
router.patch(
  "/password",
  authenticate,
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }),
  changePassword,
);

export default router;
