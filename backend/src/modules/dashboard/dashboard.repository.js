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

// จำนวนนักศึกษาของรุ่นนั้น แยกตามห้องเรียน — ใช้เป็นตัวหารของตารางแยกห้อง
// นับจากตาราง students ตรงๆ ไม่ใช่นับจากคนที่ส่งผล คนไม่ส่งผลก็ต้องอยู่ในตัวหารด้วย
export const countStudentsByRoom = async (academicYear) => {
  const rows = await prisma.student.groupBy({
    by: ["room_id"],
    where: { academic_year: academicYear },
    _count: { student_id: true },
  });

  const roomIds = rows.map((r) => r.room_id);
  const rooms = await prisma.room.findMany({
    where: { room_id: { in: roomIds } },
    select: { room_id: true, room_name: true },
  });

  const nameOf = new Map(rooms.map((r) => [r.room_id, r.room_name]));
  return rows
    .map((r) => ({
      room_id: r.room_id,
      room_name: nameOf.get(r.room_id) || `ห้อง ${r.room_id}`,
      total: r._count.student_id,
    }))
    .sort((a, b) => a.room_id - b.room_id);
};

// รายวิชาทั้งหมด — เรียงตามรหัสวิชา
export const findAllSubjects = () =>
  prisma.subject.findMany({ orderBy: { subject_code: "asc" } });

// นักศึกษาที่เปิดสิทธิ์กรอกของรุ่นนั้น พร้อมวิชาที่แต่ละคนผ่านไปแล้วจากรอบอื่น
// ใช้หา "รอบนี้ยังมีสิทธิ์กรอกกี่คน" — คนที่ผ่านครบทุกวิชาของรอบแล้วเปิดฟอร์มไม่ได้อีก
// เงื่อนไข "ผ่านแล้ว" ต้องตรงกับ findPassedSubjectIds ใน examResults ทุกข้อ
// ไม่งั้นตัวเลขบน dashboard จะไม่ตรงกับคนที่กรอกฟอร์มได้จริง:
//   - ตัดใบที่ถูกตีกลับออก (ผลในใบนั้นเชื่อไม่ได้)
//   - ไม่จำกัดปีการศึกษา (วิชาที่ผ่านแล้วผ่านเลย ข้ามปีก็ยังผ่าน)
//   - ไม่นับใบของรอบที่กำลังดูอยู่ (excludeRoundId)
export const findEligibleWithPassedSubjects = async (
  academicYear,
  excludeRoundId,
) => {
  const students = await prisma.student.findMany({
    where: { academic_year: academicYear, exam_eligible: true },
    select: { student_id: true },
  });
  if (students.length === 0) return [];

  const rows = await prisma.subjectResult.findMany({
    where: {
      is_passed: true,
      exam_result: {
        student_id: { in: students.map((s) => s.student_id) },
        staff_status: { not: "rejected" },
        round_id: { not: Number(excludeRoundId) },
      },
    },
    select: { subject_id: true, exam_result: { select: { student_id: true } } },
  });

  const passedBy = new Map(); // student_id -> Set(subject_id)
  for (const row of rows) {
    const id = row.exam_result.student_id;
    if (!passedBy.has(id)) passedBy.set(id, new Set());
    passedBy.get(id).add(row.subject_id);
  }

  return students.map((s) => ({
    student_id: s.student_id,
    passed_subject_ids: [...(passedBy.get(s.student_id) ?? [])],
  }));
};

// ผลสอบทั้งหมดในรอบ + ผลรายวิชา (ใช้คำนวณสถิติ)
// ไม่กรอง exam_eligible — ตัวหารของสถิติคือ "นักศึกษาทั้งรุ่นที่ import เข้าระบบ"
// (= ผู้สำเร็จการศึกษาปีนั้น ตามสูตรที่คณะส่งสภาการพยาบาล) ไม่ใช่คนที่เปิดสิทธิ์อยู่ตอนนี้
// ถ้ากรอง คนที่ส่งผลไปแล้วแต่โดนถอนสิทธิ์ทีหลังจะหายจากสถิติ ทั้งที่สอบผ่านจริง
export const findResultsByRound = (roundId) =>
  prisma.examResult.findMany({
    where: { round_id: Number(roundId) },
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
