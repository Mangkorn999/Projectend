/**
 * demoSeed.js — ข้อมูลตัวอย่างสำหรับเดโมให้อาจารย์ดู
 *
 * ใส่นักศึกษา 20 คน 3 ปีการศึกษา (2567 / 2568 / 2569)
 * ผลสอบทุกใบ "เจ้าหน้าที่ยืนยันแล้ว" (staff_status = approved) ตามที่ตกลงไว้
 *
 * ของที่ไม่แตะ (ต้องมีอยู่แล้วใน DB): roles, faculties, rooms, subjects,
 * และ user ที่เป็น officer / executive
 *
 * รัน: npm run demo:seed   (หรือ node --env-file=.env prisma/demoSeed.js)
 * รันซ้ำได้ — ตอนเริ่มจะล้างเฉพาะข้อมูลเดโมของตัวเองก่อน
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// รหัสผ่านนักศึกษาเดโม = รหัสนักศึกษาตัวเอง, ไม่ต้องบังคับเปลี่ยนรหัส (จะได้ login โชว์ได้เลย)
const demoPassword = (studentId) => bcrypt.hashSync(studentId, 10);

// ---------------------------------------------------------------------------
// 1. สเปกข้อมูล — เขียนเป็นตารางอ่านง่าย ไม่ random เพื่อให้เดโมได้ผลเดิมทุกครั้ง
// ---------------------------------------------------------------------------

// รอบสอบ: ปี, ครั้งที่, วิชาที่รอบนั้นสอบ ([] = ครบ 8 วิชา), ช่วงเวลาเปิด-ปิด
const ROUNDS = [
  { year: 2567, attempt: 1, subjects: [], open: "2024-06-01", close: "2024-06-30" },
  // รอบแก้ตัว — สอบเฉพาะวิชาที่มีคนตกจากรอบ 1
  { year: 2567, attempt: 2, subjects: ["NUR02", "NUR03", "NUR05", "NUR06", "NUR07"], open: "2024-10-01", close: "2024-10-31" },
  { year: 2568, attempt: 1, subjects: [], open: "2025-06-01", close: "2025-06-30" },
  { year: 2568, attempt: 2, subjects: ["NUR01", "NUR04", "NUR08"], open: "2025-10-01", close: "2025-10-31" },
  // รอบล่าสุด — dashboard จะเลือกรอบนี้เป็นค่าเริ่มต้นเพราะไม่มีรอบไหนเปิดอยู่
  { year: 2569, attempt: 1, subjects: [], open: "2026-06-01", close: "2026-06-30" },
];

// นักศึกษา 20 คน — student_id ใช้เป็น psu_passport_id และรหัสผ่านด้วย
// room: 1 = ห้องเรียนปกติ, 2 = ห้องเรียนอังกฤษ (แม็พตามลำดับที่มีใน DB)
const STUDENTS = [
  // --- รุ่น 2567 (7 คน) ---
  { id: "6410210001", first: "ณัฐพงศ์", last: "ศรีสมบัติ", year: 2567, room: 0 },
  { id: "6410210002", first: "พิมพ์ชนก", last: "แก้วมณี", year: 2567, room: 0 },
  { id: "6410210003", first: "ธนกฤต", last: "วงศ์อารีย์", year: 2567, room: 1 },
  { id: "6410210004", first: "สุพรรษา", last: "จันทร์เพ็ญ", year: 2567, room: 0 },
  { id: "6410210005", first: "อรรถพล", last: "บุญมาก", year: 2567, room: 1 },
  { id: "6410210006", first: "กมลชนก", last: "ทองสุข", year: 2567, room: 0 },
  { id: "6410210007", first: "วรเมธ", last: "อินทร์ทอง", year: 2567, room: 1 },
  // --- รุ่น 2568 (7 คน) ---
  { id: "6510210001", first: "ปิยะนุช", last: "สมบูรณ์ดี", year: 2568, room: 0 },
  { id: "6510210002", first: "ชนาธิป", last: "รัตนพล", year: 2568, room: 0 },
  { id: "6510210003", first: "ศิริพร", last: "เกตุแก้ว", year: 2568, room: 1 },
  { id: "6510210004", first: "ภาณุพงษ์", last: "ดวงจันทร์", year: 2568, room: 0 },
  { id: "6510210005", first: "จิราพร", last: "แซ่ลิ้ม", year: 2568, room: 1 },
  { id: "6510210006", first: "อนุชา", last: "พรหมมา", year: 2568, room: 0 },
  { id: "6510210007", first: "เบญจวรรณ", last: "ชูเชิด", year: 2568, room: 1 },
  // --- รุ่น 2569 (6 คน) ---
  { id: "6610210001", first: "รัตนาภรณ์", last: "ขวัญเมือง", year: 2569, room: 0 },
  { id: "6610210002", first: "กิตติศักดิ์", last: "นวลจันทร์", year: 2569, room: 0 },
  { id: "6610210003", first: "สุธาสินี", last: "ปานทอง", year: 2569, room: 1 },
  { id: "6610210004", first: "ธีรภัทร", last: "เพชรรัตน์", year: 2569, room: 0 },
  { id: "6610210005", first: "นภัสสร", last: "หมื่นสุข", year: 2569, room: 1 },
  { id: "6610210006", first: "ชยพล", last: "มณีโชติ", year: 2569, room: 0 },
];

// ผลสอบ — เขียนแค่ "วิชาที่ตก" ที่เหลือถือว่าผ่าน
// retake: true = รอบแก้ตัว วิชาที่ไม่ได้สอบรอบนี้จะยกผลผ่านมาจากรอบก่อน (carried_forward)
const RESULTS = [
  // ===== 2567 รอบ 1 — ครบ 8 วิชา =====
  { student: "6410210001", year: 2567, attempt: 1, failed: [] },
  { student: "6410210002", year: 2567, attempt: 1, failed: [] },
  { student: "6410210003", year: 2567, attempt: 1, failed: [] },
  { student: "6410210004", year: 2567, attempt: 1, failed: ["NUR03"] },
  { student: "6410210005", year: 2567, attempt: 1, failed: ["NUR03", "NUR05"] },
  { student: "6410210006", year: 2567, attempt: 1, failed: ["NUR07"] },
  { student: "6410210007", year: 2567, attempt: 1, failed: ["NUR02", "NUR03", "NUR06"] },

  // ===== 2567 รอบ 2 — เฉพาะคนที่ตก มาสอบแก้ =====
  // สอบจริงแค่วิชาที่ตัวเองตก ที่เหลือ carried_forward
  { student: "6410210004", year: 2567, attempt: 2, retake: true, sat: ["NUR03"], failed: [] },
  { student: "6410210005", year: 2567, attempt: 2, retake: true, sat: ["NUR03", "NUR05"], failed: ["NUR05"] },
  { student: "6410210006", year: 2567, attempt: 2, retake: true, sat: ["NUR07"], failed: [] },
  { student: "6410210007", year: 2567, attempt: 2, retake: true, sat: ["NUR02", "NUR03", "NUR06"], failed: ["NUR06"] },

  // ===== 2568 รอบ 1 =====
  { student: "6510210001", year: 2568, attempt: 1, failed: [] },
  { student: "6510210002", year: 2568, attempt: 1, failed: [] },
  { student: "6510210003", year: 2568, attempt: 1, failed: [] },
  { student: "6510210004", year: 2568, attempt: 1, failed: [] },
  { student: "6510210005", year: 2568, attempt: 1, failed: ["NUR01"] },
  { student: "6510210006", year: 2568, attempt: 1, failed: ["NUR04", "NUR08"] },
  { student: "6510210007", year: 2568, attempt: 1, failed: ["NUR01", "NUR04"] },

  // ===== 2568 รอบ 2 =====
  { student: "6510210005", year: 2568, attempt: 2, retake: true, sat: ["NUR01"], failed: [] },
  { student: "6510210006", year: 2568, attempt: 2, retake: true, sat: ["NUR04", "NUR08"], failed: [] },
  { student: "6510210007", year: 2568, attempt: 2, retake: true, sat: ["NUR01", "NUR04"], failed: ["NUR04"] },

  // ===== 2569 รอบ 1 — รอบล่าสุด ยังไม่มีรอบแก้ตัว =====
  { student: "6610210001", year: 2569, attempt: 1, failed: [] },
  { student: "6610210002", year: 2569, attempt: 1, failed: [] },
  { student: "6610210003", year: 2569, attempt: 1, failed: [] },
  { student: "6610210004", year: 2569, attempt: 1, failed: ["NUR05"] },
  { student: "6610210005", year: 2569, attempt: 1, failed: ["NUR02", "NUR06"] },
  { student: "6610210006", year: 2569, attempt: 1, failed: ["NUR03", "NUR05", "NUR07"] },
];

// ไฟล์ PDF ที่มีอยู่จริงใน uploads/certificates — เอามาแปะให้บางใบมีหลักฐานแนบ
const CERT_FILES = [
  "uploads/certificates/1785815069741-227482231.pdf",
  "uploads/certificates/1785819653186-729027226.pdf",
  "uploads/certificates/1785819704119-296969794.pdf",
  "uploads/certificates/1785819834703-490401133.pdf",
  "uploads/certificates/1785820467922-649226844.pdf",
];

// ---------------------------------------------------------------------------
// 2. ลงมือ insert
// ---------------------------------------------------------------------------
async function main() {
  // --- ตรวจของที่ต้องมีอยู่ก่อน ---
  const [officer, executive, faculty, rooms, subjects] = await Promise.all([
    prisma.user.findFirst({ where: { role: { role_name: "officer" } } }),
    prisma.user.findFirst({ where: { role: { role_name: "executive" } } }),
    prisma.faculty.findFirst(),
    prisma.room.findMany({ orderBy: { room_id: "asc" } }),
    prisma.subject.findMany({ orderBy: { subject_code: "asc" } }),
  ]);

  if (!officer) throw new Error("ไม่พบ user role=officer — ต้องมีก่อนรัน demo seed");
  if (!faculty) throw new Error("ไม่พบ faculty");
  if (rooms.length === 0) throw new Error("ไม่พบ room");
  if (subjects.length < 8) throw new Error(`subjects มีแค่ ${subjects.length} วิชา ต้องมี 8`);

  const studentRole = await prisma.role.findFirst({ where: { role_name: "student" } });
  if (!studentRole) throw new Error("ไม่พบ role student");

  // แม็พ subject_code -> subject_id ไว้ใช้ตอนสร้างผลรายวิชา
  const byCode = new Map(subjects.map((s) => [s.subject_code, s]));
  const idOf = (code) => {
    const s = byCode.get(code);
    if (!s) throw new Error(`ไม่รู้จักวิชา ${code}`);
    return s.subject_id;
  };

  // --- ล้างข้อมูลเดโมเก่า (เฉพาะของ demo seed เอง) เพื่อให้รันซ้ำได้ ---
  const demoIds = STUDENTS.map((s) => s.id);
  await prisma.certificate.deleteMany({ where: { exam_result: { student_id: { in: demoIds } } } });
  await prisma.subjectResult.deleteMany({ where: { exam_result: { student_id: { in: demoIds } } } });
  await prisma.examResult.deleteMany({ where: { student_id: { in: demoIds } } });
  await prisma.student.deleteMany({ where: { student_id: { in: demoIds } } });
  await prisma.user.deleteMany({ where: { psu_passport_id: { in: demoIds } } });

  // --- นักศึกษา 20 คน ---
  for (const s of STUDENTS) {
    const user = await prisma.user.create({
      data: {
        role_id: studentRole.role_id,
        psu_passport_id: s.id,
        password_hash: demoPassword(s.id),
        must_change_password: false, // บัญชีเดโม — login โชว์ได้เลย
        first_name: s.first,
        last_name: s.last,
        email: `${s.id}@psu.ac.th`,
        phone: `08${s.id.slice(-8)}`,
      },
    });
    await prisma.student.create({
      data: {
        student_id: s.id,
        user_id: user.user_id,
        faculty_id: faculty.faculty_id,
        room_id: rooms[s.room % rooms.length].room_id,
        academic_year: s.year,
        exam_eligible: true, // เปิดสิทธิ์ให้หมด ไม่งั้น dashboard นับตัวหารไม่ตรง
      },
    });
  }
  console.log(`students created: ${STUDENTS.length}`);

  // --- รอบสอบ ---
  const roundOf = new Map(); // "year-attempt" -> round record
  for (const r of ROUNDS) {
    const round = await prisma.submissionRound.create({
      data: {
        created_by: officer.user_id,
        academic_year: r.year,
        attempt_number: r.attempt,
        open_date: new Date(r.open),
        close_date: new Date(`${r.close}T23:59:59`),
        status: "closed", // ปิดหมด — ทุกใบตรวจเสร็จแล้ว
        subject_ids: r.subjects.map(idOf),
      },
    });
    roundOf.set(`${r.year}-${r.attempt}`, round);
  }
  console.log(`rounds created: ${ROUNDS.length}`);

  // --- ผลสอบ + ผลรายวิชา ---
  const createdResults = [];
  for (const spec of RESULTS) {
    const round = roundOf.get(`${spec.year}-${spec.attempt}`);
    const roundSpec = ROUNDS.find((r) => r.year === spec.year && r.attempt === spec.attempt);

    // วิชาที่รอบนี้สอบ — [] แปลว่าครบทุกวิชา
    const roundCodes = roundSpec.subjects.length
      ? roundSpec.subjects
      : subjects.map((s) => s.subject_code);

    // รอบแก้ตัว: สอบจริงแค่วิชาใน sat ที่เหลือยกผลผ่านมาจากรอบก่อน
    const satCodes = spec.retake ? spec.sat : roundCodes;

    const closeDate = new Date(`${roundSpec.close}T10:00:00`);
    const result = await prisma.examResult.create({
      data: {
        student_id: spec.student,
        round_id: round.round_id,
        student_status: "submitted",
        staff_status: "approved", // เจ้าหน้าที่ยืนยันหมดแล้วตามที่สั่ง
        confirmed_by: officer.user_id,
        submitted_at: closeDate,
        confirmed_at: new Date(closeDate.getTime() + 2 * 24 * 60 * 60 * 1000),
        subject_results: {
          create: roundCodes.map((code) => ({
            subject_id: idOf(code),
            is_passed: !spec.failed.includes(code),
            // ไม่ได้สอบวิชานี้ในรอบนี้ = ยกผลผ่านมาจากรอบก่อน
            // สถิติรายวิชาจะข้ามแถวพวกนี้ ไม่งั้นอัตราผ่านจะเด้งเป็น 100%
            carried_forward: !satCodes.includes(code),
          })),
        },
      },
    });
    createdResults.push(result);
  }
  console.log(`exam results created: ${createdResults.length}`);

  // --- เอกสารแนบ: แปะไฟล์ PDF ที่มีอยู่จริงให้ 5 ใบแรก ---
  for (let i = 0; i < CERT_FILES.length && i < createdResults.length; i++) {
    const filePath = CERT_FILES[i];
    await prisma.certificate.create({
      data: {
        result_id: createdResults[i].result_id,
        certificate_type: i % 2 === 0 ? "exam_result" : "license",
        file_name: filePath.split("/").pop(),
        file_path: filePath,
        file_type: "pdf",
      },
    });
  }
  console.log(`certificates attached: ${Math.min(CERT_FILES.length, createdResults.length)}`);

  // --- ข่าวสาร/ประกาศ ---
  await prisma.news.deleteMany({});
  const latestRound = roundOf.get("2569-1");
  await prisma.news.create({
    data: {
      posted_by: officer.user_id,
      round_id: latestRound.round_id,
      title: "ประกาศผลสอบใบประกอบวิชาชีพ ประจำปีการศึกษา 2569 ครั้งที่ 1",
      content:
        "เจ้าหน้าที่ตรวจสอบและยืนยันผลสอบของนักศึกษาทุกคนเรียบร้อยแล้ว " +
        "นักศึกษาสามารถเข้าดูผลของตนเองได้ที่เมนูประวัติการกรอกผลสอบ",
      image_path: "uploads/news/1785814827068-214848859.png",
    },
  });
  await prisma.news.create({
    data: {
      posted_by: officer.user_id,
      round_id: roundOf.get("2568-2").round_id,
      title: "แจ้งกำหนดการสอบแก้ตัว ปีการศึกษา 2568 ครั้งที่ 2",
      content:
        "นักศึกษาที่ยังสอบไม่ผ่านบางรายวิชา ให้กรอกผลสอบรอบแก้ตัวภายในวันที่ 31 ตุลาคม 2568 " +
        "รายวิชาที่เปิดสอบรอบนี้: NUR01, NUR04, NUR08",
    },
  });
  console.log("news created: 2");

  // --- สรุปให้ดูว่าเดโมได้อะไรบ้าง ---
  console.log("\n=== สรุปข้อมูลเดโม ===");
  console.table({
    students: await prisma.student.count(),
    submission_rounds: await prisma.submissionRound.count(),
    exam_results: await prisma.examResult.count(),
    subject_results: await prisma.subjectResult.count(),
    certificates: await prisma.certificate.count(),
    news: await prisma.news.count(),
  });

  console.log("\nบัญชีสำหรับเดโม (password = username):");
  console.log(`  officer   : ${officer.psu_passport_id}`);
  if (executive) console.log(`  executive : ${executive.psu_passport_id}`);
  console.log("  student   : 6610210001 (ผ่านครบ) / 6610210006 (ตก 3 วิชา) / 6410210004 (สอบแก้ตัวผ่าน)");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
