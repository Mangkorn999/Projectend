/* ============================================================
   Shared UI components (React, global scope)
   ============================================================ */
const { useState, useEffect, useRef, useMemo } = React;

/* ---- Status badge ---- */
function StatusBadge({ status, size }) {
  const s = STATUS[status] || STATUS.DRAFT;
  return <span className={'badge '+s.key} style={ size==='lg'?{fontSize:13.5,padding:'6px 13px'}:null }>
    <span className="dot"></span>{s.label}</span>;
}
function PassBadge({ passed }) {
  if (passed===null||passed===undefined) return <span className="badge draft"><span className="dot"></span>—</span>;
  return passed
    ? <span className="badge pass"><span className="dot"></span>ผ่าน</span>
    : <span className="badge fail"><span className="dot"></span>ไม่ผ่าน</span>;
}

/* ---- Avatar ---- */
function Avatar({ name, size = 38, bg }) {
  const init = (name||'?').trim().charAt(0);
  return <span className="avatar" style={{ width:size, height:size, fontSize:size*0.42, background:bg }}>{init}</span>;
}

/* ---- App shell: TopBar ---- */
function TopBar({ role, roleLabel, user, onMenu, onSwitchRole, notif=3 }) {
  const [open, setOpen] = useState(false);
  const roles = [
    { k:'student', label:'นักศึกษา', icon:'graduation' },
    { k:'officer', label:'เจ้าหน้าที่คณะ', icon:'shield' },
    { k:'executive', label:'ผู้บริหารคณะ', icon:'chart' },
    { k:'admin', label:'ผู้ดูแลระบบ', icon:'key' },
  ];
  return (
    <header style={{ height:'var(--header-h)', background:'#fff', borderBottom:'1px solid var(--ink-200)',
      display:'flex', alignItems:'center', gap:16, padding:'0 18px 0 16px', position:'sticky', top:0, zIndex:40 }}>
      <button className="btn btn-ghost btn-sm only-mobile" style={{ padding:8, border:'none' }} onClick={onMenu}>
        <Icon name="menu" />
      </button>
      <div className="only-desktop"><Logo /></div>
      <div className="only-desktop" style={{ flexDirection:'column', justifyContent:'center', lineHeight:1.15, whiteSpace:'nowrap' }}>
        <div style={{ fontWeight:800, fontSize:14.5, color:'var(--navy-700)' }}>ระบบบันทึกใบอนุญาตประกอบวิชาชีพ</div>
        <div style={{ fontSize:11.5, color:'var(--ink-500)', fontWeight:500 }}>คณะพยาบาลศาสตร์ · มหาวิทยาลัยสงขลานครินทร์</div>
      </div>
      <div style={{ flex:1 }}></div>
      <button className="btn btn-ghost btn-sm" style={{ position:'relative', padding:9, border:'1px solid var(--ink-200)' }}>
        <Icon name="bell" size={19} />
        {notif>0 && <span style={{ position:'absolute', top:5, right:5, width:8, height:8, borderRadius:'50%',
          background:'var(--fail)', boxShadow:'0 0 0 2px #fff' }}></span>}
      </button>
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
            <div style={{ padding:'8px 10px 10px', borderBottom:'1px solid var(--ink-100)', marginBottom:6 }}>
              <div style={{ fontSize:11, color:'var(--ink-500)', fontWeight:600, marginBottom:7 }}>สลับมุมมองบทบาท (เดโม)</div>
              <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                {roles.map(r=>(
                  <button key={r.k} onClick={()=>{ onSwitchRole(r.k); setOpen(false); }}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 9px', borderRadius:8, border:'none',
                      background: r.k===role?'var(--blue-50)':'transparent', textAlign:'left', width:'100%',
                      color: r.k===role?'var(--navy-700)':'var(--ink-700)', fontWeight: r.k===role?700:500, fontSize:13.5 }}>
                    <Icon name={r.icon} size={17} /> {r.label}
                    {r.k===role && <Icon name="check" size={15} style={{ marginLeft:'auto', color:'var(--blue-600)' }} />}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={()=>onSwitchRole('logout')} style={{ display:'flex', alignItems:'center', gap:10,
              padding:'8px 9px', borderRadius:8, border:'none', background:'transparent', width:'100%', textAlign:'left',
              color:'var(--ink-600)', fontSize:13.5, fontWeight:500 }}>
              <Icon name="logout" size={17} /> ออกจากระบบ
            </button>
          </div>
        </>}
      </div>
    </header>
  );
}

/* ---- Sidebar nav ---- */
function Sidebar({ items, active, onNav, open, onClose, footer }) {
  return (
    <>
      {open && <div className="only-mobile" onClick={onClose}
        style={{ position:'fixed', inset:0, background:'rgba(12,31,61,.4)', zIndex:45 }}></div>}
      <aside className={'app-sidebar'+(open?' open':'')}>
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
    </>
  );
}

/* ---- KPI stat card ---- */
function StatCard({ icon, label, value, sub, tone='navy', onClick, accent }) {
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
function Donut({ segments, size=180, thickness=26, center }) {
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
function BarRow({ label, value, max=100, color='var(--navy-600)', right, sub }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:10 }}>
        <span style={{ fontSize:13.5, color:'var(--ink-700)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>
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
function ColumnChart({ data, height=160, color='var(--navy-600)', fmt=(v)=>v }) {
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
function LineChart({ points, height=150, color='var(--navy-600)', suffix='%' }) {
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
          <text x={xs(i)} y={ys(p.value)-12} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ink-800)" fontFamily="Sarabun">{p.value}{suffix}</text>
          <text x={xs(i)} y={height-6} textAnchor="middle" fontSize="11" fill="var(--ink-500)" fontFamily="Sarabun">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

/* ---- Multi-series line chart (compare series over categories) ---- */
function MultiLineChart({ series, categories, height=180, suffix='%', yMin=0, yMax=100 }) {
  const w=340, padL=10, padR=10, padT=24, padB=26;
  const n = categories.length;
  const xs = i => padL + (n===1?0:i*(w-padL-padR)/(n-1));
  const ys = v => padT + (1-(v-yMin)/(yMax-yMin))*(height-padT-padB);
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ overflow:'visible' }}>
        {[0,25,50,75,100].map(g=>(<line key={g} x1={padL} x2={w-padR} y1={ys(g)} y2={ys(g)} stroke="var(--ink-100)" strokeWidth="1" />))}
        {series.map((s,si)=>{
          const path = s.values.map((v,i)=>`${i?'L':'M'}${xs(i)},${ys(v)}`).join(' ');
          return <g key={si}>
            <path d={path} fill="none" stroke={s.color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            {s.values.map((v,i)=>(<g key={i}>
              <circle cx={xs(i)} cy={ys(v)} r="4.5" fill="#fff" stroke={s.color} strokeWidth="2.6" />
              <text x={xs(i)} y={ys(v)-11} textAnchor="middle" fontSize="11.5" fontWeight="700" fill={s.color} fontFamily="Sarabun">{v}{suffix}</text>
            </g>))}
          </g>;
        })}
        {categories.map((c,i)=>(<text key={i} x={xs(i)} y={height-7} textAnchor="middle" fontSize="11.5" fill="var(--ink-500)" fontFamily="Sarabun">{c}</text>))}
      </svg>
      <div style={{ display:'flex', gap:18, justifyContent:'center', marginTop:8 }}>
        {series.map((s,i)=>(<div key={i} style={{ display:'flex', alignItems:'center', gap:7, fontSize:12.5, color:'var(--ink-600)' }}>
          <span style={{ width:14, height:3, borderRadius:2, background:s.color }}></span>{s.label}</div>))}
      </div>
    </div>
  );
}

/* ---- Page header ---- */
function PageHead({ title, sub, actions, crumb }) {
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
function Toast({ toast }) {
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
function useToast(){
  const [toast,setToast]=useState(null);
  const show=(msg,type='success')=>{ setToast({msg,type}); clearTimeout(window.__t); window.__t=setTimeout(()=>setToast(null),2600); };
  return [toast,show];
}

/* ---- Modal ---- */
function Modal({ open, onClose, title, children, footer, width=480, tone }) {
  if(!open) return null;
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(12,31,61,.45)', zIndex:150,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(2px)' }}>
      <div className="card fade-up" onClick={e=>e.stopPropagation()} style={{ width, maxWidth:'100%', maxHeight:'90vh',
        overflow:'auto', boxShadow:'var(--sh-lg)', borderRadius:16 }}>
        {title && <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--ink-100)', display:'flex',
          alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <h3 style={{ margin:0, fontSize:17, fontWeight:800, color: tone||'var(--ink-900)' }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" style={{ padding:7, border:'none' }} onClick={onClose}><Icon name="x" size={18} /></button>
        </div>}
        <div style={{ padding:'20px 22px' }}>{children}</div>
        {footer && <div style={{ padding:'14px 22px', borderTop:'1px solid var(--ink-100)', display:'flex',
          justifyContent:'flex-end', gap:10, background:'var(--ink-50)', borderRadius:'0 0 16px 16px' }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ---- Empty state ---- */
function Empty({ icon='doc', title, sub, action }) {
  return <div className="empty">
    <div className="ico"><Icon name={icon} size={26} /></div>
    <div style={{ fontWeight:700, color:'var(--ink-700)', fontSize:15.5 }}>{title}</div>
    {sub && <div style={{ marginTop:5, fontSize:13.5 }}>{sub}</div>}
    {action && <div style={{ marginTop:16 }}>{action}</div>}
  </div>;
}

/* ---- Stepper ---- */
function Stepper({ steps, current }) {
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
              <span style={{ fontSize:12, fontWeight: on?700:500, color: on?'var(--navy-700)':done?'var(--ink-700)':'var(--ink-400)',
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

Object.assign(window, { StatusBadge, PassBadge, Avatar, TopBar, Sidebar, StatCard,
  Donut, BarRow, ColumnChart, LineChart, MultiLineChart, PageHead, Toast, useToast, Modal, Empty, Stepper });
