/* ============================================================
   Super Admin screens — system control
   ============================================================ */
import { useState } from 'react';
import { Icon, YEARS, YEARLY, YEAR_COMPARE } from './data.jsx';
import { PageHead, Avatar, Modal, MultiLineChart } from './components.jsx';
import { t, pick } from './i18n.js';

const ALL_USERS = [
  { id:1, name:'ธัญเทพ จิ้วตั้น', email:'6610210631@psu.ac.th', role:'student', sub:'ห้อง B · ปี 2569', sub_en:'Room B · Year 2026', active:true },
  { id:2, name:'ฉันท์ชนก ทองรัดแก้ว', email:'6610210559@psu.ac.th', role:'student', sub:'ห้อง A · ปี 2569', sub_en:'Room A · Year 2026', active:true },
  { id:3, name:'สมหญิง ใจดี', email:'somying.j@psu.ac.th', role:'officer', sub:'งานบริการการศึกษา', sub_en:'Student Affairs Office', active:true },
  { id:4, name:'ประเสริฐ มั่นคง', email:'prasert.m@psu.ac.th', role:'officer', sub:'งานทะเบียน', sub_en:'Registrar Office', active:true },
  { id:5, name:'รศ.ดร. สุนิสา ฉัตรมงคล', email:'sunisa.c@psu.ac.th', role:'executive', sub:'คณบดี', sub_en:'Dean', active:true },
  { id:6, name:'ผศ.ดร. กิตย์ศิริ ช่อเจี้ยง', email:'kitsiri.c@psu.ac.th', role:'executive', sub:'รองคณบดีฝ่ายวิชาการ', sub_en:'Associate Dean for Academic Affairs', active:true },
  { id:7, name:'ศูนย์คอมพิวเตอร์ (Admin)', email:'admin@nur.psu.ac.th', role:'admin', sub:'ผู้ดูแลระบบ', sub_en:'System Administrator', active:true },
  { id:8, name:'วิภา เกษมสุข', email:'wipha.k@psu.ac.th', role:'officer', sub:'งานบริการการศึกษา', sub_en:'Student Affairs Office', active:false },
];
const ROLE_META = {
  student:   { icon:'graduation', color:'var(--navy-700)', bg:'var(--blue-50)' },
  officer:   { icon:'shield', color:'#0d7a6e', bg:'#e3f5f1' },
  executive: { icon:'chart', color:'var(--blue-600)', bg:'var(--blue-50)' },
  admin:     { icon:'settings', color:'#fff', bg:'var(--navy-700)' },
};
const AUDIT = [
  { id:1, who:'สมหญิง ใจดี', role:'officer', action:'ยืนยันผลสอบ', action_en:'Confirmed results', target:'นักศึกษา 6610210559', target_en:'Student 6610210559', time:'5 มิ.ย. 2569 14:32', time_en:'Jun 5, 2026 14:32', tone:'ok' },
  { id:2, who:'สมหญิง ใจดี', role:'officer', action:'ตีกลับผลสอบ', action_en:'Rejected results', target:'นักศึกษา 6610210480 — เอกสารไม่ชัด', target_en:'Student 6610210480 — unclear documents', time:'5 มิ.ย. 2569 14:18', time_en:'Jun 5, 2026 14:18', tone:'reject' },
  { id:3, who:'ธัญเทพ จิ้วตั้น', role:'student', action:'ส่งผลสอบ', action_en:'Submitted results', target:'รอบ 1/2569', target_en:'Round 1/2026', time:'5 มิ.ย. 2569 10:30', time_en:'Jun 5, 2026 10:30', tone:'wait' },
  { id:4, who:'ศูนย์คอมพิวเตอร์', role:'admin', action:'เปิดรอบการกรอก', action_en:'Opened submission round', target:'รอบ 1/2569', target_en:'Round 1/2026', time:'1 มิ.ย. 2569 09:00', time_en:'Jun 1, 2026 09:00', tone:'navy' },
  { id:5, who:'ประเสริฐ มั่นคง', role:'officer', action:'เพิ่มผู้บริหาร', action_en:'Added executive account', target:'อ. วรินทร เพชรรัตน์', target_en:'Instr. Warin Phetcharat', time:'30 พ.ค. 2569 16:05', time_en:'May 30, 2026 16:05', tone:'navy' },
  { id:6, who:'ศูนย์คอมพิวเตอร์', role:'admin', action:'เพิ่มรายวิชา', action_en:'Added subject', target:'NLE8 กฎหมายและจรรยาบรรณ', target_en:'NLE8 Nursing Law & Ethics', time:'28 พ.ค. 2569 11:20', time_en:'May 28, 2026 11:20', tone:'navy' },
];

/* ---------- Admin Dashboard ---------- */
export function AdminDashboard({ go, lang='TH' }) {
  const counts = { student:0, officer:0, executive:0, admin:0 };
  ALL_USERS.filter(u=>u.active).forEach(u=>counts[u.role]++);
  const statusRows = [
    ['admin.statusServer','admin.statusNormal','ok'],
    ['admin.statusDb','admin.statusNormal','ok'],
    ['admin.statusCouncil','admin.statusNotConnected','wait'],
    ['admin.statusStorage','admin.storageValue','navy'],
  ];
  return (
    <div className="fade-up">
      <PageHead title={t(lang,'admin.dashboard.title')} sub={t(lang,'admin.dashboard.sub')}
        crumb={<span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><Icon name="settings" size={14}/> Super Admin</span>}
        actions={<button className="btn btn-primary" onClick={()=>go('users')}><Icon name="users" size={17}/> {t(lang,'admin.manageUsersBtn')}</button>} />

      {/* user counts by role */}
      <div className="grid g-4" style={{ marginBottom:20 }}>
        {Object.entries(ROLE_META).map(([k,m])=>(
          <div key={k} className="card" style={{ padding:'18px', cursor:'pointer' }} onClick={()=>go('users')}
            onMouseEnter={e=>{e.currentTarget.style.boxShadow='var(--sh-md)';e.currentTarget.style.transform='translateY(-2px)';}}
            onMouseLeave={e=>{e.currentTarget.style.boxShadow='var(--sh-sm)';e.currentTarget.style.transform='none';}}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:13, color:'var(--ink-500)', fontWeight:600, marginBottom:6 }}>{t(lang,'role.'+k)}</div>
                <div className="tnum" style={{ fontSize:30, fontWeight:800, lineHeight:1 }}>{k==='student'?'120':counts[k]}</div>
                <div style={{ fontSize:12, color:'var(--ink-500)', marginTop:6 }}>{t(lang,'admin.activeAccounts')}</div>
              </div>
              <div style={{ width:42, height:42, borderRadius:12, background:m.bg, color:m.color, display:'flex', alignItems:'center', justifyContent:'center', flex:'none' }}><Icon name={m.icon} size={22}/></div>
            </div>
          </div>
        ))}
      </div>

      <div className="row wrap-m" style={{ alignItems:'flex-start' }}>
        {/* recent audit */}
        <div className="card" style={{ flex:1, minWidth:0, overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--ink-100)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div><h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>{t(lang,'admin.recentAuditTitle')}</h3>
              <p style={{ margin:'3px 0 0', color:'var(--ink-500)', fontSize:13 }}>{t(lang,'admin.recentAuditSub')}</p></div>
            <button className="btn btn-ghost btn-sm" onClick={()=>go('audit')}>{t(lang,'admin.viewAll')} <Icon name="arrowR" size={15}/></button>
          </div>
          <div style={{ padding:'6px 8px' }}>
            {AUDIT.slice(0,5).map(a=>(
              <div key={a.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 12px', borderRadius:10 }}>
                <div style={{ width:32, height:32, borderRadius:8, flex:'none', display:'flex', alignItems:'center', justifyContent:'center',
                  background:`var(--status-${a.tone}-bg, var(--blue-50))`, color:`var(--status-${a.tone}-fg, var(--navy-700))` }}>
                  <Icon name={ROLE_META[a.role].icon} size={16}/></div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13.5 }}><b>{a.who}</b> · {pick(lang,a,'action')}</div>
                  <div style={{ fontSize:12, color:'var(--ink-500)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pick(lang,a,'target')}</div>
                </div>
                <div style={{ fontSize:11.5, color:'var(--ink-400)', flex:'none' }}>{pick(lang,a,'time')}</div>
              </div>
            ))}
          </div>
        </div>
        {/* system health */}
        <div style={{ width:300, flex:'none', display:'flex', flexDirection:'column', gap:16 }} className="exam-aside">
          <div className="card card-pad">
            <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:800 }}>{t(lang,'admin.systemStatusTitle')}</h3>
            {statusRows.map(([lk,vk,tone],i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 0', borderBottom: i<3?'1px solid var(--ink-100)':'none' }}>
                <span style={{ fontSize:13.5, color:'var(--ink-900)' }}>{t(lang,lk)}</span>
                <span className={'badge '+(tone==='ok'?'ok':tone==='wait'?'wait':'draft')} style={{ fontSize:12 }}><span className="dot"></span>{t(lang,vk)}</span>
              </div>
            ))}
          </div>
          <div className="card card-pad" style={{ background:'linear-gradient(150deg,var(--navy-700),var(--navy-900))', color:'#fff' }}>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:8 }}>
              <Icon name="shield" size={18} style={{ color:'var(--gold-500)' }}/>
              <span style={{ fontSize:13, opacity:.85, fontWeight:600 }}>{t(lang,'admin.securityTitle')}</span>
            </div>
            <div style={{ fontSize:13.5, opacity:.85, lineHeight:1.5 }}>{t(lang,'admin.securityNote')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- All-user management ---------- */
export function AdminUsers({ toast, lang='TH' }) {
  const [users, setUsers] = useState(ALL_USERS);
  const [role, setRole] = useState('ALL');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const filtered = users.filter(u=>(role==='ALL'||u.role===role) && (!q || (u.name+u.email).includes(q)));
  const toggle = (id)=>{ setUsers(us=>us.map(u=>u.id===id?{...u,active:!u.active}:u)); toast(t(lang,'admin.users.toggleToast'),'info'); };
  return (
    <div className="fade-up">
      <PageHead title={t(lang,'admin.users.title')} sub={t(lang,'admin.users.sub',{count:filtered.length})}
        crumb={<span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><Icon name="settings" size={14}/> Super Admin</span>}
        actions={<button className="btn btn-primary" onClick={()=>setModal({})}><Icon name="plus" size={17}/> {t(lang,'admin.users.addBtn')}</button>} />
      <div className="card" style={{ padding:14, marginBottom:18, display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:'1 1 220px' }}>
          <Icon name="search" size={18} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--ink-400)' }} />
          <input className="input" placeholder={t(lang,'admin.users.searchPh')} value={q} onChange={e=>setQ(e.target.value)} style={{ paddingLeft:40 }} />
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {['ALL','student','officer','executive','admin'].map(k=>(
            <button key={k} onClick={()=>setRole(k)} className="btn btn-sm" style={{
              background: role===k?'var(--navy-700)':'#fff', color: role===k?'#fff':'var(--ink-900)',
              border:'1px solid '+(role===k?'var(--navy-700)':'var(--ink-200)') }}>{k==='ALL'?t(lang,'admin.users.filterAll'):t(lang,'role.'+k)}</button>
          ))}
        </div>
      </div>
      <div className="card" style={{ overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table className="tbl">
            <thead><tr><th>{t(lang,'admin.users.colUser')}</th><th>{t(lang,'admin.users.colRole')}</th><th>{t(lang,'admin.users.colDetail')}</th><th>{t(lang,'admin.users.colStatus')}</th><th></th></tr></thead>
            <tbody>{filtered.map(u=>{ const m=ROLE_META[u.role];
              return <tr key={u.id}>
                <td><div style={{ display:'flex', alignItems:'center', gap:11 }}><Avatar name={u.name} size={34} bg={m.color}/>
                  <div><div style={{ fontWeight:600, fontSize:14 }}>{u.name}</div>
                  <div className="mono" style={{ fontSize:12, color:'var(--ink-400)' }}>{u.email}</div></div></div></td>
                <td><span className="chip" style={{ background:m.bg, color:m.color, fontWeight:600 }}><Icon name={m.icon} size={13}/> {t(lang,'role.'+u.role)}</span></td>
                <td style={{ color:'var(--ink-600)', fontSize:13.5 }}>{pick(lang,u,'sub')}</td>
                <td>{u.active? <span className="badge ok"><span className="dot"></span>{t(lang,'admin.users.statusActive')}</span> : <span className="badge draft"><span className="dot"></span>{t(lang,'admin.users.statusSuspended')}</span>}</td>
                <td style={{ textAlign:'right', whiteSpace:'nowrap' }}>
                  <button className="btn btn-ghost btn-sm" style={{ padding:7, border:'none' }} onClick={()=>setModal(u)}><Icon name="edit" size={16}/></button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>toggle(u.id)}>{u.active?t(lang,'admin.users.suspendBtn'):t(lang,'admin.users.activateBtn')}</button>
                </td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </div>
      <Modal open={!!modal} onClose={()=>setModal(null)} title={modal?.id?t(lang,'admin.users.modalEditTitle'):t(lang,'admin.users.modalAddTitle')} width={460}
        footer={<><button className="btn btn-ghost" onClick={()=>setModal(null)}>{t(lang,'admin.users.cancelBtn')}</button>
          <button className="btn btn-primary" onClick={()=>{ setModal(null); toast(t(lang,'admin.users.saveToast')); }}>{t(lang,'admin.users.saveBtn')}</button></>}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field"><label>{t(lang,'admin.users.fieldEmail')}</label><input className="input" defaultValue={modal?.email} placeholder="name@psu.ac.th"/></div>
          <div className="field"><label>{t(lang,'admin.users.fieldRole')}</label>
            <select className="select" defaultValue={modal?.role||'officer'}>
              {Object.keys(ROLE_META).map(k=><option key={k} value={k}>{t(lang,'role.'+k)}</option>)}
            </select></div>
          <div className="field"><label>{t(lang,'admin.users.fieldSub')}</label><input className="input" defaultValue={modal?.sub} placeholder={t(lang,'admin.users.fieldSubPh')}/></div>
        </div>
      </Modal>
    </div>
  );
}

/* ---------- Audit log ---------- */
export function AdminAudit({ lang='TH' }) {
  const [role, setRole] = useState('ALL');
  const rows = AUDIT.filter(a=>role==='ALL'||a.role===role);
  return (
    <div className="fade-up">
      <PageHead title={t(lang,'admin.audit.title')} sub={t(lang,'admin.audit.sub')}
        crumb={<span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><Icon name="settings" size={14}/> Super Admin</span>}
        actions={<button className="btn btn-ghost"><Icon name="download" size={16}/> {t(lang,'admin.audit.exportBtn')}</button>} />
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {['ALL','student','officer','admin'].map(k=>(
          <button key={k} onClick={()=>setRole(k)} className="btn btn-sm" style={{
            background: role===k?'var(--navy-700)':'#fff', color: role===k?'#fff':'var(--ink-900)',
            border:'1px solid '+(role===k?'var(--navy-700)':'var(--ink-200)') }}>{k==='ALL'?t(lang,'admin.users.filterAll'):t(lang,'role.'+k)}</button>
        ))}
      </div>
      <div className="card" style={{ overflow:'hidden' }}>
        <table className="tbl">
          <thead><tr><th>{t(lang,'admin.audit.colTime')}</th><th>{t(lang,'admin.audit.colWho')}</th><th>{t(lang,'admin.audit.colAction')}</th><th>{t(lang,'admin.audit.colDetail')}</th></tr></thead>
          <tbody>{rows.map(a=>{ const m=ROLE_META[a.role];
            return <tr key={a.id}>
              <td className="mono" style={{ fontSize:12.5, color:'var(--ink-500)', whiteSpace:'nowrap' }}>{pick(lang,a,'time')}</td>
              <td><div style={{ display:'flex', alignItems:'center', gap:9 }}><span style={{ width:26, height:26, borderRadius:7, background:m.bg, color:m.color, display:'flex', alignItems:'center', justifyContent:'center', flex:'none' }}><Icon name={m.icon} size={14}/></span>
                <span style={{ fontWeight:600, fontSize:13.5 }}>{a.who}</span></div></td>
              <td><span className={'badge '+a.tone} style={{ fontSize:12 }}><span className="dot"></span>{pick(lang,a,'action')}</span></td>
              <td style={{ color:'var(--ink-600)', fontSize:13.5 }}>{pick(lang,a,'target')}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Multi-year data archive ---------- */
export function AdminArchive({ toast, lang='TH' }) {
  return (
    <div className="fade-up">
      <PageHead title={t(lang,'admin.archive.title')} sub={t(lang,'admin.archive.sub')}
        crumb={<span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><Icon name="settings" size={14}/> Super Admin</span>} />
      <div className="note-card" style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'14px 18px', background:'var(--blue-50)', borderRadius:13, marginBottom:20 }}>
        <Icon name="info" size={20} style={{ color:'var(--navy-600)', flex:'none', marginTop:1 }}/>
        <div style={{ fontSize:13.5, color:'var(--navy-700)' }}>
          <b>{t(lang,'admin.archive.tipLabel')}</b> {t(lang,'admin.archive.tipText')}
        </div>
      </div>
      <div className="grid g-3" style={{ marginBottom:20 }}>
        {YEARS.map((y,i)=>{ const d=YEARLY[y];
          return <div key={y} className="card card-pad">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <span style={{ fontSize:18, fontWeight:800 }}>{t(lang,'admin.archive.yearLabel',{year:y})}</span>
              {i===0 ? <span className="badge ok"><span className="dot"></span>{t(lang,'admin.archive.active')}</span> : <span className="badge draft"><span className="dot"></span>{t(lang,'admin.archive.archived')}</span>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:9, fontSize:13.5 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'var(--ink-500)' }}>{t(lang,'admin.archive.students')}</span><b className="tnum">{d.students} {t(lang,'admin.archive.unitPeople')}</b></div>
              <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'var(--ink-500)' }}>{t(lang,'admin.archive.firstAttempt')}</span><b className="tnum" style={{ color:'var(--navy-700)' }}>{d.firstAttempt}%</b></div>
              <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'var(--ink-500)' }}>{t(lang,'admin.archive.cumulative')}</span><b className="tnum" style={{ color:'var(--pass)' }}>{d.cumulative}%</b></div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={()=>toast(t(lang,'admin.archive.exportToast',{year:y}),'info')}><Icon name="download" size={15}/> {t(lang,'admin.archive.exportBtn')}</button>
              <button className="btn btn-ghost btn-sm" style={{ flex:1 }}><Icon name="eye" size={15}/> {t(lang,'admin.archive.viewBtn')}</button>
            </div>
          </div>;
        })}
      </div>
      <div className="card card-pad">
        <h3 style={{ margin:'0 0 4px', fontSize:16, fontWeight:800 }}>{t(lang,'admin.archive.trendTitle')}</h3>
        <p style={{ margin:'0 0 16px', color:'var(--ink-500)', fontSize:13 }}>{t(lang,'admin.archive.trendSub')}</p>
        <MultiLineChart height={200} width={900}
          categories={YEAR_COMPARE.map(d=>String(d.year))}
          series={[
            { label:t(lang,'executive.seriesFirst'), color:'var(--navy-600)', values:YEAR_COMPARE.map(d=>d.first) },
            { label:t(lang,'executive.seriesCumulative'), color:'var(--pass)', values:YEAR_COMPARE.map(d=>d.cumulative) },
          ]} />
      </div>
    </div>
  );
}

/* ---------- System settings ---------- */
export function AdminSettings({ toast, lang='TH' }) {
  const [council, setCouncil] = useState(false);
  const [retention, setRetention] = useState('forever');
  const retOptions = [
    ['forever','admin.settings.retForever','admin.settings.retForeverDesc'],
    ['10y','admin.settings.ret10y','admin.settings.ret10yDesc'],
    ['5y','admin.settings.ret5y','admin.settings.ret5yDesc'],
  ];
  return (
    <div className="fade-up">
      <PageHead title={t(lang,'admin.settings.title')} sub={t(lang,'admin.settings.sub')}
        crumb={<span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><Icon name="settings" size={14}/> Super Admin</span>}
        actions={<button className="btn btn-primary" onClick={()=>toast(t(lang,'admin.settings.saveToast'))}><Icon name="check" size={17}/> {t(lang,'admin.settings.saveBtn')}</button>} />
      <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
        <div className="card card-pad">
          <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:800 }}>{t(lang,'admin.settings.generalTitle')}</h3>
          <div className="grid g-2" style={{ gap:16 }}>
            <div className="field"><label>{t(lang,'admin.settings.currentYear')}</label><input className="input" defaultValue="2569"/></div>
            <div className="field"><label>{t(lang,'admin.settings.facultyName')}</label><input className="input" defaultValue="คณะพยาบาลศาสตร์"/></div>
          </div>
        </div>
        <div className="card card-pad">
          <h3 style={{ margin:'0 0 6px', fontSize:16, fontWeight:800 }}>{t(lang,'admin.settings.retentionTitle')}</h3>
          <p style={{ margin:'0 0 14px', color:'var(--ink-500)', fontSize:13 }}>{t(lang,'admin.settings.retentionSub')}</p>
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {retOptions.map(([k,lk,dk])=>(
              <label key={k} onClick={()=>setRetention(k)} style={{ display:'flex', alignItems:'flex-start', gap:11, padding:'12px 14px', borderRadius:11, cursor:'pointer',
                border:'1.5px solid '+(retention===k?'var(--navy-600)':'var(--ink-200)'), background: retention===k?'var(--blue-50)':'#fff' }}>
                <div style={{ width:18, height:18, borderRadius:'50%', flex:'none', marginTop:1, border:'2px solid '+(retention===k?'var(--navy-600)':'var(--ink-300)'), background: retention===k?'var(--navy-600)':'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {retention===k && <span style={{ width:7, height:7, borderRadius:'50%', background:'#fff' }}></span>}</div>
                <div><div style={{ fontWeight:700, fontSize:14 }}>{t(lang,lk)}</div><div style={{ fontSize:12.5, color:'var(--ink-500)' }}>{t(lang,dk)}</div></div>
              </label>
            ))}
          </div>
        </div>
        <div className="card card-pad">
          <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:800 }}>{t(lang,'admin.settings.connectionsTitle')}</h3>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, padding:'12px 0' }}>
            <div><div style={{ fontWeight:700, fontSize:14 }}>{t(lang,'admin.settings.autoFetchTitle')}</div>
              <div style={{ fontSize:12.5, color:'var(--ink-500)', marginTop:2 }}>{t(lang,'admin.settings.autoFetchSub')}</div></div>
            <button onClick={()=>setCouncil(c=>!c)} style={{ width:46, height:26, borderRadius:999, border:'none', cursor:'pointer', flex:'none',
              background: council?'var(--pass)':'var(--ink-300)', position:'relative', transition:'.2s' }}>
              <span style={{ position:'absolute', top:3, left: council?23:3, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'.2s', boxShadow:'var(--sh-sm)' }}></span>
            </button>
          </div>
          <div className="hr" style={{ margin:'4px 0' }}></div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, padding:'12px 0' }}>
            <div><div style={{ fontWeight:700, fontSize:14 }}>{t(lang,'admin.settings.ssoTitle')}</div>
              <div style={{ fontSize:12.5, color:'var(--ink-500)', marginTop:2 }}>{t(lang,'admin.settings.ssoSub')}</div></div>
            <span className="badge ok"><span className="dot"></span>{t(lang,'admin.settings.connected')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
