import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
//หา วิชา ใน datbase
export const findAll = () => prisma.subject.findMany();
// หาวิชาหลายตัวพร้อมกันจาก id ที่ส่งมา — ใช้เช็คว่า id ที่ officer เลือกมีจริงทุกตัว
export const findByIds = (ids) =>
  prisma.subject.findMany({ where: { subject_id: { in: ids } } });
// หาวิชาจากรหัสวิชา (เช่น "1106") — ใช้ทำหัวรายงาน export รายชื่อผ่าน/ไม่ผ่านรายวิชา
export const findByCode = (subject_code) =>
  prisma.subject.findFirst({ where: { subject_code } });
//สร้าง บันทึกวิชาใหม่ data subject
export const create = (data) => prisma.subject.create({ data });
//ลบ วิชากรอก data
export const remove = (id) =>
  prisma.subject.delete({ where: { subject_id: Number(id) } });
// อัพเดท วิชา
export const updata = (id, data) =>
  prisma.subject.update({ where: { subject_id: Number(id) }, data });
