/* ============================================================
   เจ้าหน้าที่ — จัดการผู้ใช้งาน: เจ้าหน้าที่คณะ / ผู้ช่วยตรวจสอบ / ผู้บริหารคณะ (ข้อมูลจริงจาก backend)
   ผู้ช่วยตรวจสอบ = บทบาท reviewer ในฐานข้อมูล (ตรวจ/ยืนยัน/ตีกลับผลสอบได้อย่างเดียว)
   แทนที่ ManageUsers เดิมใน officer-manage.jsx ที่ใช้ user list ปลอมในเครื่อง
   สร้างบัญชีผ่าน POST /api/users — เจ้าหน้าที่ตั้งรหัสชั่วคราวให้ตอนสร้าง บังคับเปลี่ยนตอน login ครั้งแรก
   (ไม่มี first-setup แยกแล้ว ใช้กลไก must_change_password เดียวกับ ForceChangePassword)
   รีเซ็ตรหัสผ่าน POST /api/users/:id/reset-password — เจ้าหน้าที่ตั้งรหัสชั่วคราวใหม่ให้ทันที
   ถอนสิทธิ์ผ่าน POST /api/users/:id/revoke — ไม่ลบ record (กัน FK พัง) แค่เคลียร์ password ให้ login ไม่ได้อีก
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, Modal, Avatar, Select, Pagination, actorLabel } from './components.jsx';
import { usePagedList } from './usePagedList.js';
import { SkeletonTable } from './skeletons.jsx';
import { apiFetch, ApiError } from './api.js';
import { t } from './i18n.js';

export function ManageUsersReal({ toast, currentUserId, lang }) {
  const [users, setUsers] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ psu_passport_id: '', password: '', role_name: 'executive', first_name: '', last_name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // { user, action: 'reset' | 'revoke' | 'delete' }
  const [resetPassword, setResetPassword] = useState(''); // รหัสชั่วคราวที่เจ้าหน้าที่ตั้งให้ตอน reset
  const [confirmError, setConfirmError] = useState('');
  const [roleEdit, setRoleEdit] = useState(null); // { user, role_name } กล่องเปลี่ยนบทบาท
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'officer' | 'executive' | 'reviewer'
  const tt = (key, vars) => t(lang, key, vars);
  const ROLE_LABEL = { officer: tt('role.officer'), executive: tt('role.executive'), reviewer: tt('role.reviewer') };

  const MANAGED_ROLES = ['officer', 'executive', 'reviewer'];
  // แบ่งหน้าตามตัวกรองบทบาท — ต้องเรียก hook ก่อน early return ด้านล่างเสมอ (users ยังเป็น null ตอนโหลด)
  const shown = roleFilter === 'all' ? (users ?? []) : (users ?? []).filter(u => u.role.role_name === roleFilter);
  const usersPage = usePagedList(shown, 15, roleFilter);

  const load = () => { apiFetch('/users').then(all => setUsers(all.filter(u => MANAGED_ROLES.includes(u.role.role_name)))).catch(e => toast(e.message, 'error')); };
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
      } else if (action === 'delete') {
        await apiFetch(`/users/${user.user_id}`, { method: 'DELETE' });
        toast(tt('usersMgmt.deleteToast', { name: user.first_name }), 'info');
      } else {
        await apiFetch(`/users/${user.user_id}/revoke`, { method: 'POST' });
        toast(tt('usersMgmt.revokeToast'), 'info');
      }
      setConfirm(null);
      setResetPassword('');
      load();
    } catch (e) {
      // ลบไม่ได้เพราะมีประวัติผูกอยู่ (409) — backend บอกให้ถอนสิทธิ์แทน โชว์ข้อความนั้นตรงๆ
      setConfirmError(e instanceof ApiError ? e.message : tt(action === 'delete' ? 'usersMgmt.deleteFailMsg' : 'usersMgmt.revokeFailMsg'));
    }
  };

  // เปลี่ยนบทบาท (เจ้าหน้าที่ / ผู้บริหาร / ผู้ช่วยตรวจ) — backend อ่านบทบาทจาก DB ทุก request จึงมีผลทันที
  const saveRole = async () => {
    setRoleSaving(true);
    setRoleError('');
    try {
      await apiFetch(`/users/${roleEdit.user.user_id}/role`, { method: 'POST', body: { role_name: roleEdit.role_name } });
      toast(tt('usersMgmt.changeRoleToast'), 'success');
      setRoleEdit(null);
      load();
    } catch (e) {
      setRoleError(e instanceof ApiError ? e.message : tt('usersMgmt.changeRoleFail'));
    } finally {
      setRoleSaving(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      // ผู้บริหารไม่ส่งอีเมล/เบอร์โทร (ช่องถูกซ่อน แต่ state อาจเหลือค่าที่พิมพ์ไว้ก่อนสลับ role)
      const body = form.role_name === 'executive' ? { ...form, email: '', phone: '' } : form;
      await apiFetch('/users', { method: 'POST', body });
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

  if (!users) return <div className="fade-up"><SkeletonTable rows={6} cols={5} /></div>;

  // นับจำนวนต่อบทบาทไว้โชว์บนปุ่มกรอง — นับจาก users ทั้งหมด ไม่ใช่จากที่กรองแล้ว
  const countOf = (role) => users.filter(u => u.role.role_name === role).length;

  return (
    <div className="fade-up">
      <PageHead title={tt('usersMgmt.title')} sub={tt('usersMgmt.sub')}
        actions={<button className="btn btn-primary" onClick={() => setModal(true)}><Icon name="plus" size={17} /> {tt('usersMgmt.addBtn')}</button>} />
      {/* กรองตามบทบาท — คณะมีทั้งเจ้าหน้าที่ ผู้ช่วยตรวจสอบ และผู้บริหารปนกันในตารางเดียว
          พอบัญชีเยอะขึ้นจะหาไม่เจอว่าใครเป็นบทบาทไหน */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {[['all', tt('usersMgmt.filterAll'), users.length],
          ...MANAGED_ROLES.map(r => [r, ROLE_LABEL[r], countOf(r)])
        ].map(([key, label, n]) => (
          <button key={key} type="button" onClick={() => setRoleFilter(key)}
            className={'btn btn-sm ' + (roleFilter === key ? 'btn-primary' : 'btn-ghost')}
            style={{ fontWeight: 700 }}>
            {label} <span className="tnum" style={{ opacity: .75, marginLeft: 4 }}>{n}</span>
          </button>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="tbl">
          <thead><tr><th>{tt('usersMgmt.colName')}</th><th>{tt('usersMgmt.colUsername')}</th><th>{tt('usersMgmt.colEmail')}</th><th>{tt('usersMgmt.colRole')}</th><th>{tt('usersMgmt.colStatus')}</th><th></th></tr></thead>
          <tbody>{usersPage.rows.map(u => (
            <tr key={u.user_id}>
              <td><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={u.first_name} size={34} bg="var(--navy-600)" />
                <div>
                  <div style={{ fontWeight: 600 }}>{u.first_name} {u.last_name}</div>
                  {/* ใครสร้างบัญชีนี้ — บัญชีเก่าที่ไม่มีข้อมูลก็ไม่โชว์ */}
                  {u.creator && <div style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>{tt('usersMgmt.createdBy', { name: actorLabel(u.creator, tt) })}</div>}
                </div></div></td>
              <td className="mono" style={{ fontSize: 15, color: 'var(--ink-500)' }}>{u.psu_passport_id}</td>
              <td className="mono" style={{ fontSize: 15, color: 'var(--ink-500)' }}>{u.email || '—'}</td>
              <td><span className="chip" style={{ background: 'var(--blue-50)', color: 'var(--blue-600)', fontWeight: 600 }}><Icon name="chart" size={13} /> {ROLE_LABEL[u.role.role_name]}</span></td>
              {/* is_revoked = ถอนสิทธิ์ไปแล้ว (password_hash เป็น null) — แยกจาก must_change_password
                  เพราะบัญชีใหม่ก็ must_change_password=true เหมือนกัน แยกกันไม่ออกถ้าไม่มี flag นี้ */}
              <td>
                {u.is_revoked
                  ? <div>
                      <span className="badge reject"><span className="dot" />{tt('usersMgmt.statusRevoked')}</span>
                      {/* ใครปิด เมื่อไหร่ (users.closed_by / closed_at) — บัญชีที่ปิดก่อนมีคอลัมน์นี้จะไม่มีข้อมูล */}
                      {u.closed_at && <div style={{ fontSize: 13.5, color: 'var(--ink-500)', marginTop: 4 }}>
                        {tt('usersMgmt.closedBy', { name: u.closer ? actorLabel(u.closer, tt) : '—', date: new Date(u.closed_at).toLocaleDateString('th-TH') })}</div>}
                    </div>
                  : u.must_change_password
                  ? <span className="badge wait"><span className="dot" />{tt('usersMgmt.statusPending')}</span>
                  : <span className="badge ok"><span className="dot" />{tt('usersMgmt.statusActive')}</span>}
              </td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button className="btn btn-ghost btn-sm" style={{ marginRight: 6 }}
                  disabled={u.user_id === currentUserId || (u.must_change_password && !u.is_revoked)}
                  onClick={() => { setConfirm({ user: u, action: 'reset' }); setResetPassword(''); setConfirmError(''); }}>
                  <Icon name="key" size={15} /> {tt('usersMgmt.resetBtn')}</button>
                <button className="btn btn-ghost btn-sm" style={{ marginRight: 6 }} disabled={u.user_id === currentUserId || u.is_revoked}
                  title={u.is_revoked ? tt('usersMgmt.revokedHint') : undefined}
                  onClick={() => { setRoleEdit({ user: u, role_name: u.role.role_name }); setRoleError(''); }}>
                  <Icon name="edit" size={15} /> {tt('usersMgmt.changeRoleBtn')}</button>
                <button className="btn btn-ghost btn-sm" style={{ marginRight: 6 }} disabled={u.user_id === currentUserId || u.is_revoked}
                  title={u.is_revoked ? tt('usersMgmt.revokedHint') : undefined}
                  onClick={() => { setConfirm({ user: u, action: 'revoke' }); setConfirmError(''); }}>
                  <Icon name="xCircle" size={15} /> {tt('usersMgmt.revokeBtn')}</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
        {shown.length === 0 && (
          <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--ink-500)', fontSize: 15.5 }}>
            {tt('usersMgmt.filterEmpty')}
          </div>
        )}
        <Pagination page={usersPage.page} pages={usersPage.pages} onPage={usersPage.setPage} lang={lang} />
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={tt('usersMgmt.modalTitle')} width={460}
        footer={<><button className="btn btn-ghost" onClick={() => setModal(null)}>{tt('usersMgmt.cancelBtn')}</button>
          <button className="btn btn-primary" disabled={saving} onClick={submit}>{saving ? tt('usersMgmt.saving') : tt('usersMgmt.addBtn')}</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field"><label>{tt('usersMgmt.fieldRole')}</label>
            <Select value={form.role_name} onChange={v => setForm(f => ({ ...f, role_name: v }))} lang={lang}
              options={[
                { value: 'executive', label: tt('role.executive') },
                { value: 'officer', label: tt('role.officer') },
                { value: 'reviewer', label: tt('role.reviewer') },
              ]} />
            {/* สิทธิ์ของแต่ละบทบาท 1 บรรทัด — ให้เลือกถูกตั้งแต่แรก บทบาทที่เลือกอยู่ถูกไฮไลต์ */}
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {MANAGED_ROLES.map(role => (
                <div key={role} style={{ fontSize: 14, lineHeight: 1.5, padding: '6px 10px', borderRadius: 8,
                  background: form.role_name === role ? 'var(--blue-50)' : 'transparent',
                  color: form.role_name === role ? 'var(--navy-800)' : 'var(--ink-500)' }}>
                  <b>{ROLE_LABEL[role]}</b> — {tt('usersMgmt.roleHint.' + role)}
                </div>
              ))}
            </div>
          </div>
          <div className="field"><label>{tt('usersMgmt.fieldUsername')}</label><input className="input" value={form.psu_passport_id} onChange={e => setForm(f => ({ ...f, psu_passport_id: e.target.value }))} /></div>
          <div className="field"><label>{tt('usersMgmt.fieldPassword')}</label>
            <input className="input" type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="อย่างน้อย 8 ตัวอักษร" />
            <span className="hint">{tt('usersMgmt.passwordHint')}</span></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1 }}><label>{tt('usersMgmt.fieldFirstName')}</label><input className="input" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
            <div className="field" style={{ flex: 1 }}><label>{tt('usersMgmt.fieldLastName')}</label><input className="input" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
          </div>
          {/* ผู้บริหารไม่ต้องกรอกอีเมล/เบอร์โทร (อ่านข้อมูลอย่างเดียว) — เจ้าหน้าที่/ผู้ช่วยตรวจสอบยังต้องกรอก */}
          {form.role_name !== 'executive' && <>
            <div className="field"><label>{tt('usersMgmt.fieldEmail')}</label><input className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@psu.ac.th" /></div>
            <div className="field"><label>{tt('usersMgmt.fieldPhone')}</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          </>}
          {error && <div style={{ color: 'var(--reject,#dc2626)', fontSize: 15 }}>{error}</div>}
        </div>
      </Modal>

      {/* ยืนยันก่อนรีเซ็ต/ถอนสิทธิ์/ลบบัญชี — ทั้งสามทำให้เจ้าตัว login ไม่ได้ทันที (ลบเพิ่มคือกู้คืนไม่ได้เลย) */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)} width={420}
        title={confirm?.action === 'reset' ? tt('usersMgmt.confirmResetTitle')
          : confirm?.action === 'delete' ? tt('usersMgmt.confirmDeleteTitle') : tt('usersMgmt.confirmRevokeTitle')}
        footer={<><button className="btn btn-ghost" onClick={() => setConfirm(null)}>{tt('usersMgmt.cancelBtn')}</button>
          <button className={confirm?.action === 'reset' ? 'btn btn-primary' : 'btn btn-danger'} onClick={runConfirmed}>
            {confirm?.action === 'reset' ? tt('usersMgmt.resetBtn')
              : confirm?.action === 'delete' ? tt('usersMgmt.deleteBtn') : tt('usersMgmt.revokeBtn')}</button></>}>
        {confirm && (
          <>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: 'var(--ink-700)' }}>
              {confirm.action === 'reset'
                ? tt('usersMgmt.confirmResetBody', { name: `${confirm.user.first_name} ${confirm.user.last_name}` })
                : confirm.action === 'delete'
                ? tt('usersMgmt.confirmDeleteBody', { name: `${confirm.user.first_name} ${confirm.user.last_name}` })
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

      {/* เปลี่ยนบทบาท — เลือกได้เฉพาะบทบาทของเจ้าหน้าที่ฝั่งคณะ (ไม่รวมนักศึกษา) */}
      <Modal open={!!roleEdit} onClose={() => !roleSaving && setRoleEdit(null)} width={460} title={tt('usersMgmt.changeRoleTitle')}
        footer={<><button className="btn btn-ghost" disabled={roleSaving} onClick={() => setRoleEdit(null)}>{tt('officer.detail.cancelBtn')}</button>
          <button className="btn btn-primary" disabled={roleSaving || roleEdit?.role_name === roleEdit?.user.role.role_name} onClick={saveRole}>
            {roleSaving ? tt('usersMgmt.changeRoleSaving') : tt('usersMgmt.changeRoleConfirm')}</button></>}>
        {roleEdit && <>
          <p style={{ margin: '0 0 14px', color: 'var(--ink-600)', fontSize: 16, lineHeight: 1.6 }}>
            {tt('usersMgmt.changeRoleBody', { name: `${roleEdit.user.first_name} ${roleEdit.user.last_name}` })}</p>
          <div className="field"><label>{tt('usersMgmt.colRole')}</label>
            <Select value={roleEdit.role_name} onChange={v => setRoleEdit(r => ({ ...r, role_name: v }))} lang={lang}
              options={MANAGED_ROLES.map(r => ({ value: r, label: ROLE_LABEL[r] }))} />
          </div>
          {roleError && <div style={{ marginTop: 12, color: 'var(--status-reject-fg)', fontSize: 15 }}>{roleError}</div>}
        </>}
      </Modal>
    </div>
  );
}
