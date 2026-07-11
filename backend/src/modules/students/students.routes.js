// TODO Phase 2: subjects routes
// GET    /api/subjects       → ดึงรายวิชาทั้งหมด (ทุก role)
// POST   /api/subjects       → เพิ่มรายวิชา (staff เท่านั้น)
// PUT    /api/subjects/:id   → แก้ไขรายวิชา (staff เท่านั้น)
// DELETE /api/subjects/:id   → ลบรายวิชา (staff เท่านั้น)
import express from "express";

const router = express.Router();

// TODO: import authenticate, requireRole, และ controller
// router.get("/", authenticate, subjectsController.getAll);
// router.post("/", authenticate, requireRole("staff"), subjectsController.create);

export default router;
