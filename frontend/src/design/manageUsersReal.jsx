/* ============================================================
   เจ้าหน้าที่ — จัดการบัญชีผู้บริหาร/เจ้าหน้าที่ (ข้อมูลจริงจาก backend)
   แทนที่ ManageUsers เดิมใน officer-manage.jsx ที่ใช้ user list ปลอมในเครื่อง
   สร้างบัญชีผ่าน POST /api/users — เจ้าหน้าที่ตั้งรหัสชั่วคราวให้ตอนสร้าง บังคับเปลี่ยนตอน login ครั้งแรก
   (ไม่มี first-setup แยกแล้ว ใช้กลไก must_change_password เดียวกับ ForceChangePassword)
   รีเซ็ตรหัสผ่าน POST /api/users/:id/reset-password — เจ้าหน้าที่ตั้งรหัสชั่วคราวใหม่ให้ทันที
   ถอนสิทธิ์ผ่าน POST /api/users/:id/revoke — ไม่ลบ record (กัน FK พัง) แค่เคลียร์ password ให้ login ไม่ได้อีก
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, Modal, Avatar } from './components.jsx';
import { apiFetch, ApiError } from './api.js';
import { t } from './i18n.js';

export function ManageUsersReal({ toast, currentUserId, lang }) {
  const [users, setUsers] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ psu_passport_id: '', password: '', role_name: 'executive', first_name: '', last_name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // { user, action: 'reset' | 'revoke' }
  const [resetPassword, setResetPassword] = useState(''); // รหัสชั่วคราวที่เจ้าหน้าที่ตั้งให้ตอน reset
  const [confirmError, setConfirmError] = useState('');
  const tt = (key, vars) => t(lang, key, vars);
  const ROLE_LABEL = { officer: tt('role.officer'), executive: tt('role.executive') };

  const load = () => { apiFetch('/users').then(all => setUsers(all.filter(u => u.role.role_name === 'officer' || u.role.role_name === 'executive'))).catch(e => toast(e.message, 'error')); };
  useEffect(load, []);

  // ทั้ง 2 ปุ่มเป็นการกระทำที่ย้อนกลับเองไม่ได้ (เจ้าตัว login ด้วยรหัสเดิมไม่ได้อีกแล้ว)
  // เลยถามยืนยันก่อนเสมอ ไม่ยิงทันทีที่กด
  const runConfirmed = async () => {
    const { user, action } = confirm;
    setConfirmError('');
    if (action === 'reset' && resetPassword.length < 8) {
      setConfirmError(tt('usersMgmt.passwordTooShort'));
      return;
    }
    try {
      if (action === 'reset') {
        await apiFetch(`/users/${user.user_id}/reset-password`, { method: 'POST', body: { new_password: resetPassword } });
        toast(tt('usersMgmt.resetToast', { name: user.first_name }), 'info');
      } else {
        await apiFetch(`/users/${user.user_id}/revoke`, { method: 'POST' });
        toast(tt('usersMgmt.revokeToast'), 'info');
      }
      setConfirm(null);
      setResetPassword('');
      load();
    } catch (e) {
      setConfirmError(e instanceof ApiError ? e.message : tt('usersMgmt.revokeFailMsg'));
    }
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await apiFetch('/users', { method: 'POST', body: form });
      toast(tt('usersMgmt.addedToast'));
      setModal(null);
      setForm({ psu_passport_id: '', password: '', role_name: 'executive', first_name: '', last_name: '', email: '', phone: '' });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tt('usersMgmt.addFailMsg'));
    } finally {
      setSaving(false);
    }
  };

  if (!users) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>{tt('common.loading')}</div>;

  return (
    <div className="fade-up">
      <PageHead title={tt('usersMgmt.title')} sub={tt('usersMgmt.sub')}
        actions={<button className="btn btn-primary" onClick={() => setModal(true)}><Icon name="plus" size={17} /> {tt('usersMgmt.addBtn')}</button>} />
      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="tbl">
          <thead><tr><th>{tt('usersMgmt.colName')}</th><th>{tt('usersMgmt.colUsername')}</th><th>{tt('usersMgmt.colEmail')}</th><th>{tt('usersMgmt.colRole')}</th><th>{tt('usersMgmt.colStatus')}</th><th></th></tr></thead>
          <tbody>{users.map(u => (
            <tr key={u.user_id}>
              <td><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={u.first_name} size={34} bg="var(--navy-600)" />
                <span style={{ fontWeight: 600 }}>{u.first_name} {u.last_name}</span></div></td>
              <td className="mono" style={{ fontSize: 15, color: 'var(--ink-500)' }}>{u.psu_passport_id}</td>
              <td className="mono" style={{ fontSize: 15, color: 'var(--ink-500)' }}>{u.email}</td>
              <td><span className="chip" style={{ background: 'var(--blue-50)', color: 'var(--blue-600)', fontWeight: 600 }}><Icon name="chart" size={13} /> {ROLE_LABEL[u.role.role_name]}</span></td>
              {/* must_change_password = ยังไม่เคยตั้งรหัสเอง (บัญชีใหม่ หรือเพิ่งถูกรีเซ็ต) */}
              <td>
                {u.must_change_password
                  ? <span className="badge wait"><span className="dot" />{tt('usersMgmt.statusPending')}</span>
                  : <span className="badge ok"><span className="dot" />{tt('usersMgmt.statusActive')}</span>}
              </td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button className="btn btn-ghost btn-sm" style={{ marginRight: 6 }}
                  disabled={u.user_id === currentUserId || u.must_change_password}
                  title={tt('usersMgmt.resetHint')}
                  onClick={() => { setConfirm({ user: u, action: 'reset' }); setResetPassword(''); setConfirmError(''); }}>
                  <Icon name="key" size={15} /> {tt('usersMgmt.resetBtn')}</button>
                <button className="btn btn-danger btn-sm" disabled={u.user_id === currentUserId}
                  onClick={() => { setConfirm({ user: u, action: 'revoke' }); setConfirmError(''); }}>
                  <Icon name="trash" size={15} /> {tt('usersMgmt.revokeBtn')}</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={tt('usersMgmt.modalTitle')} width={460}
        footer={<><button className="btn btn-ghost" onClick={() => setModal(null)}>{tt('usersMgmt.cancelBtn')}</button>
          <button className="btn btn-primary" disabled={saving} onClick={submit}>{saving ? tt('usersMgmt.saving') : tt('usersMgmt.addBtn')}</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field"><label>{tt('usersMgmt.fieldRole')}</label>
            <select className="select" value={form.role_name} onChange={e => setForm(f => ({ ...f, role_name: e.target.value }))}>
              <option value="executive">{tt('role.executive')}</option>
              <option value="officer">{tt('role.officer')}</option>
            </select>
          </div>
          <div className="field"><label>{tt('usersMgmt.fieldUsername')}</label><input className="input" value={form.psu_passport_id} onChange={e => setForm(f => ({ ...f, psu_passport_id: e.target.value }))} />
            <span className="hint">{tt('usersMgmt.usernameHint')}</span></div>
          <div className="field"><label>{tt('usersMgmt.fieldPassword')}</label>
            <input className="input" type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="อย่างน้อย 8 ตัวอักษร" />
            <span className="hint">{tt('usersMgmt.passwordHint')}</span></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1 }}><label>{tt('usersMgmt.fieldFirstName')}</label><input className="input" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
            <div className="field" style={{ flex: 1 }}><label>{tt('usersMgmt.fieldLastName')}</label><input className="input" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
          </div>
          <div className="field"><label>{tt('usersMgmt.fieldEmail')}</label><input className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@psu.ac.th" /></div>
          <div className="field"><label>{tt('usersMgmt.fieldPhone')}</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          {error && <div style={{ color: 'var(--reject,#dc2626)', fontSize: 15 }}>{error}</div>}
        </div>
      </Modal>

      {/* ยืนยันก่อนรีเซ็ต/ถอนสิทธิ์ — ทั้งคู่ทำให้เจ้าตัว login ไม่ได้ทันที */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)} width={420}
        title={confirm?.action === 'reset' ? tt('usersMgmt.confirmResetTitle') : tt('usersMgmt.confirmRevokeTitle')}
        footer={<><button className="btn btn-ghost" onClick={() => setConfirm(null)}>{tt('usersMgmt.cancelBtn')}</button>
          <button className={confirm?.action === 'reset' ? 'btn btn-primary' : 'btn btn-danger'} onClick={runConfirmed}>
            {confirm?.action === 'reset' ? tt('usersMgmt.resetBtn') : tt('usersMgmt.revokeBtn')}</button></>}>
        {confirm && (
          <>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: 'var(--ink-700)' }}>
              {confirm.action === 'reset'
                ? tt('usersMgmt.confirmResetBody', { name: `${confirm.user.first_name} ${confirm.user.last_name}` })
                : tt('usersMgmt.confirmRevokeBody', { name: `${confirm.user.first_name} ${confirm.user.last_name}` })}
            </p>
            {confirm.action === 'reset' && (
              <div className="field" style={{ marginTop: 14 }}>
                <label>{tt('usersMgmt.fieldNewPassword')}</label>
                <input className="input" type="text" value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="อย่างน้อย 8 ตัวอักษร" autoFocus />
              </div>
            )}
            {confirmError && <div style={{ color: 'var(--reject,#dc2626)', fontSize: 15, marginTop: 10 }}>{confirmError}</div>}
          </>
        )}
      </Modal>
    </div>
  );
}
