/* ============================================================
   Dashboard สรุปผลสอบ (officer + executive) — ข้อมูลจริงจาก backend
   แทนที่ OfficerDashboard/ExecutiveDashboard เดิมที่ใช้ mock STUDENTS/TREND
   ดึงจาก GET /api/dashboard/stats (คำนวณรวมฝั่ง backend อยู่แล้ว ไม่คำนวณซ้ำฝั่ง frontend)
   + GET /api/dashboard/history สำหรับเทียบย้อนหลังรายปี
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { phaseOf, phaseLabel, phaseBadgeClass } from './roundPhase.js';
import { SkeletonDashboard } from './skeletons.jsx';
import { PageHead, StatCard, Donut, BarRow, MultiLineChart, MultiBarChart, ColumnChart, Modal, Empty,
  FirstAttemptSubjectTable, Select } from './components.jsx';
import { apiFetch } from './api.js';
import { t, subjectName, roomName } from './i18n.js';
import { SubjectResultModal } from './subjectResultModal.jsx';

/* แท็บ "รวมทั้งปี" — ค่าคงที่ตัวเดียวใช้ทั้งไฟล์ จะได้ไม่พิมพ์ string ซ้ำแล้วสะกดต่างกัน */
const ALL_ROUNDS = 'all';

/* แท็บที่ตัวเลขเป็นระดับ "ทั้งรุ่น/รอบแรก" ไม่ได้ผูกกับรอบที่เลือก — มีให้กดเฉพาะตอน "รวมทั้งปี" */
const YEAR_ONLY_TABS = ['firstBySubject', 'firstCount'];

export function DashboardReal({ go, readonly, lang, setStudentsFilter, restoreView, onRestoreConsumed, toast }) {
  const tt = (key, vars) => t(lang, key, vars);
  // คลิก "ผ่าน/ไม่ผ่าน" ในการ์ดอัตราผ่านรายวิชา — เปิดหน้าต่างรายชื่อนักศึกษาของวิชานั้นบนแดชบอร์ดเลย ไม่ต้องเปลี่ยนหน้า
  // (หน้าต่างเป็น component กลางใน subjectResultModal.jsx ตัวเดียวกับหน้ารายงานสรุป)
  // จำขอบเขตที่ดูอยู่ ณ ตอนกดไว้ใน target: แท็บ "รวมทั้งปี" = ทั้งปี, แท็บรอบ = รอบนั้น
  const [subjectTarget, setSubjectTarget] = useState(null); // { subjectCode, subjectName, passed, scope } | null
  const openSubjectList = (subjectCode, passed, subjectFullName) => {
    let scope = { roundId: Number(tab) };
    if (tab === ALL_ROUNDS) {
      scope = { year };
    }
    setSubjectTarget({ subjectCode, subjectName: subjectFullName, passed, scope });
  };
  // ปุ่ม "ดูรายชื่อ" ในการ์ดร้อยละผ่านครั้งแรกย้อนหลัง — targetYear เป็นปีของการ์ดที่กด ไม่ใช่ year (ตัวเลือกบนสุด) เพราะการ์ดนี้อยู่นอกโซนที่ผูกกับ year
  const goToFirstAttemptStudents = (targetYear, passed) => {
    setStudentsFilter?.({ kind: 'firstAttempt', year: targetYear, passed, tab, mainTab });
    go('students');
  };
  const [rounds, setRounds] = useState([]);
  const [history, setHistory] = useState(null);
  const [year, setYear] = useState(null); // ปีการศึกษาที่กำลังดู
  // ปีของโซน "สถิติเชิงรายงาน" แยกอิสระจาก year ด้านบน — ไม่ผูกกับที่เลือกบนสุด/RoundTabs
  // ติ๊กเลือกได้สูงสุด 3 ปี จากทั้งหมดที่มีจริง (ตัวเลือกปีด้านบนก็แสดงทุกปีเหมือนกัน แต่เลือกทีละปี)
  const [reportYears, setReportYears] = useState([]);
  const [tab, setTab] = useState(ALL_ROUNDS); // ALL_ROUNDS = รวมทั้งปี, ไม่งั้นเป็น round_id
  // แท็บบนสุด 3 อัน แทนที่การเรียง Donut/อัตราผ่านรายวิชา/สถิติเชิงรายงานต่อกันเป็นแถวยาวแบบเดิม
  // ค่าเริ่มต้นอ่านจาก restoreView ถ้ามี (กลับมาจากปุ่ม "กลับไปหน้าแดชบอด" ที่หน้านักศึกษา)
  const [mainTab, setMainTab] = useState(() => restoreView?.mainTab || 'status'); // 'status' | 'subjects' | 'firstBySubject' | 'firstCount' | 'reports'
  // แท็บย่อยใน "สถิติเชิงรายงาน" — ไม่ขึ้นกับรอบที่เลือก อิงปีที่เลือกจาก yearPicker เท่านั้น
  const [reportTab, setReportTab] = useState('firstRate'); // 'firstRate' | 'firstCount' | 'subjectHistory' | 'fullPass'
  const [stats, setStats] = useState(null); // สถิติของรอบที่เลือก (ใช้เฉพาะตอนไม่ใช่ "รวมทั้งปี")
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // อัตราผ่านรายวิชาย้อนหลัง ต้องใช้แค่ผลรอบแรก (attempt_number=1) ของแต่ละปีเท่านั้น ไม่รวมรอบถัดไป —
  // history.years[].perSubject รวมทุกรอบของปี ใช้ไม่ได้ตรงนี้ เลยต้องยิง /dashboard/stats?round_id= แยกทีละรอบแรกของแต่ละปี
  const [firstRoundSubjects, setFirstRoundSubjects] = useState({}); // { [academic_year]: perSubject[] }

  // โหลดครั้งแรก — รายการรอบ/สรุปย้อนหลัง/แจ้งเตือน ไม่เปลี่ยนตามรอบที่เลือก โหลดรอบเดียวพอ
  useEffect(() => {
    Promise.all([
      apiFetch('/rounds'),
      // ดึงย้อนหลังยาวๆ ไว้ก่อน (เผื่อมีเป็น 10 ปี) จะได้ติ๊กเลือกปีเก่าๆ ในโซนรายงานได้ครบ ไม่ใช่แค่ 3 ปีล่าสุด
      apiFetch('/dashboard/history?years=20'),
    ])
      .then(([roundList, hist]) => {
        setRounds(roundList);
        setHistory(hist);

        // ปีตั้งต้น = ปีของรอบที่เปิดรับอยู่ ไม่มีก็ปีล่าสุดที่มีรอบ
        // มาจากปุ่ม "กลับไปหน้าแดชบอด" ที่หน้านักศึกษา ใช้ปี/รอบที่ค้างไว้ตอนกดออกไปแทน
        const openRound = roundList.find(r => r.status === 'open');
        const newestYear = roundList.length
          ? Math.max(...roundList.map(r => r.academic_year))
          : null;
        setYear(restoreView?.year ?? (openRound ? openRound.academic_year : newestYear));
        // ค่าเริ่มต้นโซนรายงาน = 3 ปีล่าสุดที่มีข้อมูลจริง (เหมือนเดิมก่อนมีติ๊กเลือก)
        setReportYears(hist.years.map(y => y.academic_year).sort((a, b) => b - a).slice(0, 3));

        // เจ้าหน้าที่เปิดมาเพื่อดูรอบที่กำลังเปิดรับก่อน ผู้บริหารดูภาพรวมทั้งปี
        if (restoreView?.tab) setTab(restoreView.tab);
        else if (!readonly && openRound) setTab(String(openRound.round_id));
        if (restoreView) onRestoreConsumed?.();

        const round1ByYear = new Map();
        roundList.forEach(r => { if (r.attempt_number === 1) round1ByYear.set(r.academic_year, r.round_id); });
        return Promise.all(
          [...round1ByYear.entries()].map(([y, rid]) =>
            apiFetch(`/dashboard/stats?round_id=${rid}`).then(s => [y, s.perSubject]))
        );
      })
      .then(pairs => setFirstRoundSubjects(Object.fromEntries(pairs)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [readonly]);

  // โหลดสถิติของรอบที่เลือก — แท็บ "รวมทั้งปี" ใช้ตัวเลขรายปีจาก history อยู่แล้ว ไม่ต้องยิงเพิ่ม
  // ล้าง stats เก่าทิ้งก่อนเสมอ ไม่งั้นจะเห็นตัวเลขของรอบก่อนหน้าค้างอยู่แวบหนึ่งตอนสลับแท็บ
  useEffect(() => {
    if (tab === ALL_ROUNDS) return;
    let dropped = false;
    apiFetch(`/dashboard/stats?round_id=${tab}`)
      .then(data => { if (!dropped) setStats(data); })
      .catch(e => { if (!dropped) setError(e.message); });
    return () => { dropped = true; };
  }, [tab]);

  // เปลี่ยนปี = กลับไปแท็บ "รวมทั้งปี" เสมอ เพราะ round_id ของปีเก่าใช้กับปีใหม่ไม่ได้
  const changeYear = (nextYear) => {
    setYear(nextYear);
    setTab(ALL_ROUNDS);
  };

  // เลือกรอบเดียวขณะเปิดแท็บที่มีเฉพาะ "รวมทั้งปี" อยู่ ต้องเด้งกลับแท็บแรก
  // ไม่งั้นปุ่มหายไปแต่ mainTab ยังค้างค่าเดิม เนื้อหาข้างล่างเลยว่างเปล่า
  const changeRoundTab = (nextTab) => {
    setTab(nextTab);
    if (nextTab !== ALL_ROUNDS && YEAR_ONLY_TABS.includes(mainTab)) setMainTab('status');
  };

  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>{tt('statuspage.loadFailPrefix', { msg: error })}</div>;
  if (loading && !history) return <div className="fade-up"><SkeletonDashboard /></div>;
  // ยังไม่มีรอบสอบสักรอบในระบบ — บอกให้รู้ว่าไม่ใช่โหลดพลาด แต่ยังไม่มีข้อมูลจริงๆ
  if (!history || year === null || rounds.length === 0) {
    return (
      <div className="fade-up">
        <PageHead title={tt('dashReal.title')} />
        <div className="card card-pad">
          <Empty icon="calendar" title={tt('dashReal.noRoundTitle')}
            sub={readonly ? tt('dashReal.noRoundSubReadonly') : tt('dashReal.noRoundSub')} />
        </div>
      </div>
    );
  }

  // ทุกปีที่มีรอบอยู่จริง เรียงใหม่→เก่า — ใช้เป็นตัวเลือกปี ทั้งฝั่งเจ้าหน้าที่และผู้บริหาร
  // ไม่ตัดแค่ 3 ปี: สร้างรอบของปีใหม่เมื่อไหร่ ปีนั้นก็โผล่ในรายการเองโดยไม่ต้องแก้โค้ด
  // (เดิมตัดไว้ 3 ปีล่าสุด ปีเก่าอย่าง 2565-2567 เลยเลือกดูไม่ได้ ทั้งที่มีข้อมูลอยู่)
  const yearOptions = [...new Set(rounds.map(r => r.academic_year))]
    .sort((a, b) => b - a);
  const openRound = rounds.find(r => r.status === 'open');
  const currentYear = openRound ? openRound.academic_year : yearOptions[0];

  // ทุกรอบของปีที่เลือก เรียงตามครั้งที่สอบ — ใช้ทำแท็บ
  const roundsInYear = rounds
    .filter(r => r.academic_year === year)
    .sort((a, b) => a.attempt_number - b.attempt_number);

  // สรุปรายปีของปีที่เลือก (มาจาก /dashboard/history คำนวณฝั่ง backend แล้ว)
  const yearSummary = history.years.find(y => y.academic_year === year) || null;
  const showingRound = tab !== ALL_ROUNDS && stats && String(stats.round.round_id) === tab;

  const yearPicker = (
    <Select className="input" value={year} onChange={v => changeYear(Number(v))} lang={lang}
      style={{ width: 'auto', maxWidth: '100%', padding: '8px 30px 8px 12px', flex: 'none' }}
      ariaLabel={tt('dashReal.roundSelectLabel')}
      options={yearOptions.map(y => ({ value: y,
        label: y === currentYear ? tt('dashReal.currentYearOption', { year: y }) : tt('dashReal.yearOption', { year: y }) }))} />
  );

  // ปีของโซน "สถิติเชิงรายงาน" เท่านั้น — แยกจาก yearPicker บนสุด ไม่กระทบ/ไม่ถูกกระทบจากกัน
  // ติ๊กเลือกได้จากทุกปีที่มีข้อมูลจริง (ไม่ใช่แค่ 3 ปีล่าสุด) แต่เลือกพร้อมกันได้สูงสุด 3 ปี
  const allReportYears = [...history.years].map(y => y.academic_year).sort((a, b) => b - a);
  const reportYearPicker = (
    <YearMultiPicker years={allReportYears} selected={reportYears} onChange={setReportYears}
      currentYear={currentYear} tt={tt} max={3} />
  );
  const reportHistory = { ...history, years: history.years.filter(y => reportYears.includes(y.academic_year)) };

  // ใบรอตรวจของสิ่งที่กำลังดู — เจ้าหน้าที่ดูตามแท็บที่เลือก (รอบเดียว/รวมทั้งปี) ผู้บริหารดูภาพรวมทั้งปีอย่างเดียว
  const pendingCount = (!readonly && showingRound) ? stats.by.submitted : (yearSummary?.statusByStudent?.submitted ?? 0);

  return (
    <div className="fade-up">
      <PageHead
        title={tt('dashReal.title')}
        sub={yearSummary ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {tt('dashReal.subYear', { year })} <span style={{ color: 'var(--ink-200)' }}>|</span>
            <Icon name="users" size={15} /> {yearSummary.total}
            {yearSummary.pending_accounts > 0 && <span title={tt('dashReal.subPendingHint')}>{tt('dashReal.subPending', { n: yearSummary.pending_accounts })}</span>}
            <span style={{ color: 'var(--ink-400)', fontSize: 20, fontWeight: 700, lineHeight: 0 }}>·</span>
            {tt('dashReal.subEligible', { eligible: yearSummary.eligible })}
          </span>
        ) : null}
        actions={yearPicker} />

      <PendingNotice n={pendingCount} go={readonly ? null : go} tt={tt} />

      {/* ─── โซน 2: ผลการกรอกของรอบที่เลือก ─────────────────────────
          เจ้าหน้าที่เท่านั้น — ผู้บริหารดูภาพรวมทั้งปีอย่างเดียว ไม่ต้องไล่ทีละรอบ
          RoundTabs ยังคุมว่าดูรอบไหน/รวมทั้งปี — StatCard+RoundBar ผูกกับรอบที่เลือกเหมือนเดิม
          ส่วน Donut/อัตราผ่านรายวิชา/สถิติเชิงรายงาน ย้ายไปอยู่ใต้แท็บบนสุด 3 อันแทนเรียงเป็นแถวยาว */}
      {!readonly && (
        <Section title={tt('dashReal.zoneRound')}>
          <RoundTabs rounds={roundsInYear} value={tab} onChange={changeRoundTab} tt={tt} />

          <div key={tab} className="blur-in">
            {tab === ALL_ROUNDS
              ? <YearRoundsView year={yearSummary} rounds={roundsInYear} lang={lang} tt={tt} statCardsOnly />
              : showingRound
                ? <RoundView stats={stats} roundInfo={rounds.find(r => String(r.round_id) === tab)}
                    go={go} lang={lang} tt={tt} statCardsOnly />
                : <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--ink-500)', fontSize: 15.5 }}>{tt('common.loading')}</div>}
          </div>

          {/* 2 แท็บกลางเป็นตัวเลข "รอบแรกของทั้งรุ่น" ไม่ได้ผูกกับรอบที่เลือกเลย
              โผล่ตอนดูรอบเดียวจะหลอกตา (กดรอบ 2 อยู่ แต่ตัวเลขเป็นของรอบแรก) เลยให้ขึ้นเฉพาะแท็บ "รวมทั้งปี" */}
          <MainTabs value={mainTab} onChange={setMainTab} tt={tt} items={[
            { key: 'status', label: tt('dashReal.statusBreakdownTitle') },
            { key: 'subjects', label: tt('dashReal.subjectRateTitle') },
            ...(tab === ALL_ROUNDS ? [
              { key: 'firstBySubject', label: tt('firstBySubject.title') },
              { key: 'firstCount', label: tt('dashReal.distTitle') },
            ] : []),
            { key: 'reports', label: tt('dashReal.reportSectionTitle') },
          ]} />

          <div key={mainTab} className="blur-in">
            {mainTab === 'status' && (
              tab === ALL_ROUNDS
                ? (yearSummary?.statusByStudent
                    // มุมมองรวมทั้งปีนับเป็น "คน" (ใบล่าสุดของแต่ละคน) backend คำนวณมาให้แล้ว
                    // เอา by ของแต่ละรอบมาบวกกันเองไม่ได้ นั่นเป็นจำนวนใบ คนที่กรอก 2 รอบจะถูกนับซ้ำจนเกิน 100%
                    ? <StatusDonut total={yearSummary.total} by={yearSummary.statusByStudent}
                        not_started={yearSummary.statusByStudent.not_started} perStudent tt={tt} />
                    : <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--ink-500)', fontSize: 15.5 }}>{tt('common.loading')}</div>)
                : showingRound && <RoundView stats={stats} roundInfo={rounds.find(r => String(r.round_id) === tab)} go={go} lang={lang} tt={tt} statusOnly />
            )}

            {mainTab === 'subjects' && (
              tab === ALL_ROUNDS
                ? <SubjectRateCard perSubject={yearSummary?.perSubject || []} lang={lang} tt={tt} title={tt('dashReal.subjectRateYearTitle')} onSubjectClick={readonly ? undefined : openSubjectList} />
                : showingRound && <SubjectRateCard perSubject={stats.perSubject} subjectPassRate={stats.subjectPassRate} lang={lang} tt={tt} onSubjectClick={readonly ? undefined : openSubjectList} />
            )}

            {/* 2 แท็บนี้มีให้กดเฉพาะตอน "รวมทั้งปี" (ดู items ของ MainTabs ข้างบน)
                และ changeRoundTab เด้งกลับ 'status' ให้เองถ้าสลับไปดูรอบเดียวขณะเปิดค้างอยู่
                จึงไม่ต้องเช็ค tab ซ้ำตรงนี้อีก */}
            {mainTab === 'firstBySubject' && (
              <FirstAttemptSubjectTable data={yearSummary?.firstAttemptBySubject} year={year} lang={lang} />
            )}

            {mainTab === 'firstCount' && <PassDistribution year={yearSummary} lang={lang} tt={tt} />}

            {mainTab === 'reports' && (
              <div style={{ marginTop: 4 }}>
                <p style={{ margin: '0 0 14px', color: 'var(--ink-500)', fontSize: 15 }}>{tt('dashReal.reportSectionMultiYearSub')}</p>
                <MainTabs value={reportTab} onChange={setReportTab} tt={tt} items={[
                  { key: 'firstRate', label: tt('dashReal.firstAttemptTitle') },
                  { key: 'subjectHistory', label: tt('dashReal.subjectHistoryTitle') },
                  { key: 'fullPass', label: tt('dashReal.colFullPass') },
                ]} />
                <div key={reportTab} className="blur-in" style={{ marginTop: 14 }}>
                  {reportTab === 'firstRate' && <FirstAttemptPassRate history={reportHistory} tt={tt} wide yearPicker={reportYearPicker} onViewStudents={goToFirstAttemptStudents} />}
                  {reportTab === 'subjectHistory' && <SubjectHistoryChart history={reportHistory} firstRoundSubjects={firstRoundSubjects} tt={tt} yearPicker={reportYearPicker} />}
                  {reportTab === 'fullPass' && <YearCompare history={reportHistory} lang={lang} tt={tt} yearPicker={reportYearPicker} />}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ─── โซนผู้บริหาร: ตัวเลขทางการของปีที่เลือก (hero + กราฟรายครั้งที่สอบ) ─── */}
      {readonly && yearSummary && (
        <ExecutiveOverview year={yearSummary} history={history}
          lang={lang} tt={tt} />
      )}
      {readonly && (
        <Section title={tt('dashReal.reportSectionTitle')}>
          <MainTabs value={reportTab} onChange={setReportTab} tt={tt} items={[
            { key: 'firstRate', label: tt('dashReal.firstAttemptTitle') },
            { key: 'firstBySubject', label: tt('firstBySubject.title') },
            { key: 'firstCount', label: tt('dashReal.distTitle') },
            { key: 'subjectHistory', label: tt('dashReal.subjectHistoryTitle') },
            { key: 'fullPass', label: tt('dashReal.colFullPass') },
          ]} />
          <div key={reportTab} className="blur-in" style={{ marginTop: 14 }}>
            {reportTab === 'firstRate' && <FirstAttemptPassRate history={reportHistory} tt={tt} wide yearPicker={reportYearPicker} />}
            {reportTab === 'firstBySubject' && (
              <FirstAttemptSubjectTable data={yearSummary?.firstAttemptBySubject} year={year} lang={lang} />
            )}
            {reportTab === 'firstCount' && <PassDistribution year={yearSummary} lang={lang} tt={tt} />}
            {reportTab === 'subjectHistory' && <SubjectHistoryChart history={reportHistory} firstRoundSubjects={firstRoundSubjects} tt={tt} yearPicker={reportYearPicker} />}
            {reportTab === 'fullPass' && <YearCompare history={reportHistory} lang={lang} tt={tt} yearPicker={reportYearPicker} />}
          </div>
        </Section>
      )}

      {/* รายชื่อผ่าน/ไม่ผ่านรายวิชา — เจ้าหน้าที่เท่านั้น (ผู้บริหารไม่มีตัวเลขให้กดอยู่แล้ว) */}
      {subjectTarget && !readonly && (
        <SubjectResultModal target={subjectTarget} scope={subjectTarget.scope} onClose={() => setSubjectTarget(null)}
          lang={lang} tt={tt} toast={toast} />
      )}
    </div>
  );
}

/* แท็บทั่วไป ใช้ได้ทั้งแท็บบนสุด 3 อันและแท็บย่อยใน "สถิติเชิงรายงาน" — ต่างจาก RoundTabs ตรงไม่มี dot สถานะเปิด/ปิด */
function MainTabs({ items, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
      {items.map(item => {
        const active = value === item.key;
        return (
          <button key={item.key} onClick={() => onChange(item.key)} className="btn btn-sm"
            style={{ fontFamily: 'inherit', fontWeight: 700, padding: '7px 14px',
              background: active ? 'var(--navy-700)' : '#fff',
              color: active ? '#fff' : 'var(--ink-700)',
              border: `1px solid ${active ? 'var(--navy-700)' : 'var(--ink-200)'}` }}>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/* ติ๊กเลือกปีที่จะดูได้หลายปี (สูงสุด max ปี) จากทุกปีที่มีข้อมูลจริง — ไม่ใช่ dropdown เลือกทีละปีแบบ yearPicker บนสุด
   ปุ่มโชว์สรุปจำนวนที่เลือก กดแล้วเปิด popover ให้ติ๊ก, ติ๊กครบ max แล้วช่องที่เหลือจะกดไม่ได้จนกว่าจะติ๊กออกก่อน */
function YearMultiPicker({ years, selected, onChange, currentYear, tt, max = 3 }) {
  const [open, setOpen] = useState(false);
  // ต้องเหลืออย่างน้อย 1 ปีเสมอ
  // เดิมติ๊กออกได้หมด → selected = [] → reportHistory.years ว่าง → กราฟขึ้น "ไม่มีข้อมูล"
  // ผู้ใช้เห็นแล้วนึกว่าพัง (ที่จริงคือไม่ได้เลือกปีไหนเลย) และไม่มีทางกลับมาได้นอกจากไปติ๊กใหม่
  const isLastSelected = (y) => selected.includes(y) && selected.length === 1;
  const toggle = (y) => {
    if (selected.includes(y)) {
      if (selected.length === 1) return; // ปีสุดท้าย เอาออกไม่ได้
      onChange(selected.filter(x => x !== y));
    } else if (selected.length < max) {
      onChange([...selected, y].sort((a, b) => b - a));
    }
  };
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(o => !o)}
        style={{ border: '1px solid var(--ink-200)', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
        {[...selected].sort((a, b) => b - a).join(' / ') || tt('dashReal.yearPickerSummary', { n: 0 })}
        <Icon name="chevD" size={14} />
      </button>
      {open && <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setOpen(false)}></div>
        <div className="card fade-up" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: 200,
          zIndex: 51, boxShadow: 'var(--sh-lg)', padding: 10 }}>
          <div style={{ fontSize: 13.5, color: 'var(--ink-500)', padding: '2px 6px 8px' }}>{tt('dashReal.yearPickerMax', { max })}</div>
          {years.map(y => {
            const checked = selected.includes(y);
            // ติ๊กออกไม่ได้ 2 กรณี: เลือกครบ max แล้ว (ติ๊กเพิ่มไม่ได้) · เป็นปีสุดท้ายที่เหลือ (ติ๊กออกไม่ได้)
            const atMax = !checked && selected.length >= max;
            const lastOne = isLastSelected(y);
            const disabled = atMax || lastOne;
            return (
              <label key={y}
                title={lastOne ? tt('dashReal.yearPickerKeepOne') : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 6px', borderRadius: 8,
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: atMax ? .45 : 1, fontSize: 15.5 }}>
                <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(y)}
                  style={{ accentColor: 'var(--navy-700)' }} />
                {y === currentYear ? tt('dashReal.currentYearOption', { year: y }) : tt('dashReal.yearOption', { year: y })}
              </label>
            );
          })}
          {selected.length === 1 && (
            <div style={{ fontSize: 13, color: 'var(--ink-400)', padding: '6px 6px 2px', lineHeight: 1.45 }}>
              {tt('dashReal.yearPickerKeepOne')}
            </div>
          )}
        </div>
      </>}
    </div>
  );
}

/* หัวข้อคั่นโซน — ทุกโซนหน้าตาเหมือนกันหมด อ่านแล้วรู้ทันทีว่ากำลังดูกลุ่มไหน */
function Section({ title, sub, children }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        {/* กำหนดสีเอง ไม่ปล่อย inherit — หัวข้อโซนนี้อยู่บนพื้น canvas ไม่ได้อยู่ในการ์ด
            ถ้าไม่ระบุ จะไปรับสีจาก element แม่แล้วจางจนอ่านไม่ออกในบางหน้า */}
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, flex: 'none', color: 'var(--ink-900)' }}>{title}</h2>
        {sub && <span style={{ fontSize: 14.5, color: 'var(--ink-500)', flex: 'none' }}>{sub}</span>}
        <div style={{ height: 1, background: 'var(--ink-100)', flex: 1 }} />
      </div>
      {children}
    </div>
  );
}

/* แท็บเลือกรอบ — เรียงตามครั้งที่สอบ ปิดท้ายด้วย "รวมทั้งปี"
   ใช้แท็บแทน dropdown เพราะจำนวนรอบต่อปีมีไม่กี่รอบ กดทีเดียวถึง ไม่ต้องเปิดเมนู */
function RoundTabs({ rounds, value, onChange, tt }) {
  const items = [
    ...rounds.map(r => ({
      key: String(r.round_id),
      label: tt('dashReal.roundOnlyLabel', { attempt: r.attempt_number }),
      open: r.status === 'open',
    })),
    { key: ALL_ROUNDS, label: tt('dashReal.tabAllRounds'), open: false },
  ];

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      {items.map(item => {
        const active = value === item.key;
        return (
          <button key={item.key} onClick={() => onChange(item.key)} className="btn btn-sm"
            style={{ fontFamily: 'inherit', fontWeight: 700, padding: '7px 14px',
              background: active ? 'var(--navy-700)' : '#fff',
              color: active ? '#fff' : 'var(--ink-700)',
              border: `1px solid ${active ? 'var(--navy-700)' : 'var(--ink-200)'}` }}>
            {item.label}
            {item.open && <span className="dot" style={{ marginLeft: 6, background: active ? '#7fe0a8' : 'var(--status-ok-dot)' }} />}
          </button>
        );
      })}
    </div>
  );
}

/* มุมมองรอบเดียว — ตัวเลขทุกตัวเป็นของรอบนั้นล้วน ไม่มีของปีอื่นปน */
// statCardsOnly = แค่แถบวันปิดรับ+การ์ดตัวเลข 5 ใบ (โชว์เสมอไม่ว่าอยู่แท็บไหน)
// statusOnly = แค่การ์ด Donut สัดส่วนสถานะ (ใช้ตอนอยู่แท็บ "สัดส่วนสถานะการตรวจสอบ")
// ไม่ส่ง flag ไหนมาเลย = คืน null (เรียกแบบไม่ระบุจะไม่ได้อะไร กันเรียกผิดเงียบๆ)
function RoundView({ stats, roundInfo, go, lang, tt, statCardsOnly, statusOnly }) {
  const { round, total, by, submitted,
          fullyPassed, fullyPassedRate, roundTotal, roundNotStarted, roundFillRate,
          alreadyPassed } = stats;

  if (statCardsOnly) {
    return (
      <>
        {/* แถบความคืบหน้าหารด้วย "คนของรอบนี้" (roundTotal) — ข้อมูลรุ่น (ทั้งรุ่น/เปิดสิทธิ์) อยู่ที่หัวหน้าแล้ว ไม่ซ้ำในแถบนี้ */}
        <RoundBar round={round} roundInfo={roundInfo} submitted={submitted}
          fillRate={roundFillRate} roundTotal={roundTotal} tt={tt} />

        <div className="grid g-5" style={{ marginBottom: 20 }}>
          {/* ยอดของ "รอบนี้" ล้วน — คนที่ผ่านครบทุกวิชาไปแล้วเปิดฟอร์มรอบนี้ไม่ได้ ตัวเลขเลยลดลงทุกรอบ
              ต่างจากการ์ดใบแรกของมุมมองทั้งปีที่เป็นยอดทั้งรุ่น ตำแหน่ง/หน้าตาการ์ดเหมือนกันทั้ง 2 มุมมอง
              ใช้ roundTotal (ไม่ใช่ canSubmit) ให้เลข "ผู้ต้องกรอกรอบนี้" ตรงกับกลางโดนัทและตัวหารของแถบความคืบหน้า
              — canSubmit ไม่นับคนที่ถูกถอนสิทธิ์หลังส่งผลไปแล้ว แต่ใบของเขายังอยู่ในรอบ ตัวเลขเลยเคยไม่ตรงกัน */}
          <StatCard icon="users" label={tt('dashReal.canSubmitStatLabel')} value={roundTotal} sub={tt('dashReal.canSubmitStatSub', { total })} tone="navy" accent onClick={() => go('students')} />
          <StatCard icon="edit" label={tt('dashReal.submittedStatLabel')} value={submitted} sub={tt('dashReal.submittedStatSub', { rate: roundFillRate })} tone="blue" accent onClick={() => go('students')} />
          <StatCard icon="clock" label={tt('status.SUBMITTED')} value={by.submitted} sub={tt('dashReal.pendingSub')} tone="wait" accent onClick={() => go('review')} />
          <StatCard icon="checkCircle" label={tt('status.CONFIRMED')} value={by.approved} sub={tt('dashReal.confirmedSub', { n: fullyPassed, rate: fullyPassedRate })} tone="ok" accent />
          <StatCard icon="xCircle" label={tt('status.REJECTED')} value={by.rejected} sub={tt('dashReal.rejectedSub')} tone="reject" accent onClick={() => go('review')} />
        </div>
      </>
    );
  }

  // โดนัทรายรอบนับเฉพาะคนของรอบนี้ — คนที่ผ่านครบแล้วไม่ต้องกรอก แจ้งเป็นบรรทัดข้อมูลแยก ไม่เอาเข้าวง
  if (statusOnly) {
    return <StatusDonut total={roundTotal} by={by} not_started={roundNotStarted}
      centerLabel={tt('dashReal.roundPeopleLabel')} alreadyPassed={alreadyPassed} tt={tt} />;
  }

  return null;
}

/* การ์ด Donut สัดส่วนสถานะ — ใช้ทั้งมุมมองรอบเดียว (RoundView) และรวมทั้งปี
   perStudent = ตัวเลขที่ส่งมาเป็น "คน" (ใบล่าสุดของแต่ละคน) ไม่ใช่ "ใบ" — ต่างกันแค่ป้ายกำกับ
   ทั้งสองแบบ 5 ช่องบวกกันได้เท่า total พอดี % จึงไม่มีทางเกิน 100 */
function StatusDonut({ total, by, not_started, perStudent, centerLabel, alreadyPassed, tt }) {
  const segs = [
    { key: 'CONFIRMED', label: tt('status.CONFIRMED'), value: by.approved, color: 'var(--status-ok-dot)' },
    { key: 'SUBMITTED', label: tt('status.SUBMITTED'), value: by.submitted, color: 'var(--status-wait-dot)' },
    { key: 'REJECTED', label: tt('status.REJECTED'), value: by.rejected, color: 'var(--status-reject-dot)' },
    { key: 'DRAFT', label: tt('dashReal.draftLabel'), value: by.draft, color: 'var(--ink-200)' },
    { key: 'NONE', label: tt('dashReal.notStartedLabel'), value: not_started, color: 'var(--ink-300)' },
  ].filter(s => s.value > 0 || s.key !== 'DRAFT');

  const papers = by.draft + by.submitted + by.approved + by.rejected; // ใบที่มีอยู่จริงในระบบ
  const reviewed = by.approved + by.rejected;                          // เจ้าหน้าที่ตรวจไปแล้ว
  const reviewRate = papers ? Math.round((reviewed / papers) * 10000) / 100 : 0;
  const pct = (n) => (total ? Math.round((n / total) * 10000) / 100 : 0);

  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{tt('dashReal.statusBreakdownTitle')}</h3>
        {/* มุมมองรวมปีนับเป็น "คน" ต้องบอก — มุมมองรายรอบไม่ต้องมีข้อความกำกับ */}
        {perStudent && <span style={{ fontSize: 14, color: 'var(--ink-400)' }}>{tt('dashReal.statusOfStudents')}</span>}
      </div>

      {/* donut ซ้าย + รายการสถานะขวาแบบเต็มความกว้าง — เดิมรายการชิดซ้ายจนเหลือที่ว่างครึ่งการ์ด
          ตอนนี้แต่ละสถานะมีแถบสัดส่วนของตัวเอง ที่ว่างเลยกลายเป็นข้อมูลแทน */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', marginTop: 16 }}>
        <Donut segments={segs} center={<><div className="tnum" style={{ fontSize: 28, fontWeight: 800 }}>{total}</div><div style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>{centerLabel || tt('dashReal.eligibleLabel')}</div></>} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: '1 1 300px', minWidth: 260 }}>
          {segs.map(s => (
            <div key={s.key}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 15.5, marginBottom: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flex: 'none' }}></span>
                <span style={{ flex: 1, color: 'var(--ink-700)' }}>{s.label}</span>
                <span className="tnum" style={{ fontWeight: 700 }}>{s.value}</span>
                <span className="tnum" style={{ color: 'var(--ink-500)', fontSize: 14.5, width: 52, textAlign: 'right' }}>{pct(s.value).toFixed(2)}%</span>
              </div>
              <div className="pbar" style={{ height: 6 }}><i style={{ width: `${pct(s.value)}%`, background: s.color }} /></div>
            </div>
          ))}
        </div>
      </div>

      {alreadyPassed > 0 && (
        <div style={{ marginTop: 14, fontSize: 14.5, color: 'var(--ink-500)' }}>
          {tt('dashReal.alreadyPassedNote', { n: alreadyPassed })}
        </div>
      )}

      {/* ความคืบหน้าการตรวจ — คนละเรื่องกับสัดส่วนข้างบน (ตัวหารคือ "ใบที่ส่งเข้ามา" ไม่ใช่ทั้งรุ่น) */}
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px dashed var(--ink-100)' }}>
        {papers === 0 ? (
          <div style={{ fontSize: 15, color: 'var(--ink-500)' }}>{tt('dashReal.statusNoPapers')}</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 7 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-700)' }}>{tt('dashReal.statusProgressLabel')}</span>
              <span style={{ fontSize: 14.5, color: 'var(--ink-500)', flex: 1 }}>
                {tt(perStudent ? 'dashReal.statusProgressSubStudents' : 'dashReal.statusProgressSub', { done: reviewed, total: papers, approved: by.approved, rejected: by.rejected })}
              </span>
              <span className="tnum" style={{ fontWeight: 800 }}>{reviewRate.toFixed(2)}%</span>
            </div>
            <div className="pbar" style={{ height: 8 }}><i style={{ width: `${reviewRate}%`, background: 'var(--navy-600)' }} /></div>
          </>
        )}
      </div>
    </div>
  );
}

/* มุมมองรวมทั้งปี — นับเป็นรายคน คนที่กรอกหลายรอบในปีเดียวนับครั้งเดียว
   ไม่มีโดนัทสถานะเพราะสถานะเป็นของ "ใบ" ไม่ใช่ของ "ปี" (คนเดียวมีได้หลายใบคนละสถานะ) */
// statCardsOnly = แค่การ์ดตัวเลข 4 ใบ + ตารางแยกตามรอบ (โชว์เสมอไม่ว่าอยู่แท็บไหน)
// อัตราผ่านรายวิชารวมทั้งปี ย้ายไปแท็บ "อัตราผ่านรายวิชา" แทน (เรียก SubjectRateCard ตรงจาก DashboardReal เลย)
function YearRoundsView({ year, rounds, tt, statCardsOnly }) {
  if (!year) return <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--ink-500)', fontSize: 15.5 }}>{tt('dashReal.distEmpty')}</div>;
  if (!statCardsOnly) return null;

  const roundOf = (rid) => rounds.find(r => r.round_id === rid);

  return (
    <>
      {/* 5 ใบเท่ามุมมองรอบเดียว ใบแรกเป็นยอดคนเหมือนกัน — สลับแท็บไปมาแล้วการ์ดไม่ขยับ/ไม่เปลี่ยนขนาด */}
      <div className="grid g-5" style={{ marginBottom: 20 }}>
        <StatCard icon="users" label={tt('dashReal.yearTotalLabel')} value={year.total} sub={tt('dashReal.yearTotalSub', { year: year.academic_year })} tone="navy" />
        <StatCard icon="shield" label={tt('dashReal.yearEligibleLabel')} value={year.eligible} sub={tt('dashReal.yearEligibleSub')} tone="blue" />
        <StatCard icon="edit" label={tt('dashReal.yearSubmittedLabel')} value={year.submitted} sub={tt('dashReal.yearSubmittedSub', { rate: year.fillRate })} tone="wait" />
        <StatCard icon="checkCircle" label={tt('dashReal.yearPassedLabel')} value={year.fullyPassed} sub={tt('dashReal.yearPassedSub', { rate: year.passRate })} tone="ok" />
        <StatCard icon="calendar" label={tt('dashReal.yearRoundsLabel')} value={year.rounds.length} sub={tt('dashReal.yearRoundsSub')} tone="gold" />
      </div>

      <div className="card card-pad">
        <h3 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 800 }}>{tt('dashReal.roundBreakdownTitle')}</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
            <thead>
              <tr style={{ color: 'var(--ink-500)', fontSize: 14.5, textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>{tt('dashReal.colRound')}</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>{tt('dashReal.colSubjects')}</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>{tt('dashReal.colSubmitted')}</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>{tt('dashReal.colPassedAll')}</th>
              </tr>
            </thead>
            <tbody>
              {[...year.rounds].sort((a, b) => a.attempt_number - b.attempt_number).map(r => {
                const info = roundOf(r.round_id);
                return (
                  <tr key={r.round_id} style={{ borderTop: '1px solid var(--ink-100)' }}>
                    <td style={{ padding: '10px', fontWeight: 700 }}>
                      {tt('dashReal.roundOnlyLabel', { attempt: r.attempt_number })}
                      {info && <span className={`badge ${phaseBadgeClass(info)}`} style={{ marginLeft: 8 }}><span className="dot" />{phaseLabel(info, tt)}</span>}
                    </td>
                    <td className="tnum" style={{ padding: '10px', textAlign: 'center' }}>{r.subject_count}</td>
                    <td className="tnum" style={{ padding: '10px', textAlign: 'center' }}>{r.submitted}</td>
                    <td className="tnum" style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: 'var(--status-ok-fg)' }}>{r.fullyPassed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--ink-500)' }}>{tt('dashReal.roundBreakdownNote')}</p>
      </div>
    </>
  );
}

/* อัตราผ่านรายวิชา — ใช้ทั้งมุมมองรอบเดียวและรวมทั้งปี ต่างกันแค่ชุดข้อมูลที่ส่งเข้ามา */
function SubjectRateCard({ perSubject, subjectPassRate, title, lang, tt, onSubjectClick }) {
  return (
    <div className="card card-pad" style={{ flex: '1.3 1 380px', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title || tt('dashReal.subjectRateTitle')}</h3>
        {subjectPassRate !== undefined && (
          <span className="tnum chip" style={{ background: 'var(--blue-50)', color: 'var(--blue-600)', fontWeight: 700 }}>
            {tt('dashReal.avgAllSubjects', { rate: subjectPassRate })}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {perSubject.map((sub, i) => {
          const label = `${sub.subject_code} · ${subjectName(lang, sub.subject_code, sub.subject_name)}`;
          // เส้นบางคั่นระหว่างวิชา (ไม่มีเส้นบนสุด/ล่างสุด)
          const rowStyle = { padding: '14px 0', borderTop: i === 0 ? 'none' : '1px solid var(--ink-100)' };
          // rate = null คือไม่มีใครสอบวิชานี้ (ทุกคนยกผลผ่านมาจากรอบก่อน)
          // ต้องขึ้นขีด — ไม่ใช่ 0% เพราะ 0% แปลว่าสอบแล้วตกหมด คนละเรื่องกัน
          if (sub.rate === null) return (
            <div key={sub.subject_id} style={rowStyle}>
              <BarRow label={label} value={0} max={100}
                color="var(--ink-200)" right="—" sub={tt('dashReal.noExamThisRound')} />
            </div>
          );
          return (
            <div key={sub.subject_id} style={rowStyle}>
              <BarRow label={label} value={sub.rate} max={100}
                color="var(--pass)" track="var(--fail)"
                right={`${sub.rate}%`}
                rightSub={tt('dashReal.subjectSatCount', { n: sub.pass + sub.fail })}
                passLabel={tt('dashReal.passCountBtn', { n: sub.pass })}
                failLabel={tt('dashReal.failCountBtn', { n: sub.fail })}
                onPassClick={onSubjectClick ? () => onSubjectClick(sub.subject_code, true, sub.subject_name) : undefined}
                onFailClick={onSubjectClick ? () => onSubjectClick(sub.subject_code, false, sub.subject_name) : undefined} />
            </div>
          );
        })}
      </div>
      {/* คำแนะนำ: ตัวเลขผ่าน/ไม่ผ่านกดได้ (มีเฉพาะเจ้าหน้าที่ — ผู้บริหารไม่ส่ง onSubjectClick มา) */}
      {onSubjectClick && (
        <p style={{ margin: '16px 0 0', fontSize: 14.5, color: 'var(--ink-500)' }}>{tt('dashReal.subjectClickHint')}</p>
      )}
    </div>
  );
}

/* ---------- วิชาที่ต้องเฝ้าระวัง (หน้าผู้บริหาร) ----------
   วิชาที่อัตราผ่านต่ำสุดอาจไม่ใช่วิชาที่น่ากังวลที่สุด เลยดูจาก 3 มุม แล้วแต่ละมุมโชว์ได้สูงสุด 3 วิชา
     1) ผ่านครั้งแรกต่ำสุด        — ตัวเลขชุดเดียวกับตาราง "ผ่านครั้งแรก จำแนกรายวิชา" (ตัวหาร = นักศึกษาทั้งรุ่น)
     2) ตกลงมากสุดเทียบปีก่อน     — ร้อยละปีนี้ลบปีก่อน (ของวิชาเดียวกัน ตัวหารแบบเดียวกัน)
     3) ยังไม่ผ่านหลังสอบทุกรอบ   — คนที่สอบวิชานั้นแล้วยังไม่ผ่านจนถึงรอบล่าสุดของปี (นับเฉพาะใบที่ยืนยันแล้ว)
   ตัวเลขทุกตัวมาจาก /dashboard/history แล้ว ฝั่งนี้แค่เรียงลำดับ */
function SubjectWatchCard({ year, prevYear, lang, tt }) {
  const bySubject = year.firstAttemptBySubject;
  // วิชาที่มีคนสอบจริงเท่านั้น (sat = 0 คือไม่มีใครสอบ ไม่ควรติดอันดับ)
  const subjectsSat = bySubject ? bySubject.subjects.filter(s => s.sat > 0) : [];

  // มุมที่ 1: เรียงอัตราผ่านจากน้อยไปมาก
  const lowest = [...subjectsSat].sort((a, b) => a.pass_rate - b.pass_rate).slice(0, 3);

  // มุมที่ 2: ส่วนต่างเทียบปีก่อน (บวก = ตกลง) เอาเฉพาะวิชาที่ตกลงจริง
  let drops = null; // null = ไม่มีปีก่อนให้เทียบ
  const prevSubjects = prevYear?.firstAttemptBySubject?.subjects;
  if (prevSubjects) {
    drops = subjectsSat
      .map(s => {
        const before = prevSubjects.find(p => p.subject_code === s.subject_code && p.sat > 0);
        return before ? { ...s, drop: before.pass_rate - s.pass_rate } : null;
      })
      .filter(s => s !== null && s.drop > 0)
      .sort((a, b) => b.drop - a.drop)
      .slice(0, 3);
  }

  // มุมที่ 3: year.perSubject นับรายคนทั้งปี — fail = สอบแล้วยังไม่ผ่าน
  const unresolved = (year.perSubject || [])
    .filter(s => s.fail > 0)
    .sort((a, b) => b.fail - a.fail)
    .slice(0, 3);

  // สีตัวเลขร้อยละ — ใช้เกณฑ์เดียวกับป้ายในตารางรายวิชาของรายงาน (80 / 60)
  const rateColor = (rate) => (rate >= 80 ? 'var(--ink-900)' : rate >= 60 ? 'var(--status-wait-fg)' : 'var(--status-reject-fg)');

  const columns = [
    {
      key: 'lowest', title: tt('dashReal.watchLowest'), note: tt('dashReal.watchLowestNote', { total: bySubject ? bySubject.cohort_total : 0 }),
      empty: tt('dashReal.heroWatchEmpty'),
      rows: lowest.map(s => ({ s, value: s.pass_rate.toFixed(2) + '%', color: rateColor(s.pass_rate) })),
    },
    {
      key: 'drop', title: tt('dashReal.watchDrop'), note: tt('dashReal.watchDropNote', { prev: year.academic_year - 1 }),
      empty: drops === null ? tt('dashReal.watchDropNoPrev') : tt('dashReal.watchDropNone'),
      rows: (drops || []).map(s => ({ s, value: '▼ ' + s.drop.toFixed(2), color: 'var(--status-reject-fg)' })),
    },
    {
      key: 'unresolved', title: tt('dashReal.watchUnresolved'), note: tt('dashReal.watchUnresolvedNote'),
      empty: tt('dashReal.watchUnresolvedNone'),
      rows: unresolved.map(s => ({ s, value: s.fail + ' ' + tt('dashReal.unitPeople'), color: 'var(--status-reject-fg)' })),
    },
  ];

  return (
    <div className="card card-pad" style={{ marginBottom: 20 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>{tt('dashReal.heroWatchLabel')}</h3>
      <p style={{ margin: '0 0 14px', color: 'var(--ink-500)', fontSize: 15 }}>{tt('dashReal.watchSub')}</p>
      <div className="watch-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {columns.map(col => (
          <div key={col.key} style={{ border: '1px solid var(--ink-200)', borderRadius: 12, padding: '14px 16px', minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{col.title}</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-500)', margin: '2px 0 10px', lineHeight: 1.4 }}>{col.note}</div>
            {col.rows.length === 0 ? (
              <div style={{ fontSize: 14.5, color: 'var(--ink-500)' }}>{col.empty}</div>
            ) : col.rows.map(({ s, value, color }) => (
              <div key={s.subject_code} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
                padding: '7px 0', borderTop: '1px solid var(--ink-100)' }}>
                <div style={{ fontSize: 14.5, minWidth: 0 }}>
                  <span className="mono" style={{ color: 'var(--ink-500)', marginRight: 6 }}>{s.subject_code}</span>
                  {subjectName(lang, s.subject_code, s.subject_name)}
                </div>
                <div className="tnum" style={{ fontSize: 16, fontWeight: 800, flex: 'none', color }}>{value}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* จอแคบ: เรียง 3 กล่องลงล่าง */}
      <style>{`@media(max-width:860px){.watch-grid{grid-template-columns:1fr!important;}}`}</style>
    </div>
  );
}

/* ---------- ภาพรวมผู้บริหาร ----------
   แถบตัวเลขหลัก 3 ตัว + กราฟ 2 ใบ ใช้ข้อมูลจริงจาก /dashboard/history ทั้งหมด
   ตัวเลขทุกตัวคำนวณที่ backend แล้ว ฝั่งนี้แค่หยิบมาแสดง */
function ExecutiveOverview({ year, history, lang, tt }) {
  // ปีก่อนหน้าของปีที่กำลังดู (ไว้คำนวณว่าดีขึ้น/แย่ลงกี่จุด)
  const prevYear = history.years.find(y => y.academic_year === year.academic_year - 1);

  const first = year.firstAttempt || { passed: 0, rate: 0 };
  const cumulative = year.firstYear || { passed: 0, rate: 0 };
  let delta = null;
  if (prevYear && prevYear.firstAttempt) delta = first.rate - prevYear.firstAttempt.rate;

  // อัตราผ่านของแต่ละครั้งที่สอบ = ผ่านครบทุกวิชา ÷ คนที่ส่งผลในรอบนั้น
  const attempts = [...year.rounds].sort((a, b) => a.attempt_number - b.attempt_number);
  const attemptBars = attempts.map((r, i) => {
    let rate = 0;
    // ตัวหาร = ใบที่ยืนยันแล้วของรอบนั้น (ตัวตั้ง fullyPassed นับจากใบที่ยืนยันแล้วเหมือนกัน) — ไม่ใช่ submitted ที่รวมใบรอตรวจ
    if (r.confirmed) rate = Math.round((r.fullyPassed / r.confirmed) * 100);
    // ครั้งแรกเป็นสีหลัก ครั้งถัดไปจางลงเรื่อยๆ — เห็นลำดับได้โดยไม่ต้องอ่าน label
    const palette = ['var(--navy-700)', 'var(--navy-500)', 'var(--ink-300)'];
    return {
      label: tt('dashReal.attemptLabel', { n: r.attempt_number }),
      value: rate,
      color: palette[Math.min(i, palette.length - 1)],
      pass: r.fullyPassed,
      sat: r.confirmed,
    };
  });

  return (
    <>
      <div className="card" style={{ padding: 0, marginBottom: 20, overflow: 'hidden',
        background: 'linear-gradient(135deg, var(--navy-700), var(--navy-900))', color: '#fff' }}>
        <div className="exec-hero" style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr' }}>
          <div style={{ padding: '24px 30px', borderRight: '1px solid rgba(255,255,255,.14)' }}>
            <div style={{ fontSize: 15.5, opacity: .85, fontWeight: 600, marginBottom: 6 }}>{tt('dashReal.heroFirstLabel')}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span className="tnum" style={{ fontSize: 52, fontWeight: 800, color: 'var(--gold-100)', lineHeight: 1 }}>
                {first.rate.toFixed(2)}%
              </span>
              {delta !== null && delta !== 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 16, fontWeight: 700,
                  color: delta > 0 ? '#7fe0a8' : '#ffb4ab' }}>
                  {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}%
                </span>
              )}
            </div>
            <div style={{ fontSize: 15, opacity: .8, marginTop: 8 }}>
              {tt('dashReal.heroFirstSub', { pass: first.passed, total: year.total })}
            </div>
          </div>

          <div style={{ padding: '24px 30px' }}>
            <div style={{ fontSize: 15.5, opacity: .85, fontWeight: 600, marginBottom: 6 }}>{tt('dashReal.heroCumulativeLabel')}</div>
            <div className="tnum" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, color: '#7fe0a8' }}>
              {cumulative.rate.toFixed(2)}%
            </div>
            <div className="pbar" style={{ marginTop: 12, background: 'rgba(255,255,255,.22)' }}>
              <i style={{ width: `${cumulative.rate}%`, background: '#7fe0a8' }} />
            </div>
            <div style={{ fontSize: 14.5, opacity: .8, marginTop: 8 }}>
              {tt('dashReal.heroCumulativeSub', { total: year.total })}
            </div>
          </div>
        </div>
        {/* จอแคบ: เรียงลงล่างแทน 2 คอลัมน์ ไม่งั้นตัวเลขโดนบีบจนอ่านไม่ออก */}
        <style>{`@media(max-width:860px){.exec-hero{grid-template-columns:1fr!important;}.exec-hero>div{border-right:none!important;border-bottom:1px solid rgba(255,255,255,.14);}}`}</style>
      </div>

      <SubjectWatchCard year={year} prevYear={prevYear} lang={lang} tt={tt} />

      <div className="row wrap-m" style={{ marginBottom: 20, alignItems: 'stretch' }}>
        <div className="card card-pad" style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>{tt('dashReal.perAttemptTitle')}</h3>
          <p style={{ margin: '0 0 14px', color: 'var(--ink-500)', fontSize: 15 }}>
            {tt('dashReal.perAttemptSub', { year: year.academic_year })}
          </p>
          {attemptBars.length > 0 ? (
            <>
              <ColumnChart height={170} data={attemptBars} fmt={v => `${v}%`} />
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                {attemptBars.map(a => (
                  <div key={a.label} style={{ flex: 1, padding: '10px 12px', background: 'var(--ink-50)', borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>{a.label}</div>
                    <div className="tnum" style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>{a.pass}/{a.sat}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-400)' }}>{tt('dashReal.unitPeople')}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--ink-500)', fontSize: 15.5 }}>{tt('dashReal.distEmpty')}</div>
          )}
        </div>
      </div>
    </>
  );
}

/* แถบสรุปรอบที่กำลังดูอยู่ — วันปิดรับ + ความคืบหน้าการกรอก
   roundInfo มาจาก GET /rounds (มี close_date) ส่วน round จาก /dashboard/stats ไม่มีวันที่ */
function RoundBar({ round, roundInfo, submitted, fillRate, roundTotal, tt }) {
  // นับวันที่เหลือแบบตัดเวลาออก — เทียบ "วัน" ต่อ "วัน" ไม่งั้นปิด 23:59 วันนี้จะกลายเป็นเหลือ 0 วันตั้งแต่เช้า
  let daysLeft = null;
  let closeText = '';
  if (roundInfo) {
    const close = new Date(roundInfo.close_date);
    closeText = close.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfClose = new Date(close);
    startOfClose.setHours(0, 0, 0, 0);
    daysLeft = Math.round((startOfClose - startOfToday) / 86400000); // 86400000 = จำนวน ms ใน 1 วัน
  }

  // เหลือน้อยกว่า 3 วัน = เตือนสีส้ม, เลยกำหนดแล้ว = สีแดง
  let deadlineTone = 'var(--ink-500)';
  let deadlineText = '';
  // นับถอยหลังวันปิด ใช้ได้เฉพาะรอบที่ "เปิดรับอยู่จริง" เท่านั้น
  //   scheduled — ยังไม่ถึงวันเปิด นักศึกษากรอกไม่ได้เลย บอก "เหลืออีก 6 วัน" คนอ่านเข้าใจผิด
  //   closed    — เจ้าหน้าที่ปิดไปแล้ว ถึง close_date จะยังไม่ถึงก็ไม่มีใครกรอกได้
  //   expired   — เลยกำหนดแล้ว ตกไปเข้าเงื่อนไข daysLeft < 0 ข้างล่างเอง (ขึ้น "สิ้นสุดแล้ว")
  const phase = phaseOf(roundInfo ?? round);
  const countsDown = phase === 'active' || phase === 'expired';
  if (countsDown && daysLeft !== null) {
    if (daysLeft < 0) {
      deadlineTone = 'var(--status-reject-fg)';
      deadlineText = tt('dashReal.roundBarEnded');
    } else if (daysLeft === 0) {
      deadlineTone = 'var(--status-reject-fg)';
      deadlineText = tt('dashReal.roundBarLastDay');
    } else {
      if (daysLeft <= 3) deadlineTone = 'var(--status-wait-fg)';
      deadlineText = tt('dashReal.roundBarDaysLeft', { n: daysLeft });
    }
  }

  return (
    <div className="card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex',
      alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
        <Icon name="calendar" size={18} style={{ color: 'var(--navy-600)' }} />
        <span style={{ fontWeight: 800, fontSize: 17 }}>
          {tt('dashReal.roundBarTitle', { attempt: round.attempt_number, year: round.academic_year })}
        </span>
        <span className={`badge ${phaseBadgeClass(round)}`}>
          <span className="dot" />{phaseLabel(round, tt)}
        </span>
      </div>

      {/* flex '0 1 auto' + minWidth 0 = ยอมหดแล้วตัดบรรทัดได้บนจอแคบ
          เดิม flex:'none' ห้ามหด บนมือถือ (390px) ข้อความยาวเลยดันการ์ดล้นขอบขวา 22px ทั้งหน้าเลื่อนแนวนอนได้ */}
      {roundInfo && (
        <div style={{ fontSize: 15, color: 'var(--ink-500)', flex: '0 1 auto', minWidth: 0 }}>
          {tt('dashReal.roundBarClose', { date: closeText })}
          {deadlineText && <span style={{ color: deadlineTone, fontWeight: 700 }}> · {deadlineText}</span>}
        </div>
      )}

      {/* ความคืบหน้าการกรอก — ตัวเลขเดียวกับการ์ด "ส่งผลสอบแล้ว" ข้างล่าง แต่ตรงนี้ให้เห็นเป็นแถบเทียบกับเวลาที่เหลือ */}
      <div style={{ flex: '1 1 160px', minWidth: 140, marginLeft: 'auto' }}>
        <div style={{ fontSize: 14.5, color: 'var(--ink-600)', marginBottom: 5, textAlign: 'right' }}>
          {tt('dashReal.roundBarProgress', { submitted, total: roundTotal, rate: fillRate })}
        </div>
        <div className="pbar" style={{ height: 8 }}>
          <i style={{ width: `${fillRate}%`, background: 'var(--navy-600)' }} />
        </div>
      </div>
    </div>
  );
}

/* ตาราง "ผ่านกี่วิชา" ของการสอบรอบแรก แยกตามห้องเรียน + คอลัมน์รวม
   ข้อมูลจาก history.years[].passDistribution (backend คำนวณให้แล้ว ไม่คำนวณซ้ำฝั่งนี้)
   ปีที่เลือกดูตามปีของรอบที่กำลังแสดงบน dashboard */
export function PassDistribution({ year, lang, tt }) {
  if (!year) return null;
  const dist = year.passDistribution;

  return (
    <div className="card card-pad">
      <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>{tt('dashReal.distTitle')}</h3>
      <p style={{ margin: '0 0 16px', color: 'var(--ink-500)', fontSize: 15 }}>
        {tt('dashReal.distSub', { year: year.academic_year })}
      </p>

      {!dist || dist.total === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-500)', fontSize: 15.5 }}>
          {tt('dashReal.distEmpty')}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 120 + dist.rooms.length * 150, borderCollapse: 'collapse', fontSize: 15 }}>
            <thead>
              <tr style={{ color: 'var(--ink-500)', fontSize: 14.5 }}>
                <th rowSpan={2} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--ink-100)' }}>
                  {tt('dashReal.distColResult')}
                </th>
                {dist.rooms.map(r => (
                  <th key={r.room_id} colSpan={2} style={{ padding: '8px 10px', borderBottom: '1px solid var(--ink-100)' }}>
                    {tt('dashReal.distRoomHead', { room: roomName(lang, r.room_name), n: r.total })}
                  </th>
                ))}
                <th colSpan={2} style={{ padding: '8px 10px', borderBottom: '1px solid var(--ink-100)', background: 'var(--gold-50)' }}>
                  {tt('dashReal.distRoomHead', { room: tt('dashReal.distColTotal'), n: dist.total })}
                </th>
              </tr>
              <tr style={{ color: 'var(--ink-500)', fontSize: 13.5 }}>
                {dist.rooms.map(r => [
                  <th key={`c${r.room_id}`} style={{ padding: '6px 10px', fontWeight: 500, borderBottom: '1px solid var(--ink-100)' }}>{tt('dashReal.distColCount')}</th>,
                  <th key={`p${r.room_id}`} style={{ padding: '6px 10px', fontWeight: 500, borderBottom: '1px solid var(--ink-100)' }}>{tt('dashReal.distColRate')}</th>,
                ])}
                <th style={{ padding: '6px 10px', fontWeight: 500, borderBottom: '1px solid var(--ink-100)', background: 'var(--gold-50)' }}>{tt('dashReal.distColCount')}</th>
                <th style={{ padding: '6px 10px', fontWeight: 500, borderBottom: '1px solid var(--ink-100)', background: 'var(--gold-50)' }}>{tt('dashReal.distColRate')}</th>
              </tr>
            </thead>
            <tbody>
              {dist.rows.map(row => {
                // แถวที่ไม่มีใครเลย ทำให้จางลง จะได้กวาดตาเจอแถวที่มีคนจริงเร็วขึ้น
                const empty = row.count === 0;
                // แถวปิดท้าย (label = 'not_submitted') คือคนที่ไม่ได้ส่งผลเลย ไม่ใช่ "ผ่าน N วิชา"
                const isNotSubmitted = row.label === 'not_submitted';
                return (
                  <tr key={isNotSubmitted ? 'not_submitted' : row.passed}
                    style={{ borderTop: isNotSubmitted ? '2px solid var(--ink-200)' : '1px solid var(--ink-100)',
                      opacity: empty ? .45 : 1 }}>
                    <td style={{ padding: '9px 10px', fontWeight: 600, color: isNotSubmitted ? 'var(--ink-500)' : 'inherit' }}>
                      {isNotSubmitted ? tt('dashReal.distRowNotSubmitted') : tt('dashReal.distRowLabel', { n: row.passed })}
                    </td>
                    {row.byRoom.map(c => [
                      <td key={`c${c.room_id}`} className="tnum" style={{ padding: '9px 10px', textAlign: 'center' }}>{c.count}</td>,
                      <td key={`p${c.room_id}`} className="tnum" style={{ padding: '9px 10px', textAlign: 'center', color: 'var(--ink-500)' }}>{c.rate.toFixed(2)}</td>,
                    ])}
                    <td className="tnum" style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, background: 'var(--gold-50)' }}>{row.count}</td>
                    <td className="tnum" style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, background: 'var(--gold-50)' }}>{row.rate.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* บอกตัวหารไว้ใต้ตาราง ไม่งั้นคนอ่านไม่รู้ว่า % คิดจากอะไร แล้วเทียบกับการ์ดข้างบนไม่ถูก */}
          <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--ink-500)' }}>
            {tt('dashReal.distFootnote', { total: dist.total })}
          </p>
        </div>
      )}
    </div>
  );
}

// สี 3 ปีย้อนหลัง — ปีล่าสุดเข้มสุด เก่าสุดจางสุด รองรับปีเพิ่มในอนาคตด้วย modulo
const HISTORY_COLORS = ['var(--navy-600)', 'var(--blue-600)', 'var(--pass)', '#c9971f', '#8b5e34'];

// อัตราผ่านรายวิชาย้อนหลัง 3 ปี — เส้นละปี, แกน x = รหัสวิชา, ข้อมูลอัปเดตตาม /dashboard/history อัตโนมัติเมื่อมีรอบ/ปีใหม่เข้ามา
function SubjectHistoryChart({ history, firstRoundSubjects, tt, yearPicker }) {
  const [expanded, setExpanded] = useState(false);
  const [chartType, setChartType] = useState('bar'); // 'line' | 'bar'
  // ใช้แค่ผลรอบแรก (attempt_number=1) ของแต่ละปี ไม่รวมรอบถัดไป — ดึงจาก firstRoundSubjects ไม่ใช่ y.perSubject (นั่นรวมทุกรอบ)
  const years = [...history.years]
    .filter(y => firstRoundSubjects[y.academic_year]?.length > 0)
    .sort((a, b) => a.academic_year - b.academic_year); // เก่า→ใหม่ อ่านซ้ายไปขวา

  // เดิม return null เฉยๆ ตอนไม่มีข้อมูล — กดแท็บแล้วจอว่างมองไม่ออกว่าพังหรือแค่ไม่มีข้อมูล (เช่น ปีนี้ยังไม่เคยมีรอบที่ 1)
  if (years.length === 0) {
    return <div className="card card-pad"><Empty icon="chart" title={tt('dashReal.subjectHistoryTitle')} sub={tt('dashReal.subjectHistoryEmpty')} /></div>;
  }

  // แกน x ต้องเป็น union ของวิชาทุกปีที่โชว์ ไม่ใช่แค่ของปีล่าสุด — ถ้ารอบแรกของปีล่าสุดสอบไม่ครบทุกวิชา
  // (เช่น รอบนั้นข้าม 1102) วิชานั้นจะหายไปจากกราฟทั้งที่ปีอื่นมีข้อมูลอยู่จริง
  const categories = [...new Set(years.flatMap(y => firstRoundSubjects[y.academic_year].map(s => s.subject_code)))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const series = years.map((y, i) => {
    const perSubject = firstRoundSubjects[y.academic_year];
    return {
      label: String(y.academic_year),
      color: HISTORY_COLORS[i % HISTORY_COLORS.length],
      // ปีนั้นไม่ได้เปิดสอบวิชานี้ (ไม่อยู่ใน perSubject เลย) หรือเปิดแต่ไม่มีคนสอบจริง (rate===null) — ทั้งคู่ถือว่า "ไม่มีข้อมูล"
      // ส่ง null ไป ไม่ใช่ 0 กัน MultiLineChart วาดจุดหลอกว่า "สอบแล้วตกหมด" ทั้งที่จริงๆ ไม่มีใครสอบ
      values: categories.map(code => {
        const s = perSubject.find(x => x.subject_code === code);
        return s && s.rate !== null ? s.rate : null;
      }),
      tooltips: categories.map(code => {
        const s = perSubject.find(x => x.subject_code === code);
        if (!s || s.rate === null) return '';
        return tt('dashReal.subjectPointTooltip', { year: y.academic_year, code, pass: s.pass, total: s.pass + s.fail, rate: s.rate });
      }),
    };
  });

  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>{tt('dashReal.subjectHistoryTitle')}</h3>
          <p style={{ margin: 0, color: 'var(--ink-500)', fontSize: 15 }}>{tt('dashReal.subjectHistorySub')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          <div style={{ display: 'flex', border: '1px solid var(--ink-200)', borderRadius: 8, overflow: 'hidden' }}>
            {[['line', tt('dashReal.chartTypeLine')], ['bar', tt('dashReal.chartTypeBar')]].map(([key, label]) => (
              <button key={key} type="button" onClick={() => setChartType(key)}
                style={{ fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, padding: '7px 12px', border: 'none', cursor: 'pointer',
                  background: chartType === key ? 'var(--navy-700)' : '#fff',
                  color: chartType === key ? '#fff' : 'var(--ink-700)' }}>
                {label}
              </button>
            ))}
          </div>
          {yearPicker}
          <button className="btn btn-ghost btn-sm" style={{ padding: 12, flex: 'none' }} title={tt('dashReal.expandChart')} onClick={() => setExpanded(true)}>
            <Icon name="expand" size={26} />
          </button>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        {chartType === 'line'
          ? <MultiLineChart categories={categories} series={series} height={220} width={640} />
          : <MultiBarChart categories={categories} series={series} height={220} width={640} />}
      </div>

      <Modal open={expanded} onClose={() => setExpanded(false)} title={tt('dashReal.subjectHistoryTitle')} width={1200}>
        {chartType === 'line'
          ? <MultiLineChart categories={categories} series={series} height={540} width={1140} legendSize={16} />
          : <MultiBarChart categories={categories} series={series} height={540} width={1140} legendSize={16} />}
      </Modal>
    </div>
  );
}

/* เทียบผลรุ่นต่อรุ่นย้อนหลัง — นับเป็นรายคน คนที่กรอกหลายรอบในปีเดียวนับครั้งเดียว
   ผ่านครบทุกวิชา แยกเป็นคอลัมน์ตามห้องเรียน (ปกติ/ภาษาอังกฤษ) — room_name มาจาก DB ตรงๆ ไม่ hardcode ชื่อห้อง */
function YearCompare({ history, lang, tt, yearPicker }) {
  // รวมรายชื่อห้องจากทุกปีที่ดึงมา (เผื่อบางปีไม่มีคนส่งในบางห้อง) เรียงตาม room_id ให้ลำดับคอลัมน์คงที่
  const rooms = [...new Map(
    history.years.flatMap(y => y.byRoom.map(r => [r.room_id, r]))
  ).values()].sort((a, b) => a.room_id - b.room_id);

  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{tt('dashReal.colFullPass')}</h3>
        {yearPicker}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 100 + rooms.length * 80, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'center', color: 'var(--ink-500)', fontSize: 14.5 }}>
              <th style={{ padding: '8px 10px' }}>{tt('dashReal.colYear')}</th>
              {rooms.map(r => <th key={r.room_id} style={{ padding: '8px 10px', minWidth: 70 }}>{roomName(lang, r.room_name)}</th>)}
            </tr>
          </thead>
          <tbody>
            {history.years.map(y => (
              <tr key={y.academic_year} style={{ borderTop: '1px solid var(--ink-100)' }}>
                <td className="tnum" style={{ padding: '10px', fontWeight: 700, textAlign: 'center' }}>{y.academic_year}</td>
                {rooms.map(r => {
                  // ตัวหารเป็นจำนวนนักศึกษาทั้งห้อง (room.total) ไม่ใช่คนที่ส่งผล — ตัวเดียวกับการ์ด % ผ่านครั้งแรก
                  const room = y.byRoom.find(b => b.room_id === r.room_id) || { fullyPassed: 0, total: 0, passRate: 0 };
                  return (
                    <td key={r.room_id} className="tnum" style={{ padding: '10px', fontWeight: 700, textAlign: 'center' }}>
                      <span style={{ color: 'var(--status-ok-dot)' }}>{room.fullyPassed}</span> / {room.total}
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-500)' }}>{room.passRate.toFixed(2)}%</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ร้อยละคนที่สอบผ่านครบทุกวิชาตั้งแต่ "รอบแรก" (attempt_number=1) ของแต่ละปี เทียบกับจำนวนนักศึกษาทั้งรุ่น
   แสดงเก่าไปใหม่ (ซ้ายไปขวา) พร้อมส่วนต่างเทียบปีก่อนหน้า
   การ์ดจริงแคบ (อยู่คอลัมน์เดียวกับ donut/ผ่านครบทุกวิชา) เลยเรียงเป็นแถวแนวตั้ง — กดขยายดูแบบเทียบข้างกันครบทุกปีในโมดัลแทน */
function FirstAttemptPassRate({ history, tt, wide, yearPicker, onViewStudents }) {
  const [expanded, setExpanded] = useState(false);
  // คลิกการ์ดปีไหน เปิด modal แยกเป็นรายรอบของปีนั้น — เก็บทั้ง object เลยไม่ต้องหาซ้ำ
  const [roundDetailYear, setRoundDetailYear] = useState(null);
  const yearsOldToNew = [...history.years].reverse();
  // 2 ตัวเลขนี้ backend คำนวณมาให้แล้ว (ตัวหาร = นักศึกษาทั้งรุ่น = ผู้สำเร็จการศึกษาปีนั้น)
  //   firstAttempt = ผ่านครบทุกวิชาตั้งแต่รอบที่ 1
  //   firstYear    = ผ่านครบทุกวิชาในรอบไหนก็ได้ของปีนั้น
  const rateOf = (y) => y.firstAttempt || { passed: 0, rate: 0 };

  const YearBlock = ({ y, i }) => {
    const { passed, rate } = rateOf(y);
    const firstYear = y.firstYear || { passed: 0, rate: 0 };
    const prev = i > 0 ? rateOf(yearsOldToNew[i - 1]) : null;
    const diff = prev ? rate - prev.rate : null;
    const tone = rate >= 80 ? 'var(--status-ok-dot)' : 'var(--status-wait-dot)';
    return (
      // การ์ดคลิกได้ — กดแล้วเปิด modal แยกเป็นทุกรอบของปีนี้ (y.rounds มาจาก /dashboard/history อยู่แล้ว ไม่ต้องยิงเพิ่ม)
      // กว้างเต็มช่องของ grid เสมอ — เดิมล็อกไว้ 220px พอเลือกปีเดียวเลยเหลือที่ว่างเกือบทั้งการ์ด
      // เดิมเป็น <button> ทั้งใบ — เปลี่ยนเป็น div เพราะปุ่ม "ดูรายชื่อ" ด้านล่างต้องอยู่ข้างในด้วย
      // (button ซ้อน button ผิด HTML spec เบราว์เซอร์จะ auto-close ปุ่มในให้เอง คลิกไม่ทำงาน)
      <div role="button" tabIndex={0} onClick={() => setRoundDetailYear(y)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setRoundDetailYear(y); }}
        style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', background: '#fff',
          border: '1px solid var(--ink-200)', borderRadius: 12, transition: '.15s',
          padding: 16, width: '100%' }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--sh-md)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
        <div style={{ fontSize: 14.5, color: 'var(--ink-500)', marginBottom: 6 }}>{tt('dashReal.yearOption', { year: y.academic_year })}</div>
        <div className="tnum" style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>{rate.toFixed(2)}%</div>
        <div className="pbar" style={{ marginBottom: 10 }}><i style={{ width: `${rate}%`, background: tone }} /></div>
        <div style={{ fontSize: 14.5, color: 'var(--ink-600)' }}>{tt('dashReal.firstAttemptSub', { passed })}</div>
        <div style={{ fontSize: 14.5, color: 'var(--ink-500)' }}>{tt('dashReal.firstAttemptTotal', { total: y.total })}</div>
        {/* ผ่านภายในปีแรก = รวมรอบ 2, 3 ด้วย เลยสูงกว่าหรือเท่ากับผ่านครั้งแรกเสมอ */}
        <div style={{ fontSize: 14.5, color: 'var(--ink-600)', marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--ink-100)' }}>
          {tt('dashReal.firstYearTitle')} <b className="tnum">{firstYear.rate.toFixed(2)}%</b>
          <div style={{ color: 'var(--ink-500)' }}>{tt('dashReal.firstYearSub', { passed: firstYear.passed })}</div>
        </div>
        <div style={{ fontSize: 14, color: diff == null ? 'var(--ink-400)' : diff >= 0 ? 'var(--status-ok-fg)' : 'var(--status-reject-fg)', marginTop: 6 }}>
          {tt('dashReal.firstAttemptDiffLabel')} {diff == null ? '—' : `${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(2)}`}
        </div>
        {/* แยกจากคลิกเปิด modal ข้างบน — ต้องมี onViewStudents (officer เท่านั้น ผู้บริหารดูหน้านักศึกษาไม่ได้) */}
        {onViewStudents && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--ink-100)' }}>
            {/* 2 แถว: ผ่านครั้งแรก / ไม่ผ่านครั้งแรก — "ดูรายชื่อ" (ไปหน้านักศึกษา)
                การส่งออกไฟล์ทั้งหมดรวมไว้ที่หน้า "รายงานสรุป" ที่เดียว ไม่ซ้ำกันหลายที่ */}
            {[[true, 'viewPassedStudentsBtn', 'var(--status-ok-fg)'], [false, 'viewFailedStudentsBtn', 'var(--status-reject-fg)']].map(([passed, labelKey, color]) => (
              <div key={String(passed)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <button type="button" onClick={e => { e.stopPropagation(); onViewStudents(y.academic_year, passed); }}
                  style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 700, color }}>
                  <Icon name="eye" size={13} /> {tt('dashReal.' + labelKey)}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>{tt('dashReal.firstAttemptTitle')}</h3>
          <p style={{ margin: 0, color: 'var(--ink-500)', fontSize: 15 }}>{tt('dashReal.firstAttemptSubtitle')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          {yearPicker}
          {/* โหมดกว้างเรียงปีข้างกันอยู่แล้ว ไม่ต้องมีปุ่มขยาย */}
          {!wide && <button className="btn btn-ghost btn-sm" style={{ padding: 12, flex: 'none' }} title={tt('dashReal.expandChart')} onClick={() => setExpanded(true)}>
            <Icon name="expand" size={26} />
          </button>}
        </div>
      </div>
      {/* เลือกหลายปี = มีอะไรให้เทียบ โชว์กราฟแท่งรายปีก่อน แล้วค่อยลงรายละเอียดเป็นการ์ด
          เลือกปีเดียว = ไม่มีอะไรเทียบ บอกตรงๆ ว่าให้ติ๊กปีเพิ่ม ดีกว่าปล่อยการ์ดโล่ง */}
      {yearsOldToNew.length > 1 ? (
        <div style={{ marginTop: 18, paddingBottom: 18, borderBottom: '1px dashed var(--ink-100)' }}>
          <div style={{ fontSize: 14.5, color: 'var(--ink-500)', fontWeight: 600, marginBottom: 10 }}>{tt('dashReal.compareTrendTitle')}</div>
          <ColumnChart height={150} fmt={v => `${v.toFixed(2)}%`}
            data={yearsOldToNew.map((y, i) => ({
              label: tt('dashReal.yearOption', { year: y.academic_year }),
              value: rateOf(y).rate,
              // ปีล่าสุดเข้มสุด ปีเก่าจางลง — เห็นลำดับเวลาได้โดยไม่ต้องอ่าน label
              color: i === yearsOldToNew.length - 1 ? 'var(--navy-700)' : 'var(--navy-500)',
            }))} />
        </div>
      ) : (
        <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: 'var(--blue-50)',
          color: 'var(--navy-700)', fontSize: 14.5 }}>
          {tt('dashReal.compareNeedMoreYears')}
        </div>
      )}

      {/* grid ยืดการ์ดให้เต็มความกว้างเสมอ ไม่ว่าจะเลือกกี่ปี — flex แบบเดิมทิ้งที่ว่างตอนมีปีเดียว */}
      <div style={{ marginTop: 16, display: 'grid', gap: 12,
        gridTemplateColumns: `repeat(auto-fit, minmax(${wide ? 240 : 200}px, 1fr))` }}>
        {yearsOldToNew.map((y, i) => <YearBlock key={y.academic_year} y={y} i={i} />)}
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--ink-400)' }}>{tt('dashReal.clickForRounds')}</p>

      <Modal open={expanded} onClose={() => setExpanded(false)} title={tt('dashReal.firstAttemptTitle')} width={yearsOldToNew.length * 268 + 40}>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: `repeat(auto-fit, minmax(240px, 1fr))` }}>
          {yearsOldToNew.map((y, i) => <YearBlock key={y.academic_year} y={y} i={i} />)}
        </div>
      </Modal>

      <Modal open={!!roundDetailYear} onClose={() => setRoundDetailYear(null)}
        title={roundDetailYear ? tt('dashReal.yearOption', { year: roundDetailYear.academic_year }) : ''}
        width={roundDetailYear ? roundDetailYear.rounds.length * 376 + 40 : 560}>
        {roundDetailYear && <RoundBreakdownTable year={roundDetailYear} tt={tt} />}
      </Modal>
    </div>
  );
}

/* ตารางแยกรายรอบของปีเดียว — ใช้ y.rounds ที่มากับ /dashboard/history อยู่แล้ว (ไม่ยิง fetch เพิ่ม)
   คอลัมน์เดียวกับตาราง "ผลแยกตามรอบ" ในแท็บรวมทั้งปี (dashReal.colRound/colSubjects/colSubmitted/colPassedAll) */
// การ์ดเดียวกับ YearBlock ใน FirstAttemptPassRate เป๊ะๆ (ตัวเลข/แถบ/sub) แค่ข้อมูลเป็นระดับรอบแทนระดับปี
function RoundBreakdownTable({ year, tt }) {
  const rounds = [...year.rounds].sort((a, b) => a.attempt_number - b.attempt_number);
  return (
    <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 16, overflowX: 'auto' }}>
      {rounds.map(r => {
        // ผ่านครั้งแรกของ "รอบนี้" เอง — ผ่านครบ ÷ คนที่สอบรอบนี้ ไม่ใช่ตัวเลขสะสมของทั้งปี
        // confirmed = 0 → ยังไม่มีฐานให้หาร ขึ้น "—" ไม่ใช่ 0.00% (0% แปลว่าสอบแล้วตกหมด คนละเรื่องกัน)
        const hasBase = r.confirmed > 0;
        const rate = hasBase ? Math.round((r.fullyPassed / r.confirmed) * 10000) / 100 : 0;
        const tone = rate >= 80 ? 'var(--status-ok-dot)' : 'var(--status-wait-dot)';
        return (
          <div key={r.round_id} style={{ width: 360, flex: 'none', padding: 30,
            border: '1px solid var(--ink-200)', borderRadius: 16 }}>
            <div style={{ fontSize: 18, color: 'var(--ink-500)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              {tt('dashReal.roundOnlyLabel', { attempt: r.attempt_number })}
              <span className={`badge ${phaseBadgeClass(r)}`}><span className="dot" />{phaseLabel(r, tt)}</span>
            </div>
            <div className="tnum" style={{ fontSize: 42, fontWeight: 800, marginBottom: 16 }}>{hasBase ? rate.toFixed(2) + '%' : '—'}</div>
            <div className="pbar" style={{ height: 13, marginBottom: 18 }}><i style={{ width: `${rate}%`, background: tone }} /></div>
            <div style={{ fontSize: 18, color: 'var(--ink-600)' }}>{tt('dashReal.roundFullyPassedCount', { pass: r.fullyPassed })}</div>
            <div style={{ fontSize: 18, color: 'var(--ink-500)' }}>{tt('dashReal.roundSatTotal', { total: r.confirmed })}</div>
          </div>
        );
      })}
    </div>
  );
}

/* แถบเตือน "ยังมีใบรอตรวจสอบ N ใบ ยังไม่นับ" — ตัวเลข "ผ่าน" ทุกตัวนับเฉพาะใบที่ยืนยันแล้ว
   ระหว่างที่ยังตรวจไม่ครบ ตัวเลขจะต่ำกว่าความจริงชั่วคราว แถบนี้บอกเหตุผลให้คนอ่านไม่เข้าใจผิดว่าผ่านน้อย
   n = จำนวนใบรอตรวจของสิ่งที่กำลังดูอยู่ (รอบที่เลือก / รวมทั้งปีนับเป็นคน) · go = ไปหน้าตรวจสอบ (ผู้บริหารไม่มี — ดูอย่างเดียว) */
function PendingNotice({ n, go, tt }) {
  if (!n) return null;
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '11px 16px', marginBottom: 18,
      borderRadius: 12, background: 'var(--status-wait-bg)', color: 'var(--status-wait-fg)', fontWeight: 600, fontSize: 15.5 }}>
      <Icon name="clock" size={18} />
      <span style={{ flex: 1, minWidth: 200 }}>{tt('dashReal.pendingNotice', { n })}</span>
      {go && <button type="button" className="btn btn-sm btn-ghost" onClick={() => go('review')}>{tt('dashReal.pendingNoticeBtn')}</button>}
    </div>
  );
}
