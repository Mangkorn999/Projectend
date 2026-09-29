import prisma from "../../config/db.js";

// field ที่ส่งออกให้ client ได้ — ห้ามมี password_hash เด็ดขาด
// ใช้ select แทน include เพื่อให้ column ใหม่ที่เพิ่มทีหลังไม่หลุดออกไปเอง
const PUBLIC_USER_FIELDS = {
  user_id: true,
  role_id: true,
  psu_passport_id: true,
  must_change_password: true,
  first_name: true,
  last_name: true,
  email: true,
  phone: true,
  created_at: true,
  role: true,
};

//find ALL
export const findAll = () => {
  return prisma.user.findMany({ select: PUBLIC_USER_FIELDS });
};

//find role by name
export const findRoleByName = (role_name) => {
  return prisma.role.findFirst({ where: { role_name } });
};

export const findByPsuId = (psu_passport_id) => {
  return prisma.user.findUnique({ where: { psu_passport_id } });
};

export const create = (data) => {
  return prisma.user.create({ data, select: PUBLIC_USER_FIELDS });
};

//find user by id
export const findById = (id) => {
  return prisma.user.findUnique({
    where: { user_id: Number(id) },
    select: PUBLIC_USER_FIELDS,
  });
};

//update role
export const updateRole = (id, role_id) => {
  return prisma.user.update({
    where: { user_id: Number(id) },
    data: { role_id },
    select: PUBLIC_USER_FIELDS,
  });
};

// ถอนสิทธิ์ — ไม่ลบ record (กัน FK พังจากประวัติ news/rounds/exam ที่ user นี้เคยสร้าง/ยืนยันไว้)
// เคลียร์ password_hash เป็น null ถาวร — login ไม่ได้อีกจนกว่าเจ้าหน้าที่จะ resetPassword ให้ใหม่ (ไม่ใช่ตั้งเอง ไม่มี first-setup แล้ว)
export const revokeAccess = (id) => {
  return prisma.user.update({
    where: { user_id: Number(id) },
    data: { password_hash: null, must_change_password: true },
    select: PUBLIC_USER_FIELDS,
  });
};

// รีเซ็ตรหัสผ่าน — ตั้งรหัสชั่วคราวใหม่ให้ทันที (ต่างจาก revokeAccess ที่ล้างเป็น null ถาวร)
export const setPassword = (id, password_hash) => {
  return prisma.user.update({
    where: { user_id: Number(id) },
    data: { password_hash, must_change_password: true },
    select: PUBLIC_USER_FIELDS,
  });
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
