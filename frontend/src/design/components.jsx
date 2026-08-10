/* ============================================================
   Shared UI components
   ============================================================ */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { STATUS, Icon } from './data.jsx';
import { Logo } from './logos.jsx';
import { t } from './i18n.js';

/* ---- Status badge ---- */
export function StatusBadge({ status, size, lang='TH' }) {
  const s = STATUS[status] || STATUS.DRAFT;
  return <span className={'badge '+s.key} style={ size==='lg'?{fontSize:13.5,padding:'6px 13px'}:null }>
    <span className="dot"></span>{t(lang,'status.'+status)}</span>;
}
export function PassBadge({ passed, lang='TH' }) {
  if (passed===null||passed===undefined) return <span className="badge draft"><span className="dot"></span>{t(lang,'pass.none')}</span>;
  return passed
    ? <span className="badge pass"><span className="dot"></span>{t(lang,'pass.true')}</span>
    : <span className="badge fail"><span className="dot"></span>{t(lang,'pass.false')}</span>;
}

/* ---- Avatar ---- */
export function Avatar({ name, size = 38, bg }) {
  const init = (name||'?').trim().charAt(0);
  return <span className="avatar" style={{ width:size, height:size, fontSize:size*0.42, background:bg }}>{init}</span>;
}

/* ---- Notifications per role ---- */
// mock data เดิม (ยังไม่มี backend endpoint จริง) — ปิดไว้ก่อน ให้ dropdown โชว์ empty state แทน
// const NOTIFS = {
//   officer: [
//     { icon:'checkCircle', tone:'wait', title:'มีนักศึกษาส่งผลสอบใหม่รอตรวจสอบ', sub:'6 รายการ · รอบ 1/2569', time:'10 นาทีที่แล้ว' },
//     { icon:'clock', tone:'reject', title:'รอบการกรอกใกล้ปิดรับสมัครแล้ว', sub:'รอบ 1/2569 · ปิดรับใน 4 วัน', time:'2 ชม. ที่แล้ว' },
//   ],
//   student: [
//     { icon:'xCircle', tone:'reject', title:'ผลสอบของคุณถูกตีกลับ', sub:'เอกสารหลักฐานไม่ชัดเจน กรุณาแก้ไขและส่งใหม่', time:'1 ชม. ที่แล้ว' },
//     { icon:'clock', tone:'wait', title:'รอบการกรอกใกล้ปิดรับสมัครแล้ว', sub:'รอบ 1/2569 · ปิดรับใน 4 วัน', time:'5 ชม. ที่แล้ว' },
//   ],
//   executive: [
//     { icon:'report', tone:'ok', title:'รายงานสรุปผลสอบรอบ 1/2569 พร้อมแล้ว', sub:'ยืนยันผลครบ 60 คน จาก 120 คน', time:'30 นาทีที่แล้ว' },
//   ],
// };
const NOTIFS = {};

/* ---- App shell: TopBar ---- */
// notifications: [{ notification_id, type, message, is_read, created_at }] — จริงจาก backend เฉพาะ role student ตอนนี้
// onOpenNotif: เรียกตอนเปิด modal ครั้งแรกที่มี unread ค้างอยู่ ให้ไป mark-all-read
export function TopBar({ role, roleLabel, user, onMenu, onSwitchRole, notif=0, lang='TH', setLang, langLoading=false, notifications=null, onOpenNotif }) {
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const openNotif = () => { setNotifOpen(true); onOpenNotif && onOpenNotif(); };
  return (
    <header style={{ height:'var(--header-h)', background:'#fff', borderBottom:'1px solid var(--ink-200)',
      display:'flex', alignItems:'center', gap:16, padding:'0 18px 0 16px', position:'sticky', top:0, zIndex:40 }}>
      <button className="btn btn-ghost btn-sm only-mobile" style={{ padding:8, border:'none' }} onClick={onMenu}>
        <Icon name="menu" />
      </button>
      <div className="only-desktop"><Logo /></div>
      <div className="only-desktop" style={{ flexDirection:'column', justifyContent:'center', lineHeight:1.15, whiteSpace:'nowrap' }}>
        <div style={{ fontWeight:800, fontSize:14.5, color:'var(--navy-700)' }}>{t(lang,'topbar.title')}</div>
        <div style={{ fontSize:11.5, color:'var(--ink-500)', fontWeight:500 }}>{t(lang,'topbar.subtitle')}</div>
      </div>
      <div style={{ flex:1 }}></div>
      {setLang && <div style={{ display:'inline-flex', background:'var(--ink-100)', borderRadius:999, padding:3, gap:3 }}>
        <button onClick={()=>setLang('TH')} style={{ border:'none', padding:'5px 12px', borderRadius:999, fontSize:12, fontWeight:700,
          fontFamily:'inherit', cursor:'pointer', transition:'.13s', display:'flex', alignItems:'center', justifyContent:'center', minWidth:22,
          background: lang==='TH'?'var(--navy-700)':'transparent', color: lang==='TH'?'#fff':'var(--ink-500)' }}>
          {langLoading && lang==='TH' ? <span className="lang-spinner"></span> : 'TH'}</button>
        <button onClick={()=>setLang('EN')} style={{ border:'none', padding:'5px 12px', borderRadius:999, fontSize:12, fontWeight:700,
          fontFamily:'inherit', cursor:'pointer', transition:'.13s', display:'flex', alignItems:'center', justifyContent:'center', minWidth:22,
          background: lang==='EN'?'var(--navy-700)':'transparent', color: lang==='EN'?'#fff':'var(--ink-500)' }}>
          {langLoading && lang==='EN' ? <span className="lang-spinner"></span> : 'EN'}</button>
      </div>}
      <button className="btn btn-ghost btn-sm" style={{ position:'relative', padding:9, border:'1px solid var(--ink-200)' }}
        onClick={openNotif}>
        <Icon name="bell" size={19} />
        {notif>0 && <span style={{ position:'absolute', top:5, right:5, width:8, height:8, borderRadius:'50%',
          background:'var(--fail)', boxShadow:'0 0 0 2px #fff' }}></span>}
      </button>
      <Modal open={notifOpen} onClose={()=>setNotifOpen(false)} title={t(lang,'topbar.notifTitle')} width={680}>
        {(notifications ?? NOTIFS[role])?.length > 0 ? (
          <div style={{ minHeight:440, display:'flex', flexDirection:'column', gap:10 }}>
            {(notifications ?? NOTIFS[role]).map((n,i,arr)=>{
              const tone = n.tone ?? (n.type==='rejected' ? 'reject' : n.type==='approved' ? 'ok' : 'wait');
              const icon = n.icon ?? (n.type==='rejected' ? 'xCircle' : n.type==='approved' ? 'checkCircle' : 'key');
              // backend คั่นบรรทัดรอง (เช่น "กรุณากรอกใหม่") ด้วย \n — แยกมาโชว์บางกว่าบรรทัดหลัก
              const [mainLine, ...subLines] = (n.title ?? n.message).split('\n');
              const sub = n.sub ?? subLines.join(' ');
              return (
              <div key={n.notification_id ?? i} style={{ display:'flex', alignItems:'flex-start', gap:13, padding:'13px 14px',
                border:'1px solid var(--ink-200)', borderRadius:12, background: n.is_read===false?'#fff':'var(--ink-50, #fafafa)', opacity: n.is_read===false?1:.7 }}>
                <div style={{ width:38, height:38, borderRadius:10, flex:'none', display:'flex', alignItems:'center', justifyContent:'center',
                  background:`var(--status-${tone}-bg)`, color:`var(--status-${tone}-fg)` }}><Icon name={icon} size={18}/></div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--ink-900)' }}>{mainLine}</div>
                  {sub && <div style={{ fontSize:12.5, fontWeight:400, color:'var(--ink-500)', marginTop:2 }}>{sub}</div>}
                </div>
                <div style={{ fontSize:11.5, color:'var(--ink-400)', flex:'none', whiteSpace:'nowrap' }}>
                  {n.time ?? (n.created_at && new Date(n.created_at).toLocaleString('th-TH'))}
                </div>
              </div>
            );})}
          </div>
        ) : (
          <div style={{ minHeight:440, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Empty icon="bell" title={t(lang,'topbar.notifEmptyTitle')} sub={t(lang,'topbar.notifEmptySub')} />
          </div>
        )}
      </Modal>
      <div style={{ position:'relative' }}>
        <button onClick={()=>setOpen(o=>!o)} className="btn btn-ghost" style={{ padding:'5px 8px 5px 5px', gap:9 }}>
          <Avatar name={user.firstName} size={32} />
          <div className="only-desktop" style={{ flexDirection:'column', justifyContent:'center', textAlign:'left', lineHeight:1.15 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--ink-900)' }}>{user.firstName} {user.lastName}</div>
            <div style={{ fontSize:11, color:'var(--ink-500)' }}>{roleLabel}</div>
          </div>
          <Icon name="chevD" size={16} style={{ color:'var(--ink-400)' }} />
        </button>
        {open && <>
          <div style={{ position:'fixed', inset:0, zIndex:50 }} onClick={()=>setOpen(false)}></div>
          <div className="card fade-up" style={{ position:'absolute', right:0, top:'calc(100% + 8px)', width:248,
            zIndex:51, boxShadow:'var(--sh-lg)', padding:8 }}>
            {/* role มาจาก JWT จริง ไม่มี dropdown ปลอมสลับ role อีกแล้ว — ออกจากระบบได้ทางเดียว */}
            <button onClick={()=>onSwitchRole('logout')} style={{ display:'flex', alignItems:'center', gap:10,
              padding:'8px 9px', borderRadius:8, border:'none', background:'transparent', width:'100%', textAlign:'left',
              color:'var(--ink-600)', fontSize:13.5, fontWeight:500 }}>
              <Icon name="logout" size={17} /> {t(lang,'topbar.logout')}
            </button>
          </div>
        </>}
      </div>
    </header>
  );
}

/* ---- Sidebar nav ---- */
export function Sidebar({ items, active, onNav, open, onClose, footer }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <>
      {open && <div className="only-mobile" onClick={onClose}
        style={{ position:'fixed', inset:0, background:'rgba(12,31,61,.4)', zIndex:45 }}></div>}
      <aside className={'app-sidebar'+(open?' open':'')+(collapsed?' collapsed':'')}>
        <nav style={{ padding:'14px 12px', display:'flex', flexDirection:'column', gap:2, flex:1, overflowY:'auto' }}>
          {items.map(it=> it.section
            ? <div key={it.section} className="sec-title" style={{ padding:'14px 10px 6px', fontSize:11 }}>{it.section}</div>
            : (
            <button key={it.k} onClick={()=>{ onNav(it.k); onClose&&onClose(); }}
              className={'nav-item'+(active===it.k?' active':'')}>
              <Icon name={it.icon} size={19} />
              <span>{it.label}</span>
              {it.badge ? <span className="nav-badge">{it.badge}</span> : null}
            </button>
          ))}
        </nav>
        {footer && <div style={{ padding:14, borderTop:'1px solid var(--ink-200)' }}>{footer}</div>}
      </aside>
      <button className="only-desktop sidebar-toggle" onClick={()=>setCollapsed(c=>!c)}>
        <Icon name={collapsed?'chevR':'chevL'} size={15} />
      </button>
    </>
  );
}

/* ---- KPI stat card ---- */
export function StatCard({ icon, label, value, sub, tone='navy', onClick, accent }) {
  const tones = {
    navy:['var(--navy-700)','var(--blue-50)'], wait:['var(--status-wait-dot)','var(--status-wait-bg)'],
    ok:['var(--status-ok-dot)','var(--status-ok-bg)'], reject:['var(--status-reject-dot)','var(--status-reject-bg)'],
    gold:['var(--gold-600)','var(--gold-50)'], blue:['var(--blue-600)','var(--blue-50)'],
  };
  const [fg,bg] = tones[tone]||tones.navy;
  return (
    <div className="card" onClick={onClick} style={{ padding:'18px 18px', cursor:onClick?'pointer':'default',
      transition:'.15s', position:'relative', overflow:'hidden' }}
      onMouseEnter={e=>{ if(onClick){e.currentTarget.style.boxShadow='var(--sh-md)'; e.currentTarget.style.transform='translateY(-2px)';}}}
      onMouseLeave={e=>{ e.currentTarget.style.boxShadow='var(--sh-sm)'; e.currentTarget.style.transform='none';}}>
      {accent && <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, background:fg }}></div>}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:13, color:'var(--ink-500)', fontWeight:600, marginBottom:6 }}>{label}</div>
          <div className="tnum" style={{ fontSize:30, fontWeight:800, color:'var(--ink-900)', lineHeight:1 }}>{value}</div>
          {sub && <div style={{ fontSize:12.5, color:'var(--ink-500)', marginTop:7 }}>{sub}</div>}
        </div>
        <div style={{ width:42, height:42, borderRadius:12, background:bg, color:fg, flex:'none',
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon name={icon} size={22} />
        </div>
      </div>
    </div>
  );
}

/* ---- Donut chart (SVG) ---- */
export function Donut({ segments, size=180, thickness=26, center }) {
  const total = segments.reduce((a,s)=>a+s.value,0) || 1;
  const R = (size-thickness)/2; const C = 2*Math.PI*R; let off = 0;
  return (
    <div style={{ position:'relative', width:size, height:size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="var(--ink-100)" strokeWidth={thickness} />
        {segments.map((s,i)=>{
          const len = s.value/total*C;
          const el = <circle key={i} cx={size/2} cy={size/2} r={R} fill="none" stroke={s.color}
            strokeWidth={thickness} strokeDasharray={`${len} ${C-len}`} strokeDashoffset={-off}
            strokeLinecap="butt" style={{ transition:'stroke-dasharray .6s' }} />;
          off += len; return el;
        })}
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', textAlign:'center' }}>
        {center}
      </div>
    </div>
  );
}

/* ---- Horizontal bar list (per-subject) ---- */
export function BarRow({ label, value, max=100, color='var(--navy-600)', right, sub }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:10 }}>
        <span style={{ fontSize:13.5, color:'var(--ink-900)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>
        <span className="tnum" style={{ fontSize:13.5, fontWeight:700, color:'var(--ink-900)', flex:'none' }}>{right}</span>
      </div>
      <div className="pbar" style={{ height:9 }}>
        <i style={{ width:(value/max*100)+'%', background:color }}></i>
      </div>
      {sub && <div style={{ fontSize:11.5, color:'var(--ink-400)' }}>{sub}</div>}
    </div>
  );
}

/* ---- Mini bar/line chart for trends ---- */
export function ColumnChart({ data, height=160, color='var(--navy-600)', fmt=(v)=>v }) {
  const max = Math.max(...data.map(d=>d.value), 1);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:14, height, padding:'0 4px' }}>
      {data.map((d,i)=>(
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:8, height:'100%', justifyContent:'flex-end' }}>
          <div className="tnum" style={{ fontSize:13, fontWeight:700, color:'var(--ink-800)' }}>{fmt(d.value)}</div>
          <div style={{ width:'100%', maxWidth:54, borderRadius:'8px 8px 0 0', background:d.color||color,
            height:(d.value/max*100)+'%', minHeight:6, transition:'height .6s cubic-bezier(.4,0,.2,1)' }}></div>
          <div style={{ fontSize:12, color:'var(--ink-500)', fontWeight:500, textAlign:'center' }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ---- Line/area chart (trend) ---- */
export function LineChart({ points, height=150, color='var(--navy-600)', suffix='%' }) {
  const w=320, pad=8;
  const max=Math.max(...points.map(p=>p.value)), min=Math.min(...points.map(p=>p.value));
  const range = Math.max(max-min, 1);
  const xs = i => pad + i*(w-pad*2)/(points.length-1);
  const ys = v => height-24 - ((v-min)/range)*(height-44);
  const path = points.map((p,i)=>`${i?'L':'M'}${xs(i)},${ys(p.value)}`).join(' ');
  const area = path+` L${xs(points.length-1)},${height-24} L${xs(0)},${height-24} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ overflow:'visible' }}>
      <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={color} stopOpacity=".22" /><stop offset="1" stopColor={color} stopOpacity="0" />
      </linearGradient></defs>
      <path d={area} fill="url(#lg)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p,i)=>(
        <g key={i}>
          <circle cx={xs(i)} cy={ys(p.value)} r="4.5" fill="#fff" stroke={color} strokeWidth="2.5" />
          <text x={xs(i)} y={ys(p.value)-12} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ink-800)" fontFamily="'LINE Seed Sans TH', sans-serif">{p.value}{suffix}</text>
          <text x={xs(i)} y={height-6} textAnchor="middle" fontSize="11" fill="var(--ink-500)" fontFamily="'LINE Seed Sans TH', sans-serif">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

/* ---- Multi-series line chart (compare series over categories) ---- */
export function MultiLineChart({ series, categories, height=180, suffix='%', yMin=0, yMax=100, width=340, legendSize=9 }) {
  const w=width, padL=26, padR=10, padT=14, padB=26;
  const n = categories.length;
  const xs = i => padL + (n===1?0:i*(w-padL-padR)/(n-1));
  const ys = v => padT + (1-(v-yMin)/(yMax-yMin))*(height-padT-padB);
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ overflow:'visible' }}>
        {[0,25,50,75,100].map(g=>(<g key={g}>
          <line x1={padL} x2={w-padR} y1={ys(g)} y2={ys(g)} stroke="var(--ink-100)" strokeWidth="1" />
          <text x={0} y={ys(g)+3} textAnchor="start" fontSize="7.5" fill="var(--ink-400)" fontFamily="'LINE Seed Sans TH', sans-serif">{g}{suffix}</text>
        </g>))}
        {series.map((s,si)=>{
          const path = s.values.map((v,i)=>`${i?'L':'M'}${xs(i)},${ys(v)}`).join(' ');
          return <g key={si}>
            <path d={path} fill="none" stroke={s.color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            {s.values.map((v,i)=>(<circle key={i} cx={xs(i)} cy={ys(v)} r="4.5" fill="#fff" stroke={s.color} strokeWidth="2.6" />))}
          </g>;
        })}
        {categories.map((c,i)=>(<text key={i} x={xs(i)} y={height-7} textAnchor="middle" fontSize="9" fill="var(--ink-500)" fontFamily="'LINE Seed Sans TH', sans-serif">{c}</text>))}
      </svg>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 18px', justifyContent:'center', marginTop:8 }}>
        {series.map((s,i)=>(<div key={i} style={{ display:'flex', alignItems:'center', gap:7, fontSize:legendSize, color:'var(--ink-600)' }}>
          <span style={{ width:14, height:3, borderRadius:2, background:s.color }}></span>{s.label}</div>))}
      </div>
    </div>
  );
}

/* ---- Page header ---- */
export function PageHead({ title, sub, actions, crumb }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:16, flexWrap:'wrap', marginBottom:22 }}>
      <div>
        {crumb && <div style={{ fontSize:12.5, color:'var(--ink-500)', fontWeight:600, marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>{crumb}</div>}
        <h1 style={{ margin:0, fontSize:23, fontWeight:800, color:'var(--ink-900)', letterSpacing:'-.01em' }}>{title}</h1>
        {sub && <p style={{ margin:'6px 0 0', color:'var(--ink-500)', fontSize:14 }}>{sub}</p>}
      </div>
      {actions && <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>{actions}</div>}
    </div>
  );
}

/* ---- Toast ---- */
export function Toast({ toast }) {
  if(!toast) return null;
  const map = { success:['ok','checkCircle'], error:['reject','xCircle'], info:['', 'info'] };
  const [cls,icon] = map[toast.type]||map.info;
  const tone = { success:'var(--status-ok-dot)', error:'var(--status-reject-dot)', info:'var(--navy-600)' }[toast.type];
  return (
    <div className="fade-up" style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:200,
      background:'var(--ink-900)', color:'#fff', padding:'13px 20px', borderRadius:12, boxShadow:'var(--sh-lg)',
      display:'flex', alignItems:'center', gap:11, fontSize:14, fontWeight:500, maxWidth:'90vw' }}>
      <Icon name={icon} size={20} style={{ color:tone }} /> {toast.msg}
    </div>
  );
}
export function useToast(){
  const [toast,setToast]=useState(null);
  const show=(msg,type='success')=>{ setToast({msg,type}); clearTimeout(window.__t); window.__t=setTimeout(()=>setToast(null),2600); };
  return [toast,show];
}

/* ---- Modal ---- */
export function Modal({ open, onClose, title, children, footer, width=480, tone }) {
  if(!open) return null;
  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(12,31,61,.45)', zIndex:150,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(2px)' }}>
      <div className="card fade-up" onClick={e=>e.stopPropagation()} style={{ width, maxWidth:'100%', maxHeight:'90vh',
        overflow:'auto', boxShadow:'var(--sh-lg)', borderRadius:16 }}>
        {title && <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--ink-100)', display:'flex',
          alignItems:'center', justifyContent:'center', gap:12, position:'relative' }}>
          <h3 style={{ margin:0, fontSize:17, fontWeight:800, color: tone||'var(--ink-900)', textAlign:'center' }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" style={{ padding:7, border:'none', position:'absolute', right:22, top:'50%', transform:'translateY(-50%)' }} onClick={onClose}><Icon name="x" size={18} /></button>
        </div>}
        <div style={{ padding:'20px 22px' }}>{children}</div>
        {footer && <div style={{ padding:'14px 22px', borderTop:'1px solid var(--ink-100)', display:'flex',
          justifyContent:'flex-end', gap:10, background:'var(--ink-50)', borderRadius:'0 0 16px 16px' }}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/* ---- Empty state ---- */
export function Empty({ icon='doc', title, sub, action }) {
  return <div className="empty">
    <div className="ico"><Icon name={icon} size={26} /></div>
    <div style={{ fontWeight:700, color:'var(--ink-900)', fontSize:15.5 }}>{title}</div>
    {sub && <div style={{ marginTop:5, fontSize:13.5 }}>{sub}</div>}
    {action && <div style={{ marginTop:16 }}>{action}</div>}
  </div>;
}

/* ---- Stepper ---- */
export function Stepper({ steps, current }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0 }}>
      {steps.map((s,i)=>{
        const done=i<current, on=i===current;
        return (
          <React.Fragment key={i}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:7, flex:'none' }}>
              <div style={{ width:34, height:34, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                fontWeight:700, fontSize:14, transition:'.2s',
                background: done?'var(--pass)':on?'var(--navy-700)':'#fff',
                color: (done||on)?'#fff':'var(--ink-400)',
                border: (done||on)?'none':'2px solid var(--ink-200)' }}>
                {done? <Icon name="check" size={17}/> : i+1}
              </div>
              <span style={{ fontSize:12, fontWeight: on?700:500, color: on?'var(--navy-700)':done?'var(--ink-900)':'var(--ink-400)',
                whiteSpace:'nowrap' }}>{s}</span>
            </div>
            {i<steps.length-1 && <div style={{ flex:1, height:2, margin:'0 6px', marginBottom:24,
              background: i<current?'var(--pass)':'var(--ink-200)', minWidth:24 }}></div>}
          </React.Fragment>
        );
      })}
    </div>
  );
}
