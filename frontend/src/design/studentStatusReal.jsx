/* ============================================================
   นักศึกษา — สถานะการกรอกล่าสุด + ประวัติทุกรอบ (ข้อมูลจริงจาก backend)
   แทนที่ StudentStatus/StudentHistory เดิมใน student.jsx ที่ยังเป็น mock ทั้งก้อน
   ทั้งสองหน้าใช้ GET /api/exam-results/me เหมือนกัน (เรียงจาก submitted_at desc อยู่แล้ว)
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, Donut, PassBadge, StatusBadge, Empty } from './components.jsx';
import { apiFetch } from './api.js';

const STAFF_STATUS_TO_BADGE = { pending: 'SUBMITTED', approved: 'CONFIRMED', rejected: 'REJECTED' };

function useMyResults() {
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    apiFetch('/exam-results/me').then(setResults).catch(e => setError(e.message));
  }, []);
  return { results, error };
}

export function StudentStatusReal({ go }) {
  const { results, error } = useMyResults();

  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>โหลดข้อมูลไม่สำเร็จ: {error}</div>;
  if (!results) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>กำลังโหลดข้อมูล…</div>;

  if (results.length === 0) return (
    <div className="fade-up">
      <PageHead title="สถานะการกรอก" actions={<button className="btn btn-ghost" onClick={() => go('history')}><Icon name="history" size={17} /> ดูประวัติ</button>} />
      <Empty icon="edit" title="ยังไม่เคยกรอกผลสอบ" sub="ไปที่เมนู 'กรอกผลสอบ' เพื่อเริ่มกรอก" />
    </div>
  );

  const latest = results[0];
  const status = STAFF_STATUS_TO_BADGE[latest.staff_status];
  const passed = latest.subject_results.filter(s => s.is_passed).length;
  const total = latest.subject_results.length;
  const submittedAt = new Date(latest.submitted_at).toLocaleString('th-TH');

  const timeline = [
    { label: 'ส่งผลสอบ', date: submittedAt, done: true },
    { label: 'เจ้าหน้าที่ตรวจสอบ', date: status === 'SUBMITTED' ? 'กำลังดำเนินการ' : (latest.confirmed_at ? new Date(latest.confirmed_at).toLocaleString('th-TH') : '—'), active: status === 'SUBMITTED', done: status !== 'SUBMITTED' },
    { label: status === 'REJECTED' ? 'ถูกตีกลับ' : 'ยืนยันผล', date: status === 'CONFIRMED' ? 'เสร็จสมบูรณ์' : status === 'REJECTED' ? (latest.remark || '—') : 'รอผลตรวจสอบ', done: status === 'CONFIRMED' || status === 'REJECTED' },
  ];

  return (
    <div className="fade-up">
      <PageHead title="สถานะการกรอก" sub={`รอบที่ ${latest.round.attempt_number}/${latest.round.academic_year}`}
        actions={<button className="btn btn-ghost" onClick={() => go('history')}><Icon name="history" size={17} /> ดูประวัติ</button>} />
      <div className="row wrap-m" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card" style={{ padding: '22px 24px', borderLeft: `4px solid ${status === 'REJECTED' ? 'var(--status-reject-dot)' : status === 'CONFIRMED' ? 'var(--status-ok-dot)' : 'var(--status-wait-dot)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-500)', fontWeight: 600, marginBottom: 8 }}>สถานะปัจจุบัน</div>
                <StatusBadge status={status} size="lg" />
                <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 10 }}>ส่งเมื่อ {submittedAt}</div>
                {status === 'REJECTED' && latest.remark && <div style={{ marginTop: 10, padding: '10px 13px', background: 'var(--status-reject-bg)', borderRadius: 10, fontSize: 13, color: 'var(--status-reject-fg)' }}>{latest.remark}</div>}
              </div>
              <Donut size={104} thickness={13} segments={[{ value: passed, color: 'var(--pass)' }, { value: total - passed, color: 'var(--fail)' }]}
                center={<><div className="tnum" style={{ fontSize: 21, fontWeight: 800 }}>{passed}/{total}</div><div style={{ fontSize: 10.5, color: 'var(--ink-500)' }}>ผ่าน</div></>} />
            </div>
          </div>
          <div className="card card-pad">
            <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>สรุปผลรายวิชา</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              {latest.subject_results.map(s => (
                <div key={s.subject_result_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 13px', background: '#fff', border: '1px solid var(--ink-200)', borderRadius: 9 }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subject.subject_name}</span>
                  <PassBadge passed={s.is_passed} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ width: 300, flex: 'none' }} className="exam-aside">
          <div className="card card-pad">
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>ไทม์ไลน์</h3>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {timeline.map((tl, i) => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: tl.done ? 'var(--pass)' : tl.active ? 'var(--status-wait-dot)' : '#fff',
                      color: (tl.done || tl.active) ? '#fff' : 'var(--ink-400)', border: (tl.done || tl.active) ? 'none' : '2px solid var(--ink-200)' }}>
                      {tl.done ? <Icon name="check" size={14} /> : tl.active ? <Icon name="clock" size={13} /> : i + 1}</div>
                    {i < timeline.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 30, background: tl.done ? 'var(--pass)' : 'var(--ink-200)' }}></div>}
                  </div>
                  <div style={{ paddingBottom: 18 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: tl.active ? 'var(--status-wait-fg)' : 'var(--ink-800)' }}>{tl.label}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 2 }}>{tl.date}</div>
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

export function StudentHistoryReal({ go }) {
  const { results, error } = useMyResults();

  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>โหลดข้อมูลไม่สำเร็จ: {error}</div>;
  if (!results) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>กำลังโหลดข้อมูล…</div>;

  return (
    <div className="fade-up">
      <PageHead title="ประวัติการกรอกผลสอบ" sub={`ทั้งหมด ${results.length} รอบ`} />
      <div className="card" style={{ overflow: 'hidden' }}>
        {results.length === 0 ? <Empty icon="history" title="ยังไม่มีประวัติการกรอก" /> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>รอบ</th><th>วันที่ส่ง</th><th>ผลสอบ</th><th>สถานะ</th></tr></thead>
              <tbody>
                {results.map(r => {
                  const passed = r.subject_results.filter(s => s.is_passed).length;
                  return (
                    <tr key={r.result_id}>
                      <td style={{ fontWeight: 700 }}>รอบที่ {r.round.attempt_number}/{r.round.academic_year}</td>
                      <td style={{ color: 'var(--ink-600)' }}>{new Date(r.submitted_at).toLocaleDateString('th-TH')}</td>
                      <td><span className="tnum" style={{ fontWeight: 700, color: passed === r.subject_results.length ? 'var(--pass)' : 'var(--ink-800)' }}>{passed}/{r.subject_results.length}</span></td>
                      <td><StatusBadge status={STAFF_STATUS_TO_BADGE[r.staff_status]} /></td>
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
