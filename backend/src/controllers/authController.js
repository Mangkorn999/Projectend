import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// จำนวนรอบ hash — ยิ่งสูงยิ่งช้าและยิ่งเดายาก 10 คือค่ามาตรฐาน
const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

// ตั้งรหัสผ่านครั้งแรก — เฉพาะ user ที่เจ้าหน้าที่ import มาแล้วยังไม่เคยตั้งรหัส
// ยืนยันตัวตนด้วย student_id + ชื่อ + นามสกุล ต้องตรงกับข้อมูล import เป๊ะ (กัน typo สุ่ม)
// ไม่มี self-service reset — ถ้าเคยตั้งแล้วต้องให้เจ้าหน้าที่ reset ให้ (ดู students.controller resetPassword)
export const firstSetup = async (req, res) => {
  try {
    const { student_id, first_name, last_name, password } = req.body;

    if (!student_id || !first_name || !last_name || !password) {
      return res
        .status(400)
        .json({ success: false, message: "กรุณากรอกข้อมูลให้ครบ" });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
      });
    }

    // หา user จาก student_id ที่กรอกมา (student_id ในระบบเราคือ psu_passport_id ของนักศึกษา)
    // ต้อง include student+role มาด้วยเพื่อเช็คว่าเป็นบัญชีนักศึกษาที่ import มาจริง ไม่ใช่ officer/executive
    const user = await prisma.user.findUnique({
      where: { psu_passport_id: student_id },
      include: { student: true, role: true },
    });

    // ไม่บอกว่าผิดที่จุดไหน (id/ชื่อ/นามสกุล) — กันคนไล่เดาทีละฟิลด์ทีละครั้งจนรู้ว่าฟิลด์ไหนถูก
    const invalid = () =>
      res.status(400).json({
        success: false,
        message: "ข้อมูลไม่ตรงกับที่มีในระบบ กรุณาตรวจสอบรหัสนักศึกษาและชื่อ-นามสกุล",
      });

    // ไม่มี user นี้ / ไม่มี student profile (แปลว่าไม่ใช่บัญชีที่ import มา) / ไม่ใช่ role student
    // → ปฏิเสธเหมือนกันหมด ไม่แยก error กันคนรู้ว่า id นี้มีอยู่ในระบบไหม
    if (!user || !user.student || user.role.role_name !== "student") {
      return invalid();
    }
    // เช็คชื่อ-นามสกุลต้องตรงกับที่เจ้าหน้าที่ import ไว้เป๊ะ — นี่คือ "รหัสผ่านชั้นที่สอง"
    // ปิดช่องโหว่เดา student_id เปล่าๆ (id เรียงเลขรุ่น เดาง่าย แต่ชื่อ-สกุลคู่กันเดายากกว่า)
    if (
      user.first_name.trim() !== first_name.trim() ||
      user.last_name.trim() !== last_name.trim()
    ) {
      return invalid();
    }

    // เคยตั้ง password ไปแล้ว (มาหน้านี้ซ้ำ) → ไม่ใช่ recovery flow ตามที่ตกลงกันไว้
    // ให้ไป login ปกติ หรือถ้าลืมรหัส/สงสัยโดนสวมสิทธิ์ ให้เจ้าหน้าที่กด reset ให้ (resetPassword ใน students module)
    if (user.password_hash) {
      return res.status(409).json({
        success: false,
        message: "บัญชีนี้ตั้งรหัสผ่านแล้ว กรุณา login หรือติดต่อเจ้าหน้าที่คณะ",
      });
    }

    // ผ่านทุกด่านแล้ว → hash รหัสผ่านที่นักศึกษาตั้งเอง และปลด must_change_password
    // (ตอน import ตั้ง must_change_password ไว้ true แต่ที่นี่ตั้งรหัสเองครั้งแรกแล้ว ไม่ต้องบังคับเปลี่ยนซ้ำ)
    await prisma.user.update({
      where: { user_id: user.user_id },
      data: {
        password_hash: await bcrypt.hash(password, SALT_ROUNDS),
        must_change_password: false,
      },
    });

    res.status(201).json({
      success: true,
      data: { message: "ตั้งรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบ" },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "server error" });
  }
};

// login ด้วย psu_passport_id + password ในระบบเอง
// (เดิมใช้ PSU One Passport แต่ขอ credential ไม่ได้ เลยทำ auth เอง)
export const login = async (req, res) => {
  try {
    const { psu_passport_id, password } = req.body;

    if (!psu_passport_id || !password) {
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

    res.json({
      message: "เข้าสู่ระบบสำเร็จ",
      token,
      must_change_password: user.must_change_password,
      user: {
        id: user.user_id,
        name: user.first_name,
        role: user.role.role_name,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "server error" });
  }
};

// PATCH /api/auth/password — เปลี่ยนรหัสผ่านของตัวเอง
// ใช้ทั้งตอนถูกบังคับเปลี่ยนครั้งแรก และตอนอยากเปลี่ยนเองภายหลัง
export const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
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

    // token เดิมยังมี mustChangePassword: true อยู่ ต้อง login ใหม่เพื่อเอา token ใหม่
    res.json({
      success: true,
      data: { message: "เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่" },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "server error" });
  }
};

export const getme = async (req, res) => {
  try {
    //ดึงข้อมูลจาก jwt
    const user = await prisma.user.findUnique({
      where: { user_id: req.user.userId },
      include: { role: true },
    });
    //ส่งข้อมูลเป็น json
    res.json({
      success: true,
      data: {
        id: user.user_id,
        name: user.first_name,
        role: user.role.role_name,
        must_change_password: user.must_change_password,
      },
    });
    // ถ้าไม่มี token ก็จะ เเจ้ง error server
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "server error" });
  }
};
