import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { getStats, exportReport } from "./dashboard.controller.js";

const router = express.Router();

router.get(
  "/stats",
  authenticate,
  requireRole("officer", "executive"),
  getStats,
);
router.get("/export", authenticate, requireRole("officer"), exportReport);

export default router;
