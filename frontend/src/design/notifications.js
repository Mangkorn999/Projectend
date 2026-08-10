/* ============================================================
   แจ้งเตือน — มี 2 แหล่ง แล้วเอามารวมเป็นลิสต์เดียว

   1. ตาราง notifications ใน DB (นักศึกษาเท่านั้น) — ผลถูกยืนยัน/ตีกลับ,
      เจ้าหน้าที่เปิดสิทธิ์กรอก. เรื่อง "เปิดสิทธิ์" ประกอบเองจาก endpoint อื่นไม่ได้
      เพราะไม่มีเวลาที่เจ้าหน้าที่กดเก็บไว้ที่ไหนเลย → ต้องมีตารางจริง
      อ่านแล้ว/ยังไม่อ่าน เก็บที่ server (is_read)

   2. ประกาศจาก /news — ทุก role เห็น ไม่ต้องมีตารางแยก เพราะ news มีข้อมูลครบแล้ว
      อ่านแล้ว/ยังไม่อ่าน เก็บที่ localStorage ของเครื่องนั้น

   ทั้ง 2 แหล่งถูกแปลงเป็นรูปเดียวกันก่อนส่งเข้า TopBar:
     { key, tone, icon, page, title, sub, at }
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

// หน้าตาของแจ้งเตือนแต่ละ type ที่ backend ส่งมา (คอลัมน์ notifications.type)
// page = หน้าที่จะพาไปเมื่อกดที่แจ้งเตือนนั้น
const SERVER_TYPES = {
  approved: { tone: 'ok', icon: 'checkCircle', page: 'status' },
  rejected: { tone: 'reject', icon: 'xCircle', page: 'form' },
  eligible: { tone: 'wait', icon: 'key', page: 'form' },
};
const FALLBACK_TYPE = { tone: 'wait', icon: 'bell', page: 'news' };

// rows = ที่ได้จาก GET /notifications/me — แปลงให้เป็นรูปเดียวกับแจ้งเตือนที่ประกอบเอง
export function fromServer(rows = []) {
  return rows.map((n) => {
    const style = SERVER_TYPES[n.type] || FALLBACK_TYPE;
    // backend คั่นบรรทัดรองด้วย \n (เช่น "...ถูกตีกลับ: เอกสารไม่ชัด\nกรุณากรอกผลสอบของท่านใหม่อีกครั้ง")
    // บรรทัดแรกเป็นหัวข้อ ที่เหลือเป็นคำอธิบายตัวเล็กใต้หัวข้อ
    const [mainLine, ...subLines] = n.message.split("\n");
    return {
      ...style,
      key: `notif:${n.notification_id}`,
      title: mainLine,
      sub: subLines.join(" ") || undefined,
      at: n.created_at,
      is_read: n.is_read, // อ่านแล้วหรือยัง มาจาก server ไม่ใช่ localStorage
    };
  });
}

// news = ประกาศทั้งหมด (ทุก role เห็นเหมือนกัน)
// examResults ยังรับไว้เผื่อเรียกแบบเดิม แต่ฝั่งนักศึกษาไม่ต้องส่งมาแล้ว
// เพราะเรื่องผลสอบมาจากตาราง notifications จริงแทน ถ้าส่งมาด้วยจะขึ้นซ้ำ 2 อัน
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

  return sortByNewest(items);
}

// ใหม่สุดขึ้นก่อน — ตัวที่ไม่มีวันที่ไปท้ายสุด
export function sortByNewest(items) {
  return [...items].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
}

// นับที่ยังไม่ได้อ่าน — is_read มาจาก server ใช้อันนั้นก่อน
// ตัวที่ไม่มี is_read (ประกาศ) ค่อยดูจาก localStorage
export function countUnread(items, read = []) {
  return items.filter((n) =>
    n.is_read === undefined ? !read.includes(n.key) : !n.is_read,
  ).length;
}
