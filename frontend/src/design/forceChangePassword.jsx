/* ============================================================
   บังคับเปลี่ยนรหัสผ่าน — บัญชี officer/executive ที่เจ้าหน้าที่สร้างให้
   ยังไม่เคยเปลี่ยนจากรหัสชั่วคราว (must_change_password = true)
   backend block ทุก endpoint ยกเว้น /me กับ /password จนกว่าจะเปลี่ยนสำเร็จ
   เปลี่ยนเสร็จแล้วเข้าระบบต่อได้เลย ไม่ต้อง login ใหม่ (backend เช็ค must_change_password จาก DB สดทุก request ไม่ได้ดูใน token)
   ============================================================ */
import { useState } from 'react';
import { Icon } from './data.jsx';
import { Logo } from './logos.jsx';
import { apiFetch, ApiError } from './api.js';

export function ForceChangePassword({ onDone }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!currentPassword || !newPassword) { setError('กรุณากรอกรหัสผ่านเดิมและรหัสผ่านใหม่'); return; }
    if (newPassword.length < 8) { setError('รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร'); return; }
    if (newPassword !== confirm) { setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน'); return; }
    setLoading(true);
    try {
      await apiFetch('/auth/password', {
        method: 'PATCH',
        body: { current_password: currentPassword, new_password: newPassword },
      });
      // cookie เดิมใช้ต่อได้เลย — backend ตั้ง must_change_password = false ใน DB แล้ว
      // ให้ app ถาม /auth/me แล้วพาเข้าหน้าเริ่มต้นตาม role (ไม่ต้องพามา login ใหม่)
      await onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'linear-gradient(155deg,var(--ink-50),var(--gold-100) 180%)', padding:24 }}>
      <div style={{ width:'100%', maxWidth:420 }} className="fade-up">
        <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}><Logo size={44} /></div>
        <div className="card" style={{ padding:28 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <div style={{ width:44, height:44, borderRadius:12, flex:'none', background:'var(--gold-100)',
              color:'var(--navy-800)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Icon name="key" size={22} />
            </div>
            <div>
              <h2 style={{ margin:0, fontSize:21, fontWeight:800, color:'var(--ink-900)' }}>ต้องเปลี่ยนรหัสผ่านก่อนใช้งาน</h2>
              <p style={{ margin:'2px 0 0', color:'var(--ink-500)', fontSize:15 }}>ใช้รหัสผ่านชั่วคราวที่เจ้าหน้าที่ตั้งให้อยู่</p>
            </div>
          </div>

          <div className="field" style={{ marginBottom:12 }}>
            <label>รหัสผ่านชั่วคราว (เดิม)</label>
            <input className="input" type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom:12 }}>
            <label>รหัสผ่านใหม่</label>
            <input className="input" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="อย่างน้อย 8 ตัวอักษร" />
          </div>
          <div className="field" style={{ marginBottom:16 }}>
            <label>ยืนยันรหัสผ่านใหม่</label>
            <input className="input" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} />
          </div>
          {error && <div style={{ color:'var(--status-reject-fg)', background:'var(--status-reject-bg)',
            borderRadius:9, padding:'9px 12px', fontSize:15, marginBottom:14 }}>{error}</div>}
          <button className="btn btn-primary btn-lg btn-block" onClick={submit} disabled={loading}>
            {loading ? 'กำลังเปลี่ยนรหัสผ่าน…' : 'เปลี่ยนรหัสผ่าน'}
          </button>
        </div>
      </div>
    </div>
  );
}
