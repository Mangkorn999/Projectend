import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { getAll, getById, bulkSetEligible } from "./student.controller.js";

const router = express.Router();
router.get("/", authenticate, requireRole("officer", "executive"), getAll);
router.get("/:id", authenticate, getById); // เช็ค ownership ใน controller
router.patch(
  "/bulk-eligible",
  authenticate,
  requireRole("officer"),
  bulkSetEligible,
);
export default router;
