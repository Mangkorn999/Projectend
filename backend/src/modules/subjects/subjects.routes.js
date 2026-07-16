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
router.get("/", authenticate, getAll);
router.post("/", authenticate, requireRole("officer"), createAll);
router.put("/:id", authenticate, requireRole("officer"), updatasubject);
router.delete("/:id", authenticate, requireRole("officer"), deleteSubject);

export default router;
