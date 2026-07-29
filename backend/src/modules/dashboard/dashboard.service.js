import * as dashRepo from "./dashboard.repository.js";

// ปัดเป็น % จำนวนเต็ม กันหารด้วย 0
const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

// รวมสถิติของ 1 รอบ — ใช้ทั้ง /stats และ /export
export const buildStats = async (roundId) => {
  // ไม่ส่ง round_id มา → ใช้รอบล่าสุด
  const round = roundId
    ? await dashRepo.findRoundById(roundId)
    : await dashRepo.findLatestRound();

  if (!round) {
    const err = new Error("ไม่พบรอบการกรอกผลสอบ");
    err.statusCode = 404;
    throw err;
  }

  const [total, subjects, results] = await Promise.all([
    dashRepo.countStudentsByYear(round.academic_year),
    dashRepo.findAllSubjects(),
    dashRepo.findResultsByRound(round.round_id),
  ]);

  // แยกสถานะ — draft ยังไม่ส่ง, ที่เหลือดูจาก staff_status
  const by = { draft: 0, submitted: 0, approved: 0, rejected: 0 };
  for (const r of results) {
    if (r.student_status === "draft") by.draft++;
    else if (r.staff_status === "approved") by.approved++;
    else if (r.staff_status === "rejected") by.rejected++;
    else by.submitted++;
  }

  // นับเฉพาะคนที่ส่งแล้ว (ไม่รวม draft)
  const sent = results.filter((r) => r.student_status !== "draft");
  const submitted = sent.length;

  // อัตราผ่านรายวิชา — นับจากคนที่ส่งแล้วเท่านั้น
  const perSubject = subjects.map((sub) => {
    let pass = 0;
    let fail = 0;
    for (const r of sent) {
      const sr = r.subject_results.find((x) => x.subject_id === sub.subject_id);
      if (!sr) continue;
      if (sr.is_passed) pass++;
      else fail++;
    }
    return {
      subject_id: sub.subject_id,
      subject_code: sub.subject_code,
      subject_name: sub.subject_name,
      pass,
      fail,
      rate: percent(pass, pass + fail),
    };
  });

  // ผ่านครบทุกวิชา = ส่งครบทุกวิชา และผ่านหมด
  const fullyPassed = sent.filter(
    (r) =>
      r.subject_results.length === subjects.length &&
      r.subject_results.every((sr) => sr.is_passed),
  ).length;

  return {
    round: {
      round_id: round.round_id,
      academic_year: round.academic_year,
      attempt_number: round.attempt_number,
      status: round.status,
    },
    total,
    by,
    not_started: Math.max(total - results.length, 0), // ยังไม่เริ่มกรอกเลย
    submitted,
    fillRate: percent(submitted, total),
    fullyPassed,
    overallPassRate: percent(fullyPassed, submitted),
    perSubject,
  };
};

// รายชื่อนักศึกษาในรอบ — ใช้ทำตารางใน PDF
export const buildStudentRows = async (roundId) => {
  const results = await dashRepo.findResultsByRound(roundId);
  return results.map((r) => {
    const passed = r.subject_results.filter((sr) => sr.is_passed).length;
    return {
      student_id: r.student_id,
      full_name: `${r.student.user.first_name} ${r.student.user.last_name}`,
      student_status: r.student_status,
      staff_status: r.staff_status,
      passed,
      total_subjects: r.subject_results.length,
    };
  });
};
