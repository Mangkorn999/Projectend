/* ============================================================
   Officer screens — dashboard, review, management
   ============================================================ */
import { useState, useEffect, useMemo } from 'react';
import { Icon, ROUNDS, STUDENTS, SUBJECTS, computeStats, TREND, plural, ROOMS } from './data.jsx';
import { PageHead, StatCard, Donut, BarRow, ColumnChart, LineChart, Avatar, Modal, Empty, StatusBadge, PassBadge } from './components.jsx';
import { t, pick } from './i18n.js';

/* ---------- Officer Dashboard (variation-driven) ---------- */
export function OfficerDashboard({ go, tweaks, lang='TH' }) {
  const variant = tweaks?.dashboardStyle || 'kpi';
  const st = useMemo(()=>computeStats(STUDENTS), []);
  const segs = [
    { key:'CONFIRMED', label:t(lang,'status.CONFIRMED'), value:st.by.CONFIRMED, color:'var(--status-ok-dot)' },
    { key:'SUBMITTED', label:t(lang,'status.SUBMITTED'), value:st.by.SUBMITTED, color:'var(--status-wait-dot)' },
    { key:'REJECTED',  label:t(lang,'status.REJECTED'),  value:st.by.REJECTED,  color:'var(--status-reject-dot)' },
    { key:'DRAFT',     label:t(lang,'status.DRAFT'),     value:st.by.DRAFT,     color:'var(--ink-300)' },
  ];

  return (
    <div className="fade-up">
      <PageHead title={t(lang,'officer.dashboard.title')} sub={t(lang,'officer.dashboard.sub',{attempt:ROUNDS[0].attempt,year:ROUNDS[0].year,close:pick(lang,ROUNDS[0],'close')})}
        actions={<>
          <button className="btn btn-ghost"><Icon name="calendar" size={16}/> {t(lang,'officer.dashboard.roundBtn',{attempt:ROUNDS[0].attempt,year:ROUNDS[0].year})} <Icon name="chevD" size={15}/></button>
          <button className="btn btn-primary" onClick={()=>go('review')}><Icon name="checkCircle" size={17}/> {t(lang,'officer.dashboard.reviewBtn')} <span className="nav-badge" style={{ background:'var(--gold-500)', color:'#3a2c05', marginLeft:2 }}>{st.by.SUBMITTED}</span></button>
        </>} />

      {/* KPI row — shared across variants */}
      <div className="grid g-5" style={{ marginBottom:20 }}>
        <StatCard icon="users" label={t(lang,'officer.dashboard.totalStudents')} value={plural(st.total)} sub={t(lang,'officer.dashboard.yearSub',{year:ROUNDS[0].year})} tone="navy" accent onClick={()=>go('students')} />
        <StatCard icon="edit" label={t(lang,'officer.dashboard.filled')} value={plural(st.submitted)} sub={t(lang,'officer.dashboard.filledSub',{rate:st.fillRate})} tone="blue" accent onClick={()=>go('students')} />
        <StatCard icon="clock" label={t(lang,'status.SUBMITTED')} value={plural(st.by.SUBMITTED)} sub={t(lang,'officer.dashboard.pendingSub')} tone="wait" accent onClick={()=>go('review')} />
        <StatCard icon="checkCircle" label={t(lang,'status.CONFIRMED')} value={plural(st.by.CONFIRMED)} sub={t(lang,'officer.dashboard.confirmedSub',{rate:Math.round(st.by.CONFIRMED/st.total*100)})} tone="ok" accent />
        <StatCard icon="xCircle" label={t(lang,'status.REJECTED')} value={plural(st.by.REJECTED)} sub={t(lang,'officer.dashboard.rejectedSub')} tone="reject" accent onClick={()=>go('review')} />
      </div>

      {variant==='kpi'    && <DashKPI st={st} segs={segs} go={go} lang={lang} />}
      {variant==='charts' && <DashCharts st={st} segs={segs} go={go} lang={lang} />}
      {variant==='ops'    && <DashOps st={st} segs={segs} go={go} lang={lang} />}
    </div>
  );
}

/* Variant A: balanced KPI + donut + subject bars */
function DashKPI({ st, segs, lang='TH' }) {
  const evaluated = STUDENTS.filter(s=>s.status!=='DRAFT');
  const passSegs = [
    { key:'FULL', label:t(lang,'officer.dash.passFull'), value:evaluated.filter(s=>s.passedCount===8).length, color:'var(--pass)' },
    { key:'P7',   label:t(lang,'officer.dash.pass7'),    value:evaluated.filter(s=>s.passedCount===7).length, color:'#e8c02f' },
    { key:'P6',   label:t(lang,'officer.dash.pass6'),    value:evaluated.filter(s=>s.passedCount===6).length, color:'#e8951f' },
    { key:'P5',   label:t(lang,'officer.dash.pass5'),    value:evaluated.filter(s=>s.passedCount===5).length, color:'#d97319' },
    { key:'LOW',  label:t(lang,'officer.dash.passLow'), value:evaluated.filter(s=>s.passedCount<5).length, color:'var(--fail)' },
  ];
  const fullPassRate = evaluated.length ? Math.round(passSegs[0].value/evaluated.length*100) : 0;

  return (
    <div className="row wrap-m" style={{ alignItems:'stretch' }}>
      <div className="card card-pad" style={{ flex:'0 0 340px' }}>
        <h3 style={{ margin:'0 0 4px', fontSize:16, fontWeight:800 }}>{t(lang,'officer.dash.fillTitle')}</h3>
        <p style={{ margin:'0 0 14px', color:'var(--ink-500)', fontSize:13 }}>{t(lang,'officer.dash.fillSub',{total:st.total})}</p>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
          <Donut segments={segs} size={184} thickness={28}
            center={<><div className="tnum" style={{ fontSize:30, fontWeight:800 }}>{st.fillRate}%</div><div style={{ fontSize:11.5, color:'var(--ink-500)' }}>{t(lang,'officer.dashboard.filled')}</div></>} />
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

        <h3 style={{ margin:'0 0 4px', fontSize:16, fontWeight:800 }}>{t(lang,'officer.dash.passTitle')}</h3>
        <p style={{ margin:'0 0 14px', color:'var(--ink-500)', fontSize:13 }}>{t(lang,'officer.dash.passSub',{count:evaluated.length})}</p>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
          <Donut segments={passSegs} size={184} thickness={28}
            center={<><div className="tnum" style={{ fontSize:30, fontWeight:800 }}>{fullPassRate}%</div><div style={{ fontSize:11.5, color:'var(--ink-500)' }}>{t(lang,'officer.dash.passRateLabel')}</div></>} />
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
          <div><h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>{t(lang,'officer.dash.subjectRateTitle')}</h3>
            <p style={{ margin:'3px 0 0', color:'var(--ink-500)', fontSize:13 }}>{t(lang,'officer.dash.subjectRateSub')}</p></div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
              <span className="chip" style={{ background:'var(--status-ok-bg)', color:'var(--status-ok-fg)', fontWeight:700 }}>{t(lang,'officer.dash.avgChip',{rate:st.overallPassRate})}</span>
              <span style={{ fontSize:10.5, color:'var(--ink-400)' }}>{t(lang,'officer.dash.avgSub')}</span>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:15 }}>
          {[...st.perSubject].sort((a,b)=>b.rate-a.rate).map(s=>(
            <BarRow key={s.id} label={pick(lang,s,'name')} value={s.rate} right={s.rate+'%'}
              color={s.rate>=80?'var(--pass)':s.rate>=60?'#c9971f':'var(--fail)'}
              sub={t(lang,'officer.dash.passFailSub',{pass:s.pass,fail:s.fail})} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* Variant B: chart-forward (columns + trend line) */
function DashCharts({ st, segs, lang='TH' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div className="row wrap-m">
        <div className="card card-pad" style={{ flex:1 }}>
          <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:800 }}>{t(lang,'officer.charts.byStatus')}</h3>
          <ColumnChart height={190} data={segs.map(s=>({ label:s.label, value:s.value, color:s.color }))} />
        </div>
        <div className="card card-pad" style={{ flex:1 }}>
          <h3 style={{ margin:'0 0 6px', fontSize:16, fontWeight:800 }}>{t(lang,'officer.charts.trendTitle')}</h3>
          <p style={{ margin:'0 0 18px', color:'var(--ink-500)', fontSize:13 }}>{t(lang,'officer.charts.trendSub')}</p>
          <LineChart points={TREND.map(tr=>({ label:tr.round, value:tr.rate }))} height={170} color="var(--navy-600)" />
        </div>
      </div>
      <div className="card card-pad">
        <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:800 }}>{t(lang,'officer.dash.subjectRateTitle')}</h3>
        <ColumnChart height={180} fmt={v=>v+'%'} data={st.perSubject.map(s=>({ label:s.code, value:s.rate,
          color:s.rate>=80?'var(--pass)':s.rate>=60?'#c9971f':'var(--fail)' }))} />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginTop:16 }} className="subj-legend">
          {st.perSubject.map(s=>(
            <div key={s.id} style={{ fontSize:11.5, color:'var(--ink-500)' }}><b className="mono" style={{ color:'var(--ink-700)' }}>{s.code}</b> {pick(lang,s,'name')}</div>
          ))}
        </div>
        <style>{`@media(max-width:680px){.subj-legend{grid-template-columns:repeat(2,1fr)!important;}}`}</style>
      </div>
    </div>
  );
}

/* Variant C: operations-focused (worklist + compact stats) */
function DashOps({ st, segs, go, lang='TH' }) {
  const pending = STUDENTS.filter(s=>s.status==='SUBMITTED').slice(0,6);
  return (
    <div className="row wrap-m" style={{ alignItems:'flex-start' }}>
      <div className="card" style={{ flex:1, minWidth:0, overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--ink-100)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div><h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>{t(lang,'officer.ops.queueTitle')}</h3>
            <p style={{ margin:'3px 0 0', color:'var(--ink-500)', fontSize:13 }}>{t(lang,'officer.ops.queueSub')}</p></div>
          <button className="btn btn-ghost btn-sm" onClick={()=>go('review')}>{t(lang,'officer.ops.viewAll')} <Icon name="arrowR" size={15}/></button>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table className="tbl">
            <thead><tr><th>{t(lang,'officer.ops.colStudent')}</th><th>{t(lang,'officer.ops.colRoom')}</th><th>{t(lang,'officer.ops.colResult')}</th><th>{t(lang,'officer.ops.colSubmitted')}</th><th></th></tr></thead>
            <tbody>{pending.map(s=>(
              <tr key={s.sid} className="clickable" onClick={()=>go('review')}>
                <td><div style={{ display:'flex', alignItems:'center', gap:10 }}><Avatar name={s.firstName} size={32}/>
                  <div><div style={{ fontWeight:600, fontSize:13.5 }}>{s.firstName} {s.lastName}</div>
                  <div className="mono" style={{ fontSize:11.5, color:'var(--ink-400)' }}>{s.sid}</div></div></div></td>
                <td><span className="chip" style={{ fontSize:12 }}>{t(lang,'officer.ops.roomChip',{room:s.room})}</span></td>
                <td className="tnum" style={{ fontWeight:700 }}>{s.passedCount}/8</td>
                <td style={{ color:'var(--ink-500)', fontSize:13 }}>{pick(lang,s,'submittedAt')}</td>
                <td style={{ textAlign:'right' }}><button className="btn btn-subtle btn-sm">{t(lang,'officer.ops.reviewBtn')}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <div style={{ width:300, flex:'none', display:'flex', flexDirection:'column', gap:16 }} className="exam-aside">
        <div className="card card-pad">
          <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:800 }}>{t(lang,'officer.ops.summaryTitle')}</h3>
          <Donut segments={segs} size={150} thickness={22}
            center={<><div className="tnum" style={{ fontSize:22, fontWeight:800 }}>{st.total}</div><div style={{ fontSize:10.5, color:'var(--ink-500)' }}>{t(lang,'officer.ops.unitPeople')}</div></>} />
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:14 }}>
            {segs.map(s=>(<div key={s.key} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
              <span style={{ width:9, height:9, borderRadius:2, background:s.color }}></span>{s.label}
              <span className="tnum" style={{ marginLeft:'auto', fontWeight:700 }}>{s.value}</span></div>))}
          </div>
        </div>
        <div className="card card-pad" style={{ background:'linear-gradient(150deg,var(--navy-700),var(--navy-800))', color:'#fff' }}>
          <div style={{ fontSize:13, opacity:.8, fontWeight:600 }}>{t(lang,'officer.ops.overallRateTitle')}</div>
          <div className="tnum" style={{ fontSize:38, fontWeight:800, color:'var(--gold-500)', margin:'4px 0' }}>{st.overallPassRate}%</div>
          <div style={{ fontSize:12.5, opacity:.8 }}>{t(lang,'officer.ops.overallRateSub',{full:st.fullyPassed,submitted:st.submitted})}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Student list ---------- */
export function OfficerStudents({ go, setSel, lang='TH' }) {
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
      <PageHead title={t(lang,'officer.students.title')} sub={t(lang,'officer.students.sub',{found:filtered.length,total:STUDENTS.length})}
        actions={<button className="btn btn-ghost"><Icon name="download" size={16}/> {t(lang,'officer.students.exportBtn')}</button>} />
      {/* filters */}
      <div className="card" style={{ padding:14, marginBottom:18, display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:'1 1 240px' }}>
          <Icon name="search" size={18} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--ink-400)' }} />
          <input className="input" placeholder={t(lang,'officer.students.searchPh')} value={q} onChange={e=>setQ(e.target.value)} style={{ paddingLeft:40 }} />
        </div>
        <select className="select" style={{ width:'auto', minWidth:150 }} value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="ALL">{t(lang,'officer.students.allStatus')}</option><option value="SUBMITTED">{t(lang,'status.SUBMITTED')}</option>
          <option value="CONFIRMED">{t(lang,'status.CONFIRMED')}</option><option value="REJECTED">{t(lang,'status.REJECTED')}</option><option value="DRAFT">{t(lang,'status.DRAFT')}</option>
        </select>
        <select className="select" style={{ width:'auto', minWidth:120 }} value={room} onChange={e=>setRoom(e.target.value)}>
          <option value="ALL">{t(lang,'officer.students.allRoom')}</option>{ROOMS.map(r=><option key={r} value={r}>{t(lang,'officer.students.roomOpt',{room:r})}</option>)}
        </select>
      </div>
      <div className="card" style={{ overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table className="tbl">
            <thead><tr><th>{t(lang,'officer.students.colStudent')}</th><th>{t(lang,'officer.students.colRoom')}</th><th>{t(lang,'officer.students.colResult')}</th><th>{t(lang,'officer.students.colStatus')}</th><th>{t(lang,'officer.students.colSubmitted')}</th><th></th></tr></thead>
            <tbody>
              {pageRows.map(s=>(
                <tr key={s.sid} className="clickable" onClick={()=>{ setSel(s); go('detail'); }}>
                  <td><div style={{ display:'flex', alignItems:'center', gap:11 }}><Avatar name={s.firstName} size={34}/>
                    <div><div style={{ fontWeight:600, fontSize:14 }}>{s.prefix} {s.firstName} {s.lastName}</div>
                    <div className="mono" style={{ fontSize:12, color:'var(--ink-400)' }}>{s.sid}</div></div></div></td>
                  <td><span className="chip" style={{ fontSize:12 }}>{t(lang,'officer.ops.roomChip',{room:s.room})}</span></td>
                  <td>{s.status==='DRAFT'? <span style={{ color:'var(--ink-400)' }}>—</span> :
                    <span className="tnum" style={{ fontWeight:700, color: s.allPass?'var(--pass)':'var(--ink-800)' }}>{s.passedCount}/8</span>}</td>
                  <td><StatusBadge status={s.status} lang={lang} /></td>
                  <td style={{ color:'var(--ink-500)', fontSize:13 }}>{pick(lang,s,'submittedAt')||'—'}</td>
                  <td style={{ textAlign:'right' }}><Icon name="chevR" size={18} style={{ color:'var(--ink-300)' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages>1 && <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px', borderTop:'1px solid var(--ink-100)' }}>
          <span style={{ fontSize:13, color:'var(--ink-500)' }}>{t(lang,'officer.students.pageInfo',{page:page+1,pages})}</span>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-ghost btn-sm" disabled={page===0} onClick={()=>setPage(p=>p-1)}><Icon name="chevL" size={15}/> {t(lang,'officer.students.prevBtn')}</button>
            <button className="btn btn-ghost btn-sm" disabled={page>=pages-1} onClick={()=>setPage(p=>p+1)}>{t(lang,'officer.students.nextBtn')} <Icon name="chevR" size={15}/></button>
          </div>
        </div>}
      </div>
    </div>
  );
}

/* ---------- Student detail / review ---------- */
export function StudentDetail({ student, go, toast, readonly, lang='TH' }) {
  const s = student || STUDENTS[0];
  const [status, setStatus] = useState(s.status);
  const [reject, setReject] = useState(false);
  const [remark, setRemark] = useState('');
  const passed = s.subjects.filter(x=>x.passed===true).length;
  const quickReasons = [t(lang,'officer.detail.quickReason1'),t(lang,'officer.detail.quickReason2'),t(lang,'officer.detail.quickReason3')];

  return (
    <div className="fade-up">
      <PageHead title={`${s.prefix} ${s.firstName} ${s.lastName}`} crumb={<><a onClick={()=>go(readonly?'students':'students')} style={{cursor:'pointer'}}>{t(lang,'officer.detail.crumbList')}</a> <Icon name="chevR" size={13}/> {t(lang,'officer.detail.crumbDetail')}</>}
        sub={<span className="mono">{s.sid} · {t(lang,'officer.detail.subInfo',{room:s.room,year:s.year})}</span>}
        actions={<button className="btn btn-ghost" onClick={()=>go('students')}><Icon name="chevL" size={16}/> {t(lang,'officer.detail.backBtn')}</button>} />

      <div className="row wrap-m" style={{ alignItems:'flex-start' }}>
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:18 }}>
          {/* result table */}
          <div className="card" style={{ overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--ink-100)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>{t(lang,'officer.detail.resultsTitle')}</h3>
              <span className="tnum chip" style={{ background: s.allPass?'var(--status-ok-bg)':'var(--ink-100)', color: s.allPass?'var(--status-ok-fg)':'var(--ink-700)', fontWeight:700 }}>{t(lang,'officer.detail.passChip',{passed})}</span>
            </div>
            <table className="tbl">
              <thead><tr><th style={{ width:60 }}>{t(lang,'officer.detail.colCode')}</th><th>{t(lang,'officer.detail.colSubject')}</th><th style={{ textAlign:'right' }}>{t(lang,'officer.detail.colResult')}</th></tr></thead>
              <tbody>{SUBJECTS.map(sub=>{ const r=s.subjects.find(x=>x.id===sub.id);
                return <tr key={sub.id}><td className="mono" style={{ color:'var(--ink-400)' }}>{sub.code}</td>
                  <td style={{ fontWeight:500 }}>{pick(lang,sub,'name')}</td>
                  <td style={{ textAlign:'right' }}><PassBadge passed={r?.passed} lang={lang} /></td></tr>;
              })}</tbody>
            </table>
          </div>
          {/* evidence */}
          <div className="card card-pad">
            <h3 style={{ margin:'0 0 14px', fontSize:16, fontWeight:800 }}>{t(lang,'officer.detail.evidenceTitle')}</h3>
            {s.files.length? s.files.map((f,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', border:'1px solid var(--ink-200)', borderRadius:11, marginBottom:8 }}>
                <div style={{ width:40, height:40, borderRadius:9, background:'var(--status-reject-bg)', color:'var(--status-reject-fg)', display:'flex', alignItems:'center', justifyContent:'center', flex:'none' }}><Icon name="pdf" size={21}/></div>
                <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:13.5, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</div>
                  <div style={{ fontSize:12, color:'var(--ink-500)' }}>{f.size} · PDF</div></div>
                <button className="btn btn-ghost btn-sm"><Icon name="eye" size={15}/> {t(lang,'officer.detail.viewBtn')}</button>
                <button className="btn btn-ghost btn-sm"><Icon name="download" size={15}/></button>
              </div>
            )) : <Empty icon="doc" title={t(lang,'officer.detail.noEvidence')} />}
          </div>
        </div>

        {/* review aside */}
        <div style={{ width:312, flex:'none', display:'flex', flexDirection:'column', gap:16 }} className="exam-aside">
          <div className="card card-pad">
            <div style={{ fontSize:13, color:'var(--ink-500)', fontWeight:600, marginBottom:8 }}>{t(lang,'officer.detail.reviewStatusTitle')}</div>
            <StatusBadge status={status} size="lg" lang={lang} />
            {s.remark && status==='REJECTED' && <div style={{ marginTop:12, padding:'11px 13px', background:'var(--status-reject-bg)', borderRadius:10, fontSize:13, color:'var(--status-reject-fg)' }}>
              <b>{t(lang,'officer.detail.rejectReasonLabel')}</b><br/>{pick(lang,s,'remark')}</div>}
            {!readonly && status==='SUBMITTED' && <div style={{ display:'flex', flexDirection:'column', gap:9, marginTop:16 }}>
              <button className="btn btn-success btn-block btn-lg" onClick={()=>{ setStatus('CONFIRMED'); toast(t(lang,'officer.detail.confirmToast')); }}>
                <Icon name="checkCircle" size={18}/> {t(lang,'officer.detail.confirmBtn')}</button>
              <button className="btn btn-danger btn-block" onClick={()=>setReject(true)}>
                <Icon name="xCircle" size={17}/> {t(lang,'officer.detail.rejectBtn')}</button>
            </div>}
            {!readonly && status==='CONFIRMED' && <div style={{ marginTop:14, padding:'11px 13px', background:'var(--status-ok-bg)', borderRadius:10, fontSize:13, color:'var(--status-ok-fg)', display:'flex', gap:8, alignItems:'center' }}>
              <Icon name="checkCircle" size={17}/> {t(lang,'officer.detail.confirmedNote')}</div>}
          </div>
          <div className="card card-pad">
            <div style={{ fontSize:13, color:'var(--ink-500)', fontWeight:600, marginBottom:12 }}>{t(lang,'officer.detail.historyTitle')}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:13, fontSize:13 }}>
              {[[t(lang,'officer.detail.step1'), pick(lang,s,'submittedAt')||'—','user'],[t(lang,'officer.detail.step2'), status==='SUBMITTED'?t(lang,'officer.detail.waitAction'):(pick(lang,s,'confirmedAt')||'—'),'shield']].map(([l,d,ic],i)=>(
                <div key={i} style={{ display:'flex', gap:10 }}>
                  <div style={{ width:30, height:30, borderRadius:8, background:'var(--ink-100)', color:'var(--ink-500)', display:'flex', alignItems:'center', justifyContent:'center', flex:'none' }}><Icon name={ic} size={15}/></div>
                  <div><div style={{ fontWeight:600, color:'var(--ink-800)' }}>{l}</div><div style={{ fontSize:12, color:'var(--ink-500)' }}>{d}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal open={reject} onClose={()=>setReject(false)} title={t(lang,'officer.detail.rejectModalTitle')} tone="var(--status-reject-fg)"
        footer={<><button className="btn btn-ghost" onClick={()=>setReject(false)}>{t(lang,'officer.detail.cancelBtn')}</button>
          <button className="btn" style={{ background:'var(--fail)', color:'#fff' }} disabled={!remark.trim()}
            onClick={()=>{ setStatus('REJECTED'); setReject(false); toast(t(lang,'officer.detail.rejectToast'),'info'); }}>
            <Icon name="send" size={16}/> {t(lang,'officer.detail.confirmRejectBtn')}</button></>}>
        <p style={{ margin:'0 0 14px', color:'var(--ink-600)', fontSize:14 }}>{t(lang,'officer.detail.rejectHint')}</p>
        <div className="field"><label>{t(lang,'officer.detail.rejectFieldLabel')}</label>
          <textarea className="input" rows={3} placeholder={t(lang,'officer.detail.rejectPlaceholder')} value={remark} onChange={e=>setRemark(e.target.value)} />
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
          {quickReasons.map(r=>(
            <button key={r} className="chip" style={{ cursor:'pointer', border:'1px solid var(--ink-200)' }} onClick={()=>setRemark(r)}>{r}</button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

/* ---------- Review queue ---------- */
export function OfficerReview({ go, setSel, lang='TH' }) {
  const [tab, setTab] = useState('SUBMITTED');
  const counts = { SUBMITTED:STUDENTS.filter(s=>s.status==='SUBMITTED').length,
    REJECTED:STUDENTS.filter(s=>s.status==='REJECTED').length, CONFIRMED:STUDENTS.filter(s=>s.status==='CONFIRMED').length };
  const rows = STUDENTS.filter(s=>s.status===tab);
  return (
    <div className="fade-up">
      <PageHead title={t(lang,'officer.review.title')} sub={t(lang,'officer.review.sub')} />
      <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap' }}>
        {['SUBMITTED','REJECTED','CONFIRMED'].map(k=>(
          <button key={k} onClick={()=>setTab(k)} className="btn" style={{
            background: tab===k?'var(--navy-700)':'#fff', color: tab===k?'#fff':'var(--ink-700)',
            border:'1px solid '+(tab===k?'var(--navy-700)':'var(--ink-200)') }}>
            {t(lang,'status.'+k)} <span className="tnum" style={{ background: tab===k?'rgba(255,255,255,.2)':'var(--ink-100)', padding:'1px 8px', borderRadius:999, fontSize:12.5, marginLeft:2 }}>{counts[k]}</span>
          </button>
        ))}
      </div>
      <div className="card" style={{ overflow:'hidden' }}>
        {rows.length? <div style={{ overflowX:'auto' }}><table className="tbl">
          <thead><tr><th>{t(lang,'officer.review.colStudent')}</th><th>{t(lang,'officer.review.colRoom')}</th><th>{t(lang,'officer.review.colResult')}</th><th>{t(lang,'officer.review.colEvidence')}</th><th>{t(lang,'officer.review.colSubmitted')}</th><th></th></tr></thead>
          <tbody>{rows.map(s=>(
            <tr key={s.sid} className="clickable" onClick={()=>{ setSel(s); go('detail'); }}>
              <td><div style={{ display:'flex', alignItems:'center', gap:11 }}><Avatar name={s.firstName} size={34}/>
                <div><div style={{ fontWeight:600, fontSize:14 }}>{s.firstName} {s.lastName}</div>
                <div className="mono" style={{ fontSize:12, color:'var(--ink-400)' }}>{s.sid}</div></div></div></td>
              <td><span className="chip" style={{ fontSize:12 }}>{t(lang,'officer.ops.roomChip',{room:s.room})}</span></td>
              <td className="tnum" style={{ fontWeight:700, color: s.allPass?'var(--pass)':'var(--ink-800)' }}>{s.passedCount}/8</td>
              <td>{s.files.length? <span style={{ display:'inline-flex', alignItems:'center', gap:5, color:'var(--status-reject-fg)', fontSize:13 }}><Icon name="pdf" size={15}/> {t(lang,'officer.review.filesCount',{n:s.files.length})}</span> : <span style={{ color:'var(--ink-400)' }}>—</span>}</td>
              <td style={{ color:'var(--ink-500)', fontSize:13 }}>{pick(lang,s,'submittedAt')}</td>
              <td style={{ textAlign:'right' }}><button className="btn btn-subtle btn-sm">{t(lang,'officer.review.reviewBtn')} <Icon name="chevR" size={14}/></button></td>
            </tr>
          ))}</tbody>
        </table></div> : <Empty icon="checkCircle" title={t(lang,'officer.review.emptyTitle')} sub={t(lang,'officer.review.emptySub')} />}
      </div>
    </div>
  );
}
