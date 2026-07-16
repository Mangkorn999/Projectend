import express from "express";
import { getme, login } from "../../controllers/authController.js";
import { authenticate } from "../../middlewares/auth.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", authenticate, getme);

export default router;
