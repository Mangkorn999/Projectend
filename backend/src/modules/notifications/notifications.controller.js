import * as notifRepo from "./notifications.repository.js";
import * as studentRepo from "../students/student.repository.js";
import * as roundsRepo from "../rounds/rounds.repository.js";
import * as examRepo from "../examResults/examResults.repository.js";
import * as subjectsRepo from "../subjects/subjects.repository.js";
import { subjectsOfRound } from "../../utils/roundSubjects.js";

// รอบสอบเปิดรับอยู่ตอนนี้ตรงกับปีของนักศึกษาคนนี้ (eligible เท่านั้น) และยังไม่เคยแจ้งมาก่อน → สร้างแจ้งเตือนก่อนส่งลิสต์กลับ
// ไม่มี background job แยก — อาศัย endpoint นี้ที่ frontend poll ทุก 30 วิอยู่แล้วเป็นตัวเช็คแทน
const notifyIfRoundJustOpened = async (studentId) => {
  const student = await studentRepo.findEligibilityYear(studentId);
  if (!student?.exam_eligible) return;

  const round = await roundsRepo.findActive(student.academic_year);
  if (!round) return;

  const already = await notifRepo.hasRoundOpenNotice(studentId, round.round_id);
  if (already) return;

  // ผ่านครบทุกวิชาของรอบนี้ไปแล้ว → ไม่มีอะไรต้องกรอก ไม่ต้องบอกว่า "เปิดรับผลสอบ"
  // ใช้วิธีเดียวกับตอนส่งผล (examResults.controller.js → create): วิชาของรอบ ลบวิชาที่เคยผ่านแล้ว
  // ส่ง round_id ไปตัดใบของรอบนี้ออก — คนที่ใบถูกตีกลับจึงยังได้แจ้งเตือนตามปกติ
  const allSubjects = await subjectsRepo.findAll();
  const roundSubjectIds = subjectsOfRound(round, allSubjects).map((s) => s.subject_id);
  const passedIds = await examRepo.findPassedSubjectIds(studentId, round.round_id);
  const mustAnswer = roundSubjectIds.filter((id) => !passedIds.includes(id));
  if (roundSubjectIds.length > 0 && mustAnswer.length === 0) return;

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
