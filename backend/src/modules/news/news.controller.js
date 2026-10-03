// เรียก repository.js
import fs from "fs/promises";
import path from "path";
import * as newsRepo from "./news.repository.js";
import * as studentRepo from "../students/student.repository.js";
import * as roundsRepo from "../rounds/rounds.repository.js";

// helper สร้าง error ให้ errorHandler จัดการต่อ
const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// ตรวจหัวข้อ/เนื้อหา — ต้องเป็นข้อความไม่ว่าง และหัวข้อไม่เกิน 255 (ตรงกับ VarChar(255) ใน schema)
const ensureNewsText = ({ title, content }) => {
  if (typeof title !== "string" || !title.trim()) throw httpError("กรุณากรอกหัวข้อประกาศ", 400);
  if (typeof content !== "string" || !content.trim()) throw httpError("กรุณากรอกเนื้อหาประกาศ", 400);
  if (title.trim().length > 255) throw httpError("หัวข้อยาวเกินไป (ไม่เกิน 255 ตัวอักษร)", 400);
};

// round_id ต้องเป็นรอบที่มีจริง — เดิมส่งเลขมั่วมา FK พังเป็น 500
const ensureRoundExists = async (round_id) => {
  const id = Number(round_id);
  if (!Number.isInteger(id) || !(await roundsRepo.findById(id))) {
    throw httpError("ไม่พบรอบสอบที่เลือก", 400);
  }
};

// GET /api/news — ทุก role ดูได้ แต่เห็นไม่เท่ากัน
// นักศึกษา: เฉพาะประกาศของรุ่นตัวเอง — ประกาศผูกกับรอบ และรอบเป็นของรุ่นใดรุ่นหนึ่ง
//           ประกาศของรุ่นอื่นไม่เกี่ยวกับเขา ขึ้นมาก็สับสนว่าต้องไปกรอกด้วยหรือเปล่า
// เจ้าหน้าที่/ผู้บริหาร: เห็นครบทุกรุ่น เพราะเป็นคนโพสต์และดูภาพรวม
export const getAll = async (req, res, next) => {
  try {
    let academicYear; // undefined = ไม่กรอง
    if (req.user.role === "student") {
      const student = await studentRepo.findById(req.user.studentId);
      if (!student) throw httpError("ไม่พบข้อมูลนักศึกษา", 404);
      academicYear = student.academic_year;
    }
    const news = await newsRepo.findAll(academicYear);
    // ผู้แก้ประกาศเป็นข้อมูลภายในคณะ — นักศึกษาเห็นแค่ผู้โพสต์ ตัด updater ก่อนส่ง (อ่าน role จาก JWT)
    const data = req.user.role === "student" ? news.map(({ updater, ...rest }) => rest) : news;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/news — officer โพสต์ประกาศ (posted_by มาจาก JWT)
export const createNews = async (req, res, next) => {
  try {
    const { title, content, round_id } = req.body;

    if (!title || !content || !round_id) {
      throw httpError("กรุณากรอกหัวข้อ เนื้อหา และเลือกรอบสอบให้ครบ", 400);
    }
    ensureNewsText({ title, content });
    await ensureRoundExists(round_id);

    const news = await newsRepo.create({
      title: title.trim(),
      content,
      round_id: Number(round_id),
      posted_by: req.user.userId,
    });
    res.status(201).json({ success: true, data: news });
  } catch (err) {
    next(err);
  }
};

// PUT /api/news/:id — officer แก้ไขประกาศ
export const updateNews = async (req, res, next) => {
  try {
    const existing = await newsRepo.findById(req.params.id);
    if (!existing) throw httpError("ไม่พบประกาศ", 404);

    const { title, content, round_id } = req.body;
    const data = {};
    // ส่งมาแล้วต้องไม่ว่าง — เดิมแก้หัวข้อเป็นค่าว่างได้ ประกาศจะกลายเป็นการ์ดเปล่า
    if (title !== undefined || content !== undefined) {
      ensureNewsText({ title: title ?? existing.title, content: content ?? existing.content });
    }
    if (title !== undefined) data.title = title.trim();
    if (content !== undefined) data.content = content;
    if (round_id !== undefined) {
      await ensureRoundExists(round_id);
      data.round_id = Number(round_id);
    }

    data.updated_by = req.user.userId; // ใครแก้ล่าสุด (อ่านจาก JWT)
    const news = await newsRepo.update(req.params.id, data);
    res.json({ success: true, data: news });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/news/:id — officer ลบประกาศ
export const deleteNews = async (req, res, next) => {
  try {
    const existing = await newsRepo.findById(req.params.id);
    if (!existing) throw httpError("ไม่พบประกาศ", 404);

    await newsRepo.remove(req.params.id);
    // ลบไฟล์รูปตามไปด้วย ไม่งั้นเหลือไฟล์กำพร้าค้างที่ disk ไปเรื่อยๆ
    await removeImageFile(existing.image_path);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};

// ─── รูปภาพประกอบประกาศ ──────────────────────────────
// เก็บเป็น / เสมอ ไม่ผูกกับ path separator ของ Windows
const toStoredPath = (absolutePath) =>
  path.relative(process.cwd(), absolutePath).split(path.sep).join("/");

const removeImageFile = async (storedPath) => {
  if (storedPath) await fs.rm(path.resolve(storedPath), { force: true });
};

// POST /api/news/:id/image — แนบ/เปลี่ยนรูปของประกาศ (1 ประกาศ = 1 รูป)
export const uploadNewsImage = async (req, res, next) => {
  try {
    if (!req.file) throw httpError("กรุณาเลือกรูปภาพที่ต้องการแนบ", 400);

    const existing = await newsRepo.findById(req.params.id);
    if (!existing) {
      await fs.rm(req.file.path, { force: true });
      throw httpError("ไม่พบประกาศ", 404);
    }

    const news = await newsRepo.update(existing.news_id, {
      image_path: toStoredPath(req.file.path),
      updated_by: req.user.userId,
    });
    // เปลี่ยนรูปใหม่แล้ว รูปเก่าไม่มีใครอ้างถึงอีก ลบทิ้ง
    await removeImageFile(existing.image_path);

    res.json({ success: true, data: news });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/news/:id/image — เอารูปออกจากประกาศ
export const deleteNewsImage = async (req, res, next) => {
  try {
    const existing = await newsRepo.findById(req.params.id);
    if (!existing) throw httpError("ไม่พบประกาศ", 404);
    if (!existing.image_path) throw httpError("ประกาศนี้ไม่มีรูปภาพ", 400);

    const news = await newsRepo.update(existing.news_id, { image_path: null, updated_by: req.user.userId });
    await removeImageFile(existing.image_path);

    res.json({ success: true, data: news });
  } catch (err) {
    next(err);
  }
};

// GET /api/news/:id/image — ส่งไฟล์รูปจริง (ทุก role ที่ login แล้วดูได้ เหมือนตัวประกาศ)
export const serveNewsImage = async (req, res, next) => {
  try {
    const existing = await newsRepo.findById(req.params.id);
    if (!existing?.image_path) throw httpError("ไม่พบรูปของประกาศนี้", 404);

    res.sendFile(path.resolve(existing.image_path), (err) => {
      // ไฟล์หายจาก disk (ลบทิ้งนอกระบบ) — ตอบ 404 แทน error ดิบของ Express
      if (err && !res.headersSent) next(httpError("ไม่พบรูปภาพนี้ในระบบ กรุณาแจ้งเจ้าหน้าที่คณะ", 404));
    });
  } catch (err) {
    next(err);
  }
};
