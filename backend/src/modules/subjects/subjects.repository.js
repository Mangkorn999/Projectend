import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
//หา วิชา ใน datbase
export const findAll = () => prisma.subject.findMany();
//สร้าง บันทึกวิชาใหม่ data subject
export const create = (data) => prisma.subject.create({ data });
//ลบ วิชากรอก data
export const remove = (id) =>
  prisma.subject.delete({ where: { subject_id: Number(id) } });
// อัพเดท วิชา
export const updata = (id, data) =>
  prisma.subject.update({ where: { subject_id: Number(id) }, data });
