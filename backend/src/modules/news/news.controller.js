// เรียก repository.js
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
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};
