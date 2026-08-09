/* ============================================================
   ตั้งรหัสผ่านครั้งแรก — เฉพาะนักศึกษาที่เจ้าหน้าที่ import เข้าระบบแล้ว
   ยืนยันตัวตนด้วย รหัสนักศึกษา + ชื่อ + นามสกุล (ต้องตรงกับข้อมูล import เป๊ะ)
   เรียก POST /api/auth/first-setup จริง ไม่ใช่ mock
   ============================================================ */
import { useState } from 'react';
import { Icon } from './data.jsx';
import { Logo } from './logos.jsx';
import { apiFetch, ApiError } from './api.js';

export function FirstSetup({ onBack, lang }) {
  const isEN = lang==='EN';
  const [studentId, setStudentId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const submit = async () => {
    setError('');
    if (!studentId || !firstName || !lastName || !password) {
      setError(isEN?'Please fill in all fields':'กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    if (password.length < 8) {
      setError(isEN?'Password must be at least 8 characters':'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
      return;
    }
    if (password !== confirm) {
      setError(isEN?'Passwords do not match':'รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }
    setLoading(true);
    try {
      // backend เช็ค student_id+first_name+last_name ตรงกับที่เจ้าหน้าที่ import ไว้ไหม
      // ถ้าเคยตั้งรหัสไปแล้ว backend จะตอบ 409 พร้อมข้อความให้ไป login แทน (ไม่ใช่ recovery flow)
      await apiFetch('/auth/first-setup', {
        method: 'POST',
        auth: false,
        body: { student_id: studentId, first_name: firstName, last_name: lastName, password },
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (isEN?'Something went wrong':'เกิดข้อผิดพลาด'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--canvas)', padding:24 }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}><Logo size={44} /></div>
        <div className="card" style={{ padding:28 }}>
          {done ? (
            <div style={{ textAlign:'center' }}>
              <div style={{ color:'var(--pass,#16a34a)', marginBottom:10 }}><Icon name="checkCircle" size={40}/></div>
              <h2 style={{ margin:'0 0 8px', fontSize:20, fontWeight:800 }}>{isEN?'Password set!':'ตั้งรหัสผ่านสำเร็จ'}</h2>
              <p style={{ color:'var(--ink-500)', fontSize:14, marginBottom:20 }}>
                {isEN?'You can now sign in with your student ID and new password.':'เข้าสู่ระบบด้วยรหัสนักศึกษาและรหัสผ่านใหม่ได้เลย'}
              </p>
              <button className="btn btn-primary btn-block" onClick={onBack}>{isEN?'Back to sign in':'กลับไปหน้าเข้าสู่ระบบ'}</button>
            </div>
          ) : (
            <>
              <h2 style={{ margin:'0 0 6px', fontSize:20, fontWeight:800 }}>{isEN?'Set your password':'ตั้งรหัสผ่านครั้งแรก'}</h2>
              <p style={{ color:'var(--ink-500)', fontSize:13.5, marginBottom:18 }}>
                {isEN?'Enter your student ID and full name exactly as registered.':'กรอกรหัสนักศึกษาและชื่อ-นามสกุลให้ตรงกับที่เจ้าหน้าที่บันทึกไว้'}
              </p>
              <div className="field" style={{ marginBottom:10 }}>
                <label>{isEN?'Student ID':'รหัสนักศึกษา'}</label>
                <input className="input" value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="6xxxxxxxxx"/>
              </div>
              <div style={{ display:'flex', gap:10, marginBottom:10 }}>
                <div className="field" style={{ flex:1 }}>
                  <label>{isEN?'First name':'ชื่อจริง'}</label>
                  <input className="input" value={firstName} onChange={e=>setFirstName(e.target.value)}/>
                </div>
                <div className="field" style={{ flex:1 }}>
                  <label>{isEN?'Last name':'นามสกุล'}</label>
                  <input className="input" value={lastName} onChange={e=>setLastName(e.target.value)}/>
                </div>
              </div>
              <div className="field" style={{ marginBottom:10 }}>
                <label>{isEN?'New password':'รหัสผ่านใหม่'}</label>
                <div style={{ position:'relative' }}>
                  <input className="input" type={showPassword?'text':'password'} style={{ paddingRight:40 }}
                    value={password} onChange={e=>setPassword(e.target.value)} placeholder="อย่างน้อย 8 ตัวอักษร"/>
                  <button type="button" onClick={()=>setShowPassword(v=>!v)}
                    style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                      border:'none', background:'transparent', padding:4, cursor:'pointer',
                      color: showPassword?'var(--navy-700)':'var(--ink-400)' }}>
                    <Icon name="eye" size={18} />
                  </button>
                </div>
              </div>
              <div className="field" style={{ marginBottom:8 }}>
                <label>{isEN?'Confirm password':'ยืนยันรหัสผ่าน'}</label>
                <div style={{ position:'relative' }}>
                  <input className="input" type={showConfirm?'text':'password'} style={{ paddingRight:40 }}
                    value={confirm} onChange={e=>setConfirm(e.target.value)}/>
                  <button type="button" onClick={()=>setShowConfirm(v=>!v)}
                    style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                      border:'none', background:'transparent', padding:4, cursor:'pointer',
                      color: showConfirm?'var(--navy-700)':'var(--ink-400)' }}>
                    <Icon name="eye" size={18} />
                  </button>
                </div>
              </div>
              {error && <div style={{ color:'var(--reject,#dc2626)', fontSize:13, marginBottom:12 }}>{error}</div>}
              <button className="btn btn-primary btn-block" onClick={submit} disabled={loading} style={{ marginBottom:10 }}>
                {loading ? (isEN?'Submitting…':'กำลังตั้งรหัสผ่าน…') : (isEN?'Set password':'ตั้งรหัสผ่าน')}
              </button>
              <button className="btn btn-ghost btn-block" onClick={onBack}>{isEN?'← Back to sign in':'← กลับไปหน้าเข้าสู่ระบบ'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
