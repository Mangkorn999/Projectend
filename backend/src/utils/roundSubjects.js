/**
 * รอบหนึ่งสอบวิชาอะไรบ้าง — คำตอบเดียวที่ทุกที่ต้องใช้ให้ตรงกัน
 * (หน้ากรอกของนักศึกษา, ตอนตรวจผลที่ส่งมา, และ dashboard)
 *
 * รอบที่สร้างก่อนมี column subject_ids จะมีค่าเป็น [] — ถือว่าใช้ทุกวิชาเหมือนเดิม
 * ไม่งั้นรอบเก่าจะกลายเป็น "ไม่มีวิชาให้กรอก" ทันทีที่ deploy
 */
export const subjectsOfRound = (round, allSubjects) => {
  const ids = round?.subject_ids?.length
    ? round.subject_ids
    : allSubjects.map((s) => s.subject_id);

  // เรียงตามลำดับวิชาในระบบ ไม่ใช่ลำดับที่ officer กดเลือก — นักศึกษาจะได้เห็นเรียงเหมือนกันทุกคน
  return allSubjects.filter((s) => ids.includes(s.subject_id));
};
