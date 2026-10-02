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
        message: "กรุณาเข้าสู่ระบบก่อนใช้งาน",
      });
    }

    // ข้อความที่ผู้ใช้เห็นต้องไม่มีชื่อ role ภาษาอังกฤษ (officer/reviewer/...) — บอกแค่ว่าไม่มีสิทธิ์ + ทำอะไรต่อ
    // (อยากรู้ว่า route นี้ต้องการ role อะไร ดูได้จากไฟล์ routes ของโมดูลนั้น)
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "ท่านไม่มีสิทธิ์ใช้งานส่วนนี้ หากจำเป็นต้องใช้งาน กรุณาติดต่อเจ้าหน้าที่คณะ",
      });
    }

    next();
  };
};
