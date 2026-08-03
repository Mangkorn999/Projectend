/* ============================================================
   Real backend API client — ทุกหน้าที่ต้องคุยกับ backend จริงเรียกผ่านนี่
   (ไม่ใช่ mock data — request จริง ไปหา Express+Prisma ที่ localhost:3000)
   ============================================================ */
const API_BASE = 'http://localhost:3000/api';

// เก็บ JWT ไว้ที่ localStorage — คงอยู่ข้าม refresh หน้า, หายเมื่อ logout/เคลียร์เอง
const TOKEN_KEY = 'nursing_token';
const USER_KEY = 'nursing_user';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}
// mustChangePassword เก็บติดไปกับ user object ใน localStorage — ต้องรู้ตอน refresh หน้าด้วย
// ไม่ใช่แค่ตอน login ครั้งแรก เพราะ backend ยัง block ทุก endpoint จนกว่าจะเปลี่ยนรหัส
export function setSession(token, user, mustChangePassword = false) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify({ ...user, mustChangePassword }));
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/* ApiError — ให้หน้าเรียก catch แล้วอ่าน .message (ข้อความไทยจาก backend) ไปโชว์ users ได้ตรงๆ */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * เรียก backend endpoint จริง — แนบ Authorization header อัตโนมัติถ้ามี token
 * path: เช่น '/auth/login' (ไม่ต้องใส่ '/api' นำหน้า ใส่ให้แล้วใน API_BASE)
 * body: ถ้าเป็น FormData จะไม่ตั้ง Content-Type เอง (ให้ browser ใส่ boundary ให้)
 */
export async function apiFetch(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  const isFormData = body instanceof FormData;
  if (body && !isFormData) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  // backend ตอบ { success, data } เสมอตอนสำเร็จ, { success:false, message } ตอน error
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new ApiError(json.message || `Request failed (${res.status})`, res.status);
  }
  return json.data ?? json;
}

/** โหลดไฟล์ที่ต้อง auth header มาเป็น object URL — <img src> แนบ Authorization เองไม่ได้
 *  ผู้เรียกต้อง URL.revokeObjectURL() เองตอนเลิกใช้ ไม่งั้น blob ค้างใน memory */
export async function fetchAuthedObjectUrl(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
  return URL.createObjectURL(await res.blob());
}

/** เปิดไฟล์ (PDF) ที่ต้อง auth header ในแท็บใหม่ — ใช้กับ certificate/report ที่ดาวน์โหลดผ่าน <a href> ตรงๆ ไม่ได้ */
export async function openAuthedFile(path, filename) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new ApiError(json.message || `Request failed (${res.status})`, res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
