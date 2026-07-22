/* ============================================================
   เจ้าหน้าที่ — คิวตรวจสอบและยืนยันผลสอบ
   ============================================================ */
import { useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { PageHead, Avatar, Empty } from '../../components/ui.jsx';
import { STUDENTS } from '../../mock/mockData.js';

export function OfficerReview({ go, setSel }) {
  const [tab, setTab] = useState('SUBMITTED');
  const counts = {
    SUBMITTED: STUDENTS.filter(s=>s.status==='SUBMITTED').length,
    REJECTED:  STUDENTS.filter(s=>s.status==='REJECTED').length,
    CONFIRMED: STUDENTS.filter(s=>s.status==='CONFIRMED').length,
  };
  const rows = STUDENTS.filter(s=>s.status===tab);

  return (
    <div className="fade-up">
      <PageHead title="ตรวจสอบและยืนยันผล" sub="ดำเนินการตรวจสอบผลสอบที่นักศึกษาส่งเข้ามา" />
      <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap' }}>
        {[['SUBMITTED','รอตรวจสอบ'],['REJECTED','ถูกตีกลับ'],['CONFIRMED','ยืนยันแล้ว']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} className="btn" style={{
            background: tab===k?'var(--navy-700)':'#fff', color: tab===k?'#fff':'var(--ink-700)',
            border:'1px solid '+(tab===k?'var(--navy-700)':'var(--ink-200)') }}>
            {l} <span className="tnum" style={{ background: tab===k?'rgba(255,255,255,.2)':'var(--ink-100)', padding:'1px 8px', borderRadius:999, fontSize:12.5, marginLeft:2 }}>{counts[k]}</span>
          </button>
        ))}
      </div>
      <div className="card" style={{ overflow:'hidden' }}>
        {rows.length? <div style={{ overflowX:'auto' }}><table className="tbl">
          <thead><tr><th>นักศึกษา</th><th>ห้อง</th><th>ผลสอบ</th><th>หลักฐาน</th><th>ส่งเมื่อ</th><th></th></tr></thead>
          <tbody>{rows.map(s=>(
            <tr key={s.sid} className="clickable" onClick={()=>{ setSel(s); go('detail'); }}>
              <td><div style={{ display:'flex', alignItems:'center', gap:11 }}><Avatar name={s.firstName} size={34}/>
                <div><div style={{ fontWeight:600, fontSize:14 }}>{s.firstName} {s.lastName}</div>
                <div className="mono" style={{ fontSize:12, color:'var(--ink-400)' }}>{s.sid}</div></div></div></td>
              <td><span className="chip" style={{ fontSize:12 }}>ห้อง {s.room}</span></td>
              <td className="tnum" style={{ fontWeight:700, color: s.allPass?'var(--pass)':'var(--ink-800)' }}>{s.passedCount}/8</td>
              <td>{s.files.length? <span style={{ display:'inline-flex', alignItems:'center', gap:5, color:'var(--status-reject-fg)', fontSize:13 }}><Icon name="pdf" size={15}/> {s.files.length} ไฟล์</span> : <span style={{ color:'var(--ink-400)' }}>—</span>}</td>
              <td style={{ color:'var(--ink-500)', fontSize:13 }}>{s.submittedAt}</td>
              <td style={{ textAlign:'right' }}><button className="btn btn-subtle btn-sm">ตรวจสอบ <Icon name="chevR" size={14}/></button></td>
            </tr>
          ))}</tbody>
        </table></div> : <Empty icon="checkCircle" title="ไม่มีรายการในสถานะนี้" sub="ดำเนินการครบทุกรายการแล้ว" />}
      </div>
    </div>
  );
}
