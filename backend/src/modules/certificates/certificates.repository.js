import prisma from "../../config/db.js";
import { lockExamResultRow } from "../examResults/examResults.repository.js";

// ประเภทเอกสารตามรายงาน
export const CERTIFICATE_TYPE = {
  EXAM_RESULT: "exam_result", // ใบผลสอบ
  LICENSE: "license", // ใบประกอบวิชาชีพ
};

// หาไฟล์หลักฐานตาม id
export const findById = (id) =>
  prisma.certificate.findUnique({ where: { certificate_id: Number(id) } });

// (เดิมมี create / countByResult / removeById แยกกัน — ถูกแทนด้วย createWithLock / removeWithLock ข้างล่าง
//  ที่นับไฟล์ + บันทึก/ลบ ระหว่างถือล็อกใบผลสอบในก้อนเดียว จึงลบตัวเก่าทิ้งไม่ให้ใครเผลอเรียกแบบไม่ล็อก)

// แนบไฟล์แบบล็อกใบผลสอบไว้ก่อน (เหตุผลเรื่องล็อกดูที่ examResults.repository.js → lockExamResultRow)
//
// checkBeforeSave(current, fileCount) = ฟังก์ชันจาก controller — ตัดสินว่ายังแนบได้ไหม (ไม่ได้ให้ throw)
//   current   = ใบล่าสุดตอนถือล็อก (null = ใบถูกลบไปแล้ว)
//   fileCount = ใบนี้มีไฟล์อยู่แล้วกี่ไฟล์ ตอนถือล็อก (นับตอนนี้แม่นเสมอ — คนอื่นแนบแทรกไม่ได้จนกว่าเราจะเสร็จ)
// ล็อกแทน "บันทึกก่อนแล้วนับซ้ำทีหลัง" แบบเดิม: กดแนบพร้อมกัน 10 ไฟล์จะเข้าแถวทีละไฟล์ ไฟล์ที่ 6 เป็นต้นไปถูกปฏิเสธ
// และผู้ตรวจที่กดยืนยันพร้อมกันพอดี จะเห็นไฟล์ใหม่นี้ (ชุดไฟล์เปลี่ยน → 409) หรือไม่ก็เรารอเขายืนยันเสร็จแล้วถูกปฏิเสธ
export const createWithLock = (data, checkBeforeSave) =>
  prisma.$transaction(async (tx) => {
    await lockExamResultRow(tx, data.result_id);

    const current = await tx.examResult.findUnique({
      where: { result_id: Number(data.result_id) },
      select: { result_id: true, staff_status: true },
    });
    const fileCount = await tx.certificate.count({
      where: { result_id: Number(data.result_id) },
    });
    checkBeforeSave(current, fileCount);

    return tx.certificate.create({ data });
  });

// ลบไฟล์ (แถวใน DB) แบบล็อกใบผลสอบไว้ก่อน — กันลบไฟล์ของใบที่เจ้าหน้าที่เพิ่งกดยืนยันพอดี
// checkBeforeSave(current) = ฟังก์ชันจาก controller — ไม่ผ่านให้ throw (ไม่มีอะไรถูกลบ)
// ใช้ deleteMany ไม่ใช่ delete: ถ้าไฟล์ถูกลบไปแล้ว (กดลบพร้อมกัน 2 แท็บ) ได้ count = 0 แทนที่จะพังเป็น error
// คืน count ให้ controller ตัดสินว่าตอบ 404 ไหม · ไฟล์บน disk ให้ controller ลบ "หลัง" transaction สำเร็จเท่านั้น
export const removeWithLock = (certificate_id, result_id, checkBeforeSave) =>
  prisma.$transaction(async (tx) => {
    await lockExamResultRow(tx, result_id);

    const current = await tx.examResult.findUnique({
      where: { result_id: Number(result_id) },
      select: { result_id: true, staff_status: true },
    });
    checkBeforeSave(current);

    const { count } = await tx.certificate.deleteMany({
      where: { certificate_id: Number(certificate_id), result_id: Number(result_id) },
    });
    return count;
  });
