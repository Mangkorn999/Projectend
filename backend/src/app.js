import "dotenv/config";
import express from "express";
import { validateEnv } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";

// Routes
import authRouter from "./Routes/authRoutes.js";
// TODO: import route modules ทีละ Phase ตามแผน
// import studentsRouter from "./modules/students/students.routes.js";
// import roundsRouter from "./modules/rounds/rounds.routes.js";
// import examResultsRouter from "./modules/examResults/examResults.routes.js";
// import newsRouter from "./modules/news/news.routes.js";
// import dashboardRouter from "./modules/dashboard/dashboard.routes.js";

// ตรวจ .env ก่อนเริ่ม app — ถ้าขาดตัวไหน throw error ทันที
validateEnv();

const app = express();

// Middleware พื้นฐาน
app.use(express.json());

// ─── Routes ──────────────────────────────────────────
app.use("/api/auth", authRouter);
// TODO: เพิ่ม route ทีละ Phase
// app.use("/api/students", studentsRouter);
// app.use("/api/rounds", roundsRouter);
// app.use("/api/exam-results", examResultsRouter);
// app.use("/api/news", newsRouter);
// app.use("/api/dashboard", dashboardRouter);

// ─── Error Handler (ต้องอยู่ท้ายสุดเสมอ) ──────────
app.use(errorHandler);

export default app;
