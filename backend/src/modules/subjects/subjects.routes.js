import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import {
  getAll,
  createAll,
  deleteSubject,
  updatasubject,
} from "./subjects.controller.js";

const router = express.Router();
// หน้าจัดการวิชา/ฟอร์มกรอกผล → list วิชา
router.get("/", authenticate, getAll);
// ปุ่ม "เพิ่มวิชา"
router.post("/", authenticate, requireRole("officer"), createAll);
// ปุ่ม "แก้วิชา"
router.put("/:id", authenticate, requireRole("officer"), updatasubject);
// ปุ่ม "ลบวิชา"
router.delete("/:id", authenticate, requireRole("officer"), deleteSubject);

export default router;
