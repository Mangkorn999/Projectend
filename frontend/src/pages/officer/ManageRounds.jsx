/* ============================================================
   เจ้าหน้าที่ — จัดการรอบการกรอกผลสอบ
   ============================================================ */
import { useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { PageHead, Modal } from '../../components/ui.jsx';
import { ROUNDS } from '../../mock/mockData.js';

export function ManageRounds({ toast }) {
  const [rounds] = useState(ROUNDS);
  const [modal, setModal] = useState(null);
  return (
    <div className="fade-up">
      <PageHead title="จัดการรอบการกรอก" sub="เปิด/ปิดรอบการกรอกผลสอบของแต่ละครั้งสอบ"
        actions={<button className="btn btn-primary" onClick={()=>setModal('new')}><Icon name="plus" size={17}/> เปิดรอบใหม่</button>} />
      <div className="grid g-3">
        {rounds.map(r=>(
          <div key={r.id} className="card card-pad" style={{ position:'relative' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <span className={'badge '+(r.status==='OPEN'?'ok':'draft')}><span className="dot"></span>{r.status==='OPEN'?'เปิดรับ':'ปิดแล้ว'}</span>
              <button className="btn btn-ghost btn-sm" style={{ padding:7, border:'none' }}><Icon name="edit" size={16}/></button>
            </div>
            <div style={{ fontSize:18, fontWeight:800 }}>รอบที่ {r.attempt} / {r.year}</div>
            <div style={{ fontSize:13, color:'var(--ink-500)', marginTop:4 }}>ปีการศึกษา {r.year}</div>
            <div className="hr" style={{ margin:'14px 0' }}></div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:13 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'var(--ink-500)' }}>เปิดรับ</span><b>{r.open}</b></div>
              <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'var(--ink-500)' }}>ปิดรับ</span><b>{r.close}</b></div>
            </div>
            {r.status==='OPEN' && <div style={{ marginTop:14 }}><div className="pbar"><i style={{ width:'62%', background:'#8b5e34' }}></i></div>
              <div style={{ fontSize:11.5, color:'var(--ink-500)', marginTop:6 }}>กรอกแล้ว 62% · เหลือ 4 วัน</div></div>}
          </div>
        ))}
      </div>
      <Modal open={!!modal} onClose={()=>setModal(null)} title="เปิดรอบการกรอกใหม่"
        footer={<><button className="btn btn-ghost" onClick={()=>setModal(null)}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={()=>{ setModal(null); toast('เปิดรอบใหม่เรียบร้อย'); }}><Icon name="check" size={16}/> เปิดรอบ</button></>}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="grid g-2" style={{ gap:14 }}>
            <div className="field"><label>ปีการศึกษา</label><input className="input" defaultValue="2569"/></div>
            <div className="field"><label>ครั้งที่สอบ</label><input className="input" defaultValue="2"/></div>
          </div>
          <div className="grid g-2" style={{ gap:14 }}>
            <div className="field"><label>วันที่เปิดรับ</label><input className="input" type="date"/></div>
            <div className="field"><label>วันที่ปิดรับ</label><input className="input" type="date"/></div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
