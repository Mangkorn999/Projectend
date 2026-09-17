import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ตรวจสอบ JWT ทุก request ที่ผ่านมา
// ถ้า token ไม่มี/หมดอายุ/ผิด → ส่ง 401 กลับทันที
// ถ้าถูกต้อง → แนบ req.user ไว้ให้ controller ใช้ต่อ

// path ที่ยังใช้ได้ตอนถูกบังคับเปลี่ยนรหัสผ่าน (req.path นับจาก /api/auth)
const PASSWORD_SETUP_PATHS = ["/me", "/password"];
// path ที่ยังใช้ได้ตอนนักศึกษายังไม่กรอกโปรไฟล์ครั้งแรก (req.path นับจากจุด mount ของ router นั้นๆ)
const PROFILE_SETUP_PATHS = ["/me", "/complete-profile"];

export const authenticate = async (req, res, next) => {
  // token อยู่ใน httpOnly cookie ชื่อ "token" — browser แนบมาให้เองทุก request
  // frontend ไม่ได้ส่ง Authorization header มาแล้ว (JS อ่าน httpOnly cookie ไม่ได้)
  // req.cookies มาจาก cookieParser() ใน app.js — เช็คก่อนกันกรณี middleware ไม่ได้ถูก mount
  let token = null;
  if (req.cookies) {
    token = req.cookies.token;
  }

  // code: "auth_required" = "cookie ใช้ไม่ได้ ต้อง login ใหม่" — frontend ใช้ code นี้ตัดสินใจว่าจะเด้งกลับหน้า login ไหม
  // 401 ที่มาจากการเช็ครหัสผ่าน (login ผิด / รหัสเดิมผิด) ต้องไม่มี code นี้ ไม่งั้นกรอกผิดทีเดียวหน้าจะ reload ทิ้ง
  if (!token) {
    return res.status(401).json({
      success: false,
      code: "auth_required",
      message: "กรุณาเข้าสู่ระบบก่อน",
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    console.error("JWT verify error:", err.message);
    return res.status(401).json({
      success: false,
      code: "auth_required",
      message: "Token ไม่ถูกต้องหรือหมดอายุ",
    });
  }

  try {
    // token ถูกต้องไม่ได้แปลว่าเจ้าของยังอยู่ — ต้องเช็คกับ DB ทุกครั้ง
    // เคสที่เกิดจริง:
    //   1. รัน `prisma db seed` ล้าง users แล้วสร้างใหม่ → user_id ชุดใหม่ แต่ browser ยังถือ token เก่า
    //      ถ้าปล่อยผ่าน controller จะเอา userId ที่ไม่มีจริงไปเขียน DB แล้วพังเป็น
    //      "Foreign key constraint violated: submission_rounds_created_by_fkey" (500 อ่านไม่รู้เรื่อง)
    //   2. เจ้าหน้าที่ถูกถอนสิทธิ์ (users revoke) แต่ token ใบเก่ายังไม่หมดอายุ → ต้องตัดออกทันที
    const user = await prisma.user.findUnique({
      where: { user_id: decoded.userId },
      select: {
        user_id: true,
        psu_passport_id: true,
        password_hash: true,
        must_change_password: true,
        role: { select: { role_name: true } },
        student: { select: { student_id: true } },
      },
    });

    // ไม่มี user นี้แล้ว หรือถูกถอนสิทธิ์ (password_hash ถูกล้างเป็น null) → ให้ login ใหม่
    if (!user || !user.password_hash) {
      return res.status(401).json({
        success: false,
        code: "auth_required",
        message: "บัญชีนี้ใช้งานไม่ได้แล้ว กรุณาเข้าสู่ระบบใหม่",
      });
    }

    // ยึดค่าจาก DB เป็นหลัก ไม่ใช่ค่าที่แช่อยู่ใน token ตั้งแต่ตอน login
    // เปลี่ยน role ให้ใครแล้วมีผลทันที ไม่ต้องรอ token เก่าหมดอายุ
    req.user = {
      userId: user.user_id,
      username: user.psu_passport_id,
      role: user.role.role_name,
      studentId: user.student?.student_id ?? null,
      mustChangePassword: user.must_change_password,
    };

    // ยังใช้รหัสเริ่มต้นอยู่ → ใช้ได้แค่ดูข้อมูลตัวเองกับตั้งรหัสใหม่เท่านั้น
    // กันไว้ฝั่ง backend ด้วย ไม่พึ่ง frontend อย่างเดียว
    if (
      req.user.mustChangePassword &&
      !PASSWORD_SETUP_PATHS.includes(req.path)
    ) {
      return res.status(403).json({
        success: false,
        message: "กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งานระบบ",
        must_change_password: true,
      });
    }

    // นักศึกษาที่ยังไม่เคยกรอกโปรไฟล์ (ไม่มี student row) → ใช้ได้แค่ /me กับ complete-profile
    if (
      req.user.role === "student" &&
      !req.user.studentId &&
      !PROFILE_SETUP_PATHS.includes(req.path)
    ) {
      return res.status(403).json({
        success: false,
        message: "กรุณากรอกข้อมูลโปรไฟล์ให้ครบก่อนใช้งานระบบ",
        profile_incomplete: true,
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};
