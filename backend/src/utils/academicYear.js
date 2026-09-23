// รหัสนักศึกษา 2 หลักแรก = ปี พ.ศ. ที่เข้าเรียน (เช่น 66 = 2566)
// หลักสูตรพยาบาล 4 ปี → ปีการศึกษาที่จบ = ปีที่เข้า + 4 (ยืนยันจากมังกร 16 ก.ย. 2569: รหัส 66 → จบปี 2570)
export const calcGraduationYear = (studentId) => {
  const prefix = Number(String(studentId).slice(0, 2));
  if (!Number.isInteger(prefix) || String(studentId).length < 2) {
    const err = new Error("รูปแบบรหัสนักศึกษาไม่ถูกต้อง คำนวณปีการศึกษาที่จบไม่ได้");
    err.statusCode = 400;
    throw err;
  }
  const entryYear = 2500 + prefix;
  return entryYear + 4;
};

// ตรวจปีการศึกษาที่จบที่เจ้าหน้าที่พิมพ์มาเอง (import CSV / เพิ่มทีละคน / แก้ไขข้อมูล) — ใช้กฎเดียวกันทั้ง 3 ที่
//
// คืนค่าเป็น object 1 ใน 2 แบบ (ไม่ throw — import ต้องข้ามแค่แถวที่ผิด ไม่ใช่ล้มทั้งไฟล์):
//   { year: 2572 }     ผ่าน
//   { error: "..." }   ไม่ผ่าน พร้อมเหตุผลภาษาคนที่เอาไปโชว์ได้ตรงๆ
//
// กฎ:
//   1. ต้องเป็นตัวเลข 4 หลัก (พ.ศ.)
//   2. ต้องไม่น้อยกว่าปีที่คำนวณจากรหัส — เรียนเร็วกว่าหลักสูตร 4 ปีไม่ได้
//      ข้อนี้จับความผิดพลาดที่เจอบ่อยสุด: พิมพ์ "ปีที่เข้า" (2566) แทน "ปีที่จบ" (2570)
//      ถ้าปล่อยผ่าน นักศึกษาจะไปโผล่ในรุ่นที่จบไปแล้ว และไม่เห็นรอบสอบของตัวเองเลย
export const validateGraduationYear = (value, studentId) => {
  const text = String(value).trim();
  if (!/^\d{4}$/.test(text)) {
    return { error: "ปีการศึกษาที่จบต้องเป็นตัวเลข พ.ศ. 4 หลัก" };
  }
  const year = Number(text);
  const derived = calcGraduationYear(studentId);
  if (year < derived) {
    return {
      error: `ปีการศึกษาที่จบต้องไม่น้อยกว่า ${derived} (ปีที่เข้า + 4) — อาจใส่ปีที่เข้าศึกษาแทนปีที่จบ`,
    };
  }
  return { year };
};

// ช่องปีว่างไหม — CSV ที่เว้นคอลัมน์ไว้จะได้ "" ส่วน JSON ที่ไม่ส่งมาจะได้ undefined/null
// ว่าง = ให้ระบบคำนวณจากรหัสเหมือนเดิม
export const isBlankYear = (value) =>
  value === undefined || value === null || String(value).trim() === "";
