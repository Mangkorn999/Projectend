import * as studentRepo from "./student.repository.js";

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
