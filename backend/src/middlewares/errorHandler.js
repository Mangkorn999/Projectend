// Error handler กลาง — ต้อง register ท้ายสุดใน app.js เสมอ
// ดักจับ error ทุกอย่างที่ controller ส่งผ่าน next(err)

export const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  // หาว่าจะตอบ HTTP status อะไรกลับไป เรียงตามลำดับความสำคัญ:
  //   1. controller ใส่ err.statusCode มาเอง → ใช้ค่านั้น
  //   2. multer โยน MulterError มาโดยไม่มี statusCode (เช่น ไฟล์ใหญ่เกิน limit) → 400 (ผู้ใช้ส่งมาผิด)
  //   3. Prisma ฟ้องว่าข้อมูลซ้ำ constraint (P2002) → 409 (ไม่ใช่ bug ของเรา คนส่งซ้ำเอง)
  //   4. Prisma หาแถวที่จะแก้/ลบไม่เจอ (P2025) → 404 (ส่ง id ที่ไม่มีมา)
  //   5. นอกนั้นคือ bug ในระบบเรา → 500
  //
  // P2002 = "Unique constraint failed" เกิดตอน 2 request เขียนของซ้ำกันพร้อมกัน
  // เช่น นักศึกษากดส่งผลสอบรัวๆ 2 ครั้ง — request แรกเขียนสำเร็จ อีกอันชน @@unique([student_id, round_id])
  //
  // P2025 = "Record to update/delete does not exist" เกิดตอนส่ง id ที่ไม่มีอยู่จริงมา
  // เช่น เปิด 2 แท็บแล้วลบรายการเดียวกันทั้งคู่ — แท็บที่สองลบของที่หายไปแล้ว
  //
  // ทั้งคู่ถ้าไม่ดักตรงนี้จะกลายเป็น 500 พร้อมข้อความ Prisma ภาษาอังกฤษยาวๆ ที่ผู้ใช้อ่านไม่รู้เรื่อง
  // (และเผยโครงสร้างตารางภายในออกไปด้วย)
  const isDuplicate = err.code === "P2002";
  const isNotFound = err.code === "P2025";
  // P2003 = อ้างอิงข้อมูลที่ไม่มีอยู่ หรือ ลบ/แก้ข้อมูลที่ยังมีตารางอื่นอ้างถึงอยู่
  const isForeignKey = err.code === "P2003";
  // ค่าที่ส่งมา Prisma รับไม่ได้ (ผิดชนิด / ยาวเกิน / เป็น NaN) = ความผิดของ request ไม่ใช่ server พัง
  const isBadInput =
    err.name === "PrismaClientValidationError" || err.code === "P2000";

  let statusCode;
  if (err.statusCode) {
    statusCode = err.statusCode;
  } else if (err.name === "MulterError") {
    statusCode = 400;
  } else if (isDuplicate) {
    statusCode = 409;
  } else if (isNotFound) {
    statusCode = 404;
  } else if (isForeignKey) {
    statusCode = 409;
  } else if (isBadInput) {
    statusCode = 400;
  } else {
    statusCode = 500;
  }

  // err.message ว่าง (บาง error ไม่มีข้อความ) ค่อยใช้ข้อความกลาง
  let message = err.message;
  if (isDuplicate) {
    message = "ข้อมูลนี้ถูกบันทึกไปแล้ว กรุณารีเฟรชหน้าแล้วลองใหม่";
  }
  if (isNotFound) {
    message = "ไม่พบข้อมูลที่ต้องการ อาจถูกลบไปแล้ว กรุณารีเฟรชหน้า";
  }
  if (isForeignKey) {
    message = "ทำรายการไม่ได้ ข้อมูลที่อ้างถึงไม่มีอยู่ หรือข้อมูลนี้ยังถูกใช้งานอยู่";
  }
  if (isBadInput) {
    message = "ข้อมูลที่ส่งมาไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่";
  }
  // 500 = โค้ดเราพังเอง — ข้อความดิบมักมีชื่อตาราง/คอลัมน์/query ของ Prisma ห้ามส่งให้ผู้ใช้ (ดูได้ใน log ของ server)
  if (statusCode === 500 && process.env.NODE_ENV !== "development") {
    message = "เกิดข้อผิดพลาดภายใน server";
  }
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
