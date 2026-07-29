import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { getAll, getActive, create, update } from "./rounds.controller.js";

const router = express.Router();

// "/active" ต้องมาก่อน "/:id" เสมอ ไม่งั้นจะโดน match เป็น id
router.get("/active", authenticate, requireRole("student"), getActive);
router.get("/", authenticate, getAll);
router.post("/", authenticate, requireRole("officer"), create);
router.put("/:id", authenticate, requireRole("officer"), update);

export default router;
