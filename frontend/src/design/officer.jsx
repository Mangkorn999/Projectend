/* ============================================================
   Officer screens — dashboard, review, management
   ============================================================ */
import { useState, useEffect, useMemo } from 'react';
import { Icon, ROUNDS, STUDENTS, SUBJECTS, computeStats, TREND, plural, ROOMS } from './data.jsx';
import { PageHead, StatCard, Donut, BarRow, ColumnChart, LineChart, Avatar, Modal, Empty, StatusBadge, PassBadge } from './components.jsx';

/* ---------- Officer Dashboard (variation-driven) ---------- */
export function OfficerDashboard({ go, tweaks }) {
  const variant = tweaks?.dashboardStyle || 'kpi';
  const st = useMemo(()=>computeStats(STUDENTS), []);
  const segs = [
    { key:'CONFIRMED', label:'ยืนยันแล้ว', value:st.by.CONFIRMED, color:'var(--status-ok-dot)' },
    { key:'SUBMITTED', label:'รอตรวจสอบ', value:st.by.SUBMITTED, color:'var(--status-wait-dot)' },
    { key:'REJECTED',  label:'ถูกตีกลับ', value:st.by.REJECTED,  color:'var(--status-reject-dot)' },
    { key:'DRAFT',     label:'ยังไม่กรอก', value:st.by.DRAFT,     color:'var(--ink-300)' },
  ];

  return (
    <div className="fade-up">
      <PageHead title="ภาพรวมระบบ (Dashboard)" sub={`รอบที่ ${ROUNDS[0].attempt} ปีการศึกษา ${ROUNDS[0].year} · ปิดรับ ${ROUNDS[0].close}`}
        actions={<>
          <button className="btn btn-ghost"><Icon name="calendar" size={16}/> รอบ {ROUNDS[0].attempt}/{ROUNDS[0].year} <Icon name="chevD" size={15}/></button>
          <button className="btn btn-primary" onClick={()=>go('review')}><Icon name="checkCircle" size={17}/> ตรวจสอบรายการ <span className="nav-badge" style={{ background:'var(--gold-500)', color:'#3a2c05', marginLeft:2 }}>{st.by.SUBMITTED}</span></button>
        </>} />

      {/* KPI row — shared across variants */}
      <div className="grid g-5" style={{ marginBottom:20 }}>
        <StatCard icon="users" label="นักศึกษาทั้งหมด" value={plural(st.total)} sub={`ปีการศึกษา ${ROUNDS[0].year}`} tone="navy" accent onClick={()=>go('students')} />
        <StatCard icon="edit" label="กรอกแล้ว" value={plural(st.submitted)} sub={`${st.fillRate}% ของทั้งหมด`} tone="blue" accent onClick={()=>go('students')} />
        <StatCard icon="clock" label="รอตรวจสอบ" value={plural(st.by.SUBMITTED)} sub="ต้องดำเนินการ" tone="wait" accent onClick={()=>go('review')} />
        <StatCard icon="checkCircle" label="ยืนยันแล้ว" value={plural(st.by.CONFIRMED)} sub={`${Math.round(st.by.CONFIRMED/st.total*100)}% ของทั้งหมด`} tone="ok" accent />
        <StatCard icon="xCircle" label="ถูกตีกลับ" value={plural(st.by.REJECTED)} sub="รอนักศึกษาแก้ไข" tone="reject" accent onClick={()=>go('review')} />
      </div>

      {variant==='kpi'    && <DashKPI st={st} segs={segs} go={go} />}
      {variant==='charts' && <DashCharts st={st} segs={segs} go={go} />}
      {variant==='ops'    && <DashOps st={st} segs={segs} go={go} />}
    </div>
  );
}

/* Variant A: balanced KPI + donut + subject bars */
function DashKPI({ st, segs }) {
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
    <div className="row wrap-m" style={{ alignItems:'stretch' }}>
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
      <div className="card card-pad" style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
          <div><h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>อัตราการสอบผ่านรายวิชา</h3>
            <p style={{ margin:'3px 0 0', color:'var(--ink-500)', fontSize:13 }}>ร้อยละผู้สอบผ่านในแต่ละวิชา (8 วิชา)</p></div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
              <span className="chip" style={{ background:'var(--status-ok-bg)', color:'var(--status-ok-fg)', fontWeight:700 }}>เฉลี่ย {st.overallPassRate}%</span>
              <span style={{ fontSize:10.5, color:'var(--ink-400)' }}>ผ่านครบทุกวิชา</span>
            </div>
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
  );
}

/* Variant B: chart-forward (columns + trend line) */
function DashCharts({ st, segs }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div className="row wrap-m">
        <div className="card card-pad" style={{ flex:1 }}>
          <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:800 }}>จำนวนนักศึกษาตามสถานะ</h3>
          <ColumnChart height={190} data={segs.map(s=>({ label:s.label, value:s.value, color:s.color }))} />
        </div>
        <div className="card card-pad" style={{ flex:1 }}>
          <h3 style={{ margin:'0 0 6px', fontSize:16, fontWeight:800 }}>แนวโน้มอัตราสอบผ่านย้อนหลัง</h3>
          <p style={{ margin:'0 0 18px', color:'var(--ink-500)', fontSize:13 }}>เปรียบเทียบ 3 รอบล่าสุด</p>
          <LineChart points={TREND.map(t=>({ label:t.round, value:t.rate }))} height={170} color="var(--navy-600)" />
        </div>
      </div>
      <div className="card card-pad">
        <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:800 }}>อัตราการสอบผ่านรายวิชา</h3>
        <ColumnChart height={180} fmt={v=>v+'%'} data={st.perSubject.map(s=>({ label:s.code, value:s.rate,
          color:s.rate>=80?'var(--pass)':s.rate>=60?'#c9971f':'var(--fail)' }))} />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginTop:16 }} className="subj-legend">
          {st.perSubject.map(s=>(
            <div key={s.id} style={{ fontSize:11.5, color:'var(--ink-500)' }}><b className="mono" style={{ color:'var(--ink-700)' }}>{s.code}</b> {s.name}</div>
          ))}
        </div>
        <style>{`@media(max-width:680px){.subj-legend{grid-template-columns:repeat(2,1fr)!important;}}`}</style>
      </div>
    </div>
  );
}

/* Variant C: operations-focused (worklist + compact stats) */
function DashOps({ st, segs, go }) {
  const pending = STUDENTS.filter(s=>s.status==='SUBMITTED').slice(0,6);
  return (
    <div className="row wrap-m" style={{ alignItems:'flex-start' }}>
      <div className="card" style={{ flex:1, minWidth:0, overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--ink-100)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div><h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>คิวรอตรวจสอบ</h3>
            <p style={{ margin:'3px 0 0', color:'var(--ink-500)', fontSize:13 }}>รายการที่ต้องดำเนินการก่อน</p></div>
          <button className="btn btn-ghost btn-sm" onClick={()=>go('review')}>ดูทั้งหมด <Icon name="arrowR" size={15}/></button>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table className="tbl">
            <thead><tr><th>นักศึกษา</th><th>ห้อง</th><th>ผลสอบ</th><th>ส่งเมื่อ</th><th></th></tr></thead>
            <tbody>{pending.map(s=>(
              <tr key={s.sid} className="clickable" onClick={()=>go('review')}>
                <td><div style={{ display:'flex', alignItems:'center', gap:10 }}><Avatar name={s.firstName} size={32}/>
                  <div><div style={{ fontWeight:600, fontSize:13.5 }}>{s.firstName} {s.lastName}</div>
                  <div className="mono" style={{ fontSize:11.5, color:'var(--ink-400)' }}>{s.sid}</div></div></div></td>
                <td><span className="chip" style={{ fontSize:12 }}>ห้อง {s.room}</span></td>
                <td className="tnum" style={{ fontWeight:700 }}>{s.passedCount}/8</td>
                <td style={{ color:'var(--ink-500)', fontSize:13 }}>{s.submittedAt}</td>
                <td style={{ textAlign:'right' }}><button className="btn btn-subtle btn-sm">ตรวจสอบ</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <div style={{ width:300, flex:'none', display:'flex', flexDirection:'column', gap:16 }} className="exam-aside">
        <div className="card card-pad">
          <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:800 }}>สรุปสถานะ</h3>
          <Donut segments={segs} size={150} thickness={22}
            center={<><div className="tnum" style={{ fontSize:22, fontWeight:800 }}>{st.total}</div><div style={{ fontSize:10.5, color:'var(--ink-500)' }}>คน</div></>} />
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:14 }}>
            {segs.map(s=>(<div key={s.key} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
              <span style={{ width:9, height:9, borderRadius:2, background:s.color }}></span>{s.label}
              <span className="tnum" style={{ marginLeft:'auto', fontWeight:700 }}>{s.value}</span></div>))}
          </div>
        </div>
        <div className="card card-pad" style={{ background:'linear-gradient(150deg,var(--navy-700),var(--navy-800))', color:'#fff' }}>
          <div style={{ fontSize:13, opacity:.8, fontWeight:600 }}>อัตราสอบผ่านรวม</div>
          <div className="tnum" style={{ fontSize:38, fontWeight:800, color:'var(--gold-500)', margin:'4px 0' }}>{st.overallPassRate}%</div>
          <div style={{ fontSize:12.5, opacity:.8 }}>ผ่านครบ 8 วิชา {st.fullyPassed} จาก {st.submitted} คน</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Student list ---------- */
export function OfficerStudents({ go, setSel }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [room, setRoom] = useState('ALL');
  const filtered = STUDENTS.filter(s=>{
    if(status!=='ALL' && s.status!==status) return false;
    if(room!=='ALL' && s.room!==room) return false;
    if(q && !(`${s.firstName}${s.lastName}${s.sid}`.includes(q))) return false;
    return true;
  });
  const [page, setPage] = useState(0); const per=10;
  const pageRows = filtered.slice(page*per,(page+1)*per);
  const pages = Math.ceil(filtered.length/per);
  useEffect(()=>setPage(0),[q,status,room]);

  return (
    <div className="fade-up">
      <PageHead title="ข้อมูลนักศึกษา" sub={`พบ ${filtered.length} จาก ${STUDENTS.length} คน`}
        actions={<button className="btn btn-ghost"><Icon name="download" size={16}/> ส่งออก Excel</button>} />
      {/* filters */}
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

/* ---------- Student detail / review ---------- */
export function StudentDetail({ student, go, toast, readonly }) {
  const s = student || STUDENTS[0];
  const [status, setStatus] = useState(s.status);
  const [reject, setReject] = useState(false);
  const [remark, setRemark] = useState('');
  const passed = s.subjects.filter(x=>x.passed===true).length;

  return (
    <div className="fade-up">
      <PageHead title={`${s.prefix} ${s.firstName} ${s.lastName}`} crumb={<><a onClick={()=>go(readonly?'students':'students')} style={{cursor:'pointer'}}>ข้อมูลนักศึกษา</a> <Icon name="chevR" size={13}/> รายละเอียด</>}
        sub={<span className="mono">{s.sid} · ห้อง {s.room} · ปีการศึกษา {s.year}</span>}
        actions={<button className="btn btn-ghost" onClick={()=>go('students')}><Icon name="chevL" size={16}/> กลับ</button>} />

      <div className="row wrap-m" style={{ alignItems:'flex-start' }}>
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:18 }}>
          {/* result table */}
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
          {/* evidence */}
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

        {/* review aside */}
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
              <Icon name="checkCircle" size={17}/> ยืนยันแล้ว · บันทึกใน audit trail</div>}
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

/* ---------- Review queue ---------- */
export function OfficerReview({ go, setSel }) {
  const [tab, setTab] = useState('SUBMITTED');
  const counts = { SUBMITTED:STUDENTS.filter(s=>s.status==='SUBMITTED').length,
    REJECTED:STUDENTS.filter(s=>s.status==='REJECTED').length, CONFIRMED:STUDENTS.filter(s=>s.status==='CONFIRMED').length };
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
