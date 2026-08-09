import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const MAP = [
  { old: "NUR01", code: "1101", name: "การผดุงครรภ์" },
  { old: "NUR02", code: "1102", name: "การพยาบาลมารดาและทารก" },
  { old: "NUR03", code: "1103", name: "การพยาบาลเด็กและวัยรุ่น" },
  { old: "NUR04", code: "1104", name: "การพยาบาลผู้ใหญ่" },
  { old: "NUR05", code: "1105", name: "การพยาบาลผู้สูงอายุ" },
  { old: "NUR06", code: "1106", name: "การพยาบาลสุขภาพจิตและจิตเวชศาสตร์" },
  { old: "NUR07", code: "1107", name: "การพยาบาลอนามัยชุมชนและการรักษาพยาบาลขั้นต้น" },
  { old: "NUR08", code: "1108", name: "กฎหมายว่าด้วยวิชาชีพการพยาบาลและการผดุงครรภ์ จรรยาบรรณวิชาชีพและกฎหมายอื่นที่เกี่ยวข้องฯ" },
];

async function main() {
  for (const m of MAP) {
    const existing = await prisma.subject.findFirst({ where: { subject_code: m.old } });
    if (!existing) {
      console.log(`skip ${m.old} — not found`);
      continue;
    }
    await prisma.subject.update({
      where: { subject_id: existing.subject_id },
      data: { subject_code: m.code, subject_name: m.name },
    });
    console.log(`updated ${m.old} -> ${m.code} ${m.name}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
