import express from "express";
import { getAll } from "./rooms.controller.js";

const router = express.Router();

// public — ใช้ตอนสมัครสมาชิก (ยังไม่ login)
router.get("/", getAll);

export default router;
