import bcrypt from "bcryptjs";
import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";
import * as studentRepo from "./student.repository.js";
import * as notifRepo from "../notifications/notifications.repository.js";
import * as subjectsRepo from "../subjects/subjects.repository.js";
import * as roundsRepo from "../rounds/rounds.repository.js";
import { calcGraduationYear } from "../../utils/academicYear.js";
import { buildSubjectListPdf } from "./students.pdf.js";

const REQUIRED_COLUMNS = ["student_id", "national_id"];
const NATIONAL_ID_PATTERN = /^\d{13}$/;
// รหัสนักศึกษาต้องเป็นตัวเลขล้วน อย่างน้อย 2 หลัก — 2 หลักแรกใช้คำนวณปีจบใน academicYear.js
// (ไม่ล็อกความยาวตายตัวเป็น 10 หลัก เพราะ smoke test สร้างรหัสทดสอบสั้นกว่านั้น)
const STUDENT_ID_PATTERN = /^\d{2,}$/;
const SALT_ROUNDS = 10;

export const getAll = async (req, res, next) => {
  try {
    const students = await studentRepo.findAll();
    res.json({ success: true, data: students });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req, res, next) => {
  try {
    // นักศึกษาดูได้แค่ข้อมูลตัวเอง — เจ้าหน้าที่/ผู้บริหารดูได้ทุกคน
    if (req.user.role === "student" && req.user.studentId !== req.params.id) {
      const err = new Error("ไม่มีสิทธิ์ดูข้อมูลของนักศึกษาคนอื่น");
      err.statusCode = 403;
      throw err;
    }

    const student = await studentRepo.findById(req.params.id);
    // ไม่เจอ = 404 ไม่ใช่ 200 + data:null — ฝั่งหน้าเว็บจะได้รู้ว่าไม่มีคนนี้จริง ไม่ใช่โหลดพลาด
    if (!student) {
      const err = new Error("ไม่พบนักศึกษา");
      err.statusCode = 404;
      throw err;
    }
    res.json({ success: true, data: student });
  } catch (err) {
    next(err);
  }
};

// เพิ่มนักศึกษาทีละคน (พิมพ์เอง) — ทางเลือกคู่กับ import CSV เวลามีแค่ 1-2 คน
// เจ้าหน้าที่กรอกแค่รหัสนักศึกษา + เลขบัตร ปชช — ชื่อ/ห้อง/ปีจบ นักศึกษากรอกเองตอน login ครั้งแรก (complete-profile)
export const create = async (req, res, next) => {
  try {
    const { student_id, national_id } = req.body;

    if (!student_id || !national_id) {
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
      const err = new Error("รหัสนักศึกษาต้องเป็นตัวเลขอย่างน้อย 2 หลัก");
      err.statusCode = 400;
      throw err;
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
    });

    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// นักศึกษากรอกโปรไฟล์ครั้งแรกหลัง login (บังคับผ่าน middleware ถ้ายังไม่มี student row)
// ปีการศึกษาที่จบคำนวณจากรหัสนักศึกษาเองฝั่ง server เท่านั้น — ไม่รับค่าจาก client
export const completeProfile = async (req, res, next) => {
  try {
    // authenticate แนบ req.user.studentId ไว้แล้ว — ถ้ามีค่าแปลว่ากรอกโปรไฟล์ไปแล้ว ห้ามกรอกซ้ำ
    if (req.user.studentId) {
      const err = new Error("กรอกโปรไฟล์ไปแล้ว");
      err.statusCode = 409;
      throw err;
    }

    const {
      first_name,
      last_name,
      first_name_en,
      last_name_en,
      email,
      phone,
      room_id,
    } = req.body;

    if (
      !first_name ||
      !last_name ||
      !first_name_en ||
      !last_name_en ||
      !email ||
      !phone ||
      !room_id
    ) {
      const err = new Error("กรุณากรอกข้อมูลให้ครบ");
      err.statusCode = 400;
      throw err;
    }

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

    // psu_passport_id ของนักศึกษา = student_id — ใช้คำนวณปีจบด้วย
    const student_id = req.user.username;
    const academic_year = calcGraduationYear(student_id);

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

    const {
      first_name,
      last_name,
      first_name_en,
      last_name_en,
      email,
      phone,
      room_id,
      academic_year,
    } = req.body;

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
    if (academic_year !== undefined) studentData.academic_year = Number(academic_year);

    const updated = await studentRepo.updateProfile(req.params.id, {
      user: userData,
      student: studentData,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const bulkSetEligible = async (req, res, next) => {
  try {
    const { student_ids, exam_eligible } = req.body;
    const result = await studentRepo.bulkSetEligible(
      student_ids,
      exam_eligible,
    );

    // แจ้งเตือนเฉพาะตอนเปิดสิทธิ์ — ปิดสิทธิ์ไม่ต้องแจ้ง ไม่ใช่ข่าวดีที่นักศึกษาต้องรู้ทันที
    if (exam_eligible && student_ids?.length) {
      notifRepo
        .createMany(student_ids, {
          type: "eligible",
          message: "เจ้าหน้าที่เปิดสิทธิ์ให้กรอกผลสอบแล้ว",
        })
        .catch((e) => console.error("สร้างแจ้งเตือนไม่สำเร็จ:", e.message));
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// นำเข้ารายชื่อนักศึกษาจากไฟล์ CSV — สร้าง user(ยังไม่มี password)+student พร้อมกันทีละแถว
// แถวที่พลาด (ซ้ำ/ห้องไม่มี/ข้อมูลขาด) จะถูกข้ามและรายงานกลับ ไม่ทำให้แถวอื่นล้มไปด้วย
export const bulkImport = async (req, res, next) => {
  try {
    // multer (memoryStorage) แปะไฟล์ที่ officer อัปโหลดไว้ที่ req.file.buffer — ยังไม่เขียนลง disk
    if (!req.file) {
      const err = new Error("กรุณาแนบไฟล์ CSV");
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
    let csvText;
    try {
      csvText = new TextDecoder("utf-8", { fatal: true }).decode(req.file.buffer);
    } catch {
      csvText = iconv.decode(req.file.buffer, "win874");
    }

    // csv-parse แปลง text → array of object โดยใช้แถวแรกเป็นชื่อ column (columns:true)
    let rows;
    try {
      rows = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true, // ตัดช่องว่างหัว-ท้ายทุกฟิลด์ กัน " 6610210631" มาจาก copy-paste
        bom: true, // เผื่อยังเหลือ BOM ติดมาในสตริง
      });
    } catch (parseErr) {
      const err = new Error(`อ่านไฟล์ CSV ไม่ได้: ${parseErr.message}`);
      err.statusCode = 400;
      throw err;
    }

    if (rows.length === 0) {
      const err = new Error("ไฟล์ CSV ไม่มีข้อมูล");
      err.statusCode = 400;
      throw err;
    }

    // เช็ค header ให้ครบก่อนวนลูป — กันเสีย request DB ทั้งไฟล์เพราะ column พิมพ์ผิด
    const missingCols = REQUIRED_COLUMNS.filter(
      (c) => !Object.keys(rows[0]).includes(c),
    );
    if (missingCols.length > 0) {
      const err = new Error(
        `ไฟล์ CSV ขาดคอลัมน์: ${missingCols.join(", ")}`,
      );
      err.statusCode = 400;
      throw err;
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
    // ทำทีละแถว ไม่ใช้ transaction เดียวรวมทั้งไฟล์ — กันไฟล์ 500 แถวพังหมดเพราะแถวเดียวพลาด
    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // +1 เพราะแถวแรกคือ header, +1 เพราะนับแบบ 1-indexed ให้ตรงกับที่เห็นใน Excel
      const row = rows[i];
      const { student_id, national_id } = row;

      // validate ฟิลด์บังคับต่อแถว — ขาดฟิลด์ไหนก็ข้ามแถวนั้น ไม่ทำให้ทั้งไฟล์ล้ม
      if (!student_id || !national_id) {
        skipped.push({ row: rowNum, student_id, reason: "ข้อมูลไม่ครบ" });
        continue;
      }

      if (!NATIONAL_ID_PATTERN.test(national_id)) {
        skipped.push({
          row: rowNum,
          student_id,
          reason: "เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก",
        });
        continue;
      }

      if (!STUDENT_ID_PATTERN.test(student_id)) {
        skipped.push({
          row: rowNum,
          student_id,
          reason: "รหัสนักศึกษาต้องเป็นตัวเลขอย่างน้อย 2 หลัก",
        });
        continue;
      }

      // กัน import ซ้ำ — ถ้า student_id นี้มี user อยู่แล้วในระบบ ข้ามไปเลย (ไม่ทับข้อมูลเดิม)
      const existing = await studentRepo.findByPsuId(student_id);
      if (existing) {
        skipped.push({ row: rowNum, student_id, reason: "มีในระบบแล้ว" });
        continue;
      }

      try {
        // สร้างแค่ user — รหัสผ่าน = hash(เลขบัตร ปชช) เข้าระบบได้ทันที ไม่ต้องผ่าน first-setup
        // student row จะถูกสร้างตอนนักศึกษากรอกโปรไฟล์เอง (complete-profile) หลัง login ครั้งแรก
        await studentRepo.createFromImport({
          role_id: studentRole.role_id,
          psu_passport_id: student_id,
          password_hash: await bcrypt.hash(national_id, SALT_ROUNDS),
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

    // สรุปผล import กลับไปให้หน้า officer แสดง — เห็นทั้งที่สำเร็จและที่ต้องแก้ไฟล์แล้วอัปใหม่
    res.status(201).json({
      success: true,
      data: {
        imported_count: imported.length,
        skipped_count: skipped.length,
        imported,
        skipped,
      },
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
    if (!student) {
      const err = new Error("ไม่พบนักศึกษา");
      err.statusCode = 404;
      throw err;
    }

    const resultCount = await studentRepo.countExamResults(req.params.id);
    if (resultCount > 0) {
      const err = new Error(
        `ลบไม่ได้ นักศึกษาคนนี้มีผลสอบในระบบแล้ว ${resultCount} รอบ — ถ้าข้อมูลไม่ถูกต้องให้ตีกลับผลสอบแทน`,
      );
      err.statusCode = 409;
      throw err;
    }

    await studentRepo.removeWithUser(req.params.id, student.user_id);
    res.json({
      success: true,
      data: { message: `ลบนักศึกษา ${req.params.id} ออกจากระบบแล้ว` },
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
    if (!NATIONAL_ID_PATTERN.test(national_id)) {
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
      data: { message: "ตั้งรหัสผ่านใหม่แล้ว (เลขบัตร ปชช เดิม) นักศึกษา login ได้ทันที" },
    });
  } catch (err) {
    next(err);
  }
};

// ตรวจ query ร่วมกันของ 2 endpoint ข้างล่าง (JSON list + export PDF) — โค้ดเดียวกัน กันสองจุดเพี้ยนไม่ตรงกัน
const resolveSubjectQuery = async (query) => {
  const { subject_code, passed, round_id, year } = query;
  if (!subject_code || (passed !== "true" && passed !== "false")) {
    const err = new Error("ต้องระบุ subject_code และ passed (true หรือ false)");
    err.statusCode = 400;
    throw err;
  }
  if (!round_id && !year) {
    const err = new Error("ต้องระบุ round_id หรือ year อย่างใดอย่างหนึ่ง");
    err.statusCode = 400;
    throw err;
  }

  const subject = await subjectsRepo.findByCode(subject_code);
  if (!subject) {
    const err = new Error(`ไม่พบวิชารหัส ${subject_code}`);
    err.statusCode = 404;
    throw err;
  }

  let scopeLabel;
  let roundId = null;
  if (round_id) {
    const round = await roundsRepo.findById(Number(round_id));
    if (!round) {
      const err = new Error("ไม่พบรอบที่ระบุ");
      err.statusCode = 404;
      throw err;
    }
    roundId = round.round_id;
    scopeLabel = `รอบ ${round.attempt_number}/${round.academic_year}`;
  } else {
    scopeLabel = `รวมทั้งปีการศึกษา ${year}`;
  }

  const wantPassed = passed === "true";
  const rows = await studentRepo.findMatchingSubjectResult({
    subjectCode: subject_code,
    passed: wantPassed,
    roundId,
    year: round_id ? null : Number(year),
  });

  return { subject, wantPassed, scopeLabel, rows };
};

// รายชื่อนักศึกษาที่ผ่าน/ไม่ผ่านวิชาหนึ่งวิชา (JSON) — ใช้แสดงตัวอย่างในหน้ารายงานสรุปผลก่อนกดดาวน์โหลด PDF
export const getSubjectResultList = async (req, res, next) => {
  try {
    const { subject, wantPassed, scopeLabel, rows } = await resolveSubjectQuery(req.query);
    res.json({
      success: true,
      data: {
        subject,
        passed: wantPassed,
        scope_label: scopeLabel,
        students: rows.map((r) => ({
          student_id: r.student.student_id,
          first_name: r.student.user.first_name,
          last_name: r.student.user.last_name,
          room_name: r.student.room?.room_name ?? null,
          academic_year: r.student.academic_year,
          submitted_at: r.submitted_at,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

// export รายชื่อนักศึกษาที่ผ่าน/ไม่ผ่านวิชาหนึ่งวิชาเป็น PDF — กดจากปุ่ม "ดาวน์โหลด PDF" ที่หน้ารายงานสรุปผล
// ส่ง round_id = ดูรอบเดียว, ส่ง year (ไม่ส่ง round_id) = ดู "รวมทั้งปี" — เลือกอย่างใดอย่างหนึ่ง
export const exportSubjectList = async (req, res, next) => {
  try {
    const { subject, wantPassed, scopeLabel, rows } = await resolveSubjectQuery(req.query);

    // ชื่อไฟล์มีภาษาไทย — filename="..." เฉยๆ ใช้ไม่ได้กับ non-ASCII (บางเบราว์เซอร์เพี้ยน)
    // ต้องมี filename ASCII สำรอง + filename*=UTF-8''... (RFC 5987) คู่กันเสมอ
    const fileName = `รายชื่อ-${wantPassed ? "ผ่าน" : "ไม่ผ่าน"}-${subject.subject_code}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="report.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );

    buildSubjectListPdf({ subject, passed: wantPassed, scopeLabel, rows, res });
  } catch (err) {
    next(err);
  }
};
