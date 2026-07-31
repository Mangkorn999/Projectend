import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";
import * as studentRepo from "./student.repository.js";

const REQUIRED_COLUMNS = [
  "student_id",
  "first_name",
  "last_name",
  "email",
  "phone",
  "room_name",
  "academic_year",
];

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
    res.json({ success: true, data: student });
  } catch (err) {
    next(err);
  }
};

// เพิ่มนักศึกษาทีละคน (พิมพ์เอง) — ทางเลือกคู่กับ import CSV เวลามีแค่ 1-2 คน
// room ต้องเลือกจาก dropdown (room_id) ไม่ใช่พิมพ์ชื่อเอง กันพิมพ์ผิด/ไม่ตรงกับที่มีจริงแบบตอน import CSV
export const create = async (req, res, next) => {
  try {
    const {
      student_id,
      first_name,
      last_name,
      email,
      phone,
      room_id,
      academic_year,
    } = req.body;

    if (
      !student_id ||
      !first_name ||
      !last_name ||
      !email ||
      !phone ||
      !room_id ||
      !academic_year
    ) {
      const err = new Error("กรุณากรอกข้อมูลให้ครบ");
      err.statusCode = 400;
      throw err;
    }

    const existing = await studentRepo.findByPsuId(student_id);
    if (existing) {
      const err = new Error("รหัสนักศึกษานี้มีอยู่ในระบบแล้ว");
      err.statusCode = 409;
      throw err;
    }

    const room = await studentRepo.findRoomById(Number(room_id));
    if (!room) {
      const err = new Error("ไม่พบห้องเรียนที่เลือก");
      err.statusCode = 400;
      throw err;
    }

    const studentRole = await studentRepo.findRoleByName("student");
    const faculty = await studentRepo.findFaculty();
    if (!studentRole || !faculty) {
      const err = new Error("ระบบยังไม่ได้ตั้งค่าข้อมูลพื้นฐาน (role/faculty)");
      err.statusCode = 500;
      throw err;
    }

    // password_hash = null, must_change_password = true — เข้าครั้งแรกผ่าน /api/auth/first-setup เหมือน import CSV
    const student = await studentRepo.createImported({
      role_id: studentRole.role_id,
      psu_passport_id: student_id,
      first_name,
      last_name,
      email,
      phone,
      faculty_id: faculty.faculty_id,
      room_id: room.room_id,
      academic_year: Number(academic_year),
    });

    res.status(201).json({ success: true, data: student });
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

    // ทุกแถวใช้ role/faculty เดียวกัน (คณะนี้มีคณะเดียว) — ดึงครั้งเดียวนอกลูปพอ
    const studentRole = await studentRepo.findRoleByName("student");
    const faculty = await studentRepo.findFaculty();
    if (!studentRole || !faculty) {
      const err = new Error("ระบบยังไม่ได้ตั้งค่าข้อมูลพื้นฐาน (role/faculty)");
      err.statusCode = 500;
      throw err;
    }

    // ดึงห้องเรียนทั้งหมดมาไว้ก่อนครั้งเดียว — ใช้ทั้งจับคู่ชื่อห้องและบอกชื่อห้องที่มีจริงตอน error
    const rooms = await studentRepo.findAllRooms();
    const roomsByName = new Map(rooms.map((r) => [r.room_name, r]));
    const validRoomNames = rooms.map((r) => r.room_name).join(", ");

    const imported = [];
    const skipped = [];
    // ทำทีละแถว ไม่ใช้ transaction เดียวรวมทั้งไฟล์ — กันไฟล์ 500 แถวพังหมดเพราะแถวเดียวพลาด
    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // +1 เพราะแถวแรกคือ header, +1 เพราะนับแบบ 1-indexed ให้ตรงกับที่เห็นใน Excel
      const row = rows[i];
      const {
        student_id,
        first_name,
        last_name,
        email,
        phone,
        room_name,
        academic_year,
      } = row;

      // validate ฟิลด์บังคับต่อแถว — ขาดฟิลด์ไหนก็ข้ามแถวนั้น ไม่ทำให้ทั้งไฟล์ล้ม
      if (
        !student_id ||
        !first_name ||
        !last_name ||
        !email ||
        !phone ||
        !room_name ||
        !academic_year
      ) {
        skipped.push({ row: rowNum, student_id, reason: "ข้อมูลไม่ครบ" });
        continue;
      }

      // กัน import ซ้ำ — ถ้า student_id นี้มี user อยู่แล้วในระบบ ข้ามไปเลย (ไม่ทับข้อมูลเดิม)
      const existing = await studentRepo.findByPsuId(student_id);
      if (existing) {
        skipped.push({ row: rowNum, student_id, reason: "มีในระบบแล้ว" });
        continue;
      }

      // ห้องเรียนต้องมีอยู่จริงในระบบก่อน (seed ไว้แล้ว) — พิมพ์ชื่อห้องผิดก็ข้ามแถวนั้น
      // บอกชื่อห้องที่มีจริงไปด้วย กันคนพิมพ์ผิด/พิมพ์ไม่ครบแล้วงงว่าทำไมข้าม
      const room = roomsByName.get(room_name);
      if (!room) {
        skipped.push({
          row: rowNum,
          student_id,
          reason: `ไม่พบห้องเรียน '${room_name}' (ห้องที่มีในระบบ: ${validRoomNames})`,
        });
        continue;
      }

      try {
        // สร้าง user (password_hash = null, must_change_password = true)
        // นักศึกษาจะเข้าเว็บครั้งแรกได้ผ่านหน้า "ตั้งรหัสผ่านครั้งแรก" (/api/auth/first-setup) เท่านั้น
        await studentRepo.createImported({
          role_id: studentRole.role_id,
          psu_passport_id: student_id,
          first_name,
          last_name,
          email,
          phone,
          faculty_id: faculty.faculty_id,
          room_id: room.room_id,
          academic_year: Number(academic_year),
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

// เจ้าหน้าที่ reset บัญชีนักศึกษากลับเป็นยังไม่ตั้งรหัสผ่าน
// ใช้ตอนพบว่ามีคนแอบตั้งรหัสแทนเจ้าของบัญชี หรือเจ้าของลืมรหัสและไม่มี self-reset
export const resetPassword = async (req, res, next) => {
  try {
    const student = await studentRepo.findById(req.params.id);
    if (!student) {
      const err = new Error("ไม่พบนักศึกษา");
      err.statusCode = 404;
      throw err;
    }
    await studentRepo.resetPassword(req.params.id);
    res.json({
      success: true,
      data: { message: "รีเซ็ตรหัสผ่านแล้ว นักศึกษาต้องตั้งรหัสผ่านใหม่ผ่านหน้าตั้งรหัสผ่านครั้งแรก" },
    });
  } catch (err) {
    next(err);
  }
};
