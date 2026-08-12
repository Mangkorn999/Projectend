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
 * groups  = (ไม่บังคับ) หัวตารางชั้นบนแบบ merge cell เช่น [{label:"",span:2},{label:"สอบผ่าน",span:2}]
 *           ผลรวมของ span ต้องเท่าจำนวนคอลัมน์พอดี ไม่งั้นหัวจะเลื่อนไม่ตรงช่อง
 * คืนค่า y ล่าสุดหลังวาดเสร็จ ให้ผู้เรียกเขียนต่อจากตรงนั้น
 */
function drawTable(doc, { y, widths, aligns, header, rows, groups }) {
  const width = widths.reduce((sum, w) => sum + w, 0);
  const ROW_H = 18;
  const HEAD_H = 20;

  // หัวชั้นบน — วาดทีละกลุ่ม กว้างเท่าผลรวมของคอลัมน์ที่มันคลุม
  // ขีดเส้นแบ่งใต้เฉพาะกลุ่มที่มีชื่อ กลุ่มเปล่า (คอลัมน์ที่ merge ลงมาชั้นล่าง) ปล่อยว่างไว้
  const drawGroups = (top) => {
    doc.save().rect(LEFT, top, width, HEAD_H).fill("#f0f0f0").restore();
    doc.font("th-bold").fontSize(10).fillColor("#000");
    let x = LEFT;
    let col = 0;
    for (const g of groups) {
      const span = widths.slice(col, col + g.span).reduce((s, w) => s + w, 0);
      if (g.label) {
        doc.text(g.label, x + 5, top + 5, {
          width: span - 10,
          align: "center",
          lineBreak: false,
          ellipsis: true,
        });
        doc.save().moveTo(x, top + HEAD_H).lineTo(x + span, top + HEAD_H)
          .lineWidth(0.5).strokeColor("#9a9a9a").stroke().restore();
      }
      x += span;
      col += g.span;
    }
    return top + HEAD_H;
  };

  const drawHeader = (top) => {
    const headTop = groups ? drawGroups(top) : top;
    doc.save().rect(LEFT, headTop, width, HEAD_H).fill("#f0f0f0").restore();
    doc.font("th-bold").fontSize(10).fillColor("#000");
    drawRow(doc, headTop, header, widths, aligns);
    rule(doc, headTop + HEAD_H, width, "#9a9a9a");
    return headTop + HEAD_H;
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

  // ── ตารางผลรายวิชาของการสอบรอบแรก (ระดับปี) ──
  // ตารางเดียวกับแท็บ "สรุปผลสอบผ่านครั้งแรก จำแนกรายวิชา" บนหน้าจอ
  // ตัวหารคือนักศึกษาทั้งรุ่น ไม่ใช่คนที่สอบวิชานั้น — คนละตัวกับตาราง "อัตราผ่านรายวิชา" ท้ายรายงาน
  const bySubject = yearStats?.firstAttemptBySubject;
  if (bySubject && bySubject.subjects.length > 0) {
    section(doc, "สรุปผลสอบผ่านครั้งแรก จำแนกรายวิชา");
    doc.font("th").fontSize(9);
    doc.text(
      `จำนวนผู้สมัครสอบ = นักศึกษาทั้งรุ่นปีการศึกษา ${yearStats.academic_year} จำนวน ${bySubject.cohort_total} คน · ส่งผลการสอบรอบแรกแล้ว ${bySubject.submitted} คน`,
      LEFT,
      doc.y,
      { width: CONTENT_WIDTH },
    );
    doc.moveDown(0.4);

    // ไม่มีคอลัมน์ "ไม่ส่งผล" แล้ว ให้ตรงกับตารางบนหน้าจอ (แท็บ "สรุปผลสอบผ่านครั้งแรก จำแนกรายวิชา")
    // ผลคือ ร้อยละผ่าน + ร้อยละไม่ผ่าน ของแต่ละวิชาไม่ครบ 100% — อธิบายไว้ใต้ตารางแล้ว
    const bsWidths = [210, 70, 55, 55, 55, 55]; // รวม = CONTENT_WIDTH (500) พอดี ห้ามเกิน ไม่งั้นตารางล้นขอบขวา
    const bsAligns = ["left", "right", "right", "right", "right", "right"];

    // sat = 0 คือไม่มีใครสอบวิชานี้เลย ต้องขึ้นขีด ไม่ใช่ 0.00% ที่แปลว่าสอบแล้วตกหมด
    const cell = (n, rate, noSat) => (noSat ? ["—", "—"] : [n, rate.toFixed(2)]);
    const bsRows = bySubject.subjects.map((s) => {
      const noSat = s.sat === 0;
      return [
        `${s.subject_code} ${s.subject_name}`,
        bySubject.cohort_total,
        ...cell(s.pass, s.pass_rate, noSat),
        ...cell(s.fail, s.fail_rate, noSat),
      ];
    });

    // แถวรวมท้ายตาราง — **นับเป็นคน** ไม่ใช่บวกคอลัมน์รายวิชา (เหมือนแถวรวมบนหน้าจอ)
    // บวกคอลัมน์จะได้ตัวหาร cohort × จำนวนวิชา ซึ่งไม่ใช่จำนวนคน แล้วไปโผล่ใต้หัว "ผู้สมัครสอบ"
    // ยอดรวมระดับ "ผลรายวิชา" — ใช้เฉพาะในหมายเหตุใต้ตาราง ไม่ได้อยู่ในตัวตารางแล้ว
    const totalNsN = bySubject.subjects.reduce((a, s) => a + s.not_submitted, 0);
    const totalFailN = bySubject.subjects.reduce((a, s) => a + s.fail, 0);
    bsRows.push([
      "รวมทุกวิชา (นับเป็นคน)",
      bySubject.cohort_total,
      bySubject.passed_all,
      bySubject.passed_all_rate.toFixed(2),
      bySubject.failed_any,
      bySubject.failed_any_rate.toFixed(2),
    ]);

    const bsEndY = drawTable(doc, {
      y: doc.y,
      widths: bsWidths,
      aligns: bsAligns,
      // หัว 2 ชั้นเหมือนบนหน้าจอ — ชั้นบนคลุมกลุ่ม ชั้นล่างแยกจำนวน/ร้อยละ
      groups: [
        { label: "", span: 2 },
        { label: "สอบผ่าน", span: 2 },
        { label: "สอบไม่ผ่าน", span: 2 },
      ],
      header: [
        "รายวิชา",
        "ผู้สมัครสอบ",
        "จำนวน (คน)",
        "ร้อยละ",
        "จำนวน (คน)",
        "ร้อยละ",
      ],
      rows: bsRows,
    });

    doc.y = bsEndY;
    doc.moveDown(0.5);
    doc
      .font("th")
      .fontSize(9)
      .text(
        `อัตราผ่านเฉลี่ยของวิชาที่มีผู้เข้าสอบ ${bySubject.average_pass_rate}% · ตารางนี้ไม่มีช่อง "ไม่ส่งผล" (${totalNsN} รายการ) ร้อยละสอบผ่าน + สอบไม่ผ่าน ของแต่ละวิชาจึงไม่ครบ 100% · เอกสารของสภาการพยาบาลนับ "ไม่ผ่าน" กับ "ไม่ส่งผล" รวมเป็นช่องเดียว = ${totalFailN + totalNsN} รายการ`,
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
