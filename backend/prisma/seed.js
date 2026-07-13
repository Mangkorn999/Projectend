const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  //ลบข้อมูลเก่า หากเพิ่มเติม
  await prisma.session.deleteMany({});
  await prisma.news.deleteMany({});
  await prisma.certificate.deleteMany({});
  await prisma.subjectResult.deleteMany({});
  await prisma.examResult.deleteMany({});
  await prisma.submissionRound.deleteMany({});
  await prisma.subject.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.room.deleteMany({});
  await prisma.faculty.deleteMany({});
  await prisma.role.deleteMany({});

  //   const roles = ["student", "staff", "executive"];
  //   for (const role_name of roles) {
  //     await prisma.role.create({
  //       data: {
  //         role_name,
  //         description: `บทบาท ${role_name}`,
  //       },
  //     });
  //     console.log(`Created role: ${role_name}`);
  //   }

  //   //  Room

  //   const Room = ["ห้องเรียนปกติ", "ห้องเรียนอังกฤษ"];
  //   for (const room_name of Room) {
  //     const existing = await prisma.room.findFirst({ where: { room_name } });
  //     if (!existing) {
  //       await prisma.room.create({ data: { room_name } });
  //       console.log(`Created room: ${room_name}`);
  //     }
  //   }

  //   //  Faculty
  //   const Faculty = ["คณะพยาบาล"];
  //   for (const faculty_name of Faculty) {
  //     const existing = await prisma.faculty.findFirst({
  //       where: { faculty_name },
  //     });
  //     if (!existing) {
  //       await prisma.faculty.create({ data: { faculty_name } });
  //       console.log(`Created faculty: ${faculty_name}`);
  //     }
  //   }
  // 1. Seed Roles
  const roleData = [
    { role_name: "student", description: "นักศึกษา" },
    { role_name: "officer", description: "เจ้าหน้าที่คณะ" },
    { role_name: "executive", description: "ผู้บริหารคณะ" },
  ];
  for (const role of roleData) {
    await prisma.role.create({ data: role });
  }
  console.log("Roles created.");

  // 2. สร้าง Faculty & Room
  const faculty = await prisma.faculty.create({
    data: { faculty_name: "คณะพยาบาลศาสตร์" },
  });

  // แก้ไขการสร้าง Room ให้ถูกต้อง
  await prisma.room.createMany({
    data: [{ room_name: "ห้องเรียนปกติ" }, { room_name: "ห้องเรียนอังกฤษ" }],
  });
  const room = await prisma.room.findFirst({
    where: { room_name: "ห้องเรียนปกติ" },
  });
  console.log("Faculty and Rooms created.");

  // 3. ดึง Role มาใช้ (ใช้ findFirst เพื่อความชัวร์หากยังไม่ได้ทำ @unique ใน schema)
  const studentRole = await prisma.role.findFirst({
    where: { role_name: "student" },
  });
  const staffRole = await prisma.role.findFirst({
    where: { role_name: "officer" },
  }); // เปลี่ยน staff เป็น officer

  if (!studentRole || !staffRole) throw new Error("Roles not found!");

  // 4. สร้าง Users
  const studentUser = await prisma.user.create({
    data: {
      role_id: studentRole.role_id,
      psu_passport_id: "6610210631",
      first_name: "Thanyatep",
      last_name: "Jiwtan",
      email: "student@psu.ac.th",
      phone: "0812345678",
    },
  });

  const staffUser = await prisma.user.create({
    data: {
      role_id: staffRole.role_id,
      psu_passport_id: "456",
      first_name: "Thep",
      last_name: "Ji",
      email: "staff@psu.ac.th",
      phone: "0899999999",
    },
  });
  console.log("Users created.");

  // 5. สร้าง Student Profile
  await prisma.student.create({
    data: {
      student_id: "6610210631",
      user_id: studentUser.user_id,
      faculty_id: faculty.faculty_id,
      room_id: room.room_id,
      academic_year: 2568,
      nursing_council_email: "student@nurse.or.th",
      nursing_council_password: "password123",
    },
  });
  console.log("Student profile created.");

  console.log("Seeding successfully!");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
