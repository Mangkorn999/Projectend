/* ============================================================
   UI components ที่ใช้ร่วมกันทุกหน้า
   badge, avatar, การ์ดสถิติ, หัวหน้าเพจ, toast, modal, empty, stepper
   ============================================================ */
import React, { useState } from 'react';
import { Icon } from './Icon.jsx';

/* สถานะการกรอกผลสอบ — ใช้เป็น label กับ class สีของ badge */
export const STATUS = {
  DRAFT:     { key:'draft',  label:'ยังไม่กรอก' },
  SUBMITTED: { key:'wait',   label:'รอตรวจสอบ' },
  CONFIRMED: { key:'ok',     label:'ยืนยันแล้ว' },
  REJECTED:  { key:'reject', label:'ถูกตีกลับ' },
};

/* ---- Badge สถานะ ---- */
export function StatusBadge({ status, size }) {
  const s = STATUS[status] || STATUS.DRAFT;
  return <span className={'badge '+s.key} style={ size==='lg'?{fontSize:13.5,padding:'6px 13px'}:null }>
    <span className="dot"></span>{s.label}</span>;
}

/* ---- Badge ผ่าน/ไม่ผ่าน รายวิชา ---- */
export function PassBadge({ passed }) {
  if (passed===null||passed===undefined) return <span className="badge draft"><span className="dot"></span>—</span>;
  return passed
    ? <span className="badge pass"><span className="dot"></span>ผ่าน</span>
    : <span className="badge fail"><span className="dot"></span>ไม่ผ่าน</span>;
}

/* ---- Avatar วงกลม แสดงอักษรตัวแรกของชื่อ ---- */
export function Avatar({ name, size = 38, bg }) {
  const init = (name||'?').trim().charAt(0);
  return <span className="avatar" style={{ width:size, height:size, fontSize:size*0.42, background:bg }}>{init}</span>;
}

/* ---- การ์ดตัวเลขสรุป (KPI) ---- */
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

/* ---- หัวเพจ: ชื่อเรื่อง + คำอธิบาย + ปุ่มด้านขวา ---- */
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

/* ---- Toast แจ้งเตือนมุมล่าง ---- */
export function Toast({ toast }) {
  if(!toast) return null;
  const icon = { success:'checkCircle', error:'xCircle', info:'info' }[toast.type] || 'info';
  const tone = { success:'var(--status-ok-dot)', error:'var(--status-reject-dot)', info:'var(--navy-600)' }[toast.type];
  return (
    <div className="fade-up" style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:200,
      background:'var(--ink-900)', color:'#fff', padding:'13px 20px', borderRadius:12, boxShadow:'var(--sh-lg)',
      display:'flex', alignItems:'center', gap:11, fontSize:14, fontWeight:500, maxWidth:'90vw' }}>
      <Icon name={icon} size={20} style={{ color:tone }} /> {toast.msg}
    </div>
  );
}

/* ใช้คู่กับ <Toast /> — const [toast, showToast] = useToast() */
export function useToast(){
  const [toast,setToast]=useState(null);
  const show=(msg,type='success')=>{ setToast({msg,type}); clearTimeout(window.__t); window.__t=setTimeout(()=>setToast(null),2600); };
  return [toast,show];
}

/* ---- Modal ---- */
export function Modal({ open, onClose, title, children, footer, width=480, tone }) {
  if(!open) return null;
  return (
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
    </div>
  );
}

/* ---- สถานะว่าง (ไม่มีข้อมูล) ---- */
export function Empty({ icon='doc', title, sub, action }) {
  return <div className="empty">
    <div className="ico"><Icon name={icon} size={26} /></div>
    <div style={{ fontWeight:700, color:'var(--ink-700)', fontSize:15.5 }}>{title}</div>
    {sub && <div style={{ marginTop:5, fontSize:13.5 }}>{sub}</div>}
    {action && <div style={{ marginTop:16 }}>{action}</div>}
  </div>;
}

/* ---- Stepper แสดงขั้นตอนของฟอร์ม ---- */
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
