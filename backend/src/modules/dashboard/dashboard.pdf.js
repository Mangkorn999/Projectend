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
// yearStats = สรุปรายปีของรอบนั้น (มาจาก buildYearStats) ใช้ทำส่วนตัวเลขที่ส่งสภาการพยาบาล
export const buildReportPdf = (stats, rows, res, yearStats) => {
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
    ["เปิดสิทธิ์กรอกอยู่", `${stats.eligible} คน`],
    ["ส่งผลสอบแล้ว", `${stats.submitted} คน (${stats.fillRate}% ของทั้งรุ่น)`],
    ["ยังไม่เริ่มกรอก", `${stats.not_started} คน`],
    ["รอตรวจ", `${stats.by.submitted} คน`],
    ["ยืนยันแล้ว", `${stats.by.approved} คน`],
    ["ตีกลับ", `${stats.by.rejected} คน`],
    [
      "ผ่านครบทุกวิชาของรอบนี้",
      `${stats.fullyPassed} คน (${stats.fullyPassedRate}% ของทั้งรุ่น / ${stats.passRateOfSitters}% ของผู้ส่งผล)`,
    ],
    ["อัตราผ่านเฉลี่ยรายวิชา", `${stats.subjectPassRate}%`],
  ];
  summary.forEach(([label, value]) => {
    doc.text(`${label} : ${value}`, 50);
  });
  doc.moveDown(1);

  // ── ตัวเลขที่ใช้รายงานสภาการพยาบาล (ระดับปีการศึกษา ไม่ใช่ระดับรอบ) ──
  if (yearStats) {
    doc.font("th-bold").fontSize(14).text("ตัวเลขสำหรับรายงานสภาการพยาบาล");
    doc.moveDown(0.4);
    doc.font("th").fontSize(11);
    doc.text(
      `ตัวหารของทั้ง 2 รายการ = นักศึกษาทั้งรุ่นปีการศึกษา ${yearStats.academic_year} จำนวน ${yearStats.total} คน`,
      50,
    );
    doc.moveDown(0.3);
    doc.text(
      `1. ร้อยละผู้สอบผ่านในครั้งแรก : ${yearStats.firstAttempt.passed} คน = ${yearStats.firstAttempt.rate}%`,
      50,
    );
    doc.text(
      `2. ร้อยละผู้สอบผ่านภายในปีแรก : ${yearStats.firstYear.passed} คน = ${yearStats.firstYear.rate}%`,
      50,
    );
    doc.moveDown(0.3);
    doc
      .fontSize(9)
      .text(
        "หมายเหตุ: ผ่านในครั้งแรก = ผ่านครบทุกวิชาตั้งแต่การสอบรอบที่ 1 · ผ่านภายในปีแรก = ผ่านครบทุกวิชาโดยนับผลสะสมทุกรอบของปีนั้น",
        50,
        doc.y,
        { width: 500 },
      );
    doc.moveDown(1);
  }

  // ── ตารางจำแนกตามจำนวนวิชาที่สอบผ่าน (การสอบรอบแรก แยกตามห้องเรียน) ──
  const dist = yearStats?.passDistribution;
  if (dist && dist.total > 0) {
    doc.font("th-bold").fontSize(14).text("จำแนกตามจำนวนวิชาที่สอบผ่าน (การสอบรอบแรก)");
    doc.moveDown(0.4);

    const roomCount = dist.rooms.length;
    const labelW = 120;
    const cellW = Math.min(90, Math.floor((500 - labelW) / (roomCount + 1)));
    const distWidths = [labelW, ...Array(roomCount + 1).fill(cellW)];
    let dy = doc.y;

    doc.font("th-bold").fontSize(10);
    drawRow(
      doc,
      dy,
      ["ผลการสอบ", ...dist.rooms.map((r) => `${r.room_name} (${r.total})`), `รวม (${dist.total})`],
      distWidths,
      50,
    );
    dy += 20;

    doc.font("th").fontSize(10);
    for (const row of dist.rows) {
      if (row.count === 0) continue; // แถวที่ไม่มีใครเลย ตัดออกจาก PDF ให้อ่านง่าย
      const label =
        row.label === "not_submitted" ? "ไม่ได้ส่งผลสอบ" : `ผ่าน ${row.passed} วิชา`;
      drawRow(
        doc,
        dy,
        [
          label,
          ...row.byRoom.map((c) => `${c.count} (${c.rate}%)`),
          `${row.count} (${row.rate}%)`,
        ],
        distWidths,
        50,
      );
      dy += 18;
    }
    doc.y = dy;
    doc.moveDown(0.5);
    doc
      .fontSize(9)
      .text("ร้อยละคิดจากจำนวนนักศึกษาทั้งหมดของแต่ละห้องเรียน ทุกแถวรวมกันเท่ากับจำนวนนักศึกษาทั้งรุ่น", 50);
    doc.moveDown(1);
  }

  // ── อัตราผ่านรายวิชา ──
  doc.font("th-bold").fontSize(14).text(`อัตราผ่านรายวิชา (รอบ ${round.attempt_number}/${round.academic_year})`);
  doc.moveDown(0.4);

  const subjWidths = [70, 220, 60, 60, 60];
  const x0 = 50;
  let y = doc.y;

  doc.font("th-bold").fontSize(10);
  drawRow(doc, y, ["รหัสวิชา", "ชื่อวิชา", "ผ่าน", "ไม่ผ่าน", "อัตรา"], subjWidths, x0);
  y += 20;

  doc.font("th").fontSize(10);
  stats.perSubject.forEach((s) => {
    // rate เป็น null = ไม่มีใครสอบวิชานี้ในรอบนี้ (ยกผลผ่านมาจากรอบก่อนกันหมด)
    // ต้องขึ้นขีด ไม่ใช่ "null%" และไม่ใช่ 0% ซึ่งแปลว่าสอบแล้วตกหมด คนละความหมาย
    const rateText = s.rate === null ? "—" : `${s.rate}%`;
    drawRow(
      doc,
      y,
      [s.subject_code, s.subject_name, s.pass, s.fail, rateText],
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
