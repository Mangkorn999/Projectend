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
  // controller ตั้ง statusCode มาเอง (httpError) = ข้อความใน err.message คือข้อความที่ตั้งใจให้ผู้ใช้อ่าน
  // ห้ามเอาไปเดาว่าเป็น error ของ Prisma แล้วเขียนทับข้อความ (เช่น "รหัสวิชา NUR22021 มีอยู่แล้ว" มีเลข 22021 ปนอยู่)
  const hasOwnStatus = Boolean(err.statusCode);
  // error ที่มาจาก Prisma จริงๆ มีชื่อขึ้นต้นด้วย "PrismaClient" เสมอ (เช่น PrismaClientKnownRequestError)
  let isPrismaError = false;
  if (typeof err.name === "string" && err.name.startsWith("PrismaClient")) {
    isPrismaError = true;
  }
  const rawMessage = typeof err.message === "string" ? err.message : "";

  const isDuplicate = err.code === "P2002";
  const isNotFound = err.code === "P2025";
  // P2003 = อ้างอิงข้อมูลที่ไม่มีอยู่ หรือ ลบ/แก้ข้อมูลที่ยังมีตารางอื่นอ้างถึงอยู่
  // Postgres 23001 (restrict_violation, ข้อความ "violates RESTRICT setting of foreign key constraint")
  // = ลบแถวที่ตารางอื่นยังอ้างถึงอยู่ แบบที่ foreign key ตั้งเป็น RESTRICT — Prisma ไม่แปลงเป็น P2003 ให้
  // ส่งมาเป็น error ไม่มี code แทน เลยต้องดูจากข้อความเอง ไม่งั้นหลุดเป็น 500 ทั้งที่ความหมายเหมือน P2003 ทุกอย่าง
  let isRestrictViolation = false;
  if (isPrismaError && (rawMessage.includes("23001") || rawMessage.includes("violates RESTRICT"))) {
    isRestrictViolation = true;
  }
  const isForeignKey = err.code === "P2003" || isRestrictViolation;
  // ส่งเลข id ใหญ่เกินกว่าคอลัมน์ตัวเลขเก็บได้ (เช่น /api/certificates/99999999999)
  // Prisma โยน error แบบไม่มี code มา (PrismaClientUnknownRequestError) ข้อความดิบมีชื่อ model/ชนิดคอลัมน์ภายใน
  // เดิมหลุดเป็น 500 (ตอน NODE_ENV=development ผู้ใช้เห็นข้อความดิบของ Prisma ทั้งก้อน) — เป็นความผิดของ request ต้องเป็น 400
  const isNumberTooBig =
    err.name === "PrismaClientUnknownRequestError" &&
    rawMessage.includes("Unable to fit integer value");
  // ข้อความที่ส่งมามีอักขระ NUL (ไบต์ศูนย์) — Postgres เก็บไม่ได้ (รหัส 22021, "invalid byte sequence ... 0x00")
  // เช่น login ด้วยรหัสที่มีไบต์ศูนย์ หรือค้นด้วย ?student_id=%00 เป็นความผิดของ request ไม่ใช่ server พัง
  // ข้อความดิบมีรายละเอียด query ภายใน จึงต้องจับตรงนี้แล้วตอบ 400 แทน
  // ดูเฉพาะ error ของ Prisma ที่ controller ไม่ได้ตั้ง statusCode มาเอง — เดิมดูจากข้อความอย่างเดียว
  // ทำให้ httpError ที่บังเอิญมีคำว่า 22021 หรือ 0x00 ในข้อความ (เช่น รหัสวิชา) ถูกเขียนทับเป็น "ข้อมูลไม่ถูกต้อง"
  let isNulByte = false;
  if (isPrismaError && !hasOwnStatus) {
    if (
      err.code === "22021" ||
      rawMessage.includes("22021") ||
      rawMessage.includes("invalid byte sequence") ||
      rawMessage.includes("0x00")
    ) {
      isNulByte = true;
    }
  }
  // ค่าที่ส่งมา Prisma รับไม่ได้ (ผิดชนิด / ยาวเกิน / เป็น NaN / ตัวเลขใหญ่เกิน) = ความผิดของ request ไม่ใช่ server พัง
  const isBadInput =
    err.name === "PrismaClientValidationError" || err.code === "P2000" || isNumberTooBig || isNulByte;

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
  // ข้อความกลางของ Prisma ข้างล่าง (ซ้ำ / ไม่พบ / ถูกอ้างถึง / ข้อมูลไม่ถูกต้อง) ใช้เฉพาะ error ที่ controller
  // ไม่ได้ตั้ง statusCode มาเอง — ถ้าตั้งมาเอง แปลว่าเขียนข้อความไทยเฉพาะเรื่องมาแล้ว ต้องส่งข้อความนั้นตามเดิม
  let message = err.message;
  if (isDuplicate && !hasOwnStatus) {
    message = "ข้อมูลนี้ถูกบันทึกไปแล้ว กรุณารีเฟรชหน้าแล้วลองใหม่";
  }
  if (isNotFound && !hasOwnStatus) {
    message = "ไม่พบข้อมูลที่ต้องการ อาจถูกลบไปแล้ว กรุณารีเฟรชหน้า";
  }
  // multer (อัปโหลดไฟล์) ส่งข้อความภาษาอังกฤษมา — แปลเป็นไทยให้ผู้ใช้อ่านรู้เรื่อง (code มาจาก multer เอง)
  if (err.name === "MulterError") {
    const multerMessages = {
      LIMIT_FILE_SIZE: "ไฟล์ใหญ่เกินกำหนด กรุณาลดขนาดไฟล์แล้วลองใหม่",
      LIMIT_UNEXPECTED_FILE: "แนบไฟล์ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง",
      LIMIT_FILE_COUNT: "แนบไฟล์ได้ครั้งละ 1 ไฟล์",
    };
    message = multerMessages[err.code] ?? "อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่";
  }
  if (isForeignKey && !hasOwnStatus) {
    message = "ทำรายการไม่ได้ ข้อมูลที่อ้างถึงไม่มีอยู่ หรือข้อมูลนี้ยังถูกใช้งานอยู่";
  }
  if (isBadInput && !hasOwnStatus) {
    message = "ข้อมูลที่ส่งมาไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่";
  }
  // 500 = โค้ดเราพังเอง — ข้อความดิบมักมีชื่อตาราง/คอลัมน์/query ของ Prisma ห้ามส่งให้ผู้ใช้ (ดูได้ใน log ของ server)
  if (statusCode === 500 && process.env.NODE_ENV !== "development") {
    message = "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง";
  }
  if (!message) {
    message = "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง";
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
