/* ============================================================
   เจ้าหน้าที่ / ผู้บริหาร — รายชื่อนักศึกษา (ค้นหา + กรอง + แบ่งหน้า)
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { PageHead, Avatar, StatusBadge } from '../../components/ui.jsx';
import { STUDENTS, ROOMS } from '../../mock/mockData.js';

export function OfficerStudents({ go, setSel }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [room, setRoom] = useState('ALL');
  const [page, setPage] = useState(0);
  const per = 10;

  const filtered = STUDENTS.filter(s=>{
    if(status!=='ALL' && s.status!==status) return false;
    if(room!=='ALL' && s.room!==room) return false;
    if(q && !(`${s.firstName}${s.lastName}${s.sid}`.includes(q))) return false;
    return true;
  });
  const pageRows = filtered.slice(page*per,(page+1)*per);
  const pages = Math.ceil(filtered.length/per);

  // เปลี่ยนเงื่อนไขค้นหาแล้วกลับไปหน้าแรกเสมอ
  useEffect(()=>setPage(0),[q,status,room]);

  return (
    <div className="fade-up">
      <PageHead title="ข้อมูลนักศึกษา" sub={`พบ ${filtered.length} จาก ${STUDENTS.length} คน`}
        actions={<button className="btn btn-ghost"><Icon name="download" size={16}/> ส่งออก Excel</button>} />

      {/* ตัวกรอง */}
      <div className="card" style={{ padding:14, marginBottom:18, display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:'1 1 240px' }}>
          <Icon name="search" size={18} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--ink-400)' }} />
          <input className="input" placeholder="ค้นหาชื่อ หรือ รหัสนักศึกษา…" value={q} onChange={e=>setQ(e.target.value)} style={{ paddingLeft:40 }} />
        </div>
        <select className="select" style={{ width:'auto', minWidth:150 }} value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="ALL">ทุกสถานะ</option><option value="SUBMITTED">รอตรวจสอบ</option>
          <option value="CONFIRMED">ยืนยันแล้ว</option><option value="REJECTED">ถูกตีกลับ</option><option value="DRAFT">ยังไม่กรอก</option>
        </select>
        <select className="select" style={{ width:'auto', minWidth:120 }} value={room} onChange={e=>setRoom(e.target.value)}>
          <option value="ALL">ทุกห้อง</option>{ROOMS.map(r=><option key={r} value={r}>ห้อง {r}</option>)}
        </select>
      </div>

      <div className="card" style={{ overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table className="tbl">
            <thead><tr><th>นักศึกษา</th><th>ห้อง</th><th>ผลสอบ</th><th>สถานะ</th><th>ส่งเมื่อ</th><th></th></tr></thead>
            <tbody>
              {pageRows.map(s=>(
                <tr key={s.sid} className="clickable" onClick={()=>{ setSel(s); go('detail'); }}>
                  <td><div style={{ display:'flex', alignItems:'center', gap:11 }}><Avatar name={s.firstName} size={34}/>
                    <div><div style={{ fontWeight:600, fontSize:14 }}>{s.prefix} {s.firstName} {s.lastName}</div>
                    <div className="mono" style={{ fontSize:12, color:'var(--ink-400)' }}>{s.sid}</div></div></div></td>
                  <td><span className="chip" style={{ fontSize:12 }}>ห้อง {s.room}</span></td>
                  <td>{s.status==='DRAFT'? <span style={{ color:'var(--ink-400)' }}>—</span> :
                    <span className="tnum" style={{ fontWeight:700, color: s.allPass?'var(--pass)':'var(--ink-800)' }}>{s.passedCount}/8</span>}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td style={{ color:'var(--ink-500)', fontSize:13 }}>{s.submittedAt||'—'}</td>
                  <td style={{ textAlign:'right' }}><Icon name="chevR" size={18} style={{ color:'var(--ink-300)' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages>1 && <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px', borderTop:'1px solid var(--ink-100)' }}>
          <span style={{ fontSize:13, color:'var(--ink-500)' }}>หน้า {page+1} จาก {pages}</span>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-ghost btn-sm" disabled={page===0} onClick={()=>setPage(p=>p-1)}><Icon name="chevL" size={15}/> ก่อนหน้า</button>
            <button className="btn btn-ghost btn-sm" disabled={page>=pages-1} onClick={()=>setPage(p=>p+1)}>ถัดไป <Icon name="chevR" size={15}/></button>
          </div>
        </div>}
      </div>
    </div>
  );
}
