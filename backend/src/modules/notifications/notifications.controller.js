import * as notifRepo from "./notifications.repository.js";
import * as studentRepo from "../students/student.repository.js";
import * as roundsRepo from "../rounds/rounds.repository.js";

// รอบสอบเปิดรับอยู่ตอนนี้ตรงกับปีของนักศึกษาคนนี้ (eligible เท่านั้น) และยังไม่เคยแจ้งมาก่อน → สร้างแจ้งเตือนก่อนส่งลิสต์กลับ
// ไม่มี background job แยก — อาศัย endpoint นี้ที่ frontend poll ทุก 30 วิอยู่แล้วเป็นตัวเช็คแทน
const notifyIfRoundJustOpened = async (studentId) => {
  const student = await studentRepo.findEligibilityYear(studentId);
  if (!student?.exam_eligible) return;

  const round = await roundsRepo.findActive(student.academic_year);
  if (!round) return;

  const already = await notifRepo.hasRoundOpenNotice(studentId, round.round_id);
  if (already) return;

  await notifRepo
    .create({
      student_id: studentId,
      type: "round_open",
      round_id: round.round_id,
      message: `เปิดรับผลสอบรอบ ${round.attempt_number}/${round.academic_year} แล้ว\nกรอกผลสอบได้ตั้งแต่วันนี้ถึงวันปิดรับ`,
    })
    .catch((e) => console.error("สร้างแจ้งเตือนรอบเปิดไม่สำเร็จ:", e.message));
};

// นักศึกษาดูแจ้งเตือนของตัวเอง — ล่าสุดก่อน
export const getMine = async (req, res, next) => {
  try {
    await notifyIfRoundJustOpened(req.user.studentId);
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
