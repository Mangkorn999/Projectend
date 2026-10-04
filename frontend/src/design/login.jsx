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
const usernameLabel_EN = 'Username / Student ID';
const passwordLabel_EN = 'Password';
const loggingIn_EN = 'Signing in…';
const signInBtn_EN = 'Sign In';

// ลูกกลมแก้วลอยขึ้นด้านหลังหัวเรื่อง (ตกแต่งอย่างเดียว) — แก้ตำแหน่ง/ขนาด/ความเร็วได้ที่ตารางนี้
// left = ตำแหน่งแนวนอน (%), size = ขนาด (px), duration = วินาทีที่ลอยจนสุด, delay = หน่วงเริ่ม (ติดลบ = เหมือนลอยมาก่อนแล้ว)
const BUBBLES = [
  { left: 6,  size: 46, duration: 19, delay: -2 },
  { left: 14, size: 18, duration: 14, delay: -9 },
  { left: 22, size: 72, duration: 26, delay: -14 },
  { left: 31, size: 26, duration: 17, delay: -5 },
  { left: 40, size: 54, duration: 23, delay: -18 },
  { left: 48, size: 14, duration: 13, delay: -7 },
  { left: 56, size: 38, duration: 20, delay: -11 },
  { left: 64, size: 84, duration: 28, delay: -3 },
  { left: 72, size: 22, duration: 15, delay: -12 },
  { left: 80, size: 50, duration: 22, delay: -16 },
  { left: 88, size: 30, duration: 18, delay: -6 },
  { left: 94, size: 62, duration: 25, delay: -20 },
];

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
        {/* ── พื้นหลังเคลื่อนไหว (ตกแต่งอย่างเดียว) — CSS ล้วน อยู่ในบล็อก <style> ท้ายไฟล์ ── */}
        {/* aurora: ก้อนสีเบลอลอยช้าๆ */}
        <div className="lg-aurora lg-aurora-1" />
        <div className="lg-aurora lg-aurora-2" />
        <div className="lg-aurora lg-aurora-3" />
        <div className="lg-aurora lg-aurora-4" />
        {/* จุดเล็กๆ เป็นเท็กซ์เจอร์บางๆ */}
        <div className="lg-dots" />
        {/* ลูกกลมแก้วลอยขึ้น */}
        {BUBBLES.map((b, i) => (
          <span key={i} className="lg-bubble"
            style={{ left:`${b.left}%`, width:b.size, height:b.size,
              animationDuration:`${b.duration}s`, animationDelay:`${b.delay}s` }} />
        ))}
        {/* เส้นชีพจร (ECG) วิ่งผ่านด้านล่าง */}
        <svg className="lg-ecg" viewBox="0 0 600 80" preserveAspectRatio="none" aria-hidden="true">
          <path className="lg-ecg-base" pathLength="100"
            d="M0 40 H120 L140 40 L155 10 L175 70 L190 40 H260 L275 33 L290 40 H400 L420 40 L435 8 L455 72 L470 40 H600" />
          <path className="lg-ecg-glow" pathLength="100"
            d="M0 40 H120 L140 40 L155 10 L175 70 L190 40 H260 L275 33 L290 40 H400 L420 40 L435 8 L455 72 L470 40 H600" />
          <path className="lg-ecg-pulse" pathLength="100"
            d="M0 40 H120 L140 40 L155 10 L175 70 L190 40 H260 L275 33 L290 40 H400 L420 40 L435 8 L455 72 L470 40 H600" />
        </svg>
        <div style={{ display:'flex', alignItems:'center', gap:13, position:'relative', zIndex:2 }}>
          <Logo size={46} light />
          <div style={{ lineHeight:1.3 }}>
            <div style={{ fontWeight:800, fontSize:18, whiteSpace:'nowrap' }}>{isEN?facultyName_EN:'คณะพยาบาลศาสตร์'}</div>
            <div style={{ fontSize:14.5, opacity:.8, whiteSpace:'nowrap' }}>{isEN?universityName_EN:'มหาวิทยาลัยสงขลานครินทร์'}</div>
          </div>
        </div>
        {/* หัวเรื่อง — ชื่อระบบสองภาษาคั่นด้วยเส้นทอง ไม่มีคำโปรย/ตัวเลขโฆษณา
            (ตั้งใจให้อ่านเหมือนป้ายชื่อระบบของหน่วยงาน ไม่ใช่หน้า landing page) */}
        <div style={{ margin:'auto 0', position:'relative', zIndex:2 }}>
          <h1 className="lg-rise lg-rise-1" style={{ fontSize:40, fontWeight:800, margin:0, lineHeight:1.18, letterSpacing:'-.01em', color:'#fff',
            textShadow:'0 2px 24px rgba(90,35,0,.25)' }}>
            {isEN ? <>{heroTitle_EN[0]}<br/>{heroTitle_EN[1]}</> : <>ระบบบันทึก<br/>ใบอนุญาตประกอบวิชาชีพ</>}
          </h1>
          <div className="lg-gold-line lg-rise lg-rise-2" style={{ width:64, height:3, background:'var(--gold-50)', borderRadius:2, margin:'22px 0' }} />
          <p className="lg-rise lg-rise-3" style={{ fontSize:17, margin:0, letterSpacing:'.01em', color:'rgba(255,255,255,.82)' }}>
            {isEN ? heroSubtitle_TH : heroSubtitle_EN}
          </p>
        </div>
        <div style={{ fontSize:14, opacity:.6, position:'relative', zIndex:2 }}>
          {isEN?footerNote_EN:'© 2569 คณะพยาบาลศาสตร์ มหาวิทยาลัยสงขลานครินทร์'}
        </div>
      </div>

      {/* right form */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 32px', background:'var(--canvas)',
        flex:'1 1 380px', overflowY:'auto', position:'relative' }}>
        {/* ก้อนสีส้มอ่อนเบลอด้านหลังฟอร์ม — ห่อด้วย div overflow hidden กันไม่ให้เกิด scrollbar */}
        <div className="lg-form-bg" aria-hidden="true">
          <div className="lg-form-blob lg-form-blob-1" />
          <div className="lg-form-blob lg-form-blob-2" />
        </div>
        <div className="lg-form-in" style={{ width:'100%', maxWidth:404, position:'relative', zIndex:1 }}>
          <div className="only-mobile" style={{ marginBottom:24, justifyContent:'center' }}><Logo size={44} /></div>

          <h2 style={{ margin:'0 0 20px', fontSize:26, fontWeight:800, color:'var(--ink-900)' }}>{isEN?signinTitle_EN:'เข้าสู่ระบบ'}</h2>

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
      <style>{`
        @media(max-width:860px){.login-brand{display:none!important;}}

        /* ===== พื้นหลังเคลื่อนไหวของหน้า login — ใช้แค่ transform/opacity เพื่อให้ลื่น ===== */

        /* aurora: ก้อนสีเบลอ 4 ก้อนลอยวนช้าๆ (สีส้ม/อำพัน/ส้มอิฐ/ทอง) */
        .lg-aurora { position:absolute; border-radius:50%; pointer-events:none; will-change:transform; backface-visibility:hidden; }
        .lg-aurora-1 { width:520px; height:520px; left:-160px; top:-140px;
          background:radial-gradient(circle, rgba(255,176,64,.75), transparent 68%); animation:lg-drift-a 22s ease-in-out infinite alternate; }
        .lg-aurora-2 { width:460px; height:460px; right:-140px; top:18%;
          background:radial-gradient(circle, rgba(240,192,90,.55), transparent 68%); animation:lg-drift-b 27s ease-in-out infinite alternate; }
        .lg-aurora-3 { width:560px; height:560px; left:-120px; bottom:-220px;
          background:radial-gradient(circle, rgba(220,80,20,.65), transparent 68%); animation:lg-drift-c 25s ease-in-out infinite alternate; }
        .lg-aurora-4 { width:340px; height:340px; left:38%; top:34%;
          background:radial-gradient(circle, rgba(255,140,50,.45), transparent 68%); animation:lg-drift-b 31s ease-in-out infinite alternate-reverse; }
        @keyframes lg-drift-a { from{transform:translate3d(0,0,0);} to{transform:translate3d(140px,110px,0);} }
        @keyframes lg-drift-b { from{transform:translate3d(0,0,0);} to{transform:translate3d(-120px,90px,0);} }
        @keyframes lg-drift-c { from{transform:translate3d(0,0,0);} to{transform:translate3d(120px,-120px,0);} }

        /* dot grid บางๆ ให้พื้นมีเท็กซ์เจอร์ */
        .lg-dots { position:absolute; inset:0; pointer-events:none; opacity:.5;
          background-image:radial-gradient(rgba(255,255,255,.22) 1.2px, transparent 1.4px); background-size:28px 28px;
          -webkit-mask-image:radial-gradient(ellipse at 50% 45%, #000 20%, transparent 78%);
                  mask-image:radial-gradient(ellipse at 50% 45%, #000 20%, transparent 78%); }

        /* ลูกกลมแก้ว: ลอยขึ้นจากล่างจอ แล้วจางหาย */
        .lg-bubble { position:absolute; bottom:-120px; border-radius:50%; pointer-events:none; will-change:transform, opacity;
          background:radial-gradient(circle at 30% 28%, rgba(255,255,255,.55), rgba(255,255,255,.10) 55%, rgba(255,255,255,.04));
          border:1px solid rgba(255,255,255,.28);
          animation:lg-float linear infinite; }
        @keyframes lg-float {
          0%   { transform:translate3d(0,0,0);        opacity:0; }
          10%  { opacity:.9; }
          50%  { transform:translate3d(18px,-55vh,0); }
          90%  { opacity:.7; }
          100% { transform:translate3d(-14px,-115vh,0); opacity:0; }
        }

        /* เส้น ECG: เส้นจางอยู่ตลอด + แสงทองวิ่งไปตามเส้น */
        .lg-ecg { position:absolute; left:0; right:0; bottom:110px; width:100%; height:80px; pointer-events:none; opacity:.9; }
        .lg-ecg path { fill:none; stroke-linecap:round; stroke-linejoin:round; vector-effect:non-scaling-stroke; }
        .lg-ecg-base  { stroke:rgba(255,255,255,.16); stroke-width:1.5; }
        .lg-ecg-glow  { stroke:rgba(255,214,120,.28); stroke-width:9; stroke-dasharray:14 86; stroke-dashoffset:14; animation:lg-pulse 4.5s linear infinite; }
        .lg-ecg-pulse { stroke:#ffe29a; stroke-width:2.5; stroke-dasharray:14 86; stroke-dashoffset:14; animation:lg-pulse 4.5s linear infinite; }
        @keyframes lg-pulse { from{stroke-dashoffset:14;} to{stroke-dashoffset:-100;} }

        /* ข้อความหัวเรื่อง: fade-up ทีละบรรทัดตอนโหลด */
        .lg-rise { opacity:0; animation:lg-rise .9s cubic-bezier(.2,.7,.2,1) forwards; }
        .lg-rise-1 { animation-delay:.15s; } .lg-rise-2 { animation-delay:.40s; } .lg-rise-3 { animation-delay:.60s; }
        @keyframes lg-rise { from{opacity:0; transform:translateY(22px);} to{opacity:1; transform:translateY(0);} }

        /* เส้นทองใต้หัวเรื่อง: มีแสงวิบผ่านเป็นระยะ */
        .lg-gold-line { position:relative; overflow:hidden; }
        .lg-gold-line::after { content:''; position:absolute; top:0; bottom:0; width:28px; left:0;
          background:linear-gradient(90deg, transparent, rgba(255,255,255,.95), transparent); animation:lg-shimmer 3.6s ease-in-out 1.4s infinite; }
        @keyframes lg-shimmer { 0%{transform:translateX(-30px);} 45%,100%{transform:translateX(70px);} }

        /* ฝั่งฟอร์ม: ก้อนส้มอ่อนเบลอด้านหลัง + ฟอร์มเลื่อนเข้าเบาๆ */
        .lg-form-bg { position:absolute; inset:0; overflow:hidden; pointer-events:none; }
        .lg-form-blob { position:absolute; border-radius:50%; will-change:transform; backface-visibility:hidden; }
        .lg-form-blob-1 { width:420px; height:420px; right:-120px; top:-100px;
          background:radial-gradient(circle, rgba(245,130,32,.22), transparent 70%); animation:lg-drift-b 24s ease-in-out infinite alternate; }
        .lg-form-blob-2 { width:380px; height:380px; left:-120px; bottom:-120px;
          background:radial-gradient(circle, rgba(240,192,90,.28), transparent 70%); animation:lg-drift-a 28s ease-in-out infinite alternate; }
        .lg-form-in { animation:lg-form-in .8s cubic-bezier(.2,.7,.2,1) .1s both; }
        @keyframes lg-form-in { from{opacity:0; transform:translateY(16px);} to{opacity:1; transform:translateY(0);} }

        /* คนที่ตั้งค่า "ลดการเคลื่อนไหว" ในเครื่อง → หยุด animation ทั้งหมด แสดงภาพนิ่งแทน */
        @media (prefers-reduced-motion: reduce) {
          .lg-aurora, .lg-bubble, .lg-ecg-pulse, .lg-ecg-glow, .lg-gold-line::after, .lg-form-blob { animation:none !important; }
          .lg-bubble { display:none; }
          .lg-rise, .lg-form-in { animation:none !important; opacity:1; }
        }
      `}</style>
    </div>
  );
}

