import "dotenv/config";
import express from "express";
import authRouter from "./Routes/authRoutes.js";
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/api/auth", authRouter);
console.log("JWT_SECRET =", process.env.JWT_SECRET);

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
