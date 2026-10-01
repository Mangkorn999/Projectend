/* ============================================================
   ไฟล์หลักฐาน (ใบรายงานผลสอบ ฯลฯ) — ค่ากลางที่ใช้ร่วมกันทุกหน้าที่แสดง/แนบไฟล์
     - หน้ากรอกผลสอบของนักศึกษา (examFormReal.jsx)
     - หน้ารายละเอียดนักศึกษาของเจ้าหน้าที่/ผู้ช่วยตรวจสอบ (studentDetailReal.jsx)

   backend เก็บชนิดเอกสาร/ชนิดไฟล์เป็นคำภาษาอังกฤษ (exam_result, license, pdf, jpg, png)
   ห้ามเอาคำพวกนี้ไปโชว์บนจอตรงๆ — ผู้ใช้เป็นพยาบาล ต้องแปลงเป็นคำไทยผ่านฟังก์ชันในไฟล์นี้ก่อนเสมอ
   ============================================================ */

// จำนวนไฟล์สูงสุดต่อใบผลสอบ และขนาดสูงสุดต่อไฟล์ — ต้องตรงกับที่ backend กำหนด
export const MAX_EVIDENCE_FILES = 5;
export const MAX_FILE_SIZE_MB = 10;

// ชนิดไฟล์ที่ให้เลือกในช่องแนบไฟล์ — ใส่ทั้งนามสกุลและชนิดไฟล์
// (โทรศัพท์บางรุ่นดูแค่ชนิดไฟล์ ถ้ามี image/* อยู่ในรายการ โทรศัพท์จะให้เลือก "ถ่ายรูป" ได้ด้วย)
export const EVIDENCE_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

// ชื่อชนิดเอกสาร (certificate_type จาก backend) เป็นภาษาที่ผู้ใช้อ่านเข้าใจ
export function certificateTypeLabel(tt, certificateType) {
  if (certificateType === 'exam_result') {
    return tt('evidence.typeExamResult');
  }
  if (certificateType === 'license') {
    return tt('evidence.typeLicense');
  }
  // ชนิดอื่นที่ไม่รู้จัก — ใช้คำกลางๆ ไม่โชว์คำภาษาอังกฤษจากฐานข้อมูล
  return tt('evidence.typeOther');
}

// นามสกุลไฟล์จากชื่อไฟล์ เช่น "ใบคะแนน.PDF" → "pdf" (ไม่มีจุด = คืนค่าว่าง)
function extensionOf(fileName) {
  if (!fileName) {
    return '';
  }
  const name = String(fileName);
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex === -1) {
    return '';
  }
  return name.slice(dotIndex + 1).toLowerCase();
}

/* หาว่าไฟล์เป็น 'pdf' / 'jpg' / 'png' (ไม่รู้จัก = '')
   typeText = file_type จาก backend (เช่น "pdf") หรือ file.type ของไฟล์ที่เพิ่งเลือก (เช่น "image/png")
   ดูจาก typeText ก่อน ถ้าบอกไม่ได้ค่อยดูนามสกุลของชื่อไฟล์ (โทรศัพท์บางรุ่นไม่ส่ง file.type มา) */
export function fileKindOf(typeText, fileName) {
  let text = '';
  if (typeText) {
    text = String(typeText).toLowerCase();
  }

  if (text.includes('pdf')) {
    return 'pdf';
  }
  if (text.includes('png')) {
    return 'png';
  }
  if (text.includes('jpg') || text.includes('jpeg')) {
    return 'jpg';
  }

  const extension = extensionOf(fileName);
  if (extension === 'pdf') {
    return 'pdf';
  }
  if (extension === 'png') {
    return 'png';
  }
  if (extension === 'jpg' || extension === 'jpeg') {
    return 'jpg';
  }
  return '';
}

// ชื่อชนิดไฟล์ที่โชว์บนจอ: PDF / รูปภาพ (JPG) / รูปภาพ (PNG)
export function fileKindLabel(tt, kind) {
  if (kind === 'pdf') {
    return tt('evidence.kindPdf');
  }
  if (kind === 'jpg') {
    return tt('evidence.kindJpg');
  }
  if (kind === 'png') {
    return tt('evidence.kindPng');
  }
  return tt('evidence.kindOther');
}

// ไอคอนตามชนิดไฟล์ (ชื่อไอคอนใน data.jsx)
export function fileKindIcon(kind) {
  if (kind === 'pdf') {
    return 'pdf';
  }
  if (kind === 'jpg' || kind === 'png') {
    return 'image';
  }
  return 'doc';
}

// ขนาดไฟล์แบบคนอ่านเข้าใจ เช่น 2.35 MB / 850 KB
export function fileSizeText(bytes) {
  const megabytes = bytes / 1024 / 1024;
  if (megabytes >= 1) {
    return megabytes.toFixed(2) + ' MB';
  }
  const kilobytes = Math.max(1, Math.round(bytes / 1024));
  return kilobytes + ' KB';
}
