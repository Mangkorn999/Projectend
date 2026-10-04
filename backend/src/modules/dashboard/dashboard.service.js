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

// ยืนยันแล้วเท่านั้น (staff_status === approved) — ตัด pending (รอตรวจ) และ rejected ออก
//
// **กฎของสถิติทุกตัวที่แปลว่า "ผ่าน"** (ผ่านครบ, ผ่านครั้งแรก, ผ่านภายในปีแรก, ผ่านรายวิชา, ตารางผ่านกี่วิชา, ยอดแยกห้อง):
//   นับเฉพาะใบที่เจ้าหน้าที่ตรวจสอบและยืนยันแล้ว — ผลที่นักศึกษากรอกเองยังไม่มีใครเทียบกับใบรายงานผลสอบ เชื่อยังไม่ได้
//   (เดิมนับใบรอตรวจด้วย ยกเว้นผ่านรายวิชา ทำให้ตัวเลขในหน้าเดียวกันขัดกันเอง เช่น วิชาหนึ่งผ่าน 40 แต่ผ่านครบ 45)
// ใบรอตรวจไม่ได้หายไปไหน: ยังนับเป็น "ส่งผลแล้ว" (fillRate), ยังอยู่ในสัดส่วนสถานะ และหน้าจอเตือนว่ามีกี่ใบที่ยังไม่นับ
// ตัวหารของ % ยังเป็น "นักศึกษาทั้งรุ่น" เหมือนเดิม
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
//
// รอบที่ไม่มีวิชาเลย (subjectIds ว่าง) ตอบ 0 — [].every(...) ให้ true เสมอ ถ้าไม่กันทุกใบจะถูกนับว่า "ผ่านครบ"
const countFullyPassed = (sent, subjectIds) => {
  if (subjectIds.length === 0) {
    return 0;
  }
  return sent.filter((r) =>
    subjectIds.every((id) =>
      r.subject_results.some((sr) => sr.subject_id === id && sr.is_passed),
    ),
  ).length;
};

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

  const counted = onlyConfirmed(sent); // นับเฉพาะใบที่ยืนยันแล้ว — ใบรอตรวจ/ถูกตีกลับไปอยู่ช่อง "ยังไม่ส่ง/ยังไม่ยืนยัน"

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
    submitted: counted.length, // ยืนยันผลรอบแรกแล้วกี่คน (ไม่รวมใบรอตรวจ/ถูกตีกลับ)
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

/* ---------------------------------------------------------------------------
   กฎ "ผ่านภายในปีแรก" — ใช้ร่วมกัน 2 ที่ ต้องได้ตัวเลขตรงกันเสมอ:
     1. buildYearSummary   → ตัวเลข firstYear.passed บนแดชบอร์ด (/api/dashboard/history)
     2. buildFirstYearList → ไฟล์ส่งออกรายชื่อ "ผ่าน/ไม่ผ่านภายในปีแรก"
   แยกเป็นฟังก์ชันไว้ที่เดียว ถ้าวันหนึ่งกฎเปลี่ยน แก้ตรงนี้ที่เดียวแล้วทั้ง 2 ที่เปลี่ยนตาม
--------------------------------------------------------------------------- */

// เก็บ "วิชาที่สอบผ่านจริง" ของแต่ละคนจากใบผลสอบชุดหนึ่ง (ใบของ 1 รอบ) ลงใน passedByStudent
//   passedByStudent = Map ของ student_id -> Set(subject_id) — เรียกซ้ำทีละรอบเพื่อสะสมผลทั้งปี
// กฎ:
//   1. นับเฉพาะใบที่ส่งแล้วและเจ้าหน้าที่ยืนยันแล้ว (approved) — กฎเดียวกับสถิติ "ผ่าน" ทุกตัว (ดู onlyConfirmed)
//   2. ไม่นับแถวที่ยกผลมาจากรอบก่อน (carried_forward) — บั๊ก B1:
//      ใบรอบ 1 ยังรอตรวจตอนเปิดรอบ 2 → รอบ 2 ยกวิชา A มาเป็นผ่าน → ภายหลังเจ้าหน้าที่ตีกลับใบรอบ 1
//      ถ้านับแถวยกมา ใบรอบ 2 ที่ยืนยันแล้วจะทำให้คนนี้ "ผ่านวิชา A" ทั้งที่หลักฐานวิชา A ถูกตีกลับ
//      ตัดทิ้งแล้วไม่เสียอะไร: ถ้าใบต้นทางถูกยืนยัน แถวผ่านจริงในใบต้นทางถูกนับให้อยู่แล้ว
function addConfirmedRealPasses(passedByStudent, results) {
  for (const r of results) {
    // ยังกรอกไม่เสร็จ หรือยังไม่ได้ยืนยัน → ข้าม
    if (r.student_status === "draft") continue;
    if (r.staff_status !== "approved") continue;

    if (!passedByStudent.has(r.student_id)) {
      passedByStudent.set(r.student_id, new Set());
    }
    const passedSet = passedByStudent.get(r.student_id);

    for (const sr of r.subject_results) {
      if (!sr.is_passed) continue; // ไม่ผ่าน
      if (sr.carried_forward) continue; // ยกผลมา ไม่ได้สอบจริงในใบนี้
      passedSet.add(sr.subject_id);
    }
  }
}

// วิชาที่ต้องผ่านให้ครบถึงจะเรียกว่า "สอบผ่าน" ของปีนั้น = วิชาของรอบแรก (ปกติครบ 8 วิชา)
// ปีที่ยังไม่มีรอบแรกในระบบ (หรือรอบแรกไม่เหลือวิชาเลย) ใช้รายวิชาทั้งหมดไปก่อน
function getRequiredSubjectIds(firstRound, allSubjects) {
  const requiredIds = [];
  if (firstRound) {
    const firstRoundSubjects = subjectsOfRound(firstRound, allSubjects);
    for (const sub of firstRoundSubjects) {
      requiredIds.push(sub.subject_id);
    }
  }
  if (requiredIds.length === 0) {
    for (const sub of allSubjects) {
      requiredIds.push(sub.subject_id);
    }
  }
  return requiredIds;
}

// คนนี้ผ่านครบทุกวิชาที่ต้องผ่านหรือยัง — passedSet ว่าง (ไม่มีใบที่ยืนยันแล้วเลย) = ยังไม่ผ่าน
function hasPassedAll(passedSet, requiredSubjectIds) {
  if (!passedSet) return false;
  for (const id of requiredSubjectIds) {
    if (!passedSet.has(id)) return false;
  }
  return true;
}

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
  const confirmed = onlyConfirmed(sent); // ใบที่ยืนยันแล้ว = ฐานของทุกตัวเลข "ผ่าน" (ดูกฎที่ onlyConfirmed)
  const perSubject = buildPerSubject(confirmed, subjects);
  const fullyPassed = countFullyPassed(confirmed, subjectIds);

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
  const canSubmitIds = [];
  for (const s of eligibleStudents) {
    // รอบที่ไม่มีวิชาเลย (subjectIds ว่าง) ห้ามนับใครว่า "ผ่านครบแล้ว"
    // เพราะ [].every(...) ให้ true เสมอ → ทุกคนจะกลายเป็นผ่านครบ ทั้งที่ยังไม่ได้สอบสักวิชา
    let passedAll = false;
    if (subjectIds.length > 0) {
      passedAll = subjectIds.every((id) => s.passed_subject_ids.includes(id));
    }
    if (!passedAll) {
      canSubmit += 1;
      canSubmitIds.push(s.student_id);
    } else alreadyPassedStudentIds.push(s.student_id);
  }

  // "คนของรอบนี้" = คนที่กรอกได้ในรอบนี้ + คนที่มีใบในรอบนี้อยู่แล้ว (กันกรณีมีใบแต่ถูกถอนสิทธิ์ทีหลัง)
  // ใช้เป็นฐานของโดนัท/แถบความคืบหน้าของมุมมองรายรอบ — รอบ 2 ขึ้นไปคนที่ผ่านครบแล้วไม่ต้องกรอก
  // จึงไม่ควรอยู่ในตัวหาร (ไม่งั้นแถบบอก 29/155 ทั้งที่คนที่ต้องกรอกมีแค่ 42)
  // ตัวหารของ % "ผ่าน" ยังเป็นทั้งรุ่นเหมือนเดิม — อันนั้นเป็นสูตรที่ส่งสภาการพยาบาล
  const roundPeople = new Set(canSubmitIds);
  for (const r of results) roundPeople.add(r.student_id);
  const roundTotal = roundPeople.size;

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
    // ฐาน "คนของรอบนี้" — มุมมองรายรอบของ dashboard ใช้ชุดนี้ ไม่ใช่ total/not_started ข้างบน
    // 5 ช่อง (approved+submitted+rejected+draft+roundNotStarted) บวกกันได้เท่า roundTotal พอดี
    roundTotal,
    roundNotStarted: Math.max(roundTotal - results.length, 0),
    roundFillRate: percent(submitted, roundTotal),
    alreadyPassed: alreadyPassedStudentIds.length, // ผ่านครบตั้งแต่ก่อนรอบนี้ — ไม่ต้องกรอก ไม่อยู่ในฐานข้างบน
    submitted,
    fillRate: percent(submitted, total),
    fullyPassed,
    // % คนที่ผ่านครบทุกวิชาของรอบนี้ เทียบกับทั้งรุ่น (ตัวหารเดียวกับ fillRate)
    fullyPassedRate: percent(fullyPassed, total),
    subjectPassRate, // % ผลรายวิชาที่ผ่าน รวมทุกวิชา
    confirmed: confirmed.length, // ใบรอบนี้ที่ยืนยันแล้วกี่ใบ = ฐานของตัวเลข "ผ่าน" · ส่วนที่เหลือของ submitted คือรอตรวจ/ถูกตีกลับ (ยังไม่นับ)
    // % ผ่านครบ เทียบเฉพาะ "คนที่ยืนยันผลรอบนี้แล้ว" — คนละตัวหารกับ fullyPassedRate ข้างบน (ทั้งรุ่น)
    // ใช้ตอบคำถาม "คนที่เข้าสอบรอบนี้ ผ่านกี่ %" ต้องติดป้ายให้ชัดทุกที่ที่เอาไปโชว์
    // (ตัวตั้งกับตัวหารต้องมาจากใบที่ยืนยันแล้วเหมือนกัน ไม่งั้นใบรอตรวจจะลากอัตราลง)
    passRateOfSitters: percent(fullyPassed, confirmed.length),
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
  // วิชาที่แต่ละคนสอบผ่านจริงแล้ว รวมทุกรอบของปีนี้ (ยุบซ้ำด้วย Set) — ใบที่ยืนยันแล้ว + ไม่นับแถวยกผลมา
  // ต้องรวมข้ามรอบ ไม่ใช่ดูทีละรอบ — คนสอบแก้ตัวผ่านครบก็ต่อเมื่อเอาผลรอบก่อนมารวมด้วย
  // เติมข้อมูลด้วย addConfirmedRealPasses (กฎเดียวกับไฟล์ส่งออก "ผ่าน/ไม่ผ่านภายในปีแรก")
  const passedByStudent = new Map(); // student_id -> Set(subject_id)
  // คนละชุดกับ passedByStudent ด้านบน (นั่นใช้กับ "ผ่านครบทุกวิชา" ของปี)
  // 2 ชุดนี้นับเฉพาะใบที่ยืนยันแล้ว (approved) — ใช้กับ perSubject "รวมทั้งปี" เท่านั้น กฎเดียวกับ buildPerSubject รายรอบ
  // (อัตราผ่านรายวิชา นับเฉพาะใบที่ยืนยันแล้ว + นับเฉพาะคนที่สอบจริง ไม่ใช่ carried_forward)
  const passedByStudentConfirmed = new Map(); // student_id -> Set(subject_id) ที่เคยผ่าน (ปีนี้)
  const attemptedByStudentConfirmed = new Map(); // student_id -> Set(subject_id) ที่เคยสอบจริง (ไม่ carried_forward) ปีนี้
  // ใบล่าสุดของแต่ละคน ใช้ทำ statusByStudent ท้ายฟังก์ชัน
  const latestPaperOf = new Map(); // student_id -> examResult

  // ผลของรอบสอบครั้งแรก (attempt_number = 1) เก็บแยกไว้
  // ใช้ทำ "ร้อยละผ่านครั้งแรก" + ตารางผ่านกี่วิชา ซึ่งนับเฉพาะรอบแรกเท่านั้น
  // เก็บ 2 ชุด: Sent = ส่งมาแล้วทุกใบ, Counted = ตัดใบที่ถูกตีกลับออก (ใช้กับทุกตัวที่แปลว่า "ผ่าน")
  let firstRound = null; // ตัวรอบที่ 1 ของปี (ใช้หา "วิชาที่ต้องผ่าน" — ดู getRequiredSubjectIds)
  let firstRoundSent = null;
  let firstRoundConfirmed = null; // ใบรอบแรกที่ยืนยันแล้ว — ฐานของ "ผ่านครั้งแรก" และตารางผ่านกี่วิชา
  let firstRoundSubjectIds = [];
  let firstRoundSubjects = []; // ตัว object เต็ม (มีรหัส/ชื่อวิชา) ไว้ทำตารางรายวิชา

  for (const round of rounds) {
    const results = await dashRepo.findResultsByRound(round.round_id);
    const sent = onlySent(results);
    const counted = notRejected(sent); // ใช้กับ "ส่งผลแล้ว" (fillRate) เท่านั้น — ตัวเลขผ่านใช้ confirmed
    const confirmed = onlyConfirmed(sent);
    const roundSubjects = subjectsOfRound(round, allSubjects);
    const subjectIds = roundSubjects.map((s) => s.subject_id);

    // สะสมวิชาที่ผ่านจริงของแต่ละคน (ใบยืนยันแล้ว + ไม่นับแถวยกผลมา) — ใช้ตัดสิน "ผ่านภายในปีแรก"
    addConfirmedRealPasses(passedByStudent, results);

    for (const r of results) everStarted.add(r.student_id);

    // ใบล่าสุดของแต่ละคนในปีนี้ — rounds เรียงใหม่→เก่า ใบแรกที่เจอจึงเป็นใบล่าสุด
    // ใช้ทำสัดส่วนสถานะ "รายคน": คนที่กรอกหลายรอบต้องนับครั้งเดียว ตามสถานะปัจจุบันของเขา
    for (const r of results) {
      if (!latestPaperOf.has(r.student_id)) latestPaperOf.set(r.student_id, r);
    }

    if (round.attempt_number === 1) {
      firstRound = round;
      firstRoundSent = sent;
      firstRoundConfirmed = confirmed;
      firstRoundSubjectIds = subjectIds;
      firstRoundSubjects = roundSubjects;
    }

    for (const r of counted) {
      everSubmitted.add(r.student_id);
      roomOfStudent.set(r.student_id, r.student.room.room_id);

      // (วิชาที่ผ่านสะสมของแต่ละคน เติมไปแล้วด้านบนด้วย addConfirmedRealPasses)

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
      confirmed: confirmed.length, // ยืนยันแล้วกี่ใบ = ฐานของอัตราผ่านรายรอบ (submitted รวมใบรอตรวจ/ถูกตีกลับด้วย)
      fullyPassed: countFullyPassed(confirmed, subjectIds),
    });
  }

  // วิชาที่ต้องผ่านให้ครบถึงจะเรียกว่า "สอบผ่าน" = วิชาของรอบแรก (ไม่มีรอบแรก = ทุกวิชา)
  const requiredSubjectIds = getRequiredSubjectIds(firstRound, allSubjects);

  // ผ่านครบภายในปีนี้ = ผลรวมทุกรอบครอบคลุมวิชาที่ต้องผ่านทั้งหมด
  const fullyPassedStudents = new Set();
  for (const [studentId, passedSet] of passedByStudent) {
    if (hasPassedAll(passedSet, requiredSubjectIds)) {
      fullyPassedStudents.add(studentId);
    }
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
  if (firstRoundConfirmed) {
    firstAttemptPassed = countFullyPassed(
      firstRoundConfirmed,
      firstRoundSubjectIds,
    );
  }

  let passDistribution = null;
  let firstAttemptBySubject = null;
  if (firstRoundSent) {
    // ตารางแจกแจง "ผ่านกี่วิชา" ใช้ใบที่ยืนยันแล้วเหมือนกัน — คนที่ใบยังรอตรวจ/ถูกตีกลับ/ไม่ได้ส่ง
    // ตกแถวท้าย "ยังไม่ส่ง/ยังไม่ยืนยัน" (ตรงกับตาราง firstAttemptBySubject ที่นับคนกลุ่มนี้เป็น not_submitted)
    passDistribution = buildPassDistribution(
      firstRoundConfirmed,
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
//
// นับ "วัน" ตามเวลาไทย (UTC+7) ไม่ใช้ setHours() — setHours ใช้ timezone ของเครื่อง server
// deploy บนเครื่องที่ตั้งเป็น UTC แล้วตี 1 ตามเวลาไทยจะยังเป็น "เมื่อวาน" จำนวนวันเหลือเพี้ยนไป 1
// (ไทยไม่มี daylight saving เลย เลยบวก 7 ชั่วโมงแล้วหารเป็นวันได้ตรงๆ — ท่าเดียวกับ rounds.controller.js)
const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;
const ictDayNumber = (date) => Math.floor((new Date(date).getTime() + ICT_OFFSET_MS) / DAY_MS);
const daysUntil = (date) => ictDayNumber(date) - ictDayNumber(new Date());

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
      // ฐานคือ "คนที่ต้องกรอกในรอบนี้" (roundTotal) ไม่ใช่ทั้งรุ่น — รอบ 2 ขึ้นไปคนที่ผ่านครบแล้วไม่ต้องกรอก
      // ถ้านับจากทั้งรุ่น จะเตือนว่า "ยังไม่ส่ง" คนที่ไม่มีอะไรต้องส่งอีกแล้ว
      // ยังไม่ส่ง = ยังไม่มีใบเลย (roundNotStarted) + ค้างร่างยังไม่กดส่ง (draft)
      const roundStats = await buildStats(round.round_id);
      const missing = roundStats.roundNotStarted + roundStats.by.draft;
      if (missing > 0) {
        push({
          key: `round-missing-${round.round_id}`,
          type: "not_submitted",
          tone: "wait",
          icon: "users",
          title: `ยังไม่ส่งผลสอบ ${missing} คน`,
          detail: `${label} · จากผู้ที่ต้องกรอกในรอบนี้ ${roundStats.roundTotal} คน`,
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

// สถานะของ "ใบผลสอบ" ที่แสดงในรายชื่อ export
const paperStatusLabel = (result) => {
  if (!result) return "ยังไม่ได้กรอก";
  if (result.student_status === "draft") return "ยังกรอกไม่เสร็จ";
  if (result.staff_status === "approved") return "ยืนยันแล้ว";
  if (result.staff_status === "rejected") return "ถูกตีกลับ";
  return "รอตรวจสอบ";
};

// ข้อมูลประจำตัวของนักศึกษา 1 คน สำหรับแถวในไฟล์ส่งออกรายชื่อ (ใช้ทั้งผ่านครั้งแรกและผ่านภายในปีแรก)
// ชื่อไทย/อังกฤษ ห้อง เบอร์โทร อีเมล — คณะเอาไปใช้ติดต่อ/ออกเอกสาร (ไม่มีเลขบัตรประชาชน)
function studentContactColumns(student) {
  let roomName = "";
  if (student.room) {
    roomName = student.room.room_name;
  }
  return {
    student_id: student.student_id,
    first_name: student.user.first_name,
    last_name: student.user.last_name,
    first_name_en: student.first_name_en,
    last_name_en: student.last_name_en,
    room_name: roomName,
    phone: student.user.phone,
    email: student.user.email,
  };
}

// รายชื่อนักศึกษา "ผ่านครั้งแรก" หรือ "ไม่ผ่านครั้งแรก" ของปีการศึกษาหนึ่ง — ใช้ export
// **กฎเดียวกับ buildYearSummary เป๊ะ** (firstAttempt.passed) ยอดในไฟล์จะได้ตรงกับตัวเลขบนการ์ดเทียบรายปี:
//   - รอบแรก = attempt_number 1 ของปีนั้น, วิชาที่ต้องผ่าน = วิชาของรอบนั้น
//   - ผ่าน = ใบรอบแรก "ยืนยันแล้ว" + ผ่านครบทุกวิชาของรอบ
//   - ไม่ผ่าน = นักศึกษาทั้งรุ่นที่ไม่เข้าเงื่อนไขข้างบน → รวมคนที่ยังไม่ส่ง/ค้าง draft/รอตรวจสอบ/ถูกตีกลับ ด้วย
//     (จึงมีคอลัมน์ "สถานะใบผลสอบ" บอกว่าแต่ละคนไม่ผ่านเพราะอะไร) ผ่าน + ไม่ผ่าน = ทั้งรุ่นเสมอ
export const buildFirstAttemptList = async (year, wantPassed) => {
  const [rounds, students, allSubjects] = await Promise.all([
    dashRepo.findRoundsByYears([year]),
    dashRepo.findStudentsByYear(year),
    dashRepo.findAllSubjects(),
  ]);

  const firstRound = rounds.find(
    (r) => r.academic_year === year && r.attempt_number === 1,
  );
  if (!firstRound) {
    const err = new Error(`ปีการศึกษา ${year} ยังไม่มีรอบสอบครั้งที่ 1 ในระบบ`);
    err.statusCode = 404;
    throw err;
  }

  const results = await dashRepo.findResultsByRound(firstRound.round_id);
  const resultOf = new Map(results.map((r) => [r.student_id, r]));
  const subjects = subjectsOfRound(firstRound, allSubjects);

  const rows = [];
  for (const s of students) {
    const result = resultOf.get(s.student_id);
    // แสดงผลรายวิชาให้ดูได้กับใบที่ส่งแล้วและไม่ถูกตีกลับ (รวมใบรอตรวจ — เจ้าหน้าที่จะได้เห็นว่ารอตรวจอยู่ผ่านกี่วิชา)
    // แต่ "ผ่าน" จริงต้องยืนยันแล้วเท่านั้น (onlyConfirmed ด้านบน) ใบรอตรวจจึงอยู่กลุ่มไม่ผ่านพร้อมสถานะ "รอตรวจสอบ"
    const counted = !!result && result.student_status !== "draft" && result.staff_status !== "rejected";

    const passedSubjects = counted
      ? subjects.filter((sub) =>
          result.subject_results.some((sr) => sr.subject_id === sub.subject_id && sr.is_passed),
        )
      : [];
    const passedAll = counted && result.staff_status === "approved" && passedSubjects.length === subjects.length;
    if (passedAll !== wantPassed) continue;

    // ข้อมูลประจำตัว (ชื่อไทย/อังกฤษ ห้อง เบอร์ อีเมล) + ผลรอบแรกของคนนี้
    const row = studentContactColumns(s);
    row.paper_status = paperStatusLabel(result);
    row.passed_text = counted ? `${passedSubjects.length}/${subjects.length}` : "";
    row.failed_subjects = counted
      ? subjects
          .filter((sub) => !passedSubjects.includes(sub))
          .map((sub) => sub.subject_code)
          .join(", ")
      : "";
    rows.push(row);
  }

  return { year, round: firstRound, total: students.length, wantPassed, rows };
};

// รายชื่อนักศึกษา "ผ่านภายในปีแรก" หรือ "ไม่ผ่านภายในปีแรก" ของปีการศึกษาหนึ่ง — ใช้ export
// **กฎเดียวกับ firstYear.passed ใน buildYearSummary เป๊ะ** (ใช้ addConfirmedRealPasses / getRequiredSubjectIds / hasPassedAll ตัวเดียวกัน)
//   - ผ่าน = รวมผลทุกรอบของปีนั้น (รอบ 1+2+3) แล้วผ่านครบทุกวิชาที่ต้องผ่าน
//            นับเฉพาะใบที่ยืนยันแล้ว และไม่นับวิชาที่ยกผลมาจากรอบก่อน (carried_forward)
//   - วิชาที่ต้องผ่าน = วิชาของรอบที่ 1 (ปีที่ไม่มีรอบที่ 1 = ทุกวิชา)
//   - ไม่ผ่าน = นักศึกษาทั้งรุ่นที่ไม่เข้าเงื่อนไขข้างบน (รวมคนที่ไม่เคยส่งผลเลย) → ผ่าน + ไม่ผ่าน = ทั้งรุ่นเสมอ
export const buildFirstYearList = async (year, wantPassed) => {
  // ขั้นที่ 1: ดึงรอบทั้งหมดของปี นักศึกษาทั้งรุ่น และรายวิชาทั้งหมด
  const [rounds, students, allSubjects] = await Promise.all([
    dashRepo.findRoundsByYears([year]),
    dashRepo.findStudentsByYear(year),
    dashRepo.findAllSubjects(),
  ]);

  // ปีที่ยังไม่มีรอบสอบเลย ไม่มีอะไรให้สรุป (แดชบอร์ดก็ไม่แสดงปีนี้เหมือนกัน)
  if (rounds.length === 0) {
    throw notFound(`ปีการศึกษา ${year} ยังไม่มีรอบสอบในระบบ`);
  }

  // ขั้นที่ 2: ไล่ทุกรอบของปี สะสมวิชาที่ผ่านจริง + จำใบล่าสุดของแต่ละคน (ไว้บอกสถานะในไฟล์)
  const passedByStudent = new Map(); // student_id -> Set(subject_id)
  const latestPaperOf = new Map(); // student_id -> ใบผลสอบใบล่าสุดในปีนี้
  let firstRound = null;
  for (const round of rounds) {
    if (round.attempt_number === 1) {
      firstRound = round;
    }

    const results = await dashRepo.findResultsByRound(round.round_id);
    addConfirmedRealPasses(passedByStudent, results);

    // rounds เรียงจากรอบใหม่ไปเก่า — ใบแรกที่เจอของแต่ละคนจึงเป็นใบล่าสุด
    for (const r of results) {
      if (!latestPaperOf.has(r.student_id)) {
        latestPaperOf.set(r.student_id, r);
      }
    }
  }

  // ขั้นที่ 3: วิชาที่ต้องผ่าน + ตารางแปลง subject_id → รหัสวิชา (ไว้เขียน "วิชาที่ยังไม่ผ่าน")
  const requiredSubjectIds = getRequiredSubjectIds(firstRound, allSubjects);
  const subjectCodeOf = new Map(); // subject_id -> subject_code
  for (const sub of allSubjects) {
    subjectCodeOf.set(sub.subject_id, sub.subject_code);
  }

  // ขั้นที่ 4: ตัดสินทีละคนในรุ่น แล้วเก็บเฉพาะกลุ่มที่ขอ (ผ่าน หรือ ไม่ผ่าน)
  const rows = [];
  for (const s of students) {
    const passedSet = passedByStudent.get(s.student_id);
    const passedAll = hasPassedAll(passedSet, requiredSubjectIds);
    if (passedAll !== wantPassed) continue;

    // นับวิชาที่ผ่านแล้ว และรายชื่อวิชาที่ยังไม่ผ่าน (เทียบเฉพาะวิชาที่ต้องผ่าน)
    let passedCount = 0;
    const missingCodes = [];
    for (const id of requiredSubjectIds) {
      if (passedSet && passedSet.has(id)) {
        passedCount += 1;
      } else {
        missingCodes.push(subjectCodeOf.get(id));
      }
    }

    const row = studentContactColumns(s);
    row.paper_status = paperStatusLabel(latestPaperOf.get(s.student_id));
    row.passed_text = `${passedCount}/${requiredSubjectIds.length}`;
    row.failed_subjects = missingCodes.join(", ");
    rows.push(row);
  }

  return { year, total: students.length, wantPassed, rows };
};