import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { getAll, create, updateRole, revokeAccess } from "./users.controller.js";
const router = express.Router();

router.get("/", authenticate, requireRole("officer"), getAll);
router.post("/", authenticate, requireRole("officer"), create);
router.post("/:id/role", authenticate, requireRole("officer"), updateRole);
router.post("/:id/revoke", authenticate, requireRole("officer"), revokeAccess);

export default router;
