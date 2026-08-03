// เรียก repository.js
import fs from "fs/promises";
import path from "path";
import * as newsRepo from "./news.repository.js";

// helper สร้าง error ให้ errorHandler จัดการต่อ
const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// GET /api/news — ทุก role ดูได้
export const getAll = async (req, res, next) => {
  try {
    const news = await newsRepo.findAll();
    res.json({ success: true, data: news });
  } catch (err) {
    next(err);
  }
};

// POST /api/news — officer โพสต์ประกาศ (posted_by มาจาก JWT)
export const createNews = async (req, res, next) => {
  try {
    const { title, content, round_id } = req.body;

    if (!title || !content || !round_id) {
      throw httpError("ต้องส่ง title, content และ round_id", 400);
    }

    const news = await newsRepo.create({
      title,
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
    if (title !== undefined) data.title = title;
    if (content !== undefined) data.content = content;
    if (round_id !== undefined) data.round_id = Number(round_id);

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
    if (!req.file) throw httpError("ไม่พบไฟล์ที่อัปโหลด (field: image)", 400);

    const existing = await newsRepo.findById(req.params.id);
    if (!existing) {
      await fs.rm(req.file.path, { force: true });
      throw httpError("ไม่พบประกาศ", 404);
    }

    const news = await newsRepo.update(existing.news_id, {
      image_path: toStoredPath(req.file.path),
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

    const news = await newsRepo.update(existing.news_id, { image_path: null });
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
      if (err && !res.headersSent) next(httpError("ไม่พบไฟล์บน server", 404));
    });
  } catch (err) {
    next(err);
  }
};
