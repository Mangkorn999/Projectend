import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ข้อมูล user ที่ส่งออกได้ — ห้ามมี password_hash เด็ดขาด
const PUBLIC_USER_FIELDS = {
  user_id: true,
  psu_passport_id: true,
  first_name: true,
  last_name: true,
  email: true,
  phone: true,
};

export const findAll = () => {
  return prisma.student.findMany({
    include: { user: { select: PUBLIC_USER_FIELDS }, faculty: true, room: true },
  });
};
export const findById = (id) =>
  prisma.student.findUnique({
    where: { student_id: id },
    include: { user: { select: PUBLIC_USER_FIELDS }, faculty: true, room: true },
  });

export const bulkSetEligible = (studentIds, value) =>
  prisma.student.updateMany({
    where: { student_id: { in: studentIds } },
    data: { exam_eligible: value },
  });
