/* ============================================================
   Student screens
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon, ROUNDS, NEWS, SUBJECTS, ME } from './data.jsx';
import { PageHead, Modal, StatusBadge, PassBadge, Donut, Stepper } from './components.jsx';
import { t, pick } from './i18n.js';
import { apiFetch, ApiError } from './api.js';

/* ---------- News / Announcements ---------- */
export function StudentNews({ go, lang='TH' }) {
  const [open, setOpen] = useState(null);
  const round = ROUNDS[0];
  return (
    <div className="fade-up">
      <PageHead title={t(lang,'news.pageTitle')} sub={t(lang,'news.pageSub')} />
      {/* active round banner */}
      <div className="card" style={{ padding:0, marginBottom:22, overflow:'hidden', border:'1px solid var(--gold-100)' }}>
        <div style={{ display:'flex', gap:0, alignItems:'stretch', flexWrap:'wrap' }}>
          <div style={{ background:'linear-gradient(135deg,var(--navy-700),var(--navy-800))', color:'#fff',
            padding:'22px 26px', flex:'1 1 320px', display:'flex', flexDirection:'column', gap:6 }}>
            <div className="chip" style={{ alignSelf:'flex-start', background:'rgba(255,255,255,.14)', color:'var(--gold-500)', fontWeight:700 }}>
              <Icon name="clock" size={14} /> {t(lang,'news.openRoundChip')}
            </div>
            <div style={{ fontSize:21, fontWeight:800, marginTop:4 }}>{t(lang,'news.roundLine',{attempt:round.attempt,year:round.year})}</div>
            <div style={{ fontSize:15.5, opacity:.85 }}>{t(lang,'news.openPeriod',{open:pick(lang,round,'open'),close:pick(lang,round,'close')})}</div>
          </div>
          <div style={{ padding:'22px 26px', flex:'1 1 280px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
            <div>
              <div style={{ fontSize:15.5, color:'var(--ink-500)', fontWeight:600 }}>{t(lang,'news.yourStatus')}</div>
              <div style={{ marginTop:7 }}><StatusBadge status="DRAFT" size="lg" lang={lang} /></div>
            </div>
            <button className="btn btn-gold btn-lg" onClick={()=>go('formIntro')}><Icon name="edit" size={18} /> {t(lang,'news.startBtn')}</button>
          </div>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {NEWS.map(n=>(
          <div key={n.id} className="card" style={{ padding:'18px 22px', cursor:'pointer', transition:'.15s' }}
            onClick={()=>setOpen(n)}
            onMouseEnter={e=>e.currentTarget.style.boxShadow='var(--sh-md)'}
            onMouseLeave={e=>e.currentTarget.style.boxShadow='var(--sh-sm)'}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:15 }}>
              <div style={{ width:44, height:44, borderRadius:12, flex:'none', display:'flex', alignItems:'center', justifyContent:'center',
                background: n.pinned?'var(--navy-700)':'var(--blue-50)', color: n.pinned?'#fff':'var(--blue-600)' }}>
                <Icon name={n.pinned?'star':'news'} size={21} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:5, flexWrap:'wrap' }}>
                  {n.pinned && <span className="chip" style={{ background:'var(--navy-700)', color:'#fff', fontWeight:700, fontSize:13.5, padding:'3px 9px' }}>{t(lang,'news.pinned')}</span>}
                  <span className="chip" style={{ fontSize:13.5, padding:'3px 9px' }}>{pick(lang,n,'round')}</span>
                </div>
                <div style={{ fontSize:18, fontWeight:700, color:'var(--ink-900)', lineHeight:1.35 }}>{pick(lang,n,'title')}</div>
                <div style={{ fontSize:15.5, color:'var(--ink-700)', marginTop:6, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical' }}>{pick(lang,n,'body')}</div>
                <div style={{ fontSize:14.5, color:'var(--ink-600)', marginTop:9, display:'flex', gap:14 }}>
                  <span><Icon name="calendar" size={13} style={{ verticalAlign:-2, marginRight:4 }} />{pick(lang,n,'date')}</span>
                  <span>{pick(lang,n,'author')}</span>
                </div>
              </div>
              <Icon name="chevR" size={20} style={{ color:'var(--ink-300)', flex:'none', marginTop:4 }} />
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!open} onClose={()=>setOpen(null)} title={open && pick(lang,open,'title')} width={560}
        footer={<button className="btn btn-ghost" onClick={()=>setOpen(null)}>{t(lang,'common.close')}</button>}>
        {open && <>
          <div style={{ display:'flex', gap:10, marginBottom:14 }}>
            <span className="chip">{pick(lang,open,'round')}</span>
            <span className="chip" style={{ background:'transparent', color:'var(--ink-500)' }}><Icon name="calendar" size={13}/> {pick(lang,open,'date')}</span>
          </div>
          <p style={{ margin:0, fontSize:17, lineHeight:1.7, color:'var(--ink-900)' }}>{pick(lang,open,'body')}</p>
          <div style={{ marginTop:18, paddingTop:14, borderTop:'1px solid var(--ink-100)', fontSize:15, color:'var(--ink-500)' }}>
            {t(lang,'news.postedBy',{author:pick(lang,open,'author')})}
          </div>
        </>}
      </Modal>
    </div>
  );
}

/* ---------- Exam form intro (landing before the wizard) ---------- */
/* หน้าเกริ่นก่อนกรอกผลสอบ — ถามรอบที่เปิดอยู่จาก backend ก่อน (GET /rounds/active)
   เดิมหน้านี้เป็นข้อความตายตัว ชวนกด "เริ่มกรอกผลสอบ" ทุกคนแม้รุ่นตัวเองยังไม่มีรอบเปิด
   (เช่นคนซ้ำชั้นที่รุ่นยังไม่ถึงปีสอบ) → กดเข้าไปแล้วค่อยเจอว่ากรอกไม่ได้ เสียเวลาไป 1 หน้า
   ตอนนี้บอกตั้งแต่หน้านี้เลย และบอกจำนวนวิชาตามรอบจริง (บางรอบสอบไม่ครบ 8 วิชา) */
export function FormIntro({ go, lang='TH' }) {
  const tt = (key, vars) => t(lang, key, vars);
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState(null);
  const [blocked, setBlocked] = useState(''); // เหตุผลที่กรอกไม่ได้ — ว่าง = กรอกได้
  const [blockedSub, setBlockedSub] = useState(''); // คำอธิบายใต้หัวข้อ (ว่าง = ใช้ข้อความมาตรฐาน)
  // ผ่านครบแล้ว = จบเรื่อง ไม่ต้องรอรอบถัดไป → พาไปดูผลที่หน้าสถานะ แทนที่จะบอกให้รอประกาศ
  const [allPassed, setAllPassed] = useState(false);
  // กำลังแก้ใบที่ถูกตีกลับ (อาจหลังรอบปิดแล้ว) — ปุ่มเปลี่ยนเป็น "แก้ไขผลสอบ"
  const [fixingRejected, setFixingRejected] = useState(false);

  useEffect(() => {
    apiFetch('/rounds/active')
      .then((active) => {
        if (!active) { setBlocked(tt('examform.noActiveRound')); return; }

        // มีใบที่ถูกตีกลับรอแก้อยู่ — แก้และส่งใหม่ได้แม้รอบไม่ได้เปิดรับแล้ว (backend บอกมาทาง can_fix_rejected)
        if (active.can_fix_rejected === true) {
          setFixingRejected(true);
          setRound(active);
          return;
        }

        // backend ส่งรอบที่ตั้งเปิดไว้ล่วงหน้ามาด้วยแล้ว (phase = scheduled)
        // บอกวันที่ไปเลย ดีกว่าขึ้นว่า "ไม่มีรอบเปิด" แล้วนักศึกษาต้องเดาว่าต้องรอถึงเมื่อไหร่
        if (active.phase === 'scheduled') {
          const openText = new Date(active.open_date).toLocaleDateString(
            lang === 'EN' ? 'en-GB' : 'th-TH',
            { day: 'numeric', month: 'long', year: 'numeric' },
          );
          setBlocked(tt('examform.scheduledRound', { attempt: active.attempt_number, date: openText }));
          setBlockedSub(tt('examform.scheduledSub'));
          return;
        }

        // เลยวันปิดรับแล้วแต่เจ้าหน้าที่ยังไม่กดปิด — บอกตรงๆ ว่าหมดเวลา ไม่ใช่ปล่อยให้กดแล้วเจอ error
        if (active.phase === 'expired') {
          setBlocked(tt('examform.expiredRound'));
          setBlockedSub(tt('examform.expiredSub'));
          return;
        }

        // เจ้าหน้าที่ปิดรอบแล้ว (และไม่มีใบที่ถูกตีกลับให้แก้)
        if (active.phase === 'closed') {
          setBlocked(tt('examform.closedRound'));
          setBlockedSub(tt('examform.expiredSub'));
          return;
        }

        if (active.all_passed) { setBlocked(tt('examform.allPassedRound')); setAllPassed(true); return; }
        setRound(active);
      })
      // 403 = ยังไม่ได้รับสิทธิ์กรอก — backend ส่งเหตุผลมาเป็นข้อความอยู่แล้ว เอามาโชว์ตรงๆ
      .catch((e) => setBlocked(e instanceof ApiError ? e.message : tt('examform.noActiveRound')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeText = round?.close_date
    ? new Date(round.close_date).toLocaleDateString(lang === 'EN' ? 'en-GB' : 'th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <div className="fade-up">
      <PageHead title={tt('formintro.title')}
        sub={round ? tt('formintro.sub', { attempt: round.attempt_number, year: round.academic_year, close: closeText }) : undefined}
        crumb={<><a onClick={()=>go('news')} style={{cursor:'pointer'}}>{tt('examform.crumbHome')}</a> <Icon name="chevR" size={13}/> {tt('examform.crumbForm')}</>} />
      <div className="card card-pad" style={{ maxWidth:960, margin:'0 auto', textAlign:'center', padding:'40px 32px' }}>
        {loading ? (
          <div style={{ padding:'30px 0', color:'var(--ink-500)' }}>{tt('common.loading')}</div>
        ) : blocked ? (
          // กรอกไม่ได้ — ไม่มีปุ่มเริ่ม มีแค่ทางกลับไปดูประกาศ (เจ้าหน้าที่ประกาศตอนเปิดรอบ)
          <>
            <div style={{ width:64, height:64, borderRadius:16, margin:'0 auto 18px',
              display:'flex', alignItems:'center', justifyContent:'center',
              background: allPassed ? 'var(--status-ok-bg)' : 'var(--ink-100)',
              color: allPassed ? 'var(--status-ok-fg)' : 'var(--ink-500)' }}>
              <Icon name={allPassed ? 'checkCircle' : 'calendar'} size={30} />
            </div>
            <h3 style={{ margin:'0 0 8px', fontSize:20, fontWeight:800 }}>{blocked}</h3>
            <p style={{ margin:'0 0 24px', color:'var(--ink-500)', fontSize:16, lineHeight:1.6 }}>
              {blockedSub || (allPassed ? tt('formintro.passedSub') : tt('formintro.blockedSub'))}</p>
            {allPassed ? (
              <button className="btn btn-ghost btn-lg" onClick={()=>go('status')}>
                <Icon name="clock" size={17}/> {tt('formintro.goStatusBtn')}</button>
            ) : (
              <button className="btn btn-ghost btn-lg" onClick={()=>go('news')}>
                <Icon name="news" size={17}/> {tt('formintro.goNewsBtn')}</button>
            )}
          </>
        ) : (
          <>
            <div style={{ width:64, height:64, borderRadius:16, background:'var(--blue-50)', color:'var(--navy-700)',
              display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px' }}>
              <Icon name="edit" size={30} />
            </div>
            <h3 style={{ margin:'0 0 8px', fontSize:20, fontWeight:800 }}>{fixingRejected ? tt('formintro.fixTitle') : tt('formintro.cardTitle')}</h3>
            <p style={{ margin:'0 0 24px', color:'var(--ink-500)', fontSize:16, lineHeight:1.6 }}>
              {fixingRejected ? tt('formintro.fixSub') : tt('formintro.cardSub', { n: round.subjects?.length ?? 8 })}</p>
            <button className="btn btn-primary btn-lg" style={{ width:'100%', justifyContent:'center' }} onClick={()=>go('form')}>
              {fixingRejected ? tt('news.editBtn') : tt('news.startBtn')} <Icon name="arrowR" size={17}/></button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Exam form (with variation styles) ---------- */
export function ExamForm({ go, toast, tweaks, initialStep=0, lang='TH' }) {
  const variant = tweaks?.examFormStyle || 'toggle';
  const autosave = tweaks?.autosave !== false;
  const [results, setResults] = useState(()=>SUBJECTS.map(s=>({ id:s.id, passed:null })));
  const [step, setStep] = useState(initialStep); // 0 results, 1 upload, 2 review
  const [files, setFiles] = useState({}); // keyed by slot: { EXAM:{...}, LICENSE:{...} }
  const [saved, setSaved] = useState(false);
  const filled = results.filter(r=>r.passed!==null).length;
  const pct = Math.round(filled/8*100);

  // autosave indicator
  useEffect(()=>{ if(autosave && filled>0){ setSaved(false); const tm=setTimeout(()=>setSaved(true),700); return ()=>clearTimeout(tm);} }, [results]);

  const setRes = (id,val)=> setResults(rs=>rs.map(r=>r.id===id?{...r,passed:val}:r));

  const steps = [1,2,3].map(i=>t(lang,'examform.steps.'+i));

  return (
    <div className="fade-up">
      <PageHead title={t(lang,'examform.pageTitle')} sub={t(lang,'examform.pageSub',{attempt:ROUNDS[0].attempt,year:ROUNDS[0].year,close:pick(lang,ROUNDS[0],'close')})}
        crumb={<><a onClick={()=>go('news')} style={{cursor:'pointer'}}>{t(lang,'examform.crumbHome')}</a> <Icon name="chevR" size={13}/> {t(lang,'examform.crumbForm')}</>} />

      <div className="card card-pad" style={{ marginBottom:20 }}>
        <Stepper steps={steps} current={step} />
      </div>

      {/* STEP 0: results — VARIANT-DRIVEN */}
      {step===0 && (
        <div className="fade-up">
          <div className="row wrap-m" style={{ alignItems:'flex-start' }}>
            <div style={{ flex:1, minWidth:0 }}>
              {variant==='toggle'   && <ExamToggle results={results} setRes={setRes} lang={lang} />}
              {variant==='cards'    && <ExamCards  results={results} setRes={setRes} lang={lang} />}
              {variant==='checklist'&& <ExamChecklist results={results} setRes={setRes} lang={lang} />}
            </div>
            {/* sticky progress aside */}
            <div style={{ width:260, flex:'none' }} className="exam-aside">
              <div className="card card-pad" style={{ position:'sticky', top:84 }}>
                <div style={{ fontSize:15, fontWeight:700, color:'var(--ink-500)', marginBottom:12 }}>{t(lang,'progress.title')}</div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8 }}>
                  <Donut size={130} thickness={16} segments={[
                    { value:results.filter(r=>r.passed===true).length, color:'var(--pass)' },
                    { value:results.filter(r=>r.passed===false).length, color:'var(--fail)' },
                    { value:results.filter(r=>r.passed===null).length, color:'var(--ink-200)' },
                  ]} center={<><div className="tnum" style={{ fontSize:28, fontWeight:800 }}>{filled}/8</div><div style={{ fontSize:13.5, color:'var(--ink-500)' }}>{t(lang,'progress.filled')}</div></>} />
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:7, fontSize:15, marginTop:6 }}>
                  <LegendRow color="var(--pass)" label={t(lang,'progress.legendPass')} n={results.filter(r=>r.passed===true).length} />
                  <LegendRow color="var(--fail)" label={t(lang,'progress.legendFail')} n={results.filter(r=>r.passed===false).length} />
                  <LegendRow color="var(--ink-300)" label={t(lang,'progress.legendNone')} n={results.filter(r=>r.passed===null).length} />
                </div>
                {autosave && <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--ink-100)', fontSize:14, color: saved?'var(--status-ok-fg)':'var(--ink-400)', display:'flex', alignItems:'center', gap:6 }}>
                  <Icon name={saved?'checkCircle':'clock'} size={14}/> {saved?t(lang,'progress.saved'):t(lang,'progress.saving')}
                </div>}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:22, gap:12 }}>
            <button className="btn btn-primary btn-lg" disabled={filled<8} onClick={()=>setStep(1)}>
              {t(lang,'examform.nextUpload')} <Icon name="arrowR" size={17}/></button>
          </div>
        </div>
      )}

      {/* STEP 1: upload — conditional slots */}
      {step===1 && (
        <div className="fade-up">
          {(()=>{ const allPass = results.every(r=>r.passed===true);
            return <>
              <div className="card" style={{ padding:'14px 18px', marginBottom:16, display:'flex', gap:11, alignItems:'flex-start',
                background: allPass?'var(--status-ok-bg)':'var(--blue-50)', border:'none' }}>
                <Icon name={allPass?'star':'info'} size={19} style={{ color: allPass?'var(--status-ok-fg)':'var(--navy-600)', flex:'none', marginTop:1 }}/>
                <div style={{ fontSize:15.5, color: allPass?'var(--status-ok-fg)':'var(--navy-700)', fontWeight:500 }}>
                  {allPass ? t(lang,'upload.allPassNote') : t(lang,'upload.partialNote')}
                </div>
              </div>
              <UploadSlots files={files} setFiles={setFiles} toast={toast} lang={lang}
                slots={allPass
                  ? [ { key:'EXAM', label:t(lang,'upload.examLabel'), hint:t(lang,'upload.examHint'), required:true },
                      { key:'LICENSE', label:t(lang,'upload.licenseLabel'), hint:t(lang,'upload.licenseHint'), required:true } ]
                  : [ { key:'EXAM', label:t(lang,'upload.examLabel'), hint:t(lang,'upload.examHint'), required:true } ]} />
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:22, gap:12 }}>
                <button className="btn btn-ghost btn-lg" onClick={()=>setStep(0)}><Icon name="chevL" size={17}/> {t(lang,'common.back')}</button>
                <button className="btn btn-primary btn-lg"
                  disabled={(allPass?2:1) > Object.keys(files).length}
                  onClick={()=>setStep(2)}>{t(lang,'examform.nextReview')} <Icon name="arrowR" size={17}/></button>
              </div>
            </>;
          })()}
        </div>
      )}

      {/* STEP 2: review & submit */}
      {step===2 && (
        <div className="fade-up" style={{ maxWidth:900 }}>
          <div className="card card-pad">
            <h3 style={{ margin:'0 0 4px', fontSize:19, fontWeight:800 }}>{t(lang,'review.title')}</h3>
            <p style={{ margin:'0 0 18px', color:'var(--ink-500)', fontSize:15.5 }}>{t(lang,'review.sub')}</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18 }}>
              {SUBJECTS.map(s=>{ const r=results.find(x=>x.id===s.id);
                return <div key={s.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'10px 13px', background:'var(--ink-50)', borderRadius:10 }}>
                  <span style={{ fontSize:15.5, color:'var(--ink-900)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pick(lang,s,'name')}</span>
                  <PassBadge passed={r.passed} lang={lang} />
                </div>;
              })}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {Object.entries(files).map(([k,f])=>(
                <div key={k} style={{ padding:'13px 15px', background:'var(--blue-50)', borderRadius:11, display:'flex', alignItems:'center', gap:11 }}>
                  <Icon name="pdf" size={20} style={{ color:'var(--blue-600)', flex:'none' }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15.5, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</div>
                    <div style={{ fontSize:14, color:'var(--ink-500)' }}>{f.label} · {f.size}</div>
                  </div>
                  <Icon name="checkCircle" size={19} style={{ color:'var(--pass)', flex:'none' }} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:22, gap:12 }}>
            <button className="btn btn-ghost btn-lg" onClick={()=>setStep(1)}><Icon name="chevL" size={17}/> {t(lang,'common.back')}</button>
            <button className="btn btn-success btn-lg" onClick={()=>{ toast(t(lang,'review.submitToast')); go('status'); }}>
              <Icon name="send" size={17}/> {t(lang,'review.submitBtn')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendRow({ color, label, n }) {
  return <div style={{ display:'flex', alignItems:'center', gap:8 }}>
    <span style={{ width:10, height:10, borderRadius:3, background:color, flex:'none' }}></span>
    <span style={{ color:'var(--ink-600)' }}>{label}</span>
    <span className="tnum" style={{ marginLeft:'auto', fontWeight:700 }}>{n}</span>
  </div>;
}

/* --- Variant A: segmented toggle rows --- */
function ExamToggle({ results, setRes, lang='TH' }) {
  return (
    <div className="card" style={{ overflow:'hidden' }}>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--ink-100)' }}>
        <h3 style={{ margin:0, fontSize:18, fontWeight:800 }}>{t(lang,'examresults.title')}</h3>
        <p style={{ margin:'3px 0 0', color:'var(--ink-500)', fontSize:15 }}>{t(lang,'examresults.subToggle')}</p>
      </div>
      {SUBJECTS.map((s,i)=>{ const r=results.find(x=>x.id===s.id);
        return <div key={s.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 20px',
          borderBottom: i<7?'1px solid var(--ink-100)':'none' }}>
          <span className="mono" style={{ fontSize:14, color:'var(--ink-400)', width:38, flex:'none' }}>{s.code}</span>
          <span style={{ flex:1, fontSize:16.5, fontWeight:500, color:'var(--ink-800)' }}>{pick(lang,s,'name')}</span>
          <div className="seg">
            <button className={r.passed===true?'on pass':''} onClick={()=>setRes(s.id,true)}>{t(lang,'pass.true')}</button>
            <button className={r.passed===false?'on fail':''} onClick={()=>setRes(s.id,false)}>{t(lang,'pass.false')}</button>
          </div>
        </div>;
      })}
      <style>{`.seg{display:inline-flex;background:var(--ink-100);border-radius:999px;padding:3px;gap:3px;flex:none;}
        .seg button{border:none;background:transparent;padding:7px 16px;border-radius:999px;font-size:13.5px;font-weight:600;color:var(--ink-500);transition:.13s;font-family:inherit;}
        .seg button.on.pass{background:var(--pass);color:#fff;box-shadow:var(--sh-xs);}
        .seg button.on.fail{background:var(--fail);color:#fff;box-shadow:var(--sh-xs);}`}</style>
    </div>
  );
}

/* --- Variant B: card grid --- */
function ExamCards({ results, setRes, lang='TH' }) {
  return (
    <div>
      <div style={{ marginBottom:14 }}>
        <h3 style={{ margin:0, fontSize:18, fontWeight:800 }}>{t(lang,'examresults.title')}</h3>
        <p style={{ margin:'3px 0 0', color:'var(--ink-500)', fontSize:15 }}>{t(lang,'examresults.subCards')}</p>
      </div>
      <div className="grid g-2">
        {SUBJECTS.map(s=>{ const r=results.find(x=>x.id===s.id);
          const tone = r.passed===true?'var(--pass)':r.passed===false?'var(--fail)':'var(--ink-200)';
          return <div key={s.id} className="card" style={{ padding:16, borderColor: r.passed!==null?tone:'var(--ink-200)',
            borderWidth: r.passed!==null?1.5:1 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:13 }}>
              <span style={{ width:34, height:34, borderRadius:9, background:'var(--blue-50)', color:'var(--navy-700)', fontWeight:800, fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', flex:'none' }} className="mono">{s.id}</span>
              <div style={{ fontSize:16, fontWeight:600, color:'var(--ink-800)', lineHeight:1.35 }}>{pick(lang,s,'name')}</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setRes(s.id,true)} style={{ flex:1, padding:'9px', borderRadius:9, fontWeight:700, fontSize:15.5, fontFamily:'inherit',
                border:'1.5px solid '+(r.passed===true?'var(--pass)':'var(--ink-200)'), background: r.passed===true?'var(--pass)':'#fff', color: r.passed===true?'#fff':'var(--ink-600)' }}>{t(lang,'pass.true')}</button>
              <button onClick={()=>setRes(s.id,false)} style={{ flex:1, padding:'9px', borderRadius:9, fontWeight:700, fontSize:15.5, fontFamily:'inherit',
                border:'1.5px solid '+(r.passed===false?'var(--fail)':'var(--ink-200)'), background: r.passed===false?'var(--fail)':'#fff', color: r.passed===false?'#fff':'var(--ink-600)' }}>{t(lang,'pass.false')}</button>
            </div>
          </div>;
        })}
      </div>
    </div>
  );
}

/* --- Variant C: compact checklist --- */
function ExamChecklist({ results, setRes, lang='TH' }) {
  const allPass = ()=>SUBJECTS.forEach(s=>setRes(s.id,true));
  return (
    <div className="card" style={{ overflow:'hidden' }}>
      <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--ink-100)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
        <div><h3 style={{ margin:0, fontSize:18, fontWeight:800 }}>{t(lang,'examresults.title')}</h3></div>
        <button className="btn btn-subtle btn-sm" onClick={allPass}><Icon name="check" size={15}/> {t(lang,'examresults.allPassBtn')}</button>
      </div>
      {SUBJECTS.map((s,i)=>{ const r=results.find(x=>x.id===s.id);
        return <label key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 18px',
          borderBottom: i<7?'1px solid var(--ink-100)':'none', cursor:'pointer' }}>
          <span style={{ flex:1, fontSize:16, color:'var(--ink-800)' }}><b className="mono" style={{ color:'var(--ink-400)', marginRight:8, fontWeight:500 }}>{s.code}</b>{pick(lang,s,'name')}</span>
          <div style={{ display:'flex', gap:6 }}>
            {[['true',t(lang,'pass.true'),'var(--pass)'],['false',t(lang,'pass.false'),'var(--fail)']].map(([v,lbl,c])=>{
              const sel = String(r.passed)===v;
              return <button key={v} onClick={()=>setRes(s.id, v==='true')} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:999, fontSize:15, fontWeight:600, fontFamily:'inherit',
                border:'1.5px solid '+(sel?c:'var(--ink-200)'), background: sel?c:'#fff', color: sel?'#fff':'var(--ink-500)' }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background: sel?'#fff':c, opacity: sel?1:.5 }}></span>{lbl}</button>;
            })}
          </div>
        </label>;
      })}
    </div>
  );
}

/* ---------- Upload slots (one drop target per required document) ---------- */
export function UploadSlots({ slots, files, setFiles, toast, lang='TH' }) {
  const [drag, setDrag] = useState(null);
  const fileName = { EXAM:'ใบรายงานผลสอบ_'+ME.sid+'.pdf', LICENSE:'ใบประกอบวิชาชีพ_'+ME.sid+'.pdf' };
  const add = (slot)=>{ const f={ name:fileName[slot.key]||slot.label+'.pdf', label:slot.label,
      size:(0.8+Math.random()*1.6).toFixed(1)+' MB' };
    setFiles(fs=>({ ...fs, [slot.key]:f })); toast&&toast(t(lang,'upload.attached',{label:slot.label})); };
  const remove = (key)=> setFiles(fs=>{ const c={...fs}; delete c[key]; return c; });
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {slots.map(slot=>{ const f=files[slot.key];
        return (
          <div key={slot.key} className="card card-pad">
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:12 }}>
              <span style={{ fontSize:17, fontWeight:800, color:'var(--ink-900)' }}>{slot.label}</span>
              {slot.required && <span className="chip" style={{ background:'var(--status-reject-bg)', color:'var(--status-reject-fg)', fontSize:13, fontWeight:700, padding:'2px 8px' }}>{t(lang,'upload.required')}</span>}
              {f && <Icon name="checkCircle" size={18} style={{ color:'var(--pass)', marginLeft:'auto' }} />}
            </div>
            {!f ? (
              <div onClick={()=>add(slot)} onDragOver={e=>{e.preventDefault();setDrag(slot.key);}} onDragLeave={()=>setDrag(null)}
                onDrop={e=>{e.preventDefault();setDrag(null);add(slot);}}
                style={{ border:'2px dashed '+(drag===slot.key?'var(--blue-500)':'var(--ink-300)'), borderRadius:13, padding:'40px 20px',
                  textAlign:'center', cursor:'pointer', background: drag===slot.key?'var(--blue-50)':'var(--ink-50)', transition:'.15s' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:11 }}>
                  <div style={{ width:52, height:52, borderRadius:13, background:'#fff', boxShadow:'var(--sh-sm)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--navy-600)', flex:'none' }}><Icon name="cloud" size={26}/></div>
                  <div style={{ textAlign:'left' }}>
                    <div style={{ fontWeight:700, fontSize:16, color:'var(--ink-800)' }}>{t(lang,'upload.dropHint')}</div>
                    <div style={{ fontSize:14.5, color:'var(--ink-500)' }}>{slot.hint} · {t(lang,'upload.sizeLimit')}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', border:'1px solid var(--ink-200)', borderRadius:11 }}>
                <div style={{ width:38, height:38, borderRadius:9, background:'var(--status-reject-bg)', color:'var(--status-reject-fg)', display:'flex', alignItems:'center', justifyContent:'center', flex:'none' }}><Icon name="pdf" size={20}/></div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:15.5, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</div>
                  <div style={{ fontSize:14, color:'var(--ink-500)' }}>{f.size} · {t(lang,'upload.uploaded')}</div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ padding:7, border:'none' }} onClick={()=>remove(slot.key)}><Icon name="trash" size={16}/></button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Submission status ---------- */
export function StudentStatus({ go, lang='TH' }) {
  // demo: a submitted-then-rejected scenario to show the richest state
  const data = { status:'SUBMITTED', submittedAt:'5 มิ.ย. 2569 10:30', submittedAt_en:'5 Jun 2026 10:30',
    subjects: SUBJECTS.map((s,i)=>({ ...s, passed: i!==4 })),
    files:[{ name:'ผลสอบ_NLE_6610210631.pdf', size:'1.4 MB' }] };
  const passed = data.subjects.filter(s=>s.passed).length;
  const submittedAt = pick(lang,data,'submittedAt');
  const timeline = [
    { label:t(lang,'statuspage.timeline.0'), date:submittedAt, done:true },
    { label:t(lang,'statuspage.timeline.1'), date:t(lang,'statuspage.inProgress'), active:true },
    { label:t(lang,'statuspage.timeline.2'), date:t(lang,'statuspage.waitConfirm'), done:false },
  ];
  return (
    <div className="fade-up">
      <PageHead title={t(lang,'statuspage.title')} sub={t(lang,'statuspage.sub',{attempt:ROUNDS[0].attempt,year:ROUNDS[0].year})}
        actions={<button className="btn btn-ghost" onClick={()=>go('history')}><Icon name="history" size={17}/> {t(lang,'statuspage.historyBtn')}</button>} />
      <div className="row wrap-m" style={{ alignItems:'flex-start' }}>
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:18 }}>
          {/* status hero */}
          <div className="card" style={{ padding:'22px 24px', borderLeft:'4px solid var(--status-wait-dot)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, flexWrap:'wrap' }}>
              <div>
                <div style={{ fontSize:15.5, color:'var(--ink-500)', fontWeight:600, marginBottom:8 }}>{t(lang,'statuspage.currentStatus')}</div>
                <StatusBadge status={data.status} size="lg" lang={lang} />
                <div style={{ fontSize:15, color:'var(--ink-500)', marginTop:10 }}>{t(lang,'statuspage.submittedNote',{date:submittedAt})}</div>
              </div>
              <Donut size={104} thickness={13} segments={[
                { value:passed, color:'var(--pass)' }, { value:8-passed, color:'var(--fail)' }]}
                center={<><div className="tnum" style={{ fontSize:23, fontWeight:800 }}>{passed}/8</div><div style={{ fontSize:12.5, color:'var(--ink-500)' }}>{t(lang,'pass.true')}</div></>} />
            </div>
          </div>
          {/* subject summary */}
          <div className="card card-pad">
            <h3 style={{ margin:'0 0 14px', fontSize:18, fontWeight:800 }}>{t(lang,'statuspage.subjectSummaryTitle')}</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
              {data.subjects.map(s=>(
                <div key={s.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'9px 13px', background:'#fff', border:'1px solid var(--ink-200)', borderRadius:9, boxShadow:'var(--sh-sm)' }}>
                  <span style={{ fontSize:15, color:'var(--ink-900)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pick(lang,s,'name')}</span>
                  <PassBadge passed={s.passed} lang={lang} />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* timeline aside */}
        <div style={{ width:300, flex:'none' }} className="exam-aside">
          <div className="card card-pad">
            <h3 style={{ margin:'0 0 16px', fontSize:17, fontWeight:800 }}>{t(lang,'statuspage.timelineTitle')}</h3>
            <div style={{ display:'flex', flexDirection:'column' }}>
              {timeline.map((tl,i)=>(
                <div key={i} style={{ display:'flex', gap:12 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                    <div style={{ width:26, height:26, borderRadius:'50%', flex:'none', display:'flex', alignItems:'center', justifyContent:'center',
                      background: tl.done?'var(--pass)':tl.active?'var(--status-wait-dot)':'#fff',
                      color:(tl.done||tl.active)?'#fff':'var(--ink-400)', border:(tl.done||tl.active)?'none':'2px solid var(--ink-200)' }}>
                      {tl.done?<Icon name="check" size={14}/>:tl.active?<Icon name="clock" size={13}/>:i+1}</div>
                    {i<timeline.length-1 && <div style={{ width:2, flex:1, minHeight:30, background: tl.done?'var(--pass)':'var(--ink-200)' }}></div>}
                  </div>
                  <div style={{ paddingBottom:18 }}>
                    <div style={{ fontSize:16, fontWeight:600, color: tl.active?'var(--status-wait-fg)':'var(--ink-800)' }}>{tl.label}</div>
                    <div style={{ fontSize:14.5, color:'var(--ink-500)', marginTop:2 }}>{tl.date}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:6, padding:'11px 13px', background:'var(--blue-50)', borderRadius:10, fontSize:14.5, color:'var(--navy-700)', display:'flex', gap:8 }}>
              <Icon name="info" size={16} style={{ flex:'none', marginTop:1 }}/> {t(lang,'statuspage.infoNote')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- History ---------- */
export function StudentHistory({ go, lang='TH' }) {
  const rows = [
    { round:'1/2569', date:'5 มิ.ย. 2569', date_en:'5 Jun 2026', status:'SUBMITTED', passed:7 },
    { round:'2/2568', date:'8 ม.ค. 2569', date_en:'8 Jan 2026', status:'CONFIRMED', passed:8 },
    { round:'1/2568', date:'6 มิ.ย. 2568', date_en:'6 Jun 2025', status:'REJECTED', passed:5 },
  ];
  return (
    <div className="fade-up">
      <PageHead title={t(lang,'historypage.title')} sub={t(lang,'historypage.sub')} />
      <div className="card" style={{ overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table className="tbl" style={{ tableLayout:'fixed', width:'100%' }}>
            <colgroup><col style={{ width:'16%' }}/><col style={{ width:'18%' }}/><col style={{ width:'20%' }}/><col style={{ width:'20%' }}/><col style={{ width:'26%' }}/></colgroup>
            <thead><tr><th>{t(lang,'historypage.colRound')}</th><th>{t(lang,'historypage.colDate')}</th><th>{t(lang,'historypage.colResult')}</th><th>{t(lang,'historypage.colStatus')}</th><th></th></tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={i} className="clickable">
                  <td style={{ fontWeight:700 }}>{t(lang,'historypage.roundPrefix',{round:r.round})}</td>
                  <td style={{ color:'var(--ink-600)' }}>{pick(lang,r,'date')}</td>
                  <td><span className="tnum" style={{ fontWeight:700, color: r.passed===8?'var(--pass)':'var(--ink-800)' }}>{r.passed}/8</span> <span style={{ color:'var(--ink-600)', fontSize:15 }}>{t(lang,'pass.true')}</span></td>
                  <td><StatusBadge status={r.status} lang={lang} /></td>
                  <td style={{ textAlign:'right' }}>
                    <button className="btn btn-ghost btn-sm" disabled={r.status==='CONFIRMED'||r.status==='REJECTED'}
                      onClick={()=>go('form',1)}><Icon name="edit" size={15}/> {t(lang,'historypage.editBtn')}</button>{' '}
                    <button className="btn btn-ghost btn-sm"><Icon name="eye" size={15}/> {t(lang,'historypage.viewBtn')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
