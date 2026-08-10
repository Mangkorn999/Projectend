import express from "express";
import {
  getme,
  login,
  firstSetup,
  changePassword,
  logout,
} from "../../controllers/authController.js";
import { authenticate } from "../../middlewares/auth.js";
import { rateLimit } from "../../middlewares/rateLimit.js";

const router = express.Router();

// public — ไม่ต้อง authenticate เพราะบัญชียังไม่มี password ให้ login เข้ามาก่อน
// rate-limit แยกตาม student_id กัน brute-force เดาชื่อ-นามสกุลของ id เดียวกัน
router.post(
  "/first-setup",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyField: "student_id" }),
  firstSetup,
);
// rate-limit แยกตาม psu_passport_id — กัน brute-force เดารหัสผ่านของ id เดียวกัน
router.post(
  "/login",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyField: "psu_passport_id" }),
  login,
);
// public — แค่สั่งลบ cookie ไม่ได้แตะข้อมูลใคร ถึง token พังอยู่ก็ต้องกด logout ได้
router.post("/logout", logout);
router.get("/me", authenticate, getme);
router.patch("/password", authenticate, changePassword);

export default router;
