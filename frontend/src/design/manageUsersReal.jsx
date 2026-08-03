/* ============================================================
   เจ้าหน้าที่ — จัดการบัญชีผู้บริหาร/เจ้าหน้าที่ (ข้อมูลจริงจาก backend)
   แทนที่ ManageUsers เดิมใน officer-manage.jsx ที่ใช้ user list ปลอมในเครื่อง
   สร้างบัญชีผ่าน POST /api/users (ตั้ง password ให้เลย, บังคับเปลี่ยนตอน login แรก — logic เดิมของระบบ)
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
  const tt = (key, vars) => t(lang, key, vars);
  const ROLE_LABEL = { officer: tt('role.officer'), executive: tt('role.executive') };

  const load = () => { apiFetch('/users').then(all => setUsers(all.filter(u => u.role.role_name === 'officer' || u.role.role_name === 'executive'))).catch(e => toast(e.message, 'error')); };
  useEffect(load, []);

  const revoke = async (u) => {
    try {
      await apiFetch(`/users/${u.user_id}/revoke`, { method: 'POST' });
      toast(tt('usersMgmt.revokeToast'), 'info');
      load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : tt('usersMgmt.revokeFailMsg'), 'error');
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
          <thead><tr><th>{tt('usersMgmt.colName')}</th><th>{tt('usersMgmt.colUsername')}</th><th>{tt('usersMgmt.colEmail')}</th><th>{tt('usersMgmt.colRole')}</th><th></th></tr></thead>
          <tbody>{users.map(u => (
            <tr key={u.user_id}>
              <td><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={u.first_name} size={34} bg="var(--navy-600)" />
                <span style={{ fontWeight: 600 }}>{u.first_name} {u.last_name}</span></div></td>
              <td className="mono" style={{ fontSize: 13, color: 'var(--ink-500)' }}>{u.psu_passport_id}</td>
              <td className="mono" style={{ fontSize: 13, color: 'var(--ink-500)' }}>{u.email}</td>
              <td><span className="chip" style={{ background: 'var(--blue-50)', color: 'var(--blue-600)', fontWeight: 600 }}><Icon name="chart" size={13} /> {ROLE_LABEL[u.role.role_name]}</span></td>
              <td style={{ textAlign: 'right' }}>
                <button className="btn btn-danger btn-sm" disabled={u.user_id === currentUserId} onClick={() => revoke(u)}>
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
          <div className="field"><label>{tt('usersMgmt.fieldUsername')}</label><input className="input" value={form.psu_passport_id} onChange={e => setForm(f => ({ ...f, psu_passport_id: e.target.value }))} /></div>
          <div className="field"><label>{tt('usersMgmt.fieldPassword')}</label><input className="input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            <span className="hint">{tt('usersMgmt.passwordHint')}</span></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1 }}><label>{tt('usersMgmt.fieldFirstName')}</label><input className="input" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
            <div className="field" style={{ flex: 1 }}><label>{tt('usersMgmt.fieldLastName')}</label><input className="input" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
          </div>
          <div className="field"><label>{tt('usersMgmt.fieldEmail')}</label><input className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@psu.ac.th" /></div>
          <div className="field"><label>{tt('usersMgmt.fieldPhone')}</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          {error && <div style={{ color: 'var(--reject,#dc2626)', fontSize: 13 }}>{error}</div>}
        </div>
      </Modal>
    </div>
  );
}
