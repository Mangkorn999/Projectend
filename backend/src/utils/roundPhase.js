// "สถานะจริง" ของรอบ ณ เวลานี้
//
// ทำไมต้องมี: คอลัมน์ status ใน DB มีแค่ "open"/"closed" ซึ่งเจ้าหน้าที่กดเอง
// มันไม่รู้เรื่องวันที่เลย → รอบที่ status = "open" อาจเป็นได้ 3 แบบที่ต่างกันมาก:
//   1. ตั้งวันเปิดไว้ล่วงหน้า ยังไม่ถึงวัน  → นักศึกษายังกรอกไม่ได้ (แต่ไม่ใช่ความผิดพลาด)
//   2. อยู่ในช่วงรับจริง                    → กรอกได้
//   3. เลยวันปิดแล้วแต่เจ้าหน้าที่ยังไม่กดปิด → กรอกไม่ได้ และควรเตือนให้ไปกดปิด
// ถ้าหน้าจอเขียนว่า "เปิดรับ" ทั้ง 3 แบบ เจ้าหน้าที่จะงงว่าทำไมนักศึกษากรอกไม่ได้
//
// ค่าที่คืน ต้องตรงกับเงื่อนไขใน rounds.repository.js → findActive()
// (status = "open" และ open_date <= now <= close_date) ไม่งั้นหน้าจอจะโกหก
export const ROUND_PHASE = {
  CLOSED: "closed", // เจ้าหน้าที่กดปิดแล้ว
  SCHEDULED: "scheduled", // เปิดไว้แล้วแต่ยังไม่ถึงวันเปิดรับ
  ACTIVE: "active", // เปิดรับจริง ณ ตอนนี้ — นักศึกษากรอกได้
  EXPIRED: "expired", // เลยวันปิดรับแล้ว แต่ยังไม่ได้กดปิด
};

export const getRoundPhase = (round, now = new Date()) => {
  if (round.status !== "open") return ROUND_PHASE.CLOSED;
  if (now < new Date(round.open_date)) return ROUND_PHASE.SCHEDULED;
  if (now > new Date(round.close_date)) return ROUND_PHASE.EXPIRED;
  return ROUND_PHASE.ACTIVE;
};

// แปะ phase เข้าไปในก้อนข้อมูลรอบก่อนส่งออก — ไม่ใช่คอลัมน์ใน DB คำนวณตอนส่งทุกครั้ง
// (เก็บลง DB ไม่ได้เพราะค่ามันเปลี่ยนเองตามเวลาโดยไม่มีใครมากดอะไร)
export const withPhase = (round) => {
  if (!round) return round;
  return { ...round, phase: getRoundPhase(round) };
};
