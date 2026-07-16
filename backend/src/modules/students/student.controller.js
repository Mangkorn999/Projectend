import * as studentRepo from "./student.reposity.js";
import { encrypt } from "../../utils/crypto.js";

export const getAll = async (req, res, next) => {
  try {
    const student = await studentRepo.findAll();
    res.json({ success: true, data: student });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req, res, next) => {
  try {
    const student = await studentRepo.findById(req.params.id);
    if (student) delete student.nursing_council_password;
    res.json({ succes: true, data: student });
  } catch (err) {
    next(err);
  }
};
export const updateMyCredentials = async (req, res, next) => {
  try {
    const { nursing_council_email, nursing_council_password } = req.body;
    const encryted = encrypt(nursing_council_password);
    const student = req.user.studentId; // มีjwtเพื่อ payload ตอนlogin
    const result = await studentRepo.updateCredentials(
      student_id,
      encryted,
      nursing_council_email,
    );
    delete result.nursing_council_password;
    res.json({ succes: true, data: result });
  } catch (err) {
    next(err);
  }
};
