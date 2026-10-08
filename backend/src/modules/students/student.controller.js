import fs from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";
import { readSheet } from "read-excel-file/node";
import * as studentRepo from "./student.repository.js";
import * as notifRepo from "../notifications/notifications.repository.js";
import { calcGraduationYear, validateGraduationYear, isBlankYear } from "../../utils/academicYear.js";

// สร้าง Error พร้อม statusCode ให้ errorHandler จัดการต่อ (ท่าเดียวกับ module อื่น)
const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const REQUIRED_COLUMNS = ["student_id", "national_id"];
const NATIONAL_ID_PATTERN = /^\d{13}$/;
// รหัสนักศึกษาต้องเป็นตัวเลขล้วน 10 หลักพอดี เช่น 6610210631 (เจ้าของงานยืนยัน 4 ต.ค. 2569) — 2 หลักแรกใช้คำนวณปีจบใน academicYear.js
// เดิมไม่ล็อกความยาว (รับ 2 หลักขึ้นไป) จึงมีรหัสสั้น/ยาวผิดๆ หลุดเข้าระบบได้ (เช่น รหัส 5 หลักไปได้ปีจบ 2516)
// ใช้ตัวเดียวกันทั้งเพิ่มทีละคน, นำเข้าไฟล์ และตรวจไฟล์ก่อนนำเข้า (dry run) กฎจะได้ตรงกันทุกทาง
const STUDENT_ID_PATTERN = /^\d{10}$/;
const STUDENT_ID_RULE_MESSAGE = "รหัสนักศึกษาต้องเป็นตัวเลข 10 หลัก เช่น 6610210631";
// รูปแบบที่ Excel แปลงเลขยาวให้ เช่น 1.23457E+12
const SCIENTIFIC_NOTATION_PATTERN = /^\d+(\.\d+)?e[+-]?\d+$/i;
const SALT_ROUNDS = 10;

// ตรวจข้อมูลโปรไฟล์ที่กรอกมือ (นักศึกษากรอกครั้งแรก + เจ้าหน้าที่แก้ทีหลัง) — ใช้ร่วมกัน 2 จุด กฎจะได้ไม่เพี้ยนกัน
// เดิมไม่ตรวจเลย: ชื่อเป็นช่องว่าง/ตัวเลข/ยาวเกิน column (VarChar 100/20) ผ่านเข้าไปได้ หรือพังเป็น 500
// requireAll = true ตอนกรอกครั้งแรก (ต้องครบ) · false ตอนแก้ (ตรวจเฉพาะ field ที่ส่งมา)
const PROFILE_TEXT_FIELDS = [
  ["first_name", "ชื่อ", 100],
  ["last_name", "นามสกุล", 100],
  ["first_name_en", "ชื่อภาษาอังกฤษ", 100],
  ["last_name_en", "นามสกุลภาษาอังกฤษ", 100],
  ["email", "อีเมล", 100],
  ["phone", "เบอร์โทร", 20],
];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+\-\s]{8,20}$/; // เลข + เครื่องหมาย + - และเว้นวรรค (เช่น +66 81-234-5678)

const cleanProfileInput = (body, requireAll) => {
  const out = {};
  for (const [field, label, max] of PROFILE_TEXT_FIELDS) {
    const value = body?.[field];
    if (value === undefined && !requireAll) continue;
    if (typeof value !== "string" || !value.trim()) {
      throw httpError(`กรุณากรอก${label}`, 400);
    }
    if (value.trim().length > max) {
      throw httpError(`${label}ยาวเกินไป (ไม่เกิน ${max} ตัวอักษร)`, 400);
    }
    out[field] = value.trim();
  }
  if (out.email && !EMAIL_PATTERN.test(out.email)) throw httpError("รูปแบบอีเมลไม่ถูกต้อง", 400);
  if (out.phone && !PHONE_PATTERN.test(out.phone)) throw httpError("เบอร์โทรไม่ถูกต้อง", 400);
  return out;
};

// GET /students — list นักศึกษาทั้งหมด (เจ้าหน้าที่/ผู้ช่วยตรวจ)
export const getAll = async (req, res, next) => {
  try {
    const students = await studentRepo.findAll();
    res.json({ success: true, data: students });
  } catch (err) {
    next(err);
  }
};

// GET /students/:id — รายคน; นักศึกษาดูได้แค่ของตัวเอง (403 ถ้าดูคนอื่น)
export const getById = async (req, res, next) => {
  try {
    // นักศึกษาดูได้แค่ข้อมูลตัวเอง — เจ้าหน้าที่/ผู้บริหารดูได้ทุกคน
    if (req.user.role === "student" && req.user.studentId !== req.params.id) {
      const err = new Error("ไม่มีสิทธิ์ดูข้อมูลของนักศึกษาคนอื่น");
      err.statusCode = 403;
      throw err;
    }

    const student = await studentRepo.findById(req.params.id);
    // ชื่อเจ้าหน้าที่ที่เปิดสิทธิ์เป็นข้อมูลภายในคณะ — นักศึกษาที่เปิดดูข้อมูลตัวเองไม่ต้องเห็น
    if (student && req.user.role === "student") {
      delete student.eligible_setter;
      delete student.eligible_set_by;
      delete student.eligible_set_at;
    }
    // ไม่เจอ = 404 ไม่ใช่ 200 + data:null — ฝั่งหน้าเว็บจะได้รู้ว่าไม่มีคนนี้จริง ไม่ใช่โหลดพลาด
    if (!student) {
      const err = new Error("ไม่พบนักศึกษา");
      err.statusCode = 404;
      throw err;
    }

    // 2 ค่านี้ไม่ได้อยู่ในตาราง — คำนวณให้ตอนส่งออก เพื่อให้หน้าแก้ข้อมูลรู้ว่า
    //   academic_year_derived = ปีที่ "ควรจะจบ" ตามรหัส (เอาไว้บอกว่าค่าปัจจุบันถูกแก้มือไปแล้ว)
    //   exam_result_count     = ส่งผลไปแล้วกี่ใบ (มากกว่า 0 = ย้ายรุ่นไม่ได้ ดู update())
    // คำนวณฝั่ง server ที่เดียว ฝั่งหน้าเว็บห้ามคิดสูตร +4 เอง ไม่งั้นแก้สูตรทีต้องตามแก้ 2 ที่
    const [derived, examResultCount] = await Promise.all([
      Promise.resolve(calcGraduationYear(student.student_id)),
      studentRepo.countExamResults(student.student_id),
    ]);

    res.json({
      success: true,
      data: {
        ...student,
        academic_year_derived: derived,
        exam_result_count: examResultCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

// เพิ่มนักศึกษาทีละคน (พิมพ์เอง) — ทางเลือกคู่กับ import CSV เวลามีแค่ 1-2 คน
// เจ้าหน้าที่กรอกรหัสนักศึกษา + เลขบัตร ปชช (+ ปีจบ ถ้าซ้ำชั้น/ลาพัก ไม่บังคับ)
// ชื่อ/ห้อง นักศึกษากรอกเองตอน login ครั้งแรก (complete-profile)
export const create = async (req, res, next) => {
  try {
    const { student_id, national_id, academic_year } = req.body;

    // ต้องเป็นข้อความ — เลขบัตรที่ส่งมาเป็นตัวเลขผ่าน regex ได้ แต่ bcrypt.hash รับแต่ข้อความ (จะพังเป็น 500)
    if (
      typeof student_id !== "string" ||
      typeof national_id !== "string" ||
      !student_id.trim() ||
      !national_id.trim()
    ) {
      const err = new Error("กรุณากรอกรหัสนักศึกษาและเลขบัตรประชาชน");
      err.statusCode = 400;
      throw err;
    }

    if (!NATIONAL_ID_PATTERN.test(national_id)) {
      const err = new Error("เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก");
      err.statusCode = 400;
      throw err;
    }

    if (!STUDENT_ID_PATTERN.test(student_id)) {
      const err = new Error(STUDENT_ID_RULE_MESSAGE);
      err.statusCode = 400;
      throw err;
    }

    // ปีจบไม่บังคับ — กฎเดียวกับ import CSV (validateGraduationYear)
    // เก็บเฉพาะตอนต่างจากสูตร ใส่เท่าสูตรพอดีผลเหมือนเว้นว่าง
    let importYear = null;
    if (!isBlankYear(academic_year)) {
      const checked = validateGraduationYear(academic_year, student_id);
      if (checked.error) {
        const err = new Error(checked.error);
        err.statusCode = 400;
        throw err;
      }
      if (checked.year !== calcGraduationYear(student_id)) importYear = checked.year;
    }

    const existing = await studentRepo.findByPsuId(student_id);
    if (existing) {
      const err = new Error("รหัสนักศึกษานี้มีอยู่ในระบบแล้ว");
      err.statusCode = 409;
      throw err;
    }

    const studentRole = await studentRepo.findRoleByName("student");
    if (!studentRole) {
      const err = new Error("ระบบยังไม่ได้ตั้งค่าข้อมูลพื้นฐาน (role)");
      err.statusCode = 500;
      throw err;
    }

    const user = await studentRepo.createFromImport({
      role_id: studentRole.role_id,
      psu_passport_id: student_id,
      password_hash: await bcrypt.hash(national_id, SALT_ROUNDS),
      import_academic_year: importYear,
    });

    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// นักศึกษากรอกโปรไฟล์ครั้งแรกหลัง login (บังคับผ่าน middleware ถ้ายังไม่มี student row)
// ปีการศึกษาที่จบตั้งฝั่ง server เท่านั้น — ไม่รับค่าจาก client (ปีจบคุมว่าเห็นรอบสอบไหน นักศึกษาห้ามตั้งเอง)
export const completeProfile = async (req, res, next) => {
  try {
    // authenticate แนบ req.user.studentId ไว้แล้ว — ถ้ามีค่าแปลว่ากรอกโปรไฟล์ไปแล้ว ห้ามกรอกซ้ำ
    if (req.user.studentId) {
      const err = new Error("กรอกโปรไฟล์ไปแล้ว");
      err.statusCode = 409;
      throw err;
    }

    const { room_id } = req.body;
    const { first_name, last_name, first_name_en, last_name_en, email, phone } =
      cleanProfileInput(req.body, true);
    if (!room_id) throw httpError("กรุณาเลือกห้องเรียน", 400);

    const room = await studentRepo.findRoomById(Number(room_id));
    if (!room) {
      const err = new Error("ไม่พบห้องเรียนที่เลือก");
      err.statusCode = 400;
      throw err;
    }

    const faculty = await studentRepo.findFaculty();
    if (!faculty) {
      const err = new Error("ระบบยังไม่ได้ตั้งค่าข้อมูลพื้นฐาน (faculty)");
      err.statusCode = 500;
      throw err;
    }

    // psu_passport_id ของนักศึกษา = student_id
    // ปีจบ: ใช้ปีที่เจ้าหน้าที่ระบุไว้ตอนนำเข้าก่อน (เคสซ้ำชั้น/ลาพัก) ไม่มีค่อยคำนวณจากรหัส (รหัส+4)
    // ?? = ถ้าฝั่งซ้ายเป็น null/undefined ให้ใช้ฝั่งขวา
    const student_id = req.user.username;
    const account = await studentRepo.findByPsuId(student_id);
    const academic_year = account?.import_academic_year ?? calcGraduationYear(student_id);

    const result = await studentRepo.completeProfile({
      user_id: req.user.userId,
      student_id,
      first_name,
      last_name,
      first_name_en,
      last_name_en,
      email,
      phone,
      faculty_id: faculty.faculty_id,
      room_id: room.room_id,
      academic_year,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// เจ้าหน้าที่แก้ข้อมูลนักศึกษาทีหลัง — แก้ได้ทุก field รวมปีการศึกษาจบ (เคสซ้ำชั้น/ลาพัก)
export const update = async (req, res, next) => {
  try {
    const existing = await studentRepo.findById(req.params.id);
    if (!existing) {
      const err = new Error("ไม่พบนักศึกษา");
      err.statusCode = 404;
      throw err;
    }

    const { room_id, academic_year } = req.body;
    const { first_name, last_name, first_name_en, last_name_en, email, phone } =
      cleanProfileInput(req.body, false);

    if (room_id !== undefined) {
      const room = await studentRepo.findRoomById(Number(room_id));
      if (!room) {
        const err = new Error("ไม่พบห้องเรียนที่เลือก");
        err.statusCode = 400;
        throw err;
      }
    }

    const userData = {};
    if (first_name !== undefined) userData.first_name = first_name;
    if (last_name !== undefined) userData.last_name = last_name;
    if (email !== undefined) userData.email = email;
    if (phone !== undefined) userData.phone = phone;

    const studentData = {};
    if (first_name_en !== undefined) studentData.first_name_en = first_name_en;
    if (last_name_en !== undefined) studentData.last_name_en = last_name_en;
    if (room_id !== undefined) studentData.room_id = Number(room_id);

    // เปลี่ยนปีจบ = ย้ายรุ่น — ตรวจเฉพาะตอนปีเปลี่ยนจริง — ฟอร์มแก้ไขส่งปีเดิมมาด้วยทุกครั้งแม้แก้แค่เบอร์โทร
    // ถ้าตรวจทุกครั้ง นักศึกษาเก่าที่ปีในระบบไม่ตรงสูตรปัจจุบันจะแก้ข้อมูลอะไรไม่ได้เลย
    // ("abc" → Number = NaN ซึ่งไม่เท่ากับปีเดิม จึงเข้าเงื่อนไขนี้และโดนตรวจเสมอ)
    if (academic_year !== undefined && Number(academic_year) !== existing.academic_year) {
      // 1) รูปแบบ — เดิมไม่ตรวจเลย ส่ง "abc" มา Prisma พังเป็น 500
      //    กฎเดียวกับตอน import: ห้ามน้อยกว่าปีตามรหัส (จับเคสพิมพ์ปีที่เข้าแทนปีที่จบ)
      const checked = validateGraduationYear(academic_year, existing.student_id);
      if (checked.error) {
        const err = new Error(checked.error);
        err.statusCode = 400;
        throw err;
      }

      // 2) ย้ายรุ่น (เคสซ้ำชั้น/ลาพัก) — ทำได้เฉพาะคนที่ยังไม่เคยส่งผลสอบเลย
      //
      // ทำไมต้องกัน: ใบผลสอบผูกกับ "รอบ" ไม่ได้ผูกกับ "รุ่นของนักศึกษา"
      // ถ้าย้ายคนที่ส่งผลไปแล้วออกจากรุ่น 2570 ไปรุ่น 2572 จะได้
      //   ตัวหาร (countStudentsByYear 2570) ลดลง 1 คน
      //   ตัวตั้ง (ใบในรอบของปี 2570)      เท่าเดิม
      // → fillRate/passRate ของรุ่น 2570 พุ่งเกิน 100% และไม่มีทางรู้ว่าเพี้ยนเพราะอะไร
      const resultCount = await studentRepo.countExamResults(req.params.id);
      if (resultCount > 0) {
        // ไม่บอกให้ "ลบผลสอบก่อน" เพราะระบบไม่มีทางลบผลสอบให้เจ้าหน้าที่ (ตั้งใจ — กันลบประวัติ)
        // บอกแค่เหตุผลพอ ไม่ชี้ทางที่ทำไม่ได้จริง
        const err = new Error(
          `เปลี่ยนปีการศึกษาที่จบไม่ได้ เพราะนักศึกษาคนนี้ส่งผลสอบไปแล้ว ${resultCount} ครั้ง — ` +
            `ถ้าย้ายรุ่นตอนนี้ สถิติของรุ่น ${existing.academic_year} จะเพี้ยน`,
        );
        err.statusCode = 400;
        throw err;
      }
      studentData.academic_year = checked.year;
    }

    const updated = await studentRepo.updateProfile(req.params.id, {
      user: userData,
      student: studentData,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// PATCH /students/bulk-eligible — เปิด/ปิดสิทธิ์กรอกผลสอบหลายคน; ต้องมี student_ids ไม่งั้น updateMany จะกวาดทั้งระบบ
export const bulkSetEligible = async (req, res, next) => {
  try {
    const { student_ids, exam_eligible } = req.body;

    // ต้องตรวจให้ครบก่อนส่งต่อ — repository ใช้ updateMany ซึ่งอันตรายถ้าเงื่อนไขหาย
    //
    // Prisma ตีความ `{ in: undefined }` ว่า "ไม่มีเงื่อนไขนี้" ไม่ใช่ "ไม่ตรงกับอะไรเลย"
    // → where กลายเป็นก้อนว่าง = เข้าเงื่อนไขทุกแถว
    // ถ้าปล่อยผ่าน คำขอที่ส่งมาแค่ {"exam_eligible": false} (ลืมใส่ student_ids)
    // จะปิดสิทธิ์กรอกผลสอบของนักศึกษา "ทั้งระบบ" ในคำสั่งเดียว โดยตอบ 200 เหมือนปกติ
    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      throw httpError("กรุณาเลือกนักศึกษาอย่างน้อย 1 คน", 400);
    }
    if (typeof exam_eligible !== "boolean") {
      throw httpError("กรุณาเลือกว่าต้องการเปิดหรือปิดสิทธิ์กรอกผลสอบ", 400);
    }
    if (student_ids.some((id) => typeof id !== "string" || !id.trim())) {
      throw httpError("รายชื่อนักศึกษาที่เลือกไม่ถูกต้อง กรุณารีเฟรชหน้าแล้วเลือกใหม่อีกครั้ง", 400);
    }

    const result = await studentRepo.bulkSetEligible(
      student_ids,
      exam_eligible,
      req.user.userId,
    );

    // แจ้งเตือนเฉพาะตอนเปิดสิทธิ์ — ปิดสิทธิ์ไม่ต้องแจ้ง ไม่ใช่ข่าวดีที่นักศึกษาต้องรู้ทันที
    if (exam_eligible && student_ids?.length) {
      // แจ้งเฉพาะรหัสที่มีจริง — รหัสปลอมปนแม้ตัวเดียว createMany จะล้มทั้งชุด คนที่มีจริงก็ไม่ได้รับแจ้ง
      studentRepo
        .findExistingStudentIds(student_ids)
        .then((realIds) => {
          if (realIds.length === 0) return null;
          return notifRepo.createMany(realIds, {
            type: "eligible",
            message: "เจ้าหน้าที่เปิดสิทธิ์ให้กรอกผลสอบแล้ว",
          });
        })
        .catch((e) => console.error("สร้างแจ้งเตือนไม่สำเร็จ:", e.message));
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// ─── จับคู่คอลัมน์ในไฟล์กับช่องที่ระบบต้องการ ───
// ชื่อคอลัมน์ที่เจ้าหน้าที่ตั้งเองไม่มีทางตรงกับ template ทุกตัว — Google Form ใช้ "ชื่อคำถาม" เป็นหัวคอลัมน์
// เช่น "student_id(รหัสนักศึกษา)" หรือ "กรุณากรอกเลขบัตรประชาชน" จะบังคับให้ตั้งชื่อตายตัวไม่ได้
// ลำดับ: 1) เจ้าหน้าที่เลือกเอง (mapping จากหน้าจอ)  2) ชื่อตรงเป๊ะ  3) ชื่อมี "คำสำคัญ" อยู่ข้างใน
//        4) ยังจับไม่ได้/กำกวม → ตอบกลับพร้อมรายชื่อคอลัมน์ ให้หน้าจอถามเจ้าหน้าที่ให้เลือกเอง
const COLUMN_FIELDS = ["student_id", "national_id", "academic_year"];
const COLUMN_KEYWORDS = {
  student_id: ["student_id", "studentid", "student_no", "student_number", "รหัสนักศึกษา", "รหัสนศ"],
  national_id: [
    "national_id", "nationalid", "id_card", "idcard", "citizen_id", "citizenid",
    "เลขบัตร", "เลขประจำตัวประชาชน", "บัตรประชาชน", "ปชช",
  ],
  // ปีจบเท่านั้น — "ปีการศึกษา" เฉยๆ รับเฉพาะตรงเป๊ะ (ดู EXACT_NAMES) เพราะ "ปีการศึกษาที่เข้า" คือปีเข้าเรียน
  // ถ้าจับคู่มั่วนักศึกษาจะเห็นรอบสอบของรุ่นผิดโดยไม่มีใครรู้
  // "จบ" คำเดียวครอบคลุม ปีจบ / ปีที่จบ / ปีการศึกษาที่จบ / ปีการศึกษา จบ / จบการศึกษา (ไม่ชนกับ "ปีที่เข้า")
  // ถ้ามีคอลัมน์ "จบ" มากกว่า 1 อัน guessColumns ถือว่ากำกวมและให้เจ้าหน้าที่เลือกเอง
  academic_year: ["academic_year", "academicyear", "graduation", "จบ"],
};
const EXACT_NAMES = { student_id: ["รหัส"], academic_year: ["ปีการศึกษา"] };
const normalizeHeader = (raw) => String(raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

// เดาจากชื่อหัว → { student_id: "หัวจริงในไฟล์" | null, ... }
// ช่องหนึ่งตรงกับหลายคอลัมน์ = กำกวม คืน null ให้เจ้าหน้าที่เลือกเอง (ดีกว่าเดาผิดเงียบๆ)
const guessColumns = (headers) => {
  const guess = {};
  const used = new Set();
  for (const field of COLUMN_FIELDS) {
    const exactNames = [field, ...(EXACT_NAMES[field] ?? [])];
    const exact = headers.filter((h) => exactNames.includes(normalizeHeader(h)));
    const matches = exact.length
      ? exact
      : headers.filter((h) => COLUMN_KEYWORDS[field].some((k) => normalizeHeader(h).includes(k)));
    const free = matches.filter((h) => !used.has(h));
    guess[field] = free.length === 1 ? free[0] : null;
    if (guess[field]) used.add(guess[field]);
  }
  return guess;
};

// รวมที่เดาได้ กับที่เจ้าหน้าที่เลือกเอง (เลือกเองชนะเสมอ) · requested[field] = "" = ไม่ใช้ช่องนี้ (ทำได้เฉพาะ academic_year)
const resolveColumns = (headers, requested) => {
  const mapping = guessColumns(headers);
  if (requested && typeof requested === "object") {
    for (const field of COLUMN_FIELDS) {
      const chosen = requested[field];
      if (chosen === undefined) continue;
      if (chosen === "" || chosen === null) {
        mapping[field] = null;
        continue;
      }
      if (!headers.includes(chosen)) throw httpError(`ไม่พบคอลัมน์ "${chosen}" ในไฟล์`, 400);
      mapping[field] = chosen;
    }
  }
  const picked = COLUMN_FIELDS.map((f) => mapping[f]).filter(Boolean);
  if (new Set(picked).size !== picked.length) {
    throw httpError("เลือกคอลัมน์ซ้ำกัน — 1 คอลัมน์ใช้ได้กับ 1 ช่องเท่านั้น", 400);
  }
  return mapping;
};

// multipart ส่ง mapping มาเป็นข้อความ JSON: {"student_id":"หัวคอลัมน์", ...}
const parseMappingParam = (raw) => {
  if (raw === undefined || raw === "") return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    // ตกไปข้างล่าง
  }
  throw httpError("รูปแบบการเลือกคอลัมน์ไม่ถูกต้อง", 400);
};

// ตัวเลขที่โปรแกรมตารางคำนวณเขียนมาเป็นข้อความรูปแปลก → ตัวเลขล้วน
//   "1412.0"            → "1412"        (Google Sheets เขียนตัวเลขในไฟล์ .xlsx เป็นทศนิยม .0)
//   "6.610210001E9"     → "6610210001"  (Sheets เขียนเลขยาวเป็น E-notation แต่ครบทุกหลัก)
//
// แปลงเฉพาะเมื่อตัวเลขหลังจุดทศนิยม "ครบตามเลขชี้กำลังพอดี" (ไม่มีหลักไหนหายไป) และ **ไม่เติม 0 ให้เด็ดขาด**
//   "1.23457E+12" (Excel เขียน CSV — หายไปแล้ว) และ "1.9299E12" ต้องถูกปฏิเสธ ไม่ใช่เดาเป็น 1234570000000
//   เหตุผล: ไฟล์ที่เคยเป็น CSV แล้วเปิดใน Excel บันทึกเป็น .xlsx จะได้เซลล์ตัวเลข 1234570000000 หน้าตาเหมือนเลขจริงทุกอย่าง
//   แยกไม่ออกว่าเลขเต็มหรือหายไปแล้ว — เดาผิด = เลขบัตร (ซึ่งเป็นรหัสผ่าน) ผิดคนเงียบๆ
const plainNumberText = (text) => {
  if (typeof text !== "string") return text;
  const t = text.trim();
  if (/^\d+\.0+$/.test(t)) return t.replace(/\.0+$/, "");
  const m = t.match(/^(\d+)\.(\d+)e\+?(\d+)$/i);
  if (m && m[2].length === Number(m[3])) return m[1] + m[2];
  return t;
};

// รหัสนักศึกษา/เลขบัตรที่คนกรอกเอง (เช่น Google Form / พิมพ์ใน Excel) มาได้หลายรูปแบบ:
//   "1-9299-00326-09-1" / "1 9299 00326 09 1" / "1.9299.00326.09.1" / "'1929900326091" (เครื่องหมาย ' ที่ Excel ใช้บังคับเป็นข้อความ)
//   / "๑๙๒๙๙๐๐๓๒๖๐๙๑" (เลขไทย) / "１９２９…" (เลขเต็มความกว้าง) / "1929900326091.0" / มีช่องว่างหรืออักขระล่องหนติดมา
// ทุกแบบต้องเหลือ "ตัวเลขล้วน" — ตัดเฉพาะสัญลักษณ์/เครื่องหมาย/ช่องว่าง ไม่เดาตัวเลขเอง
// ตัวอักษร (ก-ฮ, a-z) ไม่ตัดทิ้ง ปล่อยให้ด่านตรวจ /^\d{13}$/ ปฏิเสธ — "abc123" ไม่ควรกลายเป็น "123" เงียบๆ
const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
const cleanIdText = (value) => {
  if (typeof value !== "string") return value;
  const asArabic = value
    .trim()
    .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
    .replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - 0xff10));
  // แปลงรูปแบบตัวเลขของ Excel (".0" ท้ายเลข) ก่อนตัดสัญลักษณ์ — ถ้าตัด "." ก่อน 1929900326091.0 จะกลายเป็น 14 หลัก
  const plain = plainNumberText(asArabic);
  // 1.23457E+12 = เลขหายไปแล้ว ส่งต่อทั้งอย่างนั้นเพื่อให้ผู้เรียกบอกสาเหตุว่าเป็นเพราะ Excel (ห้ามตัด "." "+" ทิ้ง ไม่งั้นเหลือแค่ 12345712)
  if (SCIENTIFIC_NOTATION_PATTERN.test(plain)) return plain;
  // เก็บเฉพาะตัวอักษรกับตัวเลข ทิ้งที่เหลือ (ขีด ช่องว่าง จุด ' " , / ช่องว่างล่องหน ฯลฯ)
  return plain.replace(/[^\p{L}\p{N}]/gu, "");
};

// ไฟล์ .xlsx คือ zip ขึ้นต้นด้วย "PK" — เช็คจากเนื้อไฟล์ ไม่เชื่อนามสกุล/mimetype ที่ client ส่งมา
const isXlsxFile = (buffer) => buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;

// อ่านรายชื่อจาก CSV -> array ของ object (key = ชื่อคอลัมน์ตัวเล็ก)
const rowsFromCsv = (buffer) => {
  let csvText;
  try {
    csvText = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    csvText = iconv.decode(buffer, "win874");
  }

  // csv-parse แปลง text → array of object โดยใช้แถวแรกเป็นชื่อ column (columns:true)
  let rows;
  try {
    rows = parse(csvText, {
      // ชื่อคอลัมน์: ตัดช่องว่าง + แปลงเป็นตัวเล็ก — "Student_ID" / " national_id" จาก Excel ก็อ่านได้
      columns: (header) => header.map((h) => String(h ?? "").trim()),
      // Excel ที่ตั้งภาษา/ภูมิภาคบางแบบ save CSV คั่นด้วย ; หรือ tab แทน , — รับทั้งสามแบบ
      delimiter: [",", ";", "\t"],
      skip_empty_lines: true,
      // Excel มักทิ้งแถวที่มีแต่ , ว่างๆ ท้ายไฟล์ (",,") — skip_empty_lines ไม่ถือว่าว่าง ต้องข้ามด้วยตัวนี้
      skip_records_with_empty_values: true,
      trim: true, // ตัดช่องว่างหัว-ท้ายทุกฟิลด์ กัน " 6610210631" มาจาก copy-paste
      bom: true, // เผื่อยังเหลือ BOM ติดมาในสตริง
      // บางแถวมีคอลัมน์มากหรือน้อยกว่าหัวตาราง (เช่น มีหมายเหตุพิมพ์เกินมาท้ายแถว / ช่องท้ายแถวหาย)
      // ค่าปกติของ csv-parse คือปฏิเสธทั้งไฟล์ — เปิดตัวนี้ให้อ่านต่อได้: ช่องเกินถูกทิ้ง ช่องที่หายเป็นค่าว่าง
      // แถวที่ข้อมูลไม่ครบจะถูกข้ามพร้อมเหตุผลในด่านตรวจแถวข้างล่างเอง ไม่ทำให้แถวอื่นล้มไปด้วย
      relax_column_count: true,
    });
  } catch (parseErr) {
    // ข้อความของ csv-parse เป็นภาษาอังกฤษเชิงเทคนิค (เช่น "Quote Not Closed") — เก็บไว้ใน log ฝั่ง server
    // แล้วบอกผู้ใช้เป็นภาษาไทยว่าต้องทำอะไรต่อแทน
    console.error("อ่านไฟล์ CSV ไม่ได้:", parseErr.message);
    const err = new Error(
      "อ่านไฟล์ CSV ไม่ได้ อาจมีเครื่องหมายคำพูดไม่ครบคู่หรือรูปแบบไฟล์ผิด กรุณาบันทึกไฟล์ใหม่เป็น CSV หรืออัปโหลดไฟล์ Excel (.xlsx) แทน",
    );
    err.statusCode = 400;
    throw err;
  }
  return rows;
};

// อ่านรายชื่อจากไฟล์ Excel (.xlsx) ตรงๆ — เจ้าหน้าที่ไม่ต้อง "บันทึกเป็น CSV"
//
// ทำไมต้องมี: เลขบัตร 13 หลักใน Excel ทั่วไปแสดงเป็น 1.23457E+12 และ **ตอนบันทึกเป็น CSV Excel เขียนตามที่แสดง**
// ตัวเลขหลังหลักที่ 6 หายไปจริง ระบบกู้กลับไม่ได้ (เดาเลขเองแล้วผิดคน = รหัสผ่านและตัวตนนักศึกษาผิดเงียบๆ)
// แต่ไฟล์ .xlsx เก็บเลขเต็ม 13 หลักไว้ครบ แค่ "แสดง" ย่อ — อ่าน .xlsx ตรงๆ จึงไม่มีปัญหานี้เลย
//
// อ่านชีตแรกเท่านั้น · parseNumber: (s) => s = เอาตัวเลขเป็น "ข้อความตามที่เก็บในไฟล์" ไม่ผ่าน float ให้เพี้ยน
const rowsFromXlsx = async (buffer) => {
  let sheet;
  try {
    sheet = await readSheet(buffer, { parseNumber: (text) => text });
  } catch {
    throw httpError("อ่านไฟล์ Excel ไม่ได้ กรุณาตรวจสอบว่าเป็นไฟล์ .xlsx ที่ไม่เสียหาย", 400);
  }
  if (!sheet || sheet.length === 0) return [];

  const [header, ...body] = sheet;
  const names = header.map((h) => String(h ?? "").trim());
  // ค่าในเซลล์ -> ข้อความ (วันที่/ว่าง = ข้อความว่าง ให้ด่านตรวจแถวด้านล่างตีเป็น "ข้อมูลไม่ครบ" เอง)
  const cellText = (v) => {
    if (v === null || v === undefined || v instanceof Date) return "";
    const text = String(v).trim();
    // Google Sheets เขียนตัวเลขเป็น "1412.0" / "6.610210001E9" — แปลงกลับเป็นตัวเลขล้วน (ดู plainNumberText)
    return plainNumberText(text);
  };

  return body
    .filter((cells) => cells.some((c) => cellText(c) !== "")) // ข้ามแถวว่างท้ายไฟล์
    .map((cells) => {
      const row = {};
      names.forEach((name, i) => {
        if (name) row[name] = cellText(cells[i]);
      });
      return row;
    });
};

// นำเข้ารายชื่อนักศึกษาจากไฟล์ CSV — สร้าง user(ยังไม่มี password)+student พร้อมกันทีละแถว
// แถวที่พลาด (ซ้ำ/ห้องไม่มี/ข้อมูลขาด) จะถูกข้ามและรายงานกลับ ไม่ทำให้แถวอื่นล้มไปด้วย
export const bulkImport = async (req, res, next) => {
  try {
    // ?dry_run=true = ตรวจไฟล์อย่างเดียว ไม่บันทึกอะไรลง DB
    // หน้าเว็บใช้ทำกล่องสรุป "จะนำเข้ากี่คน / ข้ามกี่คน / ใครปีจบไม่ตรงกับรหัส" ก่อนให้กดยืนยันจริง
    // ค่าจาก query string เป็นข้อความเสมอ ("true" ไม่ใช่ true) เลยต้องเทียบกับ "true"
    const dryRun = req.query.dry_run === "true";

    // multer (memoryStorage) แปะไฟล์ที่ officer อัปโหลดไว้ที่ req.file.buffer — ยังไม่เขียนลง disk
    if (!req.file) {
      const err = new Error("กรุณาแนบไฟล์ CSV หรือ Excel (.xlsx)");
      err.statusCode = 400;
      throw err;
    }

    // ไฟล์ CSV ภาษาไทยมาได้หลาย encoding แล้วแต่โปรแกรมที่ officer ใช้ save:
    // - Excel "CSV UTF-8"        → UTF-8 มี BOM
    // - Excel "CSV" ธรรมดา (ไทย) → ANSI/Windows-874 (ไม่มี BOM)
    // - Google Sheets/Notepad     → UTF-8 ไม่มี BOM
    // เดาจาก "มี BOM ไหม" อย่างเดียวไม่พอ (เคสสุดท้ายไม่มี BOM แต่ก็เป็น UTF-8) —
    // เลยต้อง "ลองถอดเป็น UTF-8 จริงๆ" ก่อน ถ้า byte ไม่ตรงกฎ UTF-8 (fatal: true จะ throw)
    // ค่อยถือว่าเป็น win874 แล้ว decode แบบนั้นแทน
    const rows = isXlsxFile(req.file.buffer)
      ? await rowsFromXlsx(req.file.buffer)
      : rowsFromCsv(req.file.buffer);

    if (rows.length === 0) {
      const err = new Error("ไฟล์ไม่มีข้อมูล");
      err.statusCode = 400;
      throw err;
    }

    // เช็ค header ให้ครบก่อนวนลูป — กันเสีย request DB ทั้งไฟล์เพราะ column พิมพ์ผิด
    const headers = Object.keys(rows[0]);
    const mapping = resolveColumns(headers, parseMappingParam(req.body?.mapping));
    const missingCols = REQUIRED_COLUMNS.filter((c) => !mapping[c]);
    if (missingCols.length > 0) {
      // ตอบเป็น JSON เองพร้อมรายชื่อคอลัมน์ในไฟล์ — หน้าจอเอาไปทำช่อง "เลือกว่าคอลัมน์ไหนคืออะไร" ให้เจ้าหน้าที่
      return res.status(400).json({
        success: false,
        code: "missing_columns",
        message: `ไฟล์ขาดคอลัมน์: ${missingCols.join(", ")} (คอลัมน์ที่พบในไฟล์: ${headers.join(", ")})`,
        columns: headers,
        mapping,
        missing: missingCols,
      });
    }

    // ทุกแถวใช้ role เดียวกัน — ดึงครั้งเดียวนอกลูปพอ
    const studentRole = await studentRepo.findRoleByName("student");
    if (!studentRole) {
      const err = new Error("ระบบยังไม่ได้ตั้งค่าข้อมูลพื้นฐาน (role)");
      err.statusCode = 500;
      throw err;
    }

    const imported = [];
    const skipped = [];
    // คนที่เจ้าหน้าที่ใส่ปีจบมาไม่ตรงกับที่คำนวณจากรหัส (ซ้ำชั้น/ลาพัก) — ให้หน้าเว็บโชว์ให้ตรวจอีกรอบ
    // ใส่ปีเท่ากับสูตรพอดีไม่นับ เพราะผลเหมือนเว้นว่าง
    const yearOverrides = [];
    // รหัสที่เจอมาแล้วในไฟล์นี้ (เก็บเลขแถวแรกที่เจอ) — จับแถวซ้ำกันเองในไฟล์
    // dry run ไม่ได้เขียน DB จึงเช็คซ้ำจาก DB ไม่ได้ ถ้าไม่มีอันนี้ใบตรวจจะบอกว่านำเข้าได้ทั้งคู่ แต่ตอนนำเข้าจริงเข้าแค่คนเดียว
    const seenInFile = new Map();
    // ทำทีละแถว ไม่ใช้ transaction เดียวรวมทั้งไฟล์ — กันไฟล์ 500 แถวพังหมดเพราะแถวเดียวพลาด
    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // +1 เพราะแถวแรกคือ header, +1 เพราะนับแบบ 1-indexed ให้ตรงกับที่เห็นใน Excel
      const row = rows[i];
      // academic_year เป็นคอลัมน์ไม่บังคับ — ไฟล์เก่าที่ไม่มีคอลัมน์นี้ก็ได้ undefined ถือว่าเว้นว่าง
      // ผ่าน cleanIdText เหมือนรหัส/เลขบัตร — ปีที่พิมพ์เป็นเลขไทย (๒๕๖๙) หรือเลขเต็มความกว้างต้องอ่านได้เหมือนกัน
      // เดิมใช้แค่ plainNumberText → "๒๕๖๙" ถูกปฏิเสธว่า "ต้องเป็นตัวเลข พ.ศ. 4 หลัก" ทั้งที่เป็นปีที่ถูกต้อง
      let academic_year = undefined;
      if (mapping.academic_year) {
        academic_year = plainNumberText(cleanIdText(row[mapping.academic_year]));
      }
      // ตัดช่องว่างซ้ำอีกชั้น — csv-parse ไม่ตัดช่องว่างที่อยู่ในเครื่องหมายคำพูด (เช่น "1234567890123 ")
      const student_id = plainNumberText(cleanIdText(row[mapping.student_id]));
      const national_id = plainNumberText(cleanIdText(row[mapping.national_id]));

      // validate ฟิลด์บังคับต่อแถว — ขาดฟิลด์ไหนก็ข้ามแถวนั้น ไม่ทำให้ทั้งไฟล์ล้ม
      if (!student_id || !national_id) {
        skipped.push({ row: rowNum, student_id, reason: "ข้อมูลไม่ครบ" });
        continue;
      }

      if (!NATIONAL_ID_PATTERN.test(national_id)) {
        // Excel เก็บเลข 13 หลักเป็น "1.23457E+12" ถ้าคอลัมน์ไม่ได้ตั้งเป็น Text แล้วตัวเลขจริงหายไปแล้ว กู้คืนไม่ได้
        // บอกสาเหตุตรงๆ ไม่งั้นเจ้าหน้าที่เห็นแค่ "ต้องเป็นตัวเลข 13 หลัก" ทั้งที่ในช่อง Excel ดูเป็นตัวเลขอยู่
        const looksLikeExcelSci = SCIENTIFIC_NOTATION_PATTERN.test(national_id);
        skipped.push({
          row: rowNum,
          student_id,
          reason: looksLikeExcelSci
            ? "เลขบัตรประชาชนถูก Excel แปลงเป็นรูปแบบวิทยาศาสตร์ (เช่น 1.23E+12) เลขหายไปแล้วในไฟล์ CSV — อัปโหลดไฟล์ Excel (.xlsx) ต้นฉบับแทน (ไม่ต้องบันทึกเป็น CSV) หรือกรอกเลขใหม่"
            : "เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก",
        });
        continue;
      }

      if (!STUDENT_ID_PATTERN.test(student_id)) {
        skipped.push({
          row: rowNum,
          student_id,
          reason: STUDENT_ID_RULE_MESSAGE,
        });
        continue;
      }

      // รหัสซ้ำในไฟล์เดียวกัน — เอาแถวแรก ข้ามแถวหลัง (ตรงกับที่นำเข้าจริงจะเกิดอยู่แล้ว แต่ต้องบอกตั้งแต่ขั้นตรวจไฟล์)
      if (seenInFile.has(student_id)) {
        skipped.push({
          row: rowNum,
          student_id,
          reason: `รหัสนักศึกษาซ้ำกับแถว ${seenInFile.get(student_id)} ในไฟล์เดียวกัน`,
        });
        continue;
      }
      seenInFile.set(student_id, rowNum);

      // ปีจบ: เว้นว่าง = ใช้สูตรรหัส+4 ตอนกรอกโปรไฟล์ · ใส่มา = ตรวจก่อน ผิดก็ข้ามแถวนี้พร้อมเหตุผล
      let importYear = null;
      if (!isBlankYear(academic_year)) {
        const checked = validateGraduationYear(academic_year, student_id);
        if (checked.error) {
          skipped.push({ row: rowNum, student_id, reason: checked.error });
          continue;
        }
        const derived = calcGraduationYear(student_id);
        // เก็บเฉพาะตอนต่างจากสูตร — คอลัมน์นี้จะได้แปลว่า "เจ้าหน้าที่แก้ปีให้คนนี้" ตรงตัว
        if (checked.year !== derived) {
          importYear = checked.year;
          yearOverrides.push({ row: rowNum, student_id, derived, academic_year: checked.year });
        }
      }

      // กัน import ซ้ำ — ถ้า student_id นี้มี user อยู่แล้วในระบบ ข้ามไปเลย (ไม่ทับข้อมูลเดิม)
      const existing = await studentRepo.findByPsuId(student_id);
      if (existing) {
        skipped.push({ row: rowNum, student_id, reason: "มีในระบบแล้ว" });
        continue;
      }

      // dry run: ผ่านทุกด่านแล้ว = "จะนำเข้าได้" นับไว้เฉยๆ ไม่สร้างจริง
      if (dryRun) {
        imported.push(student_id);
        continue;
      }

      try {
        // สร้างแค่ user — รหัสผ่าน = hash(เลขบัตร ปชช) เข้าระบบได้ทันที ไม่ต้องผ่าน first-setup
        // student row จะถูกสร้างตอนนักศึกษากรอกโปรไฟล์เอง (complete-profile) หลัง login ครั้งแรก
        await studentRepo.createFromImport({
          role_id: studentRole.role_id,
          psu_passport_id: student_id,
          password_hash: await bcrypt.hash(national_id, SALT_ROUNDS),
          import_academic_year: importYear,
        });
        imported.push(student_id);
      } catch (createErr) {
        // เผื่อ DB error ที่เช็คไม่ทันข้างบน (เช่น race condition ซ้ำกันพอดี) — ยังคงเดินหน้าแถวถัดไป
        skipped.push({
          row: rowNum,
          student_id,
          reason: "บันทึกไม่สำเร็จ",
        });
      }
    }

    // คนที่ปีไม่ตรงแต่สุดท้ายถูกข้าม (เช่น มีในระบบแล้ว) ไม่ได้นำเข้าจริง — ตัดออก ไม่งั้นกล่องสรุปนับเกิน
    const importedSet = new Set(imported);
    const overridesKept = yearOverrides.filter((o) => importedSet.has(o.student_id));

    // สรุปผล import กลับไปให้หน้า officer แสดง — เห็นทั้งที่สำเร็จและที่ต้องแก้ไฟล์แล้วอัปใหม่
    // dry run ตอบ 200 (ไม่ได้สร้างอะไร) · นำเข้าจริงตอบ 201 (สร้างแล้ว)
    res.status(dryRun ? 200 : 201).json({
      success: true,
      data: {
        dry_run: dryRun,
        imported_count: imported.length,
        skipped_count: skipped.length,
        imported,
        skipped,
        year_overrides: overridesKept,
        columns_used: mapping, // คอลัมน์ในไฟล์ที่ถูกใช้เป็น student_id / national_id / academic_year (null = ไม่มี)
      },
    });
  } catch (err) {
    next(err);
  }
};

// ลบนักศึกษา (หลายคนได้) พร้อมทุกอย่างที่ผูกอยู่ — ใช้ร่วมกันทั้งลบทีละคนและลบหลายคน กฎจะได้ไม่เพี้ยนกัน
//
// คนที่มีผลสอบแล้วลบได้ แต่ต้อง "ยืนยันชัดเจน" (confirmDeleteResults = true) ไม่งั้นตอบ 409 code has_exam_results พร้อมจำนวน
// ให้หน้าจอขึ้นคำเตือนแล้วส่งมาใหม่พร้อมค่ายืนยัน — กันยิง API พลาด/คลิกลบผิดคนแล้วผลสอบทั้งชุดหายเงียบๆ
// ลบเสร็จค่อยลบไฟล์ PDF บน disk (ลบไฟล์ก่อนแล้ว DB พัง = หลักฐานหายทั้งที่ข้อมูลยังอยู่)
const deleteStudents = async (res, ids, confirmDeleteResults) => {
  const { studentsWithResults, resultCount } = await studentRepo.summarizeResults(ids);
  if (studentsWithResults > 0 && confirmDeleteResults !== true) {
    return res.status(409).json({
      success: false,
      code: "has_exam_results",
      message: `นักศึกษา ${studentsWithResults} คนมีผลสอบในระบบแล้ว (${resultCount} รอบ) — การลบจะลบผลสอบ เอกสารหลักฐาน และประวัติการตรวจทั้งหมดของเขาด้วย และสถิติของรุ่นจะเปลี่ยนย้อนหลัง กรุณายืนยันอีกครั้ง`,
      students_with_results: studentsWithResults,
      result_count: resultCount,
    });
  }

  const { deletedIds, resultCount: deletedResults, filePaths } = await studentRepo.removeStudentsCascade(ids);
  if (deletedIds.length === 0) throw httpError("ไม่พบนักศึกษาที่เลือกในระบบ (อาจถูกลบไปแล้ว)", 404);

  await Promise.all(
    filePaths.map((f) => fs.rm(path.resolve(f), { force: true }).catch((e) => console.error("ลบไฟล์ไม่สำเร็จ:", f, e.message))),
  );
  // ลบของคนที่มีผลสอบ = การกระทำที่กระทบสถิติย้อนหลัง ต้องมีร่องรอยใน log ของ server ว่าใครลบ
  if (deletedResults > 0) {
    console.warn(`[AUDIT] user ${res.req.user.userId} ลบนักศึกษา ${deletedIds.length} คน พร้อมผลสอบ ${deletedResults} รอบ: ${deletedIds.join(",")}`);
  }
  return { deletedIds, deletedResults };
};

// ลบนักศึกษาหลายคนพร้อมกัน (ติ๊กเลือกในหน้ารายชื่อ) — body { student_ids: [...], delete_results?: true }
export const bulkRemove = async (req, res, next) => {
  try {
    const ids = req.body?.student_ids;
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.some((id) => typeof id !== "string" || !id.trim())
    ) {
      throw httpError("กรุณาเลือกนักศึกษาอย่างน้อย 1 คน", 400);
    }
    if (ids.length > MAX_BULK_DELETE) {
      throw httpError(`ลบได้ครั้งละไม่เกิน ${MAX_BULK_DELETE} คน`, 400);
    }

    const unique = [...new Set(ids.map((id) => id.trim()))];
    const done = await deleteStudents(res, unique, req.body?.delete_results);
    if (!done) return; // deleteStudents ตอบ 409 (ต้องยืนยัน) ไปแล้ว
    res.json({
      success: true,
      data: {
        deleted_count: done.deletedIds.length,
        deleted_ids: done.deletedIds,
        deleted_result_count: done.deletedResults,
        not_found_count: unique.length - done.deletedIds.length, // รหัสที่ไม่มีในระบบ (ถูกลบไปก่อนแล้ว)
      },
    });
  } catch (err) {
    next(err);
  }
};

// รายชื่อบัญชีที่ import แล้วยังไม่กรอกโปรไฟล์ — ไว้ตรวจว่า import ถูกไหม / ลบรหัสที่พิมพ์ผิด
export const listPendingAccounts = async (req, res, next) => {
  try {
    const rows = await studentRepo.findPendingAccounts();
    res.json({
      success: true,
      data: rows.map((u) => ({
        student_id: u.psu_passport_id,
        // ปีจบที่จะใช้ตอนกรอกโปรไฟล์: ที่เจ้าหน้าที่ระบุตอน import ก่อน ไม่มีค่อยคำนวณจากรหัส (เหมือน completeProfile)
        academic_year: u.import_academic_year ?? calcGraduationYear(u.psu_passport_id),
        year_overridden: u.import_academic_year !== null,
        imported_at: u.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// ลบบัญชีที่ยังไม่กรอกโปรไฟล์ — body { student_ids: ["6610210001", ...] } (ส่งคนเดียวก็ใส่ array 1 ตัว)
// ลบเฉพาะบัญชีที่ยังไม่มีโปรไฟล์จริง (repository กันไว้ใน where) คนที่กรอกแล้วจะไม่ถูกแตะ — นับแยกให้ดูว่าข้ามกี่คน
const MAX_BULK_DELETE = 1000;
// POST /students/pending-accounts/delete — ลบบัญชีที่ import แล้วยังไม่เคย login (จำกัดจำนวนต่อครั้ง)
export const removePendingAccounts = async (req, res, next) => {
  try {
    const ids = req.body?.student_ids;
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.some((id) => typeof id !== "string" || !id.trim())
    ) {
      throw httpError("กรุณาเลือกนักศึกษาอย่างน้อย 1 คน", 400);
    }
    if (ids.length > MAX_BULK_DELETE) {
      throw httpError(`ลบได้ครั้งละไม่เกิน ${MAX_BULK_DELETE} คน`, 400);
    }

    const unique = [...new Set(ids.map((id) => id.trim()))];
    const { count } = await studentRepo.removePendingAccounts(unique);
    if (count === 0) {
      throw httpError("ไม่พบบัญชีที่ลบได้ — อาจกรอกโปรไฟล์ไปแล้ว หรือถูกลบไปก่อนหน้านี้", 404);
    }
    res.json({
      success: true,
      data: { deleted_count: count, skipped_count: unique.length - count },
    });
  } catch (err) {
    next(err);
  }
};

// เจ้าหน้าที่ลบนักศึกษาที่ import ผิด/ซ้ำ/ไม่ได้อยู่รุ่นนี้
// ลบได้เฉพาะคนที่ยังไม่มีผลสอบเลย — ถ้ามีแล้วต้องไม่ลบ ไม่งั้นสถิติของปีนั้นเปลี่ยนย้อนหลัง
// ไม่ตรงกับรายงานที่ส่งสภาการพยาบาลไปแล้ว
export const remove = async (req, res, next) => {
  try {
    const student = await studentRepo.findById(req.params.id);
    if (!student) throw httpError("ไม่พบนักศึกษา", 404);

    // ?delete_results=true = ยืนยันแล้วว่าให้ลบผลสอบทั้งหมดของเขาด้วย (ไม่ใส่ + มีผลสอบ = 409 พร้อมจำนวน)
    const done = await deleteStudents(res, [req.params.id], req.query.delete_results === "true");
    if (!done) return;
    res.json({
      success: true,
      data: {
        message: `ลบนักศึกษา ${req.params.id} ออกจากระบบแล้ว`,
        deleted_result_count: done.deletedResults,
      },
    });
  } catch (err) {
    next(err);
  }
};

// เจ้าหน้าที่ "รีเซ็ต" รหัสผ่านนักศึกษา = กรอกเลขบัตร ปชช เดิมซ้ำ (แก้ตอนพิมพ์ผิดตอน import/สงสัยโดนสวมสิทธิ์)
// password ของนักศึกษา = hash(เลขบัตร ปชช) เสมอ ไม่มีรหัสชั่วคราว ไม่บังคับเปลี่ยนรหัสแบบ officer/executive
export const resetPassword = async (req, res, next) => {
  try {
    const student = await studentRepo.findById(req.params.id);
    if (!student) {
      const err = new Error("ไม่พบนักศึกษา");
      err.statusCode = 404;
      throw err;
    }

    const { national_id } = req.body;
    // ต้องเป็นข้อความ — ตัวเลข 13 หลักผ่าน regex ได้ (JS แปลงเป็นข้อความให้) แต่ bcrypt.hash รับแต่ข้อความ จะพังเป็น 500
    if (typeof national_id !== "string" || !NATIONAL_ID_PATTERN.test(national_id)) {
      const err = new Error("เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก");
      err.statusCode = 400;
      throw err;
    }

    await studentRepo.setPassword(
      req.params.id,
      await bcrypt.hash(national_id, SALT_ROUNDS),
    );
    res.json({
      success: true,
      data: { message: "ตั้งรหัสผ่านใหม่แล้ว (เลขบัตรประชาชนเดิม) นักศึกษาเข้าสู่ระบบได้ทันที" },
    });
  } catch (err) {
    next(err);
  }
};
