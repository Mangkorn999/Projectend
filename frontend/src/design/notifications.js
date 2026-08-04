/* ============================================================
   แจ้งเตือน — ประกอบจาก endpoint ที่มีอยู่ ไม่มีตาราง notifications ใน DB
   "ถูกตีกลับ + remark" กับ "ประกาศ" อยู่ใน exam_results / news ครบแล้ว
   ตารางใหม่จะเป็นข้อมูลซ้ำที่ต้องคอย sync
   ============================================================ */
import { t } from './i18n.js';

const READ_PREFIX = 'notif_read_';
const NEWS_LIMIT = 5;

// ใส่สถานะไว้ใน key ด้วย เพื่อให้ ตีกลับ → แก้ → ยืนยัน ขึ้นเป็นแจ้งเตือน "ใหม่"
// ไม่ใช่ของเก่าที่เคยกดอ่านไปแล้ว
const examKey = (r) => `exam:${r.result_id}:${r.staff_status}`;
const newsKey = (n) => `news:${n.news_id}`;

export function readKeys(userId) {
  try {
    return JSON.parse(localStorage.getItem(READ_PREFIX + userId) || '[]');
  } catch {
    return []; // localStorage เสีย/ถูกแก้มือ — ถือว่ายังไม่เคยอ่าน ดีกว่าหน้าพัง
  }
}

export function markAllRead(userId, keys) {
  const merged = [...new Set([...readKeys(userId), ...keys])];
  // เก็บแค่ 200 อันล่าสุดพอ ไม่ให้ localStorage โตไม่จำกัด
  localStorage.setItem(READ_PREFIX + userId, JSON.stringify(merged.slice(-200)));
}

// examResults = ผลของนักศึกษาเอง (role อื่นส่ง [] มา), news = ประกาศทั้งหมด
export function buildNotifications({ role, examResults = [], news = [], lang = 'TH' }) {
  const tt = (key, vars) => t(lang, key, vars);
  const items = [];

  if (role === 'student') {
    for (const r of examResults) {
      const round = { attempt: r.round?.attempt_number, year: r.round?.academic_year };
      if (r.staff_status === 'rejected') {
        items.push({
          key: examKey(r), tone: 'reject', icon: 'xCircle', page: 'form',
          title: tt('notif.rejectedTitle'),
          sub: tt('notif.rejectedSub', { ...round, remark: r.remark || tt('notif.rejectedNoRemark') }),
          at: r.confirmed_at || r.submitted_at,
        });
      } else if (r.staff_status === 'approved') {
        items.push({
          key: examKey(r), tone: 'ok', icon: 'checkCircle', page: 'status',
          title: tt('notif.approvedTitle'),
          sub: tt('notif.approvedSub', round),
          at: r.confirmed_at || r.submitted_at,
        });
      }
    }
  }

  for (const n of news.slice(0, NEWS_LIMIT)) {
    items.push({
      key: newsKey(n), tone: 'wait', icon: 'bell', page: 'news',
      title: tt('notif.newsTitle'), sub: n.title, at: n.posted_at,
    });
  }

  // ใหม่สุดขึ้นก่อน — ตัวที่ไม่มีวันที่ไปท้ายสุด
  return items.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
}
