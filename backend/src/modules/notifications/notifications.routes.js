import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { getMine, markRead, markAllRead } from "./notifications.controller.js";

const router = express.Router();
router.get("/me", authenticate, getMine);
router.patch("/:id/read", authenticate, markRead);
router.patch("/read-all", authenticate, markAllRead);

export default router;
