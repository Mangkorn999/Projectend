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

// เจ้าหน้าที่สร้างบัญชี officer/executive ให้คนอื่น — ไม่มีสมัครเองสองบทบาทนี้ (กันปลอมตัว)
const CREATABLE_ROLES = ["officer", "executive"];

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
      // เจ้าหน้าที่เป็นคนตั้งรหัสให้ — บังคับเปลี่ยนตอน login ครั้งแรก
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

const ASSIGNABLE_ROLES = ["student", "officer", "executive"];

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
