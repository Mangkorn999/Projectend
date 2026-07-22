/* ============================================================
   เจ้าหน้าที่ — จัดการข่าวสาร / ประกาศ
   ============================================================ */
import { useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { PageHead, Modal } from '../../components/ui.jsx';
import { ROUNDS, NEWS } from '../../mock/mockData.js';

export function ManageNews({ toast }) {
  const [items, setItems] = useState(NEWS);
  const [modal, setModal] = useState(null);
  return (
    <div className="fade-up">
      <PageHead title="จัดการข่าวสาร / ประกาศ" sub="โพสต์ประกาศถึงนักศึกษาในแต่ละรอบการกรอก"
        actions={<button className="btn btn-primary" onClick={()=>setModal({})}><Icon name="plus" size={17}/> เขียนประกาศ</button>} />
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {items.map(n=>(
          <div key={n.id} className="card" style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:15 }}>
            <div style={{ width:42, height:42, borderRadius:11, flex:'none', display:'flex', alignItems:'center', justifyContent:'center',
              background: n.pinned?'var(--gold-50)':'var(--blue-50)', color: n.pinned?'var(--gold-600)':'var(--blue-600)' }}><Icon name={n.pinned?'star':'news'} size={20}/></div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:15, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.title}</div>
              <div style={{ fontSize:12.5, color:'var(--ink-500)', marginTop:3 }}>{n.round} · {n.date} · {n.author}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={()=>setModal(n)}><Icon name="edit" size={15}/> แก้ไข</button>
            <button className="btn btn-ghost btn-sm" style={{ padding:7, border:'none', color:'var(--fail)' }} onClick={()=>{ setItems(is=>is.filter(x=>x.id!==n.id)); toast('ลบประกาศแล้ว','info'); }}><Icon name="trash" size={16}/></button>
          </div>
        ))}
      </div>
      <Modal open={!!modal} onClose={()=>setModal(null)} title={modal?.id?'แก้ไขประกาศ':'เขียนประกาศใหม่'} width={560}
        footer={<><button className="btn btn-ghost" onClick={()=>setModal(null)}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={()=>{ setModal(null); toast('เผยแพร่ประกาศเรียบร้อย'); }}><Icon name="send" size={16}/> เผยแพร่</button></>}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field"><label>หัวข้อประกาศ</label><input className="input" defaultValue={modal?.title} placeholder="หัวข้อ…"/></div>
          <div className="field"><label>รอบที่เกี่ยวข้อง</label><select className="select" defaultValue={modal?.round}>{ROUNDS.map(r=><option key={r.id}>รอบ {r.attempt}/{r.year}</option>)}</select></div>
          <div className="field"><label>เนื้อหา</label><textarea className="input" rows={4} defaultValue={modal?.body} placeholder="รายละเอียดประกาศ…"/></div>
          <label style={{ display:'flex', alignItems:'center', gap:9, fontSize:14, cursor:'pointer' }}>
            <input type="checkbox" defaultChecked={modal?.pinned} style={{ width:17, height:17 }}/> ปักหมุดประกาศนี้ไว้ด้านบน</label>
        </div>
      </Modal>
    </div>
  );
}
