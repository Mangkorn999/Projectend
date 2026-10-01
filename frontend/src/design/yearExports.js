/* ============================================================
   ส่งออกรายชื่อ "ผ่าน / ไม่ผ่านภายในปีแรก" ของปีการศึกษาหนึ่ง (Excel หรือ PDF)
   ใช้ร่วมกัน 3 หน้า: ข้อมูลนักศึกษา (เมนูส่งออกข้อมูล), รายงานสรุป (แผงส่งออกข้อมูล), แดชบอร์ด (การ์ดรายปี)

   ผ่านภายในปีแรก = ผ่านครบทุกวิชาในรอบใดรอบหนึ่งของปีนั้น (รวมรอบที่ 2 และ 3)
   ผ่าน + ไม่ผ่าน = นักศึกษาทั้งรุ่น — backend คำนวณให้ (GET /dashboard/export-first-year) หน้าจอไม่คำนวณเอง
   เฉพาะเจ้าหน้าที่คณะ (backend บังคับสิทธิ์อีกชั้น)
   ============================================================ */
import { downloadFile } from './api.js';

// ดาวน์โหลดไฟล์รายชื่อ — passed = true (ผ่าน) / false (ไม่ผ่าน), format = 'xlsx' | 'pdf'
export function downloadFirstYearList(year, passed, format) {
  let fileLabel = 'ไม่ผ่านภายในปีแรก';
  if (passed) {
    fileLabel = 'ผ่านภายในปีแรก';
  }
  return downloadFile(`/dashboard/export-first-year?year=${year}&passed=${passed}&format=${format}`, {
    filename: `รายชื่อนักศึกษา${fileLabel}-${year}.${format}`,
  });
}

// 1 รายการในเมนู "ส่งออก" (ExportMenu) พร้อมชื่อเต็ม เช่น "ผู้สอบผ่านภายในปีแรก ปี 2569 (Excel)"
export function firstYearExportItem(tt, year, passed, format) {
  let labelKey;
  if (passed && format === 'xlsx') {
    labelKey = 'export.firstYearPassExcel';
  } else if (passed) {
    labelKey = 'export.firstYearPassPdf';
  } else if (format === 'xlsx') {
    labelKey = 'export.firstYearFailExcel';
  } else {
    labelKey = 'export.firstYearFailPdf';
  }

  let icon = 'pdf';
  if (format === 'xlsx') {
    icon = 'report';
  }

  let resultKey = 'fail';
  if (passed) {
    resultKey = 'pass';
  }

  return {
    key: 'first-year-' + resultKey + '-' + format,
    label: tt(labelKey, { year }),
    icon,
    run: () => downloadFirstYearList(year, passed, format),
  };
}
