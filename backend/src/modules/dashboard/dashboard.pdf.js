import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(__dirname, "../../../assets/fonts");
const FONT_REGULAR = path.join(FONT_DIR, "Sarabun-Regular.ttf");
const FONT_BOLD = path.join(FONT_DIR, "Sarabun-Bold.ttf");

// A4 = 595.28 x 841.89 pt, ตั้ง margin 40 → พื้นที่เขียนกว้าง 500 pt สูงถึง y = 790
// ประกาศไว้ที่เดียว ทุกฟังก์ชันในไฟล์อ้างค่าเดียวกัน จะได้ไม่มีตัวเลขวิเศษกระจายอยู่ทั่ว
const LEFT = 50;
const CONTENT_WIDTH = 500;
// เนื้อหาหยุดที่ 770 ไม่ใช่ขอบล่างจริง (801.89) — เว้นแถบท้ายกระดาษไว้ให้เลขหน้า
// ถ้าเขียนชิดขอบเกินไป pdfkit จะเด้งขึ้นหน้าใหม่ให้เองแล้วได้หน้าเปล่าท้ายไฟล์
const BOTTOM = 770;
const FOOTER_Y = 780;
const TOP = 50;

// แปลงค่าสถานะเป็นภาษาไทยสำหรับแสดงในรายงาน
const STATUS_TH = {
  draft: "ร่าง",
  submitted: "ส่งแล้ว",
  pending: "รอตรวจ",
  approved: "ยืนยันแล้ว",
  rejected: "ตีกลับ",
};

// วาดหนึ่งแถวของตาราง
//
// lineBreak: false + ellipsis: true = ข้อความยาวเกินช่องให้ตัดท้ายเป็น "…" ไม่ตัดขึ้นบรรทัดใหม่
// จำเป็นมาก เพราะแถวถัดไปวาดที่ y + ความสูงคงที่ ถ้าปล่อยให้ขึ้นบรรทัดที่ 2
// ตัวอักษรจะทับแถวถัดไปจนอ่านไม่ออก (ชื่อวิชายาวๆ เจอเคสนี้ประจำ)
const drawRow = (doc, y, cols, widths, aligns = []) => {
  let x = LEFT;
  cols.forEach((text, i) => {
    doc.text(String(text), x + 5, y + 5, {
      width: widths[i] - 10,
      align: aligns[i] || "left",
      lineBreak: false,
      ellipsis: true,
    });
    x += widths[i];
  });
};

// เส้นคั่นแนวนอนเต็มความกว้างตาราง
const rule = (doc, y, width, color = "#d4d4d4") => {
  doc
    .save()
    .moveTo(LEFT, y)
    .lineTo(LEFT + width, y)
    .lineWidth(0.5)
    .strokeColor(color)
    .stroke()
    .restore();
};

/**
 * วาดตารางพร้อมจัดการขึ้นหน้าใหม่ให้เอง
 *
 * header  = ชื่อคอลัมน์ (วาดซ้ำทุกครั้งที่ขึ้นหน้าใหม่ ไม่งั้นหน้า 2 เป็นตัวเลขลอยๆ อ่านไม่รู้เรื่อง)
 * aligns  = การจัดวางต่อคอลัมน์ เช่น ["left","right","right"] — ตัวเลขต้องชิดขวาถึงจะเทียบหลักกันได้
 * คืนค่า y ล่าสุดหลังวาดเสร็จ ให้ผู้เรียกเขียนต่อจากตรงนั้น
 */
function drawTable(doc, { y, widths, aligns, header, rows }) {
  const width = widths.reduce((sum, w) => sum + w, 0);
  const ROW_H = 18;
  const HEAD_H = 20;

  const drawHeader = (top) => {
    doc.save().rect(LEFT, top, width, HEAD_H).fill("#f0f0f0").restore();
    doc.font("th-bold").fontSize(10).fillColor("#000");
    drawRow(doc, top, header, widths, aligns);
    rule(doc, top + HEAD_H, width, "#9a9a9a");
    return top + HEAD_H;
  };

  let cursor = drawHeader(y);
  doc.font("th").fontSize(10);

  rows.forEach((cols, i) => {
    // ไม่พอที่สำหรับแถวนี้แล้ว → ขึ้นหน้าใหม่แล้ววาดหัวตารางซ้ำก่อนเขียนแถวต่อ
    if (cursor + ROW_H > BOTTOM) {
      doc.addPage();
      cursor = drawHeader(TOP);
      doc.font("th").fontSize(10);
    }
    // แถบสลับสีอ่อนๆ ทุกแถวคู่ — ตารางกว้างหลายคอลัมน์ ตาจะได้ไม่ไหลข้ามแถว
    if (i % 2 === 1) {
      doc.save().rect(LEFT, cursor, width, ROW_H).fill("#fafafa").restore();
      doc.fillColor("#000");
    }
    drawRow(doc, cursor, cols, widths, aligns);
    cursor += ROW_H;
  });

  rule(doc, cursor, width, "#9a9a9a");
  return cursor;
}

// เขียนหัวข้อส่วน — ขึ้นหน้าใหม่ก่อนถ้าที่เหลือน้อยจนหัวข้อจะไปค้างท้ายกระดาษ
// need = ที่ที่ต้องใช้คร่าวๆ ของหัวข้อ + เนื้อหาอย่างน้อย 2-3 บรรทัด
const section = (doc, title, need = 90) => {
  if (doc.y + need > BOTTOM) doc.addPage();
  doc.font("th-bold").fontSize(14).fillColor("#000").text(title, LEFT);
  doc.moveDown(0.4);
};

// สร้าง PDF รายงานผลสอบ 1 รอบ แล้ว pipe ลง res
// yearStats = สรุปรายปีของรอบนั้น (มาจาก buildYearStats) ใช้ทำส่วนตัวเลขที่ส่งสภาการพยาบาล
export const buildReportPdf = (stats, rows, res, yearStats) => {
  // bufferPages = เก็บทุกหน้าไว้ในหน่วยความจำก่อน ปิดท้ายค่อยวนใส่เลขหน้า
  // ต้องเปิดไว้ ไม่งั้นตอนวาดหน้าแรกยังไม่รู้ว่ารายงานจบที่หน้าเท่าไร เขียน "หน้า 1/5" ไม่ได้
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });

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
  section(doc, "สรุปภาพรวม");
  doc.font("th").fontSize(11);
  // % ทุกตัวต้องบอกด้วยว่าหารด้วยอะไร ไม่งั้นคนอ่านรายงานจะเอาไปเทียบกับตัวเลขผิดตัว
  const summary = [
    ["นักศึกษาทั้งรุ่น", `${stats.total} คน`],
    ["เปิดสิทธิ์กรอกอยู่", `${stats.eligible} คน`],
    ["กรอกฟอร์มได้ในรอบนี้", `${stats.canSubmit} คน (ที่เหลือผ่านครบแล้ว)`],
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
    if (doc.y + 16 > BOTTOM) doc.addPage();
    doc.text(`${label} : ${value}`, LEFT, doc.y, { width: CONTENT_WIDTH });
  });
  doc.moveDown(1);

  // ── ตัวเลขที่ใช้รายงานสภาการพยาบาล (ระดับปีการศึกษา ไม่ใช่ระดับรอบ) ──
  if (yearStats) {
    section(doc, "ตัวเลขสำหรับรายงานสภาการพยาบาล");
    doc.font("th").fontSize(11);
    doc.text(
      `ตัวหารของทั้ง 2 รายการ = นักศึกษาทั้งรุ่นปีการศึกษา ${yearStats.academic_year} จำนวน ${yearStats.total} คน`,
      LEFT,
      doc.y,
      { width: CONTENT_WIDTH },
    );
    doc.moveDown(0.3);
    doc.text(
      `1. ร้อยละผู้สอบผ่านในครั้งแรก : ${yearStats.firstAttempt.passed} คน = ${yearStats.firstAttempt.rate}%`,
      LEFT,
    );
    doc.text(
      `2. ร้อยละผู้สอบผ่านภายในปีแรก : ${yearStats.firstYear.passed} คน = ${yearStats.firstYear.rate}%`,
      LEFT,
    );
    doc.moveDown(0.3);
    doc
      .fontSize(9)
      .text(
        "หมายเหตุ: ผ่านในครั้งแรก = ผ่านครบทุกวิชาตั้งแต่การสอบรอบที่ 1 · ผ่านภายในปีแรก = ผ่านครบทุกวิชาโดยนับผลสะสมทุกรอบของปีนั้น",
        LEFT,
        doc.y,
        { width: CONTENT_WIDTH },
      );
    doc.moveDown(1);
  }

  // ── ตารางจำแนกตามจำนวนวิชาที่สอบผ่าน (การสอบรอบแรก แยกตามห้องเรียน) ──
  const dist = yearStats?.passDistribution;
  if (dist && dist.total > 0) {
    section(doc, "จำแนกตามจำนวนวิชาที่สอบผ่าน (การสอบรอบแรก)");

    const roomCount = dist.rooms.length;
    const labelW = 120;
    const cellW = Math.floor((CONTENT_WIDTH - labelW) / (roomCount + 1));
    const distWidths = [labelW, ...Array(roomCount + 1).fill(cellW)];
    const distAligns = ["left", ...Array(roomCount + 1).fill("right")];

    const distRows = dist.rows
      .filter((row) => row.count > 0) // แถวที่ไม่มีใครเลย ตัดออกจาก PDF ให้อ่านง่าย
      .map((row) => [
        row.label === "not_submitted"
          ? "ไม่ได้ส่งผลสอบ"
          : `ผ่าน ${row.passed} วิชา`,
        ...row.byRoom.map((c) => `${c.count} (${c.rate}%)`),
        `${row.count} (${row.rate}%)`,
      ]);

    const endY = drawTable(doc, {
      y: doc.y,
      widths: distWidths,
      aligns: distAligns,
      header: [
        "ผลการสอบ",
        ...dist.rooms.map((r) => `${r.room_name} (${r.total})`),
        `รวม (${dist.total})`,
      ],
      rows: distRows,
    });

    doc.y = endY;
    doc.moveDown(0.5);
    doc
      .font("th")
      .fontSize(9)
      .text(
        "ร้อยละคิดจากจำนวนนักศึกษาทั้งหมดของแต่ละห้องเรียน ทุกแถวรวมกันเท่ากับจำนวนนักศึกษาทั้งรุ่น",
        LEFT,
        doc.y,
        { width: CONTENT_WIDTH },
      );
    doc.moveDown(1);
  }

  // ── อัตราผ่านรายวิชา ──
  section(
    doc,
    `อัตราผ่านรายวิชา (รอบ ${round.attempt_number}/${round.academic_year})`,
  );

  const subjEndY = drawTable(doc, {
    y: doc.y,
    widths: [70, 220, 70, 70, 70],
    aligns: ["left", "left", "right", "right", "right"],
    header: ["รหัสวิชา", "ชื่อวิชา", "ผ่าน", "ไม่ผ่าน", "อัตรา"],
    // rate เป็น null = ไม่มีใครสอบวิชานี้ในรอบนี้ (ยกผลผ่านมาจากรอบก่อนกันหมด)
    // ต้องขึ้นขีด ไม่ใช่ "null%" และไม่ใช่ 0% ซึ่งแปลว่าสอบแล้วตกหมด คนละความหมาย
    rows: stats.perSubject.map((s) => [
      s.subject_code,
      s.subject_name,
      s.pass,
      s.fail,
      s.rate === null ? "—" : `${s.rate}%`,
    ]),
  });
  doc.y = subjEndY;

  // ── รายชื่อนักศึกษา ──
  doc.addPage();
  doc.font("th-bold").fontSize(14).text("รายชื่อนักศึกษาในรอบนี้", LEFT);
  doc.moveDown(0.4);

  if (rows.length === 0) {
    doc.font("th").fontSize(10).text("— ยังไม่มีนักศึกษากรอกผลสอบในรอบนี้ —", LEFT);
  } else {
    const stuEndY = drawTable(doc, {
      y: doc.y,
      widths: [90, 180, 90, 90, 50],
      aligns: ["left", "left", "left", "left", "right"],
      header: ["รหัสนักศึกษา", "ชื่อ-สกุล", "สถานะส่ง", "สถานะตรวจ", "ผ่าน"],
      rows: rows.map((r) => [
        r.student_id,
        r.full_name,
        STATUS_TH[r.student_status] ?? r.student_status,
        STATUS_TH[r.staff_status] ?? r.staff_status,
        `${r.passed}/${r.total_subjects}`,
      ]),
    });
    doc.y = stuEndY;
  }

  // ── ช่องลงนาม ──
  // รายงานที่ส่งต่อในคณะต้องมีคนเซ็นรับรอง เว้นที่ไว้ให้เซ็นบนกระดาษที่พิมพ์ออกมา
  if (doc.y + 110 > BOTTOM) doc.addPage();
  doc.moveDown(3);
  const signY = doc.y;
  const signW = 200;
  [
    { x: LEFT, label: "ผู้จัดทำรายงาน" },
    { x: LEFT + CONTENT_WIDTH - signW, label: "คณบดีคณะพยาบาลศาสตร์" },
  ].forEach(({ x, label }) => {
    doc
      .save()
      .moveTo(x, signY + 34)
      .lineTo(x + signW, signY + 34)
      .lineWidth(0.5)
      .strokeColor("#666")
      .stroke()
      .restore();
    doc
      .font("th")
      .fontSize(10)
      .fillColor("#000")
      .text(`(...............................................)`, x, signY + 40, {
        width: signW,
        align: "center",
      })
      .text(label, x, signY + 56, { width: signW, align: "center" });
  });

  // ── เลขหน้า ──
  // ทำหลังสุดเพราะต้องรู้จำนวนหน้าทั้งหมดก่อน (bufferPages เก็บหน้าไว้ให้ย้อนกลับมาเขียนได้)
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc
      .font("th")
      .fontSize(9)
      .fillColor("#666")
      .text(`หน้า ${i + 1} / ${range.count}`, LEFT, FOOTER_Y, {
        width: CONTENT_WIDTH,
        align: "right",
        lineBreak: false,
      });
  }

  doc.end();
};
