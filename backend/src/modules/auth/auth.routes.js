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
