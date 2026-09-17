// in-memory rate limiter — พอสำหรับ deploy เดียว ไม่ต้องพึ่ง Redis
// กัน brute-force endpoint ที่ยังไม่ auth ได้ (เช่น login ที่ใครก็ยิงได้โดยไม่ต้องมี token)
// buckets เก็บใน memory ของ process เดียว — ถ้า scale หลาย instance ในอนาคตต้องย้ายไป Redis
const buckets = new Map();

// เก็บ bucket ทิ้งไม่หมดอายุจะทำให้ memory โตขึ้นเรื่อยๆ ถ้า server รันนานๆ
// เลยเช็คทุก 10 นาที แล้วลบ bucket ที่หมดเวลาไปแล้วทิ้ง
setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now > bucket.resetAt) buckets.delete(key);
    }
  },
  10 * 60 * 1000,
).unref(); // unref กัน setInterval นี้ค้าง process ตอนปิด server

// windowMs = ช่วงเวลานับรอบ (ms), max = จำนวนครั้งสูงสุดในช่วงนั้น
// keyField = ชื่อฟิลด์ใน req.body ที่ใช้แยก bucket ต่อคน (เช่น "student_id")
//            ถ้าไม่ระบุ จะ fallback ไปนับตาม IP แทน (กันกรณี field ไม่มีในบาง endpoint)
export const rateLimit = ({ windowMs, max, keyField }) => {
  return (req, res, next) => {
    // นับแยกต่อ student_id ไม่ใช่แค่ต่อ IP — กันคนเดา id คนอื่นจาก IP เดียวกัน (เช่น หอพัก/ห้อง lab)
    // ได้พร้อมกันหลายครั้ง โดยไม่ทำให้คนอื่นที่ใช้ IP เดียวกันโดน block ไปด้วย
    const identity = keyField ? req.body?.[keyField] : req.ip;
    // รวม path เข้าไปใน key ด้วย เผื่อ middleware ตัวนี้ถูกใช้ซ้ำกับหลาย endpoint พร้อมกัน
    const key = `${req.path}:${identity || req.ip}`;
    const now = Date.now();

    const bucket = buckets.get(key);
    // ยังไม่เคยมี bucket หรือหมดช่วงเวลาเดิมแล้ว → เริ่มนับรอบใหม่
    if (!bucket || now > bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    // ยิงเกิน max ครั้งในช่วงเวลานี้ → ปฏิเสธ พร้อมบอกว่าต้องรออีกกี่วินาที
    if (bucket.count >= max) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      return res.status(429).json({
        success: false,
        message: `ลองมากเกินไป กรุณาลองใหม่ใน ${retryAfterSec} วินาที`,
      });
    }

    bucket.count += 1;
    next();
  };
};
