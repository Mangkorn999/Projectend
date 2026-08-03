import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { uploadImage } from "../../middlewares/upload.js";
import {
  getAll,
  createNews,
  updateNews,
  deleteNews,
  uploadNewsImage,
  deleteNewsImage,
  serveNewsImage,
} from "./news.controller.js";

const router = express.Router();

router.get("/", authenticate, getAll);
router.get("/:id/image", authenticate, serveNewsImage);
router.post("/:id/image", authenticate, requireRole("officer"), uploadImage.single("image"), uploadNewsImage);
router.delete("/:id/image", authenticate, requireRole("officer"), deleteNewsImage);
router.post("/", authenticate, requireRole("officer"), createNews);
router.put("/:id", authenticate, requireRole("officer"), updateNews);
router.delete("/:id", authenticate, requireRole("officer"), deleteNews);

export default router;
