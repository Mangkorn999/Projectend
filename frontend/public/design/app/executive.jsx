/* ============================================================
   Executive screens — dashboard + reports
   ============================================================ */

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

function ExecutiveDashboard({ go, tweaks }) {
  const [year, setYear] = useState(YEARS[0]);
  const isCurrent = year===YEARS[0];
  const st = useMemo(()=>computeStats(STUDENTS), []);
  const yr = YEARLY[year];
  const prevYr = YEARLY[year-1];
  const firstDelta = prevYr ? yr.firstAttempt - prevYr.firstAttempt : 0;
  const segs = [
    { key:'CONFIRMED', label:'ยืนยันแล้ว', value:st.by.CONFIRMED, color:'var(--status-ok-dot)' },
    { key:'SUBMITTED', label:'รอตรวจสอบ', value:st.by.SUBMITTED, color:'var(--status-wait-dot)' },
    { key:'REJECTED',  label:'ถูกตีกลับ', value:st.by.REJECTED,  color:'var(--status-reject-dot)' },
    { key:'DRAFT',     label:'ยังไม่กรอก', value:st.by.DRAFT,     color:'var(--ink-300)' },
  ];
  const worst = [...st.perSubject].sort((a,b)=>a.rate-b.rate)[0];

  return (
    <div className="fade-up">
      <PageHead title="ภาพรวมผู้บริหาร" sub={`สรุปผลการสอบใบประกอบวิชาชีพ · ปีการศึกษา ${year}`}
        actions={<><YearSelect year={year} setYear={setYear} />
          <button className="btn btn-primary" onClick={()=>go('reports')}><Icon name="report" size={17}/> รายงานฉบับเต็ม</button></>} />

      {/* headline hero — read in 10s: first-attempt + cumulative + watch */}
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

      {/* analytics: per-sitting + 3-year comparison */}
      <div className="row wrap-m" style={{ marginBottom:20 }}>
        <div className="card card-pad" style={{ flex:1, minWidth:0 }}>
          <h3 style={{ margin:'0 0 4px', fontSize:16, fontWeight:800 }}>อัตราสอบผ่านแยกตามครั้งที่สอบ</h3>
          <p style={{ margin:'0 0 14px', color:'var(--ink-500)', fontSize:13 }}>ปีการศึกษา {year} · ร้อยละผู้สอบผ่านในแต่ละครั้งที่เข้าสอบ</p>
          <ColumnChart height={170} fmt={v=>v+'%'} data={yr.attempts.map((a,i)=>({ label:a.label, value:a.rate,
            color:i===0?'var(--navy-600)':i===1?'var(--gold-500)':'var(--ink-400)' }))} />
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

      {/* status KPIs — current open round only */}
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

      {/* per-subject */}
      <div className="card card-pad">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>อัตราการสอบผ่านรายวิชา</h3>
          <span className="chip" style={{ background:'var(--status-ok-bg)', color:'var(--status-ok-fg)', fontWeight:700 }}>เฉลี่ย {st.overallPassRate}%</span>
        </div>
        <div className="grid g-2" style={{ gap:'14px 30px' }}>
          {st.perSubject.map(s=>(
            <BarRow key={s.id} label={s.name} value={s.rate} right={s.rate+'%'}
              color={s.rate>=80?'var(--pass)':s.rate>=60?'var(--gold-500)':'var(--fail)'}
              sub={`ผ่าน ${s.pass} · ไม่ผ่าน ${s.fail} จาก ${s.pass+s.fail} คน`} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Reports (printable) ---------- */
function Reports({ toast }) {
  const st = useMemo(()=>computeStats(STUDENTS), []);
  return (
    <div className="fade-up">
      <PageHead title="รายงานสรุปผลการสอบ" sub={`รอบที่ ${ROUNDS[0].attempt} ปีการศึกษา ${ROUNDS[0].year}`}
        actions={<>
          <button className="btn btn-ghost no-print" onClick={()=>window.print()}><Icon name="printer" size={16}/> พิมพ์</button>
          <button className="btn btn-ghost no-print" onClick={()=>toast('กำลังส่งออก Excel…','info')}><Icon name="download" size={16}/> Excel</button>
          <button className="btn btn-primary no-print" onClick={()=>toast('กำลังสร้างไฟล์ PDF…','info')}><Icon name="pdf" size={16}/> ส่งออก PDF</button>
        </>} />

      {/* report sheet */}
      <div className="card" style={{ padding:'34px 40px', maxWidth:900, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, paddingBottom:18, borderBottom:'2px solid var(--navy-700)' }}>
          <Logo size={48} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--navy-700)' }}>รายงานสรุปผลการสอบใบประกอบวิชาชีพการพยาบาล</div>
            <div style={{ fontSize:13, color:'var(--ink-500)' }}>คณะพยาบาลศาสตร์ มหาวิทยาลัยสงขลานครินทร์ · รอบที่ {ROUNDS[0].attempt}/{ROUNDS[0].year}</div>
          </div>
          <div style={{ textAlign:'right', fontSize:12, color:'var(--ink-500)' }}>ออกรายงาน<br/>5 มิ.ย. 2569</div>
        </div>

        {/* summary numbers */}
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

        {/* by status */}
        <div className="sec-title" style={{ margin:'26px 0 12px' }}>2. จำแนกตามสถานะ</div>
        <table className="tbl" style={{ border:'1px solid var(--ink-200)', borderRadius:10, overflow:'hidden' }}>
          <thead><tr><th>สถานะ</th><th style={{ textAlign:'right' }}>จำนวน (คน)</th><th style={{ textAlign:'right' }}>ร้อยละ</th></tr></thead>
          <tbody>{[['ยืนยันแล้ว','CONFIRMED'],['รอตรวจสอบ','SUBMITTED'],['ถูกตีกลับ','REJECTED'],['ยังไม่กรอก','DRAFT']].map(([l,k])=>(
            <tr key={k}><td><StatusBadge status={k}/></td>
              <td className="tnum" style={{ textAlign:'right', fontWeight:700 }}>{st.by[k]}</td>
              <td className="tnum" style={{ textAlign:'right', color:'var(--ink-600)' }}>{Math.round(st.by[k]/st.total*100)}%</td></tr>
          ))}</tbody>
        </table>

        {/* by subject */}
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
          <span>ระบบบันทึกใบอนุญาตประกอบวิชาชีพ · คณะพยาบาลศาสตร์ มอ.</span>
          <span>หน้า 1/1</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ExecutiveDashboard, Reports });
