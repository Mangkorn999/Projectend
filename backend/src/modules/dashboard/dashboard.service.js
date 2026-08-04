import * as dashRepo from "./dashboard.repository.js";
import { subjectsOfRound } from "../../utils/roundSubjects.js";

// ปัดเป็น % จำนวนเต็ม กันหารด้วย 0
const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

// เก็บเฉพาะคนที่กดส่งแล้ว — draft ยังกรอกไม่เสร็จ เอามาคิด % ไม่ได้
const onlySent = (results) => results.filter((r) => r.student_status !== "draft");

// นับว่าผลสอบแต่ละใบอยู่สถานะไหน
const countByStatus = (results) => {
  const by = { draft: 0, submitted: 0, approved: 0, rejected: 0 };
  for (const r of results) {
    if (r.student_status === "draft") by.draft++;
    else if (r.staff_status === "approved") by.approved++;
    else if (r.staff_status === "rejected") by.rejected++;
    else by.submitted++; // ส่งแล้วแต่เจ้าหน้าที่ยังไม่ตรวจ
  }
  return by;
};

// ผ่านครบ = ทุกวิชาของรอบนี้มีผลส่งมา และผ่านหมด
// เทียบทีละ subject_id ไม่ใช่นับจำนวน เพราะผลเก่าอาจมีวิชานอกรอบติดมาด้วย
//
// อ่านบรรทัดล่างเป็นภาษาคน: "คัดเฉพาะใบที่ ทุกวิชาของรอบ มีอย่างน้อย 1 ผลที่ตรงวิชานั้นและผ่าน แล้วนับจำนวน"
//   .filter(...) = คัดเฉพาะตัวที่เงื่อนไขเป็นจริง
//   .every(...)  = จริงหมดทุกตัวไหม → true/false
//   .some(...)   = มีสักตัวที่จริงไหม → true/false
//   .length      = นับจำนวนที่เหลือหลังคัด
const countFullyPassed = (sent, subjectIds) =>
  sent.filter((r) =>
    subjectIds.every((id) =>
      r.subject_results.some((sr) => sr.subject_id === id && sr.is_passed),
    ),
  ).length;

// ผ่าน/ไม่ผ่าน แยกรายวิชา นับเฉพาะคนที่ "สอบวิชานั้นจริงในรอบนี้"
// วิชาที่ทุกคนยกผลผ่านมาจากรอบก่อน (carried_forward) ไม่มีใครสอบ ต้องไม่ขึ้น 100%
// rate: null แปลว่า "ไม่มีข้อมูล" คนละเรื่องกับ 0 ที่แปลว่า "สอบแล้วตกหมด"
const buildPerSubject = (sent, subjects) =>
  subjects.map((sub) => {
    const marks = sent
      .map((r) => r.subject_results.find((x) => x.subject_id === sub.subject_id))
      .filter((m) => m && !m.carried_forward);
    const pass = marks.filter((m) => m.is_passed).length;
    return {
      subject_id: sub.subject_id,
      subject_code: sub.subject_code,
      subject_name: sub.subject_name,
      pass,
      fail: marks.length - pass,
      rate: marks.length ? percent(pass, marks.length) : null,
    };
  });

const notFound = (message) => {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
};

// รวมสถิติของ 1 รอบ — ใช้ทั้ง /stats และ /export
export const buildStats = async (roundId) => {
  // ไม่ส่ง round_id มา → ใช้รอบที่เปิดรับอยู่ (ถ้าไม่มี ค่อยเป็นรอบล่าสุด)
  const round = roundId
    ? await dashRepo.findRoundById(roundId)
    : await dashRepo.findDefaultRound();

  if (!round) throw notFound("ไม่พบรอบการกรอกผลสอบ");

  const [total, eligible, allSubjects, results] = await Promise.all([
    dashRepo.countStudentsByYear(round.academic_year),
    dashRepo.countEligibleByYear(round.academic_year),
    dashRepo.findAllSubjects(),
    dashRepo.findResultsByRound(round.round_id),
  ]);

  // นับเฉพาะวิชาที่รอบนี้สอบจริง — รอบที่สอบ 3 วิชาไม่ควรโชว์อีก 5 วิชาเป็น 0%
  const subjects = subjectsOfRound(round, allSubjects);
  const subjectIds = subjects.map((s) => s.subject_id);

  const sent = onlySent(results);
  const submitted = sent.length;
  const perSubject = buildPerSubject(sent, subjects);
  const fullyPassed = countFullyPassed(sent, subjectIds);

  // เฉลี่ยอัตราผ่านของทุกวิชา — คนละตัวกับ fullyPassedRate ที่นับเป็นรายคน
  // ข้ามวิชาที่ไม่มีใครสอบจริง ไม่งั้นตัวหารจะรวมวิชาที่ไม่มีข้อมูลเข้ามาด้วย
  const sat = perSubject.filter((s) => s.rate !== null);
  const subjectPassRate = percent(
    sat.reduce((sum, s) => sum + s.pass, 0),
    sat.reduce((sum, s) => sum + s.pass + s.fail, 0),
  );

  return {
    round: {
      round_id: round.round_id,
      academic_year: round.academic_year,
      attempt_number: round.attempt_number,
      status: round.status,
    },
    total, // นักศึกษาทั้งรุ่น
    eligible, // เฉพาะคนที่เปิดสิทธิ์กรอกแล้ว = คนที่กรอกได้จริง
    by: countByStatus(results),
    not_started: Math.max(eligible - results.length, 0),
    submitted,
    fillRate: percent(submitted, eligible), // หารด้วยคนที่กรอกได้ ไม่ใช่ทั้งรุ่น
    fullyPassed,
    fullyPassedRate: percent(fullyPassed, submitted), // % คนที่ผ่านครบทุกวิชา
    subjectPassRate, // % ผลรายวิชาที่ผ่าน รวมทุกวิชา
    overallPassRate: percent(fullyPassed, submitted), // ชื่อเดิม เก็บไว้ไม่ให้หน้าเก่าพัง
    perSubject,
  };
};

// สรุปทั้งปีการศึกษา + ย้อนหลังหลายปีไว้เทียบกัน
// รวมทุกรอบของปีเข้าด้วยกัน โดยนับ "รายคน" ไม่ใช่ "รายใบ"
// นักศึกษาคนเดียวกรอกได้หลายรอบในปีเดียว ถ้านับทุกใบจะเกินจำนวนคนที่มีจริง
const buildYearSummary = async (year, allSubjects) => {
  const rounds = (await dashRepo.findRoundsByYears([year])).filter(
    (r) => r.academic_year === year,
  );

  const [total, eligible] = await Promise.all([
    dashRepo.countStudentsByYear(year),
    dashRepo.countEligibleByYear(year),
  ]);

  const everSubmitted = new Set(); // student_id ที่ส่งอย่างน้อย 1 รอบในปีนี้
  const everFullyPassed = new Set(); // student_id ที่เคยผ่านครบในรอบใดรอบหนึ่ง
  const roundSummaries = [];

  for (const round of rounds) {
    const results = await dashRepo.findResultsByRound(round.round_id);
    const sent = onlySent(results);
    const subjectIds = subjectsOfRound(round, allSubjects).map(
      (s) => s.subject_id,
    );

    sent.forEach((r) => everSubmitted.add(r.student_id));
    sent
      .filter((r) =>
        subjectIds.every((id) =>
          r.subject_results.some((sr) => sr.subject_id === id && sr.is_passed),
        ),
      )
      .forEach((r) => everFullyPassed.add(r.student_id));

    roundSummaries.push({
      round_id: round.round_id,
      attempt_number: round.attempt_number,
      status: round.status,
      subject_count: subjectIds.length,
      submitted: sent.length,
      fullyPassed: countFullyPassed(sent, subjectIds),
    });
  }

  return {
    academic_year: year,
    total,
    eligible,
    submitted: everSubmitted.size,
    fullyPassed: everFullyPassed.size,
    fillRate: percent(everSubmitted.size, eligible),
    passRate: percent(everFullyPassed.size, everSubmitted.size),
    rounds: roundSummaries,
  };
};

// ปีล่าสุดกี่ปีก็ได้ ค่าเริ่มต้น 3 ปี — ใช้ทำกราฟเทียบรุ่นต่อรุ่น
export const buildHistory = async (yearCount = 3) => {
  const [years, allSubjects] = await Promise.all([
    dashRepo.findAcademicYears(),
    dashRepo.findAllSubjects(),
  ]);

  const wanted = years.slice(0, yearCount);
  const summaries = [];
  for (const year of wanted) {
    summaries.push(await buildYearSummary(year, allSubjects));
  }
  return { years: summaries };
};

// รายชื่อนักศึกษาในรอบ — ใช้ทำตารางใน PDF
export const buildStudentRows = async (roundId) => {
  const [round, allSubjects, results] = await Promise.all([
    dashRepo.findRoundById(roundId),
    dashRepo.findAllSubjects(),
    dashRepo.findResultsByRound(roundId),
  ]);
  const roundSubjectIds = subjectsOfRound(round, allSubjects).map(
    (s) => s.subject_id,
  );

  return results.map((r) => {
    // นับเฉพาะวิชาของรอบนี้ ตัวหารใน PDF จะได้ตรงกับที่นักศึกษาต้องกรอกจริง
    const inRound = r.subject_results.filter((sr) =>
      roundSubjectIds.includes(sr.subject_id),
    );
    const passed = inRound.filter((sr) => sr.is_passed).length;
    return {
      student_id: r.student_id,
      full_name: `${r.student.user.first_name} ${r.student.user.last_name}`,
      student_status: r.student_status,
      staff_status: r.staff_status,
      passed,
      total_subjects: roundSubjectIds.length,
    };
  });
};
