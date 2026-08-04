/* ============================================================
   Dashboard สรุปผลสอบ (officer + executive) — ข้อมูลจริงจาก backend
   แทนที่ OfficerDashboard/ExecutiveDashboard เดิมที่ใช้ mock STUDENTS/TREND
   ดึงจาก GET /api/dashboard/stats (คำนวณรวมฝั่ง backend อยู่แล้ว ไม่คำนวณซ้ำฝั่ง frontend)
   + GET /api/dashboard/history สำหรับเทียบย้อนหลังรายปี
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, StatCard, Donut, BarRow } from './components.jsx';
import { apiFetch } from './api.js';
import { t, subjectName } from './i18n.js';

export function DashboardReal({ go, readonly, lang }) {
  const tt = (key, vars) => t(lang, key, vars);
  const [stats, setStats] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [history, setHistory] = useState(null);
  const [roundId, setRoundId] = useState(''); // '' = ให้ backend เลือกรอบที่เปิดอยู่
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // โหลดครั้งแรก — รายการรอบกับสรุปย้อนหลังไม่เปลี่ยนตามรอบที่เลือก โหลดรอบเดียวพอ
  useEffect(() => {
    Promise.all([apiFetch('/rounds'), apiFetch('/dashboard/history?years=3')])
      .then(([roundList, hist]) => { setRounds(roundList); setHistory(hist); })
      .catch(e => setError(e.message));
  }, []);

  // โหลดใหม่ทุกครั้งที่เปลี่ยนรอบ
  useEffect(() => {
    setLoading(true);
    apiFetch(roundId ? `/dashboard/stats?round_id=${roundId}` : '/dashboard/stats')
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [roundId]);

  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>{tt('statuspage.loadFailPrefix', { msg: error })}</div>;
  if (loading && !stats) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>{tt('common.loading')}</div>;
  if (!stats) return null;

  const { round, total, eligible, by, not_started, submitted, fillRate,
          fullyPassed, fullyPassedRate, subjectPassRate, perSubject } = stats;

  // วงกลมต้องรวมได้เท่ากับจำนวนคนที่กรอกได้ ไม่งั้นตัวเลขตรงกลางกับวงจะไม่ตรงกัน
  const segs = [
    { key: 'CONFIRMED', label: tt('status.CONFIRMED'), value: by.approved, color: 'var(--status-ok-dot)' },
    { key: 'SUBMITTED', label: tt('status.SUBMITTED'), value: by.submitted, color: 'var(--status-wait-dot)' },
    { key: 'REJECTED', label: tt('status.REJECTED'), value: by.rejected, color: 'var(--status-reject-dot)' },
    { key: 'DRAFT', label: tt('dashReal.draftLabel'), value: by.draft, color: 'var(--ink-200)' },
    { key: 'NONE', label: tt('dashReal.notStartedLabel'), value: not_started, color: 'var(--ink-300)' },
  ].filter(s => s.value > 0 || s.key !== 'DRAFT'); // draft ปกติเป็น 0 ไม่ต้องรกตา

  const roundLabel = r => tt('dashReal.roundLabel', { attempt: r.attempt_number, year: r.academic_year }) + (r.status === 'open' ? tt('dashReal.roundOpenSuffix') : '');

  return (
    <div className="fade-up">
      <PageHead title={tt('dashReal.title')}
        sub={tt('dashReal.sub', { round: roundLabel(round), year: round.academic_year, total, eligible })}
        actions={<>
          <select className="input" value={roundId} onChange={e => setRoundId(e.target.value)}
            style={{ minWidth: 200 }} aria-label={tt('dashReal.roundSelectLabel')}>
            <option value="">{tt('dashReal.roundOpenOption')}</option>
            {rounds.map(r => <option key={r.round_id} value={r.round_id}>{roundLabel(r)}</option>)}
          </select>
          {!readonly && <button className="btn btn-primary" onClick={() => go('review')}><Icon name="checkCircle" size={17} /> {tt('dashReal.goReviewBtn')}
            <span className="nav-badge" style={{ background: 'var(--gold-500)', color: '#3a2c05', marginLeft: 2 }}>{by.submitted}</span></button>}
        </>} />

      <div className="grid g-5" style={{ marginBottom: 20 }}>
        <StatCard icon="users" label={tt('dashReal.eligibleStatLabel')} value={eligible} sub={tt('dashReal.eligibleStatSub', { total })} tone="navy" accent onClick={() => go('students')} />
        <StatCard icon="edit" label={tt('dashReal.submittedStatLabel')} value={submitted} sub={tt('dashReal.submittedStatSub', { rate: fillRate })} tone="blue" accent onClick={() => go('students')} />
        <StatCard icon="clock" label={tt('status.SUBMITTED')} value={by.submitted} sub={tt('dashReal.pendingSub')} tone="wait" accent onClick={() => !readonly && go('review')} />
        <StatCard icon="checkCircle" label={tt('status.CONFIRMED')} value={by.approved} sub={tt('dashReal.confirmedSub', { n: fullyPassed, rate: fullyPassedRate })} tone="ok" accent />
        <StatCard icon="xCircle" label={tt('status.REJECTED')} value={by.rejected} sub={tt('dashReal.rejectedSub')} tone="reject" accent onClick={() => !readonly && go('review')} />
      </div>

      <div className="row wrap-m" style={{ alignItems: 'flex-start' }}>
        <div className="card card-pad" style={{ flex: '1 1 320px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>{tt('dashReal.statusBreakdownTitle')}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <Donut segments={segs} center={<><div className="tnum" style={{ fontSize: 26, fontWeight: 800 }}>{eligible}</div><div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{tt('dashReal.eligibleLabel')}</div></>} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {segs.map(s => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flex: 'none' }}></span>
                  <span style={{ flex: 1, color: 'var(--ink-700)' }}>{s.label}</span>
                  <span className="tnum" style={{ fontWeight: 700 }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card card-pad" style={{ flex: '1.3 1 380px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{tt('dashReal.subjectRateTitle')}</h3>
            <span className="tnum chip" style={{ background: 'var(--blue-50)', color: 'var(--blue-600)', fontWeight: 700 }}>{tt('dashReal.avgAllSubjects', { rate: subjectPassRate })}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {perSubject.map(sub => {
              const label = `${sub.subject_code} · ${subjectName(lang, sub.subject_code, sub.subject_name)}`;
              // rate = null คือไม่มีใครสอบวิชานี้ในรอบ (ทุกคนยกผลผ่านมาจากรอบก่อน)
              // ต้องขึ้น — ไม่ใช่ 0% เพราะ 0% แปลว่าสอบแล้วตกหมด คนละเรื่องกัน
              if (sub.rate === null) return (
                <BarRow key={sub.subject_id} label={label} value={0} max={100}
                  color="var(--ink-200)" right="—" sub={tt('dashReal.noExamThisRound')} />
              );
              return (
                <BarRow key={sub.subject_id} label={label} value={sub.rate} max={100}
                  color={sub.rate >= 70 ? 'var(--status-ok-dot)' : sub.rate >= 40 ? 'var(--status-wait-dot)' : 'var(--status-reject-dot)'}
                  right={`${sub.rate}%`} sub={tt('dashReal.passFailSub', { pass: sub.pass, fail: sub.fail })} />
              );
            })}
          </div>
        </div>
      </div>

      {history && history.years.length > 0 && <YearCompare history={history} tt={tt} />}
    </div>
  );
}

/* เทียบผลรุ่นต่อรุ่นย้อนหลัง — นับเป็นรายคน คนที่กรอกหลายรอบในปีเดียวนับครั้งเดียว */
function YearCompare({ history, tt }) {
  return (
    <div className="card card-pad" style={{ marginTop: 20 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>{tt('dashReal.yearCompareTitle', { n: history.years.length })}</h3>
      <p style={{ margin: '0 0 16px', color: 'var(--ink-500)', fontSize: 13 }}>
        {tt('dashReal.yearCompareSub')}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--ink-500)', fontSize: 12.5 }}>
              <th style={{ padding: '8px 10px' }}>{tt('dashReal.colYear')}</th>
              <th style={{ padding: '8px 10px' }}>{tt('dashReal.colRounds')}</th>
              <th style={{ padding: '8px 10px' }}>{tt('dashReal.colEligible')}</th>
              <th style={{ padding: '8px 10px' }}>{tt('dashReal.colSubmitted')}</th>
              <th style={{ padding: '8px 10px', minWidth: 150 }}>{tt('dashReal.colFullPass')}</th>
            </tr>
          </thead>
          <tbody>
            {history.years.map(y => (
              <tr key={y.academic_year} style={{ borderTop: '1px solid var(--ink-100)' }}>
                <td className="tnum" style={{ padding: '10px', fontWeight: 700 }}>{y.academic_year}</td>
                <td className="tnum" style={{ padding: '10px' }}>{y.rounds.length}</td>
                <td className="tnum" style={{ padding: '10px' }}>{y.eligible} / {y.total}</td>
                <td className="tnum" style={{ padding: '10px' }}>{y.submitted} ({y.fillRate}%)</td>
                <td style={{ padding: '10px' }}>
                  <BarRow label="" value={y.passRate} max={100} right={tt('dashReal.passCountRate', { n: y.fullyPassed, rate: y.passRate })}
                    color={y.passRate >= 70 ? 'var(--status-ok-dot)' : y.passRate >= 40 ? 'var(--status-wait-dot)' : 'var(--status-reject-dot)'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
