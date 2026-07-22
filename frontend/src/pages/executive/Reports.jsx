/* ============================================================
   รายงานสรุปผลการสอบ (สั่งพิมพ์ / ส่งออกได้)
   ใช้ร่วมกันทั้งเจ้าหน้าที่และผู้บริหาร
   ============================================================ */
import { useMemo } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { PageHead, StatusBadge } from '../../components/ui.jsx';
import { Logo } from '../../components/Logo.jsx';
import { ROUNDS, STUDENTS, computeStats, plural } from '../../mock/mockData.js';

export function Reports({ toast }) {
  const st = useMemo(()=>computeStats(STUDENTS), []);
  return (
    <div className="fade-up">
      <PageHead title="รายงานสรุปผลการสอบ" sub={`รอบที่ ${ROUNDS[0].attempt} ปีการศึกษา ${ROUNDS[0].year}`}
        actions={<>
          <button className="btn btn-ghost no-print" onClick={()=>window.print()}><Icon name="printer" size={16}/> พิมพ์</button>
          <button className="btn btn-ghost no-print" onClick={()=>toast('กำลังส่งออก Excel…','info')}><Icon name="download" size={16}/> Excel</button>
          <button className="btn btn-primary no-print" onClick={()=>toast('กำลังสร้างไฟล์ PDF…','info')}><Icon name="pdf" size={16}/> ส่งออก PDF</button>
        </>} />

      {/* ตัวรายงาน */}
      <div className="card" style={{ padding:'34px 40px', maxWidth:900, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, paddingBottom:18, borderBottom:'2px solid var(--navy-700)' }}>
          <Logo size={48} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--navy-700)' }}>รายงานสรุปผลการสอบใบประกอบวิชาชีพการพยาบาล</div>
            <div style={{ fontSize:13, color:'var(--ink-500)' }}>คณะพยาบาลศาสตร์ มหาวิทยาลัยสงขลานครินทร์ · รอบที่ {ROUNDS[0].attempt}/{ROUNDS[0].year}</div>
          </div>
          <div style={{ textAlign:'right', fontSize:12, color:'var(--ink-500)' }}>ออกรายงาน<br/>5 มิ.ย. 2569</div>
        </div>

        {/* 1. สรุปภาพรวม */}
        <div className="sec-title" style={{ margin:'24px 0 12px' }}>1. สรุปภาพรวม</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {[['นักศึกษาทั้งหมด',plural(st.total),'navy'],['ส่งผลแล้ว',plural(st.submitted),'blue'],['ผ่านครบ 8 วิชา',plural(st.fullyPassed),'ok'],['อัตราสอบผ่านรวม',st.overallPassRate+'%','gold']].map(([l,v,t])=>(
            <div key={l} style={{ padding:'14px 16px', background:'var(--ink-50)', borderRadius:11, borderLeft:'3px solid '+
              ({navy:'var(--navy-700)',blue:'var(--blue-600)',ok:'var(--pass)',gold:'var(--gold-500)'}[t]) }}>
              <div style={{ fontSize:12.5, color:'var(--ink-500)', fontWeight:600 }}>{l}</div>
              <div className="tnum" style={{ fontSize:26, fontWeight:800, marginTop:4 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* 2. จำแนกตามสถานะ */}
        <div className="sec-title" style={{ margin:'26px 0 12px' }}>2. จำแนกตามสถานะ</div>
        <table className="tbl" style={{ border:'1px solid var(--ink-200)', borderRadius:10, overflow:'hidden' }}>
          <thead><tr><th>สถานะ</th><th style={{ textAlign:'right' }}>จำนวน (คน)</th><th style={{ textAlign:'right' }}>ร้อยละ</th></tr></thead>
          {/* StatusBadge แสดงชื่อสถานะให้เอง จึงส่งแค่ key ก็พอ */}
          <tbody>{['CONFIRMED','SUBMITTED','REJECTED','DRAFT'].map(k=>(
            <tr key={k}><td><StatusBadge status={k}/></td>
              <td className="tnum" style={{ textAlign:'right', fontWeight:700 }}>{st.by[k]}</td>
              <td className="tnum" style={{ textAlign:'right', color:'var(--ink-600)' }}>{Math.round(st.by[k]/st.total*100)}%</td></tr>
          ))}</tbody>
        </table>

        {/* 3. จำแนกตามรายวิชา */}
        <div className="sec-title" style={{ margin:'26px 0 12px' }}>3. จำแนกตามรายวิชา</div>
        <table className="tbl" style={{ border:'1px solid var(--ink-200)', borderRadius:10, overflow:'hidden' }}>
          <thead><tr><th>รหัส</th><th>รายวิชา</th><th style={{ textAlign:'right' }}>ผ่าน</th><th style={{ textAlign:'right' }}>ไม่ผ่าน</th><th style={{ textAlign:'right' }}>อัตราผ่าน</th></tr></thead>
          <tbody>{st.perSubject.map(s=>(
            <tr key={s.id}><td className="mono" style={{ color:'var(--ink-400)' }}>{s.code}</td>
              <td style={{ fontWeight:500 }}>{s.name}</td>
              <td className="tnum" style={{ textAlign:'right', color:'var(--pass)', fontWeight:700 }}>{s.pass}</td>
              <td className="tnum" style={{ textAlign:'right', color:'var(--fail)', fontWeight:700 }}>{s.fail}</td>
              <td style={{ textAlign:'right' }}><span className="badge" style={{ background: s.rate>=80?'var(--status-ok-bg)':s.rate>=60?'var(--gold-50)':'var(--status-reject-bg)', color: s.rate>=80?'var(--status-ok-fg)':s.rate>=60?'var(--gold-600)':'var(--status-reject-fg)' }}>{s.rate}%</span></td></tr>
          ))}</tbody>
        </table>

        <div style={{ marginTop:24, paddingTop:16, borderTop:'1px solid var(--ink-200)', display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--ink-400)' }}>
          <span>ระบบบันทึกใบประกอบวิชาชีพ · คณะพยาบาลศาสตร์ มอ.</span>
          <span>หน้า 1/1</span>
        </div>
      </div>
    </div>
  );
}
