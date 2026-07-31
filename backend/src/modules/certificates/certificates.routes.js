import express from "express";
import { authenticate } from "../../middlewares/auth.js";
import { serveFile } from "./certificates.controller.js";

const router = express.Router();

router.get("/:id/file", authenticate, serveFile);

export default router;
