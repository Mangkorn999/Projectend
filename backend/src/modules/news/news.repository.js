import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ดึงข่าวทั้งหมด — ข่าวใหม่สุดขึ้นก่อน
export const findAll = () =>
  prisma.news.findMany({
    orderBy: { posted_at: "desc" },
    include: {
      poster: { select: { user_id: true, first_name: true, last_name: true } },
      round: {
        select: {
          round_id: true,
          academic_year: true,
          attempt_number: true,
          status: true,
        },
      },
    },
  });

// หาข่าวรายตัว (ใช้เช็คว่ามีจริงก่อน update/delete)
export const findById = (id) =>
  prisma.news.findUnique({ where: { news_id: Number(id) } });

// สร้างข่าวใหม่
export const create = (data) => prisma.news.create({ data });

// แก้ไขข่าว
export const update = (id, data) =>
  prisma.news.update({ where: { news_id: Number(id) }, data });

// ลบข่าว
export const remove = (id) =>
  prisma.news.delete({ where: { news_id: Number(id) } });
