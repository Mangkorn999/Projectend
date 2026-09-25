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
const TOAST_PREFIX = 'notif_toasted_'; // sessionStorage — กันเด้ง popup ซ้ำแจ้งเตือนเดิมระหว่าง session นี้
const DISMISS_PREFIX = 'notif_dismissed_'; // ปุ่ม "ล้างทั้งหมด" — ซ่อนถาวร ไม่ใช่แค่ทำเครื่องหมายว่าอ่าน
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

/* ปุ่ม "ล้างทั้งหมด" — ต่างจาก "อ่านแล้ว" ตรงที่อันนี้เอาออกจากลิสต์ไปเลย
   ใช้ตอนกล่องแจ้งเตือนรกจนหาของใหม่ไม่เจอ

   ของที่ล้างไปแล้วจะกลับมาได้ไหม ขึ้นกับ key:
     - ประกาศ/ผลสอบ = เหตุการณ์ที่เกิดครั้งเดียว key คงที่ → ล้างแล้วหายถาวร ถูกต้องแล้ว
     - alert ของเจ้าหน้าที่ = สถานะ ณ ตอนนี้ fromAlerts ผูกตัวเลขไว้ใน key ด้วย
       พอตัวเลขเปลี่ยน (ค้างตรวจ 13 → 20 ใบ) key เปลี่ยนตาม แจ้งเตือนจึงโผล่กลับมาเอง */
export function dismissedKeys(userId) {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_PREFIX + userId) || '[]');
  } catch {
    return [];
  }
}

export function dismissAll(userId, keys) {
  const merged = [...new Set([...dismissedKeys(userId), ...keys])];
  localStorage.setItem(DISMISS_PREFIX + userId, JSON.stringify(merged.slice(-300)));
}

// เหมือน readKeys/markAllRead แต่เก็บที่ sessionStorage — เคลียร์เองตอนปิดแท็บ
// ใช้แยกจาก "อ่านแล้ว" เพราะ toast เด้งครั้งเดียวพอ แม้ผู้ใช้ยังไม่กดเข้าไปดู (ยังนับ unread อยู่)
export function toastedKeys(userId) {
  try {
    return JSON.parse(sessionStorage.getItem(TOAST_PREFIX + userId) || '[]');
  } catch {
    return [];
  }
}

export function markToasted(userId, keys) {
  const merged = [...new Set([...toastedKeys(userId), ...keys])];
  sessionStorage.setItem(TOAST_PREFIX + userId, JSON.stringify(merged.slice(-200)));
}

// หน้าตาของแจ้งเตือนแต่ละ type ที่ backend ส่งมา (คอลัมน์ notifications.type)
// page = หน้าที่จะพาไปเมื่อกดที่แจ้งเตือนนั้น
const SERVER_TYPES = {
  approved: { tone: 'ok', icon: 'checkCircle', page: 'status' },
  rejected: { tone: 'reject', icon: 'xCircle', page: 'form' },
  eligible: { tone: 'wait', icon: 'key', page: 'form' },
  // เจ้าหน้าที่ถอนการยืนยัน ใบกลับเป็นรอตรวจ — พาไปดูสถานะ
  revoked: { tone: 'wait', icon: 'clock', page: 'status' },
  // เจ้าหน้าที่เปิดรอบสอบตรงกับปีของนักศึกษาคนนี้ — พาไปหน้ากรอกผลสอบ
  round_open: { tone: 'wait', icon: 'bell', page: 'form' },
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

/* ---- แจ้งเตือนของเจ้าหน้าที่/ผู้บริหาร — มาจาก GET /dashboard/alerts ----
   ก่อนหน้านี้กระดิ่งของ 2 role นี้มีแต่ "ประกาศใหม่" ที่ตัวเองเป็นคนโพสต์ ซึ่งไม่มีประโยชน์เลย
   ตอนนี้ใช้ของจริงที่ backend คำนวณสดให้: รอบใกล้ปิด/เลยกำหนด, ค้างตรวจกี่ใบ, ยังไม่ส่งผลกี่คน

   ต่างจากแจ้งเตือนอื่นตรงที่อันนี้เป็น "สถานะ ณ ตอนนี้" ไม่ใช่เหตุการณ์ที่เกิดแล้วจบ
   เลยต้องเอาตัวเลขมาต่อท้าย key ด้วย — ถ้าใช้ key เปล่า ๆ พอกด "ล้างทั้งหมด" ตอนค้างตรวจ 13 ใบ
   แล้ววันหลังค้าง 50 ใบ มันจะยังโดนซ่อนอยู่เพราะ key เดิม เจ้าหน้าที่จะไม่รู้เรื่องเลย */

// alert แต่ละชนิดกดแล้วควรพาไปหน้าไหน — ผู้บริหารมีแค่ dashboard/reports เลยพาไป dashboard หมด
const ALERT_PAGES = {
  round_overdue: 'rounds',
  round_closing: 'rounds',
  not_submitted: 'review',
  pending_review: 'review',
};

export function fromAlerts(alerts = [], role = 'officer') {
  return alerts.map((a) => ({
    // count มีเฉพาะบาง alert, detail มีทุกตัว — ใช้ตัวที่มีเป็นลายเซ็นของค่าปัจจุบัน
    key: `alert:${a.key}:${a.count ?? a.detail ?? ''}`,
    tone: a.tone,
    icon: a.icon,
    page: role === 'executive' ? 'dashboard' : (ALERT_PAGES[a.type] || 'dashboard'),
    title: a.title,
    sub: a.detail,
    at: null,   // ไม่ใช่เหตุการณ์ที่มีเวลาเกิด จึงไม่โชว์วันที่
    live: true, // ธงบอกว่าเป็นสถานะสด — app.jsx ใช้ดันขึ้นบนสุดของลิสต์
  }));
}

// news = ประกาศทั้งหมด (ทุก role เห็นเหมือนกัน)
// userId = คนที่ login อยู่ ใช้ตัดประกาศที่ตัวเองโพสต์ออก (เจ้าหน้าที่ไม่ต้องเตือนเรื่องที่ตัวเองเพิ่งเขียน)
// examResults ยังรับไว้เผื่อเรียกแบบเดิม แต่ฝั่งนักศึกษาไม่ต้องส่งมาแล้ว
// เพราะเรื่องผลสอบมาจากตาราง notifications จริงแทน ถ้าส่งมาด้วยจะขึ้นซ้ำ 2 อัน
export function buildNotifications({ role, examResults = [], news = [], lang = 'TH', userId }) {
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

  // ตัดประกาศที่ตัวเองโพสต์ออกก่อนค่อยตัดเหลือ 5 อัน
  // ต้องตัดก่อน slice ไม่ใช่หลัง ไม่งั้นเจ้าหน้าที่ที่เพิ่งโพสต์รวด 5 ประกาศจะเหลือ 0 อันพอดี
  const othersNews = userId === undefined
    ? news
    : news.filter((n) => n.posted_by !== userId);

  for (const n of othersNews.slice(0, NEWS_LIMIT)) {
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
