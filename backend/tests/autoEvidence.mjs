// ตัวช่วยของเทส: แนบไฟล์ PDF เล็กๆ ให้ใบผลสอบที่เพิ่งส่ง
//
// ทำไมต้องมี: ระบบไม่ยอมให้ "ยืนยัน" ใบที่ไม่มีไฟล์หลักฐาน (บัค B-03 แก้แล้ว 5 ต.ค. 2569)
// เทสเก่าหลายไฟล์สนใจแค่วงจรสถานะ (ส่ง → ยืนยัน/ตีกลับ) ไม่ได้ทดสอบเรื่องไฟล์ จึงให้ตัวช่วยนี้แนบให้เอง
// เรียกในฟังก์ชัน call() ของแต่ละไฟล์เทสหลังได้ response — ทำงานเฉพาะเมื่อเป็น POST /api/exam-results ที่สำเร็จ
// ใบหนึ่งแนบครั้งเดียว (ส่งแก้ซ้ำไม่แนบเพิ่ม) ถ้าแนบไม่สำเร็จ (เช่น รอบปิดแล้ว) ข้ามไปเฉยๆ

const attachedResultIds = new Set();

export const autoAttachEvidence = async (base, method, url, token, res) => {
  if (method !== "POST" || url !== "/api/exam-results") return;
  if (res.status !== 200 || !token) return;
  const resultId = res.json?.data?.result_id;
  if (!resultId || attachedResultIds.has(resultId)) return;
  attachedResultIds.add(resultId);

  const form = new FormData();
  form.append("file", new Blob([Buffer.from("%PDF-1.4\n%auto evidence\n%%EOF\n")], { type: "application/pdf" }), "evidence.pdf");
  form.append("certificate_type", "exam_result");
  try {
    await fetch(`${base}/api/exam-results/${resultId}/certificates`, { method: "POST", headers: { Cookie: token }, body: form });
  } catch {
    // แนบไม่ได้ก็ปล่อยผ่าน — เทสที่ต้องการใบไม่มีไฟล์จริงๆ ไม่ได้ใช้ตัวช่วยนี้
  }
};
