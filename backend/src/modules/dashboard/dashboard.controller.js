import * as dashService from "./dashboard.service.js";
import { buildReportPdf } from "./dashboard.pdf.js";

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
