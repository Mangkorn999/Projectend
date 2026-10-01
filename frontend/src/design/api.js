/* ============================================================
   Real backend API client — ทุกหน้าที่ต้องคุยกับ backend จริงเรียกผ่านนี่
   (ไม่ใช่ mock data — request จริง ไปหา Express+Prisma ที่ localhost:3000)
   ============================================================ */
// ที่อยู่ backend อ่านจากไฟล์ .env ของ vite (ต้องขึ้นต้นด้วย VITE_ ถึงจะอ่านได้)
// ตอน dev คือ http://localhost:3000/api — ถ้าย้ายไป server จริง/สาธิตเครื่องอื่น แก้แค่ .env
// ?? คือ "ถ้าค่าซ้ายเป็น undefined/null ให้ใช้ค่าขวาแทน" — กันลืมสร้าง .env แล้วรันไม่ขึ้นเลย
// export ไว้ด้วยเพราะบางหน้าโหลดไฟล์ PDF เองด้วย fetch ตรงๆ (ต้องตั้งชื่อไฟล์ตอนเซฟเอง
// เลยใช้ apiFetch ไม่ได้ เพราะ apiFetch แปลงคำตอบเป็น JSON เสมอ) — หน้าพวกนั้นต่อ path เอาเอง
export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000/api';

// JWT ไม่ได้อยู่ฝั่งนี้แล้ว — backend เก็บไว้ใน httpOnly cookie ชื่อ "token"
// JS อ่าน/เขียน cookie ใบนั้นไม่ได้เลย (นั่นคือจุดประสงค์ — XSS ขโมย token ไปไม่ได้)
// localStorage เหลือเก็บแค่ user object ไว้ render UI ตอน refresh หน้า ไม่ใช่ความลับ
const USER_KEY = 'nursing_user';

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}
// mustChangePassword/profileIncomplete เก็บติดไปกับ user object — ต้องรู้ตอน refresh หน้าด้วย
// ไม่ใช่แค่ตอน login ครั้งแรก เพราะ backend ยัง block ทุก endpoint จนกว่าจะเปลี่ยนรหัส/กรอกโปรไฟล์ครบ
export function setSession(user, mustChangePassword = false, profileIncomplete = false) {
  const stored = { ...user, mustChangePassword, profileIncomplete };
  localStorage.setItem(USER_KEY, JSON.stringify(stored));
}
// ลบแค่ฝั่ง browser — cookie ต้องให้ backend สั่งลบผ่าน POST /auth/logout (ดู logout() ล่างสุด)
export function clearSession() {
  localStorage.removeItem(USER_KEY);
}

// ออกจากระบบให้ครบทั้ง 2 ฝั่ง: บอก backend ลบ cookie ก่อน แล้วค่อยล้าง user ที่เก็บไว้
export async function logout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST', auth: false });
  } catch (err) {
    // ยิงไม่ผ่าน (server ล่ม/เน็ตหลุด) ก็ยังต้องเคลียร์ฝั่ง browser ให้หลุดหน้า login
    console.error('logout request failed:', err);
  }
  clearSession();
}

/* ข้อความสำรองตอน backend ไม่ได้ส่งข้อความมา (หรือเชื่อมต่อไม่ได้เลย) — ภาษาไทยทางการ บอก "เกิดอะไรขึ้น + ทำอะไรต่อ"
   เดิมใช้ "Request failed (500)" ซึ่งผู้ใช้ (พยาบาล) อ่านไม่เข้าใจ
   status = 0 หมายถึงยังไม่ได้คำตอบจากระบบเลย (เน็ตหลุด / ระบบปิดอยู่) */
export function fallbackMessage(status) {
  if (status === 0) {
    return 'เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองอีกครั้ง';
  }
  if (status === 401) {
    return 'หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่อีกครั้ง';
  }
  if (status === 403) {
    return 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้ หากคิดว่าควรมีสิทธิ์ กรุณาติดต่อเจ้าหน้าที่คณะ';
  }
  if (status === 404) {
    return 'ไม่พบข้อมูลที่ต้องการ ข้อมูลอาจถูกลบไปแล้ว กรุณารีเฟรชหน้าแล้วลองอีกครั้ง';
  }
  if (status === 413) {
    return 'ไฟล์มีขนาดใหญ่เกินกำหนด กรุณาลดขนาดไฟล์แล้วลองอีกครั้ง';
  }
  if (status >= 500) {
    return 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งในอีกสักครู่ หากยังไม่ได้ กรุณาติดต่อเจ้าหน้าที่คณะ';
  }
  return 'ทำรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
}

/* ยิง fetch แต่แปลง "เชื่อมต่อไม่ได้เลย" (เบราว์เซอร์โยน TypeError: Failed to fetch) เป็น ApiError ภาษาไทย
   ไม่งั้นหน้าจอจะโชว์ "Failed to fetch" ภาษาอังกฤษให้ผู้ใช้เห็น */
async function safeFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch {
    throw new ApiError(fallbackMessage(0), 0);
  }
}

/* ApiError — ให้หน้าเรียก catch แล้วอ่าน .message (ข้อความไทยจาก backend) ไปโชว์ users ได้ตรงๆ */
export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    // ก้อน JSON ที่ backend ตอบมาทั้งก้อน — บาง error มีข้อมูลประกอบ (เช่น import ตอบ code + รายชื่อคอลัมน์ในไฟล์)
    this.payload = payload;
  }
}

/**
 * เรียก backend endpoint จริง — เบราว์เซอร์แนบ httpOnly cookie มาเองจาก credentials: 'include'
 * path: เช่น '/auth/login' (ไม่ต้องใส่ '/api' นำหน้า ใส่ให้แล้วใน API_BASE)
 * body: ถ้าเป็น FormData จะไม่ตั้ง Content-Type เอง (ให้ browser ใส่ boundary ให้)
 */
export async function apiFetch(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  const isFormData = body instanceof FormData;
  if (body && !isFormData) headers['Content-Type'] = 'application/json';

  // เตรียม body ที่จะส่ง: FormData ส่งดิบๆ, object ธรรมดาต้องแปลงเป็นข้อความ JSON ก่อน
  let sendBody = undefined;
  if (body) {
    if (isFormData) {
      sendBody = body;
    } else {
      sendBody = JSON.stringify(body);
    }
  }

  const res = await safeFetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: sendBody,
    // สั่งให้ browser แนบ cookie ไปด้วย — frontend (5174) กับ backend (3000) คนละ origin
    // ถ้าไม่ใส่บรรทัดนี้ cookie จะไม่ถูกส่งไปเลย แล้วทุก request จะได้ 401
    credentials: 'include',
  });

  // backend ตอบ { success, data } เสมอตอนสำเร็จ, { success:false, message } ตอน error
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    // เด้งกลับหน้า login เฉพาะตอน "cookie ใช้ไม่ได้แล้ว" ซึ่ง backend ติด code: 'auth_required' มาให้
    // 401 จากการเช็ครหัสผ่าน (login ผิด / รหัสเดิมผิด) ไม่มี code นี้ — ต้องปล่อยให้หน้าโชว์ error เอง
    // ไม่งั้นกรอกรหัสผิดทีเดียวหน้าจะ reload ทิ้งข้อความ error ที่เพิ่งขึ้น
    if (res.status === 401 && json.code === 'auth_required') forceLogout();
    throw new ApiError(json.message || fallbackMessage(res.status), res.status, json);
  }
  // backend ส่วนใหญ่ห่อคำตอบไว้ใน .data แต่บางตัว (เช่น /auth/login) ส่งมาแบนๆ
  // เช็คว่า "มี key ชื่อ data ไหม" ไม่ใช่ "data มีค่าไหม" — data: null คือคำตอบที่ตั้งใจส่งมา
  // (เช่น /rounds/active ตอนไม่มีรอบเปิด) ต้องคืน null ออกไป ไม่ใช่คืนทั้งก้อนซึ่งเป็น truthy
  if (!('data' in json)) return json;
  return json.data;
}

// เรียกจาก apiFetch เมื่อ cookie หมดอายุ/ใช้ไม่ได้แล้ว
// ลบ user ที่ค้างอยู่ทิ้งแล้ว reload — app.jsx จะไม่เห็น user แล้วตกไปหน้า login เอง
// ไม่ต้องยิง /auth/logout เพราะ cookie ใบนั้นใช้ไม่ได้อยู่แล้ว
function forceLogout() {
  clearSession();
  window.location.reload();
}

/** โหลดไฟล์ที่ต้อง login ก่อน มาเป็น object URL — <img src> ยิงเองแล้วคุม credentials ไม่ได้
 *  ผู้เรียกต้อง URL.revokeObjectURL() เองตอนเลิกใช้ ไม่งั้น blob ค้างใน memory */
export async function fetchAuthedObjectUrl(path) {
  const res = await safeFetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (!res.ok) throw new ApiError(fallbackMessage(res.status), res.status);
  return URL.createObjectURL(await res.blob());
}

/** เปิดไฟล์ (PDF หรือรูปภาพ — backend ส่งชนิดไฟล์ที่ถูกต้องมา) ที่ต้อง login ก่อน ในแท็บใหม่ — ใช้กับ certificate/report ที่ดาวน์โหลดผ่าน <a href> ตรงๆ ไม่ได้ */
export async function openAuthedFile(path, filename) {
  const res = await safeFetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new ApiError(json.message || fallbackMessage(res.status), res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** ดาวน์โหลดไฟล์ (Excel / PDF) ที่ต้อง login ก่อน — ใช้ตัวเดียวกันทุกปุ่ม "ส่งออก" ในระบบ
 *  ทำไมไม่ใช้ <a href> ตรงๆ: ไฟล์ต้องแนบ cookie login (fetch + credentials) แล้วค่อยแปลงเป็น blob ให้เบราว์เซอร์เซฟ
 *  filename ตั้งฝั่งหน้าจอ — ข้าม origin (5174 → 3000) เบราว์เซอร์อ่าน header Content-Disposition ไม่ได้
 *  ใช้แบบนี้:
 *    await downloadFile('/students/export', { method: 'POST', body: { year: 2569 }, filename: 'ข้อมูลนักศึกษา.xlsx' });
 *  ผิดพลาด (403/404/400 ...) โยน ApiError พร้อมข้อความจาก backend ให้ผู้เรียกแสดงเอง */
export async function downloadFile(path, { method = 'GET', body, filename = 'download' } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const res = await safeFetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    if (res.status === 401 && json.code === 'auth_required') forceLogout();
    throw new ApiError(json.message || fallbackMessage(res.status), res.status, json);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
