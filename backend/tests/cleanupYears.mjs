// ล้างข้อมูลของปีการศึกษาที่เทสสร้างขึ้น
//
// ทำผ่าน Prisma ไม่ใช่ API เพราะ API กันไว้ตั้งใจ: ลบนักศึกษาที่มีผลสอบแล้วไม่ได้ (กันลบประวัติ)
// และลบรอบที่มีผลสอบผูกอยู่ก็ไม่ได้ เทสจึงล้างของตัวเองผ่าน API ไม่ได้เลย
//
// **ห้ามส่งปีจริงเข้ามา** — ใช้เฉพาะปีสมมติที่เทสตั้งเอง (2590+) ข้อมูลจริงคือ 2560–2575
// ถ้าเทสทิ้งรุ่นไว้ มันจะไปโผล่เป็นปีการศึกษาปลอมบน dashboard แล้วเบียดปีจริงออกจากกราฟย้อนหลัง
import { PrismaClient } from "@prisma/client";

export const cleanupYears = async (years) => {
  const safe = years.filter((y) => y >= 2590);
  if (safe.length !== years.length) {
    throw new Error(`cleanupYears: ปีที่ส่งมามีปีจริงปนอยู่ (${years.join(", ")}) — ใช้ได้เฉพาะ 2590 ขึ้นไป`);
  }

  const prisma = new PrismaClient();
  try {
    const students = await prisma.student.findMany({
      where: { academic_year: { in: safe } },
      select: { student_id: true, user_id: true },
    });
    const sids = students.map((s) => s.student_id);
    const results = await prisma.examResult.findMany({
      where: { OR: [{ student_id: { in: sids } }, { round: { academic_year: { in: safe } } }] },
      select: { result_id: true },
    });
    const rids = results.map((r) => r.result_id);

    await prisma.certificate.deleteMany({ where: { result_id: { in: rids } } });
    await prisma.subjectResult.deleteMany({ where: { result_id: { in: rids } } });
    await prisma.reviewLog.deleteMany({ where: { result_id: { in: rids } } });
    await prisma.examResult.deleteMany({ where: { result_id: { in: rids } } });
    await prisma.notification.deleteMany({ where: { student_id: { in: sids } } });
    await prisma.news.deleteMany({ where: { round: { academic_year: { in: safe } } } });
    await prisma.submissionRound.deleteMany({ where: { academic_year: { in: safe } } });
    await prisma.student.deleteMany({ where: { student_id: { in: sids } } });
    await prisma.user.deleteMany({ where: { user_id: { in: students.map((s) => s.user_id) } } });
  } finally {
    await prisma.$disconnect();
  }
};
