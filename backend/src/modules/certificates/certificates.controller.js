import fs from "fs/promises";
import path from "path";
import * as certRepo from "./certificates.repository.js";
import { CERTIFICATE_TYPE } from "./certificates.repository.js";
import * as examRepo from "../examResults/examResults.repository.js";

const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// ลบไฟล์ที่เพิ่งอัปโหลดทิ้ง เมื่อ validate ไม่ผ่าน จะได้ไม่มีไฟล์ค้างที่ disk
const discard = async (file) => {
  if (file?.path) await fs.rm(file.path, { force: true });
};

// POST /api/exam-results/:id/certificates — นักศึกษาอัปโหลดเอกสาร PDF ของผลสอบตัวเอง
export const upload = async (req, res, next) => {
  try {
    if (!req.file) throw httpError("ไม่พบไฟล์ที่อัปโหลด (field: file)", 400);

    const { certificate_type } = req.body;
    if (!Object.values(CERTIFICATE_TYPE).includes(certificate_type)) {
      await discard(req.file);
      throw httpError(
        `certificate_type ต้องเป็น ${Object.values(CERTIFICATE_TYPE).join(" หรือ ")}`,
        400,
      );
    }

    const examResult = await examRepo.findById(req.params.id);
    if (!examResult) {
      await discard(req.file);
      throw httpError("ไม่พบผลสอบที่ระบุ", 404);
    }
    // ownership — ห้ามอัปโหลดใส่ผลสอบของคนอื่น
    if (examResult.student_id !== req.user.studentId) {
      await discard(req.file);
      throw httpError("ไม่มีสิทธิ์อัปโหลดเอกสารของผลสอบนี้", 403);
    }

    const certificate = await certRepo.create({
      result_id: examResult.result_id,
      certificate_type,
      // multer อ่าน originalname มาเป็น latin1 — ชื่อไฟล์ภาษาไทยจะเพี้ยนถ้าไม่แปลงกลับเป็น utf8
      file_name: Buffer.from(req.file.originalname, "latin1").toString("utf8"),
      // เก็บเป็น / เสมอ ไม่ผูกกับ path separator ของ Windows
      file_path: path.relative(process.cwd(), req.file.path).split(path.sep).join("/"),
      file_type: "pdf",
    });

    res.json({ success: true, data: certificate });
  } catch (err) {
    next(err);
  }
};
