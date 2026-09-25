import * as dashService from "./dashboard.service.js";
import { buildReportPdf, buildFirstAttemptListPdf } from "./dashboard.pdf.js";
import { buildXlsx, sendXlsx } from "../../utils/xlsxExport.js";

// GET /api/dashboard/stats?round_id= — officer, executive
export const getStats = async (req, res, next) => {
  try {
    const stats = await dashService.buildStats(req.query.round_id);
    res.json({ success: true, data: stats });
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

// GET /api/dashboard/alerts — officer, executive
// แจ้งเตือนสถานะปัจจุบัน (รอบใกล้ปิด / ยังไม่ส่งผล / รอตรวจ / สรุปรอบที่เพิ่งปิด)
// role อ่านจาก JWT เท่านั้น — ผู้บริหารจะไม่ได้เรื่อง "รอตรวจ" เพราะไม่มีสิทธิ์ตรวจ
export const getAlerts = async (req, res, next) => {
  try {
    const data = await dashService.buildAlerts(req.user.role);
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

// GET /api/dashboard/export-first-attempt?year=2569&passed=true|false&format=xlsx|pdf — officer เท่านั้น
// รายชื่อนักศึกษา "ผ่านครั้งแรก" / "ไม่ผ่านครั้งแรก" ของปีการศึกษานั้น (ปุ่มดาวน์โหลดบนการ์ดเทียบรายปี)
export const exportFirstAttempt = async (req, res, next) => {
  try {
    const year = Number(req.query.year);
    const { passed, format = "xlsx" } = req.query;
    const bad = (message) => {
      const err = new Error(message);
      err.statusCode = 400;
      return err;
    };
    if (!Number.isInteger(year) || year < 2400 || year > 2700) throw bad("year ต้องเป็นปีการศึกษา พ.ศ. 4 หลัก");
    if (passed !== "true" && passed !== "false") throw bad("passed ต้องเป็น true หรือ false");
    if (format !== "xlsx" && format !== "pdf") throw bad("format ต้องเป็น xlsx หรือ pdf");

    const list = await dashService.buildFirstAttemptList(year, passed === "true");
    const label = list.wantPassed ? "ผ่านครั้งแรก" : "ไม่ผ่านครั้งแรก";
    const fileName = `รายชื่อนักศึกษา${label}-${year}.${format}`;

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="report.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      );
      buildFirstAttemptListPdf({ ...list, label, res });
      return;
    }

    const buffer = await buildXlsx({
      sheetName: `${label} ${year}`,
      columns: [
        { header: "ลำดับ", key: "no", width: 8, type: "number" },
        { header: "รหัสนักศึกษา", key: "student_id", width: 16 },
        { header: "ชื่อ", key: "first_name", width: 18 },
        { header: "นามสกุล", key: "last_name", width: 20 },
        { header: "ห้อง", key: "room_name", width: 14 },
        { header: "สถานะใบผลสอบรอบแรก", key: "paper_status", width: 22 },
        { header: "ผ่านกี่วิชา", key: "passed_text", width: 12 },
        { header: "วิชาที่ไม่ผ่าน", key: "failed_subjects", width: 28 },
      ],
      rows: list.rows.map((r, i) => ({ no: i + 1, ...r })),
    });
    sendXlsx(res, fileName, buffer);
  } catch (err) {
    next(err);
  }
};
