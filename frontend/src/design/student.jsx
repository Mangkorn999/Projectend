/* ============================================================
   Student screens
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon, ROUNDS, NEWS, SUBJECTS, ME } from './data.jsx';
import { PageHead, Modal, StatusBadge, PassBadge, Donut, Stepper } from './components.jsx';

/* ---------- News / Announcements ---------- */
export function StudentNews({ go }) {
  const [open, setOpen] = useState(null);
  const round = ROUNDS[0];
  return (
    <div className="fade-up">
      <PageHead title="ข่าวสาร / ประกาศ" sub="ติดตามกำหนดการและแนวปฏิบัติจากคณะ" />
      {/* active round banner */}
      <div className="card" style={{ padding:0, marginBottom:22, overflow:'hidden', border:'1px solid var(--gold-100)' }}>
        <div style={{ display:'flex', gap:0, alignItems:'stretch', flexWrap:'wrap' }}>
          <div style={{ background:'linear-gradient(135deg,var(--navy-700),var(--navy-800))', color:'#fff',
            padding:'22px 26px', flex:'1 1 320px', display:'flex', flexDirection:'column', gap:6 }}>
            <div className="chip" style={{ alignSelf:'flex-start', background:'rgba(255,255,255,.14)', color:'var(--gold-500)', fontWeight:700 }}>
              <Icon name="clock" size={14} /> รอบเปิดรับขณะนี้
            </div>
            <div style={{ fontSize:19, fontWeight:800, marginTop:4 }}>รอบที่ {round.attempt} ปีการศึกษา {round.year}</div>
            <div style={{ fontSize:13.5, opacity:.85 }}>เปิดรับกรอก {round.open} – {round.close}</div>
          </div>
          <div style={{ padding:'22px 26px', flex:'1 1 280px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
            <div>
              <div style={{ fontSize:13.5, color:'var(--ink-500)', fontWeight:600 }}>สถานะการกรอกของคุณ</div>
              <div style={{ marginTop:7 }}><StatusBadge status="DRAFT" size="lg" /></div>
            </div>
            <button className="btn btn-gold btn-lg" onClick={()=>go('form')}><Icon name="edit" size={18} /> เริ่มกรอกผลสอบ</button>
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
                  {n.pinned && <span className="chip" style={{ background:'var(--navy-700)', color:'#fff', fontWeight:700, fontSize:11.5, padding:'3px 9px' }}>ปักหมุด</span>}
                  <span className="chip" style={{ fontSize:11.5, padding:'3px 9px' }}>{n.round}</span>
                </div>
                <div style={{ fontSize:16, fontWeight:700, color:'var(--ink-900)', lineHeight:1.35 }}>{n.title}</div>
                <div style={{ fontSize:13.5, color:'var(--ink-500)', marginTop:6, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical' }}>{n.body}</div>
                <div style={{ fontSize:12.5, color:'var(--ink-400)', marginTop:9, display:'flex', gap:14 }}>
                  <span><Icon name="calendar" size={13} style={{ verticalAlign:-2, marginRight:4 }} />{n.date}</span>
                  <span>{n.author}</span>
                </div>
              </div>
              <Icon name="chevR" size={20} style={{ color:'var(--ink-300)', flex:'none', marginTop:4 }} />
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!open} onClose={()=>setOpen(null)} title={open?.title} width={560}
        footer={<button className="btn btn-ghost" onClick={()=>setOpen(null)}>ปิด</button>}>
        {open && <>
          <div style={{ display:'flex', gap:10, marginBottom:14 }}>
            <span className="chip">{open.round}</span>
            <span className="chip" style={{ background:'transparent', color:'var(--ink-500)' }}><Icon name="calendar" size={13}/> {open.date}</span>
          </div>
          <p style={{ margin:0, fontSize:15, lineHeight:1.7, color:'var(--ink-700)' }}>{open.body}</p>
          <div style={{ marginTop:18, paddingTop:14, borderTop:'1px solid var(--ink-100)', fontSize:13, color:'var(--ink-500)' }}>
            ผู้ประกาศ: {open.author}
          </div>
        </>}
      </Modal>
    </div>
  );
}

/* ---------- Exam form (with variation styles) ---------- */
export function ExamForm({ go, toast, tweaks }) {
  const variant = tweaks?.examFormStyle || 'toggle';
  const autosave = tweaks?.autosave !== false;
  const [council, setCouncil] = useState(ME.councilSet);
  const [results, setResults] = useState(()=>SUBJECTS.map(s=>({ id:s.id, passed:null })));
  const [step, setStep] = useState(0); // 0 creds, 1 results, 2 upload, 3 review
  const [files, setFiles] = useState({}); // keyed by slot: { EXAM:{...}, LICENSE:{...} }
  const [saved, setSaved] = useState(false);
  const filled = results.filter(r=>r.passed!==null).length;
  const pct = Math.round(filled/8*100);

  // autosave indicator
  useEffect(()=>{ if(autosave && filled>0){ setSaved(false); const t=setTimeout(()=>setSaved(true),700); return ()=>clearTimeout(t);} }, [results]);

  const setRes = (id,val)=> setResults(rs=>rs.map(r=>r.id===id?{...r,passed:val}:r));

  const steps = ['ข้อมูลสภาฯ','กรอกผลสอบ','แนบหลักฐาน','ตรวจทาน'];

  return (
    <div className="fade-up">
      <PageHead title="กรอกผลสอบใบประกอบวิชาชีพ" sub={`รอบที่ ${ROUNDS[0].attempt} ปีการศึกษา ${ROUNDS[0].year} · ปิดรับ ${ROUNDS[0].close}`}
        crumb={<><a onClick={()=>go('news')} style={{cursor:'pointer'}}>หน้าหลัก</a> <Icon name="chevR" size={13}/> กรอกผลสอบ</>} />

      <div className="card card-pad" style={{ marginBottom:20 }}>
        <Stepper steps={steps} current={step} />
      </div>

      {/* STEP 0: council credentials */}
      {step===0 && (
        <div className="card card-pad fade-up" style={{ maxWidth:620 }}>
          <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:18 }}>
            <div style={{ width:42, height:42, borderRadius:11, background:'var(--blue-50)', color:'var(--blue-600)', display:'flex', alignItems:'center', justifyContent:'center', flex:'none' }}><Icon name="key" size={21}/></div>
            <div>
              <h3 style={{ margin:0, fontSize:17, fontWeight:800 }}>ข้อมูลบัญชีสภาการพยาบาล</h3>
              <p style={{ margin:'4px 0 0', color:'var(--ink-500)', fontSize:13.5 }}>ใช้สำหรับอ้างอิงผลสอบจากระบบสภาฯ (กรอกครั้งเดียว ใช้ได้ทุกรอบ)</p>
            </div>
          </div>
          <div className="grid g-2" style={{ gap:16 }}>
            <div className="field"><label>อีเมลสภาการพยาบาล</label>
              <input className="input" defaultValue={ME.councilEmail} placeholder="xxxx@nurse.or.th" /></div>
            <div className="field"><label>รหัสผ่านสภาการพยาบาล</label>
              <input className="input" type="password" defaultValue="••••••••••" /></div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:9, marginTop:14, padding:'11px 13px', background:'var(--status-ok-bg)', borderRadius:10, color:'var(--status-ok-fg)', fontSize:13, fontWeight:500 }}>
            <Icon name="checkCircle" size={17}/> บันทึกข้อมูลนี้ไว้แล้ว · ไม่ต้องกรอกซ้ำในรอบถัดไป
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:22 }}>
            <button className="btn btn-primary btn-lg" onClick={()=>setStep(1)}>ถัดไป <Icon name="arrowR" size={17}/></button>
          </div>
        </div>
      )}

      {/* STEP 1: results — VARIANT-DRIVEN */}
      {step===1 && (
        <div className="fade-up">
          <div className="row wrap-m" style={{ alignItems:'flex-start' }}>
            <div style={{ flex:1, minWidth:0 }}>
              {variant==='toggle'   && <ExamToggle results={results} setRes={setRes} />}
              {variant==='cards'    && <ExamCards  results={results} setRes={setRes} />}
              {variant==='checklist'&& <ExamChecklist results={results} setRes={setRes} />}
            </div>
            {/* sticky progress aside */}
            <div style={{ width:260, flex:'none' }} className="exam-aside">
              <div className="card card-pad" style={{ position:'sticky', top:84 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--ink-500)', marginBottom:12 }}>ความคืบหน้า</div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8 }}>
                  <Donut size={130} thickness={16} segments={[
                    { value:results.filter(r=>r.passed===true).length, color:'var(--pass)' },
                    { value:results.filter(r=>r.passed===false).length, color:'var(--fail)' },
                    { value:results.filter(r=>r.passed===null).length, color:'var(--ink-200)' },
                  ]} center={<><div className="tnum" style={{ fontSize:26, fontWeight:800 }}>{filled}/8</div><div style={{ fontSize:11.5, color:'var(--ink-500)' }}>กรอกแล้ว</div></>} />
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:7, fontSize:13, marginTop:6 }}>
                  <LegendRow color="var(--pass)" label="ผ่าน" n={results.filter(r=>r.passed===true).length} />
                  <LegendRow color="var(--fail)" label="ไม่ผ่าน" n={results.filter(r=>r.passed===false).length} />
                  <LegendRow color="var(--ink-300)" label="ยังไม่ระบุ" n={results.filter(r=>r.passed===null).length} />
                </div>
                {autosave && <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--ink-100)', fontSize:12, color: saved?'var(--status-ok-fg)':'var(--ink-400)', display:'flex', alignItems:'center', gap:6 }}>
                  <Icon name={saved?'checkCircle':'clock'} size={14}/> {saved?'บันทึกร่างอัตโนมัติแล้ว':'กำลังบันทึก…'}
                </div>}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:22, gap:12 }}>
            <button className="btn btn-ghost btn-lg" onClick={()=>setStep(0)}><Icon name="chevL" size={17}/> ย้อนกลับ</button>
            <button className="btn btn-primary btn-lg" disabled={filled<8} onClick={()=>setStep(2)}>
              ถัดไป: แนบหลักฐาน <Icon name="arrowR" size={17}/></button>
          </div>
        </div>
      )}

      {/* STEP 2: upload — conditional slots */}
      {step===2 && (
        <div className="fade-up" style={{ maxWidth:680 }}>
          {(()=>{ const allPass = results.every(r=>r.passed===true);
            return <>
              <div className="card" style={{ padding:'14px 18px', marginBottom:16, display:'flex', gap:11, alignItems:'flex-start',
                background: allPass?'var(--status-ok-bg)':'var(--blue-50)', border:'none' }}>
                <Icon name={allPass?'star':'info'} size={19} style={{ color: allPass?'var(--status-ok-fg)':'var(--navy-600)', flex:'none', marginTop:1 }}/>
                <div style={{ fontSize:13.5, color: allPass?'var(--status-ok-fg)':'var(--navy-700)', fontWeight:500 }}>
                  {allPass
                    ? <>คุณสอบ<b>ผ่านครบทั้ง 8 วิชา</b> — กรุณาแนบทั้ง <b>ใบรายงานผลสอบ</b> และ <b>ใบประกอบวิชาชีพ</b></>
                    : <>มีวิชาที่ยังไม่ผ่าน — แนบเฉพาะ <b>ใบรายงานผลสอบ</b> ก็เพียงพอ (แนบใบประกอบวิชาชีพได้เมื่อสอบผ่านครบแล้ว)</>}
                </div>
              </div>
              <UploadSlots files={files} setFiles={setFiles} toast={toast}
                slots={allPass
                  ? [ { key:'EXAM', label:'ใบรายงานผลสอบ', hint:'ผลสอบรายวิชาทั้ง 8 วิชา', required:true },
                      { key:'LICENSE', label:'ใบประกอบวิชาชีพการพยาบาล', hint:'ใบอนุญาตจากสภาการพยาบาล', required:true } ]
                  : [ { key:'EXAM', label:'ใบรายงานผลสอบ', hint:'ผลสอบรายวิชาทั้ง 8 วิชา', required:true } ]} />
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:22, gap:12 }}>
                <button className="btn btn-ghost btn-lg" onClick={()=>setStep(1)}><Icon name="chevL" size={17}/> ย้อนกลับ</button>
                <button className="btn btn-primary btn-lg"
                  disabled={(allPass?2:1) > Object.keys(files).length}
                  onClick={()=>setStep(3)}>ถัดไป: ตรวจทาน <Icon name="arrowR" size={17}/></button>
              </div>
            </>;
          })()}
        </div>
      )}

      {/* STEP 3: review & submit */}
      {step===3 && (
        <div className="fade-up" style={{ maxWidth:680 }}>
          <div className="card card-pad">
            <h3 style={{ margin:'0 0 4px', fontSize:17, fontWeight:800 }}>ตรวจทานก่อนส่ง</h3>
            <p style={{ margin:'0 0 18px', color:'var(--ink-500)', fontSize:13.5 }}>โปรดตรวจสอบความถูกต้อง เมื่อส่งแล้วสถานะจะเปลี่ยนเป็น “รอตรวจสอบ”</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18 }}>
              {SUBJECTS.map(s=>{ const r=results.find(x=>x.id===s.id);
                return <div key={s.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'10px 13px', background:'var(--ink-50)', borderRadius:10 }}>
                  <span style={{ fontSize:13.5, color:'var(--ink-700)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</span>
                  <PassBadge passed={r.passed} />
                </div>;
              })}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {Object.entries(files).map(([k,f])=>(
                <div key={k} style={{ padding:'13px 15px', background:'var(--blue-50)', borderRadius:11, display:'flex', alignItems:'center', gap:11 }}>
                  <Icon name="pdf" size={20} style={{ color:'var(--blue-600)', flex:'none' }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13.5, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</div>
                    <div style={{ fontSize:12, color:'var(--ink-500)' }}>{f.label} · {f.size}</div>
                  </div>
                  <Icon name="checkCircle" size={19} style={{ color:'var(--pass)', flex:'none' }} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:22, gap:12 }}>
            <button className="btn btn-ghost btn-lg" onClick={()=>setStep(2)}><Icon name="chevL" size={17}/> ย้อนกลับ</button>
            <button className="btn btn-success btn-lg" onClick={()=>{ toast('ส่งผลสอบเรียบร้อย · รอเจ้าหน้าที่ตรวจสอบ'); go('status'); }}>
              <Icon name="send" size={17}/> ยืนยันและส่งผลสอบ</button>
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
function ExamToggle({ results, setRes }) {
  return (
    <div className="card" style={{ overflow:'hidden' }}>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--ink-100)' }}>
        <h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>ผลสอบรายวิชา (8 วิชา)</h3>
        <p style={{ margin:'3px 0 0', color:'var(--ink-500)', fontSize:13 }}>ระบุผลแต่ละวิชาว่า “ผ่าน” หรือ “ไม่ผ่าน”</p>
      </div>
      {SUBJECTS.map((s,i)=>{ const r=results.find(x=>x.id===s.id);
        return <div key={s.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 20px',
          borderBottom: i<7?'1px solid var(--ink-100)':'none' }}>
          <span className="mono" style={{ fontSize:12, color:'var(--ink-400)', width:38, flex:'none' }}>{s.code}</span>
          <span style={{ flex:1, fontSize:14.5, fontWeight:500, color:'var(--ink-800)' }}>{s.name}</span>
          <div className="seg">
            <button className={r.passed===true?'on pass':''} onClick={()=>setRes(s.id,true)}>ผ่าน</button>
            <button className={r.passed===false?'on fail':''} onClick={()=>setRes(s.id,false)}>ไม่ผ่าน</button>
          </div>
        </div>;
      })}
      <style>{`.seg{display:inline-flex;background:var(--ink-100);border-radius:9px;padding:3px;gap:3px;flex:none;}
        .seg button{border:none;background:transparent;padding:7px 16px;border-radius:7px;font-size:13.5px;font-weight:600;color:var(--ink-500);transition:.13s;font-family:inherit;}
        .seg button.on.pass{background:var(--pass);color:#fff;box-shadow:var(--sh-xs);}
        .seg button.on.fail{background:var(--fail);color:#fff;box-shadow:var(--sh-xs);}`}</style>
    </div>
  );
}

/* --- Variant B: card grid --- */
function ExamCards({ results, setRes }) {
  return (
    <div>
      <div style={{ marginBottom:14 }}>
        <h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>ผลสอบรายวิชา (8 วิชา)</h3>
        <p style={{ margin:'3px 0 0', color:'var(--ink-500)', fontSize:13 }}>แตะการ์ดเพื่อเลือกผลสอบของแต่ละวิชา</p>
      </div>
      <div className="grid g-2">
        {SUBJECTS.map(s=>{ const r=results.find(x=>x.id===s.id);
          const tone = r.passed===true?'var(--pass)':r.passed===false?'var(--fail)':'var(--ink-200)';
          return <div key={s.id} className="card" style={{ padding:16, borderColor: r.passed!==null?tone:'var(--ink-200)',
            borderWidth: r.passed!==null?1.5:1 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:13 }}>
              <span style={{ width:34, height:34, borderRadius:9, background:'var(--blue-50)', color:'var(--navy-700)', fontWeight:800, fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', flex:'none' }} className="mono">{s.id}</span>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--ink-800)', lineHeight:1.35 }}>{s.name}</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setRes(s.id,true)} style={{ flex:1, padding:'9px', borderRadius:9, fontWeight:700, fontSize:13.5, fontFamily:'inherit',
                border:'1.5px solid '+(r.passed===true?'var(--pass)':'var(--ink-200)'), background: r.passed===true?'var(--pass)':'#fff', color: r.passed===true?'#fff':'var(--ink-600)' }}>ผ่าน</button>
              <button onClick={()=>setRes(s.id,false)} style={{ flex:1, padding:'9px', borderRadius:9, fontWeight:700, fontSize:13.5, fontFamily:'inherit',
                border:'1.5px solid '+(r.passed===false?'var(--fail)':'var(--ink-200)'), background: r.passed===false?'var(--fail)':'#fff', color: r.passed===false?'#fff':'var(--ink-600)' }}>ไม่ผ่าน</button>
            </div>
          </div>;
        })}
      </div>
    </div>
  );
}

/* --- Variant C: compact checklist --- */
function ExamChecklist({ results, setRes }) {
  const allPass = ()=>SUBJECTS.forEach(s=>setRes(s.id,true));
  return (
    <div className="card" style={{ overflow:'hidden' }}>
      <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--ink-100)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
        <div><h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>ผลสอบรายวิชา</h3></div>
        <button className="btn btn-subtle btn-sm" onClick={allPass}><Icon name="check" size={15}/> ผ่านทั้งหมด</button>
      </div>
      {SUBJECTS.map((s,i)=>{ const r=results.find(x=>x.id===s.id);
        return <label key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 18px',
          borderBottom: i<7?'1px solid var(--ink-100)':'none', cursor:'pointer' }}>
          <span style={{ flex:1, fontSize:14, color:'var(--ink-800)' }}><b className="mono" style={{ color:'var(--ink-400)', marginRight:8, fontWeight:500 }}>{s.code}</b>{s.name}</span>
          <div style={{ display:'flex', gap:6 }}>
            {[['true','ผ่าน','var(--pass)'],['false','ไม่ผ่าน','var(--fail)']].map(([v,lbl,c])=>{
              const sel = String(r.passed)===v;
              return <button key={v} onClick={()=>setRes(s.id, v==='true')} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:999, fontSize:13, fontWeight:600, fontFamily:'inherit',
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
export function UploadSlots({ slots, files, setFiles, toast }) {
  const [drag, setDrag] = useState(null);
  const fileName = { EXAM:'ใบรายงานผลสอบ_'+ME.sid+'.pdf', LICENSE:'ใบประกอบวิชาชีพ_'+ME.sid+'.pdf' };
  const add = (slot)=>{ const f={ name:fileName[slot.key]||slot.label+'.pdf', label:slot.label,
      size:(0.8+Math.random()*1.6).toFixed(1)+' MB' };
    setFiles(fs=>({ ...fs, [slot.key]:f })); toast&&toast('แนบ'+slot.label+'เรียบร้อย'); };
  const remove = (key)=> setFiles(fs=>{ const c={...fs}; delete c[key]; return c; });
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {slots.map(slot=>{ const f=files[slot.key];
        return (
          <div key={slot.key} className="card card-pad">
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:12 }}>
              <span style={{ fontSize:15, fontWeight:800, color:'var(--ink-900)' }}>{slot.label}</span>
              {slot.required && <span className="chip" style={{ background:'var(--status-reject-bg)', color:'var(--status-reject-fg)', fontSize:11, fontWeight:700, padding:'2px 8px' }}>จำเป็น</span>}
              {f && <Icon name="checkCircle" size={18} style={{ color:'var(--pass)', marginLeft:'auto' }} />}
            </div>
            {!f ? (
              <div onClick={()=>add(slot)} onDragOver={e=>{e.preventDefault();setDrag(slot.key);}} onDragLeave={()=>setDrag(null)}
                onDrop={e=>{e.preventDefault();setDrag(null);add(slot);}}
                style={{ border:'2px dashed '+(drag===slot.key?'var(--blue-500)':'var(--ink-300)'), borderRadius:13, padding:'24px 20px',
                  textAlign:'center', cursor:'pointer', background: drag===slot.key?'var(--blue-50)':'var(--ink-50)', transition:'.15s' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:11 }}>
                  <div style={{ width:42, height:42, borderRadius:11, background:'#fff', boxShadow:'var(--sh-sm)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--navy-600)', flex:'none' }}><Icon name="cloud" size={22}/></div>
                  <div style={{ textAlign:'left' }}>
                    <div style={{ fontWeight:700, fontSize:14, color:'var(--ink-800)' }}>ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</div>
                    <div style={{ fontSize:12.5, color:'var(--ink-500)' }}>{slot.hint} · PDF ≤ 10 MB</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', border:'1px solid var(--ink-200)', borderRadius:11 }}>
                <div style={{ width:38, height:38, borderRadius:9, background:'var(--status-reject-bg)', color:'var(--status-reject-fg)', display:'flex', alignItems:'center', justifyContent:'center', flex:'none' }}><Icon name="pdf" size={20}/></div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</div>
                  <div style={{ fontSize:12, color:'var(--ink-500)' }}>{f.size} · อัปโหลดสำเร็จ</div>
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
export function StudentStatus({ go }) {
  // demo: a submitted-then-rejected scenario to show the richest state
  const data = { status:'SUBMITTED', submittedAt:'5 มิ.ย. 2569 10:30',
    subjects: SUBJECTS.map((s,i)=>({ ...s, passed: i!==4 })),
    files:[{ name:'ผลสอบ_NLE_6610210631.pdf', size:'1.4 MB' }] };
  const passed = data.subjects.filter(s=>s.passed).length;
  const timeline = [
    { label:'กรอกและส่งผลสอบ', date:data.submittedAt, done:true },
    { label:'เจ้าหน้าที่ตรวจสอบ', date:'อยู่ระหว่างดำเนินการ', active:true },
    { label:'ยืนยันผลเรียบร้อย', date:'รอการยืนยัน', done:false },
  ];
  return (
    <div className="fade-up">
      <PageHead title="สถานะการกรอกผลสอบ" sub={`รอบที่ ${ROUNDS[0].attempt} ปีการศึกษา ${ROUNDS[0].year}`}
        actions={<button className="btn btn-ghost" onClick={()=>go('history')}><Icon name="history" size={17}/> ดูประวัติ</button>} />
      <div className="row wrap-m" style={{ alignItems:'flex-start' }}>
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:18 }}>
          {/* status hero */}
          <div className="card" style={{ padding:'22px 24px', borderLeft:'4px solid var(--status-wait-dot)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, flexWrap:'wrap' }}>
              <div>
                <div style={{ fontSize:13.5, color:'var(--ink-500)', fontWeight:600, marginBottom:8 }}>สถานะปัจจุบัน</div>
                <StatusBadge status={data.status} size="lg" />
                <div style={{ fontSize:13, color:'var(--ink-500)', marginTop:10 }}>ส่งเมื่อ {data.submittedAt} · เจ้าหน้าที่จะตรวจสอบภายใน 3 วันทำการ</div>
              </div>
              <Donut size={104} thickness={13} segments={[
                { value:passed, color:'var(--pass)' }, { value:8-passed, color:'var(--fail)' }]}
                center={<><div className="tnum" style={{ fontSize:21, fontWeight:800 }}>{passed}/8</div><div style={{ fontSize:10.5, color:'var(--ink-500)' }}>ผ่าน</div></>} />
            </div>
          </div>
          {/* subject summary */}
          <div className="card card-pad">
            <h3 style={{ margin:'0 0 14px', fontSize:16, fontWeight:800 }}>ผลสอบรายวิชาที่กรอก</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
              {data.subjects.map(s=>(
                <div key={s.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'9px 13px', background:'var(--ink-50)', borderRadius:9 }}>
                  <span style={{ fontSize:13, color:'var(--ink-700)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</span>
                  <PassBadge passed={s.passed} />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* timeline aside */}
        <div style={{ width:300, flex:'none' }} className="exam-aside">
          <div className="card card-pad">
            <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:800 }}>ไทม์ไลน์การตรวจสอบ</h3>
            <div style={{ display:'flex', flexDirection:'column' }}>
              {timeline.map((t,i)=>(
                <div key={i} style={{ display:'flex', gap:12 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                    <div style={{ width:26, height:26, borderRadius:'50%', flex:'none', display:'flex', alignItems:'center', justifyContent:'center',
                      background: t.done?'var(--pass)':t.active?'var(--status-wait-dot)':'#fff',
                      color:(t.done||t.active)?'#fff':'var(--ink-400)', border:(t.done||t.active)?'none':'2px solid var(--ink-200)' }}>
                      {t.done?<Icon name="check" size={14}/>:t.active?<Icon name="clock" size={13}/>:i+1}</div>
                    {i<timeline.length-1 && <div style={{ width:2, flex:1, minHeight:30, background: t.done?'var(--pass)':'var(--ink-200)' }}></div>}
                  </div>
                  <div style={{ paddingBottom:18 }}>
                    <div style={{ fontSize:14, fontWeight:600, color: t.active?'var(--status-wait-fg)':'var(--ink-800)' }}>{t.label}</div>
                    <div style={{ fontSize:12.5, color:'var(--ink-500)', marginTop:2 }}>{t.date}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:6, padding:'11px 13px', background:'var(--blue-50)', borderRadius:10, fontSize:12.5, color:'var(--navy-700)', display:'flex', gap:8 }}>
              <Icon name="info" size={16} style={{ flex:'none', marginTop:1 }}/> ยังแก้ไขผลสอบได้จนกว่าเจ้าหน้าที่จะเริ่มตรวจสอบ
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- History ---------- */
export function StudentHistory() {
  const rows = [
    { round:'1/2569', date:'5 มิ.ย. 2569', status:'SUBMITTED', passed:7 },
    { round:'2/2568', date:'8 ม.ค. 2569', status:'CONFIRMED', passed:8 },
    { round:'1/2568', date:'6 มิ.ย. 2568', status:'REJECTED', passed:5 },
  ];
  return (
    <div className="fade-up">
      <PageHead title="ประวัติการกรอกผลสอบ" sub="บันทึกการกรอกของคุณทุกรอบที่ผ่านมา" />
      <div className="card" style={{ overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table className="tbl">
            <thead><tr><th>รอบการสอบ</th><th>วันที่กรอก</th><th>ผลสอบ</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={i} className="clickable">
                  <td style={{ fontWeight:700 }}>รอบ {r.round}</td>
                  <td style={{ color:'var(--ink-600)' }}>{r.date}</td>
                  <td><span className="tnum" style={{ fontWeight:700, color: r.passed===8?'var(--pass)':'var(--ink-800)' }}>{r.passed}/8</span> <span style={{ color:'var(--ink-400)', fontSize:13 }}>ผ่าน</span></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ textAlign:'right' }}><button className="btn btn-ghost btn-sm"><Icon name="eye" size={15}/> ดู</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
