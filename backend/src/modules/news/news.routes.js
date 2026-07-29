import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import {
  getAll,
  createNews,
  updateNews,
  deleteNews,
} from "./news.controller.js";

const router = express.Router();

router.get("/", authenticate, getAll);
router.post("/", authenticate, requireRole("officer"), createNews);
router.put("/:id", authenticate, requireRole("officer"), updateNews);
router.delete("/:id", authenticate, requireRole("officer"), deleteNews);

export default router;
