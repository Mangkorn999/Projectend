/**
 * seedCohort.js — สร้างนักศึกษาทั้งรุ่นเข้าระบบ (ไว้ทดสอบระบบกับข้อมูลจำนวนมาก)
 *
 * รัน: npm run seed:cohort -- <ปีการศึกษา> <จำนวนคน> <จำนวนคนห้องแรก>
 *   ตัวอย่าง: npm run seed:cohort -- 2570 100 70
 *   = รุ่น 2570 จำนวน 100 คน → ห้องเรียนปกติ 70 คน ห้องเรียนอังกฤษ 30 คน
 *
 * ไม่ใส่ค่าอะไรเลย = 2570 / 100 คน / ห้องแรก 70 คน
 *
 * ของที่ต้องมีอยู่แล้วใน DB: roles, faculties, rooms (อย่างน้อย 2 ห้อง)
 * ไม่แตะข้อมูลรุ่นอื่น และรันซ้ำได้ — ลบเฉพาะนักศึกษาของรุ่นที่ระบุที่สคริปต์นี้สร้างไว้ก่อน
 *
 * สคริปต์นี้สร้าง "นักศึกษา" อย่างเดียว ไม่สร้างรอบสอบและไม่สร้างผลสอบ
 * ถ้าอยากได้รอบสอบ ให้เปิดจากหน้า "จัดการรอบสอบ" ในระบบ จะได้ทดสอบ flow จริงตั้งแต่ต้น
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// คลังชื่อ-นามสกุล — วนประกอบกันให้ครบตามจำนวนที่ขอ
// ไม่สุ่ม เพื่อให้รันกี่ครั้งก็ได้รายชื่อชุดเดิม (เทียบผลลัพธ์ตอนทดสอบได้)
// ---------------------------------------------------------------------------
const FIRST_NAMES = [
  "ณัฐพงศ์", "พิมพ์ชนก", "ธนกฤต", "สุพรรษา", "อรรถพล", "กมลชนก", "วรเมธ", "ปิยะนุช",
  "ชนาธิป", "ศิริพร", "ภาณุพงษ์", "จิราพร", "อนุชา", "เบญจวรรณ", "รัตนาภรณ์", "กิตติศักดิ์",
  "สุธาสินี", "ธีรภัทร", "นภัสสร", "ชยพล", "ปณิดา", "อภิสิทธิ์", "ญาณิศา", "ทศพล",
  "วิภาวี", "ศุภกร", "อารียา", "พีรพัฒน์", "ชลธิชา", "กันตพงศ์",
];

const LAST_NAMES = [
  "ศรีสมบัติ", "แก้วมณี", "วงศ์อารีย์", "จันทร์เพ็ญ", "บุญมาก", "ทองสุข", "อินทร์ทอง",
  "สมบูรณ์ดี", "รัตนพล", "เกตุแก้ว", "ดวงจันทร์", "แซ่ลิ้ม", "พรหมมา", "ชูเชิด",
  "ขวัญเมือง", "นวลจันทร์", "ปานทอง", "เพชรรัตน์", "มณีโชติ", "สุขสวัสดิ์",
];

// ชื่อ-สกุลอังกฤษ (ทับศัพท์) — เรียงคู่ตำแหน่งเดียวกับ FIRST_NAMES/LAST_NAMES ข้างบน
const FIRST_NAMES_EN = [
  "Natthapong", "Pimchanok", "Thanakrit", "Supansa", "Attapon", "Kamonchanok", "Woramet", "Piyanuch",
  "Chanathip", "Siriporn", "Phanupong", "Jiraporn", "Anucha", "Benjawan", "Rattanaporn", "Kittisak",
  "Suthasinee", "Theeraphat", "Napassorn", "Chayapol", "Panida", "Apisit", "Yanisa", "Thossaphon",
  "Wiphawee", "Supakorn", "Areeya", "Peerapat", "Chonthicha", "Kantapong",
];

const LAST_NAMES_EN = [
  "Srisombat", "Kaewmanee", "Wongaree", "Janpen", "Boonmak", "Thongsuk", "Inthong",
  "Somboondee", "Rattanaphon", "Ketkaew", "Duangchan", "Saelim", "Phrommaa", "Chuchoed",
  "Khwanmueang", "Nualchan", "Panthong", "Phetcharat", "Maneechot", "Suksawat",
];

// รหัสนักศึกษา 2 ตัวหน้า = ปีที่เข้าเรียน = ปีการศึกษาที่จบ − 4 (หลักสูตร 4 ปี)
// เช่น รุ่นจบ 2570 เข้าเรียน 2566 → ขึ้นต้นด้วย 66
const idPrefixOf = (academicYear) => String(academicYear - 4).slice(-2);

const buildStudents = (academicYear, count, firstRoomCount) => {
  const prefix = idPrefixOf(academicYear);
  const students = [];

  for (let i = 0; i < count; i++) {
    // 6710210001, 6710210002, ... — รูปแบบเดียวกับรหัสจริง 10 หลัก (ปีเข้า 2 + คณะ/สาขา 4 + ลำดับ 4)
    const running = String(i + 1).padStart(4, "0");
    students.push({
      id: `${prefix}1021${running}`,
      first: FIRST_NAMES[i % FIRST_NAMES.length],
      firstEn: FIRST_NAMES_EN[i % FIRST_NAMES_EN.length],
      // เลื่อนนามสกุลคนละจังหวะกับชื่อ จะได้ไม่ได้ชื่อ-สกุลคู่เดิมซ้ำๆ
      last: LAST_NAMES[Math.floor(i / FIRST_NAMES.length + i) % LAST_NAMES.length],
      lastEn: LAST_NAMES_EN[Math.floor(i / FIRST_NAMES.length + i) % LAST_NAMES_EN.length],
      // คนแรกๆ อยู่ห้องแรก ที่เหลืออยู่ห้องที่สอง
      roomIndex: i < firstRoomCount ? 0 : 1,
    });
  }
  return students;
};

async function main() {
  // --- อ่านค่าจาก command line ---
  const academicYear = Number(process.argv[2]) || 2570;
  const count = Number(process.argv[3]) || 100;
  const firstRoomCount = Number(process.argv[4] ?? 70);

  if (firstRoomCount > count) {
    throw new Error(`จำนวนคนห้องแรก (${firstRoomCount}) มากกว่าจำนวนทั้งรุ่น (${count}) ไม่ได้`);
  }

  const [studentRole, faculty, rooms] = await Promise.all([
    prisma.role.findFirst({ where: { role_name: "student" } }),
    prisma.faculty.findFirst(),
    prisma.room.findMany({ orderBy: { room_id: "asc" } }),
  ]);

  if (!studentRole) throw new Error("ไม่พบ role student — รัน prisma migrate reset ก่อน");
  if (!faculty) throw new Error("ไม่พบข้อมูลคณะ — รัน prisma migrate reset ก่อน");
  if (rooms.length < 2) throw new Error(`ต้องมีห้องเรียนอย่างน้อย 2 ห้อง (ตอนนี้มี ${rooms.length})`);

  const students = buildStudents(academicYear, count, firstRoomCount);
  const ids = students.map((s) => s.id);

  // --- ล้างของเดิมที่สคริปต์นี้เคยสร้างไว้ (รันซ้ำได้ ไม่ชนกัน) ---
  // ลบตารางลูกก่อนตารางแม่เสมอ ไม่งั้น foreign key ขวาง
  await prisma.notification.deleteMany({ where: { student_id: { in: ids } } });
  await prisma.certificate.deleteMany({ where: { exam_result: { student_id: { in: ids } } } });
  await prisma.subjectResult.deleteMany({ where: { exam_result: { student_id: { in: ids } } } });
  await prisma.reviewLog.deleteMany({ where: { exam_result: { student_id: { in: ids } } } });
  await prisma.examResult.deleteMany({ where: { student_id: { in: ids } } });
  await prisma.student.deleteMany({ where: { student_id: { in: ids } } });
  await prisma.user.deleteMany({ where: { psu_passport_id: { in: ids } } });

  // --- สร้างใหม่ ---
  // hash รหัสผ่านครั้งเดียวแล้วใช้ซ้ำไม่ได้ เพราะรหัสของแต่ละคนคือรหัสนักศึกษาตัวเอง
  // แต่ลด cost ของ bcrypt ลงเหลือ 8 เพราะเป็นข้อมูลทดสอบ 100 บัญชี (ค่าจริงในระบบใช้ 10)
  for (const s of students) {
    const user = await prisma.user.create({
      data: {
        role_id: studentRole.role_id,
        psu_passport_id: s.id,
        password_hash: bcrypt.hashSync(s.id, 8),
        must_change_password: false, // ข้อมูลทดสอบ — login ได้เลยไม่ต้องตั้งรหัสก่อน
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
        room_id: rooms[s.roomIndex].room_id,
        academic_year: academicYear,
        first_name_en: s.firstEn,
        last_name_en: s.lastEn,
        exam_eligible: true,
      },
    });
  }

  // --- สรุปให้ดูว่าได้อะไรบ้าง ---
  const perRoom = await prisma.student.groupBy({
    by: ["room_id"],
    where: { academic_year: academicYear },
    _count: { student_id: true },
  });
  const roomName = new Map(rooms.map((r) => [r.room_id, r.room_name]));

  console.log(`\n=== นักศึกษารุ่น ${academicYear} ===`);
  console.log(`สร้างแล้ว ${students.length} คน (รหัส ${students[0].id} – ${students[students.length - 1].id})`);
  for (const row of perRoom.sort((a, b) => a.room_id - b.room_id)) {
    console.log(`  ${roomName.get(row.room_id)} : ${row._count.student_id} คน`);
  }
  console.log(`\nรหัสผ่านของทุกคน = รหัสนักศึกษาตัวเอง`);
  console.log(`ยังไม่มีรอบสอบของรุ่นนี้ — เปิดรอบได้ที่เมนู "จัดการรอบสอบ"\n`);
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
