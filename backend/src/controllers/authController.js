import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import prisma from "../config/db.js";

// จำนวนรอบ hash — ยิ่งสูงยิ่งช้าและยิ่งเดายาก 10 คือค่ามาตรฐาน
const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

// ตัวเลือกของ cookie ที่ใช้เก็บ token
// ต้องใช้ชุดเดียวกันทั้งตอน res.cookie() (ตอน login) และ res.clearCookie() (ตอน logout)
// ถ้าสองที่ไม่ตรงกัน browser จะถือว่าเป็น cookie คนละใบ แล้วลบไม่ออก = กด logout แต่ยัง login อยู่
// secure: true = browser จะส่ง cookie ใบนี้เฉพาะตอนเว็บเป็น HTTPS เท่านั้น
//   dev (http://localhost) ต้องเป็น false ไม่งั้น cookie ไม่ถูกส่ง = login ไม่ติด
//   ขึ้น server จริงที่เป็น HTTPS ต้องเป็น true ไม่งั้น token วิ่งเป็นข้อความเปล่าให้ดักอ่านได้
// อ่านจาก .env (COOKIE_SECURE=true/false) — ไม่ต้องแก้โค้ดตอนย้ายไป server จริง
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

const TOKEN_COOKIE_OPTIONS = {
  httpOnly: true, // JavaScript ในหน้าเว็บอ่านไม่ได้ = XSS ขโมย token ไปไม่ได้
  secure: COOKIE_SECURE,
  sameSite: "lax", // เว็บอื่นยิง request ข้ามเว็บมา browser จะไม่แนบ cookie ให้ = กัน CSRF
  path: "/", // ใช้ได้ทุก path ใต้ domain นี้
  maxAge: 24 * 60 * 60 * 1000, // 1 วัน (หน่วยเป็น ms) ต้องเท่ากับ expiresIn ของ JWT
};

// login ด้วย psu_passport_id + password ในระบบเอง
// (เดิมใช้ PSU One Passport แต่ขอ credential ไม่ได้ เลยทำ auth เอง)
export const login = async (req, res, next) => {
  try {
    const { psu_passport_id, password } = req.body;

    // ต้องเป็นข้อความ — ส่ง object มาเดิมทำให้ Prisma พังเป็น 500 แทนที่จะตอบว่าข้อมูลผิด
    if (
      typeof psu_passport_id !== "string" ||
      typeof password !== "string" ||
      !psu_passport_id ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "กรุณากรอกรหัสผู้ใช้และรหัสผ่าน",
      });
    }

    const user = await prisma.user.findUnique({
      where: { psu_passport_id },
      include: { role: true, student: true },
    });

    // ไม่บอกว่าผิดที่ username หรือ password — กันคนไล่เดาว่ามีบัญชีนี้อยู่จริงไหม
    const invalid = () =>
      res
        .status(401)
        .json({ success: false, message: "รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });

    if (!user) return invalid();

    // บัญชีที่เจ้าหน้าที่สร้างไว้แต่ยังไม่ตั้งรหัส — ห้ามเข้าเด็ดขาด
    if (!user.password_hash) {
      return res.status(403).json({
        success: false,
        message: "บัญชียังไม่ได้ตั้งรหัสผ่าน กรุณาติดต่อเจ้าหน้าที่คณะ",
      });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return invalid();

    const token = jwt.sign(
      {
        userId: user.user_id,
        role: user.role.role_name,
        studentId: user.student?.student_id ?? null,
        // ใส่ไว้ใน token ให้ middleware กันไม่ให้ใช้งานส่วนอื่นก่อนตั้งรหัสใหม่
        mustChangePassword: user.must_change_password,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    // ส่ง token ลง httpOnly cookie แทนใส่ไว้ใน JSON body
    // browser จะเก็บให้เองและแนบมาทุก request ถัดไป frontend ไม่ต้องจับ token เลย
    res.cookie("token", token, TOKEN_COOKIE_OPTIONS);

    res.json({
      message: "เข้าสู่ระบบสำเร็จ",
      // ไม่ส่ง token กลับไปแล้ว — อยู่ใน cookie ที่ JS อ่านไม่ได้
      must_change_password: user.must_change_password,
      // นักศึกษาที่ import มาแล้วยังไม่เคยกรอกโปรไฟล์ (ไม่มี student row) — frontend เด้งไปหน้ากรอกโปรไฟล์
      profile_incomplete: user.role.role_name === "student" && !user.student,
      user: {
        id: user.user_id,
        name: user.first_name,
        role: user.role.role_name,
      },
    });
  } catch (error) {
    // ส่งต่อให้ errorHandler กลาง — มันแยก error ที่เกิดจากข้อมูลที่ส่งมาผิด (เช่น อักขระ NUL ในรหัสผู้ใช้) เป็น 400
    // ได้ แทนที่จะตอบ 500 ทุกกรณี และข้อความ 500 ก็ยังเป็นข้อความกลางเดิม ไม่หลุดรายละเอียดภายใน
    next(error);
  }
};

// POST /api/auth/logout — ออกจากระบบ
// เดิมไม่มี endpoint นี้ เพราะ frontend ลบ token ใน localStorage เองได้
// แต่ httpOnly cookie ฝั่ง JavaScript แตะไม่ได้ ต้องให้ server สั่งลบให้เท่านั้น
// ไม่ต้องผ่าน authenticate — token หมดอายุ/พังแล้วก็ยังต้องกด logout ให้ cookie หลุดได้
export const logout = async (req, res) => {
  res.clearCookie("token", TOKEN_COOKIE_OPTIONS);
  res.json({ success: true, data: { message: "ออกจากระบบแล้ว" } });
};

// PATCH /api/auth/password — เปลี่ยนรหัสผ่านของตัวเอง
// ใช้ทั้งตอนถูกบังคับเปลี่ยนครั้งแรก และตอนอยากเปลี่ยนเองภายหลัง
export const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (
      typeof current_password !== "string" ||
      typeof new_password !== "string" ||
      !current_password ||
      !new_password
    ) {
      return res.status(400).json({
        success: false,
        message: "กรุณากรอกรหัสผ่านเดิมและรหัสผ่านใหม่",
      });
    }

    if (new_password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `รหัสผ่านใหม่ต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
      });
    }

    const user = await prisma.user.findUnique({
      where: { user_id: req.user.userId },
    });
    if (!user || !user.password_hash) {
      return res
        .status(404)
        .json({ success: false, message: "ไม่พบบัญชีผู้ใช้" });
    }

    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) {
      return res
        .status(401)
        .json({ success: false, message: "รหัสผ่านเดิมไม่ถูกต้อง" });
    }

    // กันตั้งรหัสใหม่เป็นตัวเดิม — ไม่งั้นการบังคับเปลี่ยนไม่มีความหมาย
    if (current_password === new_password) {
      return res.status(400).json({
        success: false,
        message: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม",
      });
    }

    await prisma.user.update({
      where: { user_id: user.user_id },
      data: {
        password_hash: await bcrypt.hash(new_password, SALT_ROUNDS),
        must_change_password: false,
      },
    });

    // cookie เดิมใช้ต่อได้เลย — authenticate เช็ค must_change_password จาก DB สดทุก request ไม่ได้ดูค่าใน token
    // frontend ถาม /auth/me แล้วเข้าระบบต่อ ไม่ต้อง login ใหม่
    res.json({
      success: true,
      data: { message: "เปลี่ยนรหัสผ่านสำเร็จ" },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง" });
  }
};

// GET /auth/me — เปิดเว็บ/รีเฟรช: อ่าน userId จาก token → ส่งชื่อ, role, ต้องเปลี่ยนรหัสไหม, โปรไฟล์ครบไหม
export const getme = async (req, res) => {
  try {
    //ดึงข้อมูลจาก jwt
    const user = await prisma.user.findUnique({
      where: { user_id: req.user.userId },
      include: { role: true, student: true },
    });
    //ส่งข้อมูลเป็น json
    res.json({
      success: true,
      data: {
        id: user.user_id,
        name: user.first_name,
        role: user.role.role_name,
        must_change_password: user.must_change_password,
        profile_incomplete: user.role.role_name === "student" && !user.student,
      },
    });
    // ถ้าไม่มี token ก็จะ เเจ้ง error server
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง" });
  }
};
