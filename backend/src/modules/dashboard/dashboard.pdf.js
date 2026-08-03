import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(__dirname, "../../../assets/fonts");
const FONT_REGULAR = path.join(FONT_DIR, "Sarabun-Regular.ttf");
const FONT_BOLD = path.join(FONT_DIR, "Sarabun-Bold.ttf");

// แปลงค่าสถานะเป็นภาษาไทยสำหรับแสดงในรายงาน
const STATUS_TH = {
  draft: "ร่าง",
  submitted: "ส่งแล้ว",
  pending: "รอตรวจ",
  approved: "ยืนยันแล้ว",
  rejected: "ตีกลับ",
};

// วาดหนึ่งแถวของตาราง
const drawRow = (doc, y, cols, widths, x0) => {
  let x = x0;
  cols.forEach((text, i) => {
    doc.text(String(text), x + 4, y + 5, { width: widths[i] - 8 });
    x += widths[i];
  });
};

// สร้าง PDF รายงานผลสอบ 1 รอบ แล้ว pipe ลง res
export const buildReportPdf = (stats, rows, res) => {
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  // ต้อง embed font ไทย ไม่งั้นตัวอักษรจะกลายเป็นสี่เหลี่ยม
  doc.registerFont("th", FONT_REGULAR);
  doc.registerFont("th-bold", FONT_BOLD);
  doc.pipe(res);

  const { round } = stats;

  // ── หัวรายงาน ──
  doc.font("th-bold").fontSize(18).text("รายงานผลสอบใบประกอบวิชาชีพ", {
    align: "center",
  });
  doc
    .font("th")
    .fontSize(13)
    .text(`คณะพยาบาลศาสตร์ — รอบ ${round.attempt_number}/${round.academic_year}`, {
      align: "center",
    });
  doc
    .fontSize(10)
    .text(`ออกรายงานเมื่อ ${new Date().toLocaleString("th-TH")}`, {
      align: "center",
    });
  doc.moveDown(1.5);

  // ── สรุปภาพรวม ──
  doc.font("th-bold").fontSize(14).text("สรุปภาพรวม");
  doc.moveDown(0.4);
  doc.font("th").fontSize(11);
  // % ทุกตัวต้องบอกด้วยว่าหารด้วยอะไร ไม่งั้นคนอ่านรายงานจะเอาไปเทียบกับตัวเลขผิดตัว
  const summary = [
    ["นักศึกษาทั้งรุ่น", `${stats.total} คน`],
    ["เปิดสิทธิ์กรอกแล้ว", `${stats.eligible} คน`],
    ["ส่งผลสอบแล้ว", `${stats.submitted} คน (${stats.fillRate}% ของคนที่กรอกได้)`],
    ["ยังไม่เริ่มกรอก", `${stats.not_started} คน`],
    ["รอตรวจ", `${stats.by.submitted} คน`],
    ["ยืนยันแล้ว", `${stats.by.approved} คน`],
    ["ตีกลับ", `${stats.by.rejected} คน`],
    ["ผ่านครบทุกวิชา", `${stats.fullyPassed} คน (${stats.fullyPassedRate}% ของคนที่ส่ง)`],
    ["อัตราผ่านเฉลี่ยรายวิชา", `${stats.subjectPassRate}%`],
  ];
  summary.forEach(([label, value]) => {
    doc.text(`${label} : ${value}`, 50);
  });
  doc.moveDown(1);

  // ── อัตราผ่านรายวิชา ──
  doc.font("th-bold").fontSize(14).text("อัตราผ่านรายวิชา");
  doc.moveDown(0.4);

  const subjWidths = [70, 220, 60, 60, 60];
  const x0 = 50;
  let y = doc.y;

  doc.font("th-bold").fontSize(10);
  drawRow(doc, y, ["รหัสวิชา", "ชื่อวิชา", "ผ่าน", "ไม่ผ่าน", "อัตรา"], subjWidths, x0);
  y += 20;

  doc.font("th").fontSize(10);
  stats.perSubject.forEach((s) => {
    drawRow(
      doc,
      y,
      [s.subject_code, s.subject_name, s.pass, s.fail, `${s.rate}%`],
      subjWidths,
      x0,
    );
    y += 18;
  });

  // ── รายชื่อนักศึกษา ──
  doc.addPage();
  doc.font("th-bold").fontSize(14).text("รายชื่อนักศึกษาในรอบนี้");
  doc.moveDown(0.4);

  const stuWidths = [90, 180, 90, 90, 60];
  y = doc.y;
  doc.font("th-bold").fontSize(10);
  drawRow(
    doc,
    y,
    ["รหัสนักศึกษา", "ชื่อ-สกุล", "สถานะส่ง", "สถานะตรวจ", "ผ่าน"],
    stuWidths,
    x0,
  );
  y += 20;

  doc.font("th").fontSize(10);
  if (rows.length === 0) {
    doc.text("— ยังไม่มีนักศึกษากรอกผลสอบในรอบนี้ —", x0 + 4, y + 5);
  }
  rows.forEach((r) => {
    // ขึ้นหน้าใหม่เมื่อใกล้ท้ายกระดาษ
    if (y > 760) {
      doc.addPage();
      y = 50;
    }
    drawRow(
      doc,
      y,
      [
        r.student_id,
        r.full_name,
        STATUS_TH[r.student_status] ?? r.student_status,
        STATUS_TH[r.staff_status] ?? r.staff_status,
        `${r.passed}/${r.total_subjects}`,
      ],
      stuWidths,
      x0,
    );
    y += 18;
  });

  doc.end();
};
