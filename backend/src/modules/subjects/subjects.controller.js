// เรียก repository.js
import * as subjectrepo from "./subjects.repository";

export const getAll = async (req, res, next) => {
  try {
    const subject = await subjectrepo.findAll();
    res.json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
};

export const createAll = async (req, res, next) => {
  try {
    const { subject_code, subject_name } = req.body;
    const subject = await subjectrepo.create({ subject_code, subject_name });
    req.json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
};
export const updatasubject = async (req, res, next) => {
  try {
    const subject = await subjectrepo.updata(req.parmas.id, req.body);
    res.json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
};
export const deleteSubject = async (req, res, next) => {
  try {
    await subjectrepo.remove(req.parmas.id);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};
