// "ผู้ดำเนินการ" = คนที่ทำรายการไว้ เช่น ผู้โพสต์ข่าว / ผู้สร้างรอบ / ผู้ตรวจผลสอบ
// ใช้ร่วมกันทุกที่ที่หน้าจอต้องโชว์ชื่อคนทำ จะได้หน้าตาเหมือนกันและไม่ต้องเขียนซ้ำ
//
// ดึง password_hash มาแค่เพื่อดูว่าบัญชีถูกปิดแล้วหรือยัง (hash เป็น null = ปิดบัญชีแล้ว)
// ⚠️ ต้องส่งผ่าน toActor() ก่อนส่งออกเสมอ ห้าม return ตรงๆ (จะหลุด hash ออกไป)
export const ACTOR_SELECT = {
  user_id: true,
  first_name: true,
  last_name: true,
  password_hash: true,
};

// แปลง user ที่ select ด้วย ACTOR_SELECT เป็นข้อมูลที่ส่งออกได้ — ตัด hash ทิ้ง เหลือแค่ is_closed
// is_closed = true → หน้าจอโชว์ "(ปิดบัญชีแล้ว)" ต่อท้ายชื่อ แต่ชื่อยังอยู่ ประวัติไม่หาย
export const toActor = (user) => {
  if (!user) return null;
  const { password_hash, ...rest } = user;
  return { ...rest, is_closed: password_hash === null };
};
