import express from "express";
import {
  getme,
  login,
  changePassword,
} from "../../controllers/authController.js";
import { authenticate } from "../../middlewares/auth.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", authenticate, getme);
router.patch("/password", authenticate, changePassword);

export default router;
