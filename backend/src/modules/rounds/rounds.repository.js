import prisma from "../../config/db.js";

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
// ต้องส่ง academicYear ของนักศึกษามาด้วยเสมอ: รอบเป็นของรุ่นใดรุ่นหนึ่ง
// ไม่งั้นรุ่นอื่นจะเห็นรอบที่ไม่ใช่ของตัวเองแล้วกรอกปนเข้ามา
export const findActive = (academicYear) => {
  const now = new Date();
  return prisma.submissionRound.findFirst({
    where: {
      status: "open",
      open_date: { lte: now },
      close_date: { gte: now },
      academic_year: academicYear,
    },
    // เปิดพร้อมกันหลายรอบในรุ่นเดียวไม่ควรเกิด แต่ถ้าเกิด เอาครั้งล่าสุดไว้ก่อน
    orderBy: { attempt_number: "desc" },
  });
};

// รอบของรุ่นนี้ที่เจ้าหน้าที่ "กดเปิด" ไว้ — ไม่สนว่าถึงวันเปิดรับหรือยัง
//
// ต่างจาก findActive() ตรงไม่กรองวันที่เลย จึงได้รอบที่ยังไม่ถึงกำหนดเปิด (scheduled) มาด้วย
// เอาไว้บอกนักศึกษาว่า "รอบหน้าจะเปิดวันที่ ..." แทนที่จะขึ้นว่าไม่มีรอบเฉยๆ แล้วไม่รู้ว่าต้องรอถึงเมื่อไหร่
//
// ⚠️ ห้ามเอาไปใช้ตอนรับผลสอบเด็ดขาด — ตรงนั้นต้องใช้ findActive() ที่กรองวันที่แล้วเท่านั้น
export const findOpenForYear = (academicYear) =>
  prisma.submissionRound.findFirst({
    where: { status: "open", academic_year: academicYear },
    orderBy: { attempt_number: "desc" },
  });

// หารอบของปีการศึกษานั้น + ครั้งที่นั้น — ใช้กันสร้าง/แก้เป็นรอบซ้ำ
// findUnique ได้เพราะ schema ประกาศ @@unique([academic_year, attempt_number]) ไว้
export const findByYearAndAttempt = (academicYear, attemptNumber) =>
  prisma.submissionRound.findUnique({
    where: {
      academic_year_attempt_number: {
        academic_year: academicYear,
        attempt_number: attemptNumber,
      },
    },
  });

// รอบที่ status = "open" อยู่ตอนนี้ (ทั้งระบบ ไม่แยกรุ่น) — ใช้กันเปิดรอบที่ 2 พร้อมกัน
// ไม่ดูวันที่ ดูแค่ status เพราะเจ้าหน้าที่เป็นคนกดเปิด/ปิดเอง วันที่เป็นแค่ช่วงรับผล
export const findOpen = () =>
  prisma.submissionRound.findFirst({ where: { status: "open" } });

export const create = (data) => prisma.submissionRound.create({ data });

// จำนวนผลสอบที่ผูกกับรอบนี้ — ใช้กันลบรอบที่นักศึกษากรอกไปแล้ว
export const countExamResults = (id) =>
  prisma.examResult.count({ where: { round_id: Number(id) } });

// จำนวนข่าว/ประกาศที่อ้างรอบนี้ — ลบรอบทิ้งจะทำให้ประกาศชี้ไปที่ว่าง
export const countNews = (id) =>
  prisma.news.count({ where: { round_id: Number(id) } });

export const remove = (id) =>
  prisma.submissionRound.delete({ where: { round_id: Number(id) } });

export const update = (id, data) =>
  prisma.submissionRound.update({
    where: { round_id: Number(id) },
    data,
  });
