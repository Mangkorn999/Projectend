import prisma from "../../config/db.js";

// ประเภทเอกสารตามรายงาน
export const CERTIFICATE_TYPE = {
  EXAM_RESULT: "exam_result", // ใบผลสอบ
  LICENSE: "license", // ใบประกอบวิชาชีพ
};

export const create = (data) => prisma.certificate.create({ data });

export const findByResult = (result_id) =>
  prisma.certificate.findMany({
    where: { result_id: Number(result_id) },
    orderBy: { uploaded_at: "desc" },
  });

export const findById = (id) =>
  prisma.certificate.findUnique({ where: { certificate_id: Number(id) } });

// นับว่าใบผลสอบใบนี้แนบไฟล์ไว้แล้วกี่ไฟล์ — ใช้กันแนบเกินจำนวนที่กำหนด (5 ไฟล์ต่อใบ)
export const countByResult = (result_id) =>
  prisma.certificate.count({ where: { result_id: Number(result_id) } });

export const removeById = (id) =>
  prisma.certificate.delete({ where: { certificate_id: Number(id) } });
