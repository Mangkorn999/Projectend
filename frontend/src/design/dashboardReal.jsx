/* ============================================================
   Dashboard สรุปผลสอบ (officer + executive) — ข้อมูลจริงจาก backend
   แทนที่ OfficerDashboard/ExecutiveDashboard เดิมที่ใช้ mock STUDENTS/TREND
   ดึงจาก GET /api/dashboard/stats (คำนวณรวมฝั่ง backend อยู่แล้ว ไม่คำนวณซ้ำฝั่ง frontend)
   + GET /api/dashboard/history สำหรับเทียบย้อนหลังรายปี
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, StatCard, Donut, BarRow, MultiLineChart, Modal } from './components.jsx';
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
      <PageHead title={<>
          {tt('dashReal.title')}
          <span className={`badge ${round.status === 'open' ? 'ok' : 'reject'}`} style={{ marginLeft: 10, verticalAlign: 'middle' }}>
            <span className="dot" />{round.status === 'open' ? tt('dashReal.roundOpenLabel') : tt('dashReal.roundClosedLabel')}
          </span>
        </>}
        sub={tt('dashReal.subInfo', { year: round.academic_year, total, eligible })}
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

      {!readonly && <div className="grid g-5" style={{ marginBottom: 20 }}>
        <StatCard icon="users" label={tt('dashReal.eligibleStatLabel')} value={eligible} sub={tt('dashReal.eligibleStatSub', { total })} tone="navy" accent onClick={() => go('students')} />
        <StatCard icon="edit" label={tt('dashReal.submittedStatLabel')} value={submitted} sub={tt('dashReal.submittedStatSub', { rate: fillRate })} tone="blue" accent onClick={() => go('students')} />
        <StatCard icon="clock" label={tt('status.SUBMITTED')} value={by.submitted} sub={tt('dashReal.pendingSub')} tone="wait" accent onClick={() => go('review')} />
        <StatCard icon="checkCircle" label={tt('status.CONFIRMED')} value={by.approved} sub={tt('dashReal.confirmedSub', { n: fullyPassed, rate: fullyPassedRate })} tone="ok" accent />
        <StatCard icon="xCircle" label={tt('status.REJECTED')} value={by.rejected} sub={tt('dashReal.rejectedSub')} tone="reject" accent onClick={() => go('review')} />
      </div>}

      <div className="row wrap-m" style={{ alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: '1 1 320px', minWidth: 0 }}>
          {readonly && history && history.years.length > 0 && <SubjectHistoryChart history={history} firstRoundSubjects={firstRoundSubjects} tt={tt} />}
          {/* การ์ด "สัดส่วนสถานะการตรวจสอบ" — ผู้บริหารคณะไม่ต้องเห็น (คอมเมนต์พักไว้ก่อน ยังไม่ลบ) */}
          {!readonly && (
          <div className="card card-pad">
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
          )}
          {!readonly && history && history.years.length > 0 && <YearCompare history={history} tt={tt} />}
          {history && history.years.length > 0 && <FirstAttemptPassRate history={history} tt={tt} />}
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
                  const room = y.byRoom.find(b => b.room_id === r.room_id) || { fullyPassed: 0, submitted: 0 };
                  return (
                    <td key={r.room_id} className="tnum" style={{ padding: '10px', fontWeight: 700, textAlign: 'center' }}>
                      <span style={{ color: 'var(--status-ok-dot)' }}>{room.fullyPassed}</span> / {room.submitted}
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
function FirstAttemptPassRate({ history, tt }) {
  const [expanded, setExpanded] = useState(false);
  const yearsOldToNew = [...history.years].reverse();
  const rateOf = (y) => {
    const round1 = y.rounds.find(r => r.attempt_number === 1);
    const passed = round1 ? round1.fullyPassed : 0;
    return { passed, rate: y.total ? (passed / y.total) * 100 : 0 };
  };

  const YearBlock = ({ y, i, compact }) => {
    const { passed, rate } = rateOf(y);
    const prev = i > 0 ? rateOf(yearsOldToNew[i - 1]) : null;
    const diff = prev ? rate - prev.rate : null;
    const tone = rate >= 80 ? 'var(--status-ok-dot)' : 'var(--status-wait-dot)';
    return (
      <div style={compact
        ? { paddingTop: i > 0 ? 14 : 0, marginTop: i > 0 ? 14 : 0, borderTop: i > 0 ? '1px solid var(--ink-100)' : 'none' }
        : { width: 220, flex: 'none', padding: '0 24px', borderLeft: i > 0 ? '1px solid var(--ink-100)' : 'none' }}>
        <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 6 }}>{tt('dashReal.yearOption', { year: y.academic_year })}</div>
        <div className="tnum" style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>{rate.toFixed(2)}%</div>
        <div className="pbar" style={{ marginBottom: 10 }}><i style={{ width: `${rate}%`, background: tone }} /></div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-600)' }}>{tt('dashReal.firstAttemptSub', { passed })}</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{tt('dashReal.firstAttemptTotal', { total: y.total })}</div>
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
        <button className="btn btn-ghost btn-sm" style={{ padding: 7, flex: 'none' }} title={tt('dashReal.expandChart')} onClick={() => setExpanded(true)}>
          <Icon name="expand" size={16} />
        </button>
      </div>
      <div style={{ marginTop: 16 }}>
        {yearsOldToNew.map((y, i) => <YearBlock key={y.academic_year} y={y} i={i} compact />)}
      </div>

      <Modal open={expanded} onClose={() => setExpanded(false)} title={tt('dashReal.firstAttemptTitle')} width={yearsOldToNew.length * 268 + 40}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
          {yearsOldToNew.map((y, i) => <YearBlock key={y.academic_year} y={y} i={i} compact={false} />)}
        </div>
      </Modal>
    </div>
  );
}
