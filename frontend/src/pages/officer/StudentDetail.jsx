/* ============================================================
   เจ้าหน้าที่ — รายละเอียดนักศึกษา + ยืนยัน/ตีกลับผลสอบ
   ส่ง readonly={true} เมื่อเปิดจากฝั่งผู้บริหาร (ดูได้อย่างเดียว)
   ============================================================ */
import { useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { PageHead, Modal, Empty, StatusBadge, PassBadge } from '../../components/ui.jsx';
import { STUDENTS, SUBJECTS } from '../../mock/mockData.js';

export function StudentDetail({ student, go, toast, readonly }) {
  const s = student || STUDENTS[0];
  const [status, setStatus] = useState(s.status);
  const [reject, setReject] = useState(false);
  const [remark, setRemark] = useState('');
  const passed = s.subjects.filter(x=>x.passed===true).length;

  return (
    <div className="fade-up">
      <PageHead title={`${s.prefix} ${s.firstName} ${s.lastName}`}
        crumb={<><a onClick={()=>go('students')} style={{cursor:'pointer'}}>ข้อมูลนักศึกษา</a> <Icon name="chevR" size={13}/> รายละเอียด</>}
        sub={<span className="mono">{s.sid} · ห้อง {s.room} · ปีการศึกษา {s.year}</span>}
        actions={<button className="btn btn-ghost" onClick={()=>go('students')}><Icon name="chevL" size={16}/> กลับ</button>} />

      <div className="row wrap-m" style={{ alignItems:'flex-start' }}>
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:18 }}>
          {/* ตารางผลสอบ */}
          <div className="card" style={{ overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--ink-100)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>ผลสอบรายวิชา</h3>
              <span className="tnum chip" style={{ background: s.allPass?'var(--status-ok-bg)':'var(--ink-100)', color: s.allPass?'var(--status-ok-fg)':'var(--ink-700)', fontWeight:700 }}>ผ่าน {passed}/8 วิชา</span>
            </div>
            <table className="tbl">
              <thead><tr><th style={{ width:60 }}>รหัส</th><th>รายวิชา</th><th style={{ textAlign:'right' }}>ผลสอบ</th></tr></thead>
              <tbody>{SUBJECTS.map(sub=>{ const r=s.subjects.find(x=>x.id===sub.id);
                return <tr key={sub.id}><td className="mono" style={{ color:'var(--ink-400)' }}>{sub.code}</td>
                  <td style={{ fontWeight:500 }}>{sub.name}</td>
                  <td style={{ textAlign:'right' }}><PassBadge passed={r?.passed} /></td></tr>;
              })}</tbody>
            </table>
          </div>
          {/* เอกสารหลักฐาน */}
          <div className="card card-pad">
            <h3 style={{ margin:'0 0 14px', fontSize:16, fontWeight:800 }}>เอกสารหลักฐาน</h3>
            {s.files.length? s.files.map((f,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', border:'1px solid var(--ink-200)', borderRadius:11, marginBottom:8 }}>
                <div style={{ width:40, height:40, borderRadius:9, background:'var(--status-reject-bg)', color:'var(--status-reject-fg)', display:'flex', alignItems:'center', justifyContent:'center', flex:'none' }}><Icon name="pdf" size={21}/></div>
                <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:13.5, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</div>
                  <div style={{ fontSize:12, color:'var(--ink-500)' }}>{f.size} · PDF</div></div>
                <button className="btn btn-ghost btn-sm"><Icon name="eye" size={15}/> ดู</button>
                <button className="btn btn-ghost btn-sm"><Icon name="download" size={15}/></button>
              </div>
            )) : <Empty icon="doc" title="ยังไม่มีเอกสารแนบ" />}
          </div>
        </div>

        {/* แถบตรวจสอบด้านขวา */}
        <div style={{ width:312, flex:'none', display:'flex', flexDirection:'column', gap:16 }} className="exam-aside">
          <div className="card card-pad">
            <div style={{ fontSize:13, color:'var(--ink-500)', fontWeight:600, marginBottom:8 }}>สถานะการตรวจสอบ</div>
            <StatusBadge status={status} size="lg" />
            {s.remark && status==='REJECTED' && <div style={{ marginTop:12, padding:'11px 13px', background:'var(--status-reject-bg)', borderRadius:10, fontSize:13, color:'var(--status-reject-fg)' }}>
              <b>เหตุผลการตีกลับ:</b><br/>{s.remark}</div>}
            {!readonly && status==='SUBMITTED' && <div style={{ display:'flex', flexDirection:'column', gap:9, marginTop:16 }}>
              <button className="btn btn-success btn-block btn-lg" onClick={()=>{ setStatus('CONFIRMED'); toast('ยืนยันผลสอบเรียบร้อย'); }}>
                <Icon name="checkCircle" size={18}/> ยืนยันผลสอบ</button>
              <button className="btn btn-danger btn-block" onClick={()=>setReject(true)}>
                <Icon name="xCircle" size={17}/> ตีกลับเพื่อแก้ไข</button>
            </div>}
            {!readonly && status==='CONFIRMED' && <div style={{ marginTop:14, padding:'11px 13px', background:'var(--status-ok-bg)', borderRadius:10, fontSize:13, color:'var(--status-ok-fg)', display:'flex', gap:8, alignItems:'center' }}>
              <Icon name="checkCircle" size={17}/> ยืนยันแล้ว · บันทึกประวัติการดำเนินการแล้ว</div>}
          </div>
          <div className="card card-pad">
            <div style={{ fontSize:13, color:'var(--ink-500)', fontWeight:600, marginBottom:12 }}>ประวัติการดำเนินการ</div>
            <div style={{ display:'flex', flexDirection:'column', gap:13, fontSize:13 }}>
              {[['กรอกและส่งผลสอบ', s.submittedAt||'—','user'],['ตรวจสอบโดยเจ้าหน้าที่', status==='SUBMITTED'?'รอดำเนินการ':(s.confirmedAt||'5 มิ.ย. 2569'),'shield']].map(([l,d,ic],i)=>(
                <div key={i} style={{ display:'flex', gap:10 }}>
                  <div style={{ width:30, height:30, borderRadius:8, background:'var(--ink-100)', color:'var(--ink-500)', display:'flex', alignItems:'center', justifyContent:'center', flex:'none' }}><Icon name={ic} size={15}/></div>
                  <div><div style={{ fontWeight:600, color:'var(--ink-800)' }}>{l}</div><div style={{ fontSize:12, color:'var(--ink-500)' }}>{d}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal open={reject} onClose={()=>setReject(false)} title="ตีกลับผลสอบเพื่อแก้ไข" tone="var(--status-reject-fg)"
        footer={<><button className="btn btn-ghost" onClick={()=>setReject(false)}>ยกเลิก</button>
          <button className="btn" style={{ background:'var(--fail)', color:'#fff' }} disabled={!remark.trim()}
            onClick={()=>{ setStatus('REJECTED'); setReject(false); toast('ตีกลับเรียบร้อย · แจ้งนักศึกษาแล้ว','info'); }}>
            <Icon name="send" size={16}/> ยืนยันการตีกลับ</button></>}>
        <p style={{ margin:'0 0 14px', color:'var(--ink-600)', fontSize:14 }}>โปรดระบุเหตุผล เพื่อให้นักศึกษาทราบสิ่งที่ต้องแก้ไข</p>
        <div className="field"><label>เหตุผลการตีกลับ</label>
          <textarea className="input" rows={3} placeholder="เช่น เอกสารหลักฐานไม่ชัดเจน กรุณาอัปโหลดใหม่…" value={remark} onChange={e=>setRemark(e.target.value)} />
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
          {['เอกสารไม่ชัดเจน','ผลสอบไม่ตรงกับไฟล์แนบ','ไฟล์ไม่สมบูรณ์'].map(t=>(
            <button key={t} className="chip" style={{ cursor:'pointer', border:'1px solid var(--ink-200)' }} onClick={()=>setRemark(t)}>{t}</button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
