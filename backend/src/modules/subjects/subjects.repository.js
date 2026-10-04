import prisma from "../../config/db.js";
//หา วิชา ใน datbase
// เรียงตามรหัสวิชาเสมอ — ไม่ใส่ ลำดับวิชาจะเปลี่ยนทุกครั้งที่แก้ชื่อวิชา (Postgres ย้ายแถวที่ถูก UPDATE ไปท้ายตาราง)
// แล้วหน้ากรอกผลสอบของนักศึกษาก็เรียงวิชาสลับตามไปด้วย · ตรงกับที่ dashboard เรียงอยู่แล้ว
export const findAll = () => prisma.subject.findMany({ orderBy: { subject_code: "asc" } });
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
// รอบที่เลือกวิชานี้ไว้ — subject_ids ของรอบเป็น Int[] ไม่ใช่ FK จึงต้องถามตรงๆ
export const findRoundsUsing = (id) =>
  prisma.submissionRound.findMany({
    where: { subject_ids: { has: Number(id) } },
    select: { round_id: true, academic_year: true, attempt_number: true },
  });
// จำนวนผลสอบรายวิชา (subject_results) ที่อ้างวิชานี้อยู่ — ใช้กันลบวิชาที่มีนักศึกษากรอกผลไปแล้ว
export const countSubjectResults = (id) =>
  prisma.subjectResult.count({ where: { subject_id: Number(id) } });
// อัพเดท วิชา
export const updata = (id, data) =>
  prisma.subject.update({ where: { subject_id: Number(id) }, data });
