/* ============================================================
   ชิ้นส่วนใช้ร่วมกันสำหรับสร้างรายงาน PDF (pdfkit) — ฟอนต์ไทย + ตาราง + เลขหน้า
   แยกออกมาจาก dashboard.pdf.js เดิม เพื่อให้ไฟล์ export อื่น (เช่น students.pdf.js)
   ใช้ pattern เดียวกันได้โดยไม่ต้องก๊อปโค้ดซ้ำ — แก้ตรงนี้ที่เดียว มีผลทุกรายงาน
   ============================================================ */
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(__dirname, "../../assets/fonts");
export const FONT_REGULAR = path.join(FONT_DIR, "Sarabun-Regular.ttf");
export const FONT_BOLD = path.join(FONT_DIR, "Sarabun-Bold.ttf");

// A4 = 595.28 x 841.89 pt, ตั้ง margin 40 → พื้นที่เขียนกว้าง 500 pt สูงถึง y = 790
export const LEFT = 50;
export const CONTENT_WIDTH = 500;
// เนื้อหาหยุดที่ 770 ไม่ใช่ขอบล่างจริง (801.89) — เว้นแถบท้ายกระดาษไว้ให้เลขหน้า
// ถ้าเขียนชิดขอบเกินไป pdfkit จะเด้งขึ้นหน้าใหม่ให้เองแล้วได้หน้าเปล่าท้ายไฟล์
export const BOTTOM = 770;
export const FOOTER_Y = 780;
export const TOP = 50;

// ต้อง embed font ไทย ไม่งั้นตัวอักษรจะกลายเป็นสี่เหลี่ยม — เรียกครั้งเดียวหลังสร้าง doc
export const registerThaiFonts = (doc) => {
  doc.registerFont("th", FONT_REGULAR);
  doc.registerFont("th-bold", FONT_BOLD);
};

// วาดหนึ่งแถวของตาราง
// lineBreak: false + ellipsis: true = ข้อความยาวเกินช่องให้ตัดท้ายเป็น "…" ไม่ตัดขึ้นบรรทัดใหม่
// จำเป็นมาก เพราะแถวถัดไปวาดที่ y + ความสูงคงที่ ถ้าปล่อยให้ขึ้นบรรทัดที่ 2
// ตัวอักษรจะทับแถวถัดไปจนอ่านไม่ออก (ชื่อวิชายาวๆ เจอเคสนี้ประจำ)
export const drawRow = (doc, y, cols, widths, aligns = []) => {
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
export const rule = (doc, y, width, color = "#d4d4d4") => {
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
export function drawTable(doc, { y, widths, aligns, header, rows, groups }) {
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
export const section = (doc, title, need = 90) => {
  if (doc.y + need > BOTTOM) doc.addPage();
  doc.font("th-bold").fontSize(14).fillColor("#000").text(title, LEFT);
  doc.moveDown(0.4);
};

// ช่องลงนามท้ายรายงาน 2 ช่อง (ซ้าย-ขวา) — เว้นที่ให้เซ็นบนกระดาษที่พิมพ์ออกมา
export const drawSignatureLines = (doc, labels) => {
  if (doc.y + 110 > BOTTOM) doc.addPage();
  doc.moveDown(3);
  const signY = doc.y;
  const signW = 200;
  const xs = [LEFT, LEFT + CONTENT_WIDTH - signW];
  labels.forEach((label, i) => {
    const x = xs[i];
    doc.save().moveTo(x, signY + 34).lineTo(x + signW, signY + 34)
      .lineWidth(0.5).strokeColor("#666").stroke().restore();
    doc.font("th").fontSize(10).fillColor("#000")
      .text(`(...............................................)`, x, signY + 40, { width: signW, align: "center" })
      .text(label, x, signY + 56, { width: signW, align: "center" });
  });
};

// เลขหน้า "หน้า X / Y" มุมล่างขวาทุกหน้า — ทำหลังสุดเพราะต้องรู้จำนวนหน้าทั้งหมดก่อน
// (ต้องเปิด doc ด้วย { bufferPages: true } ไม่งั้น bufferedPageRange ใช้ไม่ได้)
export const drawPageNumbers = (doc) => {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.font("th").fontSize(9).fillColor("#666")
      .text(`หน้า ${i + 1} / ${range.count}`, LEFT, FOOTER_Y, {
        width: CONTENT_WIDTH, align: "right", lineBreak: false,
      });
  }
};
