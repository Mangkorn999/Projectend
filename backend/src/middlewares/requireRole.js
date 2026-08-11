// ใช้ต่อจาก authenticate เสมอ — อ่าน role จาก req.user (JWT payload)
// ไม่เชื่อ role จาก body ที่ client ส่งมา
//
// ตัวอย่างใช้งาน:
// router.get("/admin", authenticate, requireRole("staff"), controller)

// (...allowedRoles) = rest parameter — รับ argument กี่ตัวก็ได้ แล้วมัดเป็น array ให้
//   requireRole("officer")               → allowedRoles = ["officer"]
//   requireRole("officer", "executive")  → allowedRoles = ["officer", "executive"]
// คืนค่าเป็น "ฟังก์ชัน" อีกที เพราะ Express ต้องการ middleware หน้าตา (req, res, next)
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      // code เดียวกับ authenticate — frontend เห็นแล้วเด้งกลับหน้า login
      return res.status(401).json({
        success: false,
        code: "auth_required",
        message: "ยังไม่ได้ login",
      });
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
