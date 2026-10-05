/* ============================================================
   รายงานสรุปผลสอบ "ฉบับผู้บริหาร" — ข้อมูลจริงจาก backend
   ต่างจากรายงานของเจ้าหน้าที่ (reportsReal.jsx) ตรงที่:
     - เป็นระดับ "ปีการศึกษา" ไม่มีตัวเลือกรอบ
     - ไม่มีเรื่องงานของเจ้าหน้าที่ (สถานะการตรวจ, ส่งแล้วกี่ใบ, ยังไม่เริ่มกรอก) และไม่มีรายชื่อรายบุคคล
     - มีเฉพาะตัวเลขที่ผู้บริหารใช้ตัดสินใจ: อัตราผ่านครั้งแรก/ภายในปีแรก เทียบย้อนหลัง รายวิชา
   ใช้ GET /api/dashboard/history ตัวเดียวกับหน้า Dashboard ตัวเลขจึงตรงกับที่เห็นบนหน้าแดชบอร์ดเสมอ
   ปุ่ม "ดาวน์โหลด PDF" ถ่ายจากกล่องรายงานบนจอ ทำฝั่งเบราว์เซอร์ ไม่เรียก endpoint ของเจ้าหน้าที่
   ============================================================ */
import { useState, useEffect, useRef } from 'react';
import { Icon } from './data.jsx';
import { PageHead, FirstAttemptSubjectTable, Select, Loading } from './components.jsx';
import { PassDistribution } from './dashboardReal.jsx';
import { Logo } from './logos.jsx';
import { apiFetch } from './api.js';
import { saveElementAsPdf } from './exportReportPdf.js';
import { t } from './i18n.js';

// ร้อยละ 2 ตำแหน่ง — ค่าที่ไม่มี (ไม่มีผู้ยืนยัน) ขึ้นขีด ไม่ใช่ 0%
const showRate = (value) => (value === null || value === undefined ? '—' : value.toFixed(2) + '%');

export function ExecutiveReport({ toast, lang }) {
  const tt = (key, vars) => t(lang, key, vars);
  const [history, setHistory] = useState(null);
  const [year, setYear] = useState(null);
  const [error, setError] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const reportRef = useRef(null); // กล่องรายงาน — ปุ่ม "ดาวน์โหลด PDF" ถ่ายจากกล่องนี้

  // โหลดสรุปรายปีครั้งเดียว แล้วตั้งปีเริ่มต้นเป็นปีล่าสุด
  useEffect(() => {
    apiFetch('/dashboard/history?years=20')
      .then(data => {
        setHistory(data);
        if (data.years.length > 0) {
          const newest = Math.max(...data.years.map(y => y.academic_year));
          setYear(newest);
        }
      })
      .catch(e => setError(e.message));
  }, []);

  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>{tt('statuspage.loadFailPrefix', { msg: error })}</div>;
  if (!history) return <Loading label={tt('common.loading')} />;
  if (history.years.length === 0 || year === null) {
    return (
      <div className="fade-up">
        <PageHead title={tt('execReport.title')} />
        <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--ink-500)' }}>{tt('execReport.noData')}</div>
      </div>
    );
  }

  const yearOptions = history.years.map(y => y.academic_year).sort((a, b) => b - a);
  const yearStats = history.years.find(y => y.academic_year === year);
  // ตารางเทียบย้อนหลัง = ปีที่เลือก + อีกไม่เกิน 2 ปีก่อนหน้า (เรียงใหม่ → เก่า)
  const trendYears = history.years
    .filter(y => y.academic_year <= year)
    .sort((a, b) => b.academic_year - a.academic_year)
    .slice(0, 3);
  const prevYear = history.years.find(y => y.academic_year === year - 1);
  const firstDelta = prevYear ? yearStats.firstAttempt.rate - prevYear.firstAttempt.rate : null;
  // ครั้งที่สอบเรียงจากครั้งแรกไปครั้งหลัง
  const attempts = [...yearStats.rounds].sort((a, b) => a.attempt_number - b.attempt_number);
  const pending = yearStats.statusByStudent ? yearStats.statusByStudent.submitted : 0;

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      await saveElementAsPdf(reportRef.current, `executive-report-${year}.pdf`);
    } catch (e) {
      toast(e.message || tt('reportsReal.downloadPdfBtn'), 'error');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="fade-up">
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <PageHead title={tt('execReport.title')} sub={tt('dashReal.yearOption', { year })}
          actions={<div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Select className="input" value={year} onChange={v => setYear(Number(v))} lang={lang}
              style={{ width: 'auto', padding: '8px 30px 8px 12px', flex: 'none' }} ariaLabel={tt('reportsReal.pickYear')}
              options={yearOptions.map(y => ({ value: y, label: tt('dashReal.yearOption', { year: y }) }))} />
            <button className="btn btn-ghost" onClick={() => window.print()}><Icon name="printer" size={16} /> {tt('reports.printBtn')}</button>
            <button className="btn btn-primary" disabled={pdfBusy} onClick={downloadPdf}>
              <Icon name="pdf" size={16} /> {pdfBusy ? tt('common.loading') : tt('reportsReal.downloadPdfBtn')}</button>
          </div>} />
      </div>

      <div className="card report-sheet" ref={reportRef} style={{ padding: '34px 40px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 18, borderBottom: '2px solid var(--navy-700)' }}>
          <Logo size={48} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy-700)' }}>{tt('execReport.headerTitle')}</div>
            <div style={{ fontSize: 15, color: 'var(--ink-500)' }}>{tt('dashReal.yearOption', { year })}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 14, color: 'var(--ink-500)' }}>{tt('reports.issuedLabel')}<br />{new Date().toLocaleDateString('th-TH')}</div>
        </div>

        {/* ตัวเลข "ผ่าน" ทุกตัวนับเฉพาะใบที่ยืนยันแล้ว — ถ้ายังมีใบรอตรวจ บอกจำนวนไว้ในรายงานเลย */}
        <div style={{ margin: '14px 0 0', fontSize: 14, color: 'var(--ink-500)' }}>
          {pending > 0
            ? <b style={{ color: 'var(--status-wait-fg)' }}>{tt('dashReal.pendingNotice', { n: pending })}</b>
            : tt('dashReal.confirmedOnlyNote')}
        </div>

        {/* 1. ตัวเลขหลัก — 2 ตัวที่คณะส่งสภาการพยาบาล ตัวหารคือนักศึกษาทั้งรุ่น */}
        <div className="sec-title" style={{ margin: '24px 0 12px', color: 'var(--ink-900)' }}>{tt('execReport.sectionKey')}</div>
        <div style={{ border: '1px solid var(--ink-200)', borderRadius: 11, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: 'var(--ink-50, #fafafa)', fontSize: 14.5, color: 'var(--ink-600)' }}>
            {tt('reportsReal.councilDenominator', { year, total: yearStats.total })}
          </div>
          {[
            [tt('reportsReal.councilFirstAttempt'), yearStats.firstAttempt, tt('reportsReal.councilFirstAttemptNote')],
            [tt('reportsReal.councilFirstYear'), yearStats.firstYear, tt('reportsReal.councilFirstYearNote')],
          ].map(([label, val, note]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', borderTop: '1px solid var(--ink-200)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 14, color: 'var(--ink-500)', marginTop: 2 }}>{note}</div>
              </div>
              <div className="tnum" style={{ fontSize: 15, color: 'var(--ink-600)', flex: 'none' }}>{val.passed} / {yearStats.total}</div>
              <div className="tnum" style={{ fontSize: 26, fontWeight: 800, flex: 'none', minWidth: 96, textAlign: 'right' }}>{val.rate.toFixed(2)}%</div>
            </div>
          ))}
        </div>
        {firstDelta !== null && (
          <div style={{ marginTop: 8, fontSize: 14.5, color: firstDelta >= 0 ? 'var(--status-ok-fg)' : 'var(--status-reject-fg)', fontWeight: 600 }}>
            {tt('execReport.deltaLine', { year: year - 1 })} {firstDelta >= 0 ? '▲' : '▼'} {Math.abs(firstDelta).toFixed(2)}
          </div>
        )}

        {/* 2. อัตราสอบผ่านแยกตามครั้งที่สอบ — ตัวหารคือผู้ที่ยืนยันแล้วของครั้งนั้น (คนละตัวหารกับข้อ 1) */}
        <div className="sec-title" style={{ margin: '26px 0 6px', color: 'var(--ink-900)' }}>{tt('execReport.sectionAttempts')}</div>
        <div style={{ fontSize: 14, color: 'var(--ink-500)', marginBottom: 10 }}>{tt('execReport.attemptsNote')}</div>
        <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
          <table className="tbl" style={{ border: '1px solid var(--ink-200)', borderRadius: 10, overflow: 'hidden' }}>
          <thead><tr>
            <th>{tt('execReport.colAttempt')}</th>
            <th style={{ textAlign: 'right' }}>{tt('execReport.colConfirmed')}</th>
            <th style={{ textAlign: 'right' }}>{tt('execReport.colPassedAll')}</th>
            <th style={{ textAlign: 'right' }}>{tt('reports.colPassRate')}</th>
          </tr></thead>
          <tbody>{attempts.map(r => (
            <tr key={r.round_id}>
              <td style={{ fontWeight: 600 }}>{tt('dashReal.attemptLabel', { n: r.attempt_number })}</td>
              <td className="tnum" style={{ textAlign: 'right' }}>{r.confirmed}</td>
              <td className="tnum" style={{ textAlign: 'right' }}>{r.fullyPassed}</td>
              <td className="tnum" style={{ textAlign: 'right', fontWeight: 700 }}>{showRate(r.confirmed ? (r.fullyPassed / r.confirmed) * 100 : null)}</td>
            </tr>
          ))}</tbody>
        </table>
        </div>

        {/* 3. เทียบย้อนหลัง — เห็นแนวโน้มว่าดีขึ้นหรือแย่ลง */}
        <div className="sec-title" style={{ margin: '26px 0 12px', color: 'var(--ink-900)' }}>{tt('execReport.sectionTrend')}</div>
        <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
          <table className="tbl" style={{ border: '1px solid var(--ink-200)', borderRadius: 10, overflow: 'hidden' }}>
          <thead><tr>
            <th>{tt('execReport.colYear')}</th>
            <th style={{ textAlign: 'right' }}>{tt('execReport.colCohort')}</th>
            <th style={{ textAlign: 'right' }}>{tt('reportsReal.councilFirstAttempt')}</th>
            <th style={{ textAlign: 'right' }}>{tt('reportsReal.councilFirstYear')}</th>
          </tr></thead>
          <tbody>{trendYears.map(y => (
            <tr key={y.academic_year}>
              <td style={{ fontWeight: y.academic_year === year ? 700 : 500 }}>{tt('dashReal.yearOption', { year: y.academic_year })}</td>
              <td className="tnum" style={{ textAlign: 'right' }}>{y.total}</td>
              <td className="tnum" style={{ textAlign: 'right', fontWeight: 700 }}>{showRate(y.firstAttempt.rate)}</td>
              <td className="tnum" style={{ textAlign: 'right', fontWeight: 700 }}>{showRate(y.firstYear.rate)}</td>
            </tr>
          ))}</tbody>
        </table>
        </div>

        {/* 4. ผลสอบผ่านครั้งแรก จำแนกรายวิชา — ตารางเดียวกับหน้าแดชบอร์ด */}
        {yearStats.firstAttemptBySubject && (
          <div style={{ marginTop: 26 }}>
            <FirstAttemptSubjectTable data={yearStats.firstAttemptBySubject} year={year} lang={lang} />
          </div>
        )}

        {/* 5. จำแนกตามจำนวนวิชาที่ผ่าน แยกห้อง — ตารางเดียวกับหน้าแดชบอร์ด */}
        <div style={{ marginTop: 26 }}>
          <PassDistribution year={yearStats} lang={lang} tt={tt} />
        </div>
      </div>
    </div>
  );
}
