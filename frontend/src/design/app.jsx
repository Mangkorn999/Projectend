
/* ============================================================
   Main app — role routing, shell, tweaks
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { TopBar, Sidebar, Toast, useToast, Empty } from './components.jsx';
import { t as translate } from './i18n.js';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakColor } from './tweaks-panel.jsx';
import { Login } from './login.jsx';
import { ForceChangePassword } from './forceChangePassword.jsx';
import { getToken, getStoredUser, clearSession } from './api.js';
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

const navStudent = (lang)=>[
  { k:'news', label:translate(lang,'nav.student.news'), icon:'news' },
  { k:'formIntro', label:translate(lang,'nav.student.form'), icon:'edit', badge:'!' },
  { k:'status', label:translate(lang,'nav.student.status'), icon:'clock' },
  { k:'history', label:translate(lang,'nav.student.history'), icon:'history' },
];

const NAV = (lang)=>({
  student: [],
  officer: [
    { section:translate(lang,'nav.section.overview') },
    { k:'dashboard', label:translate(lang,'nav.officer.dashboard'), icon:'grid' },
    { k:'review', label:translate(lang,'nav.officer.review'), icon:'checkCircle', badge:'29' },
    { k:'students', label:translate(lang,'nav.officer.students'), icon:'users' },
    { k:'import', label:'นำเข้ารายชื่อนักศึกษา', icon:'upload' },
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
  if(!role) return <><Login onLogin={handleLogin} /><TweaksUI t={t} setTweak={setTweak} /></>;

  const nav = role==='student' ? navStudent(lang) : NAV(lang)[role];
  const go = (p, step=0)=>{ setPage(p); setFormStep(step); window.scrollTo(0,0); };
  // ไม่มีสลับ role ปลอมอีกแล้ว — 'logout' คือทางเดียวที่เหลือ เคลียร์ token จริงด้วย
  const switchRole = (r)=>{ if(r==='logout'){ clearSession(); setRole(null); setCurrentUser(null); return; } };

  const render = ()=>{
    if(role==='student'){
      if(page==='news') return <StudentNewsReal go={go} />;
      if(page==='formIntro') return <FormIntro go={go} lang={lang} />;
      if(page==='form') return <ExamFormReal go={go} toast={showToast} />;
      if(page==='status') return <StudentStatusReal go={go} />;
      if(page==='history') return <StudentHistoryReal go={go} />;
    }
    if(role==='officer'){
      if(page==='dashboard') return <DashboardReal go={go} />;
      if(page==='review') return <OfficerReviewReal go={go} setSel={setSel} />;
      if(page==='students') return <OfficerStudentsReal go={go} setSel={setSel} />;
      if(page==='import') return <StudentImport toast={showToast} />;
      if(page==='detail') return <StudentDetailReal student={sel} go={go} toast={showToast} />;
      if(page==='rounds') return <ManageRoundsSubjectsReal toast={showToast} />;
      if(page==='usermgmt') return <ManageUsersReal toast={showToast} currentUserId={currentUser?.id} />;
      if(page==='newsmgmt') return <ManageNewsReal toast={showToast} />;
      if(page==='reports') return <ReportsReal toast={showToast} />;
    }
    if(role==='executive'){
      if(page==='dashboard') return <DashboardReal go={go} readonly />;
      if(page==='students') return <OfficerStudentsReal go={go} setSel={setSel} />;
      if(page==='detail') return <StudentDetailReal student={sel} go={go} toast={showToast} readonly />;
      if(page==='reports') return <ReportsReal toast={showToast} readonly />;
    }
    return <Empty title="ไม่พบหน้าที่ต้องการ" />;
  };

  const activeNav = page==='detail' ? 'students' : page;

  return (
    <div data-density={t.density}>
      <TopBar role={role} roleLabel={translate(lang,'role.'+role)}
        user={{ firstName: currentUser?.name || '', lastName: '' }}
        onMenu={()=>setSbOpen(true)} onSwitchRole={switchRole}
        lang={lang} setLang={setLang} />
      <div className="app-shell">
        <Sidebar items={nav} active={activeNav} onNav={go} open={sbOpen} onClose={()=>setSbOpen(false)}
          footer={<div className="card" style={{ padding:'12px 13px', background:'var(--ink-50)', border:'1px solid var(--ink-200)', boxShadow:'none' }}>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <div style={{ width:32, height:32, borderRadius:9, background:'var(--navy-700)', color:'var(--gold-500)', display:'flex', alignItems:'center', justifyContent:'center', flex:'none' }}><Icon name="shield" size={17}/></div>
              <div style={{ fontSize:11.5, color:'var(--ink-500)', lineHeight:1.35 }}>{translate(lang,'sidebar.footerPrefix')}<br/><b style={{ color:'var(--ink-800)', fontSize:12.5 }}>{translate(lang,'role.'+role)}</b></div>
            </div>
          </div>} />
        <main className="app-main">
          <div className="app-content">{render()}</div>
        </main>
      </div>
      <Toast toast={toast} />
      <TweaksUI t={t} setTweak={setTweak} role={role} />
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
