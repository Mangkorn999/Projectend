import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// หารอบล่าสุด (ใช้ตอนไม่ได้ส่ง round_id มา)
export const findLatestRound = () =>
  prisma.submissionRound.findFirst({
    orderBy: [{ academic_year: "desc" }, { attempt_number: "desc" }],
  });

// หารอบตาม id
export const findRoundById = (id) =>
  prisma.submissionRound.findUnique({ where: { round_id: Number(id) } });

// นับนักศึกษาของรุ่นนั้น (กรองด้วย academic_year ของรอบ)
export const countStudentsByYear = (academicYear) =>
  prisma.student.count({ where: { academic_year: academicYear } });

// รายวิชาทั้งหมด — เรียงตามรหัสวิชา
export const findAllSubjects = () =>
  prisma.subject.findMany({ orderBy: { subject_code: "asc" } });

// ผลสอบทั้งหมดในรอบ + ผลรายวิชา (ใช้คำนวณสถิติ)
export const findResultsByRound = (roundId) =>
  prisma.examResult.findMany({
    where: { round_id: Number(roundId) },
    include: {
      subject_results: true,
      student: {
        select: {
          student_id: true,
          academic_year: true,
          user: { select: { first_name: true, last_name: true } },
        },
      },
    },
    orderBy: { student_id: "asc" },
  });
