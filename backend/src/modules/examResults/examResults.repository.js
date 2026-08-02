import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ค่าที่ใช้ในคอลัมน์สถานะ (ใช้ให้ตรงกันทั้งระบบ)
export const STUDENT_STATUS = { DRAFT: "draft", SUBMITTED: "submitted" };
export const STAFF_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const withDetails = {
  round: true,
  subject_results: { include: { subject: true } },
  certificates: true,
};

// ดึงเฉพาะ field ที่ต้องใช้แสดงผล ไม่เอาทั้ง record มาทั้งก้อน
const studentSafeSelect = {
  select: {
    student_id: true,
    academic_year: true,
    exam_eligible: true,
    room: true,
    user: {
      select: { user_id: true, first_name: true, last_name: true, email: true },
    },
  },
};

// หาผลสอบของนักศึกษาในรอบนั้น — ใช้กันกรอกซ้ำรอบเดิม
export const findByStudentAndRound = (student_id, round_id) =>
  prisma.examResult.findFirst({
    where: { student_id, round_id: Number(round_id) },
  });

// วิชาที่นักศึกษาคนนี้เคยสอบผ่านมาแล้ว (จากทุกรอบที่เคยกรอก) — ไม่ต้องกรอกซ้ำอีก
// ไม่ต้องกรองปี เพราะนักศึกษา 1 คนอยู่รุ่นเดียว รอบที่เคยกรอกคือรอบของรุ่นตัวเองอยู่แล้ว
export const findPassedSubjectIds = async (student_id) => {
  const rows = await prisma.subjectResult.findMany({
    where: { is_passed: true, exam_result: { student_id } },
    select: { subject_id: true },
  });
  // วิชาเดียวกันอาจผ่านซ้ำได้หลายรอบ (copy-forward) ตัดซ้ำออกก่อนคืน
  return [...new Set(rows.map((r) => r.subject_id))];
};

// ฝั่งเจ้าหน้าที่ — ดูผลสอบทุกคน กรองได้ตามรอบ/สถานะ/นักศึกษา
export const findAll = ({ round_id, staff_status, student_id } = {}) => {
  const where = {};
  if (round_id) where.round_id = Number(round_id);
  if (staff_status) where.staff_status = staff_status;
  if (student_id) where.student_id = student_id;

  return prisma.examResult.findMany({
    where,
    include: { ...withDetails, student: studentSafeSelect },
    orderBy: { submitted_at: "desc" },
  });
};

// เจ้าหน้าที่ยืนยัน/ตีกลับ — บันทึกคนกดและเวลาไว้ด้วย
export const updateStaffStatus = (result_id, { staff_status, remark, confirmed_by }) =>
  prisma.examResult.update({
    where: { result_id: Number(result_id) },
    data: {
      staff_status,
      remark: remark ?? null,
      confirmed_by,
      confirmed_at: new Date(),
    },
    include: { ...withDetails, student: studentSafeSelect },
  });

export const findByStudent = (student_id) =>
  prisma.examResult.findMany({
    where: { student_id },
    include: withDetails,
    orderBy: { submitted_at: "desc" },
  });

export const findById = (result_id) =>
  prisma.examResult.findUnique({
    where: { result_id: Number(result_id) },
    include: withDetails,
  });

// สร้าง exam_result + subject_results พร้อมกันใน transaction เดียว
// (nested create ของ Prisma เป็น transaction ให้อยู่แล้ว)
export const createWithSubjects = (
  { student_id, round_id, student_status, staff_status },
  subjectResults,
) =>
  prisma.examResult.create({
    data: {
      student_id,
      round_id: Number(round_id),
      student_status,
      staff_status,
      subject_results: {
        create: subjectResults.map((s) => ({
          subject_id: Number(s.subject_id),
          is_passed: Boolean(s.is_passed),
        })),
      },
    },
    include: withDetails,
  });
