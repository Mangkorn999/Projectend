import * as dashRepo from "./dashboard.repository.js";
import { subjectsOfRound } from "../../utils/roundSubjects.js";
import { getRoundPhase } from "../../utils/roundPhase.js";

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

// ยืนยันแล้วเท่านั้น (staff_status === approved) — ตัด pending (รอตรวจ) ออกด้วย
// ใช้เฉพาะ "อัตราการผ่านรายวิชา" (buildPerSubject) ที่ต้องการเฉพาะใบที่เจ้าหน้าที่ตรวจสอบแล้วจริง
// ต่างจาก notRejected ที่สถิติอื่นในไฟล์นี้ (fullyPassed, สัดส่วนสถานะ ฯลฯ) ยังใช้แบบเดิม
const onlyConfirmed = (results) => results.filter((r) => r.staff_status === "approved");

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

// เหมือน buildPerSubject แต่รับ "แผนที่รายคน" แทน array ใบ — ใช้ตอนรวมหลายรอบเข้าด้วยกัน (ปีเดียวมีได้หลายรอบ)
// นับคนเดียวครั้งเดียวต่อวิชา แม้จะสอบวิชานั้นซ้ำหลายรอบในปีนั้นก็ตาม (buildPerSubject ธรรมดานับตามจำนวนใบ ใช้ได้แค่ตอน
// ใบต่อคนมีได้ใบเดียวแน่ๆ เช่นดูรอบเดียว — ถ้าเอาไปใช้กับหลายรอบรวมกัน คนที่สอบซ้ำหลายรอบจะถูกนับเกินจำนวนคนจริง)
const buildPerSubjectByStudent = (passedByStudent, attemptedByStudent, subjects) =>
  subjects.map((sub) => {
    let pass = 0;
    let fail = 0;
    for (const [studentId, attempted] of attemptedByStudent) {
      if (!attempted.has(sub.subject_id)) continue; // ไม่เคยสอบวิชานี้จริงเลยปีนี้ (มีแต่ carried_forward) ไม่นับ
      if (passedByStudent.get(studentId)?.has(sub.subject_id)) pass++;
      else fail++;
    }
    return {
      subject_id: sub.subject_id,
      subject_code: sub.subject_code,
      subject_name: sub.subject_name,
      pass,
      fail,
      rate: pass + fail ? percent(pass, pass + fail) : null,
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

// ตารางผลรายวิชาของ "การสอบรอบแรก" — รูปแบบเดียวกับตารางที่คณะส่งสภาการพยาบาล
//
// ต่างจาก buildPerSubject ตรงตัวหาร:
//   buildPerSubject          หารด้วย "คนที่สอบวิชานั้นจริง"   → ตอบว่าคนที่เข้าสอบผ่านกี่ %
//   buildFirstAttemptBySubject หารด้วย "นักศึกษาทั้งรุ่น"     → ตัวเลขที่ส่งสภาการพยาบาลใช้แบบนี้
//
// 3 ช่องต่อวิชา (ผ่าน / ไม่ผ่าน / ยังไม่ส่งผล) บวกกันได้เท่าทั้งรุ่นเสมอ
// "ไม่ผ่าน" นับเฉพาะคนที่กรอกมาว่าตกจริง ไม่กลืนคนที่ยังไม่ส่งผลเข้ามา
// (เอกสารของสภารวม 2 อย่างนี้เป็นช่องเดียว ตอนทำ PDF ค่อยบวกกลับ)
function buildFirstAttemptBySubject(sent, subjects, cohortTotal) {
  if (!cohortTotal) return null; // ยังไม่ import นักศึกษา — ไม่มีตัวหาร ไม่ต้องคำนวณ

  const counted = notRejected(sent); // ใบที่ถูกตีกลับเชื่อไม่ได้ ใช้กฎเดียวกับสถิติตัวอื่นในไฟล์นี้

  const rows = subjects.map((sub) => {
    let pass = 0;
    let fail = 0;
    for (const r of counted) {
      const mark = r.subject_results.find(
        (x) => x.subject_id === sub.subject_id,
      );
      // carried_forward = ยกผลผ่านมาจากรอบก่อน ไม่ได้สอบวิชานี้จริง ไม่นับเป็นผู้เข้าสอบ
      if (!mark || mark.carried_forward) continue;
      if (mark.is_passed) pass += 1;
      else fail += 1;
    }

    const passRate = rate2(pass, cohortTotal);
    const failRate = rate2(fail, cohortTotal);
    // ยกเศษจากการปัดทศนิยมมาไว้ช่องสุดท้าย ผลรวม 3 ช่องจะได้เป็น 100.00 เป๊ะทุกแถว
    // (ถ้าคิด rate2(notSubmitted, cohortTotal) ตรงๆ บางแถวจะรวมได้ 99.99 หรือ 100.01)
    const notSubmittedRate = Math.round((100 - passRate - failRate) * 100) / 100;

    return {
      subject_id: sub.subject_id,
      subject_code: sub.subject_code,
      subject_name: sub.subject_name,
      pass,
      pass_rate: passRate,
      fail,
      fail_rate: failRate,
      not_submitted: cohortTotal - pass - fail,
      not_submitted_rate: notSubmittedRate,
      sat: pass + fail, // 0 = ไม่มีใครสอบวิชานี้เลย ฝั่งหน้าจอต้องขึ้นขีด ไม่ใช่ 0.00%
    };
  });

  // เฉลี่ยเฉพาะวิชาที่มีคนสอบจริง — วิชาที่ไม่มีใครสอบจะลากค่าเฉลี่ยลงทั้งที่ไม่มีข้อมูล
  const sat = rows.filter((r) => r.sat > 0);
  let sum = 0;
  for (const r of sat) sum += r.pass_rate;
  const average = sat.length ? Math.round((sum / sat.length) * 100) / 100 : 0;

  // แถว "รวมทุกวิชา" ท้ายตาราง — **นับเป็นคน** ไม่ใช่บวกคอลัมน์รายวิชา
  // บวกคอลัมน์จะได้ตัวหาร cohortTotal × จำนวนวิชา (เช่น 156×8 = 1248) ซึ่งไม่ใช่จำนวนคน
  // แล้วไปโผล่ใต้หัวคอลัมน์ "ผู้สมัครสอบ" คนอ่านจะเข้าใจว่ามีผู้สมัคร 1,248 คน
  //   passed_all = ผ่านครบทุกวิชาของรอบแรก · failed_any = ส่งผลแล้วแต่ตกอย่างน้อย 1 วิชา
  //   คนที่ไม่ได้ส่งผลไม่อยู่ในทั้งสองช่อง (เหมือนแถวรายวิชา) → 2 ช่องรวมกันไม่ถึง 100%
  const passedAll = counted.filter((r) =>
    subjects.every((sub) =>
      r.subject_results.some((x) => x.subject_id === sub.subject_id && x.is_passed),
    ),
  ).length;

  return {
    cohort_total: cohortTotal, // คอลัมน์ "จำนวนผู้สมัครสอบ" = ตัวหารของทุก % ในตารางนี้
    submitted: counted.length, // ส่งผลรอบแรกแล้วกี่คน (ไม่รวมใบที่ถูกตีกลับ)
    average_pass_rate: average, // เส้นอ้างอิงของหน้าจอ: วิชาไหนต่ำกว่าค่านี้ = ต้องเฝ้าระวัง
    passed_all: passedAll,
    passed_all_rate: rate2(passedAll, cohortTotal),
    failed_any: counted.length - passedAll,
    failed_any_rate: rate2(counted.length - passedAll, cohortTotal),
    subjects: rows,
  };
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

  const [total, eligible, allSubjects, results, eligibleStudents] =
    await Promise.all([
      dashRepo.countStudentsByYear(round.academic_year),
      dashRepo.countEligibleByYear(round.academic_year),
      dashRepo.findAllSubjects(),
      dashRepo.findResultsByRound(round.round_id),
      dashRepo.findEligibleWithPassedSubjects(round),
    ]);

  // นับเฉพาะวิชาที่รอบนี้สอบจริง — รอบที่สอบ 3 วิชาไม่ควรโชว์อีก 5 วิชาเป็น 0%
  const subjects = subjectsOfRound(round, allSubjects);
  const subjectIds = subjects.map((s) => s.subject_id);

  const sent = onlySent(results);
  const submitted = sent.length;
  const counted = notRejected(sent);
  // อัตราการผ่านรายวิชา นับเฉพาะใบที่ยืนยันแล้ว — รอตรวจสอบยังไม่นับ
  const perSubject = buildPerSubject(onlyConfirmed(counted), subjects);
  // ใช้ counted ไม่ใช่ sent — ใบที่เจ้าหน้าที่ตีกลับเชื่อไม่ได้ ต้องไม่นับเป็น "ผ่านครบ"
  // (กฎเดียวกับ buildPerSubject/buildFirstAttemptBySubject ในไฟล์นี้ เดิมตรงนี้หลุดไปใช้ sent)
  const fullyPassed = countFullyPassed(counted, subjectIds);

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

  // "รอบนี้กรอกฟอร์มได้กี่คน" — เปิดสิทธิ์อยู่ และยังผ่านวิชาของรอบนี้ไม่ครบ
  // ตัวเลขนี้ลดลงทุกรอบ: รอบ 1 คือทุกคนที่เปิดสิทธิ์ พอรอบ 2 เหลือเฉพาะคนที่ยังสอบไม่ผ่าน
  // ต่างจาก eligible ข้างล่างที่เป็นยอดทั้งรุ่น ไม่ว่าดูรอบไหนก็เท่าเดิม
  let canSubmit = 0;
  // ผ่านครบทุกวิชาไปแล้วตั้งแต่รอบก่อนหน้า — คิวตรวจสอบ (officerReviewReal) เอาไปตัดออกจาก
  // แท็บ "ยังไม่กรอก" ของรอบนี้ ไม่งั้นคนที่ผ่านครบแล้วจะค้างโชว์เป็น "ยังไม่กรอก" ไปทุกรอบถัดไป
  const alreadyPassedStudentIds = [];
  for (const s of eligibleStudents) {
    const passedAll = subjectIds.every((id) =>
      s.passed_subject_ids.includes(id),
    );
    if (!passedAll) canSubmit += 1;
    else alreadyPassedStudentIds.push(s.student_id);
  }

  return {
    round: {
      round_id: round.round_id,
      academic_year: round.academic_year,
      attempt_number: round.attempt_number,
      status: round.status,
      // ต้องส่งวันที่ + phase ไปด้วย ไม่ใช่แค่ status
      // เดิมส่งแค่ status → หน้า dashboard เขียน "เปิดรับอยู่" ให้รอบที่ยังไม่ถึงวันเปิด
      // เพราะฝั่งหน้าจอไม่มีวันที่ให้เทียบ เลยเดาว่า active ตลอด
      open_date: round.open_date,
      close_date: round.close_date,
      phase: getRoundPhase(round),
    },
    total, // นักศึกษาทั้งรุ่นที่ import เข้าระบบ = ตัวหารของทุก % ในหน้านี้
    eligible, // เปิดสิทธิ์กรอกอยู่กี่คน — ข้อมูลประกอบ ไม่ใช่ตัวหาร
    canSubmit, // รอบนี้เปิดฟอร์มให้กรอกได้กี่คน (ยังผ่านไม่ครบ) — ข้อมูลประกอบ ไม่ใช่ตัวหาร
    alreadyPassedStudentIds, // เปิดสิทธิ์ + ผ่านครบทุกวิชาไปแล้วตั้งแต่ก่อนรอบนี้ — ไม่มีอะไรต้องทำในรอบนี้แล้ว
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
  // student_id ที่ "มีใบในปีนี้" ทุกสถานะ รวม draft ที่ยังกรอกไม่เสร็จด้วย
  // ต่างจาก everSubmitted ตรงนับคนที่เริ่มกรอกแต่ยังไม่กดส่ง — ใช้หา "ยังไม่เริ่มกรอก" ให้ไม่นับซ้ำ
  // (ถ้าใช้ total − everSubmitted คนที่ค้าง draft จะโดนนับทั้งช่อง draft และช่องยังไม่เริ่ม)
  const everStarted = new Set();
  const roundSummaries = [];

  // ห้องเรียนของนักศึกษาแต่ละคน — ใช้แยกยอดตามห้องตอนท้าย
  const roomOfStudent = new Map(); // student_id -> room_id
  // วิชาที่แต่ละคนสอบผ่านแล้ว รวมทุกรอบของปีนี้ (ยุบซ้ำด้วย Set)
  // ต้องรวมข้ามรอบ ไม่ใช่ดูทีละรอบ — คนสอบแก้ตัวผ่านครบก็ต่อเมื่อเอาผลรอบก่อนมารวมด้วย
  const passedByStudent = new Map(); // student_id -> Set(subject_id)
  // คนละชุดกับ passedByStudent ด้านบน (นั่นรวมใบ pending ด้วย ใช้กับ "ผ่านครบทุกวิชา")
  // 2 ชุดนี้นับเฉพาะใบที่ยืนยันแล้ว (approved) — ใช้กับ perSubject "รวมทั้งปี" เท่านั้น กฎเดียวกับ buildPerSubject รายรอบ
  // (อัตราผ่านรายวิชา นับเฉพาะใบที่ยืนยันแล้ว + นับเฉพาะคนที่สอบจริง ไม่ใช่ carried_forward)
  const passedByStudentConfirmed = new Map(); // student_id -> Set(subject_id) ที่เคยผ่าน (ปีนี้)
  const attemptedByStudentConfirmed = new Map(); // student_id -> Set(subject_id) ที่เคยสอบจริง (ไม่ carried_forward) ปีนี้
  // ใบล่าสุดของแต่ละคน ใช้ทำ statusByStudent ท้ายฟังก์ชัน
  const latestPaperOf = new Map(); // student_id -> examResult

  // ผลของรอบสอบครั้งแรก (attempt_number = 1) เก็บแยกไว้
  // ใช้ทำ "ร้อยละผ่านครั้งแรก" + ตารางผ่านกี่วิชา ซึ่งนับเฉพาะรอบแรกเท่านั้น
  // เก็บ 2 ชุด: Sent = ส่งมาแล้วทุกใบ, Counted = ตัดใบที่ถูกตีกลับออก (ใช้กับทุกตัวที่แปลว่า "ผ่าน")
  let firstRoundSent = null;
  let firstRoundCounted = null;
  let firstRoundSubjectIds = [];
  let firstRoundSubjects = []; // ตัว object เต็ม (มีรหัส/ชื่อวิชา) ไว้ทำตารางรายวิชา

  for (const round of rounds) {
    const results = await dashRepo.findResultsByRound(round.round_id);
    const sent = onlySent(results);
    const counted = notRejected(sent);
    const roundSubjects = subjectsOfRound(round, allSubjects);
    const subjectIds = roundSubjects.map((s) => s.subject_id);

    for (const r of results) everStarted.add(r.student_id);

    // ใบล่าสุดของแต่ละคนในปีนี้ — rounds เรียงใหม่→เก่า ใบแรกที่เจอจึงเป็นใบล่าสุด
    // ใช้ทำสัดส่วนสถานะ "รายคน": คนที่กรอกหลายรอบต้องนับครั้งเดียว ตามสถานะปัจจุบันของเขา
    for (const r of results) {
      if (!latestPaperOf.has(r.student_id)) latestPaperOf.set(r.student_id, r);
    }

    if (round.attempt_number === 1) {
      firstRoundSent = sent;
      firstRoundCounted = counted;
      firstRoundSubjectIds = subjectIds;
      firstRoundSubjects = roundSubjects;
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

      // นับรายคนสำหรับ perSubject "รวมทั้งปี" — เดิมส่ง array ใบทั้งปีตรงๆ เข้า buildPerSubject (นับตามใบ)
      // คนที่สอบซ้ำหลายรอบในปีเดียว (เช่น ตกวิชาเดิม 2-3 รอบ) จะถูกนับเป็นหลายใบ ทำให้ตัวเลข "ไม่ผ่าน N คน"
      // เกินจำนวนคนจริง (บั๊กที่เจอจริง: badge บอก 9 แต่คนจริงมี 8, อีกเคสจริงมีคนตกซ้ำถึง 3 รอบ)
      if (r.staff_status === "approved") {
        if (!passedByStudentConfirmed.has(r.student_id)) passedByStudentConfirmed.set(r.student_id, new Set());
        if (!attemptedByStudentConfirmed.has(r.student_id)) attemptedByStudentConfirmed.set(r.student_id, new Set());
        const passedC = passedByStudentConfirmed.get(r.student_id);
        const attemptedC = attemptedByStudentConfirmed.get(r.student_id);
        for (const sr of r.subject_results) {
          if (sr.is_passed) passedC.add(sr.subject_id);
          if (!sr.carried_forward) attemptedC.add(sr.subject_id); // สอบจริงรอบนี้ (ไม่ใช่ยกผลมาจากรอบก่อน)
        }
      }
    }

    roundSummaries.push({
      round_id: round.round_id,
      attempt_number: round.attempt_number,
      status: round.status,
      open_date: round.open_date,
      close_date: round.close_date,
      phase: getRoundPhase(round),
      subject_count: subjectIds.length,
      // submitted นับใบที่ถูกตีกลับด้วย (ส่งมาแล้วจริง) แต่ fullyPassed ต้องไม่นับ — ใบนั้นยังเชื่อไม่ได้
      submitted: sent.length,
      fullyPassed: countFullyPassed(counted, subjectIds),
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
  if (firstRoundCounted) {
    firstAttemptPassed = countFullyPassed(
      firstRoundCounted,
      firstRoundSubjectIds,
    );
  }

  let passDistribution = null;
  let firstAttemptBySubject = null;
  if (firstRoundSent) {
    // ตารางแจกแจง "ผ่านกี่วิชา" ใช้ Counted เหมือนกัน — คนที่ใบถูกตีกลับจะไปตกแถว "ไม่ได้ส่งผลสอบ"
    // ตรงกับตาราง firstAttemptBySubject ที่นับคนกลุ่มนี้เป็น not_submitted อยู่แล้ว
    passDistribution = buildPassDistribution(
      firstRoundCounted,
      firstRoundSubjectIds,
      roomTotals,
    );
    firstAttemptBySubject = buildFirstAttemptBySubject(
      firstRoundSent,
      firstRoundSubjects,
      total,
    );
  }

  // สัดส่วนสถานะระดับปี — **นับเป็นคน** ถือใบล่าสุดของแต่ละคนเป็นสถานะปัจจุบันของเขา
  // ห้ามเอา by ของแต่ละรอบมาบวกกัน: นั่นเป็นจำนวน "ใบ" คนที่กรอก 2 รอบจะถูกนับ 2 ครั้ง
  // แล้วพอเอาไปหารด้วย total (จำนวนคน) จะได้เกิน 100%
  // 5 ช่องนี้บวกกันได้เท่า total พอดีเสมอ เพราะนักศึกษาคนหนึ่งอยู่ได้ช่องเดียว
  const statusByStudent = countByStatus([...latestPaperOf.values()]);
  statusByStudent.not_started = Math.max(total - latestPaperOf.size, 0);

  return {
    academic_year: year,
    total,
    eligible,
    submitted: everSubmitted.size,
    started: everStarted.size, // มีใบในปีนี้กี่คน (รวม draft) — total − started = ยังไม่เริ่มกรอก
    statusByStudent, // { draft, submitted, approved, rejected, not_started } รวมกัน = total
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
    // ตารางรายวิชาของรอบแรก ตัวหาร = นักศึกษาทั้งรุ่น (null = ยังไม่มีรอบที่ 1 หรือยังไม่ import นักศึกษา)
    firstAttemptBySubject,
    rounds: roundSummaries,
    byRoom, // ผ่านครบ/ส่งแล้วแยกตามห้องเรียน (ปกติ/ภาษาอังกฤษ) — ใช้ตารางเทียบย้อนหลัง
    // อัตราผ่านรายวิชา รวมทุกรอบของปีนี้ — ใช้กราฟเทียบอัตราผ่านรายวิชาย้อนหลัง
    // นับเฉพาะใบที่ยืนยันแล้ว — รอตรวจสอบยังไม่นับ (เหมือนกฎที่ระดับรอบ)
    perSubject: buildPerSubjectByStudent(passedByStudentConfirmed, attemptedByStudentConfirmed, allSubjects),
  };
};

// สรุปของปีเดียว — ใช้ตอนออกรายงาน PDF ที่ต้องมีตัวเลขระดับปีคู่กับตัวเลขระดับรอบ
export const buildYearStats = async (year) => {
  const allSubjects = await dashRepo.findAllSubjects();
  return buildYearSummary(year, allSubjects);
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

/* ---------------------------------------------------------------------------
   แจ้งเตือนของเจ้าหน้าที่/ผู้บริหาร — คำนวณสดทุกครั้งที่เรียก ไม่เก็บลง DB

   ทำไมไม่เก็บลงตาราง notifications เหมือนของนักศึกษา:
   เรื่องพวกนี้เป็น "สถานะ ณ ตอนนี้" (เหลือกี่วันปิดรอบ / ค้างตรวจกี่ใบ) ไม่ใช่เหตุการณ์
   ถ้าเก็บลง DB ต้องมีตัวรันตามเวลามาอัปเดต และจะมีแจ้งเตือนเก่าที่ไม่จริงแล้วค้างอยู่
   คำนวณสดจึงถูกเสมอและไม่ต้องแก้ schema
--------------------------------------------------------------------------- */

const DAY_MS = 24 * 60 * 60 * 1000;

// นับวันแบบตัดเวลาออก เทียบ "วัน" ต่อ "วัน"
// ไม่งั้นรอบที่ปิด 23:59 วันนี้จะกลายเป็นเหลือ 0 วันตั้งแต่เช้า
const daysUntil = (date) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTarget = new Date(date);
  startOfTarget.setHours(0, 0, 0, 0);
  return Math.round((startOfTarget - startOfToday) / DAY_MS);
};

const CLOSING_SOON_DAYS = 7; // เตือนล่วงหน้ากี่วันก่อนปิดรอบ

export const buildAlerts = async (role) => {
  const rounds = await dashRepo.findRoundsByYears(
    await dashRepo.findAcademicYears(),
  );
  if (rounds.length === 0) return { alerts: [] };

  const alerts = [];
  const push = (alert) => alerts.push(alert);

  const openRounds = rounds.filter((r) => r.status === "open");

  for (const round of openRounds) {
    const label = `รอบ ${round.attempt_number}/${round.academic_year}`;
    const left = daysUntil(round.close_date);

    // --- 1. รอบใกล้ปิด / เลยกำหนดแล้ว ---
    if (left < 0) {
      push({
        key: `round-overdue-${round.round_id}`,
        type: "round_overdue",
        tone: "reject",
        icon: "alert",
        title: `${label} เลยกำหนดปิดแล้ว`,
        detail: `ครบกำหนดไปแล้ว ${Math.abs(left)} วัน แต่สถานะยังเป็น "เปิดรับ" — ปิดรอบเพื่อสรุปผล`,
        round_id: round.round_id,
      });
    } else if (left <= CLOSING_SOON_DAYS) {
      let detail = `เหลืออีก ${left} วัน`;
      if (left === 0) detail = "วันนี้เป็นวันสุดท้าย";
      push({
        key: `round-closing-${round.round_id}`,
        type: "round_closing",
        tone: "wait",
        icon: "calendar",
        title: `${label} ใกล้ปิดรับ`,
        detail,
        round_id: round.round_id,
      });
    }

    // --- 2. ยังไม่ส่งผลกี่คน (เตือนเฉพาะตอนใกล้ปิด ไม่งั้นรกตั้งแต่วันเปิดรอบ) ---
    if (left >= 0 && left <= CLOSING_SOON_DAYS) {
      const [cohort, results] = await Promise.all([
        dashRepo.countStudentsByYear(round.academic_year),
        dashRepo.findResultsByRound(round.round_id),
      ]);
      const missing = cohort - onlySent(results).length;
      if (missing > 0) {
        push({
          key: `round-missing-${round.round_id}`,
          type: "not_submitted",
          tone: "wait",
          icon: "users",
          title: `ยังไม่ส่งผลสอบ ${missing} คน`,
          detail: `${label} · จากนักศึกษาทั้งรุ่น ${cohort} คน`,
          round_id: round.round_id,
          count: missing,
        });
      }
    }

    // --- 3. ใบที่รอตรวจ (เจ้าหน้าที่เท่านั้น ผู้บริหารไม่มีสิทธิ์ตรวจอยู่แล้ว) ---
    if (role === "officer") {
      const results = await dashRepo.findResultsByRound(round.round_id);
      const pending = countByStatus(results).submitted;
      if (pending > 0) {
        push({
          key: `round-pending-${round.round_id}`,
          type: "pending_review",
          tone: "navy",
          icon: "checkCircle",
          title: `มีผลสอบรอตรวจ ${pending} ใบ`,
          detail: label,
          round_id: round.round_id,
          count: pending,
        });
      }
    }
  }

  // เดิมมีแจ้งเตือน "สรุปรอบที่เพิ่งปิด" ด้วย แต่เอาออกแล้ว —
  // สรุปผลดูได้จาก dashboard กับหน้ารายงานอยู่แล้ว ไม่ใช่เรื่องที่ต้องลงมือทำ
  // กล่องนี้จึงเหลือเฉพาะเรื่องที่ต้อง "ทำอะไรสักอย่าง" เท่านั้น
  return { alerts };
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
