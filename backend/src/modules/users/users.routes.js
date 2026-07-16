// TODO Phase 3: users/students management routes
import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { getAll, updataRole } from "./users.controller";
const router = express.Router();

router.get("/", authenticate, requireRole("officer"), getAll);
router.post("/:id/role", authenticate, requireRole("officer"), updataRole);

export default router;
