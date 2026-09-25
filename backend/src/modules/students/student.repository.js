import prisma from "../../config/db.js";

// ข้อมูล user ที่ส่งออกได้ — ห้ามมี password_hash เด็ดขาด
const PUBLIC_USER_FIELDS = {
  user_id: true,
  psu_passport_id: true,
  first_name: true,
  last_name: true,
  email: true,
  phone: true,
};

export const findAll = () => {
  return prisma.student.findMany({
    include: { user: { select: PUBLIC_USER_FIELDS }, faculty: true, room: true },
    // ต้องเรียงเอง — ไม่ใส่ Postgres คืนตามลำดับที่เก็บจริงบน disk ซึ่งเปลี่ยนทุกครั้งที่ UPDATE
    // (แก้ข้อมูลนักศึกษาคนหนึ่งแล้วแถวของเขาโดดไปท้ายตาราง) — รุ่นใหม่ก่อน แล้วเรียงตามรหัส
    orderBy: [{ academic_year: "desc" }, { student_id: "asc" }],
  });
};

// นักศึกษาที่ผล (ใบที่ยืนยันแล้วเท่านั้น) ตรงตาม subject_code+passed — ใช้ทำ export รายชื่อ
// จากปุ่ม "ผ่าน/ไม่ผ่าน" ในการ์ดอัตราผ่านรายวิชาที่ Dashboard — กติกาเดียวกับที่ dashboard.service.js ใช้คำนวณตัวเลขบัตร
//
// roundId ระบุ = ดูรอบเดียว (1 คนมีได้ใบเดียวต่อรอบอยู่แล้ว ไม่ต้องกันซ้ำ)
// year ระบุ (ไม่มี roundId) = "รวมทั้งปี" — 1 คนสอบได้หลายรอบในปีเดียว ต้องยุบเหลือคนละ 1 แถว
// ตามสถานะสุดท้าย (เคยผ่านสักรอบ = ถือว่าผ่าน, ไม่ carried_forward = สอบจริงไม่ใช่ยกผลมา)
export const findMatchingSubjectResult = async ({ subjectCode, passed, roundId, year }) => {
  const where = roundId
    ? { round_id: roundId, staff_status: "approved" }
    : { staff_status: "approved", round: { academic_year: year } };

  const results = await prisma.examResult.findMany({
    where,
    include: {
      student: { include: { user: { select: PUBLIC_USER_FIELDS }, room: true } },
      subject_results: { include: { subject: true } },
    },
  });

  if (roundId) {
    return results
      .filter((r) =>
        r.subject_results.some(
          (sr) => sr.subject.subject_code === subjectCode && sr.is_passed === passed && !sr.carried_forward,
        ),
      )
      .map((r) => ({ student: r.student, submitted_at: r.submitted_at }));
  }

  // รวมทั้งปี — ยุบใบหลายรอบของคนเดียวกันให้เหลือคนละ 1 แถว
  const byStudent = new Map(); // student_id -> { student, everPassed, latestSubmittedAt }
  for (const r of results) {
    const hit = r.subject_results.find(
      (sr) => sr.subject.subject_code === subjectCode && !sr.carried_forward,
    );
    if (!hit) continue;
    if (!byStudent.has(r.student_id)) {
      byStudent.set(r.student_id, { student: r.student, everPassed: false, submitted_at: r.submitted_at });
    }
    const entry = byStudent.get(r.student_id);
    if (hit.is_passed) entry.everPassed = true;
    if (r.submitted_at > entry.submitted_at) entry.submitted_at = r.submitted_at;
  }
  return [...byStudent.values()]
    .filter((s) => s.everPassed === passed)
    .map((s) => ({ student: s.student, submitted_at: s.submitted_at }));
};
export const findById = (id) =>
  prisma.student.findUnique({
    where: { student_id: id },
    include: { user: { select: PUBLIC_USER_FIELDS }, faculty: true, room: true },
  });

export const bulkSetEligible = (studentIds, value) =>
  prisma.student.updateMany({
    where: { student_id: { in: studentIds } },
    data: { exam_eligible: value },
  });

export const findRoleByName = (role_name) =>
  prisma.role.findFirst({ where: { role_name } });

export const findFaculty = () => prisma.faculty.findFirst();

export const findAllRooms = () => prisma.room.findMany({ orderBy: { room_id: "asc" } });

export const findRoomById = (room_id) =>
  prisma.room.findUnique({ where: { room_id } });

export const findByPsuId = (psu_passport_id) =>
  prisma.user.findUnique({ where: { psu_passport_id } });

// รีเซ็ตรหัสผ่านนักศึกษา = ตั้ง hash ใหม่ตรงๆ ไม่ล้างเป็น null และไม่บังคับเปลี่ยน (password นักศึกษา = เลขบัตร ปชช เสมอ)
export const setPassword = (studentId, password_hash) =>
  prisma.user.update({
    where: { psu_passport_id: studentId },
    data: { password_hash },
  });

// สร้างแค่ user จากการ import — รหัสผ่าน = hash(เลขบัตร ปชช) ที่เจ้าหน้าที่กรอกมาตอน import
// ยังไม่สร้าง student row — นักศึกษา login ครั้งแรกแล้วกรอกโปรไฟล์เองผ่าน completeProfile ถึงจะสร้างให้
// import_academic_year = ปีจบที่เจ้าหน้าที่ระบุมา (null = ให้ complete-profile คำนวณจากรหัสเอง)
export const createFromImport = ({ role_id, psu_passport_id, password_hash, import_academic_year = null }) =>
  prisma.user.create({
    data: {
      role_id,
      psu_passport_id,
      password_hash,
      must_change_password: false, // ไม่มี flow ให้ตั้งรหัสใหม่ — เลขบัตร ปชช คือรหัสผ่านถาวร
      import_academic_year,
    },
    select: { user_id: true, psu_passport_id: true, import_academic_year: true },
  });

// นักศึกษากรอกโปรไฟล์ครั้งแรก — update user (ชื่อ/email/เบอร์) + สร้าง student row พร้อมกัน
export const completeProfile = ({
  user_id,
  student_id,
  first_name,
  last_name,
  first_name_en,
  last_name_en,
  email,
  phone,
  faculty_id,
  room_id,
  academic_year,
}) =>
  prisma.user.update({
    where: { user_id },
    data: {
      first_name,
      last_name,
      email,
      phone,
      student: {
        create: {
          student_id,
          faculty_id,
          room_id,
          academic_year,
          first_name_en,
          last_name_en,
        },
      },
    },
    select: { ...PUBLIC_USER_FIELDS, student: true },
  });

// เจ้าหน้าที่แก้ข้อมูลนักศึกษาทีหลัง — แก้ได้ทั้งฝั่ง user (ชื่อ/email/เบอร์) และฝั่ง student (ห้อง/ปีจบ/ชื่ออังกฤษ)
// รับเฉพาะ field ที่ส่งมา (partial update) ผ่าน nested write ในคำสั่งเดียว
export const updateProfile = (student_id, { user: userData, student: studentData }) => {
  // room_id เป็น FK ของ relation `room` — Prisma update ต้องเขียนผ่าน room:{connect}} ไม่ใช่ set scalar ตรงๆ
  const { room_id, ...restStudentData } = studentData;
  return prisma.student.update({
    where: { student_id },
    data: {
      ...restStudentData,
      ...(room_id !== undefined ? { room: { connect: { room_id } } } : {}),
      ...(userData && Object.keys(userData).length > 0
        ? { user: { update: userData } }
        : {}),
    },
    include: { user: { select: PUBLIC_USER_FIELDS }, room: true },
  });
};

// เจ้าหน้าที่ reset บัญชีนักศึกษากลับเป็นยังไม่ตั้งรหัส — ใช้แก้ impersonation/ลืมรหัส
// มีใบผลสอบของนักศึกษาคนนี้อยู่กี่ใบ — ใช้กันลบคนที่มีประวัติสอบไปแล้ว
export const countExamResults = (studentId) =>
  prisma.examResult.count({ where: { student_id: studentId } });

// จำนวนผลสอบของนักศึกษาที่ระบุ — ไว้เตือน/บังคับยืนยันก่อนลบ (ลบแล้วผลสอบและสถิติของรุ่นหายไปด้วย)
export const summarizeResults = async (studentIds) => {
  const rows = await prisma.examResult.groupBy({
    by: ["student_id"],
    where: { student_id: { in: studentIds } },
    _count: { _all: true },
  });
  return {
    studentsWithResults: rows.length,
    resultCount: rows.reduce((n, r) => n + r._count._all, 0),
  };
};

// ลบนักศึกษา "พร้อมทุกอย่างที่ผูกอยู่" — ผลสอบ, ผลรายวิชา, เอกสารหลักฐาน, ประวัติการตรวจ, แจ้งเตือน, ตัวนักศึกษา, บัญชี user
// (เจ้าของระบบตัดสินใจให้ลบได้หมดทุกกรณี รวมคนที่มีผลสอบแล้ว — สถิติของรุ่นจะเปลี่ยนย้อนหลัง controller บังคับให้ยืนยันก่อนเสมอ)
//
// ลำดับต้องลบจากตารางลูกขึ้นมาหาแม่ (FK) และทำใน transaction เดียว — พังกลางทางแล้วย้อนกลับทั้งก้อน ไม่เหลือลบครึ่งๆ กลางๆ
// คืน { deletedIds, resultCount, filePaths } — filePaths = ไฟล์ PDF บน disk ที่ต้องลบตามหลัง transaction สำเร็จ (ลบไฟล์ก่อนแล้ว DB พัง = หลักฐานหาย)
export const removeStudentsCascade = async (studentIds) => {
  const students = await prisma.student.findMany({
    where: { student_id: { in: studentIds } },
    select: { student_id: true, user_id: true },
  });
  if (students.length === 0) return { deletedIds: [], resultCount: 0, filePaths: [] };

  const sids = students.map((x) => x.student_id);
  const uids = students.map((x) => x.user_id);
  const results = await prisma.examResult.findMany({
    where: { student_id: { in: sids } },
    select: { result_id: true },
  });
  const rids = results.map((r) => r.result_id);
  const certs = await prisma.certificate.findMany({
    where: { result_id: { in: rids } },
    select: { file_path: true },
  });

  await prisma.$transaction([
    prisma.reviewLog.deleteMany({ where: { result_id: { in: rids } } }),
    prisma.certificate.deleteMany({ where: { result_id: { in: rids } } }),
    prisma.subjectResult.deleteMany({ where: { result_id: { in: rids } } }),
    prisma.examResult.deleteMany({ where: { result_id: { in: rids } } }),
    prisma.notification.deleteMany({ where: { student_id: { in: sids } } }),
    prisma.student.deleteMany({ where: { student_id: { in: sids } } }),
    prisma.user.deleteMany({ where: { user_id: { in: uids } } }),
  ]);
  return { deletedIds: sids, resultCount: rids.length, filePaths: certs.map((c) => c.file_path) };
};

// บัญชีนักศึกษาที่ import มาแล้วแต่ "ยังไม่กรอกโปรไฟล์" — มีแค่แถว users ยังไม่มีแถว students
// เลยไม่โผล่ในรายชื่อนักศึกษา (findAll) และลบผ่าน DELETE /students/:id ไม่ได้ ทั้งที่อาจเป็นรหัสที่ import ผิด
export const findPendingAccounts = () =>
  prisma.user.findMany({
    where: { role: { role_name: "student" }, student: null },
    select: { user_id: true, psu_passport_id: true, import_academic_year: true, created_at: true },
    orderBy: [{ created_at: "desc" }, { psu_passport_id: "asc" }],
  });

// ลบบัญชีที่ยังไม่กรอกโปรไฟล์ตามรหัสที่ส่งมา — where กันไว้ในตัว: เฉพาะ role นักศึกษาที่ "ยังไม่มีแถว students" เท่านั้น
// คนที่กรอกโปรไฟล์แล้ว (มี student row) จะไม่ถูกลบแม้ส่งรหัสมา ต้องไปลบผ่านหน้านักศึกษา (ซึ่งกันคนที่มีผลสอบไว้ให้)
// ตารางอื่นไม่ได้ชี้มาที่ user กลุ่มนี้ (ไม่มีผลสอบ/แจ้งเตือน/ประกาศ) จึงลบได้ตรงๆ ไม่ติด FK
export const removePendingAccounts = (psuIds) =>
  prisma.user.deleteMany({
    where: { psu_passport_id: { in: psuIds }, role: { role_name: "student" }, student: null },
  });


// ข้อมูลนักศึกษาสำหรับ export Excel — ระบุเป็นรายชื่อ (ids) หรือทั้งรุ่น (year)
// ไม่ดึง national_id (เลขบัตร = รหัสผ่านเริ่มต้น ห้ามหลุดออกไปอยู่ในไฟล์ที่แชร์ต่อได้) และไม่มี password_hash
// ใบผลสอบดึงมาทุกรอบแล้วให้ controller เลือก "ใบล่าสุด" เอง (เรียงตามปี/ครั้งที่สอบของรอบ ไม่ใช่วันที่ส่ง)
export const findForExport = ({ ids, year }) =>
  prisma.student.findMany({
    where: ids ? { student_id: { in: ids } } : { academic_year: year },
    select: {
      student_id: true,
      academic_year: true,
      exam_eligible: true,
      room: { select: { room_name: true } },
      user: { select: { first_name: true, last_name: true, email: true, phone: true } },
      exam_results: {
        select: {
          student_status: true,
          staff_status: true,
          round: { select: { academic_year: true, attempt_number: true } },
          subject_results: { select: { is_passed: true } },
        },
      },
    },
    orderBy: [{ academic_year: "desc" }, { student_id: "asc" }],
  });
