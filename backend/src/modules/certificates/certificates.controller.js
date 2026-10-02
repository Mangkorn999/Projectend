import fs from "fs/promises";
import path from "path";
import * as certRepo from "./certificates.repository.js";
import { CERTIFICATE_TYPE } from "./certificates.repository.js";
import * as examRepo from "../examResults/examResults.repository.js";
import { findSubmittableRound } from "../examResults/examResults.service.js";
import * as studentRepo from "../students/student.repository.js";

const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// ใบผลสอบ 1 ใบแนบไฟล์ได้ไม่เกินกี่ไฟล์ (เช่น PDF ใบคะแนน + รูปถ่ายอีกไม่กี่รูป)
const MAX_FILES_PER_RESULT = 5;

// "หัวไฟล์" (magic bytes) ของไฟล์แต่ละชนิด — ไบต์ชุดแรกของไฟล์ที่บอกว่าไฟล์นี้เป็นอะไรจริงๆ
// ต้องดูตรงนี้ เพราะนามสกุลไฟล์และชนิดที่เบราว์เซอร์บอกมา (mimetype) ปลอมได้ทั้งคู่
//   PDF = ขึ้นต้นด้วยตัวอักษร %PDF-  (0x25 0x50 0x44 0x46 0x2D)
//   JPG = ขึ้นต้นด้วย FF D8 FF
//   PNG = ขึ้นต้นด้วย 89 50 4E 47 0D 0A 1A 0A
const FILE_SIGNATURES = [
  { fileType: "pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { fileType: "jpg", bytes: [0xff, 0xd8, 0xff] },
  { fileType: "png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

// ชนิดไฟล์ (file_type ใน DB) → Content-Type ที่ต้องบอกเบราว์เซอร์ตอนเปิดไฟล์
const CONTENT_TYPE_OF = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
};

// ลบไฟล์ที่เพิ่งอัปโหลดทิ้ง เมื่อ validate ไม่ผ่าน จะได้ไม่มีไฟล์ค้างที่ disk
// ห่อ try/catch ไว้: ถ้าลบไม่สำเร็จ (เช่น ไฟล์ถูกเปิดค้างอยู่บน Windows) ต้องไม่ทำให้ request ค้างไม่ตอบ
const discard = async (file) => {
  if (!file || !file.path) {
    return;
  }
  try {
    await fs.rm(file.path, { force: true });
  } catch (err) {
    console.error("ลบไฟล์ที่อัปโหลดไม่สำเร็จ:", err.message);
  }
};

// error ตอนแนบไฟล์เกินจำนวน — ใช้ 2 ที่ (ก่อนบันทึก และตอนตรวจซ้ำหลังบันทึก) ข้อความต้องตรงกัน
const tooManyFilesError = () =>
  httpError(
    `แนบไฟล์ได้ไม่เกิน ${MAX_FILES_PER_RESULT} ไฟล์ต่อใบผลสอบ กรุณาลบไฟล์เดิมก่อนเพิ่มไฟล์ใหม่`,
    400,
  );

// อ่านไบต์ต้นไฟล์ แล้วบอกว่าเป็น "pdf" / "jpg" / "png" — ไม่ใช่ทั้ง 3 แบบ คืน null
const detectFileType = async (filePath) => {
  // อ่านแค่ 8 ไบต์แรก (หัวไฟล์ที่ยาวที่สุดคือ PNG = 8 ไบต์) ไม่ต้องอ่านทั้งไฟล์
  const head = Buffer.alloc(8);
  const fileHandle = await fs.open(filePath, "r");
  let bytesRead = 0;
  try {
    const readResult = await fileHandle.read(head, 0, 8, 0);
    bytesRead = readResult.bytesRead;
  } finally {
    await fileHandle.close();
  }

  // เทียบกับหัวไฟล์ทีละชนิด
  for (const signature of FILE_SIGNATURES) {
    // ไฟล์สั้นกว่าหัวไฟล์ของชนิดนี้ = ไม่ใช่ชนิดนี้แน่นอน
    if (bytesRead < signature.bytes.length) {
      continue;
    }

    // เทียบทีละไบต์ ต้องตรงทุกไบต์
    let allMatch = true;
    for (let i = 0; i < signature.bytes.length; i++) {
      if (head[i] !== signature.bytes[i]) {
        allMatch = false;
        break;
      }
    }

    if (allMatch) {
      return signature.fileType;
    }
  }

  return null;
};

// ตรวจว่านักศึกษาคนนี้ "เปลี่ยนเอกสาร" ของใบผลสอบนี้ได้ไหม — ใช้ทั้งตอนแนบไฟล์และตอนลบไฟล์ (กฎเดียวกัน)
// ไม่ผ่านข้อไหน → throw error ออกไปเลย (ผู้เรียกต้องลบไฟล์ที่เพิ่งอัปโหลดทิ้งเอง)
const ensureCanChangeEvidence = async (examResult, user) => {
  // 1. ต้องเป็นใบของตัวเองเท่านั้น — กันเดา id แล้วไปแนบ/ลบไฟล์ในใบของคนอื่น
  if (examResult.student_id !== user.studentId) {
    throw httpError("ท่านไม่มีสิทธิ์เปลี่ยนเอกสารของผลสอบนี้", 403);
  }

  // 2. ใบที่เจ้าหน้าที่ยืนยันแล้วต้องล็อกหลักฐานด้วย — ไม่งั้นเปลี่ยนไฟล์ทีหลังได้ ทั้งที่ผลถูกเซ็นรับรองไปแล้ว
  if (examResult.staff_status === "approved") {
    throw httpError("เจ้าหน้าที่ยืนยันผลสอบนี้แล้ว เปลี่ยนเอกสารไม่ได้", 409);
  }

  // 3. ใบนี้ต้องอยู่ใน "รอบที่ส่งผลได้ตอนนี้" ของนักศึกษาคนนี้เท่านั้น
  //    ใช้ findSubmittableRound ตัวเดียวกับตอนกดส่งผล (examResults.service.js) — กฎของหลักฐานกับของผลสอบจะได้ตรงกันเสมอ
  //    เปลี่ยนเอกสารได้ 2 กรณี:
  //      - ใบของรอบที่เปิดรับอยู่จริงตอนนี้ (รอตรวจ หรือถูกตีกลับ ก็ได้)
  //      - ไม่มีรอบเปิด แต่ใบนี้คือใบของรอบล่าสุดที่ถูกตีกลับ (แก้ส่งใหม่หลังปิดรอบ)
  //    นอกนั้นห้ามทั้งหมด เช่น ใบรอตรวจหลังปิดรอบ หรือใบที่ถูกตีกลับของ "รอบเก่า" ที่มีรอบใหม่กว่าแล้ว
  //    (เดิมเช็คแค่ว่า "ใบถูกตีกลับ" → ใบตีกลับของรอบเก่าเปลี่ยนหลักฐานได้ตลอดไป ทั้งที่ส่งผลใบนั้นใหม่ไม่ได้แล้ว
  //     หลักฐานของใบที่เจ้าหน้าที่ตีกลับไปแล้วจึงถูกสลับทีหลังได้ ประวัติการตรวจย้อนหลังไม่ตรงกับของจริง)
  const student = await studentRepo.findById(user.studentId);
  let submittable = null;
  if (student) {
    submittable = await findSubmittableRound(student);
  }

  let isSubmittableRound = false;
  if (submittable && submittable.round.round_id === examResult.round_id) {
    isSubmittableRound = true;
  }

  if (!isSubmittableRound) {
    throw httpError(
      "รอบนี้ปิดรับแล้ว เปลี่ยนเอกสารไม่ได้ กรุณาติดต่อเจ้าหน้าที่คณะ",
      409,
    );
  }
};

// POST /api/exam-results/:id/certificates — นักศึกษาแนบไฟล์หลักฐาน (PDF / JPG / PNG) ของผลสอบตัวเอง
// แนบได้หลายไฟล์ต่อใบ (ไม่เกิน MAX_FILES_PER_RESULT) — แนบเพิ่ม = ต่อท้าย ไม่แทนที่ไฟล์เดิม
// อยากเปลี่ยนไฟล์ ให้ลบไฟล์เดิมทีละไฟล์ผ่าน DELETE /api/certificates/:id
export const upload = async (req, res, next) => {
  // saved = true เมื่อบันทึกแถวลง DB ผ่านทุกด่านแล้ว (ไฟล์บน disk มีแถวอ้างถึงแล้ว ห้ามลบ)
  // ถ้าพังที่ขั้นไหนก็ตามก่อนถึงตรงนั้น catch ด้านล่างจะลบไฟล์ที่ multer เขียนลง disk ไปแล้วทิ้งให้เสมอ
  // (เดิมลบทีละจุด แล้วตกหล่นบางทาง เช่น ส่งเลขใบผลสอบแปลกๆ มา → Prisma error → ไฟล์ค้างที่ disk)
  let saved = false;
  try {
    if (!req.file) {
      throw httpError("กรุณาเลือกไฟล์ที่ต้องการแนบ", 400);
    }

    // ประเภทเอกสารต้องเป็นค่าที่ระบบรู้จัก (ใบผลสอบ / ใบประกอบวิชาชีพ)
    const certificateType = req.body.certificate_type;
    const allowedTypes = Object.values(CERTIFICATE_TYPE);
    if (!allowedTypes.includes(certificateType)) {
      throw httpError(
        "ประเภทเอกสารไม่ถูกต้อง กรุณาเลือกประเภทเอกสารแล้วลองใหม่อีกครั้ง",
        400,
      );
    }

    const examResult = await examRepo.findById(req.params.id);
    if (!examResult) {
      throw httpError("ไม่พบผลสอบที่ระบุ กรุณารีเฟรชหน้าแล้วลองใหม่", 404);
    }

    // เจ้าของใบ + ยังไม่ยืนยัน + ใบอยู่ในรอบที่ส่งผลได้ตอนนี้ (ดู ensureCanChangeEvidence)
    await ensureCanChangeEvidence(examResult, req.user);

    // ดูเนื้อไฟล์จริงว่าเป็น PDF / JPG / PNG — ไม่เชื่อชนิดที่เบราว์เซอร์บอกมา (แก้เองได้)
    const fileType = await detectFileType(req.file.path);
    if (!fileType) {
      throw httpError(
        "ไฟล์ที่แนบต้องเป็น PDF, JPG หรือ PNG เท่านั้น กรุณาเลือกไฟล์ใหม่",
        400,
      );
    }

    // จำกัดจำนวนไฟล์ต่อใบ — กันแนบรัวๆ จนเจ้าหน้าที่ต้องไล่เปิดไฟล์จำนวนมาก
    const fileCount = await certRepo.countByResult(examResult.result_id);
    if (fileCount >= MAX_FILES_PER_RESULT) {
      throw tooManyFilesError();
    }

    // multer อ่าน originalname มาเป็น latin1 — ชื่อไฟล์ภาษาไทยจะเพี้ยนถ้าไม่แปลงกลับเป็น utf8
    const fileName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    // เก็บเป็น / เสมอ ไม่ผูกกับ path separator ของ Windows
    const filePath = path.relative(process.cwd(), req.file.path).split(path.sep).join("/");

    // บันทึกไม่สำเร็จ (เช่น ชื่อไฟล์ยาวเกิน) → ไปที่ catch → ไฟล์บน disk ถูกลบทิ้ง
    const certificate = await certRepo.create({
      result_id: examResult.result_id,
      certificate_type: certificateType,
      file_name: fileName,
      file_path: filePath,
      file_type: fileType, // ชนิดจริงจากหัวไฟล์ ไม่ใช่จากนามสกุล
    });

    // ด่านสุดท้าย: ตรวจซ้ำ "หลัง" บันทึกแล้ว — กันกรณีมีหลาย request เข้ามาพร้อมกัน
    //   - กดแนบหลายไฟล์พร้อมกัน: ทุก request นับได้ 4 ไฟล์ในเวลาเดียวกัน → ผ่านด่านนับไฟล์ข้างบนหมด
    //     → ในใบมีเกิน 5 ไฟล์ (เทส phase27 แนบพร้อมกัน 10 ไฟล์ เดิมได้ 6 ไฟล์)
    //   - เจ้าหน้าที่กดยืนยันใบนี้ระหว่างที่ไฟล์กำลังอัปโหลด → ไฟล์ไปติดอยู่ในใบที่ยืนยันแล้ว
    // เจออย่างใดอย่างหนึ่ง → ถอนแถวที่เพิ่งบันทึกออก แล้ว throw (ไฟล์บน disk ถูกลบใน catch)
    // request ไหนที่นับหลังบันทึกแล้วเห็นเกิน จะถอนตัวเองออก → สุดท้ายในใบมีไม่เกิน 5 ไฟล์เสมอ
    const countAfterSave = await certRepo.countByResult(examResult.result_id);
    const latestResult = await examRepo.findById(examResult.result_id);
    let problemAfterSave = null;
    if (countAfterSave > MAX_FILES_PER_RESULT) {
      problemAfterSave = tooManyFilesError();
    } else if (!latestResult || latestResult.staff_status === "approved") {
      problemAfterSave = httpError("เจ้าหน้าที่ยืนยันผลสอบนี้แล้ว เปลี่ยนเอกสารไม่ได้", 409);
    }
    if (problemAfterSave) {
      await certRepo.removeById(certificate.certificate_id);
      throw problemAfterSave;
    }

    saved = true;
    res.json({ success: true, data: certificate });
  } catch (err) {
    // ยังไม่ได้บันทึกสำเร็จ = ไม่มีแถวไหนอ้างถึงไฟล์นี้ → ลบทิ้งไม่ให้ค้างที่ disk
    if (!saved) {
      await discard(req.file);
    }
    next(err);
  }
};

// DELETE /api/certificates/:id — นักศึกษาลบไฟล์หลักฐานของตัวเองทีละไฟล์
// กฎเดียวกับตอนแนบไฟล์ (ensureCanChangeEvidence): เจ้าของใบเท่านั้น, ใบยังไม่ยืนยัน, รอบเปิดอยู่หรือใบถูกตีกลับ
export const remove = async (req, res, next) => {
  try {
    const certificate = await certRepo.findById(req.params.id);
    if (!certificate) {
      throw httpError("ไม่พบไฟล์ที่ต้องการลบ อาจถูกลบไปแล้ว กรุณารีเฟรชหน้า", 404);
    }

    const examResult = await examRepo.findById(certificate.result_id);
    if (!examResult) {
      throw httpError("ไม่พบผลสอบที่เกี่ยวข้องกับไฟล์นี้", 404);
    }

    await ensureCanChangeEvidence(examResult, req.user);

    // ลบแถวใน DB ก่อน แล้วค่อยลบไฟล์บน disk
    // ถ้าลบไฟล์ก่อนแล้ว DB พัง จะเหลือแถวที่ชี้ไปหาไฟล์ที่ไม่มีอยู่จริง (เจ้าหน้าที่กดเปิดแล้วเจอ 404)
    await certRepo.removeById(certificate.certificate_id);
    // force: true = ไฟล์หายไปก่อนแล้วก็ไม่ต้อง error
    await fs.rm(path.resolve(certificate.file_path), { force: true });

    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};

// role ที่เปิดไฟล์หลักฐานของนักศึกษาคนอื่นได้ — คนที่ต้องตรวจใบจริงเท่านั้น
// reviewer ต้องอยู่ในนี้ด้วย: reviewer กด "ยืนยัน/ตีกลับ" ได้ (examResults.routes.js)
// ถ้าเปิดไฟล์แนบไม่ได้ ก็ตรวจไม่ได้จริง — หน้า studentDetailReal.jsx โชว์ปุ่มเปิดไฟล์ให้อยู่แล้ว
const CAN_VIEW_OTHERS_FILES = ["officer", "reviewer"];

// GET /api/certificates/:id/file — เปิด/โหลดไฟล์จริง
// เจ้าของผลสอบ (นักศึกษาคนนั้น) หรือคนที่มีหน้าที่ตรวจเท่านั้น — กันคนอื่นเดา id แล้วดูไฟล์คนอื่น
// executive เข้าไม่ได้ (เห็นได้แค่ภาพรวมใน dashboard)
export const serveFile = async (req, res, next) => {
  try {
    const certificate = await certRepo.findById(req.params.id);
    if (!certificate) throw httpError("ไม่พบไฟล์ที่ระบุ", 404);

    const examResult = await examRepo.findById(certificate.result_id);
    if (!examResult) throw httpError("ไม่พบผลสอบที่เกี่ยวข้อง", 404);

    const isOwner = req.user.studentId === examResult.student_id;
    const isStaff = CAN_VIEW_OTHERS_FILES.includes(req.user.role);
    if (!isOwner && !isStaff) {
      throw httpError("ไม่มีสิทธิ์เข้าถึงไฟล์นี้", 403);
    }

    // บอกเบราว์เซอร์ให้ถูกชนิด ไม่งั้นรูปจะถูกเปิดเป็น PDF (เปิดไม่ขึ้น)
    // ไฟล์เก่าก่อนรองรับรูปภาพมี file_type = "pdf" ทั้งหมด → ค่าที่ไม่รู้จักถือเป็น PDF
    let contentType = CONTENT_TYPE_OF[certificate.file_type];
    if (!contentType) {
      contentType = "application/pdf";
    }

    const absolutePath = path.resolve(certificate.file_path);
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      // filename*=UTF-8 = มาตรฐานสำหรับชื่อไฟล์ภาษาไทย (แบบเดิมใส่ %E0%B8... ลงใน filename="" ตรงๆ ชื่อไฟล์ตอนโหลดเลยเพี้ยน)
      "inline; filename*=UTF-8''" + encodeURIComponent(certificate.file_name),
    );
    res.sendFile(absolutePath, (err) => {
      // ไฟล์หายจาก disk (ลบทิ้งนอกระบบ) — ตอบ 404 แทนปล่อยให้ Express โยน error ดิบ
      if (err && !res.headersSent) {
        next(httpError("ไม่พบไฟล์นี้ในระบบ กรุณาแจ้งเจ้าหน้าที่คณะ", 404));
      }
    });
  } catch (err) {
    next(err);
  }
};
