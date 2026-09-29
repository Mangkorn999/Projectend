import PDFDocument from "pdfkit";
import {
  LEFT, CONTENT_WIDTH, BOTTOM, FOOTER_Y, TOP,
  registerThaiFonts, drawRow, rule, drawTable, section, drawSignatureLines, drawPageNumbers,
} from "../../utils/pdfReport.js";

// แปลงค่าสถานะเป็นภาษาไทยสำหรับแสดงในรายงาน
const STATUS_TH = {
  draft: "ร่าง",
  submitted: "ส่งแล้ว",
  pending: "รอตรวจ",
  approved: "ยืนยันแล้ว",
  rejected: "ตีกลับ",
};

// สร้าง PDF รายงานผลสอบ 1 รอบ แล้ว pipe ลง res
// yearStats = สรุปรายปีของรอบนั้น (มาจาก buildYearStats) ใช้ทำส่วนตัวเลขที่ส่งสภาการพยาบาล
export const buildReportPdf = (stats, rows, res, yearStats) => {
  // bufferPages = เก็บทุกหน้าไว้ในหน่วยความจำก่อน ปิดท้ายค่อยวนใส่เลขหน้า
  // ต้องเปิดไว้ ไม่งั้นตอนวาดหน้าแรกยังไม่รู้ว่ารายงานจบที่หน้าเท่าไร เขียน "หน้า 1/5" ไม่ได้
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });

  registerThaiFonts(doc); // ต้อง embed font ไทย ไม่งั้นตัวอักษรจะกลายเป็นสี่เหลี่ยม
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
    .text(`ออกรายงานเมื่อ ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`, {
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
      `${stats.fullyPassed} คน (${stats.fullyPassedRate}% ของทั้งรุ่น / ${stats.passRateOfSitters}% ของผู้ที่ยืนยันแล้ว ${stats.confirmed} คน)`,
    ],
    ["อัตราผ่านเฉลี่ยรายวิชา", `${stats.subjectPassRate}%`],
  ];
  summary.forEach(([label, value]) => {
    if (doc.y + 16 > BOTTOM) doc.addPage();
    doc.text(`${label} : ${value}`, LEFT, doc.y, { width: CONTENT_WIDTH });
  });
  // ตัวเลข "ผ่าน" ทุกตัวในรายงานนับเฉพาะใบที่ยืนยันแล้ว — บอกไว้ในรายงานเลย ถ้ายังมีใบรอตรวจก็ระบุจำนวน (คนอ่านไฟล์ไม่ได้เห็นหน้าจอ)
  doc.fontSize(10).fillColor("#555").text(
    `หมายเหตุ: ตัวเลข "ผ่าน" ทุกตัวนับเฉพาะใบผลสอบที่เจ้าหน้าที่ตรวจสอบและยืนยันแล้ว${stats.by.submitted > 0 ? ` (ขณะออกรายงานยังมีใบรอตรวจสอบ ${stats.by.submitted} ใบ ที่ยังไม่นับ)` : ""}`,
    LEFT, doc.y + 2, { width: CONTENT_WIDTH },
  );
  doc.fillColor("#000").fontSize(11);
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

  // รายงานที่ส่งต่อในคณะต้องมีคนเซ็นรับรอง เว้นที่ไว้ให้เซ็นบนกระดาษที่พิมพ์ออกมา
  drawSignatureLines(doc, ["ผู้จัดทำรายงาน", "คณบดีคณะพยาบาลศาสตร์"]);
  // ทำหลังสุดเพราะต้องรู้จำนวนหน้าทั้งหมดก่อน (bufferPages เก็บหน้าไว้ให้ย้อนกลับมาเขียนได้)
  drawPageNumbers(doc);

  doc.end();
};

// PDF รายชื่อนักศึกษา "ผ่านครั้งแรก / ไม่ผ่านครั้งแรก" ของปีการศึกษาหนึ่ง (ข้อมูลมาจาก buildFirstAttemptList)
// รูปแบบเดียวกับ PDF รายชื่อรายวิชา (students.pdf.js) — หัวรายงาน, สรุปสั้นๆ, ตารางรายชื่อ, เลขหน้า
export const buildFirstAttemptListPdf = ({ year, round, total, wantPassed, label, rows, res }) => {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  registerThaiFonts(doc);
  doc.pipe(res);

  doc.font("th-bold").fontSize(18).text(`รายชื่อนักศึกษาที่สอบ${label}`, { align: "center" });
  doc.font("th").fontSize(13).text(`ปีการศึกษา ${year} — รอบสอบครั้งที่ ${round.attempt_number}`, { align: "center" });
  doc.fontSize(12).fillColor("#555").text("คณะพยาบาลศาสตร์", { align: "center" });
  doc.fillColor("#000").fontSize(10).text(`ออกรายงานเมื่อ ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`, { align: "center" });
  doc.moveDown(1.5);

  const percentText = total ? ((rows.length / total) * 100).toFixed(2) : "0.00";
  section(doc, "สรุป", 40);
  doc.font("th").fontSize(11).text(
    `จำนวน ${rows.length} คน จากนักศึกษาทั้งรุ่น ${total} คน (ร้อยละ ${percentText})`,
    LEFT, doc.y, { width: CONTENT_WIDTH },
  );
  if (!wantPassed) {
    doc.fontSize(10).fillColor("#555").text(
      "รวมนักศึกษาที่ยังไม่ส่งผลสอบ ค้างร่าง หรือถูกตีกลับ — ดูสาเหตุที่คอลัมน์ \"สถานะใบ\"",
      LEFT, doc.y, { width: CONTENT_WIDTH },
    );
    doc.fillColor("#000");
  }
  doc.moveDown(1);

  section(doc, "รายชื่อ");
  if (rows.length === 0) {
    doc.font("th").fontSize(10).text(`— ไม่มีนักศึกษาที่สอบ${label} —`, LEFT);
  } else {
    doc.y = drawTable(doc, {
      y: doc.y,
      widths: [28, 72, 132, 46, 70, 42, 110],
      aligns: ["left", "left", "left", "left", "left", "left", "left"],
      header: ["ที่", "รหัสนักศึกษา", "ชื่อ-สกุล", "ห้อง", "สถานะใบ", "ผ่าน", "วิชาที่ไม่ผ่าน"],
      rows: rows.map((r, i) => [
        i + 1,
        r.student_id,
        `${r.first_name} ${r.last_name}`,
        r.room_name || "-",
        r.paper_status,
        r.passed_text || "-",
        r.failed_subjects || "-",
      ]),
    });
  }

  drawPageNumbers(doc);
  doc.end();
};
