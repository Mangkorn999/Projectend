/* ============================================================
   Dashboard สรุปผลสอบ (officer + executive) — ข้อมูลจริงจาก backend
   แทนที่ OfficerDashboard/ExecutiveDashboard เดิมที่ใช้ mock STUDENTS/TREND
   ดึงจาก GET /api/dashboard/stats (คำนวณรวมฝั่ง backend อยู่แล้ว ไม่คำนวณซ้ำฝั่ง frontend)
   + GET /api/dashboard/history สำหรับเทียบย้อนหลังรายปี
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, StatCard, Donut, BarRow, MultiLineChart, ColumnChart, Modal } from './components.jsx';
import { apiFetch } from './api.js';
import { t, subjectName } from './i18n.js';

export function DashboardReal({ go, readonly, lang }) {
  const tt = (key, vars) => t(lang, key, vars);
  const [stats, setStats] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [history, setHistory] = useState(null);
  const [roundId, setRoundId] = useState(''); // '' = ให้ backend เลือกรอบที่เปิดอยู่ — ใช้ยิง API เท่านั้น
  // roundPick แยกจาก roundId เพราะ dropdown รอบต้องโชว์ "ทั้งหมด" ค้างไว้ได้แม้ปีที่ดูไม่ใช่ปีปัจจุบัน
  // (roundId ตอนนั้นต้อง resolve เป็น round_id จริงของปีนั้นเพื่อยิง API ให้ตรงปี ไม่งั้นจะไปเรียกรอบเปิดของปีปัจจุบันแทน)
  const [roundPick, setRoundPick] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // อัตราผ่านรายวิชาย้อนหลัง ต้องใช้แค่ผลรอบแรก (attempt_number=1) ของแต่ละปีเท่านั้น ไม่รวมรอบถัดไป —
  // history.years[].perSubject รวมทุกรอบของปี ใช้ไม่ได้ตรงนี้ เลยต้องยิง /dashboard/stats?round_id= แยกทีละรอบแรกของแต่ละปี
  const [firstRoundSubjects, setFirstRoundSubjects] = useState({}); // { [academic_year]: perSubject[] }

  // โหลดครั้งแรก — รายการรอบกับสรุปย้อนหลังไม่เปลี่ยนตามรอบที่เลือก โหลดรอบเดียวพอ
  useEffect(() => {
    Promise.all([apiFetch('/rounds'), apiFetch('/dashboard/history?years=3')])
      .then(([roundList, hist]) => {
        setRounds(roundList);
        setHistory(hist);
        const round1ByYear = new Map();
        roundList.forEach(r => { if (r.attempt_number === 1) round1ByYear.set(r.academic_year, r.round_id); });
        return Promise.all(
          [...round1ByYear.entries()].map(([year, rid]) =>
            apiFetch(`/dashboard/stats?round_id=${rid}`).then(s => [year, s.perSubject]))
        );
      })
      .then(pairs => setFirstRoundSubjects(Object.fromEntries(pairs)))
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

  const roundOnlyLabel = r => tt('dashReal.roundOnlyLabel', { attempt: r.attempt_number });

  // ตัวแทนรอบของแต่ละปีการศึกษา (ปีปัจจุบัน + ย้อนหลัง) — ใช้รอบล่าสุดของปีนั้นเป็นตัวแทน
  // เลือกตามรอบเจาะจงค่อยเพิ่มทีหลัง ตอนนี้เอาแค่เลือกตามปีก่อน
  const roundsByYear = new Map();
  rounds.forEach(r => {
    const existing = roundsByYear.get(r.academic_year);
    if (!existing || r.attempt_number > existing.attempt_number) roundsByYear.set(r.academic_year, r);
  });
  const yearOptions = [...roundsByYear.values()].sort((a, b) => b.academic_year - a.academic_year).slice(0, 3);
  // ปีปัจจุบัน = ปีของรอบที่ status เปิดรับอยู่จริง ไม่ใช่ปีของรอบที่กำลังแสดงผลอยู่ตอนนี้
  // (ถ้าอิงรอบที่แสดงผล พอเลือกปีอื่น ปีปัจจุบันจะขยับตาม ทำให้ปีนั้นหายไปจากตัวเลือก)
  const openRound = rounds.find(r => r.status === 'open');
  const currentYear = openRound ? openRound.academic_year : yearOptions[0]?.academic_year;
  // รอบทั้งหมดของปีที่กำลังแสดงผลอยู่ — เอาแค่รอบที่มีจริง ไม่ fix จำนวนไว้ล่วงหน้า
  const roundsInYear = rounds.filter(r => r.academic_year === round.academic_year).sort((a, b) => a.attempt_number - b.attempt_number);

  return (
    <div className="fade-up">
      {/* เจ้าหน้าที่: สถานะรอบกับข้อมูลรุ่นไปอยู่ในแถบรอบข้างล่างแล้ว ไม่ต้องซ้ำบนหัวข้ออีก
          ผู้บริหาร (readonly) ไม่มีแถบรอบ เลยยังต้องโชว์ตรงนี้เหมือนเดิม */}
      <PageHead title={<>
          {tt('dashReal.title')}
          {readonly && <span className={`badge ${round.status === 'open' ? 'ok' : 'reject'}`} style={{ marginLeft: 10, verticalAlign: 'middle' }}>
            <span className="dot" />{round.status === 'open' ? tt('dashReal.roundOpenLabel') : tt('dashReal.roundClosedLabel')}
          </span>}
        </>}
        sub={readonly ? tt('dashReal.subInfo', { year: round.academic_year, total, eligible }) : null}
        actions={<>
          <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 10, maxWidth: '100%' }}>
            {!readonly && <select className="input" value={roundPick} onChange={e => {
                const v = e.target.value;
                setRoundPick(v);
                if (v === '') {
                  // "ทั้งหมด" ต้องยังอยู่ปีเดิมที่กำลังดู — ปีปัจจุบันปล่อยว่างให้ backend เลือกรอบเปิดเองได้เลย
                  // ปีอื่นต้อง resolve เป็น round_id จริงของปีนั้น ไม่งั้นค่าว่างจะไปเรียกรอบเปิดของปีปัจจุบันแทน (คนละปี)
                  const rep = roundsInYear[roundsInYear.length - 1];
                  setRoundId(round.academic_year === currentYear ? '' : (rep ? String(rep.round_id) : ''));
                } else {
                  setRoundId(v);
                }
              }}
              style={{ width: 'auto', maxWidth: '100%', padding: '8px 30px 8px 12px', flex: 'none' }} aria-label={tt('dashReal.roundPickLabel')}>
              <option value="">{tt('common.all')}</option>
              {roundsInYear.map(r => <option key={r.round_id} value={r.round_id}>{roundOnlyLabel(r)}</option>)}
            </select>}
            <select className="input" value={round.academic_year} onChange={e => {
                const y = Number(e.target.value);
                const rep = yearOptions.find(r => r.academic_year === y);
                setRoundPick(''); // เปลี่ยนปีแล้วกลับไป "ทั้งหมด" ของปีใหม่เสมอ — รอบเจาะจงของปีเก่าใช้กับปีใหม่ไม่ได้
                setRoundId(y === currentYear ? '' : (rep ? rep.round_id : ''));
              }}
              style={{ width: 'auto', maxWidth: '100%', padding: '8px 30px 8px 12px', flex: 'none' }} aria-label={tt('dashReal.roundSelectLabel')}>
              <option value={currentYear}>{tt('dashReal.currentYearOption', { year: currentYear })}</option>
              {yearOptions.filter(r => r.academic_year !== currentYear).map(r =>
                <option key={r.academic_year} value={r.academic_year}>{tt('dashReal.yearOption', { year: r.academic_year })}</option>)}
            </select>
          </div>
        </>} />

      {/* เจ้าหน้าที่เปิดหน้านี้มาเพื่อรู้ 2 อย่างก่อนเสมอ: รอบปิดเมื่อไหร่ กับ ตามครบยัง
          เลยยกขึ้นบนสุดเป็นแถบเดียว ก่อนจะไปดูสถิติอื่น */}
      {!readonly && <RoundBar round={round} roundInfo={rounds.find(r => r.round_id === round.round_id)}
        submitted={submitted} eligible={eligible} fillRate={fillRate} total={total} tt={tt} />}

      {!readonly && <div className="grid g-5" style={{ marginBottom: 20 }}>
        <StatCard icon="users" label={tt('dashReal.eligibleStatLabel')} value={eligible} sub={tt('dashReal.eligibleStatSub', { total })} tone="navy" accent onClick={() => go('students')} />
        <StatCard icon="edit" label={tt('dashReal.submittedStatLabel')} value={submitted} sub={tt('dashReal.submittedStatSub', { rate: fillRate })} tone="blue" accent onClick={() => go('students')} />
        <StatCard icon="clock" label={tt('status.SUBMITTED')} value={by.submitted} sub={tt('dashReal.pendingSub')} tone="wait" accent onClick={() => go('review')} />
        <StatCard icon="checkCircle" label={tt('status.CONFIRMED')} value={by.approved} sub={tt('dashReal.confirmedSub', { n: fullyPassed, rate: fullyPassedRate })} tone="ok" accent />
        <StatCard icon="xCircle" label={tt('status.REJECTED')} value={by.rejected} sub={tt('dashReal.rejectedSub')} tone="reject" accent onClick={() => go('review')} />
      </div>}

      {/* ผู้บริหาร: แถบสรุปตัวเลขสำคัญ 3 ตัว อ่านจบใน 10 วินาที + กราฟภาพรวมของปีที่เลือก
          เจ้าหน้าที่ไม่ต้องเห็น เพราะเขาดูงานค้างรายวันจากการ์ดข้างบนแทน */}
      {readonly && history && history.years.length > 0 && (
        <ExecutiveOverview history={history} round={round} perSubject={perSubject} lang={lang} tt={tt} />
      )}

      <div className="row wrap-m" style={{ alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: '1 1 320px', minWidth: 0 }}>
          {readonly && history && history.years.length > 0 && <SubjectHistoryChart history={history} firstRoundSubjects={firstRoundSubjects} tt={tt} />}
          {/* การ์ด "สัดส่วนสถานะการตรวจสอบ" — ผู้บริหารคณะไม่ต้องเห็น (คอมเมนต์พักไว้ก่อน ยังไม่ลบ) */}
          {!readonly && (
          <div className="card card-pad">
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>{tt('dashReal.statusBreakdownTitle')}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              {/* ตรงกลางวงต้องเป็น total — backend การันตีว่า 5 ช่องบวกกันได้เท่า total พอดี */}
              <Donut segments={segs} center={<><div className="tnum" style={{ fontSize: 26, fontWeight: 800 }}>{total}</div><div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{tt('dashReal.eligibleLabel')}</div></>} />
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
          )}
          {/* เจ้าหน้าที่: การ์ดสถิติย้อนหลังทั้งหมดไปรวมกันในบล็อก "สถิติเชิงรายงาน" ข้างล่าง
              ไม่ยัดในคอลัมน์นี้ เพราะทำให้ฝั่งซ้ายยาวกว่าฝั่งขวาเกือบเท่าตัว */}
          {readonly && history && history.years.length > 0 && <FirstAttemptPassRate history={history} tt={tt} />}
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
              // เขียว = สัดส่วนที่ผ่าน, แดง = ส่วนที่เหลือคือไม่ผ่าน
              // อ่านออกทันทีแม้ 0% (แดงเต็มแถบ) ซึ่งเดิมเป็นรางเปล่าดูไม่ต่างจาก "ไม่มีข้อมูล"
              return (
                <BarRow key={sub.subject_id} label={label} value={sub.rate} max={100}
                  color="var(--pass)" track="var(--fail)"
                  right={`${sub.rate}%`} sub={tt('dashReal.passFailSub', { pass: sub.pass, fail: sub.fail })} />
              );
            })}
          </div>
        </div>
      </div>

      {/* บล็อกสถิติเชิงรายงาน — ของที่เจ้าหน้าที่ใช้ตอนทำรายงานส่งผู้บริหาร/สภาการพยาบาล
          แยกออกจากงานประจำวันด้านบนด้วยเส้นคั่น จะได้ไม่ปนกัน */}
      {!readonly && history && history.years.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, flex: 'none' }}>{tt('dashReal.reportSectionTitle')}</h2>
            <div style={{ height: 1, background: 'var(--ink-100)', flex: 1 }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <FirstAttemptPassRate history={history} tt={tt} wide />
            <PassDistribution year={history.years.find(y => y.academic_year === round.academic_year)} tt={tt} />
            <YearCompare history={history} tt={tt} />
          </div>
        </div>
      )}

      {/* ผู้บริหารเห็นตารางนี้ต่อท้ายเหมือนเดิม ไม่มีบล็อกคั่น */}
      {readonly && history && (
        <div style={{ marginTop: 20 }}>
          <PassDistribution year={history.years.find(y => y.academic_year === round.academic_year)} tt={tt} />
        </div>
      )}
    </div>
  );
}

/* ---------- ภาพรวมผู้บริหาร ----------
   แถบตัวเลขหลัก 3 ตัว + กราฟ 2 ใบ ใช้ข้อมูลจริงจาก /dashboard/history ทั้งหมด
   ตัวเลขทุกตัวคำนวณที่ backend แล้ว ฝั่งนี้แค่หยิบมาแสดง */
function ExecutiveOverview({ history, round, perSubject, lang, tt }) {
  // ปีที่กำลังดูอยู่ + ปีก่อนหน้า (ไว้คำนวณว่าดีขึ้น/แย่ลงกี่จุด)
  const year = history.years.find(y => y.academic_year === round.academic_year) || history.years[0];
  const prevYear = history.years.find(y => y.academic_year === year.academic_year - 1);

  const first = year.firstAttempt || { passed: 0, rate: 0 };
  const cumulative = year.firstYear || { passed: 0, rate: 0 };
  let delta = null;
  if (prevYear && prevYear.firstAttempt) delta = first.rate - prevYear.firstAttempt.rate;

  // วิชาที่ต้องเฝ้าระวัง = อัตราผ่านต่ำสุดของรอบที่กำลังดู (ข้าม null = ไม่มีใครสอบวิชานั้น)
  const sat = perSubject.filter(s => s.rate !== null);
  const sortedByRate = [...sat].sort((a, b) => a.rate - b.rate);
  const worst = sortedByRate[0];

  // อัตราผ่านของแต่ละครั้งที่สอบ = ผ่านครบทุกวิชา ÷ คนที่ส่งผลในรอบนั้น
  const attempts = [...year.rounds].sort((a, b) => a.attempt_number - b.attempt_number);
  const attemptBars = attempts.map((r, i) => {
    let rate = 0;
    if (r.submitted) rate = Math.round((r.fullyPassed / r.submitted) * 100);
    // ครั้งแรกเป็นสีหลัก ครั้งถัดไปจางลงเรื่อยๆ — เห็นลำดับได้โดยไม่ต้องอ่าน label
    const palette = ['var(--navy-700)', 'var(--navy-500)', 'var(--ink-300)'];
    return {
      label: tt('dashReal.attemptLabel', { n: r.attempt_number }),
      value: rate,
      color: palette[Math.min(i, palette.length - 1)],
      pass: r.fullyPassed,
      sat: r.submitted,
    };
  });

  // เทียบย้อนหลัง: 2 เส้น ผ่านครั้งแรก vs ผ่านสะสมทั้งปี — เรียงเก่าไปใหม่
  const yearsOldToNew = [...history.years].sort((a, b) => a.academic_year - b.academic_year);
  const compareCategories = yearsOldToNew.map(y => String(y.academic_year));
  const compareSeries = [
    {
      label: tt('dashReal.seriesFirst'),
      color: 'var(--navy-700)',
      values: yearsOldToNew.map(y => (y.firstAttempt ? y.firstAttempt.rate : 0)),
    },
    {
      label: tt('dashReal.seriesCumulative'),
      color: 'var(--pass)',
      values: yearsOldToNew.map(y => (y.firstYear ? y.firstYear.rate : 0)),
    },
  ];

  return (
    <>
      <div className="card" style={{ padding: 0, marginBottom: 20, overflow: 'hidden',
        background: 'linear-gradient(135deg, var(--navy-700), var(--navy-900))', color: '#fff' }}>
        <div className="exec-hero" style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr 1fr' }}>
          <div style={{ padding: '24px 30px', borderRight: '1px solid rgba(255,255,255,.14)' }}>
            <div style={{ fontSize: 13.5, opacity: .85, fontWeight: 600, marginBottom: 6 }}>{tt('dashReal.heroFirstLabel')}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span className="tnum" style={{ fontSize: 50, fontWeight: 800, color: 'var(--gold-100)', lineHeight: 1 }}>
                {first.rate.toFixed(2)}%
              </span>
              {delta !== null && delta !== 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 700,
                  color: delta > 0 ? '#7fe0a8' : '#ffb4ab' }}>
                  {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}%
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, opacity: .8, marginTop: 8 }}>
              {tt('dashReal.heroFirstSub', { pass: first.passed, total: year.total })}
            </div>
          </div>

          <div style={{ padding: '24px 30px', borderRight: '1px solid rgba(255,255,255,.14)' }}>
            <div style={{ fontSize: 13.5, opacity: .85, fontWeight: 600, marginBottom: 6 }}>{tt('dashReal.heroCumulativeLabel')}</div>
            <div className="tnum" style={{ fontSize: 38, fontWeight: 800, lineHeight: 1, color: '#7fe0a8' }}>
              {cumulative.rate.toFixed(2)}%
            </div>
            <div className="pbar" style={{ marginTop: 12, background: 'rgba(255,255,255,.22)' }}>
              <i style={{ width: `${cumulative.rate}%`, background: '#7fe0a8' }} />
            </div>
            <div style={{ fontSize: 12.5, opacity: .8, marginTop: 8 }}>
              {tt('dashReal.heroCumulativeSub', { total: year.total })}
            </div>
          </div>

          <div style={{ padding: '24px 30px' }}>
            <div style={{ fontSize: 13.5, opacity: .85, fontWeight: 600, marginBottom: 6 }}>{tt('dashReal.heroWatchLabel')}</div>
            {worst ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, lineHeight: 1.35 }}>
                  {subjectName(lang, worst.subject_code, worst.subject_name)}
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '4px 11px',
                  background: 'rgba(224,73,59,.25)', borderRadius: 999, fontSize: 13, fontWeight: 700, color: '#ffb4ab' }}>
                  <Icon name="alert" size={14} /> {tt('dashReal.heroWatchChip', { rate: worst.rate })}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13.5, opacity: .8, marginTop: 4 }}>{tt('dashReal.heroWatchEmpty')}</div>
            )}
          </div>
        </div>
        {/* จอแคบ: เรียงลงล่างแทน 3 คอลัมน์ ไม่งั้นตัวเลขโดนบีบจนอ่านไม่ออก */}
        <style>{`@media(max-width:860px){.exec-hero{grid-template-columns:1fr!important;}.exec-hero>div{border-right:none!important;border-bottom:1px solid rgba(255,255,255,.14);}}`}</style>
      </div>

      <div className="row wrap-m" style={{ marginBottom: 20, alignItems: 'stretch' }}>
        <div className="card card-pad" style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>{tt('dashReal.perAttemptTitle')}</h3>
          <p style={{ margin: '0 0 14px', color: 'var(--ink-500)', fontSize: 13 }}>
            {tt('dashReal.perAttemptSub', { year: year.academic_year })}
          </p>
          {attemptBars.length > 0 ? (
            <>
              <ColumnChart height={170} data={attemptBars} fmt={v => `${v}%`} />
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                {attemptBars.map(a => (
                  <div key={a.label} style={{ flex: 1, padding: '10px 12px', background: 'var(--ink-50)', borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{a.label}</div>
                    <div className="tnum" style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{a.pass}/{a.sat}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-400)' }}>{tt('dashReal.unitPeople')}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--ink-500)', fontSize: 13.5 }}>{tt('dashReal.distEmpty')}</div>
          )}
        </div>

        <div className="card card-pad" style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>
            {tt('dashReal.yearCompareTitle', { n: yearsOldToNew.length })}
          </h3>
          <p style={{ margin: '0 0 14px', color: 'var(--ink-500)', fontSize: 13 }}>{tt('dashReal.compareSub')}</p>
          <MultiLineChart height={190} categories={compareCategories} series={compareSeries} />
        </div>
      </div>
    </>
  );
}

/* แถบสรุปรอบที่กำลังดูอยู่ — วันปิดรับ + ความคืบหน้าการกรอก
   roundInfo มาจาก GET /rounds (มี close_date) ส่วน round จาก /dashboard/stats ไม่มีวันที่ */
function RoundBar({ round, roundInfo, submitted, eligible, fillRate, total, tt }) {
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
  if (daysLeft !== null) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
        <Icon name="calendar" size={18} style={{ color: 'var(--navy-600)' }} />
        <span style={{ fontWeight: 800, fontSize: 15 }}>
          {tt('dashReal.roundBarTitle', { attempt: round.attempt_number, year: round.academic_year })}
        </span>
        <span className={`badge ${round.status === 'open' ? 'ok' : 'draft'}`}>
          <span className="dot" />{round.status === 'open' ? tt('dashReal.roundOpenLabel') : tt('dashReal.roundClosedLabel')}
        </span>
      </div>

      {roundInfo && (
        <div style={{ fontSize: 13, color: 'var(--ink-500)', flex: 'none' }}>
          {tt('dashReal.roundBarClose', { date: closeText })}
          {deadlineText && <span style={{ color: deadlineTone, fontWeight: 700 }}> · {deadlineText}</span>}
        </div>
      )}

      {/* ข้อมูลรุ่น — ย้ายมาจากใต้หัวข้อหน้า จะได้อยู่รวมกับเรื่องรอบทั้งหมดในแถบเดียว */}
      <div style={{ fontSize: 13, color: 'var(--ink-500)', flex: 'none' }}>
        {tt('dashReal.subInfo', { year: round.academic_year, total, eligible })}
      </div>

      {/* ความคืบหน้าการกรอก — ตัวเลขเดียวกับการ์ด "ส่งผลสอบแล้ว" ข้างล่าง แต่ตรงนี้ให้เห็นเป็นแถบเทียบกับเวลาที่เหลือ */}
      <div style={{ flex: '1 1 160px', minWidth: 140, marginLeft: 'auto' }}>
        <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginBottom: 5, textAlign: 'right' }}>
          {tt('dashReal.roundBarProgress', { submitted, total, rate: fillRate })}
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
function PassDistribution({ year, tt }) {
  if (!year) return null;
  const dist = year.passDistribution;

  return (
    <div className="card card-pad">
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>{tt('dashReal.distTitle')}</h3>
      <p style={{ margin: '0 0 16px', color: 'var(--ink-500)', fontSize: 13 }}>
        {tt('dashReal.distSub', { year: year.academic_year })}
      </p>

      {!dist || dist.total === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-500)', fontSize: 13.5 }}>
          {tt('dashReal.distEmpty')}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 120 + dist.rooms.length * 150, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--ink-500)', fontSize: 12.5 }}>
                <th rowSpan={2} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--ink-100)' }}>
                  {tt('dashReal.distColResult')}
                </th>
                {dist.rooms.map(r => (
                  <th key={r.room_id} colSpan={2} style={{ padding: '8px 10px', borderBottom: '1px solid var(--ink-100)' }}>
                    {tt('dashReal.distRoomHead', { room: r.room_name, n: r.total })}
                  </th>
                ))}
                <th colSpan={2} style={{ padding: '8px 10px', borderBottom: '1px solid var(--ink-100)', background: 'var(--gold-50)' }}>
                  {tt('dashReal.distRoomHead', { room: tt('dashReal.distColTotal'), n: dist.total })}
                </th>
              </tr>
              <tr style={{ color: 'var(--ink-500)', fontSize: 11.5 }}>
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
          <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--ink-500)' }}>
            {tt('dashReal.distFootnote', { total: dist.total })}
          </p>
        </div>
      )}
    </div>
  );
}

// สี 3 ปีย้อนหลัง — ปีล่าสุดเข้มสุด เก่าสุดจางสุด รองรับปีเพิ่มในอนาคตด้วย modulo
const HISTORY_COLORS = ['var(--navy-600)', 'var(--blue-600)', 'var(--ink-300)', '#c9971f', '#8b5e34'];

// อัตราผ่านรายวิชาย้อนหลัง 3 ปี — เส้นละปี, แกน x = รหัสวิชา, ข้อมูลอัปเดตตาม /dashboard/history อัตโนมัติเมื่อมีรอบ/ปีใหม่เข้ามา
function SubjectHistoryChart({ history, firstRoundSubjects, tt }) {
  const [expanded, setExpanded] = useState(false);
  // ใช้แค่ผลรอบแรก (attempt_number=1) ของแต่ละปี ไม่รวมรอบถัดไป — ดึงจาก firstRoundSubjects ไม่ใช่ y.perSubject (นั่นรวมทุกรอบ)
  const years = [...history.years]
    .filter(y => firstRoundSubjects[y.academic_year]?.length > 0)
    .sort((a, b) => a.academic_year - b.academic_year); // เก่า→ใหม่ อ่านซ้ายไปขวา

  if (years.length === 0) return null;

  const categories = firstRoundSubjects[years[years.length - 1].academic_year].map(s => s.subject_code);
  const series = years.map((y, i) => {
    const perSubject = firstRoundSubjects[y.academic_year];
    return {
      label: String(y.academic_year),
      color: HISTORY_COLORS[i % HISTORY_COLORS.length],
      values: categories.map(code => perSubject.find(s => s.subject_code === code)?.rate ?? 0),
      tooltips: categories.map(code => {
        const s = perSubject.find(x => x.subject_code === code);
        if (!s) return '';
        return tt('dashReal.subjectPointTooltip', { year: y.academic_year, code, pass: s.pass, total: s.pass + s.fail, rate: s.rate });
      }),
    };
  });

  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>{tt('dashReal.subjectHistoryTitle')}</h3>
          <p style={{ margin: 0, color: 'var(--ink-500)', fontSize: 13 }}>{tt('dashReal.subjectHistorySub')}</p>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ padding: 7, flex: 'none' }} title={tt('dashReal.expandChart')} onClick={() => setExpanded(true)}>
          <Icon name="expand" size={16} />
        </button>
      </div>
      <div style={{ marginTop: 16 }}>
        <MultiLineChart categories={categories} series={series} height={220} width={640} />
      </div>

      <Modal open={expanded} onClose={() => setExpanded(false)} title={tt('dashReal.subjectHistoryTitle')} width={860}>
        <MultiLineChart categories={categories} series={series} height={380} width={800} legendSize={13} />
      </Modal>
    </div>
  );
}

/* เทียบผลรุ่นต่อรุ่นย้อนหลัง — นับเป็นรายคน คนที่กรอกหลายรอบในปีเดียวนับครั้งเดียว
   ผ่านครบทุกวิชา แยกเป็นคอลัมน์ตามห้องเรียน (ปกติ/ภาษาอังกฤษ) — room_name มาจาก DB ตรงๆ ไม่ hardcode ชื่อห้อง */
function YearCompare({ history, tt }) {
  // รวมรายชื่อห้องจากทุกปีที่ดึงมา (เผื่อบางปีไม่มีคนส่งในบางห้อง) เรียงตาม room_id ให้ลำดับคอลัมน์คงที่
  const rooms = [...new Map(
    history.years.flatMap(y => y.byRoom.map(r => [r.room_id, r]))
  ).values()].sort((a, b) => a.room_id - b.room_id);

  return (
    <div className="card card-pad">
      <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>{tt('dashReal.colFullPass')}</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 100 + rooms.length * 80, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'center', color: 'var(--ink-500)', fontSize: 12.5 }}>
              <th style={{ padding: '8px 10px' }}>{tt('dashReal.colYear')}</th>
              {rooms.map(r => <th key={r.room_id} style={{ padding: '8px 10px', minWidth: 70 }}>{r.room_name}</th>)}
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
                      <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--ink-500)' }}>{room.passRate.toFixed(2)}%</div>
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
function FirstAttemptPassRate({ history, tt, wide }) {
  const [expanded, setExpanded] = useState(false);
  const yearsOldToNew = [...history.years].reverse();
  // 2 ตัวเลขนี้ backend คำนวณมาให้แล้ว (ตัวหาร = นักศึกษาทั้งรุ่น = ผู้สำเร็จการศึกษาปีนั้น)
  //   firstAttempt = ผ่านครบทุกวิชาตั้งแต่รอบที่ 1
  //   firstYear    = ผ่านครบทุกวิชาในรอบไหนก็ได้ของปีนั้น
  const rateOf = (y) => y.firstAttempt || { passed: 0, rate: 0 };

  const YearBlock = ({ y, i, compact }) => {
    const { passed, rate } = rateOf(y);
    const firstYear = y.firstYear || { passed: 0, rate: 0 };
    const prev = i > 0 ? rateOf(yearsOldToNew[i - 1]) : null;
    const diff = prev ? rate - prev.rate : null;
    const tone = rate >= 80 ? 'var(--status-ok-dot)' : 'var(--status-wait-dot)';
    return (
      <div style={compact
        ? { paddingTop: i > 0 ? 14 : 0, marginTop: i > 0 ? 14 : 0, borderTop: i > 0 ? '1px solid var(--ink-100)' : 'none' }
        : { width: 220, flex: 'none', padding: i > 0 ? '0 24px' : '0 24px 0 0', borderLeft: i > 0 ? '1px solid var(--ink-100)' : 'none' }}>
        <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 6 }}>{tt('dashReal.yearOption', { year: y.academic_year })}</div>
        <div className="tnum" style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>{rate.toFixed(2)}%</div>
        <div className="pbar" style={{ marginBottom: 10 }}><i style={{ width: `${rate}%`, background: tone }} /></div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-600)' }}>{tt('dashReal.firstAttemptSub', { passed })}</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{tt('dashReal.firstAttemptTotal', { total: y.total })}</div>
        {/* ผ่านภายในปีแรก = รวมรอบ 2, 3 ด้วย เลยสูงกว่าหรือเท่ากับผ่านครั้งแรกเสมอ */}
        <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--ink-100)' }}>
          {tt('dashReal.firstYearTitle')} <b className="tnum">{firstYear.rate.toFixed(2)}%</b>
          <div style={{ color: 'var(--ink-500)' }}>{tt('dashReal.firstYearSub', { passed: firstYear.passed })}</div>
        </div>
        <div style={{ fontSize: 12, color: diff == null ? 'var(--ink-400)' : diff >= 0 ? 'var(--status-ok-fg)' : 'var(--status-reject-fg)', marginTop: 6 }}>
          {tt('dashReal.firstAttemptDiffLabel')} {diff == null ? '—' : `${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(2)}`}
        </div>
      </div>
    );
  };

  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>{tt('dashReal.firstAttemptTitle')}</h3>
          <p style={{ margin: 0, color: 'var(--ink-500)', fontSize: 13 }}>{tt('dashReal.firstAttemptSubtitle')}</p>
        </div>
        {/* โหมดกว้างเรียงปีข้างกันอยู่แล้ว ไม่ต้องมีปุ่มขยาย */}
        {!wide && <button className="btn btn-ghost btn-sm" style={{ padding: 7, flex: 'none' }} title={tt('dashReal.expandChart')} onClick={() => setExpanded(true)}>
          <Icon name="expand" size={16} />
        </button>}
      </div>
      {/* wide = การ์ดอยู่เต็มความกว้าง เรียงปีข้างกันได้ / ไม่ wide = อยู่คอลัมน์แคบ ต้องเรียงลงล่าง */}
      <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 0 }}>
        {yearsOldToNew.map((y, i) => <YearBlock key={y.academic_year} y={y} i={i} compact={!wide} />)}
      </div>

      <Modal open={expanded} onClose={() => setExpanded(false)} title={tt('dashReal.firstAttemptTitle')} width={yearsOldToNew.length * 268 + 40}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
          {yearsOldToNew.map((y, i) => <YearBlock key={y.academic_year} y={y} i={i} compact={false} />)}
        </div>
      </Modal>
    </div>
  );
}
