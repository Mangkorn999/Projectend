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

// เช็คก่อนลบว่าบัญชีนี้มีประวัติผูกอยู่ไหม (สร้างรอบ/โพสต์ข่าว/ตรวจสอบผลสอบ)
// ไม่นับ exam_results.confirmed_by เพราะ FK นั้นตั้งเป็น ON DELETE SET NULL ลบได้โดยไม่พัง
// ต้องเช็คเองก่อน ห้ามปล่อยให้ DB error บอกแทน: ทุก FK ในระบบนี้ประกาศเป็น ON DELETE RESTRICT
// ซึ่ง Postgres ตอบกลับเป็น SQLSTATE 23001 (restrict_violation) ไม่ใช่ 23503 — Prisma ไม่แปลงเป็น P2003
// ให้ (โยนเป็น PrismaClientUnknownRequestError แทน) ถ้าพึ่ง catch P2003 อย่างเดียวจะหลุดเป็น 500 พร้อม raw SQL error
export const countLinkedHistory = async (id) => {
  const userId = Number(id);
  const [rounds, news, reviewLogs] = await Promise.all([
    prisma.submissionRound.count({ where: { created_by: userId } }),
    prisma.news.count({ where: { posted_by: userId } }),
    prisma.reviewLog.count({ where: { reviewer_id: userId } }),
  ]);
  return { rounds, news, reviewLogs, total: rounds + news + reviewLogs };
};

// ลบบัญชีจริง (ต่างจาก revokeAccess ที่แค่ล็อก)
// เรียกได้ก็ต่อเมื่อ countLinkedHistory คืน total = 0 แล้วเท่านั้น (เช็คที่ controller)
export const remove = (id) => {
  return prisma.user.delete({ where: { user_id: Number(id) } });
};
