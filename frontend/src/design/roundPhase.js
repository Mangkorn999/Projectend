/* ============================================================
   ป้ายสถานะรอบ — ใช้ร่วมกันทุกหน้าที่โชว์รอบ
   (dashboard, จัดการรอบ, หน้ากรอกของนักศึกษา)
   ============================================================ */
/* backend ส่ง field `phase` มาให้แล้ว (backend/src/utils/roundPhase.js)
   ค่าที่เป็นไปได้: 'closed' | 'scheduled' | 'active' | 'expired'

   ทำไมไม่ดูแค่ r.status เหมือนเดิม:
     status ใน DB มีแค่ open/closed ซึ่งเจ้าหน้าที่กดเอง ไม่รู้เรื่องวันที่
     รอบที่ status='open' แต่ยังไม่ถึงวันเปิด (หรือเลยวันปิดไปแล้ว) นักศึกษากรอกไม่ได้
     ถ้าหน้าจอเขียน "เปิดรับ" เหมือนกันหมด เจ้าหน้าที่จะงงว่าทำไมไม่มีใครกรอกเข้ามา

   รอบเก่าที่ backend ยังไม่ได้แปะ phase มา (หรือ response เก่าที่ cache ไว้)
   ให้คำนวณสำรองจาก status + วันที่ ด้วยกติกาเดียวกัน จะได้ไม่มีหน้าไหนพัง */
export function phaseOf(round) {
  if (!round) return 'closed';
  if (round.phase) return round.phase;

  if (round.status !== 'open') return 'closed';
  const now = new Date();
  if (now < new Date(round.open_date)) return 'scheduled';
  if (now > new Date(round.close_date)) return 'expired';
  return 'active';
}

/* สีของ badge ให้ตรงกับความหมาย:
     active    = เขียว (ใช้งานได้จริง)
     scheduled = ฟ้า/draft (ยังไม่ถึงเวลา ไม่ใช่ปัญหา)
     expired   = เหลือง/เตือน (ต้องมีคนไปกดปิด)
     closed    = เทา */
const BADGE_CLASS = {
  active: 'ok',
  scheduled: 'draft',
  expired: 'wait',   // ใช้ badge.wait ที่มีอยู่แล้ว (ไม่มี .badge.warn ใน styles.css)
  closed: 'draft',
};

export const phaseBadgeClass = (round) => BADGE_CLASS[phaseOf(round)] ?? 'draft';

/* รับ tt (ตัวแปลของแต่ละหน้า) เข้ามาเลย ไม่ใช่ lang
   เพราะ sub-component ในโปรเจกต์นี้รับ tt มาเป็น prop อยู่แล้ว ไม่ได้รับ lang */
export const phaseLabel = (round, tt) => tt(`roundPhase.${phaseOf(round)}`);

/* เปิดให้นักศึกษากรอกได้จริงไหม ณ ตอนนี้
   ต้องตรงกับเงื่อนไข findActive() ฝั่ง backend เป๊ะๆ ไม่งั้นหน้าจอจะโกหก */
export const isAcceptingSubmissions = (round) => phaseOf(round) === 'active';
