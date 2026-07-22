/* ============================================================
   ผู้บริหาร — Dashboard ภาพรวม (ดูอย่างเดียว แก้ไขข้อมูลไม่ได้)
   ============================================================ */
import { useState, useMemo } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { PageHead, StatCard } from '../../components/ui.jsx';
import { BarRow, ColumnChart, MultiLineChart } from '../../components/charts.jsx';
import { ROUNDS, STUDENTS, computeStats, plural, YEARS, YEARLY, YEAR_COMPARE } from '../../mock/mockData.js';

/* ปุ่มเลือกปีการศึกษา */
function YearSelect({ year, setYear }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position:'relative' }}>
      <button className="btn btn-ghost" onClick={()=>setOpen(o=>!o)}>
        <Icon name="calendar" size={16}/> ปีการศึกษา {year} <Icon name="chevD" size={15}/></button>
      {open && <>
        <div style={{ position:'fixed', inset:0, zIndex:30 }} onClick={()=>setOpen(false)}></div>
        <div className="card fade-up" style={{ position:'absolute', right:0, top:'calc(100% + 6px)', zIndex:31, padding:6, minWidth:170, boxShadow:'var(--sh-lg)' }}>
          {YEARS.map(y=>(
            <button key={y} onClick={()=>{ setYear(y); setOpen(false); }} style={{ display:'flex', alignItems:'center', gap:10, width:'100%',
              padding:'9px 11px', borderRadius:8, border:'none', textAlign:'left', fontSize:14, fontWeight: y===year?700:500,
              background: y===year?'var(--blue-50)':'transparent', color: y===year?'var(--navy-700)':'var(--ink-700)' }}>
              ปีการศึกษา {y} {y===YEARS[0] && <span className="chip" style={{ fontSize:10.5, padding:'1px 7px', marginLeft:'auto', background:'var(--status-ok-bg)', color:'var(--status-ok-fg)' }}>ปัจจุบัน</span>}
              {y===year && y!==YEARS[0] && <Icon name="check" size={15} style={{ marginLeft:'auto', color:'var(--blue-600)' }}/>}
            </button>
          ))}
        </div>
      </>}
    </div>
  );
}

export function ExecutiveDashboard({ go }) {
  const [year, setYear] = useState(YEARS[0]);
  const isCurrent = year===YEARS[0];
  const st = useMemo(()=>computeStats(STUDENTS), []);
  const yr = YEARLY[year];
  const prevYr = YEARLY[year-1];
  const firstDelta = prevYr ? yr.firstAttempt - prevYr.firstAttempt : 0;
  const worst = [...st.perSubject].sort((a,b)=>a.rate-b.rate)[0];

  return (
    <div className="fade-up">
      <PageHead title="ภาพรวมผู้บริหาร" sub={`สรุปผลการสอบใบประกอบวิชาชีพ · ปีการศึกษา ${year}`}
        actions={<><YearSelect year={year} setYear={setYear} />
          <button className="btn btn-primary" onClick={()=>go('reports')}><Icon name="report" size={17}/> รายงานฉบับเต็ม</button></>} />

      {/* แถบสรุปตัวเลขสำคัญ อ่านจบใน 10 วินาที */}
      <div className="card" style={{ padding:0, marginBottom:20, overflow:'hidden',
        background:'linear-gradient(135deg,var(--navy-700),var(--navy-900))', color:'#fff' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1.25fr 1fr 1fr', gap:0 }} className="exec-hero">
          <div style={{ padding:'24px 30px', borderRight:'1px solid rgba(255,255,255,.1)' }}>
            <div style={{ fontSize:13.5, opacity:.8, fontWeight:600, marginBottom:6 }}>สอบผ่านครั้งแรก (NLE ครั้งที่ 1)</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
              <span className="tnum" style={{ fontSize:52, fontWeight:800, color:'var(--gold-500)', lineHeight:1 }}>{yr.firstAttempt}%</span>
              {firstDelta!==0 && <span style={{ display:'inline-flex', alignItems:'center', gap:4, color: firstDelta>0?'#7fe0a8':'#ffb4ab', fontSize:14, fontWeight:700 }}>
                <Icon name="trend" size={16}/> {firstDelta>0?'+':''}{firstDelta}%</span>}
            </div>
            <div style={{ fontSize:13, opacity:.78, marginTop:8 }}>{yr.attempts[0].pass} จาก {yr.attempts[0].sat} คน ผ่านในการสอบครั้งแรก</div>
          </div>
          <div style={{ padding:'24px 30px', borderRight:'1px solid rgba(255,255,255,.1)' }}>
            <div style={{ fontSize:13.5, opacity:.8, fontWeight:600, marginBottom:6 }}>ผ่านสะสม (ทุกครั้งที่สอบ)</div>
            <div className="tnum" style={{ fontSize:40, fontWeight:800, lineHeight:1, color:'#7fe0a8' }}>{yr.cumulative}%</div>
            <div className="pbar" style={{ marginTop:12, background:'rgba(255,255,255,.18)' }}><i style={{ width:yr.cumulative+'%', background:'#7fe0a8' }}></i></div>
            <div style={{ fontSize:12.5, opacity:.78, marginTop:8 }}>นักศึกษาทั้งรุ่น {yr.students} คน</div>
          </div>
          <div style={{ padding:'24px 30px' }}>
            <div style={{ fontSize:13.5, opacity:.8, fontWeight:600, marginBottom:6 }}>วิชาที่ต้องเฝ้าระวัง</div>
            <div style={{ fontSize:16.5, fontWeight:700, marginTop:2, lineHeight:1.3 }}>{worst.name}</div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:8, padding:'4px 11px', background:'rgba(224,73,59,.22)', borderRadius:999, fontSize:13, fontWeight:700, color:'#ffb4ab' }}>
              <Icon name="alert" size={14}/> ผ่านเพียง {worst.rate}%</div>
          </div>
        </div>
        <style>{`@media(max-width:860px){.exec-hero{grid-template-columns:1fr!important;}.exec-hero>div{border-right:none!important;border-bottom:1px solid rgba(255,255,255,.1);}}`}</style>
      </div>

      {/* กราฟ: แยกตามครั้งที่สอบ + เทียบ 3 ปี */}
      <div className="row wrap-m" style={{ marginBottom:20 }}>
        <div className="card card-pad" style={{ flex:1, minWidth:0 }}>
          <h3 style={{ margin:'0 0 4px', fontSize:16, fontWeight:800 }}>อัตราสอบผ่านแยกตามครั้งที่สอบ</h3>
          <p style={{ margin:'0 0 14px', color:'var(--ink-500)', fontSize:13 }}>ปีการศึกษา {year} · ร้อยละผู้สอบผ่านในแต่ละครั้งที่เข้าสอบ</p>
          <ColumnChart height={170} fmt={v=>v+'%'} data={yr.attempts.map((a,i)=>({ label:a.label, value:a.rate,
            color:i===0?'var(--navy-600)':i===1?'#8b5e34':'var(--ink-400)' }))} />
          <div style={{ display:'flex', gap:10, marginTop:14 }}>
            {yr.attempts.map((a,i)=>(
              <div key={i} style={{ flex:1, padding:'10px 12px', background:'var(--ink-50)', borderRadius:10, textAlign:'center' }}>
                <div style={{ fontSize:11.5, color:'var(--ink-500)' }}>{a.label}</div>
                <div className="tnum" style={{ fontSize:15, fontWeight:800, marginTop:2 }}>{a.pass}/{a.sat}</div>
                <div style={{ fontSize:11, color:'var(--ink-400)' }}>คน</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card card-pad" style={{ flex:1, minWidth:0 }}>
          <h3 style={{ margin:'0 0 4px', fontSize:16, fontWeight:800 }}>เปรียบเทียบ 3 ปีย้อนหลัง</h3>
          <p style={{ margin:'0 0 14px', color:'var(--ink-500)', fontSize:13 }}>สอบผ่านครั้งแรก เทียบกับผ่านสะสม</p>
          <MultiLineChart height={190}
            categories={YEAR_COMPARE.map(d=>'พ.ศ. '+d.year)}
            series={[
              { label:'สอบผ่านครั้งแรก', color:'var(--navy-600)', values:YEAR_COMPARE.map(d=>d.first) },
              { label:'ผ่านสะสม', color:'var(--pass)', values:YEAR_COMPARE.map(d=>d.cumulative) },
            ]} />
        </div>
      </div>

      {/* สถานะรอบที่เปิดอยู่ — แสดงเฉพาะปีปัจจุบัน */}
      {isCurrent && <>
        <div style={{ display:'flex', alignItems:'center', gap:9, margin:'4px 2px 12px' }}>
          <span className="sec-title">สถานะรอบที่เปิดอยู่</span>
          <span className="chip" style={{ background:'var(--status-wait-bg)', color:'var(--status-wait-fg)', fontWeight:700, fontSize:11.5 }}>รอบ {ROUNDS[0].attempt}/{ROUNDS[0].year}</span>
        </div>
        <div className="grid g-4" style={{ marginBottom:20 }}>
          <StatCard icon="users" label="นักศึกษาทั้งหมด" value={plural(st.total)} tone="navy" />
          <StatCard icon="checkCircle" label="ยืนยันแล้ว" value={plural(st.by.CONFIRMED)} sub={`${Math.round(st.by.CONFIRMED/st.total*100)}%`} tone="ok" />
          <StatCard icon="clock" label="รอตรวจสอบ" value={plural(st.by.SUBMITTED)} tone="wait" />
          <StatCard icon="xCircle" label="ถูกตีกลับ" value={plural(st.by.REJECTED)} tone="reject" />
        </div>
      </>}

      {/* อัตราผ่านรายวิชา */}
      <div className="card card-pad">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>อัตราการสอบผ่านรายวิชา</h3>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
            <span className="chip" style={{ background:'var(--status-ok-bg)', color:'var(--status-ok-fg)', fontWeight:700 }}>เฉลี่ย {st.overallPassRate}%</span>
            <span style={{ fontSize:10.5, color:'var(--ink-400)' }}>ผ่านครบทุกวิชา</span>
          </div>
        </div>
        <div className="grid g-2" style={{ gap:'14px 30px' }}>
          {st.perSubject.map(s=>(
            <BarRow key={s.id} label={s.name} value={s.rate} right={s.rate+'%'}
              color={s.rate>=80?'var(--pass)':s.rate>=60?'#c9971f':'var(--fail)'}
              sub={`ผ่าน ${s.pass} · ไม่ผ่าน ${s.fail} จาก ${s.pass+s.fail} คน`} />
          ))}
        </div>
      </div>
    </div>
  );
}
