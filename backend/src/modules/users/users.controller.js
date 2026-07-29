import * as UserRepo from "./users.repository.js";

export const getAll = async (req, res, next) => {
  try {
    const users = await UserRepo.findAll();
    res.json({ success: true, data: users });
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
