/* ============================================================
   Login screen — normal signin/signup
   (SSO via PSU One Passport was ruled out by the advisor; may return later —
    role keys stay on ROLES from data.jsx so a future SSO swap stays easy)
   ============================================================ */
import { useState } from 'react';
import { Icon } from './data.jsx';
import { Logo } from './logos.jsx';
import { apiFetch, setSession, ApiError } from './api.js';
import { FirstSetup } from './firstSetup.jsx';

/* English strings suffixed with _EN for easy grep/review; Thai stays inline as the default */
const facultyName_EN = 'Faculty of Nursing';
const universityName_EN = 'Prince of Songkla University';
const heroTag_EN = 'Faculty Information System';
const heroTitle_EN = ['Nursing License', 'Record System'];
const heroDesc_EN = 'Central hub to record, track, verify, and summarize the nursing license examination — for students, faculty officers, and executives.';
const heroStats_EN = [['8','Exam subjects'],['4','User roles'],['100%','Fully auditable']];
const footerNote_EN = '© 2026 Faculty of Nursing, PSU · Prototype demo';
const signinTitle_EN = 'Sign In';
const signinSub_EN = 'Enter your username and password to sign in';
const usernameLabel_EN = 'Username / Student ID';
const passwordLabel_EN = 'Password';
const loggingIn_EN = 'Signing in…';
const signInBtn_EN = 'Sign In';

// เข้าใช้งานเว็บเดียวกันสำหรับทุก role — role มาจาก JWT/DB เสมอ ไม่มี login mode แยกอีกแล้ว
export function Login({ onLogin }) {
  const [showFirstSetup, setShowFirstSetup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState('TH'); // 'TH' | 'EN'
  const isEN = lang==='EN';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // login จริง ไปหา backend — psu_passport_id คือ student_id (นักศึกษา) หรือรหัสที่เจ้าหน้าที่ตั้งให้ (staff)
  const submit = async () => {
    setError('');
    if (!username || !password) { setError(isEN?'Please fill in all fields':'กรุณากรอกข้อมูลให้ครบ'); return; }
    setLoading(true);
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        auth: false,
        body: { psu_passport_id: username, password },
      });
      setSession(data.token, data.user, data.must_change_password);
      // ส่ง user (มี role จริงจาก JWT) ขึ้นไปให้ App.jsx ใช้ตั้ง state แทน role ปลอมแบบเดิม
      onLogin(data.user, data.must_change_password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (isEN?'Login failed':'เข้าสู่ระบบไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  };

  if (showFirstSetup) return <FirstSetup onBack={()=>setShowFirstSetup(false)} lang={lang} />;

  return (
    <div style={{ minHeight:'100vh', display:'flex', position:'relative' }} className="login-wrap">
      {/* language toggle — top right, above everything */}
      <div style={{ position:'absolute', top:18, right:22, zIndex:10, display:'inline-flex',
        background:'rgba(255,255,255,.9)', borderRadius:999, padding:3, gap:3, boxShadow:'var(--sh-sm)' }}>
        <button onClick={()=>setLang('TH')} style={{ border:'none', padding:'6px 14px', borderRadius:999, fontSize:12.5, fontWeight:700,
          fontFamily:'inherit', cursor:'pointer', transition:'.13s',
          background: !isEN?'var(--navy-700)':'transparent', color: !isEN?'#fff':'var(--ink-500)' }}>TH</button>
        <button onClick={()=>setLang('EN')} style={{ border:'none', padding:'6px 14px', borderRadius:999, fontSize:12.5, fontWeight:700,
          fontFamily:'inherit', cursor:'pointer', transition:'.13s',
          background: isEN?'var(--navy-700)':'transparent', color: isEN?'#fff':'var(--ink-500)' }}>EN</button>
      </div>

      {/* left brand panel */}
      <div className="login-brand" style={{ background:'linear-gradient(155deg,var(--navy-700),#b3550a)',
        color:'#fff', padding:'48px 56px', display:'flex', flexDirection:'column', position:'relative', overflow:'hidden',
        flex:'1.05 1 480px' }}>
        <div style={{ position:'absolute', width:480, height:480, borderRadius:'50%', right:-160, top:-160,
          background:'radial-gradient(circle,rgba(212,160,23,.20),transparent 70%)' }}></div>
        <div style={{ position:'absolute', width:360, height:360, borderRadius:'50%', left:-120, bottom:-140,
          background:'radial-gradient(circle,rgba(37,99,235,.22),transparent 70%)' }}></div>
        <div style={{ display:'flex', alignItems:'center', gap:13, position:'relative' }}>
          <Logo size={46} light />
          <div style={{ lineHeight:1.3 }}>
            <div style={{ fontWeight:800, fontSize:16, whiteSpace:'nowrap' }}>{isEN?facultyName_EN:'คณะพยาบาลศาสตร์'}</div>
            <div style={{ fontSize:12.5, opacity:.8, whiteSpace:'nowrap' }}>{isEN?universityName_EN:'มหาวิทยาลัยสงขลานครินทร์'}</div>
          </div>
        </div>
        <div style={{ margin:'auto 0', position:'relative' }}>
          <div className="chip" style={{ alignSelf:'flex-start', background:'rgba(255,255,255,.12)', color:'var(--gold-500)', fontWeight:700, marginBottom:20 }}>
            <Icon name="shield" size={15} /> {isEN?heroTag_EN:'ระบบสารสนเทศคณะ'}
          </div>
          <h1 style={{ fontSize:38, fontWeight:800, margin:'0 0 16px', lineHeight:1.18, letterSpacing:'-.01em', color:'#fff' }}>
            {isEN ? <>{heroTitle_EN[0]}<br/>{heroTitle_EN[1]}</> : <>ระบบบันทึก<br/>ใบประกอบวิชาชีพ</>}
          </h1>
          <p style={{ fontSize:15.5, opacity:.85, maxWidth:380, lineHeight:1.6, margin:0 }}>
            {isEN ? heroDesc_EN : <>ศูนย์กลางบันทึก ติดตาม ตรวจสอบ และสรุปผลการสอบความรู้เพื่อขึ้นทะเบียน
            ใบประกอบวิชาชีพการพยาบาล — สำหรับนักศึกษา เจ้าหน้าที่ และผู้บริหารคณะ</>}
          </p>
          <div style={{ display:'flex', gap:26, marginTop:34 }}>
            {(isEN?heroStats_EN:[['8','รายวิชาสอบ'],['4','บทบาทผู้ใช้'],['100%','ตรวจสอบย้อนหลังได้']]).map(([n,l])=>(
              <div key={l}>
                <div className="tnum" style={{ fontSize:26, fontWeight:800, color:'var(--gold-500)' }}>{n}</div>
                <div style={{ fontSize:12.5, opacity:.78 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize:12, opacity:.6, position:'relative' }}>{isEN?footerNote_EN:'© 2569 Faculty of Nursing, PSU · เดโมต้นแบบ'}</div>
      </div>

      {/* right form */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 32px', background:'var(--canvas)',
        flex:'1 1 380px', overflowY:'auto' }}>
        <div style={{ width:'100%', maxWidth:404 }}>
          <div className="only-mobile" style={{ marginBottom:24, justifyContent:'center' }}><Logo size={44} /></div>

          <h2 style={{ margin:'0 0 6px', fontSize:24, fontWeight:800, color:'var(--ink-900)' }}>{isEN?signinTitle_EN:'เข้าสู่ระบบ'}</h2>
          <p style={{ margin:'0 0 20px', color:'var(--ink-500)', fontSize:14.5 }}>
            {isEN?signinSub_EN:'กรอกรหัสผู้ใช้และรหัสผ่านเพื่อเข้าสู่ระบบ'}
          </p>

          <div className="field" style={{ marginBottom:12 }}>
            <label>{isEN?usernameLabel_EN:'รหัสผู้ใช้ (รหัสนักศึกษา / Username)'}</label>
            <input className="input" type="text" placeholder="6xxxxxxxxx"
              value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
          </div>
          <div className="field" style={{ marginBottom:8 }}>
            <label>{isEN?passwordLabel_EN:'รหัสผ่าน'}</label>
            <div style={{ position:'relative' }}>
              <input className="input" type={showPassword?'text':'password'} placeholder="••••••••"
                style={{ paddingRight:40 }}
                value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
              <button type="button" onClick={()=>setShowPassword(v=>!v)}
                style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                  border:'none', background:'transparent', padding:4, cursor:'pointer',
                  color: showPassword?'var(--navy-700)':'var(--ink-400)' }}>
                <Icon name="eye" size={18} />
              </button>
            </div>
          </div>
          {error && <div style={{ color:'var(--reject,#dc2626)', fontSize:13, marginBottom:12 }}>{error}</div>}
          <div style={{ textAlign:'right', marginBottom:18 }}>
            <a onClick={()=>setShowFirstSetup(true)} style={{ fontSize:13, cursor:'pointer' }}>
              {isEN?'First time? Set your password':'เข้าใช้งานครั้งแรก / ตั้งรหัสผ่าน'}
            </a>
          </div>

          <button className="btn btn-primary btn-lg btn-block" onClick={submit} disabled={loading}>
            {loading ? (isEN?loggingIn_EN:'กำลังเข้าสู่ระบบ…') : (isEN?signInBtn_EN:'เข้าสู่ระบบ')}
          </button>
        </div>
      </div>
      <style>{`@media(max-width:860px){.login-brand{display:none!important;}}`}</style>
    </div>
  );
}
