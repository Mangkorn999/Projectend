// ส่งออก/รายชื่อผลสอบรายวิชา ของนักศึกษา — แยกออกจาก student.controller.js (6 ต.ค. 2569) ให้ไฟล์เดิมสั้นลง
// พฤติกรรมของ endpoint ไม่เปลี่ยน: ย้ายมาทั้งก้อน ไม่แก้ตรรกะ
//   GET  /api/students/subject-result-list  → getSubjectResultList (JSON)
//   GET  /api/students/export-subject       → exportSubjectList    (PDF หรือ Excel)
//   POST /api/students/export               → exportStudents       (Excel ข้อมูลนักศึกษา)
import * as studentRepo from "./student.repository.js";
import * as subjectsRepo from "../subjects/subjects.repository.js";
import * as roundsRepo from "../rounds/rounds.repository.js";
import * as dashService from "../dashboard/dashboard.service.js";
import { buildSubjectListPdf } from "./students.pdf.js";
import { buildXlsx, buildXlsxWorkbook, sendXlsx } from "../../utils/xlsxExport.js";

const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// ตรวจ query ร่วมกันของ 2 endpoint ข้างล่าง (JSON list + export PDF) — โค้ดเดียวกัน กันสองจุดเพี้ยนไม่ตรงกัน
const resolveSubjectQuery = async (query) => {
  const { subject_code, passed, round_id, year } = query;
  if (!subject_code || (passed !== "true" && passed !== "false")) {
    const err = new Error("กรุณาเลือกรายวิชา และเลือกว่าต้องการรายชื่อผู้ที่สอบผ่านหรือไม่ผ่าน");
    err.statusCode = 400;
    throw err;
  }
  if (!round_id && !year) {
    const err = new Error("กรุณาเลือกรอบสอบหรือปีการศึกษาอย่างใดอย่างหนึ่ง");
    err.statusCode = 400;
    throw err;
  }

  const subject = await subjectsRepo.findByCode(subject_code);
  if (!subject) {
    const err = new Error(`ไม่พบวิชารหัส ${subject_code}`);
    err.statusCode = 404;
    throw err;
  }

  let scopeLabel;
  let roundId = null;
  if (round_id) {
    const round = await roundsRepo.findById(Number(round_id));
    if (!round) {
      const err = new Error("ไม่พบรอบที่ระบุ");
      err.statusCode = 404;
      throw err;
    }
    roundId = round.round_id;
    scopeLabel = `รอบ ${round.attempt_number}/${round.academic_year}`;
  } else {
    scopeLabel = `รวมทั้งปีการศึกษา ${year}`;
  }

  const wantPassed = passed === "true";
  const rows = await studentRepo.findMatchingSubjectResult({
    subjectCode: subject_code,
    passed: wantPassed,
    roundId,
    year: round_id ? null : Number(year),
  });

  return { subject, wantPassed, scopeLabel, rows };
};

// รายชื่อนักศึกษาที่ผ่าน/ไม่ผ่านวิชาหนึ่งวิชา (JSON) — ใช้แสดงตัวอย่างในหน้ารายงานสรุปผลก่อนกดดาวน์โหลด PDF
export const getSubjectResultList = async (req, res, next) => {
  try {
    const { subject, wantPassed, scopeLabel, rows } = await resolveSubjectQuery(req.query);
    res.json({
      success: true,
      data: {
        subject,
        passed: wantPassed,
        scope_label: scopeLabel,
        students: rows.map((r) => ({
          student_id: r.student.student_id,
          first_name: r.student.user.first_name,
          last_name: r.student.user.last_name,
          room_name: r.student.room?.room_name ?? null,
          academic_year: r.student.academic_year,
          submitted_at: r.submitted_at,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

// export รายชื่อนักศึกษาที่ผ่าน/ไม่ผ่านวิชาหนึ่งวิชาเป็น PDF — กดจากปุ่ม "ดาวน์โหลด PDF" ที่หน้ารายงานสรุปผล
// ส่ง round_id = ดูรอบเดียว, ส่ง year (ไม่ส่ง round_id) = ดู "รวมทั้งปี" — เลือกอย่างใดอย่างหนึ่ง
export const exportSubjectList = async (req, res, next) => {
  try {
    const { subject, wantPassed, scopeLabel, rows } = await resolveSubjectQuery(req.query);
    const format = req.query.format ?? "pdf"; // ไม่ส่ง format = PDF เหมือนเดิม (ปุ่มเดิมของหน้าจอไม่พัง)
    if (format !== "pdf" && format !== "xlsx") throw httpError("รูปแบบไฟล์ไม่ถูกต้อง กรุณาเลือก Excel หรือ PDF", 400);

    const fileName = `รายชื่อ-${wantPassed ? "ผ่าน" : "ไม่ผ่าน"}-${subject.subject_code}.${format}`;

    if (format === "xlsx") {
      const buffer = await buildXlsx({
        sheetName: `${wantPassed ? "ผ่าน" : "ไม่ผ่าน"} ${subject.subject_code}`,
        columns: [
          { header: "ลำดับ", key: "no", width: 8, type: "number" },
          { header: "รหัสนักศึกษา", key: "student_id", width: 16 },
          { header: "ชื่อ", key: "first_name", width: 18 },
          { header: "นามสกุล", key: "last_name", width: 20 },
          { header: "ห้อง", key: "room_name", width: 14 },
          { header: "ปีการศึกษา", key: "academic_year", width: 12 },
          { header: "ส่งผลเมื่อ", key: "submitted_at", width: 14 },
        ],
        rows: rows.map((r, i) => ({
          no: i + 1,
          student_id: r.student.student_id,
          first_name: r.student.user.first_name,
          last_name: r.student.user.last_name,
          room_name: r.student.room?.room_name ?? "",
          academic_year: r.student.academic_year,
          submitted_at: new Date(r.submitted_at).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
        })),
      });
      sendXlsx(res, fileName, buffer);
      return;
    }

    // ชื่อไฟล์มีภาษาไทย — filename="..." เฉยๆ ใช้ไม่ได้กับ non-ASCII (บางเบราว์เซอร์เพี้ยน)
    // ต้องมี filename ASCII สำรอง + filename*=UTF-8''... (RFC 5987) คู่กันเสมอ
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="report.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );

    buildSubjectListPdf({ subject, passed: wantPassed, scopeLabel, rows, res });
  } catch (err) {
    next(err);
  }
};

// วันที่-เวลาแบบไทยสำหรับคอลัมน์ในไฟล์ export — ไม่มีค่า (เช่น ยังไม่ยืนยัน) ให้เป็นช่องว่าง
const formatThaiDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" })
    : "";

// สถานะของใบผลสอบ (ภาษาไทย) สำหรับคอลัมน์ในไฟล์ export
const paperStatusLabel = (r) => {
  if (r.student_status === "draft") return "ยังกรอกไม่เสร็จ";
  if (r.staff_status === "approved") return "ยืนยันแล้ว";
  if (r.staff_status === "rejected") return "ถูกตีกลับ";
  return "รอตรวจสอบ";
};

// POST /api/students/export — officer เท่านั้น
// body: { student_ids: [...] } = รายชื่อที่กรองอยู่บนหน้าจอ (ตัวกรองทำฝั่งหน้าจอ ส่งมาเป็นรายชื่อ ไม่ต้องเขียนตัวกรองซ้ำที่นี่)
//       หรือ { year: 2569 } = ทั้งรุ่นของปีนั้น (ใช้จากหน้ารายงานสรุป)
// ใช้ POST เพราะรายชื่อรหัสยาวเกินขนาด URL — ไฟล์ Excel ที่ได้ไม่มีเลขบัตรประชาชน
const EXPORT_MAX_IDS = 5000;
// จำนวนแถวสูงสุดต่อชีตที่ส่งกลับตอนขอดูตัวอย่าง
const PREVIEW_MAX_ROWS = 1000;
// POST /students/export — ส่งออกรายชื่อเป็น Excel (ไม่มีเลขบัตร) ตาม student_ids หรือ ปีการศึกษาที่ส่งมา
export const exportStudents = async (req, res, next) => {
  try {
    const { student_ids, year, by_round, preview } = req.body ?? {};
    let where;
    let scopeName;
    if (student_ids !== undefined) {
      if (
        !Array.isArray(student_ids) ||
        student_ids.length === 0 ||
        student_ids.length > EXPORT_MAX_IDS ||
        !student_ids.every((id) => typeof id === "string" && id.length > 0 && id.length <= 20)
      ) {
        throw httpError(`กรุณาเลือกนักศึกษาที่ต้องการส่งออก 1-${EXPORT_MAX_IDS} คน`, 400);
      }
      where = { ids: [...new Set(student_ids)] };
      scopeName = "ตามที่เลือก";
    } else if (Number.isInteger(year) && year >= 2400 && year <= 2700) {
      where = { year };
      scopeName = `รุ่น ${year}`;
    } else {
      throw httpError("กรุณาเลือกนักศึกษาที่ต้องการส่งออก หรือเลือกปีการศึกษา (พ.ศ.) อย่างใดอย่างหนึ่ง", 400);
    }

    const students = await studentRepo.findForExport(where);

    const rows = students.map((s) => {
      // ใบล่าสุด = ปีล่าสุด แล้วครั้งที่สอบมากสุด (ไม่ดูวันที่ส่ง — คนแก้ใบเก่าไม่ทำให้ใบเก่ากลายเป็น "ล่าสุด")
      const latest = [...s.exam_results].sort(
        (a, b) =>
          b.round.academic_year - a.round.academic_year ||
          b.round.attempt_number - a.round.attempt_number,
      )[0];
      return {
        student_id: s.student_id,
        first_name: s.user.first_name,
        last_name: s.user.last_name,
        first_name_en: s.first_name_en,
        last_name_en: s.last_name_en,
        room_name: s.room?.room_name ?? "",
        academic_year: s.academic_year,
        email: s.user.email,
        phone: s.user.phone,
        eligible: s.exam_eligible ? "เปิดสิทธิ์แล้ว" : "ยังไม่เปิดสิทธิ์",
        latest_round: latest ? `รอบที่ ${latest.round.attempt_number}/${latest.round.academic_year}` : "",
        paper_status: latest ? paperStatusLabel(latest) : "ยังไม่ได้กรอก",
        passed_text: latest
          ? `${latest.subject_results.filter((sr) => sr.is_passed).length}/${latest.subject_results.length}`
          : "",
      };
    });

    const studentSheet = {
      sheetName: "ข้อมูลนักศึกษา",
      columns: [
        { header: "รหัสนักศึกษา", key: "student_id", width: 16 },
        { header: "ชื่อ", key: "first_name", width: 18 },
        { header: "นามสกุล", key: "last_name", width: 20 },
        { header: "ชื่อ (อังกฤษ)", key: "first_name_en", width: 18 },
        { header: "นามสกุล (อังกฤษ)", key: "last_name_en", width: 20 },
        { header: "ห้อง", key: "room_name", width: 14 },
        { header: "ปีการศึกษาที่จบ", key: "academic_year", width: 16 },
        { header: "อีเมล", key: "email", width: 28 },
        { header: "เบอร์โทร", key: "phone", width: 14 },
        { header: "สิทธิ์กรอกผลสอบ", key: "eligible", width: 18 },
        { header: "รอบล่าสุดที่ส่ง", key: "latest_round", width: 16 },
        { header: "สถานะใบล่าสุด", key: "paper_status", width: 18 },
        { header: "ผ่านกี่วิชา (ใบล่าสุด)", key: "passed_text", width: 20 },
      ],
      rows,
    };

    // รวมชีตทั้งหมดไว้ก่อน — ใช้ทั้งตอนสร้างไฟล์ Excel และตอนขอดูตัวอย่าง (ข้อมูลชุดเดียวกัน ไม่คำนวณซ้ำสองที่)
    const sheets = [studentSheet];
    if (by_round === true) {
      // แยกตามรอบ: ชีตแรกเป็นข้อมูลนักศึกษาเหมือนเดิม แล้วต่อด้วย 1 ชีตต่อ 1 รอบสอบ
      // แต่ละชีตมี "คนของรอบนั้น" ครบตามจำนวนที่ Dashboard แสดง (ยังต้องกรอกในรอบนั้น + มีใบอยู่แล้ว)
      // คนที่ยังไม่ได้กรอกก็อยู่ในชีตด้วย สถานะ "ยังไม่ได้กรอก" — ไม่ใช่เฉพาะคนที่มีใบ
      // คนที่ผ่านครบตั้งแต่รอบก่อนไม่ต้องกรอกรอบนี้ จึงไม่อยู่ในชีต (เหมือนที่ Dashboard ไม่นับ)
      const years = [...new Set(students.map((s) => s.academic_year))];
      const roundsWithPeople = await dashService.findRoundsWithPeople(years);
      const roundSheets = [];
      for (const { round, peopleIds } of roundsWithPeople) {
        const rows = [];
        for (const s of students) {
          if (s.academic_year !== round.academic_year) continue;
          // มีใบในรอบนี้ไหม — เทียบด้วยปี + ครั้งที่สอบ (ผลที่ดึงมาไม่มี round_id)
          const r = s.exam_results.find(
            (x) => x.round.academic_year === round.academic_year && x.round.attempt_number === round.attempt_number,
          );
          if (!r && !peopleIds.has(s.student_id)) continue;
          rows.push({
            student_id: s.student_id,
            first_name: s.user.first_name,
            last_name: s.user.last_name,
            first_name_en: s.first_name_en,
            last_name_en: s.last_name_en,
            room_name: s.room?.room_name ?? "",
            paper_status: r ? paperStatusLabel(r) : "ยังไม่ได้กรอก",
            passed_text: r ? `${r.subject_results.filter((sr) => sr.is_passed).length}/${r.subject_results.length}` : "",
            submitted_at: r ? formatThaiDateTime(r.submitted_at) : "",
            confirmed_at: r ? formatThaiDateTime(r.confirmed_at) : "",
          });
        }
        if (rows.length > 0) {
          roundSheets.push({ year: round.academic_year, attempt: round.attempt_number, rows });
        }
      }
      const roundColumns = [
        { header: "รหัสนักศึกษา", key: "student_id", width: 16 },
        { header: "ชื่อ", key: "first_name", width: 18 },
        { header: "นามสกุล", key: "last_name", width: 20 },
        { header: "ชื่อ (อังกฤษ)", key: "first_name_en", width: 18 },
        { header: "นามสกุล (อังกฤษ)", key: "last_name_en", width: 20 },
        { header: "ห้อง", key: "room_name", width: 14 },
        { header: "สถานะใบผลสอบ", key: "paper_status", width: 18 },
        { header: "ผ่านกี่วิชา", key: "passed_text", width: 14 },
        { header: "ส่งเมื่อ", key: "submitted_at", width: 20 },
        { header: "ยืนยันเมื่อ", key: "confirmed_at", width: 20 },
      ];
      const sortedRounds = roundSheets.sort((a, b) => b.year - a.year || a.attempt - b.attempt);
      for (const r of sortedRounds) {
        sheets.push({ sheetName: `รอบ ${r.attempt}-${r.year}`, columns: roundColumns, rows: r.rows });
      }
    }

    // ขอดูตัวอย่าง (preview: true) — ส่งตารางเป็น JSON ให้หน้าจอวาดเหมือนเปิด Excel ไม่สร้างไฟล์
    // ตัดที่ PREVIEW_MAX_ROWS แถวต่อชีตกันตอบใหญ่เกิน บอก total จริงไว้ให้หน้าจอแสดง "แสดง N จาก M"
    if (preview === true) {
      res.json({
        success: true,
        data: {
          sheets: sheets.map((sheet) => ({
            sheet_name: sheet.sheetName,
            columns: sheet.columns.map((c) => ({ header: c.header, key: c.key })),
            total: sheet.rows.length,
            rows: sheet.rows.slice(0, PREVIEW_MAX_ROWS),
          })),
        },
      });
      return;
    }

    let buffer;
    if (by_round === true) {
      buffer = await buildXlsxWorkbook(sheets);
    } else {
      buffer = await buildXlsx(studentSheet);
    }
    sendXlsx(res, `ข้อมูลนักศึกษา-${scopeName}${by_round === true ? "-แยกรอบ" : ""}.xlsx`, buffer);
  } catch (err) {
    next(err);
  }
};
