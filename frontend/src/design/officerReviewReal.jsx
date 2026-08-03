/* ============================================================
   เจ้าหน้าที่ — คิวตรวจสอบผลสอบ (ข้อมูลจริงจาก backend)
   แทนที่ OfficerReview เดิมใน officer.jsx ที่ใช้ mock STUDENTS
   ดึง GET /api/exam-results ทั้งหมดครั้งเดียว แล้วแยก tab ด้วย staff_status ฝั่ง client
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, Avatar, Empty } from './components.jsx';
import { apiFetch } from './api.js';
import { t } from './i18n.js';

const STAFF_STATUS_TO_TAB = { pending: 'SUBMITTED', approved: 'CONFIRMED', rejected: 'REJECTED' };

export function OfficerReviewReal({ go, setSel, lang }) {
  const tt = (key, vars) => t(lang, key, vars);
  const [tab, setTab] = useState('SUBMITTED');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/exam-results').then(setResults).catch(e => setError(e.message));
  }, []);

  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>{tt('statuspage.loadFailPrefix', { msg: error })}</div>;
  if (!results) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>{tt('common.loading')}</div>;

  const rows = results.filter(r => STAFF_STATUS_TO_TAB[r.staff_status] === tab).map(r => ({
    sid: r.student_id,
    firstName: r.student.user.first_name,
    lastName: r.student.user.last_name,
    room: r.student.room?.room_name || '-',
    year: r.student.academic_year,
    passedCount: r.subject_results.filter(s => s.is_passed).length,
    allPass: r.subject_results.every(s => s.is_passed),
    files: r.certificates,
    submittedAt: new Date(r.submitted_at).toLocaleDateString('th-TH'),
  }));
  const counts = {
    SUBMITTED: results.filter(r => r.staff_status === 'pending').length,
    REJECTED: results.filter(r => r.staff_status === 'rejected').length,
    CONFIRMED: results.filter(r => r.staff_status === 'approved').length,
  };

  return (
    <div className="fade-up">
      <PageHead title={tt('officer.review.title')} sub={tt('officer.review.sub')} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {['SUBMITTED', 'REJECTED', 'CONFIRMED'].map(k => (
          <button key={k} onClick={() => setTab(k)} className="btn" style={{
            background: tab === k ? 'var(--navy-700)' : '#fff', color: tab === k ? '#fff' : 'var(--ink-900)',
            border: '1px solid ' + (tab === k ? 'var(--navy-700)' : 'var(--ink-200)') }}>
            {tt('status.' + k)}
            <span className="tnum" style={{ background: tab === k ? 'rgba(255,255,255,.2)' : 'var(--ink-100)', padding: '1px 8px', borderRadius: 999, fontSize: 12.5, marginLeft: 8 }}>{counts[k]}</span>
          </button>
        ))}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {rows.length ? <div style={{ overflowX: 'auto' }}><table className="tbl">
          <thead><tr><th>{tt('officer.review.colStudent')}</th><th>{tt('officer.review.colRoom')}</th><th>{tt('officer.review.colResult')}</th><th>{tt('officer.review.colEvidence')}</th><th>{tt('officer.review.colSubmitted')}</th><th></th></tr></thead>
          <tbody>{rows.map(s => (
            <tr key={s.sid} className="clickable" onClick={() => { setSel(s); go('detail'); }}>
              <td><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={s.firstName} size={34} />
                <div><div style={{ fontWeight: 600, fontSize: 14 }}>{s.firstName} {s.lastName}</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--ink-400)' }}>{s.sid}</div></div></div></td>
              <td><span className="chip" style={{ fontSize: 12 }}>{s.room}</span></td>
              <td className="tnum" style={{ fontWeight: 700, color: s.allPass ? 'var(--pass)' : 'var(--ink-800)' }}>{s.passedCount}/8</td>
              <td>{s.files.length ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--status-reject-fg)', fontSize: 13 }}><Icon name="pdf" size={15} /> {tt('officer.review.filesCount', { n: s.files.length })}</span> : <span style={{ color: 'var(--ink-400)' }}>—</span>}</td>
              <td style={{ color: 'var(--ink-500)', fontSize: 13 }}>{s.submittedAt}</td>
              <td style={{ textAlign: 'right' }}><button className="btn btn-subtle btn-sm" style={{ background: 'var(--navy-700)', color: '#fff' }}>{tt('officer.review.reviewBtn')} <Icon name="chevR" size={14} /></button></td>
            </tr>
          ))}</tbody>
        </table></div> : <Empty icon="checkCircle" title={tt('officer.review.emptyTitle')} />}
      </div>
    </div>
  );
}
