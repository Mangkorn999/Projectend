import * as roundsRepo from "../rounds/rounds.repository.js";
import * as examRepo from "./examResults.repository.js";
import { STAFF_STATUS } from "./examResults.repository.js";

// หารอบที่นักศึกษาคนนี้ "ส่งผลสอบได้" ตอนนี้ — ใช้ร่วมกัน 2 ที่ ให้ตัดสินตรงกันเสมอ:
//   1. examResults.controller.js → create   (ตอนกดส่งผลจริง)
//   2. rounds.controller.js → getActive      (หน้ากรอกผลของนักศึกษาดูว่าจะโชว์ฟอร์มของรอบไหน)
//
// คืนค่า 1 ใน 3 แบบ:
//   { round, fixingRejected: false } = มีรอบของรุ่นที่เปิดรับอยู่จริงตอนนี้ → กรอก/แก้ได้ตามปกติ
//   { round, fixingRejected: true }  = ไม่มีรอบเปิด แต่ใบของนักศึกษาในรอบล่าสุดถูกตีกลับ → แก้ใบนั้นส่งใหม่ได้
//   null                             = ส่งอะไรไม่ได้เลยตอนนี้
//
// ทำไมต้องมีกรณีที่ 2 (ตัดสินใจโดยเจ้าของงานแล้ว):
//   เจ้าหน้าที่ตรวจใบได้ทั้งระหว่างรอบและหลังปิดรอบ — ถ้าตีกลับหลังปิดรอบ นักศึกษาจะแก้ไม่ได้เลย
//   เพราะเดิมส่งได้เฉพาะตอนรอบเปิด ต้องให้เจ้าหน้าที่เลื่อนวันปิดรอบทั้งรอบ (และทำไม่ได้ถ้ารอบถัดไปเปิดอยู่)
//   จึงยอมให้เฉพาะ "ใบที่ถูกตีกลับ" แก้ส่งใหม่ได้ แม้รอบปิดแล้ว — คนที่ไม่เคยส่ง/ใบรอตรวจ ยังส่งหลังปิดรอบไม่ได้เหมือนเดิม
export const findSubmittableRound = async (student) => {
  // ขั้นที่ 1: รอบของรุ่นที่เปิดรับอยู่จริงตอนนี้ (status = open และอยู่ในช่วงวันเปิด-ปิด) มาก่อนเสมอ
  // ถ้ามีรอบเปิดอยู่ ใบเก่าที่ถูกตีกลับของรอบก่อนต้องไปแก้ในรอบนี้แทน (วิชาที่ยังไม่ผ่านจะอยู่ในฟอร์มรอบนี้)
  const activeRound = await roundsRepo.findActive(student.academic_year);
  if (activeRound) {
    return { round: activeRound, fixingRejected: false };
  }

  // ขั้นที่ 2: ไม่มีรอบเปิด → ดูรอบล่าสุดของรุ่นที่เริ่มไปแล้ว (จะปิดแล้วหรือยังก็ได้)
  // ดูเฉพาะรอบล่าสุดเท่านั้น ไม่ย้อนไปรอบเก่ากว่า — ถ้ามีรอบใหม่กว่าเกิดขึ้นแล้ว
  // การย้อนกลับไปแก้ใบรอบเก่าจะทำให้ผลที่ยกไปรอบหลัง (carry-forward) เพี้ยน
  const latestRound = await roundsRepo.findLatestStarted(student.academic_year);
  if (!latestRound) {
    return null;
  }

  // ขั้นที่ 3: ใบของนักศึกษาคนนี้ในรอบนั้นต้อง "ถูกตีกลับ" เท่านั้นถึงจะแก้ได้
  const paper = await examRepo.findByStudentAndRound(
    student.student_id,
    latestRound.round_id,
  );
  if (paper && paper.staff_status === STAFF_STATUS.REJECTED) {
    return { round: latestRound, fixingRejected: true };
  }

  return null;
};
