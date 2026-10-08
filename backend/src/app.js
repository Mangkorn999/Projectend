import "dotenv/config";
import express from "express";
import { validateEnv } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { requestLogger } from "./middlewares/requestLogger.js";

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
import helmet from "helmet";

// ตรวจ .env ก่อนเริ่ม app — ถ้าขาดตัวไหน throw error ทันที
validateEnv();

const app = express();

// บันทึกทุก HTTP request ลง terminal (method, url, status, เวลา, ผู้ใช้) — ไว้ให้ดูตอนสาธิต/ตรวจการทำงาน
// อยู่บนสุดเพื่อจับได้ทุก request รวมที่ถูก cors/helmet/404 ตอบกลับ
app.use(requestLogger);

// helmet = ชุด HTTP security header มาตรฐาน ใส่ให้ทุก response อัตโนมัติ
// เช่น X-Content-Type-Options (ห้าม browser เดาชนิดไฟล์เอง), X-Frame-Options (ห้ามเว็บอื่นเอาไป iframe)
// ต้องอยู่บนสุดก่อน middleware อื่น จะได้ครอบทุก response รวมทั้ง error ด้วย
//
// ปิด 2 ตัวที่ชนกับการใช้งานจริงของระบบนี้:
//   contentSecurityPolicy — ค่า default ของ helmet บล็อกการโหลด resource ข้าม origin
//     ซึ่งตอน dev frontend (5174) กับ backend (3000) คนละ origin กัน
//   crossOriginResourcePolicy — ต้องเป็น cross-origin ไม่งั้น <img>/PDF ที่ frontend ดึงจาก backend โดนบล็อก
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Middleware พื้นฐาน
// origin ที่อนุญาตให้ยิงเข้ามาได้ อ่านจาก .env (CORS_ORIGIN)
// ตอน dev คือ http://localhost:5174 (vite.config.js ตั้ง dev server ไว้ที่ 5174 ไม่ใช่ default 5173)
// ตอนขึ้น server จริง/ตอนสาธิต แค่แก้ค่าใน .env ไม่ต้องแก้โค้ด
// ใส่หลาย origin ได้ คั่นด้วย comma เช่น CORS_ORIGIN=http://localhost:5174,http://10.0.0.5:5174
const allowedOrigins = process.env.CORS_ORIGIN.split(",").map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
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

// ─── 404 (ไม่ตรง route ไหนเลย) ─────────────────────
// ต้องอยู่หลัง route ทุกตัว แต่ก่อน errorHandler
// ถ้าไม่มีตัวนี้ Express จะตอบหน้า HTML "Cannot GET /api/xxx" กลับไป
// แล้ว res.json() ฝั่ง frontend (api.js) จะ parse ไม่ได้ → ผู้ใช้เห็น error มั่วแทนข้อความจริง
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `ไม่พบ endpoint: ${req.method} ${req.originalUrl}`,
  });
});

// ─── Error Handler (ต้องอยู่ท้ายสุดเสมอ) ──────────
app.use(errorHandler);

export default app;
