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

  // ส่งผลรอบนี้ไปแล้ว (มีใบในรอบนี้) → รู้อยู่แล้วว่ารอบเปิด ไม่ต้องแจ้ง "เปิดรับผลสอบ" ทีหลัง
  // เช็คใบก่อน เพราะเป็น query เดียวจบ — ไม่ต้องไปดึงรายวิชา + วิชาที่ผ่านแล้วข้างล่างให้เปลือง
  const paper = await examRepo.findByStudentAndRound(studentId, round.round_id);
  if (paper) return;

  // ผ่านครบทุกวิชาของรอบนี้ไปแล้ว → ไม่มีอะไรต้องกรอก ไม่ต้องบอกว่า "เปิดรับผลสอบ"
  // ใช้วิธีเดียวกับตอนส่งผล (examResults.controller.js → create): วิชาของรอบ ลบวิชาที่เคยผ่านแล้ว
  // ส่ง round_id ไปตัดใบของรอบนี้ออก — คนที่ใบถูกตีกลับจึงยังได้แจ้งเตือนตามปกติ
  const allSubjects = await subjectsRepo.findAll();
  const roundSubjectIds = subjectsOfRound(round, allSubjects).map((s) => s.subject_id);
  const passedIds = await examRepo.findPassedSubjectIds(studentId, round.round_id);
  const mustAnswer = roundSubjectIds.filter((id) => !passedIds.includes(id));
  if (roundSubjectIds.length > 0 && mustAnswer.length === 0) return;

  try {
    await notifRepo.create({
      student_id: studentId,
      type: "round_open",
      round_id: round.round_id,
      message: `เปิดรับผลสอบรอบ ${round.attempt_number}/${round.academic_year} แล้ว\nกรอกผลสอบได้ตั้งแต่วันนี้ถึงวันปิดรับ`,
    });
    await removeDuplicateRoundOpen(studentId, round.round_id);
  } catch (e) {
    console.error("สร้างแจ้งเตือนรอบเปิดไม่สำเร็จ:", e.message);
  }
};

// เก็บกวาดแจ้งเตือน "รอบเปิด" ที่ซ้ำกัน — เกิดตอนนักศึกษาเปิดเว็บหลายแท็บพร้อมกัน
// ทุกแท็บ poll กระดิ่งเข้ามาเกือบพร้อมกัน → ทุกแท็บเช็คว่า "ยังไม่เคยแจ้ง" ก่อนที่ใครจะสร้างเสร็จ → ได้หลายแถว
//
// ทางแก้ที่ไม่ต้องแก้ตาราง: หลังสร้างแล้ว นับซ้ำ ถ้ามีมากกว่า 1 แถว เก็บแถวแรกสุด (id น้อยสุด) ลบที่เหลือ
// ทุกแท็บลบ "แถวที่ไม่ใช่แถวแรก" เหมือนกันหมด จึงไม่มีทางลบจนไม่เหลือสักแถว
// และแท็บที่สร้างทีหลังจะเห็นแถวของแท็บแรกเสมอ (แถวแรกถูกบันทึกก่อน) → แถวซ้ำถูกลบแน่นอน
// (ทางที่แน่นกว่าคือใส่ unique index ใน schema — แต่ต้องแก้ schema/migration จึงไม่ทำ)
const removeDuplicateRoundOpen = async (studentId, roundId) => {
  const ids = await notifRepo.findRoundOpenNoticeIds(studentId, roundId);
  if (ids.length <= 1) {
    return;
  }
  // ids เรียงน้อย → มากอยู่แล้ว ตัวแรก (ids[0]) คือแถวที่เก็บไว้ ที่เหลือลบทิ้ง
  const extraIds = [];
  for (let i = 1; i < ids.length; i++) {
    extraIds.push(ids[i]);
  }
  await notifRepo.removeByIds(extraIds);
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

// PATCH /:id/read — กดอ่านทีละอัน (repository กันด้วย student_id ไม่ให้อ่านของคนอื่น)
export const markRead = async (req, res, next) => {
  try {
    await notifRepo.markRead(req.params.id, req.user.studentId);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};

// PATCH /read-all — ปุ่ม "อ่านทั้งหมด" ของนักศึกษาคนนั้น
export const markAllRead = async (req, res, next) => {
  try {
    await notifRepo.markAllRead(req.user.studentId);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};
