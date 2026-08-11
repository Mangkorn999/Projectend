/* ============================================================
   รายงานสรุปผลสอบ (officer + executive) — ข้อมูลจริงจาก backend
   แทนที่ Reports เดิมใน executive.jsx ที่ใช้ mock STUDENTS + ปุ่ม export ปลอม
   ใช้ GET /api/dashboard/stats ตัวเดียวกับหน้า Dashboard (เนื้อหารายงานตรงกับที่เห็นบนจอเสมอ)
   ปุ่ม PDF ยิง GET /api/dashboard/export จริง (officer เท่านั้น — backend บังคับ) ได้ไฟล์ PDF จริงกลับมาโหลด
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, StatusBadge } from './components.jsx';
import { Logo } from './logos.jsx';
import { apiFetch } from './api.js';
import { t, subjectName, roomName } from './i18n.js';

export function ReportsReal({ toast, readonly, lang }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const tt = (key, vars) => t(lang, key, vars);

  // ตัวเลขที่ส่งสภาการพยาบาลเป็นระดับปีการศึกษา ไม่ใช่ระดับรอบ — ต้องดึงสรุปรายปีมาคู่กัน
  const [history, setHistory] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [year, setYear] = useState(null);
  const [roundId, setRoundId] = useState(null); // รอบที่รายงานนี้แสดง = รอบที่จะ export

  // โหลดรายการรอบ + สรุปย้อนหลัง แล้วตั้งค่าเริ่มต้นเป็นรอบที่เปิดรับอยู่ (ไม่มีก็รอบล่าสุด)
  useEffect(() => {
    Promise.all([apiFetch('/rounds'), apiFetch('/dashboard/history?years=3')])
      .then(([roundList, hist]) => {
        setRounds(roundList);
        setHistory(hist);
        if (roundList.length === 0) return;
        const openRound = roundList.find(r => r.status === 'open');
        const newest = [...roundList].sort(
          (a, b) => b.academic_year - a.academic_year || b.attempt_number - a.attempt_number)[0];
        const picked = openRound || newest;
        setYear(picked.academic_year);
        setRoundId(picked.round_id);
      })
      .catch(e => setError(e.message));
  }, []);

  // เปลี่ยนรอบเมื่อไหร่ โหลดตัวเลขของรอบนั้นใหม่
  useEffect(() => {
    if (!roundId) return;
    let dropped = false;
    apiFetch(`/dashboard/stats?round_id=${roundId}`)
      .then(s => { if (!dropped) setStats(s); })
      .catch(e => { if (!dropped) setError(e.message); });
    return () => { dropped = true; };
  }, [roundId]);

  const roundsInYear = rounds
    .filter(r => r.academic_year === year)
    .sort((a, b) => a.attempt_number - b.attempt_number);
  const yearOptions = [...new Set(rounds.map(r => r.academic_year))].sort((a, b) => b - a);
  const yearStats = history?.years.find(y => y.academic_year === year) || null;

  // เปลี่ยนปี = เด้งไปรอบแรกของปีนั้นเสมอ เพราะ round_id ของปีเก่าไม่ได้อยู่ในปีใหม่
  const changeYear = (nextYear) => {
    setYear(nextYear);
    const first = rounds
      .filter(r => r.academic_year === nextYear)
      .sort((a, b) => a.attempt_number - b.attempt_number)[0];
    if (first) setRoundId(first.round_id);
  };

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      // ไฟล์ PDF ต้อง login ก่อน — fetch เป็น blob เองพร้อม credentials แทนใช้ <a href> ตรงๆ
      const res = await fetch(`http://localhost:3000/api/dashboard/export?round_id=${roundId}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || tt('reportsReal.pdfFailMsg'));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `exam-report-${stats.round.attempt_number}-${stats.round.academic_year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setDownloading(false);
    }
  };

  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>{tt('statuspage.loadFailPrefix', { msg: error })}</div>;
  if (!stats) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>{tt('common.loading')}</div>;

  const { round, total, by, not_started, submitted, fullyPassed, overallPassRate, perSubject } = stats;
  const summaryCards = [
    [tt('reports.totalStudents'), total, 'navy'],
    [tt('reports.submitted'), submitted, 'blue'],
    [tt('reports.fullyPassed'), fullyPassed, 'ok'],
    [tt('reports.overallRate'), overallPassRate + '%', 'gold'],
  ];
  const byStatus = [
    ['CONFIRMED', by.approved], ['SUBMITTED', by.submitted], ['REJECTED', by.rejected], ['DRAFT', not_started],
  ];

  return (
    <div className="fade-up">
      <PageHead title={tt('reports.title')} sub={tt('reportsReal.roundSlash', { attempt: round.attempt_number, year: round.academic_year })}
        actions={<div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* เลือกปี + รอบ ที่จะดูและ export — รายงานบนจอกับไฟล์ PDF เป็นรอบเดียวกันเสมอ */}
          <select className="input" value={year ?? ''} onChange={e => changeYear(Number(e.target.value))}
            style={{ width: 'auto', padding: '8px 30px 8px 12px', flex: 'none' }} aria-label={tt('reportsReal.pickYear')}>
            {yearOptions.map(y => <option key={y} value={y}>{tt('dashReal.yearOption', { year: y })}</option>)}
          </select>
          <select className="input" value={roundId ?? ''} onChange={e => setRoundId(Number(e.target.value))}
            style={{ width: 'auto', padding: '8px 30px 8px 12px', flex: 'none' }} aria-label={tt('reportsReal.pickRound')}>
            {roundsInYear.map(r => (
              <option key={r.round_id} value={r.round_id}>{tt('dashReal.roundOnlyLabel', { attempt: r.attempt_number })}</option>
            ))}
          </select>
          <button className="btn btn-ghost" onClick={() => window.print()}><Icon name="printer" size={16} /> {tt('reports.printBtn')}</button>
          {!readonly && <button className="btn btn-primary" disabled={downloading} onClick={downloadPdf}><Icon name="pdf" size={16} /> {downloading ? tt('reportsReal.generating') : tt('reportsReal.downloadPdfBtn')}</button>}
        </div>} />

      <div className="card" style={{ padding: '34px 40px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 18, borderBottom: '2px solid var(--navy-700)' }}>
          <Logo size={48} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy-700)' }}>{tt('reports.headerTitle')}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>{tt('reportsReal.roundSlash', { attempt: round.attempt_number, year: round.academic_year })}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--ink-500)' }}>{tt('reports.issuedLabel')}<br />{new Date().toLocaleDateString('th-TH')}</div>
        </div>

        <div className="sec-title" style={{ margin: '24px 0 12px', color: 'var(--ink-900)' }}>{tt('reports.section1')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {summaryCards.map(([label, v, tone]) => (
            <div key={label} style={{ padding: '14px 16px 14px 22px', background: '#fff', borderRadius: 11, border: '1px solid var(--ink-200)', borderLeft: '6px solid ' +
              ({ navy: 'var(--navy-700)', blue: 'var(--blue-600)', ok: 'var(--pass)', gold: 'var(--gold-500)' }[tone]) }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink-500)', fontWeight: 600 }}>{label}</div>
              <div className="tnum" style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* ตัวเลข 2 ตัวที่คณะส่งสภาการพยาบาล — เป็นตัวเลขระดับปี ไม่ใช่ระดับรอบ
            วางไว้ต่อจากสรุปภาพรวมเพราะเป็นตัวเลขหลักที่คนอ่านรายงานมองหาก่อน */}
        {yearStats && (
          <>
            <div className="sec-title" style={{ margin: '26px 0 12px', color: 'var(--ink-900)' }}>{tt('reportsReal.councilSection')}</div>
            <div style={{ border: '1px solid var(--ink-200)', borderRadius: 11, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', background: 'var(--ink-50, #fafafa)', fontSize: 12.5, color: 'var(--ink-600)' }}>
                {tt('reportsReal.councilDenominator', { year: yearStats.academic_year, total: yearStats.total })}
              </div>
              {[
                [tt('reportsReal.councilFirstAttempt'), yearStats.firstAttempt, tt('reportsReal.councilFirstAttemptNote')],
                [tt('reportsReal.councilFirstYear'), yearStats.firstYear, tt('reportsReal.councilFirstYearNote')],
              ].map(([label, val, note], i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px',
                  borderTop: i === 0 ? '1px solid var(--ink-200)' : '1px solid var(--ink-100)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{note}</div>
                  </div>
                  <div className="tnum" style={{ fontSize: 13, color: 'var(--ink-600)', flex: 'none' }}>
                    {val.passed} / {yearStats.total}
                  </div>
                  <div className="tnum" style={{ fontSize: 24, fontWeight: 800, flex: 'none', minWidth: 96, textAlign: 'right' }}>
                    {val.rate.toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="sec-title" style={{ margin: '26px 0 12px', color: 'var(--ink-900)' }}>{tt('reports.section2')}</div>
        <table className="tbl" style={{ border: '1px solid var(--ink-200)', borderRadius: 10, overflow: 'hidden' }}>
          <thead><tr><th>{tt('reports.colStatus')}</th><th style={{ textAlign: 'right' }}>{tt('reports.colCount')}</th><th style={{ textAlign: 'right' }}>{tt('reports.colPercent')}</th></tr></thead>
          <tbody>{byStatus.map(([k, n]) => (
            <tr key={k}><td><StatusBadge status={k} lang={lang} /></td>
              <td className="tnum" style={{ textAlign: 'right', fontWeight: 700 }}>{n}</td>
              <td className="tnum" style={{ textAlign: 'right', color: 'var(--ink-600)' }}>{total ? Math.round(n / total * 100) : 0}%</td></tr>
          ))}</tbody>
        </table>

        <div className="sec-title" style={{ margin: '26px 0 12px', color: 'var(--ink-900)' }}>{tt('reports.section3')}</div>
        <table className="tbl" style={{ border: '1px solid var(--ink-200)', borderRadius: 10, overflow: 'hidden' }}>
          <thead><tr><th>{tt('reports.colCode')}</th><th>{tt('reports.colSubject')}</th><th style={{ textAlign: 'right' }}>{tt('reports.colPass')}</th><th style={{ textAlign: 'right' }}>{tt('reports.colFail')}</th><th style={{ textAlign: 'right' }}>{tt('reports.colPassRate')}</th></tr></thead>
          <tbody>{perSubject.map(s => (
            <tr key={s.subject_id}><td className="mono">{s.subject_code}</td>
              <td style={{ fontWeight: 500 }}>{subjectName(lang, s.subject_code, s.subject_name)}</td>
              <td className="tnum" style={{ textAlign: 'right', color: 'var(--pass)', fontWeight: 700 }}>{s.pass}</td>
              <td className="tnum" style={{ textAlign: 'right', color: 'var(--fail)', fontWeight: 700 }}>{s.fail}</td>
              {/* rate = null คือไม่มีใครสอบวิชานี้ในรอบนี้ ต้องขึ้นขีด ไม่ใช่ 0% ที่แปลว่าสอบแล้วตกหมด */}
              <td style={{ textAlign: 'right' }}>{s.rate === null
                ? <span className="badge" style={{ background: 'var(--ink-100)', color: 'var(--ink-500)' }}>—</span>
                : <span className="badge" style={{ background: s.rate >= 80 ? 'var(--status-ok-bg)' : s.rate >= 60 ? 'var(--gold-50)' : 'var(--status-reject-bg)', color: s.rate >= 80 ? 'var(--status-ok-fg)' : s.rate >= 60 ? '#3a2c05' : 'var(--status-reject-fg)' }}>{s.rate}%</span>}</td></tr>
          ))}</tbody>
        </table>

        {/* ตารางจำแนกจำนวนวิชาที่ผ่าน — รูปแบบเดียวกับที่คณะส่งสภาการพยาบาล */}
        {yearStats?.passDistribution?.total > 0 && (
          <>
            <div className="sec-title" style={{ margin: '26px 0 12px', color: 'var(--ink-900)' }}>{tt('reportsReal.distSection')}</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl" style={{ border: '1px solid var(--ink-200)', borderRadius: 10, overflow: 'hidden' }}>
                <thead><tr>
                  <th>{tt('dashReal.distColResult')}</th>
                  {yearStats.passDistribution.rooms.map(r => (
                    <th key={r.room_id} style={{ textAlign: 'right' }}>{roomName(lang, r.room_name)} ({r.total})</th>
                  ))}
                  <th style={{ textAlign: 'right' }}>{tt('dashReal.distColTotal')} ({yearStats.passDistribution.total})</th>
                </tr></thead>
                <tbody>{yearStats.passDistribution.rows.filter(r => r.count > 0).map(row => (
                  <tr key={row.label === 'not_submitted' ? 'ns' : row.passed}>
                    <td style={{ fontWeight: 600, color: row.label === 'not_submitted' ? 'var(--ink-500)' : 'inherit' }}>
                      {row.label === 'not_submitted' ? tt('dashReal.distRowNotSubmitted') : tt('dashReal.distRowLabel', { n: row.passed })}
                    </td>
                    {row.byRoom.map(c => (
                      <td key={c.room_id} className="tnum" style={{ textAlign: 'right' }}>{c.count} <span style={{ color: 'var(--ink-500)' }}>({c.rate.toFixed(2)}%)</span></td>
                    ))}
                    <td className="tnum" style={{ textAlign: 'right', fontWeight: 700 }}>{row.count} <span style={{ color: 'var(--ink-500)', fontWeight: 400 }}>({row.rate.toFixed(2)}%)</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--ink-500)' }}>{tt('dashReal.distFootnote', { total: yearStats.passDistribution.total })}</p>
          </>
        )}
      </div>
    </div>
  );
}
