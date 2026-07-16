import jwt from "jsonwebtoken";

// ตรวจสอบ JWT ทุก request ที่ผ่านมา
// ถ้า token ไม่มี/หมดอายุ/ผิด → ส่ง 401 กลับทันที
// ถ้าถูกต้อง → แนบ req.user ไว้ให้ controller ใช้ต่อ

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
    req.user = decoded; // { userId, role }
    next();
  } catch (err) {
    console.error("JWT verify error:", err.message);
    return res
      .status(401)
      .json({ success: false, message: "Token ไม่ถูกต้องหรือหมดอายุ" });
  }
};
