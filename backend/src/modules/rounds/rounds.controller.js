import * as roundsRepo from "./rounds.repository.js";
import * as studentRepo from "../students/student.repository.js";
import * as subjectsRepo from "../subjects/subjects.repository.js";
import * as examRepo from "../examResults/examResults.repository.js";
import { subjectsOfRound } from "../../utils/roundSubjects.js";

// สร้าง Error พร้อม statusCode ให้ errorHandler จัดการต่อ
const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

export const getAll = async (req, res, next) => {
  try {
    const rounds = await roundsRepo.findAll();
    res.json({ success: true, data: rounds });
  } catch (err) {
    next(err);
  }
};

// นักศึกษาดูรอบที่เปิดอยู่ — ต้องผ่าน gate exam_eligible ก่อน
// (เจ้าหน้าที่เป็นคนเปิดสิทธิ์ให้เมื่อนักศึกษาจบปี 4 แล้ว)
export const getActive = async (req, res, next) => {
  try {
    const student = await studentRepo.findById(req.user.studentId);
    if (!student) {
      const err = new Error("ไม่พบข้อมูลนักศึกษา");
      err.statusCode = 404;
      throw err;
    }
    if (!student.exam_eligible) {
      const err = new Error("ยังไม่ได้รับสิทธิ์กรอกผลสอบ กรุณาติดต่อเจ้าหน้าที่คณะ");
      err.statusCode = 403;
      throw err;
    }

    // เฉพาะรอบของรุ่นตัวเอง — รุ่นอื่นเปิดรอบอยู่ก็ไม่เกี่ยวกับคนนี้
    const round = await roundsRepo.findActive(student.academic_year);
    if (!round) return res.json({ success: true, data: null });

    // รอบนี้สอบวิชาไหนบ้าง + วิชาไหนที่นักศึกษาคนนี้ผ่านไปแล้วจากรอบก่อน
    const allSubjects = await subjectsRepo.findAll();
    const passedIds = await examRepo.findPassedSubjectIds(student.student_id);
    const subjects = subjectsOfRound(round, allSubjects).map((s) => ({
      ...s,
      already_passed: passedIds.includes(s.subject_id),
    }));

    // แผ่ field ของ round ไว้ชั้นบนสุดเหมือนเดิม แล้วค่อยเติมของใหม่
    // ถ้าย้ายไปซ้อนใน data.round หน้าเก่าที่อ่าน data.round_id จะพังหมด
    res.json({
      success: true,
      data: {
        ...round,
        subjects,
        all_passed: subjects.every((s) => s.already_passed),
      },
    });
  } catch (err) {
    next(err);
  }
};

// แปลงเป็น Date แล้วเช็คว่าถูกต้องจริง — new Date("") หรือ new Date("ไม่ใช่วันที่")
// จะได้ "Invalid Date" ซึ่งดูเหมือน Date ปกติแต่ใช้ไม่ได้ ถ้าไม่เช็คแล้วส่งเข้า Prisma ตรงๆ
// จะพังแบบบอกสาเหตุไม่ได้ (500 เฉยๆ) ต้องเช็คตรงนี้ก่อนแล้วบอก error ให้ชัดเจน (400)
const parseDate = (value, fieldLabel) => {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw httpError(`${fieldLabel} ไม่ถูกต้อง`, 400);
  }
  return date;
};

// เช็ค subject_ids ที่ officer ส่งมาว่าใช้ได้จริง แล้วคืนเป็น array ของตัวเลข
// ต้องเช็คเองเพราะเก็บเป็น Int[] ไม่มี foreign key คอยกันให้
const validateSubjectIds = async (rawIds) => {
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    throw httpError("กรุณาเลือกวิชาที่ใช้สอบในรอบนี้อย่างน้อย 1 วิชา", 400);
  }

  const ids = rawIds.map(Number);
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw httpError("รหัสวิชาไม่ถูกต้อง", 400);
  }

  // เลือกวิชาซ้ำจะทำให้นับจำนวนวิชาของรอบผิด ต้องกันตั้งแต่ตอนบันทึก
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) {
    throw httpError("เลือกวิชาซ้ำกัน", 400);
  }

  const found = await subjectsRepo.findByIds(unique);
  if (found.length !== unique.length) {
    throw httpError("มีรหัสวิชาที่ไม่มีอยู่ในระบบ", 400);
  }

  return unique;
};

export const create = async (req, res, next) => {
  try {
    const {
      academic_year,
      attempt_number,
      open_date,
      close_date,
      status,
      subject_ids,
    } = req.body;

    if (!academic_year || !attempt_number || !open_date || !close_date) {
      throw httpError(
        "กรุณากรอกข้อมูลให้ครบ (ปีการศึกษา, ครั้งที่สอบ, วันที่เปิด-ปิดรับ)",
        400,
      );
    }

    // ไม่ส่ง subject_ids มา = ใช้ทุกวิชาที่มีในระบบ (พฤติกรรมเดิมก่อนมี field นี้)
    const subjectIds =
      subject_ids === undefined
        ? (await subjectsRepo.findAll()).map((s) => s.subject_id)
        : await validateSubjectIds(subject_ids);

    const round = await roundsRepo.create({
      subject_ids: subjectIds,
      academic_year: Number(academic_year),
      attempt_number: Number(attempt_number),
      open_date: parseDate(open_date, "วันที่เปิดรับ"),
      close_date: parseDate(close_date, "วันที่ปิดรับ"),
      status: status ?? "closed",
      created_by: req.user.userId, // อ่านจาก JWT เท่านั้น ไม่เชื่อ body
    });
    res.json({ success: true, data: round });
  } catch (err) {
    next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const {
      academic_year,
      attempt_number,
      open_date,
      close_date,
      status,
      subject_ids,
    } = req.body;
    const data = {};

    if (subject_ids !== undefined) {
      const current = await roundsRepo.findById(req.params.id);
      if (!current) throw httpError("ไม่พบรอบการกรอกนี้", 404);
      // เปิดรอบไปแล้วห้ามเปลี่ยนวิชา — นักศึกษาอาจกรอกไปแล้วตามรายการเดิม
      if (current.status === "open") {
        throw httpError("รอบนี้เปิดให้กรอกแล้ว แก้ไขรายวิชาไม่ได้ ต้องปิดรอบก่อน", 400);
      }
      data.subject_ids = await validateSubjectIds(subject_ids);
    }

    if (academic_year !== undefined) data.academic_year = Number(academic_year);
    if (attempt_number !== undefined)
      data.attempt_number = Number(attempt_number);
    if (open_date !== undefined) data.open_date = parseDate(open_date, "วันที่เปิดรับ");
    if (close_date !== undefined) data.close_date = parseDate(close_date, "วันที่ปิดรับ");
    if (status !== undefined) data.status = status;

    const round = await roundsRepo.update(req.params.id, data);
    res.json({ success: true, data: round });
  } catch (err) {
    next(err);
  }
};

// ลบรอบได้เฉพาะรอบที่ยังไม่มีใครใช้จริง — ผลสอบ/ประกาศที่ผูกอยู่จะกลายเป็นข้อมูลกำพร้า
// (foreign key จะกันให้อยู่แล้ว แต่ error ที่ได้จะอ่านไม่รู้เรื่อง ต้องเช็คเองเพื่อบอกสาเหตุให้ชัด)
export const remove = async (req, res, next) => {
  try {
    const round = await roundsRepo.findById(req.params.id);
    if (!round) throw httpError("ไม่พบรอบการกรอกนี้", 404);

    if (round.status === "open") {
      throw httpError("รอบนี้กำลังเปิดรับอยู่ ต้องปิดรอบก่อนถึงจะลบได้", 400);
    }

    const [resultCount, newsCount] = await Promise.all([
      roundsRepo.countExamResults(round.round_id),
      roundsRepo.countNews(round.round_id),
    ]);
    if (resultCount > 0) {
      throw httpError(
        `ลบไม่ได้ — มีผลสอบของนักศึกษา ${resultCount} รายการอยู่ในรอบนี้แล้ว`,
        400,
      );
    }
    if (newsCount > 0) {
      throw httpError(
        `ลบไม่ได้ — มีประกาศ ${newsCount} รายการผูกกับรอบนี้อยู่ ลบประกาศก่อน`,
        400,
      );
    }

    await roundsRepo.remove(round.round_id);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};
