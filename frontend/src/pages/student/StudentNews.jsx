/* ============================================================
   นักศึกษา — ข่าวสาร / ประกาศ (หน้าแรกหลังเข้าสู่ระบบ)
   ============================================================ */
import { useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { PageHead, Modal, StatusBadge } from '../../components/ui.jsx';
import { ROUNDS, NEWS } from '../../mock/mockData.js';

export function StudentNews({ go }) {
  const [open, setOpen] = useState(null);
  const round = ROUNDS[0];
  return (
    <div className="fade-up">
      <PageHead title="ข่าวสาร / ประกาศ" sub="ติดตามกำหนดการและแนวปฏิบัติจากคณะ" />

      {/* แบนเนอร์รอบที่เปิดรับอยู่ */}
      <div className="card" style={{ padding:0, marginBottom:22, overflow:'hidden', border:'1px solid var(--gold-100)' }}>
        <div style={{ display:'flex', gap:0, alignItems:'stretch', flexWrap:'wrap' }}>
          <div style={{ background:'linear-gradient(135deg,var(--navy-700),var(--navy-800))', color:'#fff',
            padding:'22px 26px', flex:'1 1 320px', display:'flex', flexDirection:'column', gap:6 }}>
            <div className="chip" style={{ alignSelf:'flex-start', background:'rgba(255,255,255,.14)', color:'var(--gold-500)', fontWeight:700 }}>
              <Icon name="clock" size={14} /> รอบเปิดรับขณะนี้
            </div>
            <div style={{ fontSize:19, fontWeight:800, marginTop:4 }}>รอบที่ {round.attempt} ปีการศึกษา {round.year}</div>
            <div style={{ fontSize:13.5, opacity:.85 }}>เปิดรับกรอก {round.open} – {round.close}</div>
          </div>
          <div style={{ padding:'22px 26px', flex:'1 1 280px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
            <div>
              <div style={{ fontSize:13.5, color:'var(--ink-500)', fontWeight:600 }}>สถานะการกรอกของคุณ</div>
              <div style={{ marginTop:7 }}><StatusBadge status="DRAFT" size="lg" /></div>
            </div>
            <button className="btn btn-gold btn-lg" onClick={()=>go('form')}><Icon name="edit" size={18} /> เริ่มกรอกผลสอบ</button>
          </div>
        </div>
      </div>

      {/* รายการข่าว */}
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {NEWS.map(n=>(
          <div key={n.id} className="card" style={{ padding:'18px 22px', cursor:'pointer', transition:'.15s' }}
            onClick={()=>setOpen(n)}
            onMouseEnter={e=>e.currentTarget.style.boxShadow='var(--sh-md)'}
            onMouseLeave={e=>e.currentTarget.style.boxShadow='var(--sh-sm)'}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:15 }}>
              <div style={{ width:44, height:44, borderRadius:12, flex:'none', display:'flex', alignItems:'center', justifyContent:'center',
                background: n.pinned?'var(--navy-700)':'var(--blue-50)', color: n.pinned?'#fff':'var(--blue-600)' }}>
                <Icon name={n.pinned?'star':'news'} size={21} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:5, flexWrap:'wrap' }}>
                  {n.pinned && <span className="chip" style={{ background:'var(--navy-700)', color:'#fff', fontWeight:700, fontSize:11.5, padding:'3px 9px' }}>ปักหมุด</span>}
                  <span className="chip" style={{ fontSize:11.5, padding:'3px 9px' }}>{n.round}</span>
                </div>
                <div style={{ fontSize:16, fontWeight:700, color:'var(--ink-900)', lineHeight:1.35 }}>{n.title}</div>
                <div style={{ fontSize:13.5, color:'var(--ink-500)', marginTop:6, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical' }}>{n.body}</div>
                <div style={{ fontSize:12.5, color:'var(--ink-400)', marginTop:9, display:'flex', gap:14 }}>
                  <span><Icon name="calendar" size={13} style={{ verticalAlign:-2, marginRight:4 }} />{n.date}</span>
                  <span>{n.author}</span>
                </div>
              </div>
              <Icon name="chevR" size={20} style={{ color:'var(--ink-300)', flex:'none', marginTop:4 }} />
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!open} onClose={()=>setOpen(null)} title={open?.title} width={560}
        footer={<button className="btn btn-ghost" onClick={()=>setOpen(null)}>ปิด</button>}>
        {open && <>
          <div style={{ display:'flex', gap:10, marginBottom:14 }}>
            <span className="chip">{open.round}</span>
            <span className="chip" style={{ background:'transparent', color:'var(--ink-500)' }}><Icon name="calendar" size={13}/> {open.date}</span>
          </div>
          <p style={{ margin:0, fontSize:15, lineHeight:1.7, color:'var(--ink-700)' }}>{open.body}</p>
          <div style={{ marginTop:18, paddingTop:14, borderTop:'1px solid var(--ink-100)', fontSize:13, color:'var(--ink-500)' }}>
            ผู้ประกาศ: {open.author}
          </div>
        </>}
      </Modal>
    </div>
  );
}
