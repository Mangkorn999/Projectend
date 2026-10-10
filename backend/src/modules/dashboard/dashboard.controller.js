import * as dashService from "./dashboard.service.js";
import { buildAlerts } from "./dashboard.alerts.js";
import { buildReportPdf, buildPassListPdf } from "./dashboard.pdf.js";
import { buildXlsx, sendXlsx } from "../../utils/xlsxExport.js";

// GET /api/dashboard/stats?round_id= — officer, executive
export const getStats = async (req, res, next) => {
  try {
    const stats = await dashService.buildStats(req.query.round_id);

    // alreadyPassedStudentIds = รหัสนักศึกษารายคนที่ผ่านครบแล้ว — ใช้เฉพาะหน้าคิวตรวจของเจ้าหน้าที่
    // ผู้บริหารต้องเห็นแค่ภาพรวม ไม่เห็นรายบุคคล จึงตัด field นี้ออก (ยังเหลือตัวเลข alreadyPassed ให้ดูจำนวนได้)
    // ทำสำเนาก่อนค่อยลบ เพราะ stats เป็น object ที่ service สร้างมา ไม่ควรแก้ของเดิมตรงๆ
    // role อ่านจาก JWT เท่านั้น
    let data = stats;
    if (req.user.role === "executive") {
      data = { ...stats };
      delete data.alreadyPassedStudentIds;
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/dashboard/history?years=3 — officer, executive
// สรุปรายปีย้อนหลังไว้เทียบรุ่นต่อรุ่น
export const getHistory = async (req, res, next) => {
  try {
    const years = Number(req.query.years) || 3;
    const data = await dashService.buildHistory(Math.min(Math.max(years, 1), 10));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/dashboard/alerts — officer, executive  (logic อยู่ที่ dashboard.alerts.js)
// แจ้งเตือนสถานะปัจจุบัน (รอบใกล้ปิด / ยังไม่ส่งผล / รอตรวจ)
// role อ่านจาก JWT เท่านั้น — ผู้บริหารจะไม่ได้เรื่อง "รอตรวจ" เพราะไม่มีสิทธิ์ตรวจ
export const getAlerts = async (req, res, next) => {
  try {
    const data = await buildAlerts(req.user.role);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/dashboard/export?round_id= — officer (ตอบกลับเป็นไฟล์ PDF)
export const exportReport = async (req, res, next) => {
  try {
    const stats = await dashService.buildStats(req.query.round_id);
    // ตัวเลขที่คณะส่งสภาการพยาบาลเป็นตัวเลขระดับ "ปีการศึกษา" ไม่ใช่ระดับรอบ
    // เลยต้องดึงสรุปรายปีของรอบนั้นมาด้วย ไม่งั้นรายงานขาดตัวเลขหลักที่เอาไปใช้จริง
    const [rows, yearStats] = await Promise.all([
      dashService.buildStudentRows(stats.round.round_id),
      dashService.buildYearStats(stats.round.academic_year),
    ]);

    const fileName = `exam-report-${stats.round.attempt_number}-${stats.round.academic_year}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    buildReportPdf(stats, rows, res, yearStats);
  } catch (err) {
    next(err);
  }
};

// ─── ส่งออกรายชื่อผ่าน/ไม่ผ่าน (ใช้ร่วมกัน 2 endpoint ข้างล่าง) ─────────────

const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

// ตรวจ query ของไฟล์ส่งออกรายชื่อ: ?year=2569&passed=true|false&format=xlsx|pdf
// คืน { year, wantPassed, format } — ค่าไม่ถูกต้อง → 400 ข้อความไทยที่ไม่มีชื่อ field
const readListExportQuery = (query) => {
  const year = Number(query.year);
  if (!Number.isInteger(year) || year < 2400 || year > 2700) {
    throw badRequest("ปีการศึกษาไม่ถูกต้อง กรุณาเลือกปีการศึกษา (พ.ศ.) แล้วลองใหม่อีกครั้ง");
  }

  const passed = query.passed;
  if (passed !== "true" && passed !== "false") {
    throw badRequest("กรุณาเลือกว่าต้องการรายชื่อผู้ที่สอบผ่านหรือไม่ผ่าน");
  }

  // ไม่ส่ง format มา = Excel
  let format = query.format;
  if (format === undefined) {
    format = "xlsx";
  }
  // json = ขอดูตัวอย่างตาราง (ไม่ใช่ไฟล์) — หน้ารายงานใช้แสดงแบบ Excel ก่อนกดดาวน์โหลด
  if (format !== "xlsx" && format !== "pdf" && format !== "json") {
    throw badRequest("รูปแบบไฟล์ไม่ถูกต้อง กรุณาเลือก Excel หรือ PDF");
  }

  return { year, wantPassed: passed === "true", format };
};

// หัวคอลัมน์ Excel ของไฟล์รายชื่อผ่าน/ไม่ผ่าน — ข้อมูลประจำตัวเหมือนกันทั้ง 2 แบบ
// ต่างกันแค่ชื่อคอลัมน์สถานะใบ กับชื่อคอลัมน์วิชาที่ไม่ผ่าน (ผู้เรียกส่งมา)
const listColumns = (statusHeader, failedHeader) => [
  { header: "ลำดับ", key: "no", width: 8, type: "number" },
  { header: "รหัสนักศึกษา", key: "student_id", width: 16 },
  { header: "ชื่อ", key: "first_name", width: 18 },
  { header: "นามสกุล", key: "last_name", width: 20 },
  { header: "ชื่อ (อังกฤษ)", key: "first_name_en", width: 18 },
  { header: "นามสกุล (อังกฤษ)", key: "last_name_en", width: 20 },
  { header: "ห้อง", key: "room_name", width: 14 },
  { header: "เบอร์โทร", key: "phone", width: 14 },
  { header: "อีเมล", key: "email", width: 26 },
  { header: statusHeader, key: "paper_status", width: 22 },
  { header: "ผ่านกี่วิชา", key: "passed_text", width: 12 },
  { header: failedHeader, key: "failed_subjects", width: 28 },
];

// ใส่เลขลำดับ 1, 2, 3, ... ให้ทุกแถว (คอลัมน์ "ลำดับ")
const withRowNumbers = (rows) => {
  const numbered = [];
  for (let i = 0; i < rows.length; i++) {
    const row = { ...rows[i] }; // ก๊อปแถวเดิม ไม่แก้ของเดิม
    row.no = i + 1;
    numbered.push(row);
  }
  return numbered;
};

// ตอบตัวอย่างตาราง (format=json) — รูปแบบเดียวกับ POST /students/export {preview:true}
// ใช้ columns/rows ชุดเดียวกับที่ใส่ลง Excel จึงเห็นตรงกับไฟล์จริง · ตัดที่ PREVIEW_MAX_ROWS แถว บอก total จริงไว้
const PREVIEW_MAX_ROWS = 1000;
const sendSheetPreview = (res, sheetName, columns, rows) => {
  res.json({
    success: true,
    data: {
      sheets: [
        {
          sheet_name: sheetName,
          columns: columns.map((c) => ({ header: c.header, key: c.key })),
          total: rows.length,
          rows: rows.slice(0, PREVIEW_MAX_ROWS),
        },
      ],
    },
  });
};

// ส่ง PDF กลับ — ชื่อไฟล์ภาษาไทยต้องมี filename ASCII สำรอง + filename*=UTF-8'' คู่กัน
const setPdfHeaders = (res, fileName) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="report.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  );
};

// GET /api/dashboard/export-first-attempt?year=2569&passed=true|false&format=xlsx|pdf — officer เท่านั้น
// รายชื่อนักศึกษา "ผ่านครั้งแรก" / "ไม่ผ่านครั้งแรก" ของปีการศึกษานั้น (ปุ่มดาวน์โหลดบนการ์ดเทียบรายปี)
export const exportFirstAttempt = async (req, res, next) => {
  try {
    const { year, wantPassed, format } = readListExportQuery(req.query);

    const list = await dashService.buildFirstAttemptList(year, wantPassed);
    let label = "ไม่ผ่านครั้งแรก";
    if (list.wantPassed) {
      label = "ผ่านครั้งแรก";
    }
    const fileName = `รายชื่อนักศึกษา${label}-${year}.${format}`;

    if (format === "pdf") {
      setPdfHeaders(res, fileName);
      let note = null;
      if (!list.wantPassed) {
        note = "รวมนักศึกษาที่ยังไม่ส่งผลสอบ ค้างร่าง รอตรวจสอบ หรือถูกตีกลับ — ดูสาเหตุที่คอลัมน์ \"สถานะใบ\"";
      }
      buildPassListPdf({
        label,
        subtitle: `ปีการศึกษา ${year} — รอบสอบครั้งที่ ${list.round.attempt_number}`,
        note,
        total: list.total,
        rows: list.rows,
        res,
      });
      return;
    }

    const columns = listColumns("สถานะใบผลสอบรอบแรก", "วิชาที่ไม่ผ่าน");
    const rows = withRowNumbers(list.rows);
    if (format === "json") {
      sendSheetPreview(res, `${label} ${year}`, columns, rows);
      return;
    }
    const buffer = await buildXlsx({ sheetName: `${label} ${year}`, columns, rows });
    sendXlsx(res, fileName, buffer);
  } catch (err) {
    next(err);
  }
};

// GET /api/dashboard/export-first-year?year=2569&passed=true|false&format=xlsx|pdf — officer เท่านั้น
// รายชื่อนักศึกษา "ผ่านภายในปีแรก" / "ไม่ผ่านภายในปีแรก" (รวมผลทุกรอบของปีการศึกษานั้น)
// กฎเดียวกับตัวเลข firstYear.passed บนแดชบอร์ด — ผ่าน + ไม่ผ่าน = ทั้งรุ่น
export const exportFirstYear = async (req, res, next) => {
  try {
    const { year, wantPassed, format } = readListExportQuery(req.query);

    const list = await dashService.buildFirstYearList(year, wantPassed);
    let label = "ไม่ผ่านภายในปีแรก";
    if (list.wantPassed) {
      label = "ผ่านภายในปีแรก";
    }
    const fileName = `รายชื่อนักศึกษา${label}-${year}.${format}`;

    if (format === "pdf") {
      setPdfHeaders(res, fileName);
      let note = "นับผลทุกรอบของปีการศึกษา เฉพาะใบผลสอบที่เจ้าหน้าที่ยืนยันแล้ว";
      if (!list.wantPassed) {
        note = note + " · รวมนักศึกษาที่ยังไม่ส่งผลสอบ รอตรวจสอบ หรือถูกตีกลับ — ดูสาเหตุที่คอลัมน์ \"สถานะใบ\" (ใบล่าสุด)";
      }
      buildPassListPdf({
        label,
        subtitle: `ปีการศึกษา ${year} — รวมทุกรอบสอบของปีการศึกษา`,
        note,
        total: list.total,
        rows: list.rows,
        res,
      });
      return;
    }

    const columns = listColumns("สถานะใบล่าสุด", "วิชาที่ยังไม่ผ่าน");
    const rows = withRowNumbers(list.rows);
    if (format === "json") {
      sendSheetPreview(res, `${label} ${year}`, columns, rows);
      return;
    }
    const buffer = await buildXlsx({ sheetName: `${label} ${year}`, columns, rows });
    sendXlsx(res, fileName, buffer);
  } catch (err) {
    next(err);
  }
};
