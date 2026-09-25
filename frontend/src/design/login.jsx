/* ============================================================
   Login screen — normal signin/signup
   (SSO via PSU One Passport was ruled out by the advisor; may return later —
    role keys stay on ROLES from data.jsx so a future SSO swap stays easy)
   ============================================================ */
import { useState } from 'react';
import { Icon } from './data.jsx';
import { Logo } from './logos.jsx';
import { apiFetch, setSession, ApiError } from './api.js';

/* English strings suffixed with _EN for easy grep/review; Thai stays inline as the default */
const facultyName_EN = 'Faculty of Nursing';
const universityName_EN = 'Prince of Songkla University';
const heroTitle_EN = ['Nursing License', 'Record System'];
// ชื่อระบบอีกภาษาวางใต้หัวเรื่อง — แบบป้ายสองภาษาของหน่วยงานราชการ ไม่ใช่คำโปรยขายของ
const heroSubtitle_TH = 'ระบบบันทึกใบอนุญาตประกอบวิชาชีพ';
const heroSubtitle_EN = 'Nursing License Record System';
const footerNote_EN = '© 2026 Faculty of Nursing, Prince of Songkla University';

// ── ช่องทางติดต่อเมื่อเข้าระบบไม่ได้ ────────────────────────────
// ตั้งค่าใน frontend/.env (ดู .env.example) — ต้องเป็นอีเมล/เว็บจริงของคณะเท่านั้น
// ไม่ตั้งค่า = แสดงเป็นข้อความเฉยๆ เหมือนเดิม ไม่ใส่ลิงก์มั่วให้นักศึกษากดไปเจอที่ผิด
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || '';
const CONTACT_URL = import.meta.env.VITE_CONTACT_URL || '';
const signinTitle_EN = 'Sign In';
const signinSub_EN = 'Enter your username and password to sign in';
const usernameLabel_EN = 'Username / Student ID';
const passwordLabel_EN = 'Password';
const loggingIn_EN = 'Signing in…';
const signInBtn_EN = 'Sign In';

// จำแค่ username ไว้ — รหัสผ่านไม่เก็บ plaintext ใน localStorage (เสี่ยงถูกขโมยผ่าน XSS)
// ให้ browser password manager จัดการเรื่องจำรหัสผ่านแทน ผ่าน autoComplete บน input
const REMEMBER_KEY = 'nurse_remember_username';

// เข้าใช้งานเว็บเดียวกันสำหรับทุก role — role มาจาก JWT/DB เสมอ ไม่มี login mode แยกอีกแล้ว
export function Login({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState('TH'); // 'TH' | 'EN'
  const isEN = lang==='EN';
  const [username, setUsername] = useState(() => localStorage.getItem(REMEMBER_KEY) || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem(REMEMBER_KEY));
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
      if (rememberMe) localStorage.setItem(REMEMBER_KEY, username);
      else localStorage.removeItem(REMEMBER_KEY);
      // ไม่มี data.token แล้ว — backend ตั้ง httpOnly cookie ให้ browser เก็บเองตอนตอบ request นี้
      setSession(data.user, data.must_change_password, data.profile_incomplete);
      // ส่ง user (มี role จริงจาก JWT) ขึ้นไปให้ App.jsx ใช้ตั้ง state แทน role ปลอมแบบเดิม
      onLogin(data.user, data.must_change_password, data.profile_incomplete);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (isEN?'Login failed':'เข้าสู่ระบบไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', position:'relative' }} className="login-wrap">
      {/* language toggle — top right, above everything */}
      <div style={{ position:'absolute', top:18, right:22, zIndex:10, display:'inline-flex',
        background:'rgba(255,255,255,.9)', borderRadius:999, padding:3, gap:3, boxShadow:'var(--sh-sm)' }}>
        <button onClick={()=>setLang('TH')} style={{ border:'none', padding:'6px 14px', borderRadius:999, fontSize:14.5, fontWeight:700,
          fontFamily:'inherit', cursor:'pointer', transition:'.13s',
          background: !isEN?'var(--navy-700)':'transparent', color: !isEN?'#fff':'var(--ink-500)' }}>TH</button>
        <button onClick={()=>setLang('EN')} style={{ border:'none', padding:'6px 14px', borderRadius:999, fontSize:14.5, fontWeight:700,
          fontFamily:'inherit', cursor:'pointer', transition:'.13s',
          background: isEN?'var(--navy-700)':'transparent', color: isEN?'#fff':'var(--ink-500)' }}>EN</button>
      </div>

      {/* left brand panel */}
      <div className="login-brand" style={{ background:'linear-gradient(155deg,var(--navy-700),#b3550a)',
        color:'#fff', padding:'48px 56px', display:'flex', flexDirection:'column', position:'relative', overflow:'hidden',
        flex:'1 1 480px' }}>
        <div style={{ position:'absolute', width:480, height:480, borderRadius:'50%', right:-160, top:-160,
          background:'radial-gradient(circle,rgba(212,160,23,.20),transparent 70%)' }}></div>
        <div style={{ position:'absolute', width:360, height:360, borderRadius:'50%', left:-120, bottom:-140,
          background:'radial-gradient(circle,rgba(37,99,235,.22),transparent 70%)' }}></div>
        <div style={{ display:'flex', alignItems:'center', gap:13, position:'relative' }}>
          <Logo size={46} light />
          <div style={{ lineHeight:1.3 }}>
            <div style={{ fontWeight:800, fontSize:18, whiteSpace:'nowrap' }}>{isEN?facultyName_EN:'คณะพยาบาลศาสตร์'}</div>
            <div style={{ fontSize:14.5, opacity:.8, whiteSpace:'nowrap' }}>{isEN?universityName_EN:'มหาวิทยาลัยสงขลานครินทร์'}</div>
          </div>
        </div>
        {/* หัวเรื่อง — ชื่อระบบสองภาษาคั่นด้วยเส้นทอง ไม่มีคำโปรย/ตัวเลขโฆษณา
            (ตั้งใจให้อ่านเหมือนป้ายชื่อระบบของหน่วยงาน ไม่ใช่หน้า landing page) */}
        <div style={{ margin:'auto 0', position:'relative' }}>
          <h1 style={{ fontSize:40, fontWeight:800, margin:0, lineHeight:1.18, letterSpacing:'-.01em', color:'#fff' }}>
            {isEN ? <>{heroTitle_EN[0]}<br/>{heroTitle_EN[1]}</> : <>ระบบบันทึก<br/>ใบอนุญาตประกอบวิชาชีพ</>}
          </h1>
          <div style={{ width:64, height:3, background:'var(--gold-50)', borderRadius:2, margin:'22px 0' }} />
          <p style={{ fontSize:17, opacity:.8, margin:0, letterSpacing:'.01em' }}>
            {isEN ? heroSubtitle_TH : heroSubtitle_EN}
          </p>
        </div>
        <div style={{ fontSize:14, opacity:.6, position:'relative' }}>
          {isEN?footerNote_EN:'© 2569 คณะพยาบาลศาสตร์ มหาวิทยาลัยสงขลานครินทร์'}
        </div>
      </div>

      {/* right form */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 32px', background:'var(--canvas)',
        flex:'1 1 380px', overflowY:'auto' }}>
        <div style={{ width:'100%', maxWidth:404 }}>
          <div className="only-mobile" style={{ marginBottom:24, justifyContent:'center' }}><Logo size={44} /></div>

          <h2 style={{ margin:'0 0 6px', fontSize:26, fontWeight:800, color:'var(--ink-900)' }}>{isEN?signinTitle_EN:'เข้าสู่ระบบ'}</h2>
          <p style={{ margin:'0 0 20px', color:'var(--ink-500)', fontSize:16.5 }}>
            {isEN?signinSub_EN:'กรอกรหัสผู้ใช้และรหัสผ่านเพื่อเข้าสู่ระบบ'}
          </p>

          <div className="field" style={{ marginBottom:12 }}>
            <label>{isEN?usernameLabel_EN:'รหัสผู้ใช้ (รหัสนักศึกษา / Username)'}</label>
            <input className="input" type="text" placeholder="6xxxxxxxxx" autoComplete="username"
              value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
          </div>
          <div className="field" style={{ marginBottom:8 }}>
            <label>{isEN?passwordLabel_EN:'รหัสผ่าน'}</label>
            <div style={{ position:'relative' }}>
              <input className="input" type={showPassword?'text':'password'} placeholder="••••••••" autoComplete="current-password"
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
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:15, cursor:'pointer', marginBottom:8 }}>
            <input type="checkbox" checked={rememberMe} onChange={e=>setRememberMe(e.target.checked)} style={{ accentColor:'var(--navy-700)' }} />
            {isEN?'Remember username':'จดจำรหัสผู้ใช้'}
          </label>
          {error && <div style={{ color:'var(--reject,#dc2626)', fontSize:15, marginBottom:12 }}>{error}</div>}
          {/* ล็อกอินไม่ได้ (ลืมรหัส/บัญชีค้าง) = ติดต่อเจ้าหน้าที่คณะเท่านั้น ไม่มี self-service ใดๆ บนหน้านี้แล้ว
              นักศึกษา: รหัสผ่าน = เลขบัตร ปชช ตั้งแต่วันนำเข้า, officer/executive: รหัสชั่วคราวที่เจ้าหน้าที่ตั้งให้ตอนสร้าง/รีเซ็ตบัญชี */}
          <div style={{ marginBottom:18, fontSize:14.5, color:'var(--ink-500)' }}>
            {/* ทั้งประโยค "เข้าสู่ระบบไม่ได้? ติดต่อเจ้าหน้าที่คณะ" เป็นลิงก์เดียว (กดตรงไหนก็ได้)
                มีอีเมลคณะใน .env → เปิดโปรแกรมอีเมลให้เลย
                มีแต่ URL → ลิงก์ไปหน้าเจ้าหน้าที่ผู้รับผิดชอบของคณะ
                ไม่ตั้งทั้งคู่ → ข้อความเฉยๆ (ไม่ผูกลิงก์มั่ว ไม่งั้นนักศึกษากดไปเจอที่ผิด) */}
            {CONTACT_EMAIL ? (
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color:'var(--navy-700)', fontWeight:700, textDecoration:'underline' }}>
                {isEN?'Trouble signing in? Email the faculty officer':'เข้าสู่ระบบไม่ได้? ติดต่อเจ้าหน้าที่คณะ'}
              </a>
            ) : CONTACT_URL ? (
              <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer"
                style={{ color:'var(--navy-700)', fontWeight:700, textDecoration:'underline' }}>
                {isEN?'Trouble signing in? Contact the faculty officer':'เข้าสู่ระบบไม่ได้? ติดต่อเจ้าหน้าที่คณะ'}
              </a>
            ) : (
              <span>{isEN?'Trouble signing in? Ask the faculty officer for help.':'เข้าสู่ระบบไม่ได้? ติดต่อเจ้าหน้าที่คณะ'}</span>
            )}
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

