
/* ============================================================
   Main app — role routing, shell, tweaks
   ============================================================ */
import { useState, useEffect } from 'react';
import { TopBar, Sidebar, Toast, useToast, Empty } from './components.jsx';
import { t as translate } from './i18n.js';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakColor } from './tweaks-panel.jsx';
import { Login } from './login.jsx';
import { ForceChangePassword } from './forceChangePassword.jsx';
import { getToken, getStoredUser, clearSession, apiFetch } from './api.js';
import { buildNotifications, fromServer, sortByNewest, countUnread, readKeys, markAllRead } from './notifications.js';
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
  ],
  executive: [
    { k:'dashboard', label:translate(lang,'nav.executive.dashboard'), icon:'grid' },
    { k:'students', label:translate(lang,'nav.executive.students'), icon:'users' },
    { k:'reports', label:translate(lang,'nav.executive.reports'), icon:'report' },
  ],
});
const DEFAULT_PAGE = { student:'news', officer:'dashboard', executive:'dashboard' };

export function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [role, setRole] = useState(null);
  // currentUser มาจาก JWT login จริง — ไม่ใช่ mock data แบบ ROLE_USER เดิมอีกแล้ว
  const [currentUser, setCurrentUser] = useState(null);
  // บัญชีที่เจ้าหน้าที่สร้างให้ยังใช้รหัสชั่วคราวอยู่ — บล็อกทั้งแอปจนกว่าจะเปลี่ยนรหัสสำเร็จ
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [page, setPage] = useState('news');
  const [sel, setSel] = useState(null);
  const [sbOpen, setSbOpen] = useState(false);
  const [toast, showToast] = useToast();
  const [formStep, setFormStep] = useState(0);
  const [lang, setLang] = useState('TH'); // 'TH' | 'EN' — wired into student-side pages via i18n.js
  const [langBlurring, setLangBlurring] = useState(false);
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

  // แจ้งเตือน — ดึงใหม่ทุกครั้งที่เปลี่ยนหน้า
  // นักศึกษา: ของจริงจากตาราง notifications + ประกาศ
  // role อื่น: ประกาศอย่างเดียว (ยังไม่มีแจ้งเตือนใน DB ให้)
  useEffect(()=>{
    if (!role || !currentUser) { setNotifications([]); setUnread(0); return; }
    let dropped = false;
    (async () => {
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
    })();
    return () => { dropped = true; };
  }, [role, currentUser, page, lang]);

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

  // เข้าเว็บซ้ำ (refresh) — ถ้ามี token+user เก็บไว้ใน localStorage อยู่แล้ว ให้ login ต่อเลยไม่ต้องกรอกใหม่
  useEffect(()=>{
    const stored = getStoredUser();
    if (getToken() && stored) {
      if (stored.mustChangePassword) { setMustChangePassword(true); return; }
      setCurrentUser(stored); setRole(stored.role); setPage(DEFAULT_PAGE[stored.role]);
    }
  }, []);

  const handleLogin = (user, mustChange)=>{
    if (mustChange) { setMustChangePassword(true); return; }
    setCurrentUser(user);
    setRole(user.role);
    setPage(DEFAULT_PAGE[user.role]);
  };

  // เปลี่ยนรหัสสำเร็จแล้ว — token เดิมใช้ต่อไม่ได้ (mustChangePassword ฝังใน JWT) ต้อง login ใหม่
  const handlePasswordChanged = ()=>{ setMustChangePassword(false); setRole(null); setCurrentUser(null); };

  if (mustChangePassword) return <ForceChangePassword onDone={handlePasswordChanged} />;
  if(!role) return <Login onLogin={handleLogin} />;

  const nav = role==='student' ? navStudent(lang, rejectedCount) : NAV(lang, pendingCount)[role];
  const go = (p, step=0)=>{ setPage(p); setFormStep(step); window.scrollTo(0,0); };
  // ไม่มีสลับ role ปลอมอีกแล้ว — 'logout' คือทางเดียวที่เหลือ เคลียร์ token จริงด้วย
  const switchRole = (r)=>{ if(r==='logout'){ clearSession(); setRole(null); setCurrentUser(null); return; } };

  const render = ()=>{
    if(role==='student'){
      if(page==='news') return <StudentNewsReal go={go} lang={lang} />;
      if(page==='formIntro') return <FormIntro go={go} lang={lang} />;
      if(page==='form') return <ExamFormReal go={go} toast={showToast} lang={lang} />;
      if(page==='status') return <StudentStatusReal go={go} lang={lang} />;
      if(page==='history') return <StudentHistoryReal go={go} lang={lang} />;
    }
    if(role==='officer'){
      if(page==='dashboard') return <DashboardReal go={go} lang={lang} />;
      if(page==='review') return <OfficerReviewReal go={go} setSel={setSel} lang={lang} />;
      if(page==='students') return <OfficerStudentsReal go={go} setSel={setSel} toast={showToast} lang={lang} />;
      if(page==='import') return <StudentImport toast={showToast} lang={lang} />;
      if(page==='detail') return <StudentDetailReal student={sel} go={go} toast={showToast} lang={lang} />;
      if(page==='rounds') return <ManageRoundsSubjectsReal toast={showToast} lang={lang} />;
      if(page==='usermgmt') return <ManageUsersReal toast={showToast} currentUserId={currentUser?.id} lang={lang} />;
      if(page==='newsmgmt') return <ManageNewsReal toast={showToast} lang={lang} />;
      if(page==='reports') return <ReportsReal toast={showToast} lang={lang} />;
    }
    if(role==='executive'){
      if(page==='dashboard') return <DashboardReal go={go} readonly lang={lang} />;
      if(page==='students') return <OfficerStudentsReal go={go} setSel={setSel} toast={showToast} readonly lang={lang} />;
      if(page==='detail') return <StudentDetailReal student={sel} go={go} toast={showToast} readonly lang={lang} />;
      if(page==='reports') return <ReportsReal toast={showToast} readonly lang={lang} />;
    }
    return <Empty title="ไม่พบหน้าที่ต้องการ" />;
  };

  const activeNav = page==='detail' ? 'students' : page;

  return (
    <div data-density={t.density}>
      <TopBar role={role} roleLabel={translate(lang,'role.'+role)}
        user={{ firstName: currentUser?.name || '', lastName: '' }}
        onMenu={()=>setSbOpen(true)} onSwitchRole={switchRole}
        notifications={notifications} unread={unread}
        onNotifOpen={openNotifications} onNotifGo={go}
        lang={lang} setLang={changeLang} langLoading={langBlurring} />
      <div className={'app-shell lang-fade'+(langBlurring?' lang-fade-blur':'')}>
        {/* บทบาทผู้ใช้แสดงที่เมนูผู้ใช้บน TopBar ที่เดียว — การ์ดใน sidebar ซ้ำโดยไม่จำเป็น */}
        <Sidebar items={nav} active={activeNav} onNav={go} open={sbOpen} onClose={()=>setSbOpen(false)} />
        <main className="app-main">
          <div className="app-content">{render()}</div>
        </main>
      </div>
      <Toast toast={toast} />
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
