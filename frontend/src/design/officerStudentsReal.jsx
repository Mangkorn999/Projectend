/* ============================================================
   เจ้าหน้าที่ / ผู้บริหาร — รายชื่อนักศึกษา (ข้อมูลจริงจาก backend)
   แทนที่ OfficerStudents เดิมใน officer.jsx ที่ยังใช้ mock STUDENTS/ROOMS

   สิทธิ์กรอกผลสอบ (exam_eligible) เปิด/ปิดจากหน้านี้ผ่าน PATCH /api/students/bulk-eligible
   — เจ้าหน้าที่เท่านั้น (ผู้บริหารเห็นสถานะได้ แต่แก้ไม่ได้)
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, Avatar, StatusBadge, Pagination, Modal } from './components.jsx';
import { apiFetch, ApiError } from './api.js';
import { t, roomName } from './i18n.js';

// แปลง staff_status จาก backend (pending/approved/rejected) → status key ที่ StatusBadge เข้าใจ
const STAFF_STATUS_TO_BADGE = {
  pending: 'SUBMITTED',
  approved: 'CONFIRMED',
  rejected: 'REJECTED',
};

export function OfficerStudentsReal({ go, setSel, toast, readonly, lang }) {
  const tt = (key, vars) => t(lang, key, vars);
  const [students, setStudents] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [room, setRoom] = useState('ALL');
  const [year, setYear] = useState('ALL');
  const [eligible, setEligible] = useState('ALL');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(() => new Set()); // student_id ที่ติ๊กไว้
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null); // นักศึกษาที่กำลังจะลบ (รอยืนยันในโมดัล)
  const [resetting, setResetting] = useState(null); // นักศึกษาที่กำลังจะรีเซ็ตรหัส (รอยืนยันในโมดัล)
  const per = 10;

  useEffect(() => {
    // ดึงนักศึกษา + ผลสอบทุกคนพร้อมกัน แล้ว join ฝั่ง client:
    // นักศึกษาคนหนึ่งอาจมีผลสอบหลายรอบ — เอาผลล่าสุด (findAll เรียงจาก submitted_at desc อยู่แล้ว) มาแสดงสถานะ
    Promise.all([apiFetch('/students'), apiFetch('/exam-results')])
      .then(([studentList, examResults]) => {
        const latestByStudent = new Map();
        for (const r of examResults) {
          if (!latestByStudent.has(r.student_id)) latestByStudent.set(r.student_id, r);
        }
        setStudents(studentList.map(s => {
          const latest = latestByStudent.get(s.student_id);
          const passedCount = latest ? latest.subject_results.filter(sr => sr.is_passed).length : 0;
          return {
            sid: s.student_id,
            userId: s.user.user_id,
            prefix: '',
            firstName: s.user.first_name,
            lastName: s.user.last_name,
            room: s.room?.room_name || '-',
            year: s.academic_year,
            eligible: !!s.exam_eligible,
            status: latest ? STAFF_STATUS_TO_BADGE[latest.staff_status] : 'DRAFT',
            passedCount,
            // ตัวหารคือจำนวนวิชาที่ผลใบนั้นเก็บไว้จริง — บางรอบสอบไม่ครบทุกวิชา
            subjectCount: latest ? latest.subject_results.length : 0,
            allPass: passedCount === latest?.subject_results.length && passedCount > 0,
            submittedAt: latest ? new Date(latest.submitted_at).toLocaleDateString('th-TH') : null,
            // StudentDetail (officer.jsx) ยังไม่ต่อ backend จริง — ใส่ค่าว่างกันหน้าแตกตอนคลิกเข้าไปดู
            subjects: [],
            files: [],
          };
        }));
        setRooms([...new Set(studentList.map(s => s.room?.room_name).filter(Boolean))]);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(s => {
    if (status !== 'ALL' && s.status !== status) return false;
    if (room !== 'ALL' && s.room !== room) return false;
    if (year !== 'ALL' && String(s.year) !== year) return false;
    if (eligible !== 'ALL' && s.eligible !== (eligible === 'YES')) return false;
    if (q && !(`${s.firstName}${s.lastName}${s.sid}`.includes(q))) return false;
    return true;
  });
  const pageRows = filtered.slice(page * per, (page + 1) * per);
  const pages = Math.ceil(filtered.length / per);

  useEffect(() => setPage(0), [q, status, room, year, eligible]);

  // ปีการศึกษา (พ.ศ.) ของนักศึกษาที่มีจริงในระบบ เรียงใหม่→เก่า
  const years = [...new Set(students.map(s => s.year).filter(Boolean))].sort((a, b) => b - a);

  // ─── เปิด/ปิดสิทธิ์กรอกผลสอบ ─────────────────────────
  // ติ๊กเลือกได้ทั้งที่ถูกกรองไว้ ไม่ใช่แค่หน้าปัจจุบัน — เปิดสิทธิ์ทั้งรุ่นทีเดียวจบ
  const allFilteredSelected = filtered.length > 0 && filtered.every(s => selected.has(s.sid));

  const toggleOne = (sid) => setSelected(prev => {
    const next = new Set(prev);
    next.has(sid) ? next.delete(sid) : next.add(sid);
    return next;
  });

  const toggleAllFiltered = () => setSelected(prev => {
    if (allFilteredSelected) {
      const next = new Set(prev);
      filtered.forEach(s => next.delete(s.sid));
      return next;
    }
    return new Set([...prev, ...filtered.map(s => s.sid)]);
  });

  const setEligibilityFor = async (ids, value) => {
    if (!ids.length) return;
    setSaving(true);
    try {
      await apiFetch('/students/bulk-eligible', {
        method: 'PATCH',
        body: { student_ids: ids, exam_eligible: value },
      });
      // อัปเดตในตารางเลย ไม่ต้องโหลดรายชื่อ+ผลสอบใหม่ทั้งชุด
      const touched = new Set(ids);
      setStudents(prev => prev.map(s => (touched.has(s.sid) ? { ...s, eligible: value } : s)));
      setSelected(new Set());
      toast?.(tt(value ? 'officer.students.grantedToast' : 'officer.students.revokedToast', { n: ids.length }));
    } catch (e) {
      toast?.(e instanceof ApiError ? e.message : tt('officer.students.eligibleFailMsg'), 'error');
    } finally {
      setSaving(false);
    }
  };
  // ลบนักศึกษาที่ import ผิด/ซ้ำ — ยืนยันก่อนเสมอเพราะลบแล้วกู้คืนไม่ได้
  const confirmDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await apiFetch(`/students/${deleting.sid}`, { method: 'DELETE' });
      setStudents(prev => prev.filter(s => s.sid !== deleting.sid));
      toast?.(tt('officer.students.deletedToast', { name: `${deleting.firstName} ${deleting.lastName}` }));
      setDeleting(null);
    } catch (e) {
      // backend ตอบ 409 พร้อมเหตุผลถ้าคนนี้มีผลสอบแล้ว — โชว์ข้อความนั้นตรงๆ
      toast?.(e instanceof ApiError ? e.message : tt('officer.students.deleteFailMsg'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // รีเซ็ตรหัสผ่าน — endpoint เดียวกับที่หน้าจัดการผู้ใช้ใช้ (POST /users/:id/reset-password ไม่จำกัด role ปลายทาง)
  // ล้าง password_hash ให้ต้องไปตั้งใหม่ที่หน้า "ตั้งรหัสผ่านครั้งแรก" — เจ้าหน้าที่ไม่เคยเห็นรหัสจริง
  const confirmReset = async () => {
    if (!resetting) return;
    setSaving(true);
    try {
      await apiFetch(`/users/${resetting.userId}/reset-password`, { method: 'POST' });
      toast?.(tt('usersMgmt.resetToast', { name: resetting.firstName }));
      setResetting(null);
    } catch (e) {
      toast?.(e instanceof ApiError ? e.message : tt('detailReal.actionFailMsg'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const setEligibility = (value) => setEligibilityFor([...selected], value);
  const toggleOneEligibility = (s) => {
    setEligibilityFor([s.sid], !s.eligible);
  };

  if (loading) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>{tt('common.loading')}</div>;
  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>{tt('statuspage.loadFailPrefix', { msg: error })}</div>;

  return (
    <div className="fade-up">
      <PageHead title={tt('officer.students.title')} sub={tt('officer.students.sub', { found: filtered.length, total: students.length })} />

      <div className="card" style={{ padding: 14, marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Icon name="search" size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)' }} />
          <input className="input" placeholder={tt('officer.students.searchPh')} value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: 40 }} />
        </div>
        <select className="select" style={{ width: 'auto', minWidth: 150 }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="ALL">{tt('officer.students.allStatus')}</option><option value="SUBMITTED">{tt('status.SUBMITTED')}</option>
          <option value="CONFIRMED">{tt('status.CONFIRMED')}</option><option value="REJECTED">{tt('status.REJECTED')}</option><option value="DRAFT">{tt('status.DRAFT')}</option>
        </select>
        <select className="select" style={{ width: 'auto', minWidth: 120 }} value={room} onChange={e => setRoom(e.target.value)}>
          <option value="ALL">{tt('officer.students.allRoom')}</option>{rooms.map(r => <option key={r} value={r}>{roomName(lang, r)}</option>)}
        </select>
        <select className="select" style={{ width: 'auto', minWidth: 130 }} value={year} onChange={e => setYear(e.target.value)}>
          <option value="ALL">{tt('officer.students.allYear')}</option>{years.map(y => <option key={y} value={String(y)}>{tt('officer.students.yearOpt', { year: y })}</option>)}
        </select>
        <select className="select" style={{ width: 'auto', minWidth: 150 }} value={eligible} onChange={e => setEligible(e.target.value)}>
          <option value="ALL">{tt('officer.students.allEligible')}</option>
          <option value="YES">{tt('officer.students.eligibleYes')}</option>
          <option value="NO">{tt('officer.students.eligibleNo')}</option>
        </select>
      </div>

      {/* แถบจัดการสิทธิ์ — โผล่เฉพาะตอนติ๊กเลือกไว้ ไม่งั้นกินที่เปล่าๆ */}
      {!readonly && selected.size > 0 && (
        <div className="card" style={{ padding: '12px 18px', marginBottom: 18, display: 'flex', alignItems: 'center',
          gap: 12, flexWrap: 'wrap', borderColor: 'var(--navy-600)' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{tt('officer.students.selectedCount', { n: selected.size })}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())} disabled={saving}>{tt('officer.students.clearSelection')}</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setEligibility(false)} disabled={saving}>
              <Icon name="xCircle" size={15} /> {tt('officer.students.revokeBtn')}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setEligibility(true)} disabled={saving}>
              <Icon name="checkCircle" size={15} /> {saving ? tt('officer.students.savingEligible') : tt('officer.students.grantBtn')}
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr>
              {!readonly && <th style={{ width: 40 }}>
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered}
                  aria-label={tt('officer.students.selectAllAria')} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              </th>}
              <th>{tt('officer.students.colStudent')}</th><th>{tt('officer.students.colRoom')}</th><th>{tt('officer.students.colYear')}</th>
              <th>{tt('officer.students.colEligible')}</th>
              <th>{tt('officer.students.colResult')}</th><th>{tt('officer.students.colStatus')}</th><th>{tt('officer.students.colSubmitted')}</th>
              {!readonly && <th>{tt('officer.students.revokeBtn')}</th>}
              <th></th>
            </tr></thead>
            <tbody>
              {pageRows.map(s => (
                <tr key={s.sid} className="clickable" onClick={() => { setSel(s); go('detail'); }}>
                  {!readonly && <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(s.sid)} onChange={() => toggleOne(s.sid)}
                      aria-label={tt('officer.students.selectOneAria', { name: `${s.firstName} ${s.lastName}` })}
                      style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  </td>}
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={s.firstName} size={34} />
                    <div><div style={{ fontWeight: 600, fontSize: 14 }}>{s.firstName} {s.lastName}</div>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--ink-400)' }}>{s.sid}</div></div></div></td>
                  <td><span className="chip" style={{ fontSize: 12 }}>{roomName(lang, s.room)}</span></td>
                  <td className="tnum" style={{ fontSize: 13, color: 'var(--ink-700)' }}>{s.year || '—'}</td>
                  <td><span className={'badge ' + (s.eligible ? 'ok' : 'draft')}><span className="dot"></span>
                    {s.eligible ? tt('officer.students.eligibleYes') : tt('officer.students.eligibleNo')}</span></td>
                  <td>{s.status === 'DRAFT' ? <span style={{ color: 'var(--ink-400)' }}>—</span> :
                    <span className="tnum" style={{ fontWeight: 700, color: s.allPass ? 'var(--pass)' : 'var(--ink-800)' }}>{s.passedCount}/{s.subjectCount}</span>}</td>
                  <td><StatusBadge status={s.status} lang={lang} /></td>
                  <td style={{ color: 'var(--ink-500)', fontSize: 13 }}>{s.submittedAt || '—'}</td>
                  {!readonly && <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                    <button disabled={saving} onClick={() => setResetting(s)} title={tt('usersMgmt.resetHint')}
                      className="btn btn-ghost btn-sm" style={{ marginRight: 6 }}>
                      <Icon name="key" size={15} /> {tt('usersMgmt.resetBtn')}</button>
                    {s.eligible && <button disabled={saving} onClick={() => toggleOneEligibility(s)}
                      className="badge reject" style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <Icon name="xCircle" size={13} /> {tt('officer.students.revokeBtn')}</button>}
                    {/* ลบได้เฉพาะคนที่ยังไม่มีผลสอบ — คนที่กรอกแล้วลบไม่ได้ ไม่งั้นสถิติปีนั้นเปลี่ยนย้อนหลัง
                        backend กันซ้ำอีกชั้น ตรงนี้แค่ไม่โชว์ปุ่มให้กดเปล่าๆ */}
                    {s.status === 'DRAFT' && (
                      <button disabled={saving} onClick={() => setDeleting(s)} title={tt('officer.students.deleteHint')}
                        className="badge" style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 6,
                          background: 'var(--ink-100)', color: 'var(--ink-600)' }}>
                        <Icon name="trash" size={13} /> {tt('officer.students.deleteBtn')}</button>
                    )}
                  </td>}
                  <td style={{ textAlign: 'right' }}><Icon name="chevR" size={18} style={{ color: 'var(--ink-300)' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} onPage={setPage} lang={lang} />
      </div>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} width={430} title={tt('officer.students.deleteTitle')}
        footer={<><button className="btn btn-ghost" onClick={() => setDeleting(null)}>{tt('officer.students.cancelBtn')}</button>
          <button className="btn btn-danger" disabled={saving} onClick={confirmDelete}>
            {saving ? tt('officer.students.deleting') : tt('officer.students.deleteBtn')}</button></>}>
        {deleting && (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--ink-700)' }}>
            {tt('officer.students.deleteBody', { name: `${deleting.firstName} ${deleting.lastName}`, sid: deleting.sid })}
          </p>
        )}
      </Modal>

      <Modal open={!!resetting} onClose={() => setResetting(null)} width={430} title={tt('usersMgmt.resetBtn')}
        footer={<><button className="btn btn-ghost" onClick={() => setResetting(null)}>{tt('officer.students.cancelBtn')}</button>
          <button className="btn btn-primary" disabled={saving} onClick={confirmReset}>{tt('usersMgmt.resetBtn')}</button></>}>
        {resetting && (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--ink-700)' }}>{tt('usersMgmt.resetHint')}</p>
        )}
      </Modal>
    </div>
  );
}
