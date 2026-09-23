import { useState } from 'react';

/* แบ่งหน้าให้ลิสต์ใดก็ได้ — คู่กับ <Pagination> ใน components.jsx
   ใช้แทนการก๊อป logic slice/ceil ไปวางทุกหน้า

   resetKey = ค่าที่เปลี่ยนแล้วต้องเด้งกลับหน้า 1 (เช่น คำค้น, ตัวกรอง, แท็บ)
   ถ้าไม่ reset: กรองจนเหลือ 3 แถวตอนอยู่หน้า 7 จะเห็นหน้าว่างเปล่า แล้วนึกว่าไม่มีข้อมูล

   ทำไมรีเซ็ตตอน render ไม่ใช่ใน useEffect:
     useEffect จะทำงาน "หลัง" วาดจอเสร็จ → ผู้ใช้เห็นหน้าว่างแวบหนึ่งก่อนเด้งกลับหน้า 1
     การเทียบค่าเก่า/ใหม่แล้ว setState ตอน render เป็นท่าที่ React แนะนำเองสำหรับเคสนี้
     (React เห็นว่า state เปลี่ยนระหว่าง render ก็จะ render ซ้ำทันทีโดยยังไม่วาดจอ) */
export function usePagedList(items, per = 20, resetKey = '') {
  const [page, setPage] = useState(0);
  const [seenKey, setSeenKey] = useState(resetKey);

  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setPage(0);
  }

  const pages = Math.max(1, Math.ceil(items.length / per));
  // กันหน้าค้างเกินช่วง เช่น ลบแถวสุดท้ายของหน้าสุดท้ายทิ้ง
  const safePage = Math.min(page, pages - 1);
  const rows = items.slice(safePage * per, (safePage + 1) * per);

  return { page: safePage, setPage, pages, rows };
}
