/* ============================================================
   สร้างไฟล์ Excel (.xlsx) สำหรับ export ทุกจุดของระบบ — ใช้ตัวเดียวกันหมด หน้าตาไฟล์จะได้เหมือนกัน
   (รายชื่อนักศึกษา, ผ่าน/ไม่ผ่านรอบแรก, ผ่าน/ไม่ผ่านรายวิชา)

   ใช้แบบนี้:
     const buffer = await buildXlsx({
       sheetName: "รายชื่อ",
       columns: [
         { header: "รหัสนักศึกษา", key: "student_id", width: 16 },
         { header: "จำนวนวิชาที่ผ่าน", key: "passed", width: 14, type: "number" },
       ],
       rows: [{ student_id: "6610210001", passed: 8 }],
     });
     sendXlsx(res, "ชื่อไฟล์.xlsx", buffer);

   ทุกเซลล์เป็น "ข้อความ" ยกเว้นคอลัมน์ที่ระบุ type: "number" —
   ไม่งั้น Excel ตัดเลข 0 หน้าเบอร์โทร (0812345678 → 812345678) และแปลงรหัสยาวๆ เป็นรูปแบบวิทยาศาสตร์
   ============================================================ */
import writeXlsxFile from "write-excel-file/node";

// ชื่อชีตใน Excel: ห้ามเกิน 31 ตัวอักษร และห้ามมี \ / ? * [ ] : (Excel เปิดไฟล์ไม่ได้ถ้ามี)
// ในวงเล็บ [...] ของ regex: \\ = เครื่องหมาย \ หนึ่งตัว, \/ = /, \] = ] (ต้องมี \ นำหน้าไม่งั้นถือว่าปิดวงเล็บ)
// เดิมขาด \\ → ชื่อที่มี \ หลุดไปถึง Excel แล้วไฟล์เสีย
// export ไว้ให้เทส (tests/smoke-phase31) เรียกตรวจได้ด้วย
export const safeSheetName = (name) => {
  const cleaned = String(name).replace(/[\\\/?*[\]:]/g, " ").slice(0, 31);
  if (cleaned.trim() === "") {
    return "Sheet1";
  }
  return cleaned;
};

const toCell = (value, type) => {
  if (value === null || value === undefined || value === "") return null;
  if (type === "number") return { value: Number(value), type: Number };
  return { value: String(value), type: String };
};

export const buildXlsx = async ({ sheetName, columns, rows }) => {
  const header = columns.map((c) => ({
    value: c.header,
    type: String,
    fontWeight: "bold",
    backgroundColor: "#E5E7EB",
  }));
  const body = rows.map((row) => columns.map((c) => toCell(row[c.key], c.type)));
  return writeXlsxFile([header, ...body], {
    sheet: safeSheetName(sheetName),
    columns: columns.map((c) => ({ width: c.width ?? 16 })),
    stickyRowsCount: 1, // แถวหัวตารางตรึงไว้ เลื่อนดูรายชื่อยาวๆ แล้วยังเห็นหัวคอลัมน์
  }).toBuffer();
};

// ไฟล์เดียวหลายชีต — sheets = [{ sheetName, columns, rows }, ...] รูปแบบเดียวกับ buildXlsx ทีละชีต
// ใช้ตอนต้องแยกข้อมูลเป็นหลายแท็บ เช่น ข้อมูลนักศึกษาแยกตามรอบสอบ
export const buildXlsxWorkbook = async (sheets) => {
  const pages = sheets.map(({ sheetName, columns, rows }) => {
    const header = columns.map((c) => ({
      value: c.header,
      type: String,
      fontWeight: "bold",
      backgroundColor: "#E5E7EB",
    }));
    const body = rows.map((row) => columns.map((c) => toCell(row[c.key], c.type)));
    return {
      data: [header, ...body],
      sheet: safeSheetName(sheetName),
      columns: columns.map((c) => ({ width: c.width ?? 16 })),
      stickyRowsCount: 1,
    };
  });
  return writeXlsxFile(pages).toBuffer();
};

// ส่งไฟล์ให้เบราว์เซอร์ดาวน์โหลด — ชื่อไฟล์ภาษาไทยต้องมี filename ASCII สำรอง + filename*=UTF-8''... (RFC 5987) คู่กันเสมอ
export const sendXlsx = (res, fileName, buffer) => {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="export.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  );
  res.send(buffer);
};
