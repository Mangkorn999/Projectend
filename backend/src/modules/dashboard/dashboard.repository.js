import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const NEWEST_FIRST = [{ academic_year: "desc" }, { attempt_number: "desc" }];

// รอบที่ควรโชว์เมื่อเจ้าหน้าที่เปิด dashboard โดยไม่ได้เลือกรอบเอง
// เอารอบที่เปิดรับอยู่ก่อน — เจ้าหน้าที่เข้ามาดูเพราะอยากรู้ว่ารอบนี้กรอกกันถึงไหนแล้ว
// ถ้าไม่มีรอบเปิด ค่อยถอยไปรอบล่าสุด
// ?? อ่านว่า "ถ้าฝั่งซ้ายเป็น null/undefined ให้ใช้ฝั่งขวาแทน"
// = หารอบที่เปิดอยู่ก่อน ไม่เจอค่อยเอารอบล่าสุด
export const findDefaultRound = async () =>
  (await prisma.submissionRound.findFirst({
    where: { status: "open" },
    orderBy: NEWEST_FIRST,
  })) ??
  (await prisma.submissionRound.findFirst({ orderBy: NEWEST_FIRST }));

// ทุกรอบของปีการศึกษาที่ระบุ — ใช้ทำหน้าเลือกรอบและสรุปทั้งปี
export const findRoundsByYears = (years) =>
  prisma.submissionRound.findMany({
    where: { academic_year: { in: years } },
    orderBy: NEWEST_FIRST,
  });

// ปีการศึกษาที่มีรอบอยู่จริง เรียงใหม่ไปเก่า — ใช้เลือกว่าจะย้อนหลังกี่ปี
export const findAcademicYears = async () => {
  const rows = await prisma.submissionRound.findMany({
    distinct: ["academic_year"],
    select: { academic_year: true },
    orderBy: { academic_year: "desc" },
  });
  return rows.map((r) => r.academic_year);
};

// หารอบตาม id
export const findRoundById = (id) =>
  prisma.submissionRound.findUnique({ where: { round_id: Number(id) } });

// นับนักศึกษาของรุ่นนั้น (กรองด้วย academic_year ของรอบ)
export const countStudentsByYear = (academicYear) =>
  prisma.student.count({ where: { academic_year: academicYear } });

// นับเฉพาะคนที่เจ้าหน้าที่เปิดสิทธิ์ให้กรอกแล้ว — คนที่ยังไม่เปิดสิทธิ์กรอกไม่ได้
// เอาไปเป็นตัวหารของ fillRate ไม่งั้น % จะต่ำเพราะคนที่ระบบยังไม่ให้กรอก
export const countEligibleByYear = (academicYear) =>
  prisma.student.count({
    where: { academic_year: academicYear, exam_eligible: true },
  });

// รายวิชาทั้งหมด — เรียงตามรหัสวิชา
export const findAllSubjects = () =>
  prisma.subject.findMany({ orderBy: { subject_code: "asc" } });

// ผลสอบทั้งหมดในรอบ + ผลรายวิชา (ใช้คำนวณสถิติ)
// เอาเฉพาะนักศึกษาที่ยังมีสิทธิ์กรอก เพราะตัวหารทุกตัวใน dashboard คือ eligible
// ถ้าไม่กรอง คนที่ส่งแล้วโดนปิดสิทธิ์ทีหลังจะทำให้ผลรวมเกิน eligible
// แล้ว Math.max(...) ใน not_started จะตัดเป็น 0 วงกับตัวเลขตรงกลางเลยไม่ตรงกัน
export const findResultsByRound = (roundId) =>
  prisma.examResult.findMany({
    where: {
      round_id: Number(roundId),
      student: { exam_eligible: true },
    },
    include: {
      subject_results: true,
      student: {
        select: {
          student_id: true,
          academic_year: true,
          room: { select: { room_id: true, room_name: true } },
          user: { select: { first_name: true, last_name: true } },
        },
      },
    },
    orderBy: { student_id: "asc" },
  });
