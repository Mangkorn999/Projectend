import prisma from "../../config/db.js";
import { ACTOR_SELECT, toActor } from "../../utils/actor.js";

// ค่าที่ใช้ในคอลัมน์สถานะ (ใช้ให้ตรงกันทั้งระบบ)
export const STUDENT_STATUS = { DRAFT: "draft", SUBMITTED: "submitted" };
// สถานะที่เจ้าหน้าที่ตั้ง: pending = รอตรวจ, approved = ยืนยัน, rejected = ตีกลับ
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

// วิชาที่นักศึกษาสอบผ่านจริงแล้ว (ไม่นับแถวยกผลมา) — ใช้ล็อกวิชาที่ผ่านแล้วไม่ต้องกรอกซ้ำ
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
export const findAll = async ({ round_id, staff_status, student_id } = {}) => {
  const where = {};
  if (round_id) where.round_id = Number(round_id);
  if (staff_status) where.staff_status = staff_status;
  if (student_id) where.student_id = student_id;

  const rows = await prisma.examResult.findMany({
    where,
    include: {
      ...withDetails,
      student: studentSafeSelect,
      // ใครเป็นคนตรวจล่าสุด + ประวัติการตรวจทุกครั้ง (เก่า → ใหม่) ให้เจ้าหน้าที่/ผู้ช่วยตรวจดูย้อนหลังได้
      // route นี้เข้าได้เฉพาะ officer/reviewer จึงโชว์ชื่อผู้ตรวจได้ (getMine ของนักศึกษาไม่ใช้ฟังก์ชันนี้)
      confirmer: { select: ACTOR_SELECT },
      review_logs: {
        orderBy: { created_at: "asc" },
        include: { reviewer: { select: ACTOR_SELECT } },
      },
    },
    orderBy: { submitted_at: "desc" },
  });

  return rows.map((r) => ({
    ...r,
    confirmer: toActor(r.confirmer),
    review_logs: r.review_logs.map((log) => ({ ...log, reviewer: toActor(log.reviewer) })),
  }));
};

// ─── ล็อกใบผลสอบ (SELECT ... FOR UPDATE) ───────────────────────
//
// ปัญหาที่ต้องกัน: ผู้ตรวจเปิดใบดูอยู่ → นักศึกษาลบไฟล์/ส่งผลใหม่ → ผู้ตรวจกดยืนยัน
// ถ้าต่างคนต่างทำ ระบบจะ "ยืนยัน" ใบที่หน้าตาไม่ตรงกับที่ผู้ตรวจเห็นจริง (เช่น ไฟล์ที่ผู้ตรวจเปิดดูหายไปแล้ว)
//
// วิธีกัน: ทุกงานที่ "เปลี่ยนเนื้อหาใบ" หรือ "ตัดสินใบ" ต้องล็อกแถวของใบนั้นในตาราง exam_results ก่อนเสมอ
//   - ยืนยัน/ตีกลับ (reviewWithLock)
//   - ส่งผลทับใบเดิม (resubmitWithSubjects)
//   - แนบไฟล์ / ลบไฟล์ (certificates.repository.js → createWithLock / removeWithLock)
// FOR UPDATE = "แถวนี้ฉันจองแล้ว" ใครมาขอล็อกแถวเดียวกันต้องรอจนเราจบ transaction (commit/rollback)
// จึงไม่มีทางที่ 2 งานข้างบนทำกับใบเดียวกันพร้อมกันได้ — ต้องเข้าแถวทีละงาน แล้วงานที่มาทีหลังจะเห็นของที่งานแรกทำไปแล้ว
//
// ลำดับล็อกเหมือนกันทุกงาน: ล็อกแถว exam_results ใบเดียวก่อน แล้วค่อยแตะตารางลูก (certificates / subject_results)
// ไม่มีงานไหนล็อก 2 ใบ หรือล็อกตารางลูกก่อน → ไม่เกิด deadlock (ต่างคนต่างรอของที่อีกฝ่ายถืออยู่)
//
// ต้องเรียกภายใน prisma.$transaction เท่านั้น (ส่ง tx มา) — ล็อกจะปล่อยเองตอน transaction จบ
// ใช้ $queryRaw แบบ `...${ค่า}...` (tagged template) Prisma ส่งค่าแยกเป็นพารามิเตอร์ให้เอง ไม่ใช่ต่อข้อความ SQL → ไม่โดน SQL injection
// คืน true = เจอใบและล็อกได้แล้ว, false = ไม่มีใบนี้
export const lockExamResultRow = async (tx, result_id) => {
  const rows = await tx.$queryRaw`SELECT result_id FROM exam_results WHERE result_id = ${Number(result_id)} FOR UPDATE`;
  return rows.length > 0;
};

// เจ้าหน้าที่ยืนยัน/ตีกลับ แบบล็อกใบไว้ก่อน — ทำได้แค่ตอนใบยังเป็น "pending" (ยังไม่มีใครตรวจ) เท่านั้น
//
// checkBeforeSave = ฟังก์ชันที่ controller ส่งมา ใช้ตัดสินว่า "ใบตอนนี้ ยังตรวจได้ไหม" (ยังรอตรวจ + เหมือนที่ผู้ตรวจเห็น)
//   ถูกเรียก "หลังล็อกแล้ว" กับข้อมูลใบล่าสุด (มี submitted_at + รายการไฟล์) — ไม่ผ่านให้ throw ออกมา
//   throw ใน transaction = ยกเลิกทั้งก้อน ไม่มีอะไรถูกบันทึก (error เดิมถูกส่งต่อไปถึง controller)
// ทำแบบนี้เพราะกฎ (ข้อความ error / เทียบอะไรกับอะไร) เป็นเรื่องของ controller แต่ต้องตรวจ "ระหว่างถือล็อก" ซึ่งอยู่ในนี้
//
// updateMany + where staff_status = pending ยังคงไว้เป็นด่านสุดท้าย (optimistic guard เดิม) — คืน count ให้ controller เช็ค
export const reviewWithLock = (result_id, { staff_status, remark, confirmed_by }, checkBeforeSave) =>
  prisma.$transaction(async (tx) => {
    await lockExamResultRow(tx, result_id);

    const current = await tx.examResult.findUnique({
      where: { result_id: Number(result_id) },
      include: { certificates: { select: { certificate_id: true } } },
    });
    checkBeforeSave(current);

    const { count } = await tx.examResult.updateMany({
      where: { result_id: Number(result_id), staff_status: STAFF_STATUS.PENDING },
      data: {
        staff_status,
        remark: remark ?? null,
        confirmed_by,
        confirmed_at: new Date(),
      },
    });
    return count;
  });

// ให้ตรวจใหม่ — ใบที่ตัดสินแล้ว (ยืนยันแล้ว หรือ ถูกตีกลับ) → กลับเป็น pending
// updateMany + where staff_status = fromStatus: ถ้ามีใครแก้/ถอนไปก่อนแล้ว count = 0 (กดซ้ำ/กดพร้อมกันไม่ทับกัน)
// ล้าง remark/confirmed_by/at เหมือนตอน resubmit — ใบกลับไปเป็น "ยังไม่มีใครตรวจ" จริงๆ
// (เหตุผลที่ตีกลับครั้งก่อนไม่ควรค้างให้นักศึกษาเห็น) ประวัติทั้งหมดเก็บไว้ที่ review_logs
export const reopenIfStatus = (result_id, fromStatus) =>
  prisma.examResult.updateMany({
    where: { result_id: Number(result_id), staff_status: fromStatus },
    data: {
      staff_status: STAFF_STATUS.PENDING,
      remark: null,
      confirmed_by: null,
      confirmed_at: null,
    },
  });

// ถอนการยืนยัน (เจ้าหน้าที่ยืนยันผิด) — approved → pending (endpoint เดิม revoke-approval ยังใช้ตัวนี้)
export const revokeApprovalIfApproved = (result_id) =>
  reopenIfStatus(result_id, STAFF_STATUS.APPROVED);

// ใบผลสอบทุกรอบของนักศึกษาคนหนึ่ง เรียงใหม่สุดก่อน
export const findByStudent = (student_id) =>
  prisma.examResult.findMany({
    where: { student_id },
    include: withDetails,
    orderBy: { submitted_at: "desc" },
  });

// ใบผลสอบใบเดียว พร้อมรายวิชา/ไฟล์หลักฐาน
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
//
// ล็อกแถวใบนี้ก่อน (lockExamResultRow) แล้วอ่านสถานะล่าสุด "ระหว่างถือล็อก" — เหมือนฝั่งยืนยัน/แนบไฟล์/ลบไฟล์
// ผู้ตรวจที่กำลังกดยืนยันพร้อมกันพอดีจะต้องรอเราเสร็จก่อน แล้วจะเห็นว่า submitted_at เปลี่ยนไปแล้ว (ได้ 409 ให้โหลดหน้าใหม่)
// submitted_at ถูกตั้งใหม่ทุกครั้งที่ส่งทับ — ฝั่งยืนยันใช้ค่านี้ดูว่า "นักศึกษาแก้ใบหลังจากผู้ตรวจเปิดดูหรือยัง"
//
// mustStillBeRejected = true เมื่อมาทาง "แก้ใบที่ถูกตีกลับหลังปิดรอบ" (fixingRejected)
//   ใบต้องยังถูกตีกลับอยู่จริง ณ ตอนถือล็อก — ถ้ากดส่งแก้ไปแล้ว (ใบกลับเป็นรอตรวจ) ห้ามแก้ซ้ำหลังปิดรอบ
export const resubmitWithSubjects = (result_id, subjectResults, mustStillBeRejected = false) =>
  prisma.$transaction(async (tx) => {
    await lockExamResultRow(tx, result_id);

    const current = await tx.examResult.findUnique({
      where: { result_id: Number(result_id) },
      select: { staff_status: true },
    });
    if (!current || current.staff_status === STAFF_STATUS.APPROVED) {
      const err = new Error("เจ้าหน้าที่ยืนยันผลสอบรอบนี้แล้ว แก้ไขไม่ได้");
      err.statusCode = 409;
      throw err;
    }
    if (mustStillBeRejected && current.staff_status !== STAFF_STATUS.REJECTED) {
      const err = new Error(
        "ขณะนี้ไม่มีรอบกรอกผลสอบที่เปิดอยู่ หากต้องการส่งผลสอบ กรุณาติดต่อเจ้าหน้าที่คณะ",
      );
      err.statusCode = 400;
      throw err;
    }

    await tx.examResult.update({
      where: { result_id: Number(result_id) },
      data: {
        staff_status: STAFF_STATUS.PENDING,
        remark: null,
        confirmed_by: null,
        confirmed_at: null,
        submitted_at: new Date(),
      },
    });

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
