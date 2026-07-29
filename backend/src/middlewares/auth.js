import jwt from "jsonwebtoken";

// ตรวจสอบ JWT ทุก request ที่ผ่านมา
// ถ้า token ไม่มี/หมดอายุ/ผิด → ส่ง 401 กลับทันที
// ถ้าถูกต้อง → แนบ req.user ไว้ให้ controller ใช้ต่อ

// path ที่ยังใช้ได้ตอนถูกบังคับเปลี่ยนรหัสผ่าน (req.path นับจาก /api/auth)
const PASSWORD_SETUP_PATHS = ["/me", "/password"];

export const authenticate = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // "Bearer <token>"

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "กรุณาเข้าสู่ระบบก่อน" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, role, studentId, mustChangePassword }

    // ยังใช้รหัสเริ่มต้นอยู่ → ใช้ได้แค่ดูข้อมูลตัวเองกับตั้งรหัสใหม่เท่านั้น
    // กันไว้ฝั่ง backend ด้วย ไม่พึ่ง frontend อย่างเดียว
    if (decoded.mustChangePassword && !PASSWORD_SETUP_PATHS.includes(req.path)) {
      return res.status(403).json({
        success: false,
        message: "กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งานระบบ",
        must_change_password: true,
      });
    }

    next();
  } catch (err) {
    console.error("JWT verify error:", err.message);
    return res
      .status(401)
      .json({ success: false, message: "Token ไม่ถูกต้องหรือหมดอายุ" });
  }
};
