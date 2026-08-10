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
    // แก้ทับได้จนกว่าเจ้าหน้าที่จะยืนยัน หรือรอบจะปิด — อย่างใดอย่างหนึ่งมาก่อน
    // (รอบปิดไม่ต้องเช็คตรงนี้ เพราะ findActive ด้านบนคืน null ไปแล้ว)
    // ยืนยันแล้วต้องล็อก ไม่งั้นเปลี่ยนผลหลังเจ้าหน้าที่เซ็นไปแล้วได้
    if (existing?.staff_status === STAFF_STATUS.APPROVED) {
      throw httpError("เจ้าหน้าที่ยืนยันผลสอบรอบนี้แล้ว แก้ไขไม่ได้", 409);
    }
    const isRedo = Boolean(existing);

    const allSubjects = await subjectsRepo.findAll();
    const roundSubjectIds = subjectsOfRound(round, allSubjects).map(
      (s) => s.subject_id,
    );
    // ส่ง round_id ไปด้วยเพื่อตัดใบของรอบนี้ออก
    // วิชาที่ผ่านในใบที่ถูกตีกลับ ต้องกลับมาแก้ได้ ไม่ใช่ถูกล็อกเป็น "ผ่านแล้วจากรอบก่อน"
    const passedIds = await examRepo.findPassedSubjectIds(
      student.student_id,
      round.round_id,
    );
    // วิชาที่ยังต้องตอบจริงในรอบนี้ = วิชาของรอบ ลบวิชาที่เคยผ่านแล้ว
    const mustAnswer = roundSubjectIds.filter((id) => !passedIds.includes(id));

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

    // เก็บให้ครบทุกวิชาของรอบเสมอ — วิชาที่เคยผ่านแล้วบันทึกต่อเป็นผ่านให้เลย (copy-forward)
    // ไม่เชื่อค่าที่ client ส่งมาสำหรับวิชาพวกนี้ กันแก้ผลที่ผ่านไปแล้วให้กลายเป็นไม่ผ่าน
    //
    // .map() = วนทุกตัวใน roundSubjectIds แล้วสร้าง array ใหม่ขนาดเท่าเดิม
    const finalResults = roundSubjectIds.map((id) => {
      // วิชานี้เคยผ่านมาจากรอบก่อนหรือเปล่า
      const passedBefore = passedIds.includes(id);

      let isPassed;
      if (passedBefore) {
        isPassed = true; // เคยผ่านแล้ว บังคับเป็นผ่าน ไม่สนค่าที่ client ส่งมา
      } else {
        isPassed = answers.get(id); // ยังไม่เคยผ่าน ใช้คำตอบที่นักศึกษากรอกมา
      }

      return {
        subject_id: id,
        is_passed: isPassed,
        // ยกมาจากรอบก่อน ไม่ได้สอบรอบนี้ — dashboard ต้องไม่นับเป็นคนสอบผ่าน
        carried_forward: passedBefore,
      };
    });

    // isRedo = เคยส่งใบของรอบนี้ไปแล้วและกำลังแก้ส่งใหม่ (ไม่ใช่สร้างใบใหม่)
    let result;
    if (isRedo) {
      // ทับผลเดิมในใบเดิม ไม่สร้างใบใหม่ ไม่งั้นจะมี 2 ใบในรอบเดียว
      result = await examRepo.resubmitWithSubjects(
        existing.result_id,
        finalResults,
      );
    } else {
      result = await examRepo.createWithSubjects(
        {
          student_id: student.student_id,
          round_id: round.round_id,
          student_status: STUDENT_STATUS.SUBMITTED,
          staff_status: STAFF_STATUS.PENDING,
        },
        finalResults,
      );
    }

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

    // ตอนตีกลับ (requireRemark = true) remark ผ่านการเช็คข้างบนแล้วว่าไม่ว่าง
    // ตอนยืนยัน เจ้าหน้าที่จะใส่ remark มาหรือไม่ก็ได้ — ไม่ใส่มาเลยให้เก็บ null ลง DB
    let remarkToSave = remark;
    if (remarkToSave === undefined || remarkToSave === null) {
      remarkToSave = null;
    }

    const result = await examRepo.updateStaffStatus(req.params.id, {
      staff_status,
      remark: remarkToSave,
      confirmed_by: req.user.userId, // อ่านจาก JWT เท่านั้น
    });

    // แจ้งเตือนนักศึกษาเจ้าของผลสอบ — ยิงแบบ fire-and-forget ไม่ให้ล้มการยืนยัน/ตีกลับถ้าแจ้งเตือนพลาด
    const roundLabel = `รอบ ${existing.round.attempt_number}/${existing.round.academic_year}`;
    // ข้อความแจ้งเตือนต่างกันตามว่าเจ้าหน้าที่กดยืนยันหรือกดตีกลับ
    let message;
    if (staff_status === "approved") {
      message = `ผลสอบ${roundLabel}ได้รับการยืนยันแล้ว`;
    } else {
      // \n = ขึ้นบรรทัดใหม่ ฝั่งหน้าเว็บเอาบรรทัดที่ 2 ไปโชว์เป็นตัวเล็กใต้หัวข้อ
      message = `ผลสอบ${roundLabel}ถูกตีกลับ: ${remark}\nกรุณากรอกผลสอบของท่านใหม่อีกครั้ง`;
    }
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
