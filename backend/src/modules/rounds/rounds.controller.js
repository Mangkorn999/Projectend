import * as roundsRepo from "./rounds.repository.js";
import * as studentRepo from "../students/student.repository.js";
import * as subjectsRepo from "../subjects/subjects.repository.js";
import * as examRepo from "../examResults/examResults.repository.js";
import { subjectsOfRound } from "../../utils/roundSubjects.js";
import { withPhase } from "../../utils/roundPhase.js";

// สร้าง Error พร้อม statusCode ให้ errorHandler จัดการต่อ
const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

export const getAll = async (req, res, next) => {
  try {
    const rounds = await roundsRepo.findAll();
    // แปะ phase ให้ทุกรอบ — หน้าจัดการรอบจะได้เขียนป้ายสถานะตรงกับความจริง
    // ("รอถึงกำหนดเปิด" / "เปิดรับอยู่" / "เลยกำหนดปิด" แทนที่จะเขียน "เปิด" เหมือนกันหมด)
    res.json({ success: true, data: rounds.map(withPhase) });
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
    //
    // ใช้ findOpenForYear (ไม่กรองวันที่) ไม่ใช่ findActive
    // เพื่อให้รอบที่เจ้าหน้าที่ตั้งเปิดไว้ล่วงหน้าส่งกลับไปด้วย นักศึกษาจะได้เห็นว่า "จะเปิดวันที่ ..."
    // เดิมส่ง null หน้าจอขึ้นแค่ "ไม่มีรอบเปิด" ซึ่งไม่ได้บอกว่าต้องรอถึงเมื่อไหร่
    //
    // ความปลอดภัยไม่เปลี่ยน: ตอนรับผลสอบจริง examResults.controller ยังเรียก findActive()
    // ที่กรองวันที่อยู่เหมือนเดิม ส่งมาตอนยังไม่ถึงวันเปิดก็ถูกปฏิเสธอยู่ดี
    // ฝั่งหน้าจออ่าน phase เพื่อรู้ว่าตอนนี้กรอกได้จริงไหม (active เท่านั้นที่กรอกได้)
    const round = await roundsRepo.findOpenForYear(student.academic_year);
    if (!round) return res.json({ success: true, data: null });

    // รอบนี้สอบวิชาไหนบ้าง + วิชาไหนที่นักศึกษาคนนี้ผ่านไปแล้วจากรอบก่อน
    const allSubjects = await subjectsRepo.findAll();
    // ส่ง round_id ไปด้วย ให้ already_passed ที่ frontend เห็น ตรงกับที่ backend เช็คตอน POST
    const passedIds = await examRepo.findPassedSubjectIds(
      student.student_id,
      round.round_id,
    );
    const subjects = subjectsOfRound(round, allSubjects).map((s) => ({
      ...s,
      already_passed: passedIds.includes(s.subject_id),
    }));

    // แผ่ field ของ round ไว้ชั้นบนสุดเหมือนเดิม แล้วค่อยเติมของใหม่
    // ถ้าย้ายไปซ้อนใน data.round หน้าเก่าที่อ่าน data.round_id จะพังหมด
    res.json({
      success: true,
      data: {
        ...withPhase(round),
        subjects,
        // รอบที่ไม่เหลือวิชาเลย (เช่น วิชาถูกลบ) ต้องไม่นับว่า "ผ่านครบ" — [].every() ให้ true เสมอ
        all_passed: subjects.length > 0 && subjects.every((s) => s.already_passed),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── วันที่/เวลา ─────────────────────────────────
//
// ทุกอย่างในระบบนี้ตีความเป็นเวลาไทย (ICT) เสมอ ไม่ว่า server จะตั้ง timezone อะไร
// ไทยเป็น UTC+7 ตายตัว ไม่มี daylight saving เลย → บวกลบเองได้ ไม่ต้องลง library
//
// ห้ามใช้ new Date(...).setHours() เด็ดขาด เพราะ setHours ใช้ timezone ของเครื่อง server
// ถ้า deploy บนเครื่องที่ตั้งเป็น UTC จะกลายเป็น 23:59 UTC = 06:59 เช้าวันถัดไปเวลาไทย
const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;

const START_OF_DAY = { h: 0, m: 0, s: 0, ms: 0 };
const END_OF_DAY = { h: 23, m: 59, s: 59, ms: 999 };

// รับได้ทั้ง "2026-08-09" (วันที่อย่างเดียว) และ "2026-08-09T14:30" (จาก input datetime-local)
// ถ้าไม่มีเวลามาด้วย ใช้ defaultTime แทน — เปิดรับใช้ต้นวัน ปิดรับใช้ท้ายวัน
//
// เช็คด้วย regex ก่อนแทนที่จะโยนเข้า new Date() ตรงๆ เพราะ new Date("อะไรก็ไม่รู้")
// จะได้ "Invalid Date" ที่หน้าตาเหมือน Date ปกติ แล้วไปพังตอนลง Prisma เป็น 500 แทนที่จะเป็น 400
const parseThaiDateTime = (value, fieldLabel, defaultTime) => {
  const matched = String(value ?? "").match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!matched) throw httpError(`${fieldLabel} ไม่ถูกต้อง`, 400);

  const [, year, month, day, hour, minute, second] = matched;
  // มีเวลาส่งมา → ใช้เวลานั้น. ไม่มี → ใช้ค่า default ของ field นั้น
  const time =
    hour !== undefined
      ? { h: Number(hour), m: Number(minute), s: Number(second ?? 0), ms: 0 }
      : defaultTime;

  // สร้างเป็น UTC ก่อน แล้วลบ 7 ชั่วโมง = เวลาไทยตามที่ผู้ใช้กรอกจริงๆ
  // เช่น กรอก 23:59 ไทย → เก็บลง DB เป็น 16:59 UTC
  const asUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    time.h,
    time.m,
    time.s,
    time.ms,
  );
  const date = new Date(asUtc - ICT_OFFSET_MS);
  // เลขวันที่อาจเกินจริงได้ เช่น "2026-02-31" — Date.UTC ไม่ error แต่เลื่อนวันให้เอง
  if (isNaN(date.getTime())) throw httpError(`${fieldLabel} ไม่ถูกต้อง`, 400);
  return date;
};

// เปิดรับ = 00:00:00 เวลาไทย ถ้าเจ้าหน้าที่ไม่ได้ระบุเวลา
const parseOpenDate = (value, fieldLabel) =>
  parseThaiDateTime(value, fieldLabel, START_OF_DAY);

// ปิดรับ = 23:59:59.999 เวลาไทย ถ้าเจ้าหน้าที่ไม่ได้ระบุเวลา
// กันรอบหมดอายุตั้งแต่เที่ยงคืนต้นวันปิด
const parseCloseDate = (value, fieldLabel) =>
  parseThaiDateTime(value, fieldLabel, END_OF_DAY);

// เปิดรับต้องมาก่อนปิดรับเสมอ
//
// เดิมไม่มีด่านนี้เลย → เจ้าหน้าที่กรอกสลับกันได้ (เช่น เปิด 26 ก.ย. ปิด 23 ก.ย.)
// แล้วรอบนั้นจะ "เปิด" อยู่ในตาราง แต่ findActive() หาไม่เจอตลอดกาล
// เพราะเงื่อนไขคือ open_date <= now <= close_date ซึ่งเป็นไปไม่ได้
// ผลคือ: นักศึกษากรอกไม่ได้สักคน + เจ้าหน้าที่เปิดรอบอื่นไม่ได้ (ระบบยอมให้เปิดทีละรอบ)
// = ระบบล็อกตาย โดยไม่มี error อะไรขึ้นให้เห็นเลย
const ensureValidDateRange = (openDate, closeDate) => {
  if (openDate >= closeDate) {
    throw httpError(
      "วันที่เปิดรับต้องมาก่อนวันที่ปิดรับ กรุณาตรวจสอบวันที่อีกครั้ง",
      400,
    );
  }
};

// กดเปิดรอบที่เลยกำหนดปิดไปแล้ว = เปิดแล้วก็ยังกรอกไม่ได้อยู่ดี
// เช็คตอนกดเปิดเท่านั้น (ไม่ใช่ตอนบันทึกเฉยๆ) เพราะรอบที่ปิดไปแล้วต้องแก้ข้อมูลย้อนหลังได้
const ensureNotAlreadyExpired = (closeDate) => {
  if (closeDate < new Date()) {
    throw httpError(
      "เปิดรอบนี้ไม่ได้ — เลยวันที่ปิดรับไปแล้ว กรุณาแก้วันที่ปิดรับก่อน",
      400,
    );
  }
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

// หนึ่งปีการศึกษามี "ครั้งที่ n" ได้รอบเดียว — เช็คก่อนบันทึกเพื่อให้ได้ 400 พร้อมข้อความที่อ่านรู้เรื่อง
// exceptRoundId = รอบที่กำลังแก้อยู่ ต้องข้ามไป ไม่งั้นแก้รอบเป็นค่าเดิมของตัวเองจะโดนบล็อก
const ensureNotDuplicate = async (academicYear, attemptNumber, exceptRoundId) => {
  const existing = await roundsRepo.findByYearAndAttempt(
    academicYear,
    attemptNumber,
  );
  if (existing && existing.round_id !== exceptRoundId) {
    throw httpError(
      `ปีการศึกษา ${academicYear} มีรอบครั้งที่ ${attemptNumber} อยู่แล้ว`,
      400,
    );
  }
};

// เปิดรับได้ทีละรอบเดียวทั้งระบบ — นักศึกษาคนหนึ่งเห็นรอบที่เปิดของรุ่นตัวเองเพียงรอบเดียวเสมอ
// (เดิม findActive หยิบ attempt_number สูงสุดมาให้ ถ้าเผลอเปิดค้างไว้หลายรอบ นักศึกษาจะได้รอบที่ไม่ตั้งใจ)
// exceptRoundId = รอบที่กำลังแก้อยู่ ต้องข้ามไป ไม่งั้นกดบันทึกรอบที่เปิดอยู่แล้วจะบล็อกตัวเอง
const ensureNoOtherOpenRound = async (exceptRoundId) => {
  const open = await roundsRepo.findOpen();
  if (open && open.round_id !== exceptRoundId) {
    throw httpError(
      `รอบครั้งที่ ${open.attempt_number} ปีการศึกษา ${open.academic_year} เปิดรับอยู่ ต้องปิดรอบนั้นก่อนถึงจะเปิดรอบใหม่ได้`,
      400,
    );
  }
};

// Prisma โยน P2002 ตอนชน unique index — เกิดได้ถ้ามีคนกดสร้างรอบเดียวกันพร้อมกันสองหน้าจอ
// แปลงเป็น 400 ข้อความไทย ไม่งั้น errorHandler จะตอบ 500 ที่ผู้ใช้อ่านไม่รู้เรื่อง
const asDuplicateRoundError = (err) =>
  err.code === "P2002" ? httpError("ปีการศึกษานี้มีรอบครั้งที่นี้อยู่แล้ว", 400) : err;

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

    await ensureNotDuplicate(Number(academic_year), Number(attempt_number));
    if (status === "open") await ensureNoOtherOpenRound();

    // ไม่ส่ง subject_ids มา = ใช้ทุกวิชาที่มีในระบบ (พฤติกรรมเดิมก่อนมี field นี้)
    const subjectIds =
      subject_ids === undefined
        ? (await subjectsRepo.findAll()).map((s) => s.subject_id)
        : await validateSubjectIds(subject_ids);

    const openDate = parseOpenDate(open_date, "วันที่เปิดรับ");
    const closeDate = parseCloseDate(close_date, "วันที่ปิดรับ");
    ensureValidDateRange(openDate, closeDate);
    if (status === "open") ensureNotAlreadyExpired(closeDate);

    const round = await roundsRepo.create({
      subject_ids: subjectIds,
      academic_year: Number(academic_year),
      attempt_number: Number(attempt_number),
      open_date: openDate,
      close_date: closeDate,
      status: status ?? "closed",
      created_by: req.user.userId, // อ่านจาก JWT เท่านั้น ไม่เชื่อ body
    });
    res.json({ success: true, data: withPhase(round) });
  } catch (err) {
    next(asDuplicateRoundError(err));
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

    const current = await roundsRepo.findById(req.params.id);
    if (!current) throw httpError("ไม่พบรอบการกรอกนี้", 404);

    if (subject_ids !== undefined) {
      // เปิดรอบไปแล้วห้ามเปลี่ยนวิชา — นักศึกษาอาจกรอกไปแล้วตามรายการเดิม
      if (current.status === "open") {
        throw httpError("รอบนี้เปิดให้กรอกแล้ว แก้ไขรายวิชาไม่ได้ ต้องปิดรอบก่อน", 400);
      }
      data.subject_ids = await validateSubjectIds(subject_ids);
    }

    if (academic_year !== undefined) data.academic_year = Number(academic_year);
    if (attempt_number !== undefined)
      data.attempt_number = Number(attempt_number);

    // แก้ปี/ครั้งที่ ต้องไม่ไปชนรอบอื่นที่มีอยู่ — ค่าที่ไม่ได้ส่งมาให้ใช้ของเดิม
    if (academic_year !== undefined || attempt_number !== undefined) {
      await ensureNotDuplicate(
        data.academic_year ?? current.academic_year,
        data.attempt_number ?? current.attempt_number,
        current.round_id,
      );
    }
    if (open_date !== undefined) data.open_date = parseOpenDate(open_date, "วันที่เปิดรับ");
    if (close_date !== undefined) data.close_date = parseCloseDate(close_date, "วันที่ปิดรับ");
    if (status !== undefined) data.status = status;

    // ตรวจช่วงวันที่จาก "ค่าหลังแก้" ไม่ใช่เฉพาะค่าที่ส่งมา
    // ส่งมาแค่ close_date อย่างเดียวก็ทำให้ช่วงพังได้ ถ้าไปเร็วกว่า open_date เดิมที่อยู่ใน DB
    const finalOpen = data.open_date ?? current.open_date;
    const finalClose = data.close_date ?? current.close_date;
    ensureValidDateRange(new Date(finalOpen), new Date(finalClose));

    // กดเปิดรอบนี้ ต้องไม่มีรอบอื่นเปิดค้างอยู่ (รอบนี้เปิดอยู่แล้วแล้วกดบันทึกซ้ำ ไม่นับ)
    if (status === "open") {
      await ensureNoOtherOpenRound(current.round_id);
      // เปิดรอบที่เลยกำหนดปิดแล้วไม่ได้ — ยกเว้นรอบนี้เปิดค้างอยู่แล้ว (กดบันทึกซ้ำโดยไม่ได้ตั้งใจเปิดใหม่)
      if (current.status !== "open") ensureNotAlreadyExpired(new Date(finalClose));
    }

    const round = await roundsRepo.update(req.params.id, data);
    res.json({ success: true, data: withPhase(round) });
  } catch (err) {
    next(asDuplicateRoundError(err));
  }
};

// ลบรอบได้เฉพาะรอบที่ยังไม่มีใครใช้จริง — ผลสอบ/ประกาศที่ผูกอยู่จะกลายเป็นข้อมูลกำพร้า
// (foreign key จะกันให้อยู่แล้ว แต่ error ที่ได้จะอ่านไม่รู้เรื่อง ต้องเช็คเองเพื่อบอกสาเหตุให้ชัด)
export const remove = async (req, res, next) => {
  try {
    const round = await roundsRepo.findById(req.params.id);
    if (!round) throw httpError("ไม่พบรอบการกรอกนี้", 404);

    // status field ไม่ auto ปิดเองเมื่อพ้น close_date — เช็ควันที่ประกอบด้วยว่า "เปิดจริง" หรือแค่ยังไม่ได้กดปิด
    if (round.status === "open" && new Date(round.close_date) >= new Date()) {
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
