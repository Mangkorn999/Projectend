import * as notifRepo from "./notifications.repository.js";

// นักศึกษาดูแจ้งเตือนของตัวเอง — ล่าสุดก่อน
export const getMine = async (req, res, next) => {
  try {
    const notifications = await notifRepo.findByStudent(req.user.studentId);
    res.json({ success: true, data: notifications });
  } catch (err) {
    next(err);
  }
};

export const markRead = async (req, res, next) => {
  try {
    await notifRepo.markRead(req.params.id, req.user.studentId);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};

export const markAllRead = async (req, res, next) => {
  try {
    await notifRepo.markAllRead(req.user.studentId);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};
