// TODO Phase 2: subjects routes
// GET    /api/subjects       → ดึงรายวิชาทั้งหมด (ทุก role)
// POST   /api/subjects       → เพิ่มรายวิชา (staff เท่านั้น)
// PUT    /api/subjects/:id   → แก้ไขรายวิชา (staff เท่านั้น)
// DELETE /api/subjects/:id   → ลบรายวิชา (staff เท่านั้น)
  import express from "express";
  import { authenticate } from "../../middlewares/auth.js";
  import { requireRole } from "../../middlewares/requireRole.js";
  import { getAll, getById, updateMyCredentials } from "./students.controller.js";

  const router = express.Router();
  router.get("/", authenticate, requireRole("officer"), getAll);
  router.get("/:id", authenticate, getById); // staff, student ดูได้ (เช็ค ownership เพิ่มถ้า student ดูของคนอื่น)
  router.patch("/me/credentials", authenticate, requireRole("student"), updateMyCredentials);

  export default router;

  const router = express.Router();
  router.get("/", authenticate, requireRole("officer"), getAll);
  export default router;
