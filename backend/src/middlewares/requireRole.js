// ใช้ต่อจาก authenticate เสมอ — อ่าน role จาก req.user (JWT payload)
// ไม่เชื่อ role จาก body ที่ client ส่งมา
//
// ตัวอย่างใช้งาน:
// router.get("/admin", authenticate, requireRole("staff"), controller)

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "ยังไม่ได้ login" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `ไม่มีสิทธิ์เข้าถึง — ต้องการ role: ${allowedRoles.join(" หรือ ")}`,
      });
    }

    next();
  };
};
