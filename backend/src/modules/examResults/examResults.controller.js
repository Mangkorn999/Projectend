import * as examRepo from "./examResults.repository.js";
import { STUDENT_STATUS, STAFF_STATUS } from "./examResults.repository.js";
import { findSubmittableRound } from "./examResults.service.js";
import * as studentRepo from "../students/student.repository.js";
import * as subjectsRepo from "../subjects/subjects.repository.js";
import { subjectsOfRound } from "../../utils/roundSubjects.js";
import * as notifRepo from "../notifications/notifications.repository.js";
import * as reviewLogRepo from "./reviewLog.repository.js";

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
    //
    // findSubmittableRound = รอบที่เปิดรับอยู่จริงตอนนี้ หรือ (ถ้าไม่มีรอบเปิด) รอบล่าสุดที่ใบของคนนี้ถูกตีกลับ
    // ตัวเดียวกับที่หน้ากรอกผล (GET /api/rounds/active) ใช้ — หน้าจอกับตอนส่งจริงจะได้ตัดสินตรงกัน
    const submittable = await findSubmittableRound(student);
    if (!submittable) {
      throw httpError(
        "ขณะนี้ไม่มีรอบกรอกผลสอบที่เปิดอยู่ หากต้องการส่งผลสอบ กรุณาติดต่อเจ้าหน้าที่คณะ",
        400,
      );
    }
    const round = submittable.round;

    const existing = await examRepo.findByStudentAndRound(
      student.student_id,
      round.round_id,
    );
    // แก้ทับได้จนกว่าเจ้าหน้าที่จะยืนยัน หรือรอบจะปิด — อย่างใดอย่างหนึ่งมาก่อน
    // ยืนยันแล้วต้องล็อก ไม่งั้นเปลี่ยนผลหลังเจ้าหน้าที่เซ็นไปแล้วได้
    if (existing?.staff_status === STAFF_STATUS.APPROVED) {
      throw httpError("เจ้าหน้าที่ยืนยันผลสอบรอบนี้แล้ว แก้ไขไม่ได้", 409);
    }

    // รอบปิดแล้ว (มาทางแก้ใบที่ถูกตีกลับ) → ต้องมีใบเดิมที่ยังถูกตีกลับอยู่จริงเท่านั้น
    // เช็คซ้ำตรงนี้อีกชั้น เผื่อสถานะใบเปลี่ยนไประหว่างทาง — เช่น กดส่งแก้ไปแล้วรอบหนึ่ง ใบกลับเป็น "รอตรวจ"
    // ใบรอตรวจหลังปิดรอบห้ามแก้ต่อ (ต้องรอเจ้าหน้าที่ตรวจ)
    if (submittable.fixingRejected) {
      const stillRejected = existing && existing.staff_status === STAFF_STATUS.REJECTED;
      if (!stillRejected) {
        throw httpError(
          "ขณะนี้ไม่มีรอบกรอกผลสอบที่เปิดอยู่ หากต้องการส่งผลสอบ กรุณาติดต่อเจ้าหน้าที่คณะ",
          400,
        );
      }
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

    // รอบนี้ไม่มีวิชาให้กรอกเลย (เช่น ในระบบยังไม่มีรายวิชา) — คนละเรื่องกับ "ผ่านครบแล้ว"
    // ต้องแยกข้อความ ไม่งั้นนักศึกษาที่ยังไม่เคยสอบผ่านสักวิชาจะเห็นว่า "ผ่านครบทุกวิชาแล้ว"
    if (roundSubjectIds.length === 0) {
      throw httpError("รอบนี้ยังไม่มีรายวิชา กรุณาติดต่อเจ้าหน้าที่คณะ", 400);
    }

    // ผ่านครบทุกวิชาของรอบนี้ไปแล้ว (จากใบที่ไม่ถูกตีกลับของรอบก่อน) = ไม่มีอะไรต้องกรอก
    // ถ้าปล่อยผ่านจะเกิดใบ "ว่าง" (ยกผลมาทั้งหมด) โผล่ในคิวตรวจของเจ้าหน้าที่
    // เคสแก้ใบที่ถูกตีกลับไม่โดน: findPassedSubjectIds ตัดใบของรอบนี้ออกไปแล้ว mustAnswer จึงไม่ว่าง
    if (mustAnswer.length === 0) {
      throw httpError("ผ่านครบทุกวิชาของรอบนี้แล้ว ไม่ต้องกรอกผลสอบอีก", 400);
    }

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
      // repository ล็อกใบแล้วเช็คซ้ำ: ยังไม่ถูกยืนยัน (และถ้ามาทางแก้ใบตีกลับ ต้องยังถูกตีกลับอยู่)
      // เช็คข้างบนเป็นแค่ด่านแรกให้ข้อความชัด — ด่านที่กันการกดพร้อมกันได้จริงคือด่านในล็อก
      result = await examRepo.resubmitWithSubjects(
        existing.result_id,
        finalResults,
        submittable.fixingRejected,
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

// ─── ตรวจว่าใบยังเหมือนที่ผู้ตรวจเห็นอยู่บนจอ ─────────────────────
//
// ปัญหา: ผู้ตรวจเปิดใบ → ระหว่างดู นักศึกษาส่งผลใหม่หรือลบ/เพิ่มไฟล์ → ผู้ตรวจกดยืนยันจากของเก่าที่เห็น
// ถ้าไม่กัน ระบบจะยืนยันใบที่ผู้ตรวจไม่เคยเห็นเนื้อหาจริง (เช่น ใบคะแนนที่ผู้ตรวจเปิดดูถูกลบไปแล้ว)
//
// หน้าจอส่ง "ลายนิ้วมือ" ของใบที่ผู้ตรวจเห็นมาด้วย 2 อย่าง (ไม่บังคับทั้งคู่ — ไม่ส่ง = ไม่เทียบ ทำงานแบบเดิม):
//   expected_submitted_at    = เวลาส่งผลล่าสุดของใบ (ส่งทับทีไรเปลี่ยนทุกครั้ง) เป็นข้อความ ISO เช่น "2026-10-04T03:15:22.123Z"
//   expected_certificate_ids = รหัสไฟล์ทุกไฟล์ที่เห็นในใบ เช่น [12, 15] (ใบที่ไม่มีไฟล์ = [])
// ไม่ตรงกับของจริงตอนกดยืนยัน = มีการแก้ใบระหว่างตรวจ → 409 ให้โหลดหน้าใหม่แล้วตรวจอีกครั้ง
const PAPER_CHANGED_MESSAGE =
  "นักศึกษาแก้ไขผลสอบหรือเอกสารระหว่างที่ท่านตรวจ กรุณาโหลดหน้าใหม่แล้วตรวจอีกครั้ง";
const BAD_VERSION_MESSAGE =
  "ข้อมูลใบผลสอบที่ส่งมาไม่ถูกต้อง กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง";

// อ่าน + ตรวจรูปแบบ expected_* จาก body → { submittedAtMs, certificateIds }
//   ค่าไหนไม่ได้ส่งมา (undefined/null) = null แปลว่า "ไม่ต้องเทียบเรื่องนี้"
//   ส่งมาแต่รูปแบบผิด = 400 (ไม่เดาให้ — เดาผิดอาจปล่อยให้ยืนยันใบที่ถูกแก้ไปแล้ว)
const readExpectedVersion = (body) => {
  const result = { submittedAtMs: null, certificateIds: null };

  const rawTime = body?.expected_submitted_at;
  if (rawTime !== undefined && rawTime !== null) {
    if (typeof rawTime !== "string") {
      throw httpError(BAD_VERSION_MESSAGE, 400);
    }
    // เทียบเป็น "เวลา" (มิลลิวินาที) ไม่ใช่เทียบข้อความ — เวลาเดียวกันเขียนได้หลายแบบ
    const ms = new Date(rawTime).getTime();
    if (isNaN(ms)) {
      throw httpError(BAD_VERSION_MESSAGE, 400);
    }
    result.submittedAtMs = ms;
  }

  const rawIds = body?.expected_certificate_ids;
  if (rawIds !== undefined && rawIds !== null) {
    if (!Array.isArray(rawIds)) {
      throw httpError(BAD_VERSION_MESSAGE, 400);
    }
    const ids = [];
    for (const item of rawIds) {
      const id = Number(item);
      if (typeof item === "boolean" || !Number.isInteger(id) || id <= 0) {
        throw httpError(BAD_VERSION_MESSAGE, 400);
      }
      ids.push(id);
    }
    result.certificateIds = ids;
  }

  return result;
};

// เรียงเลขจากน้อยไปมาก และตัดตัวซ้ำออก — ใช้เทียบ "ชุดไฟล์" แบบไม่สนลำดับ
const toSortedUniqueIds = (ids) => {
  const unique = [...new Set(ids)];
  unique.sort((a, b) => a - b);
  return unique;
};

// ใบตอนนี้ (current) ยังเหมือนที่ผู้ตรวจเห็นไหม — current มาจาก repository ระหว่างถือล็อก
const isSameVersion = (current, expected) => {
  // 1. เวลาส่งผลล่าสุดต้องตรงกัน (นักศึกษาส่งทับ = เวลาเปลี่ยน)
  if (expected.submittedAtMs !== null) {
    const currentMs = new Date(current.submitted_at).getTime();
    if (currentMs !== expected.submittedAtMs) {
      return false;
    }
  }

  // 2. ชุดรหัสไฟล์ต้องเหมือนกันทุกตัว (เพิ่มหรือลบไฟล์ = ชุดเปลี่ยน)
  if (expected.certificateIds !== null) {
    const currentIds = [];
    for (const certificate of current.certificates) {
      currentIds.push(certificate.certificate_id);
    }
    const a = toSortedUniqueIds(currentIds);
    const b = toSortedUniqueIds(expected.certificateIds);
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
  }

  return true;
};

// ยืนยัน/ตีกลับ ใช้ตัวเดียวกัน ต่างกันแค่สถานะและ remark
// reviewer เข้าได้เหมือน officer (pooled queue) — ตรวจกันเองได้ทุกคนที่ผ่าน requireRole
const reviewExamResult = async (req, res, next, { staff_status, requireRemark }) => {
  try {
    const existing = await examRepo.findById(req.params.id);
    if (!existing) throw httpError("ไม่พบผลสอบที่ระบุ", 404);
    // เช็คไว้ก่อนเป็นด่านแรก ให้ error message ชัดเจนกรณีทั่วไป (ใบถูกตรวจไปแล้วนานแล้ว)
    // เช็คจริงที่กันทับกันได้จริง (แม้ 2 คนกดพร้อมกันเป๊ะๆ) คือด่านใน reviewWithLock ด้านล่าง (ล็อกใบก่อนแล้วเช็คซ้ำ)
    if (existing.staff_status !== STAFF_STATUS.PENDING) {
      throw httpError("ใบนี้ถูกตรวจไปแล้ว กรุณารีเฟรชหน้า", 409);
    }

    // remark ต้องเป็นข้อความเท่านั้น — ถ้า client ส่งตัวเลข/object มา .trim() จะพังเป็น 500
    // เลยเช็คชนิดก่อน ไม่ใช่ข้อความ = ถือว่าไม่ได้ใส่ (แล้วให้ด่านเช็คข้างล่างตอบ 400 เองกรณีตีกลับ)
    let remark = "";
    if (typeof req.body?.remark === "string") {
      remark = req.body.remark.trim();
    }
    if (requireRemark && !remark) {
      throw httpError("กรุณาระบุเหตุผลที่ตีกลับ เพื่อให้นักศึกษาทราบว่าต้องแก้ไขอะไร", 400);
    }
    // ยาวไม่เกิน 500 ตัวอักษร เท่ากับตอนถอนการยืนยัน (revokeApproval)
    if (remark.length > 500) {
      throw httpError("เหตุผลยาวเกินไป (ไม่เกิน 500 ตัวอักษร)", 400);
    }

    // ตอนตีกลับ (requireRemark = true) remark ผ่านการเช็คข้างบนแล้วว่าไม่ว่าง
    // ตอนยืนยัน เจ้าหน้าที่จะใส่ remark มาหรือไม่ก็ได้ — ว่างให้เก็บ null ลง DB
    let remarkToSave = remark;
    if (remarkToSave === "") {
      remarkToSave = null;
    }

    // "เวอร์ชันของใบ" ที่ผู้ตรวจเห็นอยู่บนจอ (ไม่บังคับส่ง — ไม่ส่งมาก็ตรวจได้แบบเดิม)
    const expected = readExpectedVersion(req.body);

    // ล็อกใบนี้แล้วตรวจซ้ำ "ระหว่างถือล็อก" (ดู reviewWithLock ใน repository):
    //   1. ใบต้องยังรอตรวจ — อีกคนตรวจแทรกไปก่อน = 409
    //   2. ใบต้องยังเหมือนที่ผู้ตรวจเห็น — นักศึกษาส่งผลใหม่หรือเพิ่ม/ลบไฟล์ไปแล้ว = 409
    // นักศึกษาที่กำลังลบไฟล์/ส่งผลพร้อมกันพอดี ต้องล็อกแถวเดียวกัน จึงต้องรอกันทีละคน ไม่มีทางแทรกกลางได้
    //
    // Guard สถานะครอบคลุมทุกคนที่ตรวจได้ (officer เดิมด้วย ไม่ใช่แค่ reviewer) — เจตนา: ใบที่เคยถูกตรวจ
    // ไปแล้วครั้งหนึ่ง (approved/rejected) ต้องให้นักศึกษาส่งใหม่ก่อน (กลับเป็น pending) ถึงจะตรวจซ้ำได้อีก
    // แก้คำตัดสินตรงๆ ผ่าน API โดยไม่รอ resubmit ทำไม่ได้อีกต่อไป (เปลี่ยนจากพฤติกรรมเดิมก่อนมี reviewer)
    const checkBeforeSave = (current) => {
      if (!current) {
        throw httpError("ไม่พบผลสอบที่ระบุ", 404);
      }
      if (current.staff_status !== STAFF_STATUS.PENDING) {
        throw httpError("ใบนี้ถูกตรวจไปแล้ว กรุณารีเฟรชหน้า", 409);
      }
      if (!isSameVersion(current, expected)) {
        throw httpError(PAPER_CHANGED_MESSAGE, 409);
      }
      // ยืนยันผลต้องมีหลักฐานให้เทียบ — ใบที่ไม่มีไฟล์ยืนยันไม่ได้ (ตีกลับให้แนบไฟล์ได้)
      if (staff_status === STAFF_STATUS.APPROVED && current.certificates.length === 0) {
        throw httpError(
          "ใบนี้ยังไม่มีไฟล์หลักฐานแนบ ยืนยันไม่ได้ กรุณาตีกลับเพื่อให้นักศึกษาแนบไฟล์ก่อน",
          409,
        );
      }
    };

    // updateMany + where กันชนสถานะ = ด่านสุดท้ายใน repository (count = 0 แปลว่ามีคนตรวจแทรกไปก่อน)
    const count = await examRepo.reviewWithLock(
      req.params.id,
      {
        staff_status,
        remark: remarkToSave,
        confirmed_by: req.user.userId, // อ่านจาก JWT เท่านั้น
      },
      checkBeforeSave,
    );
    if (count === 0) {
      throw httpError("ใบนี้ถูกตรวจไปแล้ว กรุณารีเฟรชหน้า", 409);
    }
    const result = await examRepo.findById(req.params.id); // ดึงค่าล่าสุดไปตอบ response

    // ตรวจสำเร็จแล้ว (DB commit ผ่าน) — insert log พลาดไม่ควรทำให้ request นี้ error
    // (จะทำให้เจ้าหน้าที่เห็นว่าตัวเอง "ตรวจไม่สำเร็จ" ทั้งที่จริงสำเร็จแล้ว) log error ไว้ฝั่ง server แทน
    try {
      await reviewLogRepo.create({
        result_id: Number(req.params.id),
        reviewer_id: req.user.userId,
        action: staff_status,
        remark: remarkToSave,
      });
    } catch (e) {
      console.error("บันทึก review_logs ไม่สำเร็จ:", e.message);
    }

    // แจ้งเตือนนักศึกษาเจ้าของผลสอบ — แจ้งเตือนพลาดต้องไม่ทำให้การยืนยัน/ตีกลับล้ม (ดู try/catch ด้านล่าง)
    const roundLabel = `รอบ ${existing.round.attempt_number}/${existing.round.academic_year}`;
    // ข้อความแจ้งเตือนต่างกันตามว่าเจ้าหน้าที่กดยืนยันหรือกดตีกลับ
    let message;
    if (staff_status === "approved") {
      message = `ผลสอบ${roundLabel}ได้รับการยืนยันแล้ว`;
    } else {
      // \n = ขึ้นบรรทัดใหม่ ฝั่งหน้าเว็บเอาบรรทัดที่ 2 ไปโชว์เป็นตัวเล็กใต้หัวข้อ
      message = `ผลสอบ${roundLabel}ถูกตีกลับ: ${remark}\nกรุณากรอกผลสอบของท่านใหม่อีกครั้ง`;
    }
    // รอให้บันทึกแจ้งเตือนเสร็จก่อนตอบ (await) แต่ห่อ try/catch — แจ้งเตือนพลาดต้องไม่ทำให้การตรวจล้ม
    // เดิมยิงแบบไม่รอ (fire-and-forget) → บางครั้งนักศึกษาเปิดดูแจ้งเตือนทันทีแล้วยังไม่เห็น (เทสสะดุดเป็นครั้งคราว)
    try {
      await notifRepo.create({ student_id: existing.student_id, type: staff_status, message });
    } catch (e) {
      console.error("สร้างแจ้งเตือนไม่สำเร็จ:", e.message);
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// ───────────────────────────────────────────────────────────────
// แก้ไขผลการตรวจ (ให้ตรวจใหม่) — ใบที่ตัดสินแล้วกลับเป็น "รอตรวจ" เพื่อยืนยัน/ตีกลับใหม่
//
// วงจรสถานะที่ตั้งใจให้เป็น (ทางเดียว ไม่ซ้ำซ้อน):
//   รอตรวจ ──ยืนยัน──▶ ยืนยันแล้ว ──แก้ไขผลการตรวจ──▶ รอตรวจ
//   รอตรวจ ──ตีกลับ──▶ ถูกตีกลับ  ──แก้ไขผลการตรวจ──▶ รอตรวจ   (หรือนักศึกษาแก้แล้วส่งใหม่ → รอตรวจ)
// ยืนยัน/ตีกลับ ทำได้เฉพาะใบ "รอตรวจ" (ใบที่ตัดสินแล้วต้องกดแก้ไขก่อน) → ตีกลับซ้ำ/ยืนยันซ้ำไม่ได้ (409)
//
// ต้องใส่เหตุผลเสมอ และบันทึกลง review_logs — เป็นการกลับคำตัดสินที่เคยเซ็นแล้ว ต้องตรวจย้อนหลังได้
// เฉพาะ officer (routes) ไม่รวม reviewer: reviewer ตรวจใบที่รอตรวจได้ แต่ไม่ควรกลับคำตัดสินของคนอื่น
//
// นักศึกษาแก้ผลได้อีกหรือไม่ = กติกาเดิมของใบ "รอตรวจ": แก้ได้เฉพาะตอนรอบยังเปิดรับ
// ถ้ารอบปิด/หมดเวลาแล้ว เจ้าหน้าที่ต้องเลื่อนวันปิดรอบก่อนนักศึกษาถึงจะแก้ได้ (ไม่มีข้อยกเว้นรายคน)
// ───────────────────────────────────────────────────────────────
const reopenPaper = async (req, res, next, { allowedFrom, logAction, wrongStatusMessage, noReasonMessage }) => {
  try {
    const existing = await examRepo.findById(req.params.id);
    if (!existing) throw httpError("ไม่พบผลสอบที่ระบุ", 404);
    if (!allowedFrom.includes(existing.staff_status)) {
      throw httpError(wrongStatusMessage, 409);
    }

    const remark = typeof req.body?.remark === "string" ? req.body.remark.trim() : "";
    if (!remark) throw httpError(noReasonMessage, 400);
    if (remark.length > 500) throw httpError("เหตุผลยาวเกินไป (ไม่เกิน 500 ตัวอักษร)", 400);

    // where ใช้สถานะที่เพิ่งอ่านมา — ถ้ามีคนเปลี่ยนแทรกก่อน count = 0 → 409
    const { count } = await examRepo.reopenIfStatus(req.params.id, existing.staff_status);
    if (count === 0) throw httpError("ใบนี้ถูกเปลี่ยนสถานะไปแล้ว กรุณารีเฟรชหน้า", 409);

    try {
      await reviewLogRepo.create({
        result_id: Number(req.params.id),
        reviewer_id: req.user.userId, // อ่านจาก JWT เท่านั้น
        action: logAction,
        remark,
      });
    } catch (e) {
      console.error("บันทึก review_logs ไม่สำเร็จ:", e.message);
    }

    const roundLabel = `รอบ ${existing.round.attempt_number}/${existing.round.academic_year}`;
    const wasRejected = existing.staff_status === STAFF_STATUS.REJECTED;
    const message = wasRejected
      ? `ผลสอบ${roundLabel}ที่ถูกตีกลับ ถูกเปลี่ยนกลับเป็นรอตรวจสอบ: ${remark}
เจ้าหน้าที่จะตรวจสอบใหม่อีกครั้ง`
      : `ผลสอบ${roundLabel}ถูกเปลี่ยนกลับเป็นรอตรวจสอบ: ${remark}
เจ้าหน้าที่จะตรวจสอบใหม่อีกครั้ง`;
    // รอให้บันทึกแจ้งเตือนเสร็จก่อนตอบ แต่แจ้งเตือนพลาดต้องไม่ทำให้การแก้ไขล้ม (เหตุผลเดียวกับ reviewExamResult)
    try {
      await notifRepo.create({ student_id: existing.student_id, type: "revoked", message });
    } catch (e) {
      console.error("สร้างแจ้งเตือนไม่สำเร็จ:", e.message);
    }

    res.json({ success: true, data: await examRepo.findById(req.params.id) });
  } catch (err) {
    next(err);
  }
};

// แก้ไขผลการตรวจ — ใช้ได้ทั้งใบที่ยืนยันแล้ว และใบที่ถูกตีกลับ (ปุ่มเดียวบนหน้าจอ)
export const reopen = (req, res, next) =>
  reopenPaper(req, res, next, {
    allowedFrom: [STAFF_STATUS.APPROVED, STAFF_STATUS.REJECTED],
    logAction: "reopened",
    wrongStatusMessage: "แก้ไขผลการตรวจได้เฉพาะใบที่ยืนยันแล้วหรือถูกตีกลับเท่านั้น (ใบรอตรวจยืนยัน/ตีกลับได้เลย)",
    noReasonMessage: "ต้องระบุเหตุผลที่แก้ไขผลการตรวจ",
  });

// เจ้าหน้าที่ "ถอนการยืนยัน" — endpoint เดิม (เก็บไว้ไม่ให้ของเก่าพัง): เฉพาะใบที่ยืนยันแล้ว
export const revokeApproval = (req, res, next) =>
  reopenPaper(req, res, next, {
    allowedFrom: [STAFF_STATUS.APPROVED],
    logAction: "revoked",
    wrongStatusMessage: "ถอนการยืนยันได้เฉพาะใบที่ยืนยันแล้วเท่านั้น",
    noReasonMessage: "ต้องระบุเหตุผลที่ถอนการยืนยัน",
  });

// PATCH /:id/approve — ปุ่ม "ยืนยัน": ใช้ reviewExamResult ตัวเดียวกับ reject (ต่างแค่สถานะ + ไม่บังคับ remark)
export const approve = (req, res, next) =>
  reviewExamResult(req, res, next, {
    staff_status: STAFF_STATUS.APPROVED,
    requireRemark: false,
  });

// PATCH /:id/reject — ปุ่ม "ตีกลับ": สถานะ rejected + ต้องมี remark
export const reject = (req, res, next) =>
  reviewExamResult(req, res, next, {
    staff_status: STAFF_STATUS.REJECTED,
    requireRemark: true,
  });
