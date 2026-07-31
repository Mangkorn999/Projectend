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

export const findRoleByName = (role_name) =>
  prisma.role.findFirst({ where: { role_name } });

export const findFaculty = () => prisma.faculty.findFirst();

export const findAllRooms = () => prisma.room.findMany();

export const findRoomById = (room_id) =>
  prisma.room.findUnique({ where: { room_id } });

export const findByPsuId = (psu_passport_id) =>
  prisma.user.findUnique({ where: { psu_passport_id } });

// สร้าง user(ไม่มี password)+student คู่กันใน transaction เดียว — import แถวนี้ล้มทั้งคู่ถ้าพลาด
export const createImported = ({
  role_id,
  psu_passport_id,
  first_name,
  last_name,
  email,
  phone,
  faculty_id,
  room_id,
  academic_year,
}) =>
  prisma.user.create({
    data: {
      role_id,
      psu_passport_id,
      password_hash: null,
      must_change_password: true,
      first_name,
      last_name,
      email,
      phone,
      student: {
        create: {
          student_id: psu_passport_id,
          faculty_id,
          room_id,
          academic_year,
        },
      },
    },
    select: { ...PUBLIC_USER_FIELDS, student: true },
  });

// เจ้าหน้าที่ reset บัญชีนักศึกษากลับเป็นยังไม่ตั้งรหัส — ใช้แก้ impersonation/ลืมรหัส
export const resetPassword = (studentId) =>
  prisma.user.update({
    where: { psu_passport_id: studentId },
    data: { password_hash: null, must_change_password: true },
  });
