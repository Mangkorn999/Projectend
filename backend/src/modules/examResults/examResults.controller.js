import * as examRepo from "./examResults.repository.js";
import { STUDENT_STATUS, STAFF_STATUS } from "./examResults.repository.js";
import * as roundsRepo from "../rounds/rounds.repository.js";
import * as studentRepo from "../students/student.repository.js";
import * as subjectsRepo from "../subjects/subjects.repository.js";
import { subjectsOfRound } from "../../utils/roundSubjects.js";
import * as notifRepo from "../notifications/notifications.repository.js";

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

    // หารอบจากรุ่นของนักศึกษาเลย ไม่ใช่หารอบเปิดอันไหนก็ได้แล้วค่อยเช็คปีทีหลัง
    // แบบนี้กรอกข้ามรุ่นไม่ได้ตั้งแต่ต้น ไม่ต้องมีเงื่อนไขกันเพิ่ม
    const round = await roundsRepo.findActive(student.academic_year);
    if (!round) throw httpError("ขณะนี้ไม่มีรอบกรอกผลสอบที่เปิดอยู่", 400);

    const existing = await examRepo.findByStudentAndRound(
      student.student_id,
      round.round_id,
    );
    // ใบที่ถูกตีกลับให้ส่งทับได้ — การตีกลับมีไว้ให้แก้แล้วส่งใหม่ ถ้าปิดไว้นักศึกษาจะค้างอยู่ตรงนั้น
    const isRedo = existing?.staff_status === STAFF_STATUS.REJECTED;
    if (existing && !isRedo) throw httpError("กรอกผลสอบรอบนี้ไปแล้ว", 409);

    // ปลดล็อกแก้ผ่าน/ไม่ผ่านได้เฉพาะตีกลับด้วยเหตุผลนี้เท่านั้น (ไฟล์แนบไม่ตรงกับผลที่กรอกไว้จริง)
    // เหตุผลตีกลับอื่นๆ (เช่น กรอกผลสอบผิดวิชา) ยังล็อกวิชาที่ approved จากรอบอื่นตามเดิม
    const REDO_UNLOCK_REMARK = "ผลสอบไม่ตรงกับไฟล์แนบ";
    const isMismatchRedo = isRedo && existing.remark === REDO_UNLOCK_REMARK;

    const allSubjects = await subjectsRepo.findAll();
    const roundSubjectIds = subjectsOfRound(round, allSubjects).map(
      (s) => s.subject_id,
    );
    const passedIds = await examRepo.findPassedSubjectIds(student.student_id);
    const lockedIds = isMismatchRedo ? [] : passedIds;
    // วิชาที่ยังต้องตอบจริงในรอบนี้ = วิชาของรอบ ลบวิชาที่ล็อกไว้แล้ว
    const mustAnswer = roundSubjectIds.filter((id) => !lockedIds.includes(id));

    // ตรวจของที่ส่งมาทีละรายการก่อน ไม่ปล่อยให้ค่าแปลกๆ ไหลลง DB
    const answers = new Map();
    for (const item of subject_results) {
      const subjectId = Number(item?.subject_id);
      if (!roundSubjectIds.includes(subjectId)) {
        throw httpError("มีวิชาที่ไม่ได้อยู่ในรอบการกรอกนี้", 400);
      }
      // ต้องเป็น true/false จริงๆ ถ้าปล่อยผ่าน string "false" จะถูกแปลงเป็น true
      if (typeof item.is_passed !== "boolean") {
        throw httpError("ผลสอบแต่ละวิชาต้องเป็นผ่านหรือไม่ผ่านเท่านั้น", 400);
      }
      if (answers.has(subjectId)) throw httpError("ส่งวิชาซ้ำกัน", 400);
      answers.set(subjectId, item.is_passed);
    }

    const missing = mustAnswer.filter((id) => !answers.has(id));
    if (missing.length > 0) {
      throw httpError(`กรอกผลไม่ครบ ยังขาดอีก ${missing.length} วิชา`, 400);
    }

    // เก็บให้ครบทุกวิชาของรอบเสมอ — วิชาที่ล็อก (ผ่าน+approved จากรอบอื่นแล้ว) บันทึกต่อเป็นผ่านให้เลย (copy-forward)
    // ไม่เชื่อค่าที่ client ส่งมาสำหรับวิชาที่ล็อก กันแก้ผลที่ approved ไปแล้วให้กลายเป็นไม่ผ่าน
    const finalResults = roundSubjectIds.map((id) => ({
      subject_id: id,
      is_passed: lockedIds.includes(id) ? true : answers.get(id),
    }));

    const result = isRedo
      ? await examRepo.resubmitWithSubjects(existing.result_id, finalResults)
      : await examRepo.createWithSubjects(
          {
            student_id: student.student_id,
            round_id: round.round_id,
            student_status: STUDENT_STATUS.SUBMITTED,
            staff_status: STAFF_STATUS.PENDING,
          },
          finalResults,
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

    // แจ้งเตือนนักศึกษาเจ้าของผลสอบ — ยิงแบบ fire-and-forget ไม่ให้ล้มการยืนยัน/ตีกลับถ้าแจ้งเตือนพลาด
    const roundLabel = `รอบ ${existing.round.attempt_number}/${existing.round.academic_year}`;
    const message =
      staff_status === "approved"
        ? `ผลสอบ${roundLabel}ได้รับการยืนยันแล้ว`
        : `ผลสอบ${roundLabel}ถูกตีกลับ: ${remark}`;
    notifRepo
      .create({ student_id: existing.student_id, type: staff_status, message })
      .catch((e) => console.error("สร้างแจ้งเตือนไม่สำเร็จ:", e.message));

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
