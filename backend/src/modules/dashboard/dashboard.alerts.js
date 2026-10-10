// แจ้งเตือนของเจ้าหน้าที่ / ผู้บริหาร — GET /api/dashboard/alerts
//
// หาไฟล์นี้ง่ายๆ: route อยู่ dashboard.routes.js → handler `getAlerts` อยู่ dashboard.controller.js → logic ทั้งหมดอยู่ที่นี่
//
// มี 3 แบบ (ทุกแบบคำนวณสด ไม่เก็บ DB):
//   1. round_overdue / round_closing — รอบที่ยังเปิดอยู่แต่เลยกำหนดปิด หรือเหลือ <= CLOSING_SOON_DAYS วัน
//   2. not_submitted                 — ใกล้ปิดรอบ + ยังมีคนไม่ส่งผล (นับจาก "คนของรอบ" ไม่ใช่ทั้งรุ่น)
//   3. pending_review                — มีใบรอตรวจ (เฉพาะ officer — ผู้บริหารไม่มีสิทธิ์ตรวจ)
//
// แต่ละรายการหน้าตา: { key, type, tone, icon, title, detail, round_id, count? }
// ถ้าจะเพิ่มแจ้งเตือนแบบใหม่ → push() เพิ่มใน buildAlerts ข้างล่าง แล้วเพิ่ม type ใหม่ในหน้าจอที่ใช้กระดิ่ง (app.jsx/notifications.js)
import * as dashRepo from "./dashboard.repository.js";
import { buildStats, countByStatus } from "./dashboard.service.js";

/* ---------------------------------------------------------------------------
   แจ้งเตือนของเจ้าหน้าที่/ผู้บริหาร — คำนวณสดทุกครั้งที่เรียก ไม่เก็บลง DB

   ทำไมไม่เก็บลงตาราง notifications เหมือนของนักศึกษา:
   เรื่องพวกนี้เป็น "สถานะ ณ ตอนนี้" (เหลือกี่วันปิดรอบ / ค้างตรวจกี่ใบ) ไม่ใช่เหตุการณ์
   ถ้าเก็บลง DB ต้องมีตัวรันตามเวลามาอัปเดต และจะมีแจ้งเตือนเก่าที่ไม่จริงแล้วค้างอยู่
   คำนวณสดจึงถูกเสมอและไม่ต้องแก้ schema
--------------------------------------------------------------------------- */

const DAY_MS = 24 * 60 * 60 * 1000;

// นับวันแบบตัดเวลาออก เทียบ "วัน" ต่อ "วัน"
// ไม่งั้นรอบที่ปิด 23:59 วันนี้จะกลายเป็นเหลือ 0 วันตั้งแต่เช้า
//
// นับ "วัน" ตามเวลาไทย (UTC+7) ไม่ใช้ setHours() — setHours ใช้ timezone ของเครื่อง server
// deploy บนเครื่องที่ตั้งเป็น UTC แล้วตี 1 ตามเวลาไทยจะยังเป็น "เมื่อวาน" จำนวนวันเหลือเพี้ยนไป 1
// (ไทยไม่มี daylight saving เลย เลยบวก 7 ชั่วโมงแล้วหารเป็นวันได้ตรงๆ — ท่าเดียวกับ rounds.controller.js)
const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;
const ictDayNumber = (date) => Math.floor((new Date(date).getTime() + ICT_OFFSET_MS) / DAY_MS);
const daysUntil = (date) => ictDayNumber(date) - ictDayNumber(new Date());

const CLOSING_SOON_DAYS = 7; // เตือนล่วงหน้ากี่วันก่อนปิดรอบ

// ป้ายเตือนบน Dashboard: รอบเลยกำหนดปิด / ใกล้ปิด / ยังไม่ส่งผลสอบกี่คน และ (เฉพาะ officer) มีใบรอตรวจกี่ใบ
export const buildAlerts = async (role) => {
  const rounds = await dashRepo.findRoundsByYears(
    await dashRepo.findAcademicYears(),
  );
  if (rounds.length === 0) return { alerts: [] };

  const alerts = [];
  const push = (alert) => alerts.push(alert);

  const openRounds = rounds.filter((r) => r.status === "open");

  for (const round of openRounds) {
    const label = `รอบ ${round.attempt_number}/${round.academic_year}`;
    const left = daysUntil(round.close_date);

    // --- 1. รอบใกล้ปิด / เลยกำหนดแล้ว ---
    if (left < 0) {
      push({
        key: `round-overdue-${round.round_id}`,
        type: "round_overdue",
        tone: "reject",
        icon: "alert",
        title: `${label} เลยกำหนดปิดแล้ว`,
        detail: `ครบกำหนดไปแล้ว ${Math.abs(left)} วัน แต่สถานะยังเป็น "เปิดรับ" — ปิดรอบเพื่อสรุปผล`,
        round_id: round.round_id,
      });
    } else if (left <= CLOSING_SOON_DAYS) {
      let detail = `เหลืออีก ${left} วัน`;
      if (left === 0) detail = "วันนี้เป็นวันสุดท้าย";
      push({
        key: `round-closing-${round.round_id}`,
        type: "round_closing",
        tone: "wait",
        icon: "calendar",
        title: `${label} ใกล้ปิดรับ`,
        detail,
        round_id: round.round_id,
      });
    }

    // --- 2. ยังไม่ส่งผลกี่คน (เตือนเฉพาะตอนใกล้ปิด ไม่งั้นรกตั้งแต่วันเปิดรอบ) ---
    if (left >= 0 && left <= CLOSING_SOON_DAYS) {
      // ฐานคือ "คนที่ต้องกรอกในรอบนี้" (roundTotal) ไม่ใช่ทั้งรุ่น — รอบ 2 ขึ้นไปคนที่ผ่านครบแล้วไม่ต้องกรอก
      // ถ้านับจากทั้งรุ่น จะเตือนว่า "ยังไม่ส่ง" คนที่ไม่มีอะไรต้องส่งอีกแล้ว
      // ยังไม่ส่ง = ยังไม่มีใบเลย (roundNotStarted) + ค้างร่างยังไม่กดส่ง (draft)
      const roundStats = await buildStats(round.round_id);
      const missing = roundStats.roundNotStarted + roundStats.by.draft;
      if (missing > 0) {
        push({
          key: `round-missing-${round.round_id}`,
          type: "not_submitted",
          tone: "wait",
          icon: "users",
          title: `ยังไม่ส่งผลสอบ ${missing} คน`,
          detail: `${label} · จากผู้ที่ต้องกรอกในรอบนี้ ${roundStats.roundTotal} คน`,
          round_id: round.round_id,
          count: missing,
        });
      }
    }

  }

  // --- 3. ใบที่รอตรวจ (เจ้าหน้าที่เท่านั้น ผู้บริหารไม่มีสิทธิ์ตรวจอยู่แล้ว) ---
  // ดู "ทุกรอบ" ไม่ใช่เฉพาะรอบที่เปิดอยู่ — ใบที่ยังค้างตรวจตอนปิดรอบต้องไม่หายจากการเตือน
  // (เดิมวนเฉพาะรอบที่เปิด ใบค้างของรอบเก่าเลยถูกลืมจนไม่มีใครเห็น)
  if (role === "officer") {
    for (const round of rounds) {
      const results = await dashRepo.findResultsByRound(round.round_id);
      const pending = countByStatus(results).submitted;
      if (pending > 0) {
        let detail = `รอบ ${round.attempt_number}/${round.academic_year}`;
        if (round.status !== "open") {
          detail += " · ปิดรับแล้ว";
        }
        push({
          key: `round-pending-${round.round_id}`,
          type: "pending_review",
          tone: "navy",
          icon: "checkCircle",
          title: `มีผลสอบรอตรวจ ${pending} ใบ`,
          detail,
          round_id: round.round_id,
          count: pending,
        });
      }
    }
  }

  // เดิมมีแจ้งเตือน "สรุปรอบที่เพิ่งปิด" ด้วย แต่เอาออกแล้ว —
  // สรุปผลดูได้จาก dashboard กับหน้ารายงานอยู่แล้ว ไม่ใช่เรื่องที่ต้องลงมือทำ
  // กล่องนี้จึงเหลือเฉพาะเรื่องที่ต้อง "ทำอะไรสักอย่าง" เท่านั้น
  return { alerts };
};
