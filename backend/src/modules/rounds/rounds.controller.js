import * as roundsRepo from "./rounds.repository.js";
import * as studentRepo from "../students/student.repository.js";

export const getAll = async (req, res, next) => {
  try {
    const rounds = await roundsRepo.findAll();
    res.json({ success: true, data: rounds });
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

    const round = await roundsRepo.findActive();
    res.json({ success: true, data: round });
  } catch (err) {
    next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    const { academic_year, attempt_number, open_date, close_date, status } =
      req.body;
    const round = await roundsRepo.create({
      academic_year: Number(academic_year),
      attempt_number: Number(attempt_number),
      open_date: new Date(open_date),
      close_date: new Date(close_date),
      status: status ?? "closed",
      created_by: req.user.userId, // อ่านจาก JWT เท่านั้น ไม่เชื่อ body
    });
    res.json({ success: true, data: round });
  } catch (err) {
    next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const { academic_year, attempt_number, open_date, close_date, status } =
      req.body;
    const data = {};
    if (academic_year !== undefined) data.academic_year = Number(academic_year);
    if (attempt_number !== undefined)
      data.attempt_number = Number(attempt_number);
    if (open_date !== undefined) data.open_date = new Date(open_date);
    if (close_date !== undefined) data.close_date = new Date(close_date);
    if (status !== undefined) data.status = status;

    const round = await roundsRepo.update(req.params.id, data);
    res.json({ success: true, data: round });
  } catch (err) {
    next(err);
  }
};
