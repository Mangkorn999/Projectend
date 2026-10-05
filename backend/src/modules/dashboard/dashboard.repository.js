import prisma from "../../config/db.js";
import { calcGraduationYear } from "../../utils/academicYear.js";

const NEWEST_FIRST = [{ academic_year: "desc" }, { attempt_number: "desc" }];

// รอบที่ควรโชว์เมื่อเจ้าหน้าที่เปิด dashboard โดยไม่ได้เลือกรอบเอง
// เอารอบที่เปิดรับอยู่ก่อน — เจ้าหน้าที่เข้ามาดูเพราะอยากรู้ว่ารอบนี้กรอกกันถึงไหนแล้ว
// ถ้าไม่มีรอบเปิด ค่อยถอยไปรอบล่าสุด
// ?? อ่านว่า "ถ้าฝั่งซ้ายเป็น null/undefined ให้ใช้ฝั่งขวาแทน"
// = หารอบที่เปิดอยู่ก่อน ไม่เจอค่อยเอารอบล่าสุด
export const findDefaultRound = async () =>
  (await prisma.submissionRound.findFirst({
    where: { status: "open" },
    orderBy: NEWEST_FIRST,
  })) ??
  (await prisma.submissionRound.findFirst({ orderBy: NEWEST_FIRST }));

// ทุกรอบของปีการศึกษาที่ระบุ — ใช้ทำหน้าเลือกรอบและสรุปทั้งปี
export const findRoundsByYears = (years) =>
  prisma.submissionRound.findMany({
    where: { academic_year: { in: years } },
    orderBy: NEWEST_FIRST,
  });

// ปีการศึกษาที่มีรอบอยู่จริง เรียงใหม่ไปเก่า — ใช้เลือกว่าจะย้อนหลังกี่ปี
export const findAcademicYears = async () => {
  const rows = await prisma.submissionRound.findMany({
    distinct: ["academic_year"],
    select: { academic_year: true },
    orderBy: { academic_year: "desc" },
  });
  return rows.map((r) => r.academic_year);
};

// หารอบตาม id
export const findRoundById = (id) =>
  prisma.submissionRound.findUnique({ where: { round_id: Number(id) } });

// รหัสนักศึกษาที่ "นำเข้าแล้วแต่ยังไม่เคยเข้าระบบกรอกโปรไฟล์" (ยังไม่มีแถวใน students) ของรุ่นนั้น
// คนกลุ่มนี้เป็นสมาชิกของรุ่นแล้ว (เจ้าหน้าที่นำเข้ารายชื่อ) ต้องนับเป็น "ยังไม่กรอก" ไม่ใช่หายไปจากสถิติ
// ไม่งั้นตัวหารต่ำเกินจริง → % ผ่านสูงเกินจริงในตัวเลขที่ส่งสภาการพยาบาล
// ปีของรุ่น = ปีที่เจ้าหน้าที่ระบุตอนนำเข้า (import_academic_year) ถ้าไม่ระบุใช้รหัส + 4 (กฎเดียวกับตอนกรอกโปรไฟล์)
export const findPendingStudentIdsByYear = async (academicYear) => {
  const accounts = await prisma.user.findMany({
    where: { role: { role_name: "student" }, student: null },
    select: { psu_passport_id: true, import_academic_year: true },
    orderBy: { psu_passport_id: "asc" },
  });
  const ids = [];
  for (const account of accounts) {
    let year = account.import_academic_year;
    if (year === null) {
      try {
        year = calcGraduationYear(account.psu_passport_id);
      } catch {
        continue; // รหัสผิดรูปแบบ คำนวณปีไม่ได้ — ข้าม ไม่ให้ dashboard ทั้งหน้าพัง
      }
    }
    if (year === academicYear) ids.push(account.psu_passport_id);
  }
  return ids;
};

// นับนักศึกษาของรุ่นนั้น (กรองด้วย academic_year ของรอบ) = คนที่กรอกโปรไฟล์แล้ว + บัญชีที่นำเข้าแต่ยังไม่เข้าระบบ
export const countStudentsByYear = async (academicYear) => {
  const registered = await prisma.student.count({ where: { academic_year: academicYear } });
  const pendingIds = await findPendingStudentIdsByYear(academicYear);
  return registered + pendingIds.length;
};

// นับเฉพาะคนที่เจ้าหน้าที่เปิดสิทธิ์ให้กรอกแล้ว — คนที่ยังไม่เปิดสิทธิ์กรอกไม่ได้
// เอาไปเป็นตัวหารของ fillRate ไม่งั้น % จะต่ำเพราะคนที่ระบบยังไม่ให้กรอก
export const countEligibleByYear = (academicYear) =>
  prisma.student.count({
    where: { academic_year: academicYear, exam_eligible: true },
  });

// จำนวนนักศึกษาของรุ่นนั้น แยกตามห้องเรียน — ใช้เป็นตัวหารของตารางแยกห้อง
// นับจากตาราง students ตรงๆ ไม่ใช่นับจากคนที่ส่งผล คนไม่ส่งผลก็ต้องอยู่ในตัวหารด้วย
export const countStudentsByRoom = async (academicYear) => {
  const rows = await prisma.student.groupBy({
    by: ["room_id"],
    where: { academic_year: academicYear },
    _count: { student_id: true },
  });

  const roomIds = rows.map((r) => r.room_id);
  const rooms = await prisma.room.findMany({
    where: { room_id: { in: roomIds } },
    select: { room_id: true, room_name: true },
  });

  const nameOf = new Map(rooms.map((r) => [r.room_id, r.room_name]));
  return rows
    .map((r) => ({
      room_id: r.room_id,
      room_name: nameOf.get(r.room_id) || `ห้อง ${r.room_id}`,
      total: r._count.student_id,
    }))
    .sort((a, b) => a.room_id - b.room_id);
};

// รายวิชาทั้งหมด — เรียงตามรหัสวิชา
export const findAllSubjects = () =>
  prisma.subject.findMany({ orderBy: { subject_code: "asc" } });

// นักศึกษาที่เปิดสิทธิ์กรอกของรุ่นนั้น พร้อมวิชาที่แต่ละคนผ่านไปแล้ว "ก่อนถึงรอบนี้"
// ใช้หา "รอบนี้ยังมีสิทธิ์กรอกกี่คน" — คนที่ผ่านครบทุกวิชาของรอบแล้วเปิดฟอร์มไม่ได้อีก
//
// นับเฉพาะรอบที่มาก่อนรอบนี้จริงๆ (ปีเก่ากว่า หรือปีเดียวกันแต่ครั้งที่สอบน้อยกว่า)
// ห้ามนับรอบที่มาทีหลัง ไม่งั้นจะเอาผลอนาคตมาตัดสินอดีต: คนที่ผ่านครบตอนรอบ 2
// จะถูกมองว่า "ผ่านครบแล้ว" ตั้งแต่ตอนคำนวณรอบ 1 ทำให้รอบ 1 มีคนกรอกได้น้อยกว่ารอบ 2
// (findPassedSubjectIds ฝั่ง examResults ตัดแค่รอบปัจจุบันพอ เพราะตอนนักศึกษากดส่ง
//  รอบถัดไปยังไม่เกิดขึ้น — แต่ dashboard ย้อนดูรอบเก่าได้ เลยต้องกรองด้วยลำดับเวลา)
//
// เงื่อนไขอื่นตรงกับ findPassedSubjectIds: ตัดใบที่ถูกตีกลับ, ไม่นับแถวที่ยกผลมา (carried_forward),
// วิชาที่ผ่านแล้วผ่านข้ามปีได้ — ต้องตรงกัน ไม่งั้นคิวตรวจจะมองว่าคนนี้ "ผ่านครบแล้ว"
// ทั้งที่หน้ากรอกของนักศึกษายังบังคับให้กรอกวิชานั้นใหม่ (เพราะใบต้นทางถูกตีกลับ — บั๊ก B1)
export const findEligibleWithPassedSubjects = async (round) => {
  const students = await prisma.student.findMany({
    where: { academic_year: round.academic_year, exam_eligible: true },
    select: { student_id: true },
  });
  if (students.length === 0) return [];

  const rows = await prisma.subjectResult.findMany({
    where: {
      is_passed: true,
      carried_forward: false,
      exam_result: {
        student_id: { in: students.map((s) => s.student_id) },
        staff_status: { not: "rejected" },
        round: {
          OR: [
            { academic_year: { lt: round.academic_year } },
            {
              academic_year: round.academic_year,
              attempt_number: { lt: round.attempt_number },
            },
          ],
        },
      },
    },
    select: { subject_id: true, exam_result: { select: { student_id: true } } },
  });

  const passedBy = new Map(); // student_id -> Set(subject_id)
  for (const row of rows) {
    const id = row.exam_result.student_id;
    if (!passedBy.has(id)) passedBy.set(id, new Set());
    passedBy.get(id).add(row.subject_id);
  }

  return students.map((s) => ({
    student_id: s.student_id,
    passed_subject_ids: [...(passedBy.get(s.student_id) ?? [])],
  }));
};

// ผลสอบทั้งหมดในรอบ + ผลรายวิชา (ใช้คำนวณสถิติ)
// ไม่กรอง exam_eligible — ตัวหารของสถิติคือ "นักศึกษาทั้งรุ่นที่ import เข้าระบบ"
// (= ผู้สำเร็จการศึกษาปีนั้น ตามสูตรที่คณะส่งสภาการพยาบาล) ไม่ใช่คนที่เปิดสิทธิ์อยู่ตอนนี้
// ถ้ากรอง คนที่ส่งผลไปแล้วแต่โดนถอนสิทธิ์ทีหลังจะหายจากสถิติ ทั้งที่สอบผ่านจริง
export const findResultsByRound = (roundId) =>
  prisma.examResult.findMany({
    where: { round_id: Number(roundId) },
    include: {
      subject_results: true,
      student: {
        select: {
          student_id: true,
          academic_year: true,
          room: { select: { room_id: true, room_name: true } },
          user: { select: { first_name: true, last_name: true } },
        },
      },
    },
    orderBy: { student_id: "asc" },
  });

// นักศึกษาทั้งรุ่น (ทุกคนที่ import เข้ามา) พร้อมชื่อ (ไทย/อังกฤษ) ห้อง เบอร์โทร อีเมล
// ใช้ทำรายชื่อ export ผ่าน/ไม่ผ่านครั้งแรก และผ่าน/ไม่ผ่านภายในปีแรก
// ต้องดึงทั้งรุ่น ไม่ใช่เฉพาะคนที่มีใบผลสอบ: "ไม่ผ่าน" รวมคนที่ยังไม่ส่งผลด้วย (ตัวหารของ % คือทั้งรุ่น)
// เลือกเฉพาะ field ที่ต้องใช้ (select) — ห้ามเพิ่ม password_hash หรือข้อมูลรหัสผ่านใดๆ เพราะไฟล์ส่งออกถูกส่งต่อกันในคณะ
export const findStudentsByYear = async (academicYear) => {
  const registered = await prisma.student.findMany({
    where: { academic_year: academicYear },
    select: {
      student_id: true,
      first_name_en: true,
      last_name_en: true,
      room: { select: { room_name: true } },
      user: {
        select: { first_name: true, last_name: true, email: true, phone: true },
      },
    },
    orderBy: { student_id: "asc" },
  });

  // บัญชีที่นำเข้าแล้วแต่ยังไม่เข้าระบบ — มีแค่รหัสนักศึกษา ช่องอื่นว่าง (ยังไม่มีข้อมูลโปรไฟล์)
  // ต้องอยู่ในรายชื่อ "ไม่ผ่าน" เพราะนับเป็นสมาชิกของรุ่น (ตัวหารเดียวกับสถิติ)
  const pendingIds = await findPendingStudentIdsByYear(academicYear);
  const rows = [...registered];
  for (const id of pendingIds) {
    rows.push({
      student_id: id,
      first_name_en: "",
      last_name_en: "",
      room: null,
      user: { first_name: "", last_name: "", email: "", phone: "" },
    });
  }
  rows.sort((a, b) => (a.student_id < b.student_id ? -1 : a.student_id > b.student_id ? 1 : 0));
  return rows;
};
