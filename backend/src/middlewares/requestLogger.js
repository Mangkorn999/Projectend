// บันทึกทุก HTTP request ที่เข้ามา ลง terminal ของ backend
// ตัวอย่างผลลัพธ์:
//   [2026-10-08 14:03:21] GET /api/news?limit=5 -> 200 (12 ms) user=7 role=student
//   [2026-10-08 14:03:25] POST /api/auth/login -> 401 (85 ms) user=-
//
// ไม่บันทึก body / password / cookie / token เด็ดขาด — เก็บแค่ method, url, status, เวลา, ผู้ใช้
// ต้อง register เป็น middleware ตัวแรกๆ ใน app.js เพื่อให้จับได้ทุก request (รวม 404 และ error)

export const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // "finish" = เหตุการณ์ที่เกิดตอน response ส่งกลับ client เสร็จแล้ว
  // รอถึงตอนนั้นเพราะตอนนี้ยังไม่รู้ status code และ authenticate ยังไม่ได้ใส่ req.user
  res.on("finish", () => {
    const durationMs = Date.now() - startTime;

    // เวลาแบบ 2026-10-08 14:03:21 (ตัด T กับ .000Z ของ ISO ออก)
    const time = new Date().toISOString().replace("T", " ").slice(0, 19);

    // req.user มีเฉพาะ request ที่ผ่าน authenticate แล้ว (endpoint public เช่น login จะไม่มี)
    let userText = "user=-";
    if (req.user) {
      userText = `user=${req.user.userId} role=${req.user.role}`;
    }

    // originalUrl = path เต็มพร้อม query string (req.url จะโดนตัด prefix ตอนเข้า router)
    console.log(`[${time}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs} ms) ${userText}`);
  });

  next();
};
