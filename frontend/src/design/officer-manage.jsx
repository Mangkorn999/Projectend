/* ============================================================
   Officer management screens — rounds, subjects, users, news
   ============================================================ */
import { useState } from 'react';
import { Icon, ROUNDS, SUBJECTS, NEWS } from './data.jsx';
import { PageHead, Modal, Avatar } from './components.jsx';

/* ---------- Round management ---------- */
export function ManageRounds({ toast }) {
  const [rounds] = useState(ROUNDS);
  const [modal, setModal] = useState(null); // 'new' | round
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

/* ---------- Subject management ---------- */
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

/* ---------- User management (executives) ---------- */
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
          <div className="field"><label>PSU One Passport / อีเมล</label><input className="input" placeholder="name@psu.ac.th"/>
            <span className="hint">ระบบจะดึงชื่อ-นามสกุลจาก PSU One Passport อัตโนมัติ</span></div>
          <div className="field"><label>ตำแหน่ง</label><input className="input" placeholder="เช่น รองคณบดีฝ่ายวิชาการ"/></div>
        </div>
      </Modal>
    </div>
  );
}

/* ---------- News management ---------- */
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
