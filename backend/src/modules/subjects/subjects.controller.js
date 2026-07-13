// เรียก repository.js
import * as subjectrepo from "./subjects.repository.js";

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
    res.json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
};
export const updatasubject = async (req, res, next) => {
  try {
    const subject = await subjectrepo.updata(req.params.id, req.body);
    res.json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
};
export const deleteSubject = async (req, res, next) => {
  try {
    await subjectrepo.remove(req.params.id);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};
