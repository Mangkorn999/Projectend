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
