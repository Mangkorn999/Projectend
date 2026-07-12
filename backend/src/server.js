import "dotenv/config";
import express from "express";
import authRouter from "./modules/auth/auth.routes.js";
import cors from "cors";
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(express.json());
app.use("/api/auth", authRouter);

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
