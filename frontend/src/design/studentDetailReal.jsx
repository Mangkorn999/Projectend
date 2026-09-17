/* ============================================================
   เจ้าหน้าที่ / ผู้บริหาร — รายละเอียดผลสอบนักศึกษาคนเดียว (ข้อมูลจริงจาก backend)
   แทนที่ StudentDetail เดิมใน officer.jsx ที่ยังใช้ mock SUBJECTS/STUDENTS
   executive เปิดด้วย readonly=true — ปุ่มยืนยัน/ตีกลับ/แก้ไขข้อมูลจะไม่โชว์ (backend เองก็ block role นี้อยู่แล้วที่ระดับ route)

   โชว์ผลสอบ "ทุกรอบ" ที่นักศึกษาคนนี้เคยส่ง เป็น block คลิกสลับได้ฝั่งขวา (ไม่ใช่แค่รอบล่าสุดแบบเดิม)
   ข้อมูลมีอยู่แล้วจาก /exam-results?student_id=... (ไม่ต้องยิง API เพิ่ม) แค่ไม่ทิ้งรอบอื่นทิ้งเหมือนก่อน
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, Modal, StatusBadge, PassBadge, Empty } from './components.jsx';
import { apiFetch, ApiError, openAuthedFile } from './api.js';
import { t, subjectName, roomName } from './i18n.js';

const STAFF_STATUS_TO_BADGE = { pending: 'SUBMITTED', approved: 'CONFIRMED', rejected: 'REJECTED' };

export function StudentDetailReal({ student, go, toast, readonly, lang }) {
  const tt = (key, vars) => t(lang, key, vars);
  const quickReasons = [tt('officer.detail.quickReason1'), tt('officer.detail.quickReason2'), tt('officer.detail.quickReason3')];
  const [subjects, setSubjects] = useState([]); // [{subject_id, subject_code, subject_name}]
  const [results, setResults] = useState([]); // exam_result ทุกรอบของนักศึกษาคนนี้ เรียงใหม่→เก่า
  const [selectedId, setSelectedId] = useState(null); // result_id ของรอบที่กำลังดูอยู่
  const [studentFull, setStudentFull] = useState(null); // GET /students/:id เต็มๆ ไว้ prefill ฟอร์มแก้ไข
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reject, setReject] = useState(false);
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      apiFetch('/subjects'),
      apiFetch(`/exam-results?student_id=${student.sid}`),
      apiFetch(`/students/${student.sid}`),
      apiFetch('/rooms'),
    ]).then(([subjectList, resultList, fullStudent, roomList]) => {
      setSubjects(subjectList);
      setResults(resultList);
      setStudentFull(fullStudent);
      setRooms(roomList);
      // มาจากหน้าคิวตรวจสอบจะระบุใบที่กดมาด้วย (resultId) — ต้องเปิดใบนั้น ไม่ใช่ใบล่าสุด
      // ไม่งั้นกดจากแท็บ "รอตรวจสอบ" แล้วเปิดมาเจอใบรอบอื่นที่ถูกตีกลับไปแล้ว
      // มาจากหน้ารายชื่อนักศึกษาไม่มี resultId — ใช้ใบล่าสุด (เรียง submitted_at desc มาแล้ว)
      const picked = student.resultId ? resultList.find(r => r.result_id === student.resultId) : null;
      setSelectedId((picked || resultList[0])?.result_id ?? null);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, [student.sid, student.resultId]);

  const examResult = results.find(r => r.result_id === selectedId) || null;
  const status = examResult ? STAFF_STATUS_TO_BADGE[examResult.staff_status] : 'DRAFT';
  const passedCount = examResult ? examResult.subject_results.filter(r => r.is_passed).length : 0;
  const allPass = examResult && passedCount === subjects.length;

  const review = async (action, reasonText) => {
    setBusy(true);
    try {
      await apiFetch(`/exam-results/${examResult.result_id}/${action}`, {
        method: 'PATCH',
        body: action === 'reject' ? { remark: reasonText } : undefined,
      });
      toast(action === 'approve' ? tt('officer.detail.confirmToast') : tt('officer.detail.rejectToast'), action === 'approve' ? 'success' : 'info');
      setReject(false);
      load(); // ดึงสถานะล่าสุดจาก backend ใหม่ ไม่เชื่อ state เดิมที่เดาเอง
    } catch (e) {
      toast(e instanceof ApiError ? e.message : tt('detailReal.actionFailMsg'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const openEdit = () => {
    if (!studentFull) return;
    setEditForm({
      first_name: studentFull.user.first_name || '',
      last_name: studentFull.user.last_name || '',
      first_name_en: studentFull.first_name_en || '',
      last_name_en: studentFull.last_name_en || '',
      email: studentFull.user.email || '',
      phone: studentFull.user.phone || '',
      room_id: studentFull.room?.room_id || '',
      academic_year: studentFull.academic_year || '',
    });
    setEditError('');
    setEditOpen(true);
  };

  const submitEdit = async () => {
    setEditError('');
    setEditSaving(true);
    try {
      const updated = await apiFetch(`/students/${student.sid}`, {
        method: 'PATCH',
        body: { ...editForm, room_id: Number(editForm.room_id), academic_year: Number(editForm.academic_year) },
      });
      setStudentFull(updated);
      toast(tt('officer.detail.editSuccessToast'), 'success');
      setEditOpen(false);
    } catch (e) {
      setEditError(e instanceof ApiError ? e.message : tt('officer.detail.editFailMsg'));
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>{tt('common.loading')}</div>;
  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>{tt('statuspage.loadFailPrefix', { msg: error })}</div>;

  const displayName = studentFull ? `${studentFull.user.first_name} ${studentFull.user.last_name}` : `${student.firstName} ${student.lastName}`;
  const displayRoom = studentFull?.room?.room_name || student.room;
  const displayYear = studentFull?.academic_year || student.year;

  return (
    <div className="fade-up">
      <PageHead title={displayName}
        crumb={<><a onClick={() => go('students')} style={{ cursor: 'pointer' }}>{tt('officer.detail.crumbList')}</a> <Icon name="chevR" size={13} /> {tt('officer.detail.crumbDetail')}</>}
        sub={<span className="mono">{student.sid} · {tt('officer.detail.subInfo', { room: roomName(lang, displayRoom), year: displayYear })}</span>}
        actions={<div style={{ display: 'flex', gap: 8 }}>
          {!readonly && <button className="btn btn-ghost" onClick={openEdit}><Icon name="edit" size={16} /> {tt('officer.detail.editBtn')}</button>}
          <button className="btn btn-ghost" onClick={() => go('students')}><Icon name="chevL" size={16} /> {tt('officer.detail.backBtn')}</button>
        </div>} />

      <div className="row wrap-m" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ink-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{tt('officer.detail.resultsTitle')}</h3>
              <span className="tnum chip" style={{ background: allPass ? 'var(--status-ok-bg)' : 'var(--ink-100)', color: allPass ? 'var(--status-ok-fg)' : 'var(--ink-900)', fontWeight: 700 }}>{tt('officer.detail.passChip', { passed: passedCount })}</span>
            </div>
            <table className="tbl">
              <thead><tr><th style={{ width: 80 }}>{tt('officer.detail.colCode')}</th><th>{tt('officer.detail.colSubject')}</th><th style={{ textAlign: 'right' }}>{tt('officer.detail.colResult')}</th></tr></thead>
              <tbody>{subjects.map(sub => {
                const r = examResult?.subject_results.find(x => x.subject_id === sub.subject_id);
                return <tr key={sub.subject_id}><td className="mono" style={{ color: 'var(--ink-400)' }}>{sub.subject_code}</td>
                  <td style={{ fontWeight: 500 }}>{subjectName(lang, sub.subject_code, sub.subject_name)}</td>
                  <td style={{ textAlign: 'right' }}><PassBadge passed={r ? r.is_passed : undefined} lang={lang} /></td></tr>;
              })}</tbody>
            </table>
          </div>

          <div className="card card-pad">
            <h3 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 800 }}>{tt('officer.detail.evidenceTitle')}</h3>
            {examResult?.certificates?.length ? examResult.certificates.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid var(--ink-200)', borderRadius: 11, marginBottom: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: 9, background: 'var(--status-reject-bg)', color: 'var(--status-reject-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="pdf" size={21} /></div>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 15.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file_name}</div>
                  <div style={{ fontSize: 14, color: 'var(--ink-500)' }}>{f.certificate_type} · PDF</div></div>
                <button className="btn btn-ghost btn-sm" onClick={() => openAuthedFile(`/certificates/${f.certificate_id}/file`, f.file_name).catch(e => toast(e.message, 'error'))}>
                  <Icon name="eye" size={15} /> {tt('officer.detail.viewBtn')}</button>
              </div>
            )) : <Empty icon="doc" title={tt('officer.detail.noEvidence')} />}
          </div>
        </div>

        <div style={{ width: 312, flex: 'none', display: 'flex', flexDirection: 'column', gap: 16 }} className="exam-aside">
          <div className="card card-pad">
            <div style={{ fontSize: 15, color: 'var(--ink-500)', fontWeight: 600, marginBottom: 8 }}>{tt('officer.detail.reviewStatusTitle')}</div>
            <StatusBadge status={status} size="lg" lang={lang} />
            {examResult?.remark && status === 'REJECTED' && <div style={{ marginTop: 12, padding: '11px 13px', background: 'var(--status-reject-bg)', borderRadius: 10, fontSize: 15, color: 'var(--status-reject-fg)' }}>
              <b>{tt('officer.detail.rejectReasonLabel')}</b><br />{examResult.remark}</div>}
            {!readonly && status === 'SUBMITTED' && <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
              <button className="btn btn-success btn-block btn-lg" disabled={busy} onClick={() => review('approve')}>
                <Icon name="checkCircle" size={18} /> {tt('officer.detail.confirmBtn')}</button>
              <button className="btn btn-danger btn-block" disabled={busy} onClick={() => setReject(true)}>
                <Icon name="xCircle" size={17} /> {tt('officer.detail.rejectBtn')}</button>
            </div>}
            {!readonly && status === 'CONFIRMED' && <div style={{ marginTop: 14, padding: '11px 13px', background: 'var(--status-ok-bg)', borderRadius: 10, fontSize: 15, color: 'var(--status-ok-fg)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icon name="checkCircle" size={17} /> {tt('status.CONFIRMED')}</div>}
            {status === 'DRAFT' && <div style={{ marginTop: 12, fontSize: 15, color: 'var(--ink-500)' }}>{tt('detailReal.notFilledYet')}</div>}
          </div>

          {/* บล็อกทุกรอบที่เคยส่งผล — คลิกสลับรอบที่ดูฝั่งซ้ายได้เลย ไม่ต้องออกไปหน้าอื่น */}
          <div className="card card-pad">
            <div style={{ fontSize: 15, color: 'var(--ink-500)', fontWeight: 600, marginBottom: 12 }}>{tt('officer.detail.roundsTitle')}</div>
            {results.length === 0 ? (
              <div style={{ fontSize: 15, color: 'var(--ink-500)' }}>{tt('officer.detail.noRounds')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {results.map(r => {
                  const rPassed = r.subject_results.filter(x => x.is_passed).length;
                  const rTotal = r.subject_results.length;
                  const isSelected = r.result_id === selectedId;
                  return (
                    <button key={r.result_id} onClick={() => setSelectedId(r.result_id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                        textAlign: 'left', width: '100%', cursor: 'pointer', fontFamily: 'inherit',
                        padding: '10px 12px', borderRadius: 10,
                        border: isSelected ? '1.5px solid var(--navy-700)' : '1.5px solid var(--ink-150,var(--ink-100))',
                        background: isSelected ? 'var(--blue-50)' : 'transparent',
                      }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink-900)' }}>
                          {tt('officer.detail.roundLabel', { attempt: r.round.attempt_number, year: r.round.academic_year })}
                        </div>
                        <div className="tnum" style={{ fontSize: 13.5, color: 'var(--ink-500)', marginTop: 2 }}>
                          {tt('officer.detail.roundPassChip', { passed: rPassed, total: rTotal })}
                        </div>
                      </div>
                      <StatusBadge status={STAFF_STATUS_TO_BADGE[r.staff_status]} lang={lang} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card card-pad">
            <div style={{ fontSize: 15, color: 'var(--ink-500)', fontWeight: 600, marginBottom: 12 }}>{tt('officer.detail.historyTitle')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, fontSize: 15 }}>
              {[[tt('officer.detail.step1'), examResult ? new Date(examResult.submitted_at).toLocaleString('th-TH') : '—', 'user'],
                [tt('officer.review.reviewBtn'), status === 'SUBMITTED' ? tt('officer.detail.waitAction') : (examResult?.confirmed_at ? new Date(examResult.confirmed_at).toLocaleString('th-TH') : '—'), 'shield']].map(([l, d, ic], i) => (
                <div key={i} style={{ display: 'flex', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--ink-100)', color: 'var(--ink-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={ic} size={15} /></div>
                  <div><div style={{ fontWeight: 600, color: 'var(--ink-800)' }}>{l}</div><div style={{ fontSize: 14, color: 'var(--ink-500)' }}>{d}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal open={reject} onClose={() => setReject(false)} title={tt('officer.detail.rejectModalTitle')} tone="var(--status-reject-fg)"
        footer={<><button className="btn btn-ghost" onClick={() => setReject(false)}>{tt('officer.detail.cancelBtn')}</button>
          <button className="btn" style={{ background: 'var(--fail)', color: '#fff' }} disabled={!remark.trim() || busy}
            onClick={() => review('reject', remark)}>
            <Icon name="send" size={16} /> {tt('officer.detail.confirmRejectBtn')}</button></>}>
        <p style={{ margin: '0 0 14px', color: 'var(--ink-600)', fontSize: 16 }}>{tt('officer.detail.rejectHint')}</p>
        <div className="field"><label>{tt('officer.detail.rejectFieldLabel')}</label>
          <textarea className="input" rows={3} placeholder={tt('officer.detail.rejectPlaceholder')} value={remark} onChange={e => setRemark(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {quickReasons.map(r => (
            <button key={r} className="chip" style={{ cursor: 'pointer', border: '1px solid var(--ink-200)' }} onClick={() => setRemark(r)}>{r}</button>
          ))}
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={tt('officer.detail.editModalTitle')} width={480}
        footer={<><button className="btn btn-ghost" onClick={() => setEditOpen(false)}>{tt('officer.detail.cancelBtn')}</button>
          <button className="btn btn-primary" disabled={editSaving} onClick={submitEdit}>
            {editSaving ? tt('officer.detail.savingBtn') : tt('officer.detail.saveBtn')}</button></>}>
        {editForm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="field" style={{ flex: 1 }}><label>{tt('officer.detail.fieldFirstName')}</label>
                <input className="input" value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} /></div>
              <div className="field" style={{ flex: 1 }}><label>{tt('officer.detail.fieldLastName')}</label>
                <input className="input" value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="field" style={{ flex: 1 }}><label>{tt('officer.detail.fieldFirstNameEn')}</label>
                <input className="input" value={editForm.first_name_en} onChange={e => setEditForm(f => ({ ...f, first_name_en: e.target.value }))} /></div>
              <div className="field" style={{ flex: 1 }}><label>{tt('officer.detail.fieldLastNameEn')}</label>
                <input className="input" value={editForm.last_name_en} onChange={e => setEditForm(f => ({ ...f, last_name_en: e.target.value }))} /></div>
            </div>
            <div className="field"><label>{tt('officer.detail.fieldEmail')}</label>
              <input className="input" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="field"><label>{tt('officer.detail.fieldPhone')}</label>
              <input className="input tnum" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="field" style={{ flex: 1 }}><label>{tt('officer.detail.fieldRoom')}</label>
                <select className="select" value={editForm.room_id} onChange={e => setEditForm(f => ({ ...f, room_id: e.target.value }))}>
                  {rooms.map(r => <option key={r.room_id} value={r.room_id}>{r.room_name}</option>)}
                </select></div>
              <div className="field" style={{ flex: 1 }}><label>{tt('officer.detail.fieldYear')}</label>
                <input className="input tnum" type="number" value={editForm.academic_year} onChange={e => setEditForm(f => ({ ...f, academic_year: e.target.value }))} /></div>
            </div>
            {editError && <div style={{ color: 'var(--reject,#dc2626)', fontSize: 15 }}>{editError}</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
