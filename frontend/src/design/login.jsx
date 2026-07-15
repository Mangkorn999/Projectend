/* ============================================================
   Login screen — PSU One Passport
   ============================================================ */
import { useState } from 'react';
import { Icon } from './data.jsx';
import { Logo } from './logos.jsx';

export function Login({ onLogin }) {
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const roles = [
    { k:'student', label:'นักศึกษา', desc:'กรอกผลสอบ · อัปโหลดหลักฐาน · ดูสถานะ', icon:'graduation' },
    { k:'officer', label:'เจ้าหน้าที่คณะ', desc:'ตรวจสอบ · ยืนยัน · จัดการระบบ · ออกรายงาน', icon:'shield' },
    { k:'executive', label:'ผู้บริหารคณะ', desc:'Dashboard · สถิติ · รายงานสรุป', icon:'chart' },
    { k:'admin', label:'ผู้ดูแลระบบ', desc:'จัดการผู้ใช้ · audit · ตั้งค่าระบบ', icon:'key' },
  ];
  const go = () => { setLoading(true); setTimeout(()=>onLogin(role), 850); };

  return (
    <div style={{ minHeight:'100vh', display:'grid', gridTemplateColumns:'1.05fr 1fr' }} className="login-wrap">
      {/* left brand panel */}
      <div className="login-brand" style={{ background:'linear-gradient(155deg,var(--navy-800),#4a2601)',
        color:'#fff', padding:'48px 56px', display:'flex', flexDirection:'column', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', width:480, height:480, borderRadius:'50%', right:-160, top:-160,
          background:'radial-gradient(circle,rgba(212,160,23,.20),transparent 70%)' }}></div>
        <div style={{ position:'absolute', width:360, height:360, borderRadius:'50%', left:-120, bottom:-140,
          background:'radial-gradient(circle,rgba(37,99,235,.22),transparent 70%)' }}></div>
        <div style={{ display:'flex', alignItems:'center', gap:13, position:'relative' }}>
          <Logo size={46} light />
          <div style={{ lineHeight:1.3 }}>
            <div style={{ fontWeight:800, fontSize:16, whiteSpace:'nowrap' }}>คณะพยาบาลศาสตร์</div>
            <div style={{ fontSize:12.5, opacity:.8, whiteSpace:'nowrap' }}>มหาวิทยาลัยสงขลานครินทร์</div>
          </div>
        </div>
        <div style={{ margin:'auto 0', position:'relative' }}>
          <div className="chip" style={{ alignSelf:'flex-start', background:'rgba(255,255,255,.12)', color:'var(--gold-500)', fontWeight:700, marginBottom:20 }}>
            <Icon name="shield" size={15} /> ระบบสารสนเทศคณะ
          </div>
          <h1 style={{ fontSize:38, fontWeight:800, margin:'0 0 16px', lineHeight:1.18, letterSpacing:'-.01em', color:'#fff' }}>
            ระบบบันทึก<br/>ใบประกอบวิชาชีพ
          </h1>
          <p style={{ fontSize:15.5, opacity:.85, maxWidth:380, lineHeight:1.6, margin:0 }}>
            ศูนย์กลางบันทึก ติดตาม ตรวจสอบ และสรุปผลการสอบความรู้เพื่อขึ้นทะเบียน
            ใบประกอบวิชาชีพการพยาบาล — สำหรับนักศึกษา เจ้าหน้าที่ และผู้บริหารคณะ
          </p>
          <div style={{ display:'flex', gap:26, marginTop:34 }}>
            {[['8','รายวิชาสอบ'],['4','บทบาทผู้ใช้'],['100%','ตรวจสอบย้อนหลังได้']].map(([n,l])=>(
              <div key={l}>
                <div className="tnum" style={{ fontSize:26, fontWeight:800, color:'var(--gold-500)' }}>{n}</div>
                <div style={{ fontSize:12.5, opacity:.78 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize:12, opacity:.6, position:'relative' }}>© 2569 Faculty of Nursing, PSU · เดโมต้นแบบ</div>
      </div>

      {/* right form */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 32px', background:'var(--canvas)' }}>
        <div style={{ width:'100%', maxWidth:404 }}>
          <div className="only-mobile" style={{ marginBottom:24, justifyContent:'center' }}><Logo size={44} /></div>
          <h2 style={{ margin:'0 0 6px', fontSize:24, fontWeight:800, color:'var(--ink-900)' }}>เข้าสู่ระบบ</h2>
          <p style={{ margin:'0 0 24px', color:'var(--ink-500)', fontSize:14.5 }}>เลือกบทบาทเพื่อทดลองใช้งานระบบต้นแบบ</p>

          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:22 }}>
            {roles.map(r=>(
              <button key={r.k} onClick={()=>setRole(r.k)}
                style={{ display:'flex', alignItems:'center', gap:13, padding:'13px 15px', borderRadius:13, textAlign:'left',
                  background: role===r.k?'#fff':'transparent', cursor:'pointer', transition:'.15s', width:'100%',
                  border:'1.5px solid '+(role===r.k?'var(--navy-600)':'var(--ink-200)'),
                  boxShadow: role===r.k?'0 0 0 3px var(--blue-50)':'none' }}>
                <div style={{ width:40, height:40, borderRadius:11, flex:'none', display:'flex', alignItems:'center', justifyContent:'center',
                  background: role===r.k?'var(--navy-700)':'var(--ink-100)', color: role===r.k?'var(--gold-500)':'var(--ink-500)' }}>
                  <Icon name={r.icon} size={21} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:15, color:'var(--ink-900)' }}>{r.label}</div>
                  <div style={{ fontSize:12.5, color:'var(--ink-500)' }}>{r.desc}</div>
                </div>
                <div style={{ width:20, height:20, borderRadius:'50%', flex:'none',
                  border:'2px solid '+(role===r.k?'var(--navy-600)':'var(--ink-300)'),
                  background: role===r.k?'var(--navy-600)':'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {role===r.k && <Icon name="check" size={12} style={{ color:'#fff' }} />}
                </div>
              </button>
            ))}
          </div>

          <button className="btn btn-primary btn-lg btn-block" onClick={go} disabled={loading} style={{ gap:10 }}>
            {loading ? <>กำลังเข้าสู่ระบบ…</> : <><Icon name="key" size={18} /> เข้าสู่ระบบด้วย PSU One Passport</>}
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:18, color:'var(--ink-500)', fontSize:12.5, justifyContent:'center' }}>
            <Icon name="shield" size={15} /> ยืนยันตัวตนผ่านบัญชี PSU One Passport อย่างปลอดภัย
          </div>
        </div>
      </div>
      <style>{`@media(max-width:860px){.login-wrap{grid-template-columns:1fr!important;} .login-brand{display:none!important;}}`}</style>
    </div>
  );
}
