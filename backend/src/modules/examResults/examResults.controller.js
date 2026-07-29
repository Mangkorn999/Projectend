import * as examRepo from "./examResults.repository.js";
import { STUDENT_STATUS, STAFF_STATUS } from "./examResults.repository.js";
import * as roundsRepo from "../rounds/rounds.repository.js";
import * as studentRepo from "../students/student.repository.js";

const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// นักศึกษากรอกผลสอบ — เข้ารอบที่เปิดอยู่เท่านั้น และกรอกได้รอบละครั้ง
export const create = async (req, res, next) => {
  try {
    const { subject_results } = req.body;
    if (!Array.isArray(subject_results) || subject_results.length === 0) {
      throw httpError("ต้องส่งผลสอบรายวิชามาอย่างน้อย 1 วิชา", 400);
    }

    const student = await studentRepo.findById(req.user.studentId);
    if (!student) throw httpError("ไม่พบข้อมูลนักศึกษา", 404);
    if (!student.exam_eligible) {
      throw httpError(
        "ยังไม่ได้รับสิทธิ์กรอกผลสอบ กรุณาติดต่อเจ้าหน้าที่คณะ",
        403,
      );
    }

    const round = await roundsRepo.findActive();
    if (!round) throw httpError("ขณะนี้ไม่มีรอบกรอกผลสอบที่เปิดอยู่", 400);

    const existing = await examRepo.findByStudentAndRound(
      student.student_id,
      round.round_id,
    );
    if (existing) throw httpError("กรอกผลสอบรอบนี้ไปแล้ว", 409);

    const result = await examRepo.createWithSubjects(
      {
        student_id: student.student_id,
        round_id: round.round_id,
        student_status: STUDENT_STATUS.SUBMITTED,
        staff_status: STAFF_STATUS.PENDING,
      },
      subject_results,
    );

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// ประวัติผลสอบของตัวเอง
export const getMine = async (req, res, next) => {
  try {
    const results = await examRepo.findByStudent(req.user.studentId);
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
};

// ─── ฝั่งเจ้าหน้าที่ / ผู้บริหาร ───────────────────────

// ดูผลสอบทุกคน — filter ผ่าน query: ?round_id=&staff_status=&student_id=
export const getAll = async (req, res, next) => {
  try {
    const { round_id, staff_status, student_id } = req.query;
    const results = await examRepo.findAll({ round_id, staff_status, student_id });
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
};

// ยืนยัน/ตีกลับ ใช้ตัวเดียวกัน ต่างกันแค่สถานะและ remark
const reviewExamResult = async (req, res, next, { staff_status, requireRemark }) => {
  try {
    const existing = await examRepo.findById(req.params.id);
    if (!existing) throw httpError("ไม่พบผลสอบที่ระบุ", 404);

    const remark = req.body?.remark?.trim();
    if (requireRemark && !remark) {
      throw httpError("ต้องระบุเหตุผลที่ตีกลับ (remark)", 400);
    }

    const result = await examRepo.updateStaffStatus(req.params.id, {
      staff_status,
      remark: requireRemark ? remark : (remark ?? null),
      confirmed_by: req.user.userId, // อ่านจาก JWT เท่านั้น
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const approve = (req, res, next) =>
  reviewExamResult(req, res, next, {
    staff_status: STAFF_STATUS.APPROVED,
    requireRemark: false,
  });

export const reject = (req, res, next) =>
  reviewExamResult(req, res, next, {
    staff_status: STAFF_STATUS.REJECTED,
    requireRemark: true,
  });
