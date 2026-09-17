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

// รีเซ็ตรหัสผ่านนักศึกษา = ตั้ง hash ใหม่ตรงๆ ไม่ล้างเป็น null และไม่บังคับเปลี่ยน (password นักศึกษา = เลขบัตร ปชช เสมอ)
export const setPassword = (studentId, password_hash) =>
  prisma.user.update({
    where: { psu_passport_id: studentId },
    data: { password_hash },
  });

// สร้างแค่ user จากการ import — รหัสผ่าน = hash(เลขบัตร ปชช) ที่เจ้าหน้าที่กรอกมาตอน import
// ยังไม่สร้าง student row — นักศึกษา login ครั้งแรกแล้วกรอกโปรไฟล์เองผ่าน completeProfile ถึงจะสร้างให้
export const createFromImport = ({ role_id, psu_passport_id, password_hash }) =>
  prisma.user.create({
    data: {
      role_id,
      psu_passport_id,
      password_hash,
      must_change_password: false, // ไม่มี flow ให้ตั้งรหัสใหม่ — เลขบัตร ปชช คือรหัสผ่านถาวร
    },
    select: { user_id: true, psu_passport_id: true },
  });

// นักศึกษากรอกโปรไฟล์ครั้งแรก — update user (ชื่อ/email/เบอร์) + สร้าง student row พร้อมกัน
export const completeProfile = ({
  user_id,
  student_id,
  first_name,
  last_name,
  first_name_en,
  last_name_en,
  email,
  phone,
  faculty_id,
  room_id,
  academic_year,
}) =>
  prisma.user.update({
    where: { user_id },
    data: {
      first_name,
      last_name,
      email,
      phone,
      student: {
        create: {
          student_id,
          faculty_id,
          room_id,
          academic_year,
          first_name_en,
          last_name_en,
        },
      },
    },
    select: { ...PUBLIC_USER_FIELDS, student: true },
  });

// เจ้าหน้าที่แก้ข้อมูลนักศึกษาทีหลัง — แก้ได้ทั้งฝั่ง user (ชื่อ/email/เบอร์) และฝั่ง student (ห้อง/ปีจบ/ชื่ออังกฤษ)
// รับเฉพาะ field ที่ส่งมา (partial update) ผ่าน nested write ในคำสั่งเดียว
export const updateProfile = (student_id, { user: userData, student: studentData }) =>
  prisma.student.update({
    where: { student_id },
    data: {
      ...studentData,
      ...(userData && Object.keys(userData).length > 0
        ? { user: { update: userData } }
        : {}),
    },
    include: { user: { select: PUBLIC_USER_FIELDS } },
  });

// เจ้าหน้าที่ reset บัญชีนักศึกษากลับเป็นยังไม่ตั้งรหัส — ใช้แก้ impersonation/ลืมรหัส
// มีใบผลสอบของนักศึกษาคนนี้อยู่กี่ใบ — ใช้กันลบคนที่มีประวัติสอบไปแล้ว
export const countExamResults = (studentId) =>
  prisma.examResult.count({ where: { student_id: studentId } });

// ลบนักศึกษา + บัญชี user ของเขา (เรียกได้เฉพาะตอนไม่มีผลสอบเท่านั้น)
// ลบแจ้งเตือนก่อนเพราะ FK ชี้มาที่ student ถ้าไม่ลบ Prisma จะไม่ยอมลบแถวแม่
// ใช้ transaction ให้ 3 คำสั่งสำเร็จหรือล้มไปพร้อมกัน จะได้ไม่เหลือ user ค้างที่ไม่มี student
export const removeWithUser = (studentId, userId) =>
  prisma.$transaction([
    prisma.notification.deleteMany({ where: { student_id: studentId } }),
    prisma.student.delete({ where: { student_id: studentId } }),
    prisma.user.delete({ where: { user_id: userId } }),
  ]);
