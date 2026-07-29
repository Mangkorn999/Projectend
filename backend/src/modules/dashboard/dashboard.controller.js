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

// GET /api/dashboard/export?round_id= — officer (ตอบกลับเป็นไฟล์ PDF)
export const exportReport = async (req, res, next) => {
  try {
    const stats = await dashService.buildStats(req.query.round_id);
    const rows = await dashService.buildStudentRows(stats.round.round_id);

    const fileName = `exam-report-${stats.round.attempt_number}-${stats.round.academic_year}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    buildReportPdf(stats, rows, res);
  } catch (err) {
    next(err);
  }
};
