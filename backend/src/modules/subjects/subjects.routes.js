import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import {
  getAll,
  createAll,
  deleteSubject,
  updatasubject,
} from "./subjects.controller";

const router = express.router();
router.get("/", authenticate, getAll);
router.post("/", authenticate, requireRole("officer"), createAll);
router.put("/:id", authenticate, requireRole("officer"), updatasubject);
router.delete("/:id", authenticate, requireRole("officer"), deleteSubject);
