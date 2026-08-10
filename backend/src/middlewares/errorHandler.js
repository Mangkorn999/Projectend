// Error handler กลาง — ต้อง register ท้ายสุดใน app.js เสมอ
// ดักจับ error ทุกอย่างที่ controller ส่งผ่าน next(err)

export const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  // หาว่าจะตอบ HTTP status อะไรกลับไป เรียงตามลำดับความสำคัญ:
  //   1. controller ใส่ err.statusCode มาเอง → ใช้ค่านั้น
  //   2. multer โยน MulterError มาโดยไม่มี statusCode (เช่น ไฟล์ใหญ่เกิน limit) → 400 (ผู้ใช้ส่งมาผิด)
  //   3. นอกนั้นคือ bug ในระบบเรา → 500
  let statusCode;
  if (err.statusCode) {
    statusCode = err.statusCode;
  } else if (err.name === "MulterError") {
    statusCode = 400;
  } else {
    statusCode = 500;
  }

  // err.message ว่าง (บาง error ไม่มีข้อความ) ค่อยใช้ข้อความกลาง
  let message = err.message;
  if (!message) {
    message = "เกิดข้อผิดพลาดภายใน server";
  }

  res.status(statusCode).json({
    success: false,
    message,
    // แสดง stack เฉพาะตอน development เท่านั้น
    // บรรทัดล่างคือท่า "ใส่ key นี้แบบมีเงื่อนไข":
    //   เป็น development → ได้ { stack: ... } แล้ว ... กระจาย key stack เข้ามาใน object นี้
    //   ไม่ใช่ development → ได้ false แล้ว ...false ไม่เพิ่มอะไรเลย (ไม่ error)
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
