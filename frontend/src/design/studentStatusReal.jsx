/* ============================================================
   นักศึกษา — สถานะการกรอกล่าสุด + ประวัติทุกรอบ (ข้อมูลจริงจาก backend)
   แทนที่ StudentStatus/StudentHistory เดิมใน student.jsx ที่ยังเป็น mock ทั้งก้อน
   ทั้งสองหน้าใช้ GET /api/exam-results/me เหมือนกัน (เรียงจาก submitted_at desc อยู่แล้ว)
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, Donut, PassBadge, StatusBadge, Empty } from './components.jsx';
import { apiFetch } from './api.js';
import { t, subjectName } from './i18n.js';

const STAFF_STATUS_TO_BADGE = { pending: 'SUBMITTED', approved: 'CONFIRMED', rejected: 'REJECTED' };

function useMyResults() {
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    apiFetch('/exam-results/me').then(setResults).catch(e => setError(e.message));
  }, []);
  return { results, error };
}

export function StudentStatusReal({ go, lang }) {
  const { results, error } = useMyResults();
  const tt = (key, vars) => t(lang, key, vars);

  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>{tt('statuspage.loadFailPrefix', { msg: error })}</div>;
  if (!results) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>{tt('common.loading')}</div>;

  if (results.length === 0) return (
    <div className="fade-up">
      <PageHead title={tt('statuspage.title')} actions={<button className="btn btn-ghost" onClick={() => go('history')}><Icon name="history" size={17} /> {tt('statuspage.historyBtn')}</button>} />
      <Empty icon="edit" title={tt('statuspage.emptyTitle')} sub={tt('statuspage.emptySub')} />
    </div>
  );

  const latest = results[0];
  const status = STAFF_STATUS_TO_BADGE[latest.staff_status];
  const passed = latest.subject_results.filter(s => s.is_passed).length;
  const total = latest.subject_results.length;
  const submittedAt = new Date(latest.submitted_at).toLocaleString('th-TH');

  const timeline = [
    { label: tt('statuspage.timeline.0'), date: submittedAt, done: true },
    { label: tt('statuspage.timeline.1'), date: status === 'SUBMITTED' ? tt('statuspage.inProgress') : (latest.confirmed_at ? new Date(latest.confirmed_at).toLocaleString('th-TH') : '—'), active: status === 'SUBMITTED', done: status !== 'SUBMITTED' },
    { label: status === 'REJECTED' ? tt('status.REJECTED') : tt('statuspage.confirmLabel'), date: status === 'CONFIRMED' ? tt('statuspage.completedLabel') : status === 'REJECTED' ? (latest.remark || '—') : tt('statuspage.waitResultLabel'), done: status === 'CONFIRMED' || status === 'REJECTED', rejected: status === 'REJECTED' },
  ];

  return (
    <div className="fade-up">
      <PageHead title={tt('statuspage.title')} sub={tt('news.roundSlash', { attempt: latest.round.attempt_number, year: latest.round.academic_year })}
        actions={<button className="btn btn-ghost" onClick={() => go('history')}><Icon name="history" size={17} /> {tt('statuspage.historyBtn')}</button>} />
      <div className="row wrap-m" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card" style={{ padding: '22px 24px', borderLeft: `4px solid ${status === 'REJECTED' ? 'var(--status-reject-dot)' : status === 'CONFIRMED' ? 'var(--status-ok-dot)' : 'var(--status-wait-dot)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 15.5, color: 'var(--ink-500)', fontWeight: 600, marginBottom: 8 }}>{tt('statuspage.currentStatus')}</div>
                <StatusBadge status={status} size="lg" lang={lang} />
                <div style={{ fontSize: 15, color: 'var(--ink-500)', marginTop: 10 }}>{tt('statuspage.submittedNote', { date: submittedAt })}</div>
                {status === 'REJECTED' && latest.remark && <div style={{ marginTop: 10, padding: '10px 13px', background: 'var(--status-reject-bg)', borderRadius: 10, fontSize: 15, color: 'var(--status-reject-fg)' }}>{latest.remark}</div>}
              </div>
              <Donut size={104} thickness={13} segments={[{ value: passed, color: 'var(--pass)' }, { value: total - passed, color: 'var(--fail)' }]}
                center={<><div className="tnum" style={{ fontSize: 23, fontWeight: 800 }}>{passed}/{total}</div><div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{tt('progress.legendPass')}</div></>} />
            </div>
          </div>
          <div className="card card-pad">
            <h3 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 800 }}>{tt('statuspage.subjectSummaryTitle')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 9 }}>
              {latest.subject_results.map(s => (
                <div key={s.subject_result_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 13px', background: '#fff', border: '1px solid var(--ink-200)', borderRadius: 9 }}>
                  <span style={{ fontSize: 15, color: 'var(--ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subjectName(lang, s.subject.subject_code, s.subject.subject_name)}</span>
                  <PassBadge passed={s.is_passed} lang={lang} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ width: 300, flex: 'none' }} className="exam-aside">
          <div className="card card-pad">
            <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 800 }}>{tt('statuspage.timelineTitle')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {timeline.map((tl, i) => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: tl.rejected ? 'var(--status-reject-dot)' : tl.done ? 'var(--pass)' : tl.active ? 'var(--status-wait-dot)' : '#fff',
                      color: (tl.done || tl.active) ? '#fff' : 'var(--ink-400)', border: (tl.done || tl.active) ? 'none' : '2px solid var(--ink-200)' }}>
                      {tl.rejected ? <Icon name="x" size={14} /> : tl.done ? <Icon name="check" size={14} /> : tl.active ? <Icon name="clock" size={13} /> : i + 1}</div>
                    {i < timeline.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 30, background: tl.done ? 'var(--pass)' : 'var(--ink-200)' }}></div>}
                  </div>
                  <div style={{ paddingBottom: 18 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: tl.rejected ? 'var(--status-reject-fg)' : tl.active ? 'var(--status-wait-fg)' : 'var(--ink-800)' }}>{tl.label}</div>
                    <div style={{ fontSize: 14.5, color: 'var(--ink-500)', marginTop: 2 }}>{tl.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StudentHistoryReal({ go, lang }) {
  const { results, error } = useMyResults();
  const tt = (key, vars) => t(lang, key, vars);

  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>{tt('statuspage.loadFailPrefix', { msg: error })}</div>;
  if (!results) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>{tt('common.loading')}</div>;

  return (
    <div className="fade-up">
      <PageHead title={tt('historypage.title')} sub={tt('historypage.totalRounds', { n: results.length })} />
      <div className="card" style={{ overflow: 'hidden' }}>
        {results.length === 0 ? <Empty icon="history" title={tt('historypage.emptyTitle')} /> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>{tt('historypage.colRound')}</th><th>{tt('historypage.colDate')}</th><th>{tt('historypage.colResult')}</th><th>{tt('historypage.colStatus')}</th></tr></thead>
              <tbody>
                {results.map(r => {
                  const passed = r.subject_results.filter(s => s.is_passed).length;
                  return (
                    <tr key={r.result_id}>
                      <td style={{ fontWeight: 700 }}>{tt('historypage.roundSlash', { attempt: r.round.attempt_number, year: r.round.academic_year })}</td>
                      <td style={{ color: 'var(--ink-600)' }}>{new Date(r.submitted_at).toLocaleDateString('th-TH')}</td>
                      <td><span className="tnum" style={{ fontWeight: 700, color: passed === r.subject_results.length ? 'var(--pass)' : 'var(--ink-800)' }}>{passed}/{r.subject_results.length}</span></td>
                      <td><StatusBadge status={STAFF_STATUS_TO_BADGE[r.staff_status]} lang={lang} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
