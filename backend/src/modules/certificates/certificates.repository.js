import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

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

// เอกสารประเภทเดียวกันของผลสอบใบเดียวกัน — ใช้หาใบเก่าตอนนักศึกษาอัปโหลดทับ
export const findByResultAndType = (result_id, certificate_type) =>
  prisma.certificate.findMany({
    where: { result_id: Number(result_id), certificate_type },
  });

export const removeById = (id) =>
  prisma.certificate.delete({ where: { certificate_id: Number(id) } });
