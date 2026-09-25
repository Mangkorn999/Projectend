/* ============================================================
   PDF รายชื่อนักศึกษาที่ผ่าน/ไม่ผ่านวิชาใดวิชาหนึ่ง — export จากปุ่ม "ผ่าน/ไม่ผ่าน N คน"
   ที่การ์ดอัตราผ่านรายวิชาบน Dashboard (ดู dashboardReal.jsx + BarRow)
   ใช้ชิ้นส่วนร่วมจาก utils/pdfReport.js (ฟอนต์/ตาราง/เลขหน้า) เหมือน dashboard.pdf.js
   ============================================================ */
import PDFDocument from "pdfkit";
import {
  LEFT, CONTENT_WIDTH, registerThaiFonts, drawTable, section, drawPageNumbers,
} from "../../utils/pdfReport.js";

// สร้าง PDF รายชื่อนักศึกษาผ่าน/ไม่ผ่านวิชาหนึ่งวิชา แล้ว pipe ลง res
// subject = { subject_code, subject_name }, scopeLabel = "รอบ 2/2569" หรือ "รวมทั้งปี 2569"
export const buildSubjectListPdf = ({ subject, passed, scopeLabel, rows, res }) => {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  registerThaiFonts(doc);
  doc.pipe(res);

  const resultLabel = passed ? "สอบผ่าน" : "สอบไม่ผ่าน";

  // ── หัวรายงาน ──
  doc.font("th-bold").fontSize(18).text(`รายชื่อนักศึกษาที่${resultLabel}`, { align: "center" });
  doc.font("th").fontSize(13).text(
    `${subject.subject_code} ${subject.subject_name}`,
    { align: "center" },
  );
  doc.fontSize(12).fillColor("#555").text(`คณะพยาบาลศาสตร์ — ${scopeLabel}`, { align: "center" });
  doc.fillColor("#000").fontSize(10).text(`ออกรายงานเมื่อ ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`, { align: "center" });
  doc.moveDown(1.5);

  // ── สรุปสั้นๆ ──
  section(doc, "สรุป", 40);
  doc.font("th").fontSize(11).text(`จำนวนนักศึกษาที่${resultLabel} : ${rows.length} คน`, LEFT, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(1);

  // ── ตารางรายชื่อ ──
  section(doc, "รายชื่อ");
  if (rows.length === 0) {
    doc.font("th").fontSize(10).text(`— ไม่มีนักศึกษาที่${resultLabel}วิชานี้ —`, LEFT);
  } else {
    const endY = drawTable(doc, {
      y: doc.y,
      widths: [90, 130, 100, 90, 90],
      aligns: ["left", "left", "left", "left", "left"],
      header: ["รหัสนักศึกษา", "ชื่อ-สกุล", "ห้อง", "ปีการศึกษา", "ส่งผลเมื่อ"],
      rows: rows.map((r) => [
        r.student.student_id,
        `${r.student.user.first_name} ${r.student.user.last_name}`,
        r.student.room?.room_name ?? "-",
        r.student.academic_year,
        new Date(r.submitted_at).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
      ]),
    });
    doc.y = endY;
  }

  drawPageNumbers(doc);
  doc.end();
};
