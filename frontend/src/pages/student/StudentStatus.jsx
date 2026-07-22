/* ============================================================
   นักศึกษา — สถานะการกรอกผลสอบรอบปัจจุบัน
   ============================================================ */
import { Icon } from '../../components/Icon.jsx';
import { PageHead, StatusBadge, PassBadge } from '../../components/ui.jsx';
import { Donut } from '../../components/charts.jsx';
import { ROUNDS, SUBJECTS } from '../../mock/mockData.js';

export function StudentStatus({ go }) {
  // เดโม: จำลองว่าส่งแล้ว รอเจ้าหน้าที่ตรวจ (วิชาที่ 5 ไม่ผ่าน)
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
          {/* สถานะปัจจุบัน */}
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
          {/* สรุปผลรายวิชา */}
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
        {/* ไทม์ไลน์ด้านขวา */}
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
