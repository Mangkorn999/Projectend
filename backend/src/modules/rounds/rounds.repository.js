import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ดึงรอบทั้งหมด — รอบใหม่สุดขึ้นก่อน
export const findAll = () =>
  prisma.submissionRound.findMany({
    orderBy: [{ academic_year: "desc" }, { attempt_number: "desc" }],
  });

export const findById = (id) =>
  prisma.submissionRound.findUnique({
    where: { round_id: Number(id) },
  });

// รอบที่เปิดอยู่จริง ณ ตอนนี้ — status = open และอยู่ในช่วง open_date..close_date
export const findActive = () => {
  const now = new Date();
  return prisma.submissionRound.findFirst({
    where: {
      status: "open",
      open_date: { lte: now },
      close_date: { gte: now },
    },
  });
};

export const create = (data) => prisma.submissionRound.create({ data });

export const update = (id, data) =>
  prisma.submissionRound.update({
    where: { round_id: Number(id) },
    data,
  });
