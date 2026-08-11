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

    // อัปโหลดเอกสารประเภทเดิมซ้ำ = แทนที่ใบเก่า ไม่ใช่เพิ่มใบที่สอง
    // เคสที่เกิดจริง: ถูกตีกลับแล้วส่งใหม่ — resubmit ใช้ result_id เดิม ใบเก่าเลยยังผูกอยู่
    // ถ้าไม่ลบ เจ้าหน้าที่จะเห็นเอกสาร 2 ใบในผลสอบเดียว แล้วไม่รู้ว่าใบไหนคือใบล่าสุด
    const previous = await certRepo.findByResultAndType(
      examResult.result_id,
      certificate_type,
    );
    for (const old of previous) {
      await certRepo.removeById(old.certificate_id);
      // ลบไฟล์ที่ disk ด้วย ไม่งั้นไฟล์ที่ไม่มีใครอ้างถึงจะค้างสะสมไปเรื่อยๆ
      // force: true = ไฟล์หายไปแล้วก็ไม่ต้อง error
      await fs.rm(path.resolve(old.file_path), { force: true });
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

// GET /api/certificates/:id/file — เปิด/โหลดไฟล์จริง
// เจ้าของผลสอบ (นักศึกษาคนนั้น) หรือ officer เท่านั้นที่เข้าถึงได้ — กันคนอื่นเดา id แล้วดูไฟล์คนอื่น
// executive เข้าไม่ได้ (เห็นได้แค่ภาพรวมใน dashboard)
export const serveFile = async (req, res, next) => {
  try {
    const certificate = await certRepo.findById(req.params.id);
    if (!certificate) throw httpError("ไม่พบไฟล์ที่ระบุ", 404);

    const examResult = await examRepo.findById(certificate.result_id);
    if (!examResult) throw httpError("ไม่พบผลสอบที่เกี่ยวข้อง", 404);

    const isOwner = req.user.studentId === examResult.student_id;
    const isStaff = req.user.role === "officer";
    if (!isOwner && !isStaff) {
      throw httpError("ไม่มีสิทธิ์เข้าถึงไฟล์นี้", 403);
    }

    const absolutePath = path.resolve(certificate.file_path);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(certificate.file_name)}"`,
    );
    res.sendFile(absolutePath, (err) => {
      // ไฟล์หายจาก disk (ลบทิ้งนอกระบบ) — ตอบ 404 แทนปล่อยให้ Express โยน error ดิบ
      if (err && !res.headersSent) next(httpError("ไม่พบไฟล์บน server", 404));
    });
  } catch (err) {
    next(err);
  }
};
