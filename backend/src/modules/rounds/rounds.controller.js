import fs from "node:fs/promises";
import path from "node:path";
import * as roundsRepo from "./rounds.repository.js";
import * as studentRepo from "../students/student.repository.js";
import * as subjectsRepo from "../subjects/subjects.repository.js";
import * as examRepo from "../examResults/examResults.repository.js";
import { findSubmittableRound } from "../examResults/examResults.service.js";
import { subjectsOfRound } from "../../utils/roundSubjects.js";
import { withPhase } from "../../utils/roundPhase.js";

// สร้าง Error พร้อม statusCode ให้ errorHandler จัดการต่อ
const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// GET /rounds — list รอบ + แปะ phase (รอเปิด/เปิดอยู่/เลยกำหนด) นักศึกษาไม่เห็นชื่อผู้สร้าง
export const getAll = async (req, res, next) => {
  try {
    const rounds = await roundsRepo.findAll();
    // แปะ phase ให้ทุกรอบ — หน้าจัดการรอบจะได้เขียนป้ายสถานะตรงกับความจริง
    // ("รอถึงกำหนดเปิด" / "เปิดรับอยู่" / "เลยกำหนดปิด" แทนที่จะเขียน "เปิด" เหมือนกันหมด)
    // ชื่อผู้สร้างรอบเป็นข้อมูลภายในคณะ — นักศึกษาไม่ต้องเห็น ตัดทิ้งก่อนส่ง (อ่าน role จาก JWT เท่านั้น)
    const data = rounds.map((r) => {
      const round = withPhase(r);
      if (req.user.role === "student") {
        delete round.creator;
        delete round.updater;
      }
      return round;
    });
    res.json({ success: true, data });
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
    // ขั้นที่ 1: รอบที่ "ส่งผลได้จริง" ตอนนี้ (findSubmittableRound — ตัวเดียวกับที่ใช้ตอนกดส่งผล)
    //   - รอบที่เปิดรับอยู่ → can_fix_rejected = false (กรอกตามปกติ)
    //   - รอบปิดแล้วแต่ใบของคนนี้ถูกตีกลับ → can_fix_rejected = true
    //     หน้าจอต้องเปิดฟอร์มให้แก้ได้ ถึง phase ของรอบจะเป็น closed/expired ก็ตาม
    let round = null;
    let canFixRejected = false;
    const submittable = await findSubmittableRound(student);
    if (submittable) {
      round = submittable.round;
      canFixRejected = submittable.fixingRejected;
    } else {
      // ขั้นที่ 2: ส่งอะไรไม่ได้ตอนนี้ → ใช้ findOpenForYear (ไม่กรองวันที่) แบบเดิม
      // เพื่อให้รอบที่เจ้าหน้าที่ตั้งเปิดไว้ล่วงหน้าส่งกลับไปด้วย นักศึกษาจะได้เห็นว่า "จะเปิดวันที่ ..."
      // เดิมส่ง null หน้าจอขึ้นแค่ "ไม่มีรอบเปิด" ซึ่งไม่ได้บอกว่าต้องรอถึงเมื่อไหร่
      //
      // ความปลอดภัยไม่เปลี่ยน: ตอนรับผลสอบจริง examResults.controller ใช้ findSubmittableRound
      // ที่กรองวันที่อยู่ ส่งมาตอนยังไม่ถึงวันเปิดก็ถูกปฏิเสธอยู่ดี
      // ฝั่งหน้าจออ่าน phase เพื่อรู้ว่าตอนนี้กรอกได้จริงไหม (active เท่านั้นที่กรอกได้)
      round = await roundsRepo.findOpenForYear(student.academic_year);
    }
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
        // true = รอบนี้ปิดแล้ว แต่ใบของนักศึกษาถูกตีกลับ → แก้ส่งใหม่ได้ (ดู findSubmittableRound)
        can_fix_rejected: canFixRejected,
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
//
// missingSeconds = วินาทีที่เติมให้เมื่อผู้ใช้ระบุเวลาแค่ระดับนาที (datetime-local ไม่มีวินาที)
//   เปิดรับ: 09:00 → 09:00:00.000 (เริ่มต้นนาทีนั้น)
//   ปิดรับ:  23:59 → 23:59:59.999 (สิ้นสุดนาทีนั้น) — คนอ่าน "ปิดรับ 23:59" คือรับถึงสิ้นนาทีนั้น
//   ถ้าเก็บเป็น 23:59:00 นักศึกษาที่ส่งตอน 23:59:30 จะถูกปฏิเสธทั้งที่หน้าจอบอกว่ายังไม่ปิด
const parseThaiDateTime = (value, fieldLabel, defaultTime, missingSeconds = { s: 0, ms: 0 }) => {
  // ไม่ใส่ $ ท้าย regex ตั้งใจ: ค่าที่มีส่วนต่อท้าย เช่น "2026-08-09T14:30:00.000Z" (จาก toISOString())
  // ต้องยังรับได้ — เทสและสคริปต์เดิมส่งแบบนี้ ส่วน timezone ท้ายข้อความถูกอ่านเป็นเวลาไทยเสมอ
  // (หน้าเว็บส่งแบบไม่มี Z จึงไม่โดนเรื่องนี้) ถ้าจะบังคับห้ามมี Z ต้องแก้เทสเดิมพร้อมกัน
  const matched = String(value ?? "").match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!matched) throw httpError(`${fieldLabel} ไม่ถูกต้อง`, 400);

  const [, year, month, day, hour, minute, second] = matched;
  // วันที่ต้องมีอยู่จริงในปฏิทิน — ไม่งั้น 2026-02-31 จะถูก JavaScript เลื่อนเป็น 3 มี.ค. เงียบๆ
  const calendarCheck = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const dateExists =
    calendarCheck.getUTCFullYear() === Number(year) &&
    calendarCheck.getUTCMonth() === Number(month) - 1 &&
    calendarCheck.getUTCDate() === Number(day);
  if (!dateExists) throw httpError(`${fieldLabel} ไม่ถูกต้อง (ไม่มีวันที่นี้ในปฏิทิน)`, 400);
  if (hour !== undefined && (Number(hour) > 23 || Number(minute) > 59 || (second !== undefined && Number(second) > 59))) {
    throw httpError(`${fieldLabel} ไม่ถูกต้อง (เวลาไม่ถูกต้อง)`, 400);
  }
  // มีเวลาส่งมา → ใช้เวลานั้น. ไม่มี → ใช้ค่า default ของ field นั้น
  const time =
    hour !== undefined
      ? second !== undefined
        ? { h: Number(hour), m: Number(minute), s: Number(second), ms: 0 }
        : { h: Number(hour), m: Number(minute), ...missingSeconds }
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
  parseThaiDateTime(value, fieldLabel, END_OF_DAY, { s: 59, ms: 999 });

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

// ─── ปีการศึกษา / ครั้งที่สอบ ───────────────────────────
//
// เดิมแปลงด้วย Number() เฉยๆ แล้วเช็คว่า "มีค่าไหม" (!academic_year) — ปัญหา:
//   - ส่ง 0 มา → !0 เป็นจริง → ได้ข้อความ "กรอกไม่ครบ" ทั้งที่กรอกมาแล้ว (แค่ค่าผิด)
//   - ส่ง 2569.5 / -1 / 99 มา → ผ่านเข้าไปเป็นรอบปีแปลกๆ ที่ไม่มีนักศึกษารุ่นไหนเห็น
// จึงแยกเป็น 2 ขั้น: ว่างไหม (กรอกไม่ครบ) → ถ้าไม่ว่าง ค่าถูกรูปแบบไหม (บอกให้ชัดว่าผิดตรงไหน)
const YEAR_MIN = 2500;
const YEAR_MAX = 2700;

// ช่องนี้ "ไม่ได้กรอก" ไหม — ไม่ส่งมา / null / ข้อความว่าง
const isBlankValue = (value) => {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === "string" && value.trim() === "") {
    return true;
  }
  return false;
};

// แปลงเป็นจำนวนเต็ม — รับได้ทั้งตัวเลข (2569) และข้อความตัวเลขล้วน ("2569" จากช่องกรอกบนหน้าเว็บ)
// ค่าอื่น (ทศนิยม, ติดลบ, ข้อความปน, true/false) คืน NaN ให้ผู้เรียกปฏิเสธ
const toWholeNumber = (value) => {
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return value;
    }
    return NaN;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return NaN;
};

// ปีการศึกษา (พ.ศ.) ต้องเป็นจำนวนเต็ม 2500–2700
const parseAcademicYear = (value) => {
  const year = toWholeNumber(value);
  if (!Number.isInteger(year) || year < YEAR_MIN || year > YEAR_MAX) {
    throw httpError(
      `ปีการศึกษาต้องเป็นปี พ.ศ. ระหว่าง ${YEAR_MIN} ถึง ${YEAR_MAX} กรุณาตรวจสอบอีกครั้ง`,
      400,
    );
  }
  return year;
};

// ครั้งที่สอบต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป
const parseAttemptNumber = (value) => {
  const attempt = toWholeNumber(value);
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw httpError("ครั้งที่สอบต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป กรุณาตรวจสอบอีกครั้ง", 400);
  }
  return attempt;
};

// ชุดรหัสวิชา 2 ชุดเหมือนกันไหม (ไม่สนลำดับ) — ใช้ดูว่าเจ้าหน้าที่ "เปลี่ยนวิชา" จริงหรือแค่ส่งชุดเดิมกลับมา
const sameIdSet = (idsA, idsB) => {
  const a = [...new Set(idsA)];
  const b = [...new Set(idsB)];
  if (a.length !== b.length) {
    return false;
  }
  a.sort((x, y) => x - y);
  b.sort((x, y) => x - y);
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

// status ของรอบมีได้แค่ 2 ค่า: "open" (เปิดรับ) หรือ "closed" (ปิด) — ค่าอื่นห้ามลง DB
// ไม่ส่งมา (undefined) ถือว่าไม่ได้แก้ ปล่อยผ่าน
const ensureValidStatus = (status) => {
  if (status === undefined) return;
  if (status !== "open" && status !== "closed") {
    throw httpError('สถานะของรอบต้องเป็น "เปิดรับ" หรือ "ปิด" เท่านั้น', 400);
  }
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

// POST /rounds — ปุ่ม "สร้างรอบ": ตรวจวันที่/ปีการศึกษา/วิชา แล้วบันทึกรอบ
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

    if (
      isBlankValue(academic_year) ||
      isBlankValue(attempt_number) ||
      isBlankValue(open_date) ||
      isBlankValue(close_date)
    ) {
      throw httpError(
        "กรุณากรอกข้อมูลให้ครบ (ปีการศึกษา, ครั้งที่สอบ, วันที่เปิด-ปิดรับ)",
        400,
      );
    }
    // กรอกมาแล้ว แต่ค่าต้องถูกรูปแบบด้วย (0 / ทศนิยม / ปีนอกช่วง → บอกให้ชัดว่าผิดตรงไหน)
    const yearNumber = parseAcademicYear(academic_year);
    const attemptNumber = parseAttemptNumber(attempt_number);

    ensureValidStatus(status);
    await ensureNotDuplicate(yearNumber, attemptNumber);
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
      academic_year: yearNumber,
      attempt_number: attemptNumber,
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

// PUT /rounds/:id — แก้รอบ / เปิด-ปิดรอบ: ตรวจเหมือน create แล้วอัปเดตเฉพาะฟิลด์ที่ส่งมา
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

    ensureValidStatus(status);

    if (subject_ids !== undefined) {
      // เปิดรอบไปแล้วห้ามเปลี่ยนวิชา — นักศึกษาอาจกรอกไปแล้วตามรายการเดิม
      if (current.status === "open") {
        throw httpError("รอบนี้เปิดให้กรอกแล้ว แก้ไขรายวิชาไม่ได้ ต้องปิดรอบก่อน", 400);
      }
      const newSubjectIds = await validateSubjectIds(subject_ids);

      // วิชาที่รอบนี้ใช้อยู่ตอนนี้ (รอบเก่าที่ subject_ids ว่าง = ใช้ทุกวิชา — ดู subjectsOfRound)
      const allSubjects = await subjectsRepo.findAll();
      const currentSubjectIds = [];
      for (const subject of subjectsOfRound(current, allSubjects)) {
        currentSubjectIds.push(subject.subject_id);
      }

      // เปลี่ยนวิชาจริงเท่านั้นถึงต้องเช็ค — หน้าแก้ไขรอบส่งรายการวิชาชุดเดิมมาทุกครั้งที่กดบันทึก
      // (เช่น แค่เลื่อนวันปิด หรือกดเปิดรอบซ้ำ) ถ้าบล็อกทุกครั้งที่ส่งมา จะแก้วันที่ของรอบที่มีผลสอบไม่ได้เลย
      if (!sameIdSet(newSubjectIds, currentSubjectIds)) {
        // รอบที่มีผลสอบแล้วห้ามเปลี่ยนวิชา — ใบที่ส่งมาแล้วกรอกตามรายวิชาชุดเดิม
        // เปลี่ยนทีหลังสถิติรายวิชา/ผ่านครบ ของรอบนี้จะนับจากชุดวิชาที่ไม่ตรงกับใบจริง
        const resultCount = await roundsRepo.countExamResults(current.round_id);
        if (resultCount > 0) {
          throw httpError("รอบนี้มีผลสอบแล้ว แก้ไขรายวิชาไม่ได้", 409);
        }
        data.subject_ids = newSubjectIds;
      }
    }

    if (academic_year !== undefined) {
      data.academic_year = parseAcademicYear(academic_year);
    }
    if (attempt_number !== undefined) {
      data.attempt_number = parseAttemptNumber(attempt_number);
    }

    // แก้ปี/ครั้งที่ ต้องไม่ไปชนรอบอื่นที่มีอยู่ — ค่าที่ไม่ได้ส่งมาให้ใช้ของเดิม
    // ปี/ครั้งที่สอบเป็น "ตัวตน" ของรอบ — ถ้ามีผลสอบผูกอยู่แล้ว ห้ามเปลี่ยน
    // ไม่งั้นใบผลสอบของรุ่นหนึ่งจะย้ายไปอยู่อีกรุ่นทั้งก้อน หรือ "ผ่านครั้งแรก" สลับกับรอบอื่น
    let identityChanged = false;
    if (data.academic_year !== undefined && data.academic_year !== current.academic_year) {
      identityChanged = true;
    }
    if (data.attempt_number !== undefined && data.attempt_number !== current.attempt_number) {
      identityChanged = true;
    }
    if (identityChanged) {
      const resultCountForIdentity = await roundsRepo.countExamResults(current.round_id);
      if (resultCountForIdentity > 0) {
        throw httpError(
          "รอบนี้มีผลสอบแล้ว เปลี่ยนปีการศึกษาหรือครั้งที่สอบไม่ได้ (แก้ได้เฉพาะวันเปิด-ปิดรับ)",
          409,
        );
      }
    }

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

      // เปิดรอบเก่าซ้ำ ทั้งที่รอบที่ใหม่กว่าของรุ่นเดียวกันมีผลสอบแล้ว → ห้าม
      // เหตุผล: ใบรอบใหม่ยกวิชาที่ผ่านแล้วต่อมาจากรอบเก่า (carry-forward) ถ้าเปิดให้แก้ใบรอบเก่าได้อีก
      // ผลที่ยกไปแล้วในรอบใหม่จะไม่ตรงกับใบต้นทาง และลำดับ "ครั้งที่สอบ" ของสถิติผ่านครั้งแรก/ภายในปีแรกจะเพี้ยน
      // เช็คเฉพาะตอนเปลี่ยนจากปิด → เปิด (กดบันทึกรอบที่เปิดอยู่แล้วซ้ำ ไม่ใช่การเปิดซ้ำ)
      if (current.status !== "open") {
        let finalYear = current.academic_year;
        if (data.academic_year !== undefined) {
          finalYear = data.academic_year;
        }
        let finalAttempt = current.attempt_number;
        if (data.attempt_number !== undefined) {
          finalAttempt = data.attempt_number;
        }
        const newer = await roundsRepo.findNewerRoundWithResults(finalYear, finalAttempt);
        if (newer) {
          throw httpError("มีรอบที่ใหม่กว่ามีผลสอบแล้ว เปิดรอบเก่าซ้ำไม่ได้", 409);
        }
      }
    }

    // ใครแก้รอบนี้ล่าสุด เมื่อไหร่ (อ่านจาก JWT) — รวมถึงตอนกดเปิด/ปิดรอบ
    data.updated_by = req.user.userId;
    data.updated_at = new Date();
    const round = await roundsRepo.update(req.params.id, data);
    res.json({ success: true, data: withPhase(round) });
  } catch (err) {
    next(asDuplicateRoundError(err));
  }
};

// ลบรอบ — ต้องปิดแล้ว · ลบได้แม้มีผลสอบ/ประกาศผูกอยู่ (ลบตามไปด้วยทั้งหมด) แต่ต้อง "ยืนยันชัดเจน" (?delete_linked=true)
// ไม่งั้นตอบ 409 code has_linked_data พร้อมจำนวนผลสอบ/ประกาศ ให้หน้าจอขึ้นคำเตือนแล้วส่งมาใหม่พร้อมค่ายืนยัน
// — แบบเดียวกับลบนักศึกษา กันยิง API พลาด/คลิกผิดแล้วข้อมูลทั้งรอบหายเงียบๆ
// ลบเสร็จค่อยลบไฟล์บน disk (หลักฐาน + รูปประกาศ) (ลบไฟล์ก่อนแล้ว DB พัง = ไฟล์หายทั้งที่ข้อมูลยังอยู่)
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
    if (resultCount === 0 && newsCount === 0) {
      await roundsRepo.remove(round.round_id);
      return res.json({ success: true, data: null });
    }

    if (req.query.delete_linked !== "true") {
      const parts = [];
      if (resultCount > 0) parts.push(`ผลสอบของนักศึกษา ${resultCount} รายการ`);
      if (newsCount > 0) parts.push(`ประกาศ ${newsCount} รายการ`);
      return res.status(409).json({
        success: false,
        code: "has_linked_data",
        message: `รอบนี้มี${parts.join(" และ ")} — การลบจะลบทั้งหมดนี้ รวมผลรายวิชา เอกสารหลักฐาน ประวัติการตรวจ และรูปประกาศของรอบนี้ด้วย สถิติของรุ่นจะเปลี่ยนย้อนหลัง กรุณายืนยันอีกครั้ง`,
        result_count: resultCount,
        news_count: newsCount,
      });
    }

    const removed = await roundsRepo.removeCascade(round.round_id);
    await Promise.all(
      removed.filePaths.map((f) =>
        fs.rm(path.resolve(f), { force: true }).catch((e) => console.error("ลบไฟล์ไม่สำเร็จ:", f, e.message)),
      ),
    );
    // ลบผลสอบทั้งรอบ = กระทบสถิติย้อนหลัง ต้องมีร่องรอยใน log ของ server ว่าใครลบ
    console.warn(`[AUDIT] user ${req.user.userId} ลบรอบ ${round.round_id} (รอบที่ ${round.attempt_number}/${round.academic_year}) พร้อมผลสอบ ${removed.resultCount} รายการ ประกาศ ${removed.newsCount} รายการ`);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};
