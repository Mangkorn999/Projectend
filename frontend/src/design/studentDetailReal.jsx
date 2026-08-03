/* ============================================================
   เจ้าหน้าที่ / ผู้บริหาร — รายละเอียดผลสอบนักศึกษาคนเดียว (ข้อมูลจริงจาก backend)
   แทนที่ StudentDetail เดิมใน officer.jsx ที่ยังใช้ mock SUBJECTS/STUDENTS
   executive เปิดด้วย readonly=true — ปุ่มยืนยัน/ตีกลับจะไม่โชว์ (backend เองก็ block role นี้อยู่แล้วที่ระดับ route)
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, Modal, StatusBadge, PassBadge, Empty } from './components.jsx';
import { apiFetch, ApiError, openAuthedFile } from './api.js';
import { t, subjectName } from './i18n.js';

const STAFF_STATUS_TO_BADGE = { pending: 'SUBMITTED', approved: 'CONFIRMED', rejected: 'REJECTED' };

export function StudentDetailReal({ student, go, toast, readonly, lang }) {
  const tt = (key, vars) => t(lang, key, vars);
  const quickReasons = [tt('officer.detail.quickReason1'), tt('officer.detail.quickReason2'), tt('officer.detail.quickReason3')];
  const [subjects, setSubjects] = useState([]); // [{subject_id, subject_code, subject_name}]
  const [examResult, setExamResult] = useState(null); // exam_result ล่าสุดของนักศึกษาคนนี้ (มี subject_results, certificates)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reject, setReject] = useState(false);
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      apiFetch('/subjects'),
      apiFetch(`/exam-results?student_id=${student.sid}`),
    ]).then(([subjectList, results]) => {
      setSubjects(subjectList);
      setExamResult(results[0] || null); // เรียงจาก submitted_at desc อยู่แล้ว — ตัวแรกคือรอบล่าสุด
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, [student.sid]);

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

  if (loading) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>{tt('common.loading')}</div>;
  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>{tt('statuspage.loadFailPrefix', { msg: error })}</div>;

  return (
    <div className="fade-up">
      <PageHead title={`${student.firstName} ${student.lastName}`}
        crumb={<><a onClick={() => go('students')} style={{ cursor: 'pointer' }}>{tt('officer.detail.crumbList')}</a> <Icon name="chevR" size={13} /> {tt('officer.detail.crumbDetail')}</>}
        sub={<span className="mono">{student.sid} · {tt('officer.detail.subInfo', { room: student.room, year: student.year })}</span>}
        actions={<button className="btn btn-ghost" onClick={() => go('students')}><Icon name="chevL" size={16} /> {tt('officer.detail.backBtn')}</button>} />

      <div className="row wrap-m" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ink-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{tt('officer.detail.resultsTitle')}</h3>
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
            <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>{tt('officer.detail.evidenceTitle')}</h3>
            {examResult?.certificates?.length ? examResult.certificates.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid var(--ink-200)', borderRadius: 11, marginBottom: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: 9, background: 'var(--status-reject-bg)', color: 'var(--status-reject-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="pdf" size={21} /></div>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{f.certificate_type} · PDF</div></div>
                <button className="btn btn-ghost btn-sm" onClick={() => openAuthedFile(`/certificates/${f.certificate_id}/file`, f.file_name).catch(e => toast(e.message, 'error'))}>
                  <Icon name="eye" size={15} /> {tt('officer.detail.viewBtn')}</button>
              </div>
            )) : <Empty icon="doc" title={tt('officer.detail.noEvidence')} />}
          </div>
        </div>

        <div style={{ width: 312, flex: 'none', display: 'flex', flexDirection: 'column', gap: 16 }} className="exam-aside">
          <div className="card card-pad">
            <div style={{ fontSize: 13, color: 'var(--ink-500)', fontWeight: 600, marginBottom: 8 }}>{tt('officer.detail.reviewStatusTitle')}</div>
            <StatusBadge status={status} size="lg" lang={lang} />
            {examResult?.remark && status === 'REJECTED' && <div style={{ marginTop: 12, padding: '11px 13px', background: 'var(--status-reject-bg)', borderRadius: 10, fontSize: 13, color: 'var(--status-reject-fg)' }}>
              <b>{tt('officer.detail.rejectReasonLabel')}</b><br />{examResult.remark}</div>}
            {!readonly && status === 'SUBMITTED' && <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
              <button className="btn btn-success btn-block btn-lg" disabled={busy} onClick={() => review('approve')}>
                <Icon name="checkCircle" size={18} /> {tt('officer.detail.confirmBtn')}</button>
              <button className="btn btn-danger btn-block" disabled={busy} onClick={() => setReject(true)}>
                <Icon name="xCircle" size={17} /> {tt('officer.detail.rejectBtn')}</button>
            </div>}
            {!readonly && status === 'CONFIRMED' && <div style={{ marginTop: 14, padding: '11px 13px', background: 'var(--status-ok-bg)', borderRadius: 10, fontSize: 13, color: 'var(--status-ok-fg)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icon name="checkCircle" size={17} /> {tt('status.CONFIRMED')}</div>}
            {status === 'DRAFT' && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-500)' }}>{tt('detailReal.notFilledYet')}</div>}
          </div>
          <div className="card card-pad">
            <div style={{ fontSize: 13, color: 'var(--ink-500)', fontWeight: 600, marginBottom: 12 }}>{tt('officer.detail.historyTitle')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, fontSize: 13 }}>
              {[[tt('officer.detail.step1'), examResult ? new Date(examResult.submitted_at).toLocaleString('th-TH') : '—', 'user'],
                [tt('officer.review.reviewBtn'), status === 'SUBMITTED' ? tt('officer.detail.waitAction') : (examResult?.confirmed_at ? new Date(examResult.confirmed_at).toLocaleString('th-TH') : '—'), 'shield']].map(([l, d, ic], i) => (
                <div key={i} style={{ display: 'flex', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--ink-100)', color: 'var(--ink-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={ic} size={15} /></div>
                  <div><div style={{ fontWeight: 600, color: 'var(--ink-800)' }}>{l}</div><div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{d}</div></div>
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
        <p style={{ margin: '0 0 14px', color: 'var(--ink-600)', fontSize: 14 }}>{tt('officer.detail.rejectHint')}</p>
        <div className="field"><label>{tt('officer.detail.rejectFieldLabel')}</label>
          <textarea className="input" rows={3} placeholder={tt('officer.detail.rejectPlaceholder')} value={remark} onChange={e => setRemark(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {quickReasons.map(r => (
            <button key={r} className="chip" style={{ cursor: 'pointer', border: '1px solid var(--ink-200)' }} onClick={() => setRemark(r)}>{r}</button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
