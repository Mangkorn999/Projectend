/* ============================================================
   นักศึกษา — ฟอร์มกรอกผลสอบ 3 ขั้นตอน
   0 = กรอกผลสอบ 8 วิชา  →  1 = แนบหลักฐาน PDF  →  2 = ตรวจทานแล้วส่ง
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { PageHead, PassBadge, Stepper } from '../../components/ui.jsx';
import { Donut } from '../../components/charts.jsx';
import { ROUNDS, SUBJECTS, ME } from '../../mock/mockData.js';

const STEPS = ['กรอกผลสอบ','แนบหลักฐาน','ตรวจทาน'];

export function ExamForm({ go, toast, initialStep=0 }) {
  const [results, setResults] = useState(()=>SUBJECTS.map(s=>({ id:s.id, passed:null })));
  const [step, setStep] = useState(initialStep);
  const [files, setFiles] = useState({});   // { EXAM:{...}, LICENSE:{...} }
  const [saved, setSaved] = useState(false);
  const filled = results.filter(r=>r.passed!==null).length;

  // บันทึกร่างอัตโนมัติ (เดโม: หน่วงแล้วขึ้นข้อความว่าบันทึกแล้ว)
  useEffect(()=>{
    if(filled>0){ setSaved(false); const t=setTimeout(()=>setSaved(true),700); return ()=>clearTimeout(t); }
  }, [results]);

  const setRes = (id,val)=> setResults(rs=>rs.map(r=>r.id===id?{...r,passed:val}:r));
  const allPass = results.every(r=>r.passed===true);

  return (
    <div className="fade-up">
      <PageHead title="กรอกผลสอบใบประกอบวิชาชีพ" sub={`รอบที่ ${ROUNDS[0].attempt} ปีการศึกษา ${ROUNDS[0].year} · ปิดรับ ${ROUNDS[0].close}`}
        crumb={<><a onClick={()=>go('news')} style={{cursor:'pointer'}}>หน้าหลัก</a> <Icon name="chevR" size={13}/> กรอกผลสอบ</>} />

      <div className="card card-pad" style={{ marginBottom:20 }}>
        <Stepper steps={STEPS} current={step} />
      </div>

      {/* ขั้นที่ 0: ผลสอบรายวิชา */}
      {step===0 && (
        <div className="fade-up">
          <div className="row wrap-m" style={{ alignItems:'flex-start' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <SubjectResultList results={results} setRes={setRes} />
            </div>
            {/* แถบความคืบหน้าด้านขวา */}
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
                <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--ink-100)', fontSize:12, color: saved?'var(--status-ok-fg)':'var(--ink-400)', display:'flex', alignItems:'center', gap:6 }}>
                  <Icon name={saved?'checkCircle':'clock'} size={14}/> {saved?'บันทึกร่างอัตโนมัติแล้ว':'กำลังบันทึก…'}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:22, gap:12 }}>
            <button className="btn btn-ghost btn-lg" onClick={()=>go('news')}><Icon name="chevL" size={17}/> ย้อนกลับ</button>
            <button className="btn btn-primary btn-lg" disabled={filled<8} onClick={()=>setStep(1)}>
              ถัดไป: แนบหลักฐาน <Icon name="arrowR" size={17}/></button>
          </div>
        </div>
      )}

      {/* ขั้นที่ 1: แนบไฟล์ — ถ้าผ่านครบ 8 วิชาต้องแนบใบประกอบวิชาชีพเพิ่ม */}
      {step===1 && (
        <div className="fade-up" style={{ maxWidth:680 }}>
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
            <button className="btn btn-ghost btn-lg" onClick={()=>setStep(0)}><Icon name="chevL" size={17}/> ย้อนกลับ</button>
            <button className="btn btn-primary btn-lg"
              disabled={(allPass?2:1) > Object.keys(files).length}
              onClick={()=>setStep(2)}>ถัดไป: ตรวจทาน <Icon name="arrowR" size={17}/></button>
          </div>
        </div>
      )}

      {/* ขั้นที่ 2: ตรวจทานแล้วส่ง */}
      {step===2 && (
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
            <button className="btn btn-ghost btn-lg" onClick={()=>setStep(1)}><Icon name="chevL" size={17}/> ย้อนกลับ</button>
            <button className="btn btn-success btn-lg" onClick={()=>{ toast('ส่งผลสอบเรียบร้อย · รอเจ้าหน้าที่ตรวจสอบ'); go('status'); }}>
              <Icon name="send" size={17}/> ยืนยันและส่งผลสอบ</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* แถวคำอธิบายสีในวงกลมความคืบหน้า */
function LegendRow({ color, label, n }) {
  return <div style={{ display:'flex', alignItems:'center', gap:8 }}>
    <span style={{ width:10, height:10, borderRadius:3, background:color, flex:'none' }}></span>
    <span style={{ color:'var(--ink-600)' }}>{label}</span>
    <span className="tnum" style={{ marginLeft:'auto', fontWeight:700 }}>{n}</span>
  </div>;
}

/* รายการ 8 วิชา พร้อมปุ่มสลับ ผ่าน/ไม่ผ่าน */
function SubjectResultList({ results, setRes }) {
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

/* ช่องอัปโหลด 1 ช่องต่อ 1 เอกสารที่ต้องแนบ */
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
