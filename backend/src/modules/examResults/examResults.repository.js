import prisma from "../../config/db.js";

// ค่าที่ใช้ในคอลัมน์สถานะ (ใช้ให้ตรงกันทั้งระบบ)
export const STUDENT_STATUS = { DRAFT: "draft", SUBMITTED: "submitted" };
export const STAFF_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

// ก้อน include ที่ใช้ซ้ำ 5 ที่ในไฟล์นี้ — บอก Prisma ว่าให้ดึงตารางที่เกี่ยวข้องมาด้วย
// เขียนไว้ที่เดียว เวลาแก้จะได้ไม่ต้องไล่แก้ทั้ง 5 จุด
// เวลาเอาไปใช้จะเจอ { ...withDetails, student } — เครื่องหมาย ... (spread)
// แปลว่า "ก๊อปทุก key ในก้อนนี้มาวางตรงนี้" = round, subject_results, certificates, student
const withDetails = {
  round: true,
  subject_results: { include: { subject: true } },
  certificates: true,
};

// ดึงเฉพาะ field ที่ต้องใช้แสดงผล ไม่เอาทั้ง record มาทั้งก้อน
const studentSafeSelect = {
  select: {
    student_id: true,
    academic_year: true,
    exam_eligible: true,
    room: true,
    user: {
      select: { user_id: true, first_name: true, last_name: true, email: true },
    },
  },
};

// หาผลสอบของนักศึกษาในรอบนั้น — ใช้กันกรอกซ้ำรอบเดิม
// findUnique ได้เพราะ schema ประกาศ @@unique([student_id, round_id]) ไว้แล้ว
// ชื่อ key `student_id_round_id` เป็นชื่อที่ Prisma ตั้งให้เอง = เอาชื่อคอลัมน์ใน @@unique มาต่อกันด้วย _
export const findByStudentAndRound = (student_id, round_id) =>
  prisma.examResult.findUnique({
    where: {
      student_id_round_id: { student_id, round_id: Number(round_id) },
    },
  });

// วิชาที่นักศึกษาคนนี้เคยสอบผ่านมาแล้ว (จากรอบอื่น) — ไม่ต้องกรอกซ้ำอีก
// ไม่ต้องกรองปี เพราะนักศึกษา 1 คนอยู่รุ่นเดียว รอบที่เคยกรอกคือรอบของรุ่นตัวเองอยู่แล้ว
//
// excludeRoundId = รอบที่กำลังจะกรอก/กำลังดูอยู่ ต้องตัดออกเสมอ
// ไม่งั้นใบของรอบนี้เองที่ถูกตีกลับ จะย้อนกลับมาล็อกวิชาที่ตัวเองเพิ่งติ๊กผ่าน
// กลายเป็น "ผ่านแล้วจากรอบก่อน" ทั้งที่ยังไม่มีรอบก่อน แล้วแก้ผลไม่ได้
//
// ตัวช่วยข้างล่างสร้าง "เงื่อนไขตัดรอบนั้นออก" ให้ Prisma:
//   ส่ง excludeRoundId มา  → ได้ { NOT: { round_id: 5 } }
//   ไม่ส่งมา (null)        → ได้ {} ก้อนว่าง = ไม่กรองอะไรเพิ่ม
const buildExcludeRound = (excludeRoundId) => {
  if (!excludeRoundId) {
    return {};
  }
  return { NOT: { round_id: Number(excludeRoundId) } };
};

export const findPassedSubjectIds = async (student_id, excludeRoundId = null) => {
  const rows = await prisma.subjectResult.findMany({
    where: {
      is_passed: true,
      // นับเฉพาะวิชาที่ "สอบจริงแล้วผ่าน" — ไม่นับแถวที่ยกผลมาจากรอบก่อน (carried_forward) (บั๊ก B1)
      // เหตุผล: แถวยกมาเป็นแค่สำเนาของผลในใบต้นทาง ถ้าใบต้นทางถูกตีกลับภายหลัง
      //   (เช่น รอบ 1 ยังรอตรวจตอนเปิดรอบ 2 → รอบ 2 ยกวิชา A มาเป็นผ่าน → แล้วเจ้าหน้าที่ตีกลับใบรอบ 1)
      //   สำเนาในรอบ 2 ยังค้างเป็น "ผ่าน" ทำให้รอบ 3 ล็อกวิชา A เป็นผ่านทั้งที่หลักฐานถูกตีกลับไปแล้ว
      // ตัดแถวยกมาทิ้งแล้วไม่เสียอะไร: ถ้าใบต้นทางยังดีอยู่ แถวผ่านจริงในใบต้นทางก็ถูกนับที่นี่อยู่แล้ว
      carried_forward: false,
      exam_result: {
        student_id,
        // ใบที่ถูกตีกลับไม่นับเป็นผ่าน — ผลในใบนั้นยังเชื่อไม่ได้
        // ไม่งั้นใบรอบก่อนที่โดนตีกลับ จะย้อนมาล็อกวิชาในรอบถัดไปแบบแก้ไม่ได้เลย
        //
        // ส่วน pending (ส่งแล้วรอเจ้าหน้าที่ตรวจ) ยังนับให้ — ไม่งั้นเปิดรอบถัดไป
        // ก่อนเจ้าหน้าที่ตรวจเสร็จ นักศึกษาต้องมากรอกวิชาที่เพิ่งผ่านซ้ำอีกรอบ
        staff_status: { not: "rejected" },
        // เงื่อนไขเพิ่มเติม: ไม่เอาผลของรอบที่กำลังกรอกอยู่ (ถ้าผู้เรียกส่ง excludeRoundId มา)
        // ...(spread) = แกะ key ใน object ก้อนนี้มาแปะรวมกับ key ข้างบน
        // ก้อนว่าง {} แปะแล้วไม่เพิ่มเงื่อนไขอะไรเลย
        ...buildExcludeRound(excludeRoundId),
      },
    },
    select: { subject_id: true },
  });
  // วิชาเดียวกันอาจผ่านซ้ำได้หลายรอบ (copy-forward) ตัดซ้ำออกก่อนคืน
  // อ่านบรรทัดล่างจากในออกนอก 3 ชั้น:
  //   1. rows.map(...)  → เอาเฉพาะ subject_id ออกมา เช่น [1, 2, 2, 3]
  //   2. new Set(...)   → Set คือกล่องที่ห้ามมีของซ้ำ ได้ Set {1, 2, 3}
  //   3. [... ]         → แปลง Set กลับเป็น array ธรรมดา [1, 2, 3]
  return [...new Set(rows.map((r) => r.subject_id))];
};

// ฝั่งเจ้าหน้าที่ — ดูผลสอบทุกคน กรองได้ตามรอบ/สถานะ/นักศึกษา
// ({ a, b } = {}) = รับ object 1 ก้อนแล้วแกะออกเป็นตัวแปรทันที
//   ส่วน = {} ข้างหลัง คือค่าตั้งต้น กันเรียก findAll() เปล่าๆ แล้วพังเพราะแกะ undefined ไม่ได้
export const findAll = ({ round_id, staff_status, student_id } = {}) => {
  const where = {};
  if (round_id) where.round_id = Number(round_id);
  if (staff_status) where.staff_status = staff_status;
  if (student_id) where.student_id = student_id;

  return prisma.examResult.findMany({
    where,
    include: { ...withDetails, student: studentSafeSelect },
    orderBy: { submitted_at: "desc" },
  });
};

// เจ้าหน้าที่ยืนยัน/ตีกลับ — ทำได้แค่ตอนใบยังเป็น "pending" (ยังไม่มีใครตรวจ) เท่านั้น
// updateMany (ไม่ใช่ update) เพราะต้องใส่เงื่อนไข staff_status ลง where ได้ด้วย (optimistic guard กัน 2 คนตรวจใบเดียวกันทับกัน)
// update ธรรมดารับ where เฉพาะ unique field เท่านั้น ใส่เงื่อนไขสถานะเพิ่มไม่ได้
export const updateStaffStatusIfPending = (result_id, { staff_status, remark, confirmed_by }) =>
  prisma.examResult.updateMany({
    where: { result_id: Number(result_id), staff_status: STAFF_STATUS.PENDING },
    data: {
      staff_status,
      remark: remark ?? null,
      confirmed_by,
      confirmed_at: new Date(),
    },
  });

// ถอนการยืนยัน (เจ้าหน้าที่ยืนยันผิด) — approved → pending ให้ตรวจใหม่ได้
// updateMany + where staff_status = approved: ถ้ามีใครถอน/แก้ไปก่อนแล้ว count = 0 (กดซ้ำ/กดพร้อมกันไม่ทับกัน)
// ล้าง confirmed_by/at เหมือนตอน resubmit — ใบกลับไปเป็น "ยังไม่มีใครตรวจ" จริงๆ ประวัติเก็บไว้ที่ review_logs
export const revokeApprovalIfApproved = (result_id) =>
  prisma.examResult.updateMany({
    where: { result_id: Number(result_id), staff_status: STAFF_STATUS.APPROVED },
    data: {
      staff_status: STAFF_STATUS.PENDING,
      remark: null,
      confirmed_by: null,
      confirmed_at: null,
    },
  });

export const findByStudent = (student_id) =>
  prisma.examResult.findMany({
    where: { student_id },
    include: withDetails,
    orderBy: { submitted_at: "desc" },
  });

export const findById = (result_id) =>
  prisma.examResult.findUnique({
    where: { result_id: Number(result_id) },
    include: withDetails,
  });

// แปลงผลรายวิชาให้อยู่ในรูปที่ Prisma รับ — ใช้ทั้งตอนสร้างใหม่และตอนส่งทับ
const toSubjectRows = (subjectResults) =>
  subjectResults.map((s) => ({
    subject_id: Number(s.subject_id),
    is_passed: Boolean(s.is_passed),
    carried_forward: Boolean(s.carried_forward),
  }));

// ส่งใหม่หลังโดนตีกลับ — ทับผลรายวิชาชุดเดิม แล้วกลับไปเข้าคิวรอตรวจ
// ล้าง remark กับคนที่เคยตรวจทิ้ง ไม่งั้นใบที่แก้แล้วยังติดเหตุผลตีกลับรอบก่อนค้างอยู่
//
// ต้องกันใบที่ "ยืนยันแล้ว" ตรงนี้ด้วย ไม่ใช่เช็คแค่ใน controller
// controller เช็คแล้วค่อยมาเรียกฟังก์ชันนี้ — ระหว่างนั้นเจ้าหน้าที่อาจกดยืนยันพอดี
// ถ้าไม่มีด่านนี้ นักศึกษาจะเขียนทับใบที่ยืนยันแล้วและใบกลับไปเป็น "รอตรวจ" (ล็อกหลุด)
// ใช้ updateMany + where staff_status ≠ approved ใน transaction เดียว — count = 0 แปลว่าใบถูกยืนยันไปก่อน
export const resubmitWithSubjects = (result_id, subjectResults) =>
  prisma.$transaction(async (tx) => {
    const { count } = await tx.examResult.updateMany({
      where: {
        result_id: Number(result_id),
        staff_status: { not: STAFF_STATUS.APPROVED },
      },
      data: {
        staff_status: STAFF_STATUS.PENDING,
        remark: null,
        confirmed_by: null,
        confirmed_at: null,
        submitted_at: new Date(),
      },
    });
    if (count === 0) {
      const err = new Error("เจ้าหน้าที่ยืนยันผลสอบรอบนี้แล้ว แก้ไขไม่ได้");
      err.statusCode = 409;
      throw err;
    }

    // ลบผลรายวิชาเดิมทั้งชุดแล้วใส่ชุดใหม่
    await tx.subjectResult.deleteMany({ where: { result_id: Number(result_id) } });
    await tx.subjectResult.createMany({
      data: toSubjectRows(subjectResults).map((row) => ({
        ...row,
        result_id: Number(result_id),
      })),
    });

    return tx.examResult.findUnique({
      where: { result_id: Number(result_id) },
      include: withDetails,
    });
  });

// สร้าง exam_result + subject_results พร้อมกันใน transaction เดียว
// (nested create ของ Prisma เป็น transaction ให้อยู่แล้ว)
export const createWithSubjects = (
  { student_id, round_id, student_status, staff_status },
  subjectResults,
) =>
  prisma.examResult.create({
    data: {
      student_id,
      round_id: Number(round_id),
      student_status,
      staff_status,
      subject_results: {
        create: toSubjectRows(subjectResults),
      },
    },
    include: withDetails,
  });
