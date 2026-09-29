import bcrypt from "bcryptjs";
import * as UserRepo from "./users.repository.js";

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

export const getAll = async (req, res, next) => {
  try {
    const users = await UserRepo.findAll();
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
};

// เจ้าหน้าที่สร้างบัญชี officer/executive/reviewer ให้คนอื่น — ไม่มีสมัครเอง 3 บทบาทนี้ (กันปลอมตัว)
const CREATABLE_ROLES = ["officer", "executive", "reviewer"];

export const create = async (req, res, next) => {
  try {
    const {
      psu_passport_id,
      password,
      role_name,
      first_name,
      last_name,
      email,
      phone,
    } = req.body;

    // เจ้าหน้าที่ตั้งรหัสผ่านชั่วคราวให้ตอนสร้างบัญชี — เจ้าตัวต้องเปลี่ยนเองตอน login ครั้งแรก
    // (ไม่มี first-setup แยกแล้ว — ใช้กลไกเดียวกับ must_change_password ที่มีอยู่แล้ว)
    if (
      !psu_passport_id ||
      !password ||
      !role_name ||
      !first_name ||
      !last_name ||
      !email ||
      !phone
    ) {
      const err = new Error("กรุณากรอกข้อมูลให้ครบ");
      err.statusCode = 400;
      throw err;
    }

    // ทุกช่องต้องเป็นข้อความ — ส่งตัวเลข/object มา bcrypt กับ Prisma จะพังเป็น 500
    if ([psu_passport_id, password, first_name, last_name, email, phone].some((v) => typeof v !== "string")) {
      const err = new Error("ข้อมูลที่ส่งมาต้องเป็นข้อความทั้งหมด");
      err.statusCode = 400;
      throw err;
    }

    if (!CREATABLE_ROLES.includes(role_name)) {
      const err = new Error(
        `role_name ต้องเป็นหนึ่งใน: ${CREATABLE_ROLES.join(", ")}`,
      );
      err.statusCode = 400;
      throw err;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      const err = new Error(
        `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
      );
      err.statusCode = 400;
      throw err;
    }

    const existing = await UserRepo.findByPsuId(psu_passport_id);
    if (existing) {
      const err = new Error("รหัสผู้ใช้นี้มีอยู่ในระบบแล้ว");
      err.statusCode = 409;
      throw err;
    }

    const role = await UserRepo.findRoleByName(role_name);
    if (!role) {
      const err = new Error(`ไม่พบ role '${role_name}' ในระบบ`);
      err.statusCode = 400;
      throw err;
    }

    const user = await UserRepo.create({
      role_id: role.role_id,
      psu_passport_id,
      password_hash: await bcrypt.hash(password, SALT_ROUNDS),
      // รหัสที่เจ้าหน้าที่ตั้งให้เป็นแค่รหัสชั่วคราว — บังคับเปลี่ยนตอน login ครั้งแรก (ForceChangePassword)
      must_change_password: true,
      first_name,
      last_name,
      email,
      phone,
    });

    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

const ASSIGNABLE_ROLES = ["student", "officer", "executive", "reviewer"];

export const updateRole = async (req, res, next) => {
  try {
    const { role_name } = req.body;
    const targetId = Number(req.params.id);

    if (!role_name) {
      const err = new Error("ต้องระบุ role_name");
      err.statusCode = 400;
      throw err;
    }
    if (!ASSIGNABLE_ROLES.includes(role_name)) {
      const err = new Error(
        `role_name ต้องเป็นหนึ่งใน: ${ASSIGNABLE_ROLES.join(", ")}`,
      );
      err.statusCode = 400;
      throw err;
    }
    if (!Number.isInteger(targetId)) {
      const err = new Error("user id ไม่ถูกต้อง");
      err.statusCode = 400;
      throw err;
    }
    // กัน officer ลดสิทธิ์ตัวเองจนล็อกตัวเองออกจากระบบ
    if (targetId === req.user.userId) {
      const err = new Error("ไม่สามารถเปลี่ยน role ของตัวเองได้");
      err.statusCode = 400;
      throw err;
    }

    const target = await UserRepo.findById(targetId);
    if (!target) {
      const err = new Error("ไม่พบผู้ใช้");
      err.statusCode = 404;
      throw err;
    }

    const role = await UserRepo.findRoleByName(role_name);
    if (!role) {
      const err = new Error(`ไม่พบ role '${role_name}' ในระบบ`);
      err.statusCode = 400;
      throw err;
    }

    const user = await UserRepo.updateRole(targetId, role.role_id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// ถอนสิทธิ์ผู้ใช้งาน (officer/executive) — ไม่ลบบัญชี แค่ล็อกไม่ให้ login ได้อีก
export const revokeAccess = async (req, res, next) => {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId)) {
      const err = new Error("user id ไม่ถูกต้อง");
      err.statusCode = 400;
      throw err;
    }
    // กัน officer ถอนสิทธิ์ตัวเองจนล็อกตัวเองออกจากระบบ
    if (targetId === req.user.userId) {
      const err = new Error("ไม่สามารถถอนสิทธิ์ของตัวเองได้");
      err.statusCode = 400;
      throw err;
    }

    const target = await UserRepo.findById(targetId);
    if (!target) {
      const err = new Error("ไม่พบผู้ใช้");
      err.statusCode = 404;
      throw err;
    }

    const user = await UserRepo.revokeAccess(targetId);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// เจ้าหน้าที่รีเซ็ตรหัสผ่านให้ผู้ใช้คนหนึ่ง (ลืมรหัส) — ตั้งรหัสชั่วคราวใหม่ให้ทันที
// บังคับเปลี่ยนตอน login ครั้งถัดไป (ไม่มี first-setup แยกแล้ว ใช้กลไกเดียวกับสร้างบัญชีใหม่)
// ต่างจาก "ถอนสิทธิ์" ตรงเจตนา — อันนั้นคือไม่ให้ใช้งานต่อถาวรจนกว่าเจ้าหน้าที่จะเปิดให้ใหม่
export const resetPassword = async (req, res, next) => {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId)) {
      const err = new Error("user id ไม่ถูกต้อง");
      err.statusCode = 400;
      throw err;
    }

    const { new_password } = req.body;
    if (typeof new_password !== "string" || !new_password) {
      const err = new Error("กรุณากรอกรหัสผ่านชั่วคราวให้ผู้ใช้");
      err.statusCode = 400;
      throw err;
    }
    if (new_password.length < MIN_PASSWORD_LENGTH) {
      const err = new Error(
        `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
      );
      err.statusCode = 400;
      throw err;
    }

    const target = await UserRepo.findById(targetId);
    if (!target) {
      const err = new Error("ไม่พบผู้ใช้");
      err.statusCode = 404;
      throw err;
    }

    await UserRepo.setPassword(
      targetId,
      await bcrypt.hash(new_password, SALT_ROUNDS),
    );
    res.json({
      success: true,
      data: {
        message: "ตั้งรหัสผ่านชั่วคราวแล้ว ผู้ใช้ต้องเปลี่ยนรหัสตอน login ครั้งถัดไป",
      },
    });
  } catch (err) {
    next(err);
  }
};

const HISTORY_BLOCKED_MSG =
  "บัญชีนี้มีประวัติการใช้งานผูกอยู่ (เช่น เคยโพสต์ข่าว สร้างรอบสอบ หรือยืนยันผลสอบ) ลบไม่ได้ ให้ใช้ปุ่มถอนสิทธิ์แทน";

// ลบบัญชีจริง (officer/executive/reviewer) — ต่างจาก revokeAccess ตรงที่ลบ record ทิ้งเลย
// ใช้ได้เฉพาะบัญชีที่ไม่เคยมีประวัติผูกไว้ (โพสต์ข่าว/สร้างรอบ/ยืนยันผลสอบ)
export const deleteUser = async (req, res, next) => {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId)) {
      const err = new Error("user id ไม่ถูกต้อง");
      err.statusCode = 400;
      throw err;
    }
    // กัน officer ลบบัญชีตัวเองจนล็อกตัวเองออกจากระบบ
    if (targetId === req.user.userId) {
      const err = new Error("ไม่สามารถลบบัญชีของตัวเองได้");
      err.statusCode = 400;
      throw err;
    }

    const target = await UserRepo.findById(targetId);
    if (!target) {
      const err = new Error("ไม่พบผู้ใช้");
      err.statusCode = 404;
      throw err;
    }

    // เช็คก่อนลบเสมอ — ทุก FK ที่เกี่ยวข้อง (submission_rounds.created_by, news.posted_by,
    // review_logs.reviewer_id) ตั้งเป็น ON DELETE RESTRICT ซึ่ง Postgres ตอบ SQLSTATE 23001
    // ไม่ใช่ 23503 ที่ Prisma แปลงเป็น P2003 ให้ — พึ่ง catch อย่างเดียวจะหลุดเป็น 500 พร้อม raw SQL error
    const linked = await UserRepo.countLinkedHistory(targetId);
    if (linked.total > 0) {
      const err = new Error(HISTORY_BLOCKED_MSG);
      err.statusCode = 409;
      throw err;
    }

    await UserRepo.remove(targetId);
    res.json({ success: true, data: { message: "ลบบัญชีเรียบร้อย" } });
  } catch (err) {
    // fallback เผื่อ race condition (มีคนสร้างประวัติผูกระหว่างเช็คกับตอนลบจริงพอดี) —
    // ครอบทั้ง P2003 ปกติของ Prisma และข้อความ restrict_violation ดิบจาก Postgres (ดูเหตุผลด้านบน)
    const isFkRestrict =
      err.code === "P2003" || /restrict.*foreign key constraint/i.test(err.message ?? "");
    if (isFkRestrict) {
      err.statusCode = 409;
      err.message = HISTORY_BLOCKED_MSG;
    }
    next(err);
  }
};
