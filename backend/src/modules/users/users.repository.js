import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

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
