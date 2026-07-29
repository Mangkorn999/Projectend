import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { getAll, updateRole } from "./users.controller.js";
const router = express.Router();

router.get("/", authenticate, requireRole("officer"), getAll);
router.post("/:id/role", authenticate, requireRole("officer"), updateRole);

export default router;
