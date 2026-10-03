import prisma from "../../config/db.js";
import { ACTOR_SELECT, toActor } from "../../utils/actor.js";

// ดึงข่าว — ข่าวใหม่สุดขึ้นก่อน
// ส่ง academicYear มา = เอาเฉพาะประกาศของรุ่นนั้น (ข่าวผูกกับรอบ รอบผูกกับรุ่น)
// ไม่ส่งมา = ทุกประกาศ (เจ้าหน้าที่/ผู้บริหารต้องเห็นครบเพื่อจัดการ)
export const findAll = async (academicYear) => {
  const rows = await prisma.news.findMany({
    where:
      academicYear === undefined
        ? undefined
        : { round: { academic_year: academicYear } },
    orderBy: { posted_at: "desc" },
    include: {
      poster: { select: ACTOR_SELECT },
      updater: { select: ACTOR_SELECT }, // ใครแก้ล่าสุด (ว่าง = ยังไม่เคยแก้)
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

  // ...n = ก๊อปทุก field ของข่าวมา แล้วเขียนทับ poster ด้วยเวอร์ชันที่ตัด hash แล้ว (มี is_closed)
  return rows.map((n) => ({ ...n, poster: toActor(n.poster), updater: toActor(n.updater) }));
};

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
