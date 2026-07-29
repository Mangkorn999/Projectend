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
