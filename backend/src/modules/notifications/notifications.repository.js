import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const create = ({ student_id, type, message }) =>
  prisma.notification.create({ data: { student_id, type, message } });

// รองรับยิงให้หลายคนพร้อมกัน (เช่น เปิดสิทธิ์กรอกทีละรุ่น)
export const createMany = (student_ids, { type, message }) =>
  prisma.notification.createMany({
    data: student_ids.map((student_id) => ({ student_id, type, message })),
  });

// กันไว้อีกชั้นก่อนยิง Prisma
// ถ้า student_id เป็น undefined Prisma จะ "ไม่กรองเลย" ไม่ใช่ "หาไม่เจอ"
// → findMany คืนของทุกคน, updateMany แก้ของทุกคน. ตัดจบตรงนี้เลยปลอดภัยกว่า
const requireStudentId = (student_id) => {
  if (!student_id) {
    const err = new Error("ต้องเป็นนักศึกษาเท่านั้น");
    err.statusCode = 403;
    throw err;
  }
  return student_id;
};

export const findByStudent = (student_id) =>
  prisma.notification.findMany({
    where: { student_id: requireStudentId(student_id) },
    orderBy: { created_at: "desc" },
    take: 50,
  });

export const markRead = (notification_id, student_id) =>
  // where กันด้วย student_id เสมอ — ไม่ให้ mark ของคนอื่นได้แม้เดา id ถูก
  prisma.notification.updateMany({
    where: {
      notification_id: Number(notification_id),
      student_id: requireStudentId(student_id),
    },
    data: { is_read: true },
  });

export const markAllRead = (student_id) =>
  prisma.notification.updateMany({
    where: { student_id: requireStudentId(student_id), is_read: false },
    data: { is_read: true },
  });
