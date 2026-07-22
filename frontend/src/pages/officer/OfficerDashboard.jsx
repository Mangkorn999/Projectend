/* ============================================================
   เจ้าหน้าที่ — Dashboard ภาพรวมระบบ
   ============================================================ */
import { useMemo } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { PageHead, StatCard } from '../../components/ui.jsx';
import { Donut, BarRow } from '../../components/charts.jsx';
import { ROUNDS, STUDENTS, computeStats, plural } from '../../mock/mockData.js';

export function OfficerDashboard({ go }) {
  const st = useMemo(()=>computeStats(STUDENTS), []);

  // สัดส่วนสถานะการกรอก
  const segs = [
    { key:'CONFIRMED', label:'ยืนยันแล้ว', value:st.by.CONFIRMED, color:'var(--status-ok-dot)' },
    { key:'SUBMITTED', label:'รอตรวจสอบ', value:st.by.SUBMITTED, color:'var(--status-wait-dot)' },
    { key:'REJECTED',  label:'ถูกตีกลับ', value:st.by.REJECTED,  color:'var(--status-reject-dot)' },
    { key:'DRAFT',     label:'ยังไม่กรอก', value:st.by.DRAFT,     color:'var(--ink-300)' },
  ];

  // สัดส่วนผู้สอบผ่าน แยกตามจำนวนวิชาที่ผ่าน (นับเฉพาะคนที่ส่งผลแล้ว)
  const evaluated = STUDENTS.filter(s=>s.status!=='DRAFT');
  const passSegs = [
    { key:'FULL', label:'ผ่านครบ 8 วิชา', value:evaluated.filter(s=>s.passedCount===8).length, color:'var(--pass)' },
    { key:'P7',   label:'ผ่าน 7 วิชา',    value:evaluated.filter(s=>s.passedCount===7).length, color:'#e8c02f' },
    { key:'P6',   label:'ผ่าน 6 วิชา',    value:evaluated.filter(s=>s.passedCount===6).length, color:'#e8951f' },
    { key:'P5',   label:'ผ่าน 5 วิชา',    value:evaluated.filter(s=>s.passedCount===5).length, color:'#d97319' },
    { key:'LOW',  label:'ผ่านต่ำกว่า 5 วิชา', value:evaluated.filter(s=>s.passedCount<5).length, color:'var(--fail)' },
  ];
  const fullPassRate = evaluated.length ? Math.round(passSegs[0].value/evaluated.length*100) : 0;

  return (
    <div className="fade-up">
      <PageHead title="ภาพรวมระบบ (Dashboard)" sub={`รอบที่ ${ROUNDS[0].attempt} ปีการศึกษา ${ROUNDS[0].year} · ปิดรับ ${ROUNDS[0].close}`}
        actions={<>
          <button className="btn btn-ghost"><Icon name="calendar" size={16}/> รอบ {ROUNDS[0].attempt}/{ROUNDS[0].year} <Icon name="chevD" size={15}/></button>
          <button className="btn btn-primary" onClick={()=>go('review')}><Icon name="checkCircle" size={17}/> ตรวจสอบรายการ <span className="nav-badge" style={{ background:'var(--gold-500)', color:'#3a2c05', marginLeft:2 }}>{st.by.SUBMITTED}</span></button>
        </>} />

      {/* แถวตัวเลขสรุป */}
      <div className="grid g-5" style={{ marginBottom:20 }}>
        <StatCard icon="users" label="นักศึกษาทั้งหมด" value={plural(st.total)} sub={`ปีการศึกษา ${ROUNDS[0].year}`} tone="navy" accent onClick={()=>go('students')} />
        <StatCard icon="edit" label="กรอกแล้ว" value={plural(st.submitted)} sub={`${st.fillRate}% ของทั้งหมด`} tone="blue" accent onClick={()=>go('students')} />
        <StatCard icon="clock" label="รอตรวจสอบ" value={plural(st.by.SUBMITTED)} sub="ต้องดำเนินการ" tone="wait" accent onClick={()=>go('review')} />
        <StatCard icon="checkCircle" label="ยืนยันแล้ว" value={plural(st.by.CONFIRMED)} sub={`${Math.round(st.by.CONFIRMED/st.total*100)}% ของทั้งหมด`} tone="ok" accent />
        <StatCard icon="xCircle" label="ถูกตีกลับ" value={plural(st.by.REJECTED)} sub="รอนักศึกษาแก้ไข" tone="reject" accent onClick={()=>go('review')} />
      </div>

      <div className="row wrap-m" style={{ alignItems:'stretch' }}>
        {/* คอลัมน์ซ้าย — โดนัท 2 อัน */}
        <div className="card card-pad" style={{ flex:'0 0 340px' }}>
          <h3 style={{ margin:'0 0 4px', fontSize:16, fontWeight:800 }}>สัดส่วนสถานะการกรอก</h3>
          <p style={{ margin:'0 0 14px', color:'var(--ink-500)', fontSize:13 }}>จากนักศึกษาทั้งหมด {st.total} คน</p>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
            <Donut segments={segs} size={184} thickness={28}
              center={<><div className="tnum" style={{ fontSize:30, fontWeight:800 }}>{st.fillRate}%</div><div style={{ fontSize:11.5, color:'var(--ink-500)' }}>กรอกแล้ว</div></>} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {segs.map(s=>(
              <div key={s.key} style={{ display:'flex', alignItems:'center', gap:9, fontSize:13.5 }}>
                <span style={{ width:11, height:11, borderRadius:3, background:s.color, flex:'none' }}></span>
                <span style={{ color:'var(--ink-700)' }}>{s.label}</span>
                <span className="tnum" style={{ marginLeft:'auto', fontWeight:700 }}>{s.value}</span>
                <span className="tnum" style={{ color:'var(--ink-400)', width:42, textAlign:'right', fontSize:12.5 }}>{Math.round(s.value/st.total*100)}%</span>
              </div>
            ))}
          </div>

          <div className="hr" style={{ margin:'20px 0' }}></div>

          <h3 style={{ margin:'0 0 4px', fontSize:16, fontWeight:800 }}>สัดส่วนร้อยละผู้สอบผ่าน</h3>
          <p style={{ margin:'0 0 14px', color:'var(--ink-500)', fontSize:13 }}>จำแนกตามจำนวนวิชาผ่าน-ครั้งแรก จากผู้ส่งผลแล้ว {evaluated.length} คน</p>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
            <Donut segments={passSegs} size={184} thickness={28}
              center={<><div className="tnum" style={{ fontSize:30, fontWeight:800 }}>{fullPassRate}%</div><div style={{ fontSize:11.5, color:'var(--ink-500)' }}>ผ่านครบ</div></>} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {passSegs.map(s=>(
              <div key={s.key} style={{ display:'flex', alignItems:'center', gap:9, fontSize:13.5 }}>
                <span style={{ width:11, height:11, borderRadius:3, background:s.color, flex:'none' }}></span>
                <span style={{ color:'var(--ink-700)' }}>{s.label}</span>
                <span className="tnum" style={{ marginLeft:'auto', fontWeight:700 }}>{s.value}</span>
                <span className="tnum" style={{ color:'var(--ink-400)', width:42, textAlign:'right', fontSize:12.5 }}>{evaluated.length?Math.round(s.value/evaluated.length*100):0}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* คอลัมน์ขวา — อัตราผ่านรายวิชา */}
        <div className="card card-pad" style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
            <div><h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>อัตราการสอบผ่านรายวิชา</h3>
              <p style={{ margin:'3px 0 0', color:'var(--ink-500)', fontSize:13 }}>ร้อยละผู้สอบผ่านในแต่ละวิชา (8 วิชา)</p></div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
              <span className="chip" style={{ background:'var(--status-ok-bg)', color:'var(--status-ok-fg)', fontWeight:700 }}>เฉลี่ย {st.overallPassRate}%</span>
              <span style={{ fontSize:10.5, color:'var(--ink-400)' }}>ผ่านครบทุกวิชา</span>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:15 }}>
            {[...st.perSubject].sort((a,b)=>b.rate-a.rate).map(s=>(
              <BarRow key={s.id} label={s.name} value={s.rate} right={s.rate+'%'}
                color={s.rate>=80?'var(--pass)':s.rate>=60?'#c9971f':'var(--fail)'}
                sub={`ผ่าน ${s.pass} · ไม่ผ่าน ${s.fail}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
