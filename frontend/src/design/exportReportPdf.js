/* ============================================================
   บันทึกรายงานบนจอเป็นไฟล์ PDF โดยตรง (ไม่เปิดหน้าต่างพิมพ์)
   วิธี: ถ่ายรูปกล่องรายงาน (html2canvas) → หั่นเป็นหน้า A4 → ใส่ jsPDF
   ไฟล์ที่ได้จึงหน้าตาเหมือนที่เห็นบนจอทุกอย่าง (สี ฟอนต์ ตาราง)

   ตอนหั่นหน้า พยายามตัดตรงรอยต่อระหว่างส่วน (หัวข้อ/ตาราง/การ์ด) ไม่ตัดกลางตัวอักษร
   และไม่ตัดตรงที่หัวข้อเพิ่งจบ (หัวข้อจะได้ไม่ไปค้างท้ายหน้า แยกจากตารางของมัน)
   ============================================================ */

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const MARGIN_MM = 10;
const SCALE = 2; // ความคมของภาพ — 2 พอสำหรับอ่านชัดตอนพิมพ์ ไฟล์ไม่ใหญ่เกินไป

// ตำแหน่ง (px บนหน้าจอ นับจากบนสุดของกล่อง) ที่ตัดหน้าได้ = ขอบล่างของแต่ละส่วนที่เป็นลูกตรงของกล่อง
function findBreakPoints(box) {
  const boxTop = box.getBoundingClientRect().top;
  const points = [];
  Array.from(box.children).forEach(el => {
    const bottom = el.getBoundingClientRect().bottom - boxTop;
    // หัวข้อไม่นับเป็นจุดตัด
    if (!el.classList.contains('sec-title') && bottom > 0) points.push(bottom);
  });
  return points;
}

export async function saveElementAsPdf(box, filename) {
  // โหลดตอนกดปุ่มเท่านั้น — 2 ไลบรารีนี้ใหญ่ ไม่ควรถ่วงการเปิดแอปทุกหน้า
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

  const breakPointsCss = findBreakPoints(box);
  const canvas = await html2canvas(box, {
    scale: SCALE,
    backgroundColor: '#ffffff',
    useCORS: true,
    // ในสำเนาที่ถ่าย ตัดเงา/ขอบมน/ช่องไฟรอบกล่องออก ให้ภาพเต็มหน้ากระดาษ
    onclone: (doc, el) => {
      el.style.boxShadow = 'none';
      el.style.border = 'none';
      el.style.borderRadius = '0';
      // letter-spacing ของหัวตาราง/หัวข้อ (styles.css) ทำให้ html2canvas วาดสระ-วรรณยุกต์ไทยทับตัวอักษร
      // เลยปิดเฉพาะในสำเนาที่ถ่าย หน้าจอจริงไม่เปลี่ยน
      const fix = doc.createElement('style');
      // animation/transition ต้องปิดด้วย — แถวตารางมีแอนิเมชันไล่โผล่ (styles.css .tbl tbody tr)
      // สำเนาที่ถ่ายเริ่มเล่นใหม่จากต้น ถ่ายทันทีจึงได้แถวจาง/หายไป
      fix.textContent = '* { letter-spacing: 0 !important; text-transform: none !important; animation: none !important; transition: none !important; } .no-print { display: none !important; }';
      doc.head.appendChild(fix);
    },
  });

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const contentW = PAGE_W_MM - MARGIN_MM * 2;
  const contentH = PAGE_H_MM - MARGIN_MM * 2;
  // 1px ของ canvas = contentW / canvas.width มม. → ความสูงหน้าเป็น px ของ canvas
  const pageHpx = Math.floor((contentH / contentW) * canvas.width);
  const breakPoints = breakPointsCss.map(p => Math.round(p * SCALE));

  let start = 0;
  let pageNo = 0;
  while (start < canvas.height - 2) {
    const limit = start + pageHpx;
    let end;
    if (canvas.height <= limit) {
      end = canvas.height;
    } else {
      // จุดตัดที่ไกลที่สุดที่ยังอยู่ในหน้านี้ — ต้องได้เนื้อหาอย่างน้อยครึ่งหน้า ไม่งั้นตัดที่ขอบหน้าเลย
      const fit = breakPoints.filter(p => p > start + pageHpx * 0.5 && p <= limit);
      end = fit.length ? fit[fit.length - 1] : limit;
    }

    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = end - start;
    const ctx = slice.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, start, canvas.width, end - start, 0, 0, canvas.width, end - start);

    if (pageNo > 0) pdf.addPage();
    const hMm = (slice.height / canvas.width) * contentW;
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN_MM, MARGIN_MM, contentW, hMm);

    start = end;
    pageNo += 1;
  }

  pdf.save(filename);
}
