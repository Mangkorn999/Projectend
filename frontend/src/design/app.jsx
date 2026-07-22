/* ============================================================
   Main app — role routing, shell, tweaks
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { TopBar, Sidebar, Toast, useToast, Empty } from './components.jsx';
import { t as translate } from './i18n.js';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakColor } from './tweaks-panel.jsx';
import { Login } from './login.jsx';
import { StudentNews, ExamForm, StudentStatus, StudentHistory } from './student.jsx';
import { OfficerDashboard, OfficerReview, OfficerStudents, StudentDetail } from './officer.jsx';
import { ManageRoundsSubjects, ManageUsers, ManageNews } from './officer-manage.jsx';
import { ExecutiveDashboard, Reports } from './executive.jsx';
import { AdminDashboard, AdminUsers, AdminAudit, AdminArchive, AdminSettings } from './admin.jsx';

const TWEAK_DEFAULTS = {
  examFormStyle: 'toggle',
  dashboardStyle: 'kpi',
  accent: '#faf5e8',
  autosave: true,
  density: 'regular',
};

const navStudent = (lang)=>[
  { k:'news', label:translate(lang,'nav.student.news'), icon:'news' },
  { k:'form', label:translate(lang,'nav.student.form'), icon:'edit', badge:'!' },
  { k:'status', label:translate(lang,'nav.student.status'), icon:'clock' },
  { k:'history', label:translate(lang,'nav.student.history'), icon:'history' },
];

const NAV = {
  student: [],
  officer: [
    { section:'ภาพรวม' },
    { k:'dashboard', label:'Dashboard', icon:'grid' },
    { k:'review', label:'ตรวจสอบ/ยืนยันผล', icon:'checkCircle', badge:'29' },
    { k:'students', label:'ข้อมูลนักศึกษา', icon:'users' },
    { section:'จัดการระบบ' },
    { k:'rounds', label:'รอบการกรอก & รายวิชา', icon:'calendar' },
    { k:'usermgmt', label:'ผู้ใช้งานผู้บริหาร', icon:'shield' },
    { k:'newsmgmt', label:'ข่าวสาร / ประกาศ', icon:'news' },
    { section:'รายงาน' },
    { k:'reports', label:'รายงานสรุป', icon:'report' },
  ],
  executive: [
    { k:'dashboard', label:'Dashboard', icon:'grid' },
    { k:'students', label:'ข้อมูลนักศึกษา', icon:'users' },
    { k:'reports', label:'รายงานสรุป', icon:'report' },
  ],
  admin: [
    { k:'dashboard', label:'ศูนย์ควบคุมระบบ', icon:'grid' },
    { k:'users', label:'จัดการผู้ใช้งาน', icon:'users' },
    { k:'audit', label:'บันทึกการใช้งาน', icon:'history' },
    { section:'ข้อมูล & ระบบ' },
    { k:'archive', label:'ข้อมูลย้อนหลังรายปี', icon:'calendar' },
    { k:'settings', label:'ตั้งค่าระบบ', icon:'settings' },
  ],
};
const ROLE_USER = {
  student:{ firstName:'ธัญเทพ', lastName:'จิ้วตั้น' },
  officer:{ firstName:'สมหญิง', lastName:'ใจดี' },
  executive:{ firstName:'สุนิสา', lastName:'ฉัตรมงคล' },
  admin:{ firstName:'ผู้ดูแล', lastName:'ระบบ' },
};
const DEFAULT_PAGE = { student:'news', officer:'dashboard', executive:'dashboard', admin:'dashboard' };

export function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [role, setRole] = useState(null);
  const [page, setPage] = useState('news');
  const [sel, setSel] = useState(null);
  const [sbOpen, setSbOpen] = useState(false);
  const [toast, showToast] = useToast();
  const [formStep, setFormStep] = useState(0);
  const [lang, setLang] = useState('TH'); // 'TH' | 'EN' — wired into student-side pages via i18n.js

  // accent override
  useEffect(()=>{ document.documentElement.style.setProperty('--gold-500', t.accent);
    document.documentElement.style.setProperty('--gold-600', shade(t.accent,-18)); }, [t.accent]);

  if(!role) return <><Login onLogin={r=>{ setRole(r); setPage(DEFAULT_PAGE[r]); }} /><TweaksUI t={t} setTweak={setTweak} /></>;

  const nav = role==='student' ? navStudent(lang) : NAV[role];
  const go = (p, step=0)=>{ setPage(p); setFormStep(step); window.scrollTo(0,0); };
  const switchRole = (r)=>{ if(r==='logout'){ setRole(null); return; } setRole(r); setPage(DEFAULT_PAGE[r]); setSel(null); };

  const render = ()=>{
    if(role==='student'){
      if(page==='news') return <StudentNews go={go} lang={lang} />;
      if(page==='form') return <ExamForm go={go} toast={showToast} tweaks={t} initialStep={formStep} lang={lang} />;
      if(page==='status') return <StudentStatus go={go} lang={lang} />;
      if(page==='history') return <StudentHistory go={go} lang={lang} />;
    }
    if(role==='officer'){
      if(page==='dashboard') return <OfficerDashboard go={go} tweaks={t} />;
      if(page==='review') return <OfficerReview go={go} setSel={setSel} toast={showToast} />;
      if(page==='students') return <OfficerStudents go={go} setSel={setSel} />;
      if(page==='detail') return <StudentDetail student={sel} go={go} toast={showToast} />;
      if(page==='rounds') return <ManageRoundsSubjects toast={showToast} />;
      if(page==='usermgmt') return <ManageUsers toast={showToast} />;
      if(page==='newsmgmt') return <ManageNews toast={showToast} />;
      if(page==='reports') return <Reports toast={showToast} />;
    }
    if(role==='executive'){
      if(page==='dashboard') return <ExecutiveDashboard go={go} tweaks={t} />;
      if(page==='students') return <OfficerStudents go={go} setSel={setSel} />;
      if(page==='detail') return <StudentDetail student={sel} go={go} toast={showToast} readonly />;
      if(page==='reports') return <Reports toast={showToast} />;
    }
    if(role==='admin'){
      if(page==='dashboard') return <AdminDashboard go={go} />;
      if(page==='users') return <AdminUsers toast={showToast} />;
      if(page==='audit') return <AdminAudit />;
      if(page==='archive') return <AdminArchive toast={showToast} />;
      if(page==='settings') return <AdminSettings toast={showToast} />;
    }
    return <Empty title="ไม่พบหน้าที่ต้องการ" />;
  };

  const activeNav = page==='detail' ? 'students' : page;

  return (
    <div data-density={t.density}>
      <TopBar role={role} roleLabel={translate(lang,'role.'+role)} user={ROLE_USER[role]} onMenu={()=>setSbOpen(true)} onSwitchRole={switchRole}
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
