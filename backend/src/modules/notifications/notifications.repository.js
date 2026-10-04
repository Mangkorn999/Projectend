import prisma from "../../config/db.js";

export const create = ({ student_id, type, message, round_id = null }) =>
  prisma.notification.create({ data: { student_id, type, message, round_id } });

// เคยแจ้ง "รอบนี้เปิดแล้ว" ให้คนนี้ไปหรือยัง — กันสร้างซ้ำทุกครั้งที่ poll กระดิ่ง (ทุก 30 วิ)
export const hasRoundOpenNotice = (student_id, round_id) =>
  prisma.notification.findFirst({
    where: { student_id, round_id, type: "round_open" },
    select: { notification_id: true },
  });

// แจ้งเตือน "รอบนี้เปิดแล้ว" ของคนนี้ทุกแถว เรียง id น้อย → มาก (แถวแรก = แถวที่สร้างก่อน)
// ใช้หาแถวซ้ำที่เกิดจากเปิดหลายแท็บพร้อมกัน (ดู notifications.controller.js → removeDuplicateRoundOpen)
export const findRoundOpenNoticeIds = async (student_id, round_id) => {
  const rows = await prisma.notification.findMany({
    where: { student_id, round_id, type: "round_open" },
    select: { notification_id: true },
    orderBy: { notification_id: "asc" },
  });
  const ids = [];
  for (const row of rows) {
    ids.push(row.notification_id);
  }
  return ids;
};

// ลบแจ้งเตือนตามรายการ id — deleteMany: ถ้าแถวถูกลบไปแล้ว (อีกแท็บลบก่อน) ไม่ error แค่ได้ count = 0
// ⚠️ ids ต้องเป็น array ที่มีของเสมอ — ผู้เรียกเช็คแล้ว (ดู SYNTAX_NOTES 5.28 เรื่อง { in: undefined })
export const removeByIds = (ids) =>
  prisma.notification.deleteMany({ where: { notification_id: { in: ids } } });

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
