// Error handler กลาง — ต้อง register ท้ายสุดใน app.js เสมอ
// ดักจับ error ทุกอย่างที่ controller ส่งผ่าน next(err)

export const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  // multer โยน MulterError มาโดยไม่มี statusCode (เช่น ไฟล์ใหญ่เกิน limit) → นับเป็น 400
  const statusCode =
    err.statusCode || (err.name === "MulterError" ? 400 : 500);
  const message = err.message || "เกิดข้อผิดพลาดภายใน server";

  res.status(statusCode).json({
    success: false,
    message,
    // แสดง stack เฉพาะตอน development เท่านั้น
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
