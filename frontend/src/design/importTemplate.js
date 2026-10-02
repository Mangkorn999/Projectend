/* ============================================================
   ไฟล์ตัวอย่างสำหรับนำเข้ารายชื่อนักศึกษา (Excel .xlsx) — หัวคอลัมน์ภาษาไทย
     รหัสนักศึกษา | เลขบัตรประชาชน | ปีการศึกษาที่จบ (ไม่บังคับ)
   ทุกคอลัมน์ตั้งเป็น "ข้อความ" ไว้แล้ว พิมพ์เลขบัตร 13 หลักได้โดยไม่ถูก Excel แปลงเป็น 1.23E+12
   แถวตัวอย่างที่ 2 คือคนซ้ำชั้น (รหัส 66 ปกติจบ 2570 แต่จบจริง 2572)
   backend จับคู่หัวคอลัมน์ภาษาไทยเหล่านี้ได้เอง (ดู COLUMN_KEYWORDS ใน student.controller.js)

   ทำไมเก็บเป็นข้อความ base64 ในไฟล์ .js แทนไฟล์ .xlsx:
     .gitignore ของโปรเจกต์ไม่เก็บไฟล์ *.xlsx (กันไฟล์รายชื่อจริงหลุดเข้า repo)
     ถ้าเป็นไฟล์ .xlsx แยก จะไม่ถูก commit แล้วเครื่องอื่น build ไม่ผ่าน
   แก้ไฟล์ตัวอย่าง: สร้าง .xlsx ใหม่ → แปลงเป็น base64 → วางแทนข้อความด้านล่าง
   ============================================================ */

const TEMPLATE_BASE64 = [
  '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',
  'AAAAAAYABgCAAQAARgcAAAAA'
].join('');

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ดาวน์โหลดไฟล์ตัวอย่าง — แปลง base64 กลับเป็นไฟล์ แล้วสั่งเบราว์เซอร์บันทึก
export function downloadImportTemplate() {
  // 1) base64 → ตัวอักษรทีละไบต์
  const binaryText = atob(TEMPLATE_BASE64);
  // 2) ตัวอักษร → ตัวเลขไบต์ (0-255) ทีละตัว
  const bytes = new Uint8Array(binaryText.length);
  for (let i = 0; i < binaryText.length; i++) {
    bytes[i] = binaryText.charCodeAt(i);
  }
  // 3) ไบต์ → ไฟล์ → ลิงก์ดาวน์โหลดชั่วคราว
  const blob = new Blob([bytes], { type: XLSX_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'แบบฟอร์มนำเข้ารายชื่อนักศึกษา.xlsx';
  link.click();
  URL.revokeObjectURL(url);
}
