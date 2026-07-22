/* ============================================================
   เจ้าหน้าที่ — จัดการรายวิชาที่ใช้สอบ
   ============================================================ */
import { useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { PageHead, Modal } from '../../components/ui.jsx';
import { SUBJECTS } from '../../mock/mockData.js';

export function ManageSubjects({ toast }) {
  const [subs] = useState(SUBJECTS);
  const [modal, setModal] = useState(null);
  return (
    <div className="fade-up">
      <PageHead title="จัดการรายวิชา" sub="รายวิชาที่ใช้ในการสอบใบประกอบวิชาชีพ"
        actions={<button className="btn btn-primary" onClick={()=>setModal({})}><Icon name="plus" size={17}/> เพิ่มรายวิชา</button>} />
      <div className="card" style={{ overflow:'hidden' }}>
        <table className="tbl">
          <thead><tr><th style={{ width:80 }}>ลำดับ</th><th style={{ width:120 }}>รหัสวิชา</th><th>ชื่อวิชา</th><th></th></tr></thead>
          <tbody>{subs.map((s,i)=>(
            <tr key={s.id}><td className="tnum" style={{ color:'var(--ink-500)' }}>{i+1}</td>
              <td><span className="chip mono" style={{ fontSize:12.5 }}>{s.code}</span></td>
              <td style={{ fontWeight:500 }}>{s.name}</td>
              <td style={{ textAlign:'right' }}>
                <button className="btn btn-ghost btn-sm" style={{ padding:7, border:'none' }} onClick={()=>setModal(s)}><Icon name="edit" size={16}/></button>
                <button className="btn btn-ghost btn-sm" style={{ padding:7, border:'none', color:'var(--fail)' }}><Icon name="trash" size={16}/></button>
              </td></tr>
          ))}</tbody>
        </table>
      </div>
      <Modal open={!!modal} onClose={()=>setModal(null)} title={modal?.id?'แก้ไขรายวิชา':'เพิ่มรายวิชา'} width={440}
        footer={<><button className="btn btn-ghost" onClick={()=>setModal(null)}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={()=>{ setModal(null); toast('บันทึกรายวิชาเรียบร้อย'); }}>บันทึก</button></>}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field"><label>รหัสวิชา</label><input className="input" defaultValue={modal?.code} placeholder="เช่น NLE9"/></div>
          <div className="field"><label>ชื่อวิชา</label><input className="input" defaultValue={modal?.name} placeholder="ชื่อรายวิชา"/></div>
        </div>
      </Modal>
    </div>
  );
}
