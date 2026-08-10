import "dotenv/config";
import express from "express";
import { validateEnv } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";

// Routes
import authRouter from "./modules/auth/auth.routes.js";
import subjectsRouter from "./modules/subjects/subjects.routes.js";
import usersRouter from "./modules/users/users.routes.js";
import studentsRouter from "./modules/students/students.routes.js";
import roundsRouter from "./modules/rounds/rounds.routes.js";
import examResultsRouter from "./modules/examResults/examResults.routes.js";
import newsRouter from "./modules/news/news.routes.js";
import dashboardRouter from "./modules/dashboard/dashboard.routes.js";
import roomsRouter from "./modules/rooms/rooms.routes.js";
import certificatesRouter from "./modules/certificates/certificates.routes.js";
import notificationsRouter from "./modules/notifications/notifications.routes.js";

import cors from "cors";
import cookieParser from "cookie-parser";

// ตรวจ .env ก่อนเริ่ม app — ถ้าขาดตัวไหน throw error ทันที
validateEnv();

const app = express();

// Middleware พื้นฐาน
app.use(
  cors({
    // vite.config.js ตั้ง dev server ไว้ที่ 5174 (ไม่ใช่ default 5173)
    origin: "http://localhost:5174",
    credentials: true,
  }),
);
app.use(express.json());
// อ่าน cookie ที่ browser ส่งมาแล้วใส่ไว้ที่ req.cookies ให้ middleware ใช้
// ต้องอยู่ก่อน routes ทุกตัว ไม่งั้น req.cookies จะเป็น undefined
app.use(cookieParser());

// ─── Routes ──────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/subjects", subjectsRouter);
app.use("/api/users", usersRouter);
app.use("/api/students", studentsRouter);
app.use("/api/rounds", roundsRouter);
app.use("/api/exam-results", examResultsRouter);
app.use("/api/news", newsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/certificates", certificatesRouter);
app.use("/api/notifications", notificationsRouter);

// ─── Error Handler (ต้องอยู่ท้ายสุดเสมอ) ──────────
app.use(errorHandler);

export default app;
