/* ============================================================
   โครงหน้าจอหลัก — แถบบน (TopBar) + เมนูข้าง (Sidebar)
   ============================================================ */
import { useState } from 'react';
import { Icon } from './Icon.jsx';
import { Logo } from './Logo.jsx';
import { Avatar, Modal, Empty } from './ui.jsx';

/* ---- แถบบน ---- */
export function TopBar({ role, roleLabel, user, onMenu, onSwitchRole, notif=3 }) {
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const roles = [
    { k:'student', label:'นักศึกษา', icon:'graduation' },
    { k:'officer', label:'เจ้าหน้าที่คณะ', icon:'shield' },
    { k:'executive', label:'ผู้บริหารคณะ', icon:'chart' },
  ];
  return (
    <header style={{ height:'var(--header-h)', background:'#fff', borderBottom:'1px solid var(--ink-200)',
      display:'flex', alignItems:'center', gap:16, padding:'0 18px 0 16px', position:'sticky', top:0, zIndex:40 }}>
      <button className="btn btn-ghost btn-sm only-mobile" style={{ padding:8, border:'none' }} onClick={onMenu}>
        <Icon name="menu" />
      </button>
      <div className="only-desktop"><Logo /></div>
      <div className="only-desktop" style={{ flexDirection:'column', justifyContent:'center', lineHeight:1.15, whiteSpace:'nowrap' }}>
        <div style={{ fontWeight:800, fontSize:14.5, color:'var(--navy-700)' }}>ระบบบันทึกใบประกอบวิชาชีพ</div>
        <div style={{ fontSize:11.5, color:'var(--ink-500)', fontWeight:500 }}>คณะพยาบาลศาสตร์ · มหาวิทยาลัยสงขลานครินทร์</div>
      </div>
      <div style={{ flex:1 }}></div>
      <button className="btn btn-ghost btn-sm" style={{ position:'relative', padding:9, border:'1px solid var(--ink-200)' }}
        onClick={()=>setNotifOpen(true)}>
        <Icon name="bell" size={19} />
        {notif>0 && <span style={{ position:'absolute', top:5, right:5, width:8, height:8, borderRadius:'50%',
          background:'var(--fail)', boxShadow:'0 0 0 2px #fff' }}></span>}
      </button>
      <Modal open={notifOpen} onClose={()=>setNotifOpen(false)} title="การแจ้งเตือน" width={680}>
        <div style={{ minHeight:440, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Empty icon="bell" title="ยังไม่มีการแจ้งเตือน" sub="เมื่อมีการแจ้งเตือนใหม่ จะแสดงที่นี่" />
        </div>
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

/* ---- เมนูข้าง ---- */
export function Sidebar({ items, active, onNav, open, onClose, footer }) {
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
