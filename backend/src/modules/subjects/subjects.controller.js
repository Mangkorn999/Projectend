// เรียก repository.js
import * as subjectrepo from "./subjects.repository.js";

const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// ขนาดตรงกับ schema (subject_code VarChar(10), subject_name VarChar(200))
const CODE_MAX = 10;
const NAME_MAX = 200;

// ตรวจ + ตัดช่องว่าง + เลือกเฉพาะ field ที่รับ — ไม่ส่ง req.body ทั้งก้อนลง Prisma
// (เดิมส่งตรง: ขาด field / ผิดชนิด / ยาวเกิน = 500 พร้อมข้อความดิบของ Prisma, และแอบส่ง field แปลกๆ มาแก้ได้)
// requireAll = true ตอนสร้าง (ต้องมีทั้งสอง) · false ตอนแก้ (ส่งมาเฉพาะที่จะแก้ก็ได้)
const cleanSubjectInput = (body, requireAll) => {
  const data = {};
  for (const [field, label, max] of [
    ["subject_code", "รหัสวิชา", CODE_MAX],
    ["subject_name", "ชื่อวิชา", NAME_MAX],
  ]) {
    const value = body?.[field];
    if (value === undefined && !requireAll) continue;
    if (typeof value !== "string" || !value.trim()) {
      throw httpError(`กรุณากรอก${label}`, 400);
    }
    if (value.trim().length > max) {
      throw httpError(`${label}ยาวเกินไป (ไม่เกิน ${max} ตัวอักษร)`, 400);
    }
    data[field] = value.trim();
  }
  if (Object.keys(data).length === 0) throw httpError("ไม่มีข้อมูลที่จะแก้ไข", 400);
  return data;
};

// รหัสวิชาห้ามซ้ำ — schema ไม่ได้ตั้ง unique ไว้ จึงกันที่นี่ (exceptId = ข้ามตัวเองตอนแก้)
const ensureCodeFree = async (subject_code, exceptId = null) => {
  const found = await subjectrepo.findByCode(subject_code);
  if (found && found.subject_id !== exceptId) {
    throw httpError(`รหัสวิชา ${subject_code} มีอยู่ในระบบแล้ว`, 409);
  }
};

export const getAll = async (req, res, next) => {
  try {
    const subject = await subjectrepo.findAll();
    res.json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
};

export const createAll = async (req, res, next) => {
  try {
    const data = cleanSubjectInput(req.body, true);
    await ensureCodeFree(data.subject_code);
    const subject = await subjectrepo.create(data);
    res.json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
};

export const updatasubject = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw httpError("ไม่พบรายวิชาที่ระบุ กรุณารีเฟรชหน้าแล้วลองใหม่อีกครั้ง", 400);
    const data = cleanSubjectInput(req.body, false);
    if (data.subject_code) await ensureCodeFree(data.subject_code, id);
    const subject = await subjectrepo.updata(id, data);
    res.json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
};

export const deleteSubject = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw httpError("ไม่พบรายวิชาที่ระบุ กรุณารีเฟรชหน้าแล้วลองใหม่อีกครั้ง", 400);

    // รอบที่เลือกวิชานี้ไว้ (subject_ids เป็น array ธรรมดา ไม่มี FK คุม) — ลบแล้วรอบนั้นจะเหลือวิชาไม่ครบ/ไม่เหลือเลย
    const rounds = await subjectrepo.findRoundsUsing(id);
    if (rounds.length > 0) {
      // วิชาที่ใช้มานานอยู่ในหลายสิบรอบ — โชว์แค่ 3 รอบแรก ที่เหลือบอกจำนวน ไม่งั้น toast ยาวล้นจอ
      const SHOW = 3;
      const names = rounds.slice(0, SHOW).map((r) => `${r.attempt_number}/${r.academic_year}`).join(", ");
      const more = rounds.length > SHOW ? ` และอีก ${rounds.length - SHOW} รอบ` : "";
      throw httpError(`ลบวิชานี้ไม่ได้ เพราะมีรอบสอบใช้อยู่ (รอบ ${names}${more})`, 409);
    }

    // มีผลสอบของนักศึกษาอ้างวิชานี้อยู่ → ห้ามลบ (ประวัติผลสอบจะชี้ไปหาวิชาที่ไม่มีแล้ว)
    // ต้องนับเองก่อนลบ: foreign key ของ subject_results ตั้งเป็น RESTRICT ซึ่ง Postgres ฟ้องเป็นรหัส 23001
    // ที่ Prisma ไม่แปลงเป็น P2003 ให้ — เดิมจึงหลุดเป็น 500 แทนที่จะได้ข้อความนี้
    const resultCount = await subjectrepo.countSubjectResults(id);
    if (resultCount > 0) {
      throw httpError("ลบวิชานี้ไม่ได้ เพราะมีผลสอบของนักศึกษาใช้วิชานี้อยู่แล้ว", 409);
    }

    try {
      await subjectrepo.remove(id);
    } catch (err) {
      // กันอีกชั้นเผื่อมีคนส่งผลวิชานี้เข้ามาพอดีระหว่างนับกับลบ (P2003 / 23001 RESTRICT)
      // — บอกเหตุผลตรงๆ ดีกว่าข้อความทั่วไป
      const message = typeof err.message === "string" ? err.message : "";
      if (err.code === "P2003" || message.includes("23001") || message.includes("violates RESTRICT")) {
        throw httpError("ลบวิชานี้ไม่ได้ เพราะมีผลสอบของนักศึกษาใช้วิชานี้อยู่แล้ว", 409);
      }
      throw err;
    }
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};
