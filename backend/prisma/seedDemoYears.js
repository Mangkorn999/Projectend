/**
 * seedDemoYears.js — สร้างข้อมูลจำลองหลายรุ่นไว้ทดสอบ dashboard/รายงานกับข้อมูลปริมาณจริง
 *
 * รัน: npm run seed:demo-years
 *      npm run seed:demo-years -- 2565 2569        (ระบุปีเริ่ม-ปีจบเอง)
 *
 * สร้างอะไร (ค่าเริ่มต้น รุ่น 2565–2569):
 *   - นักศึกษา 150–200 คนต่อรุ่น แบ่ง 2 ห้อง (ปกติ ~70% / อังกฤษ ~30%)
 *   - รุ่นที่จบแล้ว: รอบ 1 (ครบ 8 วิชา) + รอบ 2 (เฉพาะวิชาที่มีคนตก) + รอบ 3 ถ้ายังเหลือคนตกเยอะ
 *     ทุกใบเจ้าหน้าที่ตรวจแล้ว รอบปิดหมด
 *   - รุ่นล่าสุด: รอบ 1 ปิดและตรวจครบ, รอบ 2 **เปิดรับอยู่** และค้างกลางคัน
 *     (มีทั้งใบรอตรวจ / ตีกลับ / ยืนยันแล้ว / ยังไม่กรอก) — คิวตรวจของเจ้าหน้าที่จะมีงานจริง
 *
 * ของที่ต้องมีอยู่แล้วใน DB: roles, faculties, rooms (>=2), subjects (8 วิชา), บัญชี officer
 * รันซ้ำได้ — ลบข้อมูลของปีที่ระบุทิ้งก่อนเสมอ ไม่แตะปีอื่นและไม่แตะบัญชีเจ้าหน้าที่/ผู้บริหาร
 *
 * ตัวเลขทุกตัวมาจาก PRNG ที่ fix seed ไว้ → รันกี่ครั้งก็ได้ข้อมูลชุดเดิมเป๊ะ เทียบผลลัพธ์ได้
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const START_YEAR = Number(process.argv[2]) || 2565;
const END_YEAR = Number(process.argv[3]) || 2569;

// รหัสผ่านเดียวกันทุกคน — hash ครั้งเดียวแล้วใช้ซ้ำ
// ถ้า hash ทีละคน 900 คนจะรอเป็นนาที (bcrypt ตั้งใจให้ช้า) ข้อมูลทดสอบไม่ต้องแยกรหัส
const DEMO_PASSWORD = "demo1234";

// PRNG แบบ fix seed — Math.random() รันแต่ละครั้งได้คนละชุด เทียบผลลัพธ์ไม่ได้
const mulberry32 = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
let rand = mulberry32(20260812);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

const FIRST_NAMES = [
  "ณัฐพงศ์", "พิมพ์ชนก", "ธนกฤต", "สุพรรษา", "อรรถพล", "กมลชนก", "วรเมธ", "ปิยะนุช",
  "ชนาธิป", "ศิริพร", "ภาณุพงษ์", "จิราพร", "อนุชา", "เบญจวรรณ", "รัตนาภรณ์", "กิตติศักดิ์",
  "สุธาสินี", "ธีรภัทร", "นภัสสร", "ชยพล", "ปณิดา", "อภิสิทธิ์", "ญาณิศา", "ทศพล",
  "วิภาวี", "ศุภกร", "อารียา", "พีรพัฒน์", "ชลธิชา", "กันตพงศ์", "ธัญชนก", "เมธาสิทธิ์",
];
const LAST_NAMES = [
  "ศรีสมบัติ", "แก้วมณี", "วงศ์อารีย์", "จันทร์เพ็ญ", "บุญมาก", "ทองสุข", "อินทร์ทอง",
  "สมบูรณ์ดี", "รัตนพล", "เกตุแก้ว", "ดวงจันทร์", "แซ่ลิ้ม", "พรหมมา", "ชูเชิด",
  "ขวัญเมือง", "นวลจันทร์", "ปานทอง", "เพชรรัตน์", "มณีโชติ", "สุขสวัสดิ์", "คงคาไหล",
];

// รหัสนักศึกษา 2 ตัวหน้า = ปีที่เข้าเรียน = ปีการศึกษาที่จบ − 3 (หลักสูตร 4 ปี)
const idPrefixOf = (year) => String(year - 3).slice(-2);
const toCE = (beYear) => beYear - 543;

// ── กติกาการสอบผ่าน ────────────────────────────────────────────────
// คุมจาก "ผลรวมที่อยากได้" ไม่ใช่คูณความน่าจะเป็นรายวิชา
// (ถ้าสุ่มทีละวิชาแล้วคูณกัน 8 ครั้ง สัดส่วนผ่านครบจะยุบเหลือไม่กี่ % ไม่เหมือนของจริง)
//
//   รอบแรก  : ผ่านครบเลย 72% · ที่เหลือตก 1 วิชา 50% / 2 วิชา 30% / 3 วิชา 20%
//   รอบแก้ตัว: แต่ละวิชาที่ยังค้าง มีโอกาสผ่าน 80% (รอบ 2) และ 70% (รอบ 3)
//
// วิชาที่ตกเลือกแบบถ่วงน้ำหนักตามความยาก — วิชายากจะมีคนตกมากกว่าจริงๆ ในตารางรายวิชา
const FIRST_ROUND_PASS_ALL = 0.72;
const retryChance = (attempt) => (attempt === 2 ? 0.8 : 0.7);

const pickWeighted = (subjectIds, difficultyOf, howMany) => {
  const pool = [...subjectIds];
  const chosen = new Set();
  while (chosen.size < howMany && pool.length > 0) {
    const total = pool.reduce((sum, id) => sum + difficultyOf.get(id), 0);
    let roll = rand() * total;
    let taken = pool[pool.length - 1];
    for (const id of pool) {
      roll -= difficultyOf.get(id);
      if (roll <= 0) { taken = id; break; }
    }
    chosen.add(taken);
    pool.splice(pool.indexOf(taken), 1);
  }
  return chosen;
};

const main = async () => {
  const years = [];
  for (let y = START_YEAR; y <= END_YEAR; y++) years.push(y);
  const latestYear = years[years.length - 1];

  const [faculty, rooms, subjects, officer] = await Promise.all([
    prisma.faculty.findFirst(),
    prisma.room.findMany({ orderBy: { room_id: "asc" } }),
    prisma.subject.findMany({ orderBy: { subject_id: "asc" } }),
    prisma.user.findFirst({ where: { role: { role_name: "officer" } } }),
  ]);
  if (!faculty) throw new Error("ยังไม่มีคณะใน DB");
  if (rooms.length < 2) throw new Error("ต้องมีห้องเรียนอย่างน้อย 2 ห้อง");
  if (subjects.length === 0) throw new Error("ยังไม่มีรายวิชาใน DB");
  if (!officer) throw new Error("ไม่มีบัญชี officer — รอบสอบต้องมีคนสร้าง");

  const studentRole = await prisma.role.findFirst({ where: { role_name: "student" } });
  if (!studentRole) throw new Error("ไม่มี role student");

  // ความยากของแต่ละวิชา 0..1 — fix ไว้ต่อ subject_id จะได้เห็นวิชาที่ยากกว่าเพื่อนในกราฟทุกปี
  const difficultyOf = new Map();
  subjects.forEach((s, i) => difficultyOf.set(s.subject_id, [0.15, 0.55, 0.3, 0.7, 0.25, 0.6, 0.4, 0.45][i % 8]));

  // ── ล้างของเดิมของปีที่จะสร้าง ──
  const oldStudents = await prisma.student.findMany({
    where: { academic_year: { in: years } },
    select: { student_id: true, user_id: true },
  });
  const oldSids = oldStudents.map((s) => s.student_id);
  const oldResults = await prisma.examResult.findMany({
    where: { OR: [{ student_id: { in: oldSids } }, { round: { academic_year: { in: years } } }] },
    select: { result_id: true },
  });
  const oldRids = oldResults.map((r) => r.result_id);
  await prisma.certificate.deleteMany({ where: { result_id: { in: oldRids } } });
  await prisma.subjectResult.deleteMany({ where: { result_id: { in: oldRids } } });
  await prisma.examResult.deleteMany({ where: { result_id: { in: oldRids } } });
  await prisma.notification.deleteMany({ where: { student_id: { in: oldSids } } });
  await prisma.news.deleteMany({ where: { round: { academic_year: { in: years } } } });
  await prisma.submissionRound.deleteMany({ where: { academic_year: { in: years } } });
  await prisma.student.deleteMany({ where: { student_id: { in: oldSids } } });
  await prisma.user.deleteMany({ where: { user_id: { in: oldStudents.map((s) => s.user_id) } } });
  console.log(`ล้างข้อมูลเดิมของปี ${years.join(", ")} แล้ว (นักศึกษา ${oldSids.length} คน)`);

  // ระบบให้มีรอบ status = "open" ได้ทีละรอบเดียว (ensureNoOtherOpenRound ใน rounds.controller.js)
  // สคริปต์นี้เขียนผ่าน Prisma ตรงๆ เลยข้ามด่านนั้นไป ต้องปิดรอบที่ค้างเปิดอยู่เองก่อน
  // ไม่งั้นจะได้ DB ที่ผิดกติกาของระบบ แล้ว findActive หยิบรอบมั่วให้นักศึกษา
  const stillOpen = await prisma.submissionRound.updateMany({
    where: { status: "open" },
    data: { status: "closed" },
  });
  if (stillOpen.count > 0) console.log(`ปิดรอบที่ค้างเปิดอยู่ ${stillOpen.count} รอบ (ระบบให้เปิดได้ทีละรอบเดียว)`);

  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const summary = [];

  for (const year of years) {
    const isLatest = year === latestYear;
    const count = between(150, 200);
    const firstRoomCount = Math.round(count * 0.7);
    const prefix = idPrefixOf(year);

    // ── นักศึกษา ──
    const people = [];
    for (let i = 0; i < count; i++) {
      people.push({
        id: `${prefix}1021${String(i + 1).padStart(4, "0")}`,
        first: pick(FIRST_NAMES),
        last: pick(LAST_NAMES),
        room: i < firstRoomCount ? rooms[0].room_id : rooms[1].room_id,
        ability: rand(), // 0..1 คงที่ต่อคน ใช้ตัดสินผลทุกรอบของคนนั้น
      });
    }

    // รหัสนักศึกษาที่จะใช้ อาจมีคนถืออยู่แล้วจากข้อมูลรุ่นอื่น/ข้อมูลค้างเก่า (psu_passport_id เป็น unique)
    // เคลียร์เฉพาะรหัสที่กำลังจะสร้างเท่านั้น ไม่กวาดทั้งปี — ปลอดภัยกว่าและทำให้รันซ้ำได้เสมอ
    const wantedIds = people.map((p) => p.id);
    const clashing = await prisma.user.findMany({
      where: { psu_passport_id: { in: wantedIds } },
      select: { user_id: true, student: { select: { student_id: true } } },
    });
    if (clashing.length > 0) {
      const sids = clashing.map((u) => u.student?.student_id).filter(Boolean);
      const rids = (
        await prisma.examResult.findMany({ where: { student_id: { in: sids } }, select: { result_id: true } })
      ).map((r) => r.result_id);
      await prisma.certificate.deleteMany({ where: { result_id: { in: rids } } });
      await prisma.subjectResult.deleteMany({ where: { result_id: { in: rids } } });
      await prisma.examResult.deleteMany({ where: { result_id: { in: rids } } });
      await prisma.notification.deleteMany({ where: { student_id: { in: sids } } });
      await prisma.student.deleteMany({ where: { student_id: { in: sids } } });
      await prisma.user.deleteMany({ where: { user_id: { in: clashing.map((u) => u.user_id) } } });
      console.log(`  (รุ่น ${year}: รหัสซ้ำกับข้อมูลเดิม ${clashing.length} รายการ ลบทิ้งก่อนสร้างใหม่)`);
    }

    await prisma.user.createMany({
      data: people.map((p) => ({
        role_id: studentRole.role_id,
        psu_passport_id: p.id,
        password_hash: passwordHash,
        must_change_password: false,
        first_name: p.first,
        last_name: p.last,
        email: `${p.id}@psu.ac.th`,
        phone: "08" + String(between(10000000, 99999999)),
      })),
    });
    const users = await prisma.user.findMany({
      where: { psu_passport_id: { in: people.map((p) => p.id) } },
      select: { user_id: true, psu_passport_id: true },
    });
    const userIdOf = new Map(users.map((u) => [u.psu_passport_id, u.user_id]));

    await prisma.student.createMany({
      data: people.map((p) => ({
        student_id: p.id,
        user_id: userIdOf.get(p.id),
        faculty_id: faculty.faculty_id,
        academic_year: year,
        room_id: p.room,
        exam_eligible: true,
        // ข้อมูลเดโมไม่มีชื่ออังกฤษ — ใส่ placeholder กัน schema บังคับ NOT NULL
        first_name_en: `Student${p.id.slice(-4)}`,
        last_name_en: "Demo",
      })),
    });

    // ── รอบ 1: ครบทุกวิชา ──
    const ce = toCE(year);
    const round1 = await prisma.submissionRound.create({
      data: {
        created_by: officer.user_id,
        academic_year: year,
        attempt_number: 1,
        open_date: new Date(`${ce}-06-01T00:00:00+07:00`),
        close_date: new Date(`${ce}-06-30T23:59:59+07:00`),
        status: "closed",
        subject_ids: subjects.map((s) => s.subject_id),
      },
    });

    // passedBy: student_id -> Set(subject_id ที่ผ่านแล้ว) สะสมข้ามรอบ
    const passedBy = new Map();
    const allSubjectIds = subjects.map((s) => s.subject_id);

    // 4% ของรุ่นไม่ส่งผลรอบแรกเลย (ย้ายไปเรียนต่อ/ติดธุระ) — dashboard ต้องมีช่อง "ยังไม่ส่งผล"
    const skippers = new Set();
    for (const p of people) if (rand() < 0.04) skippers.add(p.id);

    // วิชาที่แต่ละคนจะตกในรอบแรก — คิดล่วงหน้าเพื่อคุมสัดส่วน "ผ่านครบรอบแรก" ให้ตรงเป้า
    const firstRoundFails = new Map();
    for (const p of people) {
      if (rand() < FIRST_ROUND_PASS_ALL) {
        firstRoundFails.set(p.id, new Set());
      } else {
        const r = rand();
        const howMany = r < 0.5 ? 1 : r < 0.8 ? 2 : 3;
        firstRoundFails.set(p.id, pickWeighted(allSubjectIds, difficultyOf, howMany));
      }
    }

    const makeMarks = (p, subjectIds, attempt) => {
      const already = passedBy.get(p.id) ?? new Set();
      const marks = subjectIds.map((sid) => {
        if (already.has(sid)) return { subject_id: sid, is_passed: true, carried_forward: true };
        const ok =
          attempt === 1
            ? !firstRoundFails.get(p.id).has(sid)
            : rand() < retryChance(attempt);
        if (ok) already.add(sid);
        return { subject_id: sid, is_passed: ok, carried_forward: false };
      });
      passedBy.set(p.id, already);
      return marks;
    };

    // สร้างใบผลสอบของรอบหนึ่ง — คืน array ของ { student_id, marks, staff_status }
    const buildPapers = (subjectIds, attempt, participants, statusOf) =>
      participants.map((p) => ({
        student_id: p.id,
        marks: makeMarks(p, subjectIds, attempt),
        staff: statusOf(p),
      }));

    const writePapers = (roundId, papers, rejectRemark) =>
      (async () => {
        await prisma.examResult.createMany({
          data: papers.map((paper) => ({
            student_id: paper.student_id,
            round_id: roundId,
            student_status: "submitted",
            staff_status: paper.staff,
            remark: paper.staff === "rejected" ? rejectRemark : null,
            confirmed_by: paper.staff === "pending" ? null : officer.user_id,
            confirmed_at: paper.staff === "pending" ? null : new Date(),
          })),
        });
        const created = await prisma.examResult.findMany({
          where: { round_id: roundId },
          select: { result_id: true, student_id: true },
        });
        const resultIdOf = new Map(created.map((r) => [r.student_id, r.result_id]));
        await prisma.subjectResult.createMany({
          data: papers.flatMap((paper) =>
            paper.marks.map((m) => ({ result_id: resultIdOf.get(paper.student_id), ...m })),
          ),
        });
        return created.length;
      })();

    const round1People = people.filter((p) => !skippers.has(p.id));
    await writePapers(round1.round_id, buildPapers(allSubjectIds, 1, round1People, () => "approved"));

    const stillFailing = (p) => allSubjectIds.some((sid) => !(passedBy.get(p.id)?.has(sid)));

    // ── รอบ 2: เฉพาะวิชาที่ยังมีคนสอบไม่ผ่าน ──
    const round2People = people.filter((p) => !skippers.has(p.id) && stillFailing(p));
    let round2 = null;
    if (round2People.length > 0) {
      const need = allSubjectIds.filter((sid) => round2People.some((p) => !passedBy.get(p.id)?.has(sid)));
      round2 = await prisma.submissionRound.create({
        data: {
          created_by: officer.user_id,
          academic_year: year,
          attempt_number: 2,
          // รุ่นล่าสุดยังเปิดรับอยู่จริง ต้องคร่อมวันนี้ ไม่งั้น findActive มองไม่เห็น
          open_date: isLatest ? new Date(`${ce}-08-01T00:00:00+07:00`) : new Date(`${ce}-10-01T00:00:00+07:00`),
          close_date: isLatest ? new Date(`${ce}-09-30T23:59:59+07:00`) : new Date(`${ce}-10-31T23:59:59+07:00`),
          status: isLatest ? "open" : "closed",
          subject_ids: need,
        },
      });

      if (isLatest) {
        // ค้างกลางคัน — 25% ยังไม่กรอก ที่เหลือกระจาย รอตรวจ / ตีกลับ / ยืนยันแล้ว
        const submitters = round2People.filter(() => rand() > 0.25);
        const papers = buildPapers(need, 2, submitters, () => {
          const r = rand();
          if (r < 0.55) return "pending";
          if (r < 0.7) return "rejected";
          return "approved";
        });
        await writePapers(round2.round_id, papers, "เอกสารหลักฐานไม่ชัดเจน กรุณาอัปโหลดใหม่");

        // แจ้งเตือนของใบที่ถูกตีกลับ — หน้านักศึกษาจะได้มีของจริงให้ดู
        const rejected = papers.filter((p) => p.staff === "rejected");
        if (rejected.length > 0) {
          await prisma.notification.createMany({
            data: rejected.map((p) => ({
              student_id: p.student_id,
              type: "rejected",
              message: "ผลสอบของท่านถูกตีกลับ: เอกสารหลักฐานไม่ชัดเจน\nกรุณากรอกผลสอบของท่านใหม่อีกครั้ง",
            })),
          });
        }
      } else {
        const papers = buildPapers(need, 2, round2People, () => "approved");
        await writePapers(round2.round_id, papers);
      }
    }

    // ── รอบ 3: เปิดเฉพาะปีที่จบแล้วและยังเหลือคนสอบไม่ผ่านเกิน 8% ──
    let round3 = null;
    if (!isLatest) {
      const remaining = people.filter((p) => !skippers.has(p.id) && stillFailing(p));
      if (remaining.length > count * 0.08) {
        const need = allSubjectIds.filter((sid) => remaining.some((p) => !passedBy.get(p.id)?.has(sid)));
        round3 = await prisma.submissionRound.create({
          data: {
            created_by: officer.user_id,
            academic_year: year,
            attempt_number: 3,
            open_date: new Date(`${ce + 1}-02-01T00:00:00+07:00`),
            close_date: new Date(`${ce + 1}-02-28T23:59:59+07:00`),
            status: "closed",
            subject_ids: need,
          },
        });
        await writePapers(round3.round_id, buildPapers(need, 3, remaining, () => "approved"));
      }
    }

    // ── ประกาศผูกกับรอบแรกของปี ──
    await prisma.news.create({
      data: {
        posted_by: officer.user_id,
        round_id: round1.round_id,
        title: `เปิดรับผลสอบใบประกอบวิชาชีพ ปีการศึกษา ${year} ครั้งที่ 1`,
        content:
          `ขอให้นักศึกษารุ่นปีการศึกษา ${year} ที่เข้าสอบความรู้ขอขึ้นทะเบียนและรับใบอนุญาต\n` +
          `กรอกผลสอบรายวิชาพร้อมแนบใบผลสอบ (PDF) ภายในวันที่กำหนด\n` +
          `หากมีข้อสงสัยติดต่องานบริการการศึกษา คณะพยาบาลศาสตร์`,
      },
    });

    const fullyPassed = people.filter((p) => !stillFailing(p)).length;
    summary.push({
      year,
      students: count,
      rounds: [round1, round2, round3].filter(Boolean).length,
      submitted: count - skippers.size,
      fullyPassed,
      rate: ((fullyPassed / count) * 100).toFixed(1),
      open: isLatest && round2 ? `รอบ 2 (#${round2.round_id})` : "—",
    });
    console.log(`  รุ่น ${year}: ${count} คน · ${summary[summary.length - 1].rounds} รอบ · ผ่านครบ ${fullyPassed} (${summary[summary.length - 1].rate}%)`);
  }

  console.log("\n── สรุป ──");
  console.table(summary);
  console.log(`นักศึกษาทั้งหมด ${await prisma.student.count()} คน · รอบ ${await prisma.submissionRound.count()} · ผลสอบ ${await prisma.examResult.count()} ใบ · ผลรายวิชา ${await prisma.subjectResult.count()} แถว`);
  console.log(`\nรหัสผ่านนักศึกษาทุกคน: ${DEMO_PASSWORD}  (login ด้วยรหัสนักศึกษา เช่น ${idPrefixOf(latestYear)}10210001)`);
  await prisma.$disconnect();
};

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
