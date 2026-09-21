
/* ============================================================
   Main app — role routing, shell, tweaks
   ============================================================ */
import { useState, useEffect } from 'react';
import { TopBar, Sidebar, Toast, useToast, Empty, NotifToastStack, useNotifToasts } from './components.jsx';
import { t as translate } from './i18n.js';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakColor } from './tweaks-panel.jsx';
import { Login } from './login.jsx';
import { ForceChangePassword } from './forceChangePassword.jsx';
import { CompleteProfile } from './completeProfile.jsx';
import { getStoredUser, logout, setSession, apiFetch } from './api.js';
import { buildNotifications, fromServer, sortByNewest, countUnread, readKeys, markAllRead, toastedKeys, markToasted } from './notifications.js';
import { FormIntro } from './student.jsx';
import { StudentImport } from './studentImport.jsx';
import { OfficerStudentsReal } from './officerStudentsReal.jsx';
import { StudentDetailReal } from './studentDetailReal.jsx';
import { DashboardReal } from './dashboardReal.jsx';
import { ExamFormReal } from './examFormReal.jsx';
import { StudentStatusReal, StudentHistoryReal } from './studentStatusReal.jsx';
import { OfficerReviewReal } from './officerReviewReal.jsx';
import { ManageRoundsSubjectsReal } from './manageRoundsSubjectsReal.jsx';
import { ManageUsersReal } from './manageUsersReal.jsx';
import { StudentNewsReal, ManageNewsReal } from './newsReal.jsx';
import { ReportsReal } from './reportsReal.jsx';
import { OfficerManual } from './userManual.jsx';

const TWEAK_DEFAULTS = {
  examFormStyle: 'toggle',
  dashboardStyle: 'kpi',
  accent: '#faf5e8',
  autosave: true,
  density: 'regular',
};

// rejectedCount = จำนวนใบที่เจ้าหน้าที่ตีกลับ ยังไม่ได้กรอกส่งใหม่ — ขึ้น badge เตือนที่เมนู "กรอกผลสอบ"
const navStudent = (lang, rejectedCount)=>[
  { k:'news', label:translate(lang,'nav.student.news'), icon:'news' },
  { k:'formIntro', label:translate(lang,'nav.student.form'), icon:'edit', badge: rejectedCount || null },
  { k:'status', label:translate(lang,'nav.student.status'), icon:'clock', badge: rejectedCount || null },
  { k:'history', label:translate(lang,'nav.student.history'), icon:'history' },
];

// pendingCount = จำนวนผลสอบที่รอเจ้าหน้าที่ตรวจจริง ณ ตอนนี้ (ไม่ใช่เลข mock)
const NAV = (lang, pendingCount)=>({
  student: [],
  officer: [
    { section:translate(lang,'nav.section.overview') },
    { k:'dashboard', label:translate(lang,'nav.officer.dashboard'), icon:'grid' },
    { k:'review', label:translate(lang,'nav.officer.review'), icon:'checkCircle', badge: pendingCount || null },
    { k:'students', label:translate(lang,'nav.officer.students'), icon:'users' },
    { k:'import', label:translate(lang,'nav.officer.import'), icon:'upload' },
    { section:translate(lang,'nav.section.manage') },
    { k:'rounds', label:translate(lang,'nav.officer.rounds'), icon:'calendar' },
    { k:'usermgmt', label:translate(lang,'nav.officer.usermgmt'), icon:'shield' },
    { k:'newsmgmt', label:translate(lang,'nav.officer.newsmgmt'), icon:'news' },
    { section:translate(lang,'nav.section.reports') },
    { k:'reports', label:translate(lang,'nav.officer.reports'), icon:'report' },
    { k:'manual', label:translate(lang,'nav.officer.manual'), icon:'book' },
  ],
  // ผู้บริหารเห็นได้แค่ภาพรวม — backend ตัดสิทธิ์ /students กับ /exam-results ไปแล้ว (403)
  executive: [
    { k:'dashboard', label:translate(lang,'nav.executive.dashboard'), icon:'grid' },
    { k:'reports', label:translate(lang,'nav.executive.reports'), icon:'report' },
    { k:'manual', label:translate(lang,'nav.executive.manual'), icon:'book' },
  ],
  // เจ้าหน้าที่ตรวจสอบ — เห็นแค่คิวตรวจ (pooled queue เดียวกับ officer ไม่มี assignment)
  // ไม่มี badge:pendingCount ให้เหมือน officer ตั้งใจ — pendingCount effect ผูกกับ role==='officer' เท่านั้น
  reviewer: [
    { k:'review', label:translate(lang,'nav.officer.review'), icon:'checkCircle' },
  ],
});
const DEFAULT_PAGE = { student:'news', officer:'dashboard', executive:'dashboard', reviewer:'review' };

/* ============================================================
   URL ของแต่ละหน้า
   ------------------------------------------------------------
   แอปนี้ไม่ได้ใช้ react-router — หน้าปัจจุบันเก็บเป็น state ชื่อ `page`
   ตารางข้างล่างคือตัวเชื่อม `page` เข้ากับ URL จริง เพื่อให้:
     - รีเฟรชแล้วอยู่หน้าเดิม (ไม่เด้งกลับหน้าแรก)
     - ปุ่ม back/forward ของ browser ใช้ได้
     - ก๊อป URL ส่งให้กันได้
   ============================================================ */
const LOGIN_PATH = '/login';
const CHANGE_PASSWORD_PATH = '/change-password';
const COMPLETE_PROFILE_PATH = '/complete-profile';

// key ต้องตรงกับค่าใน `page` ทุกตัวที่ render() รู้จัก ไม่งั้นหน้านั้นจะไม่มี URL
const PAGE_PATH = {
  news: '/news',
  formIntro: '/exam',
  form: '/exam/form',
  status: '/status',
  history: '/history',
  dashboard: '/dashboard',
  review: '/review',
  students: '/students',
  import: '/import',
  detail: '/students/detail',
  rounds: '/rounds',
  usermgmt: '/users',
  newsmgmt: '/news-manage',
  reports: '/reports',
  manual: '/manual',
};
const PATH_PAGE = Object.fromEntries(
  Object.entries(PAGE_PATH).map(([page, path]) => [path, page]),
);

// role ไหนเข้าหน้าไหนได้ — ต้องตรงกับเงื่อนไขใน render() เป๊ะ
// ไม่งั้นพิมพ์ URL ของ role อื่นเข้ามาแล้วจะเห็นหน้าเปล่าแทนที่จะถูกพากลับหน้าเริ่มต้น
// (นี่เป็นแค่ UX ฝั่งหน้าจอ ตัวจริงที่กันข้อมูลคือ requireRole ฝั่ง backend)
const ROLE_PAGES = {
  student: ['news', 'formIntro', 'form', 'status', 'history'],
  officer: ['dashboard', 'review', 'students', 'import', 'detail', 'rounds', 'usermgmt', 'newsmgmt', 'reports'],
  executive: ['dashboard', 'reports'],
  reviewer: ['review', 'detail'],
};

// หน้าที่ต้องมีข้อมูลที่เลือกไว้ใน state ก่อน (`sel`) ซึ่งหายไปตอนรีเฟรช
// เปิดจาก URL ตรงๆ จะได้หน้าพังเพราะไม่มีนักศึกษาให้แสดง เลยพากลับหน้าเริ่มต้นแทน
const NEEDS_SELECTION = ['detail'];

// แปลง URL เป็นชื่อหน้า — ไม่รู้จัก / ไม่ใช่ของ role นี้ / ต้องมี selection → หน้าเริ่มต้นของ role
const pageFromPath = (role, rawPath) => {
  const path = rawPath.replace(/\/+$/, '') || '/'; // ตัด / ท้าย: /news/ กับ /news คือหน้าเดียวกัน
  const page = PATH_PAGE[path];
  if (!page || !ROLE_PAGES[role].includes(page) || NEEDS_SELECTION.includes(page)) {
    return DEFAULT_PAGE[role];
  }
  return page;
};

// เขียน URL โดยไม่ให้ browser โหลดหน้าใหม่
// เช็ค pathname ก่อนทุกครั้ง — กดเมนูหน้าเดิมซ้ำจะได้ไม่กอง history จนปุ่ม back กดไม่ออก
const pushUrl = (path) => {
  if (window.location.pathname !== path) window.history.pushState({}, '', path);
};
// replace = ทับรายการปัจจุบัน ใช้ตอน login/logout/รีเฟรช ไม่ให้ back ย้อนกลับไปหน้าที่ออกมาแล้ว
const replaceUrl = (path) => {
  if (window.location.pathname !== path) window.history.replaceState({}, '', path);
};

export function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [role, setRole] = useState(null);
  // currentUser มาจาก JWT login จริง — ไม่ใช่ mock data แบบ ROLE_USER เดิมอีกแล้ว
  const [currentUser, setCurrentUser] = useState(null);
  // บัญชีที่เจ้าหน้าที่สร้างให้ยังใช้รหัสชั่วคราวอยู่ — บล็อกทั้งแอปจนกว่าจะเปลี่ยนรหัสสำเร็จ
  const [mustChangePassword, setMustChangePassword] = useState(false);
  // นักศึกษาที่เจ้าหน้าที่ import มาแล้ว (มีแค่ student_id+เลขบัตร ปชช) ยังไม่เคยกรอกโปรไฟล์ — ยังไม่มี Student row
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [page, setPage] = useState('news');
  // path ที่ผู้ใช้เปิดเข้ามาครั้งแรก — ต้องจำไว้ก่อน เพราะกว่า /auth/me จะตอบกลับมา
  // อาจมีการเขียน URL ทับไปแล้ว อ่านจาก window.location ตอนนั้นจะได้ค่าผิด
  const [bootPath] = useState(() => window.location.pathname);
  const [sel, setSel] = useState(null);
  // หน้าที่กดเข้ามาหน้า detail (students หรือ review) — ปุ่ม "กลับ" ใน StudentDetailReal ใช้ค่านี้ย้อนกลับไปหน้าเดิม
  const [detailFrom, setDetailFrom] = useState('students');
  // แท็บ/รอบ/หน้าที่ค้างไว้ตอนกดเข้าดูรายละเอียดจากคิวตรวจสอบ — OfficerReviewReal อ่านครั้งเดียวตอนกลับมาแล้วเคลียร์ทิ้ง
  const [reviewRestore, setReviewRestore] = useState(null);
  // กรองที่ส่งมาจาก Dashboard ตอนคลิกผ่าน/ไม่ผ่านรายวิชา — OfficerStudentsReal อ่านครั้งเดียวตอนเปิดหน้าแล้วเคลียร์ทิ้ง
  const [studentsFilter, setStudentsFilter] = useState(null);
  // widget เดิม (ปี/รอบ/แท็บ) ที่ค้างไว้ตอนกด "กลับไปหน้าแดชบอด" จากหน้านักศึกษา — DashboardReal อ่านครั้งเดียวแล้วเคลียร์ทิ้งเหมือนกัน
  const [dashboardRestore, setDashboardRestore] = useState(null);
  const [sbOpen, setSbOpen] = useState(false);
  const [toast, showToast] = useToast();
  const [formStep, setFormStep] = useState(0);
  const [lang, setLang] = useState('TH'); // 'TH' | 'EN' — wired into student-side pages via i18n.js
  const [langBlurring, setLangBlurring] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const changeLang = (v) => {
    if (v === lang) return;
    setLangBlurring(true);
    setTimeout(() => {
      setLang(v);
      setTimeout(() => setLangBlurring(false), 20);
    }, 280);
  };
  const [pendingCount, setPendingCount] = useState(0); // เลขบน badge "ตรวจสอบ/ยืนยันผล"
  const [rejectedCount, setRejectedCount] = useState(0); // เลขบน badge เตือนนักศึกษาว่ามีใบถูกตีกลับ
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [notifToasts, pushNotifToasts, setNotifToasts] = useNotifToasts();

  // แจ้งเตือน — ดึงใหม่ทุกครั้งที่เปลี่ยนหน้า + poll ทุก 30 วิระหว่างอยู่หน้าเดิม
  // นักศึกษา: ของจริงจากตาราง notifications + ประกาศ
  // role อื่น: ประกาศอย่างเดียว (ยังไม่มีแจ้งเตือนใน DB ให้)
  useEffect(()=>{
    if (!role || !currentUser) { setNotifications([]); setUnread(0); return; }
    let dropped = false;
    const fetchNotifs = async () => {
      const news = await apiFetch('/news').catch(()=>[]);
      const rows = role === 'student'
        ? await apiFetch('/notifications/me').catch(()=>[])
        : [];
      if (dropped) return; // เปลี่ยนหน้า/ออกจากระบบระหว่างรอ — ทิ้งผลไปเลย
      // ไม่ส่ง examResults เข้า buildNotifications แล้ว เรื่องผลสอบมาจาก DB ทางเดียว
      const items = sortByNewest([
        ...fromServer(rows),
        ...buildNotifications({ role, news, lang }),
      ]);
      setNotifications(items);
      setUnread(countUnread(items, readKeys(currentUser.id)));

      // ยังไม่อ่าน + ยังไม่เคยเด้ง popup ใน session นี้ → เด้ง แล้วจำไว้ว่าเด้งแล้ว
      const seenReadKeys = readKeys(currentUser.id);
      const seenToastKeys = toastedKeys(currentUser.id);
      const isUnread = (n) => n.is_read === undefined ? !seenReadKeys.includes(n.key) : !n.is_read;
      const toShow = items.filter(n => isUnread(n) && !seenToastKeys.includes(n.key));
      if (toShow.length) {
        pushNotifToasts(toShow);
        markToasted(currentUser.id, toShow.map(n => n.key));
      }
    };
    fetchNotifs();
    const iv = setInterval(fetchNotifs, 30000);
    return () => { dropped = true; clearInterval(iv); };
  }, [role, currentUser, page, lang]);

  const dismissNotifToast = (toastId) => setNotifToasts(cur => cur.filter(x => x._toastId !== toastId));

  // เปิดกระดิ่ง = อ่านหมดแล้ว ต้องเคลียร์ทั้ง 2 ที่
  // ประกาศเก็บที่ localStorage, แจ้งเตือนของนักศึกษาเก็บที่ DB
  const openNotifications = () => {
    markAllRead(currentUser.id, notifications.map(n => n.key));
    if (role === 'student' && notifications.some(n => n.is_read === false)) {
      apiFetch('/notifications/read-all', { method:'PATCH' }).catch(()=>{});
      setNotifications(items => items.map(n =>
        n.is_read === undefined ? n : { ...n, is_read: true }));
    }
    setUnread(0);
  };

  // นับผลสอบที่ยังรอตรวจใหม่ทุกครั้งที่เปลี่ยนหน้า — ตรวจเสร็จกลับมา badge ต้องลดลงเอง
  // นับเฉพาะรอบที่เปิดอยู่ (ไม่มีก็รอบล่าสุด) ให้ตรงกับที่หน้าคิวตรวจสอบเปิดมาเจอ
  // ถ้านับรวมทุกรอบทุกปี เลข badge จะไม่มีวันตรงกับลิสต์ที่เห็นจริง
  useEffect(()=>{
    if (role !== 'officer') { setPendingCount(0); return; }
    apiFetch('/rounds')
      .then(rounds => {
        const round = rounds.find(r => r.status === 'open') || rounds[0];
        if (!round) return setPendingCount(0);
        return apiFetch(`/exam-results?round_id=${round.round_id}&staff_status=pending`)
          .then(rows => setPendingCount(rows.length));
      })
      .catch(()=>{});
  }, [role, page]);

  // เช็คใบที่ถูกตีกลับทุกครั้งที่เปลี่ยนหน้า — กรอกส่งใหม่แล้ว badge ต้องหายเอง
  // นับเฉพาะใบล่าสุดของแต่ละรอบ (rows เรียง submitted_at desc มาแล้ว) กันนับซ้ำใบเก่าที่เคยตีกลับแต่ resubmit ผ่านไปแล้ว
  useEffect(()=>{
    if (role !== 'student') { setRejectedCount(0); return; }
    apiFetch('/exam-results/me')
      .then(rows => {
        const seenRounds = new Set();
        const latestPerRound = rows.filter(r => {
          if (seenRounds.has(r.round_id)) return false;
          seenRounds.add(r.round_id);
          return true;
        });
        setRejectedCount(latestPerRound.filter(r => r.staff_status === 'rejected').length);
      })
      .catch(()=>{});
  }, [role, page]);

  // accent override
  useEffect(()=>{ document.documentElement.style.setProperty('--gold-500', t.accent);
    document.documentElement.style.setProperty('--gold-600', shade(t.accent,-18)); }, [t.accent]);

  // เข้าเว็บซ้ำ (refresh) — ถ้ามี user เก็บไว้ใน localStorage ให้ login ต่อเลยไม่ต้องกรอกใหม่
  // token อยู่ใน httpOnly cookie แล้ว JS มองไม่เห็น เลยเช็คเองไม่ได้เหมือนเดิม
  // ต้องยิง /auth/me ถาม backend ว่า cookie ยังใช้ได้ไหม ถ้าไม่ได้ apiFetch จะเคลียร์ + reload ให้เอง
  useEffect(()=>{
    const stored = getStoredUser();
    if (!stored) { replaceUrl(LOGIN_PATH); return; }

    if (stored.mustChangePassword) { setMustChangePassword(true); replaceUrl(CHANGE_PASSWORD_PATH); return; }
    if (stored.profileIncomplete) { setProfileIncomplete(true); replaceUrl(COMPLETE_PROFILE_PATH); return; }

    const verifyCookie = async ()=>{
      try {
        await apiFetch('/auth/me');
        // กลับมาที่หน้าเดิมตาม URL ที่เปิดเข้ามา ไม่ใช่เด้งไปหน้าเริ่มต้นทุกครั้ง
        // URL ที่ใช้ไม่ได้ (ของ role อื่น / พิมพ์มั่ว / ต้องมี selection) pageFromPath พากลับหน้าเริ่มต้นให้เอง
        const p = pageFromPath(stored.role, bootPath);
        setCurrentUser(stored); setRole(stored.role); setPage(p);
        replaceUrl(PAGE_PATH[p]);
      } catch (err) {
        // 401 = cookie หมดอายุ apiFetch จัดการเด้งออกให้แล้ว ที่นี่ไม่ต้องทำอะไรเพิ่ม
        console.error('session check failed:', err);
      }
    };
    verifyCookie();
  }, [bootPath]);

  // ปุ่ม back / forward ของ browser — browser เปลี่ยน URL ให้แล้ว เราแค่เปลี่ยนหน้าตาม
  // ต้องอยู่เหนือ early return ข้างล่าง (hook ต้องถูกเรียกทุกรอบ render ห้ามข้าม)
  useEffect(()=>{
    if (!role) return;
    const onPop = ()=>{
      const p = pageFromPath(role, window.location.pathname);
      setPage(p);
      // URL ที่ย้อนไปอาจเป็นหน้าที่เข้าไม่ได้แล้ว ดึง URL ให้ตรงกับหน้าที่แสดงจริง
      replaceUrl(PAGE_PATH[p]);
    };
    window.addEventListener('popstate', onPop);
    return ()=> window.removeEventListener('popstate', onPop);
  }, [role]);

  const handleLogin = (user, mustChange, profileIncompleteFlag)=>{
    setLoggingOut(false); // เผื่อ login กลับมาหลัง logout ค้าง state เบลอไว้จากรอบก่อน
    if (mustChange) { setMustChangePassword(true); replaceUrl(CHANGE_PASSWORD_PATH); return; }
    if (profileIncompleteFlag) { setProfileIncomplete(true); replaceUrl(COMPLETE_PROFILE_PATH); return; }
    setCurrentUser(user);
    setRole(user.role);
    const p = DEFAULT_PAGE[user.role];
    setPage(p);
    // replace ไม่ใช่ push — กด back หลัง login ต้องไม่ย้อนกลับไปหน้า login อีก
    replaceUrl(PAGE_PATH[p]);
  };

  // เปลี่ยนรหัสสำเร็จแล้ว — token เดิมใช้ต่อไม่ได้ (mustChangePassword ฝังใน JWT) ต้อง login ใหม่
  const handlePasswordChanged = ()=>{
    setMustChangePassword(false); setRole(null); setCurrentUser(null);
    replaceUrl(LOGIN_PATH);
  };

  // กรอกโปรไฟล์สำเร็จ — มี Student row แล้ว, cookie เดิมยังใช้ได้ (authenticate เช็ค studentId จาก DB สดทุก request)
  // ไม่ต้องให้กรอกรหัสผ่านซ้ำ แค่ถาม /auth/me ใหม่เพื่อเอา currentUser/role แล้วเข้าแอปต่อได้เลย
  const handleProfileCompleted = async ()=>{
    try {
      const me = await apiFetch('/auth/me');
      const user = { id: me.id, name: me.name, role: me.role };
      setSession(user, false, false);
      setProfileIncomplete(false);
      setCurrentUser(user);
      setRole(user.role);
      const p = DEFAULT_PAGE[user.role];
      setPage(p);
      replaceUrl(PAGE_PATH[p]);
    } catch (err) {
      // cookie หมดอายุพอดีตอนกรอกโปรไฟล์ — apiFetch เด้งกลับ login ให้เองแล้ว (forceLogout)
      console.error('refresh session after complete-profile failed:', err);
    }
  };

  if (mustChangePassword) return <ForceChangePassword onDone={handlePasswordChanged} />;
  if (profileIncomplete) return <CompleteProfile onDone={handleProfileCompleted} />;
  if(!role) return <Login onLogin={handleLogin} />;

  const nav = role==='student' ? navStudent(lang, rejectedCount) : NAV(lang, pendingCount)[role];
  const go = (p, step=0)=>{
    // ออกไปหน้าอื่นที่ไม่ใช่ review/detail (เช่น กด sidebar ไป Dashboard) — ทิ้งตำแหน่งคิวที่จำไว้ ไม่งั้นกลับมาหน้า review ทีหลังจะเด้งไปแท็บเก่า
    if (p !== 'review' && p !== 'detail') setReviewRestore(null);
    setPage(p); setFormStep(step); pushUrl(PAGE_PATH[p] || '/'); window.scrollTo(0,0);
  };
  // ไม่มีสลับ role ปลอมอีกแล้ว — 'logout' คือทางเดียวที่เหลือ
  // เบลอหน้าจอ 280ms เหมือนตอนสลับภาษา ระหว่างนั้นยิง POST /auth/logout ให้ backend ลบ cookie
  // (clearSession() อย่างเดียวไม่พอ — cookie เป็น httpOnly ฝั่ง JS ลบเองไม่ได้)
  const switchRole = async (r)=>{
    if (r === 'logout') {
      setLoggingOut(true);
      await logout();
      setRole(null);
      setCurrentUser(null);
      replaceUrl(LOGIN_PATH);
    }
  };

  const render = ()=>{
    if(role==='student'){
      if(page==='news') return <StudentNewsReal go={go} lang={lang} />;
      if(page==='formIntro') return <FormIntro go={go} lang={lang} />;
      if(page==='form') return <ExamFormReal go={go} toast={showToast} lang={lang} />;
      if(page==='status') return <StudentStatusReal go={go} lang={lang} />;
      if(page==='history') return <StudentHistoryReal go={go} lang={lang} />;
    }
    if(role==='officer'){
      if(page==='dashboard') return <DashboardReal go={go} lang={lang} setStudentsFilter={setStudentsFilter}
        restoreView={dashboardRestore} onRestoreConsumed={() => setDashboardRestore(null)} />;
      if(page==='review') return <OfficerReviewReal go={go} setSel={setSel} setDetailFrom={setDetailFrom} lang={lang}
        restoreView={reviewRestore} onLeave={setReviewRestore} onRestoreConsumed={() => setReviewRestore(null)} />;
      if(page==='students') return <OfficerStudentsReal go={go} setSel={setSel} setDetailFrom={setDetailFrom} toast={showToast} lang={lang}
        initialFilter={studentsFilter} onInitialFilterConsumed={() => setStudentsFilter(null)}
        onBackToDashboard={(view) => { setDashboardRestore(view); go('dashboard'); }} />;
      if(page==='import') return <StudentImport toast={showToast} lang={lang} />;
      if(page==='detail') return <StudentDetailReal student={sel} go={go} backTo={detailFrom} toast={showToast} canEdit canReview lang={lang} />;
      if(page==='rounds') return <ManageRoundsSubjectsReal toast={showToast} lang={lang} />;
      if(page==='usermgmt') return <ManageUsersReal toast={showToast} currentUserId={currentUser?.id} lang={lang} />;
      if(page==='newsmgmt') return <ManageNewsReal toast={showToast} lang={lang} />;
      if(page==='reports') return <ReportsReal toast={showToast} lang={lang} />;
      if(page==='manual') return <OfficerManual />;
    }
    // ไม่มีหน้า students/detail ให้ผู้บริหารแล้ว — endpoint รายบุคคลเป็นของ officer/reviewer เท่านั้น
    if(role==='executive'){
      if(page==='dashboard') return <DashboardReal go={go} readonly lang={lang} />;
      if(page==='reports') return <ReportsReal toast={showToast} readonly lang={lang} />;
      if(page==='manual') return <Empty icon="book" title={translate(lang,'nav.executive.manual')} sub={translate(lang,'common.comingSoon')} />;
    }
    // เจ้าหน้าที่ตรวจสอบ — reuse component เดิมของ officer ทั้งคู่ ไม่มีของใหม่ แค่ไม่มี canEdit
    if(role==='reviewer'){
      if(page==='review') return <OfficerReviewReal go={go} setSel={setSel} setDetailFrom={setDetailFrom} lang={lang}
        restoreView={reviewRestore} onLeave={setReviewRestore} onRestoreConsumed={() => setReviewRestore(null)} />;
      if(page==='detail') return <StudentDetailReal student={sel} go={go} backTo={detailFrom} toast={showToast} canEdit={false} canReview lang={lang} />;
    }
    return <Empty title="ไม่พบหน้าที่ต้องการ" />;
  };

  const activeNav = page==='detail' ? (role==='reviewer' ? 'review' : 'students') : page;

  return (
    <div data-density={t.density}>
      <TopBar role={role} roleLabel={translate(lang,'role.'+role)}
        user={{ firstName: currentUser?.name || '', lastName: '' }}
        onMenu={()=>setSbOpen(true)} onSwitchRole={switchRole}
        notifications={notifications} unread={unread}
        onNotifOpen={openNotifications} onNotifGo={go}
        lang={lang} setLang={changeLang} langLoading={langBlurring} />
      <div className={'app-shell lang-fade'+(langBlurring?' lang-fade-blur':'')+(loggingOut?' logout-blur':'')}>
        {/* บทบาทผู้ใช้แสดงที่เมนูผู้ใช้บน TopBar ที่เดียว — การ์ดใน sidebar ซ้ำโดยไม่จำเป็น */}
        <Sidebar items={nav} active={activeNav} onNav={go} open={sbOpen} onClose={()=>setSbOpen(false)} />
        <main className="app-main">
          <div className="app-content">{render()}</div>
        </main>
      </div>
      <Toast toast={toast} />
      <NotifToastStack items={notifToasts} lang={lang}
        onGo={(p)=>{ go(p); }} onDismiss={dismissNotifToast} />
    </div>
  );
}

/* tweaks panel UI */
function TweaksUI({ t, setTweak }) {
  return (
    <TweaksPanel>
      <TweakSection label="รูปแบบฟอร์มกรอกผลสอบ (นักศึกษา)" />
      <TweakRadio label="สไตล์ฟอร์ม" value={t.examFormStyle}
        options={[{value:'toggle',label:'สลับ'},{value:'cards',label:'การ์ด'},{value:'checklist',label:'รายการ'}]}
        onChange={v=>setTweak('examFormStyle',v)} />
      <TweakToggle label="บันทึกร่างอัตโนมัติ" value={t.autosave} onChange={v=>setTweak('autosave',v)} />
      <TweakSection label="รูปแบบ Dashboard (เจ้าหน้าที่)" />
      <TweakRadio label="เลย์เอาต์" value={t.dashboardStyle}
        options={[{value:'kpi',label:'KPI'},{value:'charts',label:'กราฟ'},{value:'ops',label:'คิวงาน'}]}
        onChange={v=>setTweak('dashboardStyle',v)} />
      <TweakSection label="ธีม" />
      <TweakColor label="สีเน้น (Accent)" value={t.accent}
        options={['#d4a017','#2563eb','#0d9488','#b45309']} onChange={v=>setTweak('accent',v)} />
      <TweakRadio label="ความหนาแน่น" value={t.density}
        options={[{value:'compact',label:'แน่น'},{value:'regular',label:'ปกติ'}]}
        onChange={v=>setTweak('density',v)} />
    </TweaksPanel>
  );
}

/* color shade helper */
function shade(hex, pct){
  const n=parseInt(hex.slice(1),16); let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  const f=pct/100; r=Math.round(r+(pct<0?r:255-r)*f); g=Math.round(g+(pct<0?g:255-g)*f); b=Math.round(b+(pct<0?b:255-b)*f);
  return '#'+[r,g,b].map(x=>Math.max(0,Math.min(255,x)).toString(16).padStart(2,'0')).join('');
}
