import * as dashRepo from "./dashboard.repository.js";
import { subjectsOfRound } from "../../utils/roundSubjects.js";

// ปัดเป็น % จำนวนเต็ม กันหารด้วย 0
const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

// % ทศนิยม 2 ตำแหน่ง — ตัวเลขที่คณะส่งสภาการพยาบาลใช้แบบนี้ (71.43 ไม่ใช่ 71)
// คูณ 10000 แล้วหาร 100 คือวิธีปัดให้เหลือทศนิยม 2 ตำแหน่งใน JS
function rate2(part, whole) {
  if (!whole) return 0; // ไม่มีตัวหาร = ยังไม่มีข้อมูล ตอบ 0 ไปก่อน กัน NaN
  return Math.round((part / whole) * 10000) / 100;
}

// เก็บเฉพาะคนที่กดส่งแล้ว — draft ยังกรอกไม่เสร็จ เอามาคิด % ไม่ได้
const onlySent = (results) => results.filter((r) => r.student_status !== "draft");

// ตัดใบที่ถูกตีกลับออก — ตัวเลขในใบนั้นเจ้าหน้าที่บอกแล้วว่าเชื่อไม่ได้
// ส่วน pending (ส่งแล้วรอตรวจ) ยังนับ ไม่งั้นกราฟอัตราผ่านจะว่างจนกว่าเจ้าหน้าที่จะตรวจครบทุกใบ
// ใช้กฎเดียวกับ findPassedSubjectIds ฝั่ง examResults จะได้ไม่ขัดกันเอง
const notRejected = (results) => results.filter((r) => r.staff_status !== "rejected");

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

// ตารางสรุป "ผ่านกี่วิชา" ของรอบสอบครั้งแรก แยกตามห้องเรียน
// เช่น ผ่าน 8 วิชา 146 คน / ผ่าน 7 วิชา 47 คน — ตรงกับตารางที่คณะส่งสภาการพยาบาล
// นับเป็นรายคน: 1 คน = 1 แถวเดียวเท่านั้น (อยู่ในช่อง "ผ่าน N วิชา" ช่องเดียว)
//
// ตัวหารคือ "นักศึกษาทั้งห้อง" (roomTotals จากตาราง students) ไม่ใช่คนที่ส่งผล
// ต้องเป็นตัวเดียวกับตัวหารของ % ผ่านครั้งแรก ไม่งั้น 2 ตารางบนหน้าเดียวกันหารคนละตัว
// คนที่ไม่ได้ส่งผลไปรวมอยู่ในแถว "ไม่ได้ส่งผลสอบ" ท้ายตาราง ยอดรวมทุกแถวจึงเท่ากับทั้งรุ่นเสมอ
function buildPassDistribution(sent, subjectIds, roomTotals) {
  const rows = new Map(); // จำนวนวิชาที่ผ่าน -> Map(room_id -> จำนวนคน)
  const submittedByRoom = new Map(); // room_id -> จำนวนคนที่ส่งผลในรอบนี้

  for (const r of sent) {
    const room = r.student.room;

    let submittedCount = submittedByRoom.get(room.room_id);
    if (!submittedCount) submittedCount = 0;
    submittedByRoom.set(room.room_id, submittedCount + 1);

    // นับว่าคนนี้ผ่านกี่วิชา — เทียบเฉพาะวิชาที่รอบนี้สอบ
    let passedCount = 0;
    for (const id of subjectIds) {
      const passedThis = r.subject_results.some(
        (sr) => sr.subject_id === id && sr.is_passed,
      );
      if (passedThis) passedCount += 1;
    }

    if (!rows.has(passedCount)) rows.set(passedCount, new Map());
    const byRoom = rows.get(passedCount);
    let old = byRoom.get(room.room_id);
    if (!old) old = 0;
    byRoom.set(room.room_id, old + 1);
  }

  const roomList = roomTotals;
  let total = 0;
  for (const room of roomList) total += room.total;

  // นับคนของแต่ละห้องในหนึ่งแถว แล้วคิด % เทียบกับจำนวนคนทั้งห้อง
  const buildRow = (label, passed, countOf) => {
    let rowTotal = 0;
    const perRoom = roomList.map((room) => {
      const count = countOf(room.room_id);
      rowTotal += count;
      return { room_id: room.room_id, count, rate: rate2(count, room.total) };
    });
    return { label, passed, byRoom: perRoom, count: rowTotal, rate: rate2(rowTotal, total) };
  };

  // ไล่จากผ่านมากไปน้อย (8 → 0) เหมือนตารางในรายงาน
  // แถวที่ไม่มีใครเลยก็ยังต้องโชว์เป็น 0 ไม่ใช่หายไป
  const out = [];
  for (let n = subjectIds.length; n >= 0; n--) {
    out.push(
      buildRow(null, n, (roomId) => {
        const byRoom = rows.get(n);
        if (!byRoom) return 0;
        const count = byRoom.get(roomId);
        if (!count) return 0;
        return count;
      }),
    );
  }

  // แถวปิดท้าย: คนที่ไม่ได้ส่งผลสอบรอบนี้เลย = คนทั้งห้อง − คนที่ส่ง
  out.push(
    buildRow("not_submitted", null, (roomId) => {
      const room = roomList.find((x) => x.room_id === roomId);
      let submittedCount = submittedByRoom.get(roomId);
      if (!submittedCount) submittedCount = 0;
      return room.total - submittedCount;
    }),
  );

  return { subject_count: subjectIds.length, total, rooms: roomList, rows: out };
}

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
  const counted = notRejected(sent);
  const perSubject = buildPerSubject(counted, subjects);
  const fullyPassed = countFullyPassed(sent, subjectIds);

  // เฉลี่ยอัตราผ่านของทุกวิชา — คนละตัวกับ fullyPassedRate ที่นับเป็นรายคน
  // ข้ามวิชาที่ไม่มีใครสอบจริง ไม่งั้นตัวหารจะรวมวิชาที่ไม่มีข้อมูลเข้ามาด้วย
  const sat = perSubject.filter((s) => s.rate !== null);

  // บวกสะสมทีละวิชา: totalPass = ผ่านรวมทุกวิชา, totalMarks = จำนวนผลสอบรวมทุกวิชา
  let totalPass = 0;
  let totalMarks = 0;
  for (const s of sat) {
    totalPass = totalPass + s.pass;
    totalMarks = totalMarks + s.pass + s.fail;
  }
  const subjectPassRate = percent(totalPass, totalMarks);

  return {
    round: {
      round_id: round.round_id,
      academic_year: round.academic_year,
      attempt_number: round.attempt_number,
      status: round.status,
    },
    total, // นักศึกษาทั้งรุ่นที่ import เข้าระบบ = ตัวหารของทุก % ในหน้านี้
    eligible, // เปิดสิทธิ์กรอกอยู่กี่คน — ข้อมูลประกอบ ไม่ใช่ตัวหาร
    by: countByStatus(results),
    // ยังไม่มีใบในรอบนี้เลย — ทั้งรุ่นลบคนที่มีใบแล้ว
    // 5 ช่องนี้ (approved+submitted+rejected+draft+not_started) ต้องบวกกันได้เท่า total พอดี
    not_started: Math.max(total - results.length, 0),
    submitted,
    fillRate: percent(submitted, total),
    fullyPassed,
    // % คนที่ผ่านครบทุกวิชาของรอบนี้ เทียบกับทั้งรุ่น (ตัวหารเดียวกับ fillRate)
    fullyPassedRate: percent(fullyPassed, total),
    subjectPassRate, // % ผลรายวิชาที่ผ่าน รวมทุกวิชา
    // % ผ่านครบ เทียบเฉพาะ "คนที่ส่งผลรอบนี้" — คนละตัวหารกับ fullyPassedRate ข้างบน
    // ใช้ตอบคำถาม "คนที่เข้าสอบรอบนี้ ผ่านกี่ %" ต้องติดป้ายให้ชัดทุกที่ที่เอาไปโชว์
    passRateOfSitters: percent(fullyPassed, submitted),
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

  const [total, eligible, roomTotals] = await Promise.all([
    dashRepo.countStudentsByYear(year),
    dashRepo.countEligibleByYear(year),
    dashRepo.countStudentsByRoom(year),
  ]);

  const everSubmitted = new Set(); // student_id ที่ส่งอย่างน้อย 1 รอบในปีนี้
  const roundSummaries = [];
  const yearCounted = []; // ผลที่นับได้ (ไม่ถูกตีกลับ) รวมทุกรอบของปีนี้ — ใช้ทำอัตราผ่านรายวิชาย้อนหลัง

  // ห้องเรียนของนักศึกษาแต่ละคน — ใช้แยกยอดตามห้องตอนท้าย
  const roomOfStudent = new Map(); // student_id -> room_id
  // วิชาที่แต่ละคนสอบผ่านแล้ว รวมทุกรอบของปีนี้ (ยุบซ้ำด้วย Set)
  // ต้องรวมข้ามรอบ ไม่ใช่ดูทีละรอบ — คนสอบแก้ตัวผ่านครบก็ต่อเมื่อเอาผลรอบก่อนมารวมด้วย
  const passedByStudent = new Map(); // student_id -> Set(subject_id)

  // ผลของรอบสอบครั้งแรก (attempt_number = 1) เก็บแยกไว้
  // ใช้ทำ "ร้อยละผ่านครั้งแรก" + ตารางผ่านกี่วิชา ซึ่งนับเฉพาะรอบแรกเท่านั้น
  let firstRoundSent = null;
  let firstRoundSubjectIds = [];

  for (const round of rounds) {
    const results = await dashRepo.findResultsByRound(round.round_id);
    const sent = onlySent(results);
    const counted = notRejected(sent);
    const subjectIds = subjectsOfRound(round, allSubjects).map(
      (s) => s.subject_id,
    );

    if (round.attempt_number === 1) {
      firstRoundSent = sent;
      firstRoundSubjectIds = subjectIds;
    }

    for (const r of counted) {
      everSubmitted.add(r.student_id);
      roomOfStudent.set(r.student_id, r.student.room.room_id);

      if (!passedByStudent.has(r.student_id)) {
        passedByStudent.set(r.student_id, new Set());
      }
      const passedSet = passedByStudent.get(r.student_id);
      for (const sr of r.subject_results) {
        if (sr.is_passed) passedSet.add(sr.subject_id);
      }
    }

    yearCounted.push(...counted);
    roundSummaries.push({
      round_id: round.round_id,
      attempt_number: round.attempt_number,
      status: round.status,
      subject_count: subjectIds.length,
      submitted: sent.length,
      fullyPassed: countFullyPassed(sent, subjectIds),
    });
  }

  // วิชาที่ต้องผ่านให้ครบถึงจะเรียกว่า "สอบผ่าน" = วิชาของรอบแรก (ปกติครบ 8 วิชา)
  // ปีที่ยังไม่มีรอบแรกในระบบ ใช้รายวิชาทั้งหมดไปก่อน
  let requiredSubjectIds = firstRoundSubjectIds;
  if (requiredSubjectIds.length === 0) {
    requiredSubjectIds = allSubjects.map((s) => s.subject_id);
  }

  // ผ่านครบภายในปีนี้ = ผลรวมทุกรอบครอบคลุมวิชาที่ต้องผ่านทั้งหมด
  const fullyPassedStudents = new Set();
  for (const [studentId, passedSet] of passedByStudent) {
    let passedAll = true;
    for (const id of requiredSubjectIds) {
      if (!passedSet.has(id)) {
        passedAll = false;
        break;
      }
    }
    if (passedAll) fullyPassedStudents.add(studentId);
  }

  // แยกยอดตามห้องเรียน — ตัวหารคือจำนวนนักศึกษาทั้งห้อง ไม่ใช่คนที่ส่งผล
  const byRoom = roomTotals.map((room) => {
    let submittedCount = 0;
    let fullyPassedCount = 0;
    for (const [studentId, roomId] of roomOfStudent) {
      if (roomId !== room.room_id) continue;
      submittedCount += 1;
      if (fullyPassedStudents.has(studentId)) fullyPassedCount += 1;
    }
    return {
      room_id: room.room_id,
      room_name: room.room_name,
      total: room.total, // นักศึกษาทั้งห้องของรุ่นนี้
      submitted: submittedCount,
      fullyPassed: fullyPassedCount,
      passRate: rate2(fullyPassedCount, room.total),
    };
  });

  // 2 สูตรที่คณะใช้รายงานสภาการพยาบาล — ตัวหารคือ "นักศึกษาทั้งรุ่น" (= ผู้สำเร็จการศึกษาปีนั้น)
  // ไม่ใช่จำนวนคนที่ส่งผล เพราะคนที่ไม่ส่งผลก็ถือว่ายังสอบไม่ผ่านเหมือนกัน
  //   firstAttempt = ผ่านครบทุกวิชาตั้งแต่รอบสอบครั้งที่ 1
  //   firstYear    = ผ่านครบทุกวิชา ในรอบไหนก็ได้ของปีนั้น (รอบ 1+2+3 รวมกัน นับคนละครั้ง)
  let firstAttemptPassed = 0;
  if (firstRoundSent) {
    firstAttemptPassed = countFullyPassed(firstRoundSent, firstRoundSubjectIds);
  }

  let passDistribution = null;
  if (firstRoundSent) {
    passDistribution = buildPassDistribution(
      firstRoundSent,
      firstRoundSubjectIds,
      roomTotals,
    );
  }

  return {
    academic_year: year,
    total,
    eligible,
    submitted: everSubmitted.size,
    fullyPassed: fullyPassedStudents.size,
    // ทุก % ของสถิติชุดนี้หารด้วย total (นักศึกษาทั้งรุ่นที่ import เข้าระบบ) ตัวเดียวกันหมด
    fillRate: rate2(everSubmitted.size, total),
    passRate: rate2(fullyPassedStudents.size, total),
    firstAttempt: {
      passed: firstAttemptPassed,
      rate: rate2(firstAttemptPassed, total),
    },
    firstYear: {
      passed: fullyPassedStudents.size,
      rate: rate2(fullyPassedStudents.size, total),
    },
    passDistribution, // null = ปีนั้นยังไม่มีรอบที่ 1 ในระบบ
    rounds: roundSummaries,
    byRoom, // ผ่านครบ/ส่งแล้วแยกตามห้องเรียน (ปกติ/ภาษาอังกฤษ) — ใช้ตารางเทียบย้อนหลัง
    // อัตราผ่านรายวิชา รวมทุกรอบของปีนี้ — ใช้กราฟเทียบอัตราผ่านรายวิชาย้อนหลัง
    perSubject: buildPerSubject(yearCounted, allSubjects),
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
