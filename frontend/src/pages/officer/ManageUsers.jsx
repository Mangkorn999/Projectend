/* ============================================================
   เจ้าหน้าที่ — จัดการผู้ใช้งานระดับผู้บริหาร (เพิ่ม/ถอนสิทธิ์)
   ============================================================ */
import { useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { PageHead, Modal, Avatar } from '../../components/ui.jsx';

export function ManageUsers({ toast }) {
  const [users, setUsers] = useState([
    { id:1, name:'รศ.ดร. สุนิสา ฉัตรมงคล', email:'sunisa.c@psu.ac.th', role:'ผู้บริหารคณะ', title:'คณบดี' },
    { id:2, name:'ผศ.ดร. กิตย์ศิริ ช่อเจี้ยง', email:'kitsiri.c@psu.ac.th', role:'ผู้บริหารคณะ', title:'รองคณบดีฝ่ายวิชาการ' },
    { id:3, name:'อ. วรินทร เพชรรัตน์', email:'warintorn.p@psu.ac.th', role:'ผู้บริหารคณะ', title:'ผู้ช่วยคณบดี' },
  ]);
  const [modal, setModal] = useState(null);
  return (
    <div className="fade-up">
      <PageHead title="จัดการผู้ใช้งานผู้บริหาร" sub="เพิ่ม/ถอนสิทธิ์การเข้าถึง Dashboard ระดับผู้บริหาร"
        actions={<button className="btn btn-primary" onClick={()=>setModal({})}><Icon name="plus" size={17}/> เพิ่มผู้บริหาร</button>} />
      <div className="card" style={{ overflow:'hidden' }}>
        <table className="tbl">
          <thead><tr><th>ชื่อ-นามสกุล</th><th>ตำแหน่ง</th><th>อีเมล</th><th>บทบาท</th><th></th></tr></thead>
          <tbody>{users.map(u=>(
            <tr key={u.id}>
              <td><div style={{ display:'flex', alignItems:'center', gap:11 }}><Avatar name={u.name.replace(/^[^ ]+ /,'')} size={34} bg="var(--navy-600)"/>
                <span style={{ fontWeight:600 }}>{u.name}</span></div></td>
              <td style={{ color:'var(--ink-600)' }}>{u.title}</td>
              <td className="mono" style={{ fontSize:13, color:'var(--ink-500)' }}>{u.email}</td>
              <td><span className="chip" style={{ background:'var(--blue-50)', color:'var(--blue-600)', fontWeight:600 }}><Icon name="chart" size={13}/> {u.role}</span></td>
              <td style={{ textAlign:'right' }}><button className="btn btn-danger btn-sm" onClick={()=>{ setUsers(us=>us.filter(x=>x.id!==u.id)); toast('ถอนสิทธิ์เรียบร้อย','info'); }}><Icon name="trash" size={15}/> ถอนสิทธิ์</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <Modal open={!!modal} onClose={()=>setModal(null)} title="เพิ่มผู้ใช้งานผู้บริหาร" width={460}
        footer={<><button className="btn btn-ghost" onClick={()=>setModal(null)}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={()=>{ setModal(null); toast('เพิ่มผู้บริหารเรียบร้อย'); }}>เพิ่มผู้ใช้งาน</button></>}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field"><label>ชื่อ-นามสกุล</label><input className="input" placeholder="เช่น รศ.ดร. สุนิสา ฉัตรมงคล"/></div>
          <div className="field"><label>อีเมล</label><input className="input" placeholder="name@psu.ac.th"/>
            <span className="hint">ใช้อีเมลนี้เข้าสู่ระบบ</span></div>
          <div className="field"><label>ตำแหน่ง</label><input className="input" placeholder="เช่น รองคณบดีฝ่ายวิชาการ"/></div>
        </div>
      </Modal>
    </div>
  );
}
