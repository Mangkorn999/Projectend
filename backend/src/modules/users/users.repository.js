import prisma from "../../config/db.js";

// field ที่ดึงจาก DB — มี password_hash ด้วยเพื่อคำนวณ is_revoked เท่านั้น
// ต้องผ่าน toPublicUser() ก่อนส่งออกเสมอ ห้าม return ตรงๆ เด็ดขาด (จะหลุด hash ออกไป)
const USER_FIELDS_WITH_HASH = {
  user_id: true,
  role_id: true,
  psu_passport_id: true,
  password_hash: true,
  must_change_password: true,
  first_name: true,
  last_name: true,
  email: true,
  phone: true,
  created_at: true,
  role: true,
};

// revokeAccess เคลียร์ password_hash เป็น null ถาวร — ใช้แยก "ถอนสิทธิ์แล้ว" ออกจาก
// "บัญชีใหม่ยังไม่เคย login" (must_change_password เป็น true ได้ทั้งคู่ แยกกันไม่ออกถ้าไม่มี field นี้)
const toPublicUser = (user) => {
  if (!user) return user;
  const { password_hash, ...rest } = user;
  return { ...rest, is_revoked: password_hash === null };
};

//find ALL
export const findAll = async () => {
  const users = await prisma.user.findMany({ select: USER_FIELDS_WITH_HASH });
  return users.map(toPublicUser);
};

//find role by name
export const findRoleByName = (role_name) => {
  return prisma.role.findFirst({ where: { role_name } });
};

export const findByPsuId = (psu_passport_id) => {
  return prisma.user.findUnique({ where: { psu_passport_id } });
};

export const create = async (data) => {
  const user = await prisma.user.create({ data, select: USER_FIELDS_WITH_HASH });
  return toPublicUser(user);
};

//find user by id
export const findById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { user_id: Number(id) },
    select: USER_FIELDS_WITH_HASH,
  });
  return toPublicUser(user);
};

//update role
export const updateRole = async (id, role_id) => {
  const user = await prisma.user.update({
    where: { user_id: Number(id) },
    data: { role_id },
    select: USER_FIELDS_WITH_HASH,
  });
  return toPublicUser(user);
};

// ถอนสิทธิ์ — ไม่ลบ record (กัน FK พังจากประวัติ news/rounds/exam ที่ user นี้เคยสร้าง/ยืนยันไว้)
// เคลียร์ password_hash เป็น null ถาวร — login ไม่ได้อีกจนกว่าเจ้าหน้าที่จะ resetPassword ให้ใหม่ (ไม่ใช่ตั้งเอง ไม่มี first-setup แล้ว)
export const revokeAccess = async (id) => {
  const user = await prisma.user.update({
    where: { user_id: Number(id) },
    data: { password_hash: null, must_change_password: true },
    select: USER_FIELDS_WITH_HASH,
  });
  return toPublicUser(user);
};

// รีเซ็ตรหัสผ่าน — ตั้งรหัสชั่วคราวใหม่ให้ทันที (ต่างจาก revokeAccess ที่ล้างเป็น null ถาวร)
export const setPassword = async (id, password_hash) => {
  const user = await prisma.user.update({
    where: { user_id: Number(id) },
    data: { password_hash, must_change_password: true },
    select: USER_FIELDS_WITH_HASH,
  });
  return toPublicUser(user);
};
