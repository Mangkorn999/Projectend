/* ============================================================
   รายงานสรุปผลสอบ (officer + executive) — ข้อมูลจริงจาก backend
   แทนที่ Reports เดิมใน executive.jsx ที่ใช้ mock STUDENTS + ปุ่ม export ปลอม
   ใช้ GET /api/dashboard/stats ตัวเดียวกับหน้า Dashboard (เนื้อหารายงานตรงกับที่เห็นบนจอเสมอ)
   ปุ่ม "ดาวน์โหลด PDF" แคปกล่องรายงานบนจอเป็นไฟล์ PDF ฝั่งเบราว์เซอร์ (exportReportPdf.js) ไม่เรียก backend — ผู้บริหารก็โหลดได้
   ส่วนไฟล์รายชื่อ/ข้อมูลนักศึกษาในแผง "ส่งออกข้อมูล" (officer เท่านั้น) เรียก endpoint ของ backend แล้วได้ไฟล์ Excel/PDF กลับมา
   ============================================================ */
import { useState, useEffect, useRef } from 'react';
import { Icon } from './data.jsx';
import { PageHead, StatusBadge, FirstAttemptSubjectTable, Select, ExportMenu, Loading, Empty } from './components.jsx';
import { Logo } from './logos.jsx';
import { apiFetch, downloadFile } from './api.js';
import { saveElementAsPdf } from './exportReportPdf.js';
import { downloadFirstYearList } from './yearExports.js';
import { SubjectResultModal } from './subjectResultModal.jsx';
import { t, subjectName, roomName } from './i18n.js';

export function ReportsReal({ toast, readonly, lang }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  // รายชื่อผ่าน/ไม่ผ่านรายวิชา — คลิกตัวเลขในตาราง "ผลรายวิชา" ด้านล่างแล้วเปิดหน้าต่างรายชื่อ
  // (หน้าต่างเป็น component กลางใน subjectResultModal.jsx ใช้ร่วมกับแดชบอร์ด)
  const [subjectModal, setSubjectModal] = useState(null); // { subjectCode, subjectName, passed } | null
  const tt = (key, vars) => t(lang, key, vars);
  const reportRef = useRef(null); // กล่องรายงาน — ปุ่ม "ดาวน์โหลด PDF" ถ่ายจากกล่องนี้

  // ตัวเลขที่ส่งสภาการพยาบาลเป็นระดับปีการศึกษา ไม่ใช่ระดับรอบ — ต้องดึงสรุปรายปีมาคู่กัน
  const [history, setHistory] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [year, setYear] = useState(null);
  const [roundId, setRoundId] = useState(null); // รอบที่รายงานนี้แสดง = รอบที่จะ export
  const [roundsLoaded, setRoundsLoaded] = useState(false); // โหลดรายการรอบเสร็จแล้ว (ใช้แยก "ยังโหลดอยู่" กับ "ยังไม่มีรอบเลย")

  // โหลดรายการรอบ + สรุปย้อนหลัง แล้วตั้งค่าเริ่มต้นเป็นรอบที่เปิดรับอยู่ (ไม่มีก็รอบล่าสุด)
  useEffect(() => {
    Promise.all([apiFetch('/rounds'), apiFetch('/dashboard/history?years=3')])
      .then(([roundList, hist]) => {
        setRounds(roundList);
        setHistory(hist);
        setRoundsLoaded(true);
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

  // รายงานสรุปของรอบที่เลือก (PDF) — ปุ่มบนหัวหน้าที่เดียว
  // ได้ไฟล์ที่หน้าตาเหมือนรายงานบนจอเป๊ะ (ถ่ายจากกล่องรายงานที่เห็นอยู่) ไม่ใช่ PDF จาก backend อีกแบบหนึ่ง
  const [pdfBusy, setPdfBusy] = useState(false);
  const downloadReportPdf = async () => {
    setPdfBusy(true);
    try {
      await saveElementAsPdf(reportRef.current,
        `exam-report-${stats.round.attempt_number}-${stats.round.academic_year}.pdf`);
    }
    catch (e) { toast(e.message || tt('reportsReal.downloadPdfBtn'), 'error'); }
    finally { setPdfBusy(false); }
  };

  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>{tt('statuspage.loadFailPrefix', { msg: error })}</div>;
  // โหลดรายการรอบเสร็จแล้วแต่ไม่มีรอบเลย → บอกตรงๆ ไม่ใช่หมุนโหลดค้าง (ไม่มีรอบ = ไม่มี stats ให้รอ)
  if (roundsLoaded && rounds.length === 0) {
    return (
      <div className="fade-up">
        <PageHead title={tt('reports.title')} />
        <div className="card card-pad">
          <Empty icon="report" title={tt('dashReal.noRoundTitle')} sub={tt('reportsReal.noRoundSub')} />
        </div>
      </div>
    );
  }
  if (!stats) return <Loading label={tt('common.loading')} />;

  const { round, total, by, submitted,
          fullyPassed, fullyPassedRate, passRateOfSitters, confirmed, perSubject,
          roundTotal, roundNotStarted, roundFillRate, alreadyPassed } = stats;
  // การ์ด "นักศึกษาทั้งหมด" = ทั้งรุ่น · การ์ด "ส่งผลแล้ว" หารด้วยผู้ต้องกรอกรอบนี้ (roundTotal) ให้ตรงกับตารางสถานะด้านล่าง
  // บรรทัดเล็ก "ผู้ต้องกรอกรอบนี้ N คน" ก็ใช้ roundTotal (ไม่ใช่ canSubmit) ให้เลขเดียวกับหน้าแดชบอร์ดและตารางสถานะ
  // การ์ด "ผ่านครบ" หารด้วยทั้งรุ่น (สูตรผ่านของรุ่น) และใบสุดท้ายติดป้ายบอกตัวหารไว้ในชื่อแล้ว
  const summaryCards = [
    [tt('reports.totalStudents'), total, tt('reportsReal.cardTotalSub', { n: roundTotal }), 'navy'],
    [tt('reports.submitted'), submitted, tt('reportsReal.cardOfRound', { rate: roundFillRate }), 'blue'],
    // จำนวนวิชาเอาจากรอบจริง (perSubject = วิชาของรอบนั้น) ไม่ใช่ 8 ตายตัว — รอบที่สอบ 3 วิชาจะได้ไม่ขึ้น "ผ่านครบ 8 วิชา"
    [tt('reports.fullyPassed', { n: perSubject.length }), fullyPassed, tt('reportsReal.cardOfCohort', { rate: fullyPassedRate }), 'ok'],
    // confirmed = 0 → ยังไม่มีผลสอบที่ยืนยัน ไม่มีฐานให้หาร ขึ้น "—" ไม่ใช่ 0% (0% แปลว่าสอบแล้วตกหมด)
    [tt('reportsReal.cardSitterRate'), confirmed > 0 ? passRateOfSitters + '%' : '—', tt('reportsReal.cardSitterRateSub', { n: confirmed }), 'gold'],
  ];
  // 5 แถวนี้บวกกันได้เท่า roundTotal (ผู้ต้องกรอกรอบนี้) พอดี — คนที่ผ่านครบจากรอบก่อนไม่ต้องกรอกรอบนี้ จึงไม่อยู่ในฐาน
  // (บอกจำนวนไว้ใต้ตารางด้วย alreadyPassed)
  const byStatus = [
    ['CONFIRMED', tt('status.CONFIRMED'), by.approved],
    ['SUBMITTED', tt('status.SUBMITTED'), by.submitted],
    ['REJECTED', tt('status.REJECTED'), by.rejected],
    ['DRAFT', tt('dashReal.draftLabel'), by.draft],
    ['NONE', tt('dashReal.notStartedLabel'), roundNotStarted],
  ];

  // แผง "ส่งออกข้อมูล" — รวมทุกไฟล์ที่ส่งออกได้ของปี/รอบที่เลือกไว้ที่เดียว (เดิมกระจายอยู่หลายหน้า)
  // ไฟล์ผ่าน/ไม่ผ่านครั้งแรกใช้กฎเดียวกับตัวเลข "ร้อยละผู้สอบผ่านในครั้งแรก" ในรายงานนี้ (ผ่าน + ไม่ผ่าน = ทั้งรุ่น)
  const exportYear = round.academic_year;
  const firstAttemptItems = (passed) => ['xlsx', 'pdf'].map(format => ({
    key: format, label: tt(format === 'xlsx' ? 'export.excel' : 'export.pdf'), icon: format === 'xlsx' ? 'report' : 'pdf',
    run: () => downloadFile(`/dashboard/export-first-attempt?year=${exportYear}&passed=${passed}&format=${format}`,
      { filename: `รายชื่อนักศึกษา${passed ? 'ผ่านครั้งแรก' : 'ไม่ผ่านครั้งแรก'}-${exportYear}.${format}` }),
  }));
  // ผ่าน / ไม่ผ่าน "ภายในปีแรก" (รวมรอบ 2-3) — กฎเดียวกับตัวเลข "ร้อยละผู้สอบผ่านภายในปีแรก" ในรายงานนี้
  const firstYearItems = (passed) => {
    const items = [];
    for (const format of ['xlsx', 'pdf']) {
      let label = tt('export.pdf');
      let icon = 'pdf';
      if (format === 'xlsx') {
        label = tt('export.excel');
        icon = 'report';
      }
      items.push({ key: format, label, icon, run: () => downloadFirstYearList(exportYear, passed, format) });
    }
    return items;
  };
  const exportRows = [
    { key: 'pass', title: tt('export.rowFirstPass', { year: exportYear }), sub: tt('export.rowFirstPassSub'), items: firstAttemptItems(true) },
    { key: 'fail', title: tt('export.rowFirstFail', { year: exportYear }), sub: tt('export.rowFirstFailSub'), items: firstAttemptItems(false) },
    { key: 'yearPass', title: tt('export.rowFirstYearPass', { year: exportYear }), sub: tt('export.rowFirstYearPassSub'), items: firstYearItems(true) },
    { key: 'yearFail', title: tt('export.rowFirstYearFail', { year: exportYear }), sub: tt('export.rowFirstYearFailSub'), items: firstYearItems(false) },
    { key: 'students', title: tt('export.rowStudents', { year: exportYear }), items: [
      {
        key: 'xlsx', label: tt('export.studentsExcel'), icon: 'report',
        run: () => downloadFile('/students/export', { method: 'POST', body: { year: exportYear }, filename: `ข้อมูลนักศึกษา-รุ่น ${exportYear}.xlsx` }),
      },
      {
        key: 'byRound', label: tt('export.studentsByRoundExcel'), icon: 'report',
        run: () => downloadFile('/students/export', { method: 'POST', body: { year: exportYear, by_round: true }, filename: `ข้อมูลนักศึกษา-รุ่น ${exportYear}-แยกรอบ.xlsx` }),
      },
    ] },
  ];

  return (
    <div className="fade-up">
      {/* หัวหน้ากว้างเท่าการ์ดด้านล่าง (900) ไม่งั้นชื่ออยู่ซ้ายสุดจอ ปุ่มอยู่ขวาสุดจอ ห่างจากเนื้อหาที่อยู่กลาง */}
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <PageHead title={tt('reports.title')} sub={tt('reportsReal.roundSlash', { attempt: round.attempt_number, year: round.academic_year })}
        actions={<div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* เลือกปี + รอบ ที่จะดูและ export — รายงานบนจอกับไฟล์ PDF เป็นรอบเดียวกันเสมอ */}
          <Select className="input" value={year ?? ''} onChange={v => changeYear(Number(v))} lang={lang}
            style={{ width: 'auto', padding: '8px 30px 8px 12px', flex: 'none' }} ariaLabel={tt('reportsReal.pickYear')}
            options={yearOptions.map(y => ({ value: y, label: tt('dashReal.yearOption', { year: y }) }))} />
          <Select className="input" value={roundId ?? ''} onChange={v => setRoundId(Number(v))} lang={lang}
            style={{ width: 'auto', padding: '8px 30px 8px 12px', flex: 'none' }} ariaLabel={tt('reportsReal.pickRound')}
            options={roundsInYear.map(r => ({ value: r.round_id,
              label: tt('dashReal.roundOnlyLabel', { attempt: r.attempt_number }) }))} />
          <button className="btn btn-ghost" onClick={() => window.print()}><Icon name="printer" size={16} /> {tt('reports.printBtn')}</button>
          {/* ดาวน์โหลดไฟล์ PDF ของรายงานด้านล่างเลย ไม่เปิดหน้าต่างพิมพ์ — ผู้บริหาร (readonly) ก็โหลดได้ เพราะทำฝั่งเบราว์เซอร์ ไม่เรียก endpoint ของเจ้าหน้าที่ */}
          <button className="btn btn-primary" disabled={pdfBusy} onClick={downloadReportPdf}>
            <Icon name="pdf" size={16} /> {pdfBusy ? tt('common.loading') : tt('reportsReal.downloadPdfBtn')}</button>
        </div>} />
      </div>

      {!readonly && (
        <div className="card no-print" style={{ maxWidth: 900, margin: '0 auto 16px', padding: '18px 24px' }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{tt('export.panelTitle')}</div>
          <div style={{ color: 'var(--ink-500)', fontSize: 14.5, margin: '2px 0 8px' }}>{tt('export.panelSub', { year: exportYear })}</div>
          {exportRows.map(row => (
            <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderTop: '1px solid var(--ink-100)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>{row.title}</div>
                {row.sub && <div style={{ color: 'var(--ink-500)', fontSize: 14 }}>{row.sub}</div>}
              </div>
              <ExportMenu items={row.items} tt={tt} align="right" onError={msg => toast(msg, 'error')} style={{ width: 128 }} />
            </div>
          ))}
        </div>
      )}

      <div className="card report-sheet" ref={reportRef} style={{ padding: '34px 40px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 18, borderBottom: '2px solid var(--navy-700)' }}>
          <Logo size={48} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy-700)' }}>{tt('reports.headerTitle')}</div>
            <div style={{ fontSize: 15, color: 'var(--ink-500)' }}>{tt('reportsReal.roundSlash', { attempt: round.attempt_number, year: round.academic_year })}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 14, color: 'var(--ink-500)' }}>{tt('reports.issuedLabel')}<br />{new Date().toLocaleDateString('th-TH')}</div>
        </div>

        {/* ตัวเลข "ผ่าน" ทุกตัวในรายงานนับเฉพาะใบที่ยืนยันแล้ว — ถ้ายังมีใบรอตรวจ บอกจำนวนไว้ในรายงานเลย (พิมพ์ออกไปก็เห็น) */}
        <div style={{ margin: '14px 0 0', fontSize: 14, color: 'var(--ink-500)' }}>
          {by.submitted > 0
            ? <b style={{ color: 'var(--status-wait-fg)' }}>{tt('dashReal.pendingNotice', { n: by.submitted })}</b>
            : tt('dashReal.confirmedOnlyNote')}
        </div>

        <div className="sec-title" style={{ margin: '24px 0 12px', color: 'var(--ink-900)' }}>{tt('reports.section1')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {summaryCards.map(([label, v, sub, tone]) => (
            <div key={label} style={{ padding: '14px 16px 14px 22px', background: '#fff', borderRadius: 11, border: '1px solid var(--ink-200)', borderLeft: '6px solid ' +
              ({ navy: 'var(--navy-700)', blue: 'var(--blue-600)', ok: 'var(--pass)', gold: 'var(--gold-500)' }[tone]) }}>
              <div style={{ fontSize: 14.5, color: 'var(--ink-500)', fontWeight: 600 }}>{label}</div>
              <div className="tnum" style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{v}</div>
              {/* บอกตัวหารไว้ใต้ตัวเลขทุกใบ — ไม่งั้น % 2 ตัวที่หารคนละฐานดูเหมือนเทียบกันได้ */}
              <div style={{ fontSize: 13.5, color: 'var(--ink-500)', marginTop: 3, lineHeight: 1.45 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ตัวเลข 2 ตัวที่คณะส่งสภาการพยาบาล — เป็นตัวเลขระดับปี ไม่ใช่ระดับรอบ
            วางไว้ต่อจากสรุปภาพรวมเพราะเป็นตัวเลขหลักที่คนอ่านรายงานมองหาก่อน */}
        {yearStats && (
          <>
            <div className="sec-title" style={{ margin: '26px 0 12px', color: 'var(--ink-900)' }}>{tt('reportsReal.councilSection')}</div>
            <div style={{ border: '1px solid var(--ink-200)', borderRadius: 11, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', background: 'var(--ink-50, #fafafa)', fontSize: 14.5, color: 'var(--ink-600)' }}>
                {tt('reportsReal.councilDenominator', { year: yearStats.academic_year, total: yearStats.total })}
              </div>
              {[
                [tt('reportsReal.councilFirstAttempt'), yearStats.firstAttempt, tt('reportsReal.councilFirstAttemptNote')],
                [tt('reportsReal.councilFirstYear'), yearStats.firstYear, tt('reportsReal.councilFirstYearNote')],
              ].map(([label, val, note], i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px',
                  borderTop: i === 0 ? '1px solid var(--ink-200)' : '1px solid var(--ink-100)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{label}</div>
                    <div style={{ fontSize: 14, color: 'var(--ink-500)', marginTop: 2 }}>{note}</div>
                  </div>
                  <div className="tnum" style={{ fontSize: 15, color: 'var(--ink-600)', flex: 'none' }}>
                    {val.passed} / {yearStats.total}
                  </div>
                  <div className="tnum" style={{ fontSize: 26, fontWeight: 800, flex: 'none', minWidth: 96, textAlign: 'right' }}>
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
          <tbody>{byStatus.map(([k, label, n]) => (
            <tr key={k}>
              {/* "ยังไม่เริ่มกรอก" ไม่ใช่สถานะของใบผลสอบ (ยังไม่มีใบ) เลยไม่มี badge ให้ใช้ */}
              <td>{k === 'NONE' ? <span style={{ color: 'var(--ink-500)' }}>{label}</span> : <StatusBadge status={k} lang={lang} />}</td>
              <td className="tnum" style={{ textAlign: 'right', fontWeight: 700 }}>{n}</td>
              <td className="tnum" style={{ textAlign: 'right', color: 'var(--ink-600)' }}>{roundTotal ? (Math.round(n / roundTotal * 10000) / 100).toFixed(2) : '0.00'}%</td></tr>
          ))}</tbody>
        </table>
        {alreadyPassed > 0 && (
          <div style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--ink-500)' }}>{tt('dashReal.alreadyPassedNote', { n: alreadyPassed })}</div>
        )}

        <div className="sec-title" style={{ margin: '26px 0 12px', color: 'var(--ink-900)' }}>{tt('reports.section3')}</div>
        <table className="tbl" style={{ border: '1px solid var(--ink-200)', borderRadius: 10, overflow: 'hidden' }}>
          <thead><tr><th>{tt('reports.colCode')}</th><th>{tt('reports.colSubject')}</th><th style={{ textAlign: 'right' }}>{tt('reports.colPass')}</th><th style={{ textAlign: 'right' }}>{tt('reports.colFail')}</th><th style={{ textAlign: 'right' }}>{tt('reports.colPassRate')}</th></tr></thead>
          <tbody>{perSubject.map(s => {
            const openList = (passed) => setSubjectModal({
              subjectCode: s.subject_code, subjectName: s.subject_name, passed,
            });
            // คลิกได้เฉพาะ officer (readonly = ผู้บริหาร ไม่มีสิทธิ์ดูรายชื่อรายบุคคล) และต้องมีคนอย่างน้อย 1 คน
            return (
            <tr key={s.subject_id}><td className="mono">{s.subject_code}</td>
              <td style={{ fontWeight: 500 }}>{subjectName(lang, s.subject_code, s.subject_name)}</td>
              <td className="tnum" style={{ textAlign: 'right' }}>
                {!readonly && s.pass > 0
                  ? <button className="badge-link" onClick={() => openList(true)} style={{ background: 'none', border: 'none', color: 'var(--pass)', fontWeight: 700, fontSize: 'inherit', fontFamily: 'inherit', padding: 0 }}>{s.pass}</button>
                  : <span style={{ color: 'var(--pass)', fontWeight: 700 }}>{s.pass}</span>}
              </td>
              <td className="tnum" style={{ textAlign: 'right' }}>
                {!readonly && s.fail > 0
                  ? <button className="badge-link" onClick={() => openList(false)} style={{ background: 'none', border: 'none', color: 'var(--fail)', fontWeight: 700, fontSize: 'inherit', fontFamily: 'inherit', padding: 0 }}>{s.fail}</button>
                  : <span style={{ color: 'var(--fail)', fontWeight: 700 }}>{s.fail}</span>}
              </td>
              {/* rate = null คือไม่มีใครสอบวิชานี้ในรอบนี้ ต้องขึ้นขีด ไม่ใช่ 0% ที่แปลว่าสอบแล้วตกหมด */}
              <td style={{ textAlign: 'right' }}>{s.rate === null
                ? <span className="badge" style={{ background: 'var(--ink-100)', color: 'var(--ink-500)' }}>—</span>
                : <span className="badge" style={{ background: s.rate >= 80 ? 'var(--status-ok-bg)' : s.rate >= 60 ? 'var(--gold-50)' : 'var(--status-reject-bg)', color: s.rate >= 80 ? 'var(--status-ok-fg)' : s.rate >= 60 ? '#3a2c05' : 'var(--status-reject-fg)' }}>{s.rate}%</span>}</td></tr>
            );
          })}</tbody>
        </table>
        {/* คำแนะนำสำหรับคนดูบนจอเท่านั้น — no-print ซ่อนตอนพิมพ์และตอนบันทึก PDF */}
        {!readonly && <div className="no-print" style={{ fontSize: 13.5, color: 'var(--ink-500)', marginTop: 6 }}>{tt('reportsReal.subjectClickHint')}</div>}

        {/* ตารางรายวิชาของการสอบรอบแรก — ตัวหารเป็นนักศึกษาทั้งรุ่น คนละตัวกับตารางด้านบน
            ตารางด้านบนเป็นระดับ "รอบที่เลือก" ตารางนี้เป็นระดับ "ปี/รอบแรก" จึงต้องอยู่แยกกัน ไม่ใช่แก้ของเดิม */}
        {yearStats?.firstAttemptBySubject && (
          <div style={{ marginTop: 26 }}>
            <FirstAttemptSubjectTable data={yearStats.firstAttemptBySubject} year={year} lang={lang} />
          </div>
        )}

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
            <p style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--ink-500)' }}>{tt('dashReal.distFootnote', { total: yearStats.passDistribution.total })}</p>
          </>
        )}
      </div>

      {/* รายชื่อผ่าน/ไม่ผ่านรายวิชาของรอบที่เลือก — component กลางตัวเดียวกับแดชบอร์ด */}
      {subjectModal && (
        <SubjectResultModal target={subjectModal} scope={{ roundId }} onClose={() => setSubjectModal(null)}
          lang={lang} tt={tt} toast={toast} />
      )}
    </div>
  );
}
