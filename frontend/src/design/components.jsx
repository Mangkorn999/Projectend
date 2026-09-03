/* ============================================================
   Shared UI components
   ============================================================ */
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { STATUS, Icon } from './data.jsx';
import { Logo } from './logos.jsx';
import { t, subjectName } from './i18n.js';

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

/* แจ้งเตือนของจริงประกอบที่ app.jsx (ดู design/notifications.js) แล้วส่งเข้า TopBar เป็น prop
   mock data ชุดเดิมลบทิ้งแล้ว */

/* ---- App shell: TopBar ---- */
// notifications: ทุกตัวถูกแปลงเป็นรูปเดียวกันที่ design/notifications.js แล้ว
//   { key, tone, icon, page, title, sub, at }
// onNotifOpen: เรียกตอนเปิด modal — ไป mark ว่าอ่านแล้วทั้งหมด (ทั้ง DB และ localStorage)
export function TopBar({ role, roleLabel, user, onMenu, onSwitchRole, notifications=[], unread=0, onNotifOpen, onNotifGo, lang='TH', setLang, langLoading=false }) {
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const openNotif = () => { setNotifOpen(true); onNotifOpen?.(); };
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
        {unread>0 && <span style={{ position:'absolute', top:5, right:5, width:8, height:8, borderRadius:'50%',
          background:'var(--fail)', boxShadow:'0 0 0 2px #fff' }}></span>}
      </button>
      <Modal open={notifOpen} onClose={()=>setNotifOpen(false)} title={t(lang,'topbar.notifTitle')} width={680}>
        {notifications.length ? (
          <div style={{ minHeight:440, display:'flex', flexDirection:'column', gap:10 }}>
            {notifications.map((n)=>(
              // การ์ดกดได้ — กดแล้วพาไปหน้าที่เกี่ยวข้อง (n.page) ที่ยังไม่อ่านพื้นขาวเต็ม อ่านแล้วจางลง
              <button key={n.key} onClick={()=>{ setNotifOpen(false); onNotifGo?.(n.page); }}
                style={{ display:'flex', alignItems:'flex-start', gap:13, padding:'13px 14px', width:'100%',
                  border:'1px solid var(--ink-200)', borderRadius:12, textAlign:'left', cursor:'pointer', fontFamily:'inherit',
                  background: n.is_read===false?'#fff':'var(--ink-50, #fafafa)', opacity: n.is_read===false?1:.7 }}>
                <div style={{ width:38, height:38, borderRadius:10, flex:'none', display:'flex', alignItems:'center', justifyContent:'center',
                  background:`var(--status-${n.tone}-bg)`, color:`var(--status-${n.tone}-fg)` }}><Icon name={n.icon} size={18}/></div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--ink-900)' }}>{n.title}</div>
                  {n.sub && <div style={{ fontSize:12.5, fontWeight:400, color:'var(--ink-500)', marginTop:2 }}>{n.sub}</div>}
                </div>
                <div style={{ fontSize:11.5, color:'var(--ink-400)', flex:'none', whiteSpace:'nowrap' }}>
                  {n.at ? new Date(n.at).toLocaleDateString(lang==='EN'?'en-GB':'th-TH') : ''}
                </div>
              </button>
            ))}
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
export function Donut({ segments, size=180, thickness=26, center, gap=2 }) {
  const total = segments.reduce((a,s)=>a+s.value,0) || 1;
  const R = (size-thickness)/2; const C = 2*Math.PI*R; let off = 0;
  // เว้นช่องว่างระหว่างชิ้น ไม่งั้นสีสองชิ้นที่ใกล้กันติดกันจนดูเป็นชิ้นเดียว
  // ชิ้นเดียวเต็มวง (หรือชิ้นสั้นกว่าช่องว่าง) ไม่ต้องเว้น ไม่งั้นจะเห็นเป็นรอยบากเปล่าๆ
  const drawn = segments.filter(s => s.value > 0).length;
  const pad = drawn > 1 ? gap : 0;
  return (
    <div style={{ position:'relative', width:size, height:size }}>
      <svg className="donut-spin-in" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="var(--ink-100)" strokeWidth={thickness} />
        {segments.map((s,i)=>{
          const len = s.value/total*C;
          const shown = len > pad ? len - pad : len;
          const el = <circle key={i} cx={size/2} cy={size/2} r={R} fill="none" stroke={s.color}
            strokeWidth={thickness} strokeDasharray={`${shown} ${C-shown}`} strokeDashoffset={-off}
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
// track = สีพื้นหลังของราง = ส่วนที่ "ยังไม่ถึง" ค่านี้
// อัตราผ่านส่งสีแดงมา ส่วนที่เหลือจะได้อ่านออกว่า "ไม่ผ่าน" — ไม่งั้น 0% จะเป็นรางเปล่า
// หน้าตาเหมือนกรณี "ไม่มีข้อมูล" จนแยกไม่ออก
export function BarRow({ label, value, max=100, color='var(--navy-600)', track, right, sub }) {
  const pct = value / max * 100;
  const failPct = 100 - pct;
  // เปิดหน้ามาแท่งค่อยๆ ไล่จาก 0 ไปค่าจริง — เขียวไล่จากซ้าย, แดง (track) ไล่จากขวา พร้อมกัน มาบรรจบกันตรงกลางพอดี
  // รอให้ animation เบลอเข้าของการ์ด (.blur-in ~.55s) จบก่อน ค่อยเริ่มไล่แท่ง ไม่งั้นไล่ทับตอนจอยังเบลออยู่ดูรีบ
  const [w, setW] = useState(0); // เขียว: 0 -> pct
  const [fw, setFw] = useState(0); // แดง (track): 0 -> failPct
  useEffect(() => {
    const id = setTimeout(() => { setW(pct); setFw(failPct); }, 600);
    return () => clearTimeout(id);
  }, [pct, failPct]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:10 }}>
        <span style={{ fontSize:13.5, color:'var(--ink-900)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>
        <span className="tnum" style={{ fontSize:13.5, fontWeight:700, color:'var(--ink-900)', flex:'none' }}>{right}</span>
      </div>
      <div className="pbar" style={{ height:9, position:'relative' }}>
        {track && <i style={{ position:'absolute', right:0, top:0, height:'100%', width:fw+'%', background:track }}></i>}
        <i style={{ position:'relative', width:w+'%', background:color }}></i>
      </div>
      {sub && <div style={{ fontSize:11.5, color:'var(--ink-400)' }}>{sub}</div>}
    </div>
  );
}

/* ---- ตารางผลสอบผ่านครั้งแรก จำแนกรายวิชา ----
   ตารางเอกสารเรียบๆ ไม่มีแถบสี/ป้ายเตือน/สีตัวเลข — อ่านง่ายและก๊อปลงรายงานได้ตรงๆ
   ตัวเลขทุกตัวมาจาก backend (firstAttemptBySubject) ตรงๆ ฝั่งนี้ไม่คิด % เอง
   ยกเว้นแถวรวมท้ายตารางที่เป็นการบวกคอลัมน์ธรรมดา
   ไม่มีคอลัมน์ "ยังไม่ส่งผล" แล้ว → ผ่าน% + ไม่ผ่าน% ของแต่ละวิชาจึงไม่ครบ 100% (ส่วนที่หายคือคนที่ไม่ได้ส่ง)
   บอกไว้ที่ footnote ใต้ตารางแล้ว ห้ามเอาออก */
export function FirstAttemptSubjectTable({ data, year, lang='TH' }) {
  const tt = (key, vars) => t(lang, key, vars);
  const [hoverRow, setHoverRow] = useState(null);

  if (!data || !data.cohort_total || data.subjects.length === 0) {
    return <div className="card card-pad"><Empty icon="doc" title={tt('firstBySubject.empty')} /></div>;
  }

  const { cohort_total: cohort, submitted, subjects,
    passed_all: passedAll, passed_all_rate: passedAllRate,
    failed_any: failedAny, failed_any_rate: failedAnyRate } = data;
  const rows = [...subjects].sort((a, b) => a.subject_code.localeCompare(b.subject_code));

  const BORDER = '1px solid var(--ink-200)';
  const HEAD = { padding: '7px 10px', fontWeight: 600, color: 'var(--ink-700)', fontSize: 12, border: BORDER };
  const NUM = { padding: '9px 10px', textAlign: 'right', whiteSpace: 'nowrap', border: BORDER };

  // ช่องจำนวน+ร้อยละคู่กัน — วิชาที่ไม่มีใครสอบขึ้นขีดแทน 0.00% (0% แปลว่าสอบแล้วตกหมด คนละเรื่อง)
  const Cell = ({ count, rate, bold, dash }) => (
    <>
      <td className="tnum" style={{ ...NUM, fontWeight: bold ? 700 : 500, color: 'var(--ink-900)' }}>
        {dash ? '—' : count}
      </td>
      <td className="tnum" style={{ ...NUM, fontWeight: bold ? 700 : 400, color: 'var(--ink-600)' }}>
        {dash ? '—' : rate.toFixed(2)}
      </td>
    </>
  );

  return (
    <div className="card card-pad">
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{tt('firstBySubject.title')}</h3>

      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 13, border: BORDER }}>
          <thead>
            {/* หัวตาราง 2 ชั้น: ชั้นบนคลุมกลุ่ม (สอบผ่าน/สอบไม่ผ่าน) ชั้นล่างแยกจำนวน/ร้อยละของแต่ละกลุ่ม */}
            <tr>
              <th rowSpan={2} style={{ ...HEAD, textAlign: 'left' }}>{tt('firstBySubject.colSubject')}</th>
              <th rowSpan={2} style={{ ...HEAD, textAlign: 'right' }}>{tt('firstBySubject.colCohort')}</th>
              <th colSpan={2} style={HEAD}>{tt('firstBySubject.colPass')}</th>
              <th colSpan={2} style={HEAD}>{tt('firstBySubject.colFail')}</th>
            </tr>
            <tr>
              {[0, 1].map(i => (
                <React.Fragment key={i}>
                  <th style={{ ...HEAD, textAlign: 'right', fontWeight: 500, fontSize: 11.5 }}>{tt('firstBySubject.colCount')}</th>
                  <th style={{ ...HEAD, textAlign: 'right', fontWeight: 500, fontSize: 11.5 }}>{tt('firstBySubject.colRate')}</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(s => {
              const noSat = s.sat === 0; // ไม่มีใครสอบวิชานี้เลย
              const hot = hoverRow === s.subject_id;
              return (
                <tr key={s.subject_id}
                  onMouseEnter={() => setHoverRow(s.subject_id)}
                  onMouseLeave={() => setHoverRow(null)}
                  style={{ background: hot ? 'var(--ink-50)' : 'transparent', transition: 'background .12s' }}>
                  <td style={{ padding: '9px 10px', border: BORDER }}>
                    <span className="mono" style={{ color: 'var(--ink-500)', marginRight: 8 }}>{s.subject_code}</span>
                    {subjectName(lang, s.subject_code, s.subject_name)}
                  </td>
                  <td className="tnum" style={{ ...NUM, color: 'var(--ink-900)' }}>{cohort}</td>
                  <Cell count={s.pass} rate={s.pass_rate} dash={noSat} />
                  <Cell count={s.fail} rate={s.fail_rate} dash={noSat} />
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {/* แถวรวม — นับเป็น "คน" ไม่ใช่บวกคอลัมน์รายวิชา (backend คำนวณมาให้)
                ผ่าน = ผ่านครบทุกวิชา · ไม่ผ่าน = ส่งผลแล้วแต่ตกอย่างน้อย 1 วิชา
                ตัวหนาพอให้แยกออกจากแถวปกติ ไม่ใส่สีพื้นหลัง */}
            <tr>
              <td style={{ padding: '10px', fontWeight: 700, border: BORDER }}>{tt('firstBySubject.rowTotal')}</td>
              <td className="tnum" style={{ ...NUM, fontWeight: 700, color: 'var(--ink-900)' }}>{cohort}</td>
              <Cell count={passedAll} rate={passedAllRate} bold />
              <Cell count={failedAny} rate={failedAnyRate} bold />
            </tr>
          </tfoot>
        </table>
      </div>

      <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--ink-500)' }}>
        {tt('firstBySubject.footnote', { year, submitted, total: cohort })}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ink-400)' }}>
        {tt('firstBySubject.councilNote')}
      </p>
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
  const [hover, setHover] = useState(null); // { si, i, x, y } — x/y เป็น % ของกล่อง ใช้จัดตำแหน่ง tooltip
  // กดปีในตำนานด้านล่าง — ดันเส้นปีนั้นไปวาดทีหลังสุด (SVG วาดทับกันตามลำดับใน DOM หลังสุด = อยู่บนสุด)
  const [front, setFront] = useState(null); // index ใน series ที่ถูกดันขึ้นบน หรือ null = ไม่มี
  // เส้นค่อยๆ เลื้อยจากซ้ายไปขวา (วิชาที่ 1 → 8) แทนโผล่มาเต็มเส้นทันที
  // ใช้ stroke-dasharray/dashoffset ตามความยาวเส้นจริง (getTotalLength) ถึงจะไล่ตามรูปเส้นได้แม่นยำ ไม่ใช่แค่กว้างตาม x
  const [drawn, setDrawn] = useState(false);
  const [lengths, setLengths] = useState([]); // ความยาวเส้นจริงของแต่ละ series
  const pathRefs = useRef([]);
  const w=width, padL=26, padR=10, padT=14, padB=26;
  const n = categories.length;
  const xs = i => padL + (n===1?0:i*(w-padL-padR)/(n-1));
  const ys = v => padT + (1-(v-yMin)/(yMax-yMin))*(height-padT-padB);

  // ทำครั้งเดียวตอน mount เท่านั้น (deps ว่าง) — series/categories ที่ parent ส่งมาสร้างใหม่ทุก render (.map() สดๆ)
  // ถ้าผูก deps ไว้ animation จะรีเซ็ตกลับไปเริ่มใหม่ทุกครั้งที่ parent re-render เฉยๆ เลื้อยไม่จบซะที
  useEffect(() => {
    setLengths(pathRefs.current.map(p => p ? p.getTotalLength() : 0));
    // รอเบลอเข้าของการ์ด (.blur-in ~.55s) จบก่อน ค่อยเริ่มเลื้อย เหมือน BarRow
    const id = setTimeout(() => setDrawn(true), 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
    <div style={{ position:'relative' }}>
      <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ overflow:'visible' }}>
        {[0,25,50,75,100].map(g=>(<g key={g}>
          <line x1={padL} x2={w-padR} y1={ys(g)} y2={ys(g)} stroke="var(--ink-100)" strokeWidth="1" />
          <text x={0} y={ys(g)+3} textAnchor="start" fontSize="7.5" fill="var(--ink-400)" fontFamily="'LINE Seed Sans TH', sans-serif">{g}{suffix}</text>
        </g>))}
        {/* วาดตามลำดับ order ไม่ใช่ลำดับ series ตรงๆ — ตัวที่ถูกกด (front) ย้ายไปวาดหลังสุดเสมอ
            เก็บ si เดิมไว้ (ไม่ใช่ index ใหม่) เพราะ pathRefs/lengths/hover ผูกกับ index เดิมของ series อยู่ */}
        {[...series.keys()].sort((a,b) => (a===front?1:0) - (b===front?1:0)).map(si=>{
          const s = series[si];
          // ค่าเป็น null = ไม่มีข้อมูลจุดนั้น (เช่น ปีนั้นไม่ได้เปิดสอบวิชานี้) — ข้ามไปเลย ไม่วาดจุด ไม่ลากไปหา 0
          // เส้นจึงต่อตรงจากจุดที่มีข้อมูลไปจุดถัดไปที่มีข้อมูล ข้ามช่องที่ไม่มีไปเฉยๆ
          const pts = s.values.map((v,i)=> v==null ? null : [xs(i), ys(v), i]).filter(Boolean);
          const path = pts.map(([x,y],idx)=>`${idx?'L':'M'}${x},${y}`).join(' ');
          // ก่อนวัดความยาวจริงเสร็จ (frame แรกสุด) ต้องใช้เลขที่ใหญ่พอ ไม่ใช่ 0 —
          // เพราะ dasharray:0 = ปิดการทำ dash ไปเลย เส้นจะโผล่เต็มมาแวบหนึ่งก่อนหด กลายเป็นเห็นวิ่งขวาไปซ้ายแล้ววิ่งซ้ายไปขวาซ้ำ
          const len = lengths[si] ?? 2000;
          // เส้นที่ถูกดันขึ้นบน เน้นหนาขึ้นนิดหน่อยให้เห็นชัดว่ากำลังโฟกัสอันไหนอยู่
          const isFront = si === front;
          return <g key={si}>
            <path ref={el => pathRefs.current[si] = el} d={path} fill="none" stroke={s.color} strokeWidth={isFront ? 4 : 2.6}
              strokeLinecap="round" strokeLinejoin="round"
              style={{ strokeDasharray: len, strokeDashoffset: drawn ? 0 : len,
                transition: 'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1), stroke-width .2s' }} />
            {pts.map(([x,y,i])=>(
              <g key={i}>
                <circle cx={x} cy={y} r="4.5" fill="#fff" stroke={s.color} strokeWidth="2.6"
                  style={{ pointerEvents:'none', opacity: drawn ? 1 : 0,
                    transition: `opacity .3s ease ${(n>1 ? i/(n-1) : 0)*1.1}s` }} />
                <circle cx={x} cy={y} r="11" fill="transparent"
                  style={{ cursor: s.tooltips ? 'pointer' : 'default' }}
                  onMouseEnter={() => s.tooltips && setHover({ si, i, x: x/w*100, y: y/height*100 })}
                  onMouseLeave={() => setHover(h => (h && h.si===si && h.i===i) ? null : h)} />
              </g>
            ))}
          </g>;
        })}
        {categories.map((c,i)=>(<text key={i} x={xs(i)} y={height-7} textAnchor="middle" fontSize="9" fill="var(--ink-500)" fontFamily="'LINE Seed Sans TH', sans-serif">{c}</text>))}
      </svg>
      {hover && (
        <div style={{ position:'absolute', left:`${hover.x}%`, top:`${hover.y}%`, transform:'translate(-50%,-130%)',
          background: series[hover.si].color, color:'#fff', padding:'6px 10px', borderRadius:8, fontSize:12, fontWeight:600,
          whiteSpace:'nowrap', pointerEvents:'none', zIndex:5,
          boxShadow:`0 0 6px 0 ${series[hover.si].color}` }}>
          {series[hover.si].tooltips[hover.i]}
        </div>
      )}
    </div>
    <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 18px', justifyContent:'center', marginTop:8 }}>
        {series.map((s,i)=>(
          <button key={i} type="button" onClick={() => setFront(f => f===i ? null : i)}
            style={{ display:'flex', alignItems:'center', gap:7, fontSize:legendSize, fontFamily:'inherit',
              color: i===front ? 'var(--ink-900)' : 'var(--ink-600)', fontWeight: i===front ? 700 : 400,
              background:'transparent', border:'none', padding:0, cursor:'pointer' }}>
            <span style={{ width:14, height:3, borderRadius:2, background:s.color }}></span>{s.label}
          </button>
        ))}
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

/* ---- Notification popup (มุมขวาบน ใต้กระดิ่ง) ----
   ต่างจาก Toast ด้านบน: อันนี้เด้งหลายอันซ้อนกันได้ (แจ้งเตือนเข้ามาพร้อมกันหลายรายการ)
   กดที่การ์ด = ไปหน้าที่เกี่ยวข้อง, ไม่กด = หายเองใน 30 วิ (ยังนับว่ายังไม่อ่าน) */
export function useNotifToasts(){
  const [items,setItems]=useState([]);
  const push=(notifs)=>{
    const withId = notifs.map(n=>({ ...n, _toastId: n.key+':'+Date.now() }));
    setItems(cur=>[...cur, ...withId]);
    withId.forEach(n=>{
      setTimeout(()=>setItems(cur=>cur.filter(x=>x._toastId!==n._toastId)), 30000);
    });
  };
  return [items,push,setItems];
}

export function NotifToastStack({ items=[], onGo, onDismiss, lang='TH' }) {
  if(!items.length) return null;
  return (
    <div style={{ position:'fixed', top:'calc(var(--header-h) + 10px)', right:16, zIndex:250,
      display:'flex', flexDirection:'column', gap:9, width:320, maxWidth:'92vw' }}>
      {items.map(n=>(
        <button key={n._toastId} className="fade-up" onClick={()=>{ onDismiss?.(n._toastId); onGo?.(n.page); }}
          style={{ display:'flex', alignItems:'flex-start', gap:11, padding:'12px 13px', width:'100%',
            border:'1px solid var(--navy-800)', borderRadius:12, textAlign:'left', cursor:'pointer', fontFamily:'inherit',
            background:'var(--navy-800)', boxShadow:'0 0 10px 2px rgba(232,114,15,.5), var(--sh-lg)' }}>
          <div style={{ width:34, height:34, borderRadius:9, flex:'none', display:'flex', alignItems:'center', justifyContent:'center',
            background:'rgba(255,255,255,.22)', color:'#fff' }}><Icon name={n.icon} size={16}/></div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13.5, fontWeight:700, color:'#fff' }}>{n.title}</div>
            {n.sub && <div style={{ fontSize:12, fontWeight:400, color:'rgba(255,255,255,.85)', marginTop:2 }}>{n.sub}</div>}
          </div>
          <button onClick={(e)=>{ e.stopPropagation(); onDismiss?.(n._toastId); }}
            style={{ border:'none', background:'transparent', padding:2, flex:'none', cursor:'pointer', color:'rgba(255,255,255,.85)' }}>
            <Icon name="x" size={14} />
          </button>
        </button>
      ))}
    </div>
  );
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

/* ---- Pagination ----
   เลขหน้าที่จะแสดง: หน้าแรก/หน้าสุดท้ายเสมอ + หน้าข้างเคียง อย่างอื่นย่อเป็น '…'
   page เป็น index เริ่มที่ 0 */
export function pageNumbers(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i);
  const out = [0];
  const from = Math.max(1, Math.min(page - 1, pages - 4));
  const to = Math.min(pages - 2, Math.max(page + 1, 3));
  if (from > 1) out.push('…');
  for (let i = from; i <= to; i++) out.push(i);
  if (to < pages - 2) out.push('…');
  out.push(pages - 1);
  return out;
}

export function Pagination({ page, pages, onPage, lang = 'TH' }) {
  if (pages <= 1) return null;
  const tt = (key, vars) => t(lang, key, vars);
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
      flexWrap:'wrap', padding:'12px 18px', borderTop:'1px solid var(--ink-100)' }}>
      <span style={{ fontSize:13, color:'var(--ink-500)' }}>{tt('officer.students.pageInfo', { page: page + 1, pages })}</span>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
          <Icon name="chevL" size={15} /> {tt('officer.students.prevBtn')}</button>
        <div style={{ display:'flex', gap:4 }}>
          {pageNumbers(page, pages).map((n, i) => n === '…'
            ? <span key={`gap${i}`} style={{ padding:'0 4px', color:'var(--ink-400)', fontSize:13, alignSelf:'center' }}>…</span>
            : <button key={n} className={`btn btn-sm ${n === page ? '' : 'btn-ghost'}`} onClick={() => onPage(n)}
                style={{ minWidth:32, padding:'0 8px', justifyContent:'center', fontWeight: n === page ? 700 : 500 }}>{n + 1}</button>
          )}
        </div>
        <button className="btn btn-ghost btn-sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
          {tt('officer.students.nextBtn')} <Icon name="chevR" size={15} /></button>
      </div>
    </div>
  );
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
