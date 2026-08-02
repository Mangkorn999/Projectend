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

export function DashboardReal({ go, readonly }) {
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

  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>โหลดข้อมูลไม่สำเร็จ: {error}</div>;
  if (loading && !stats) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>กำลังโหลดข้อมูล…</div>;
  if (!stats) return null;

  const { round, total, eligible, by, not_started, submitted, fillRate,
          fullyPassed, fullyPassedRate, subjectPassRate, perSubject } = stats;

  // วงกลมต้องรวมได้เท่ากับจำนวนคนที่กรอกได้ ไม่งั้นตัวเลขตรงกลางกับวงจะไม่ตรงกัน
  const segs = [
    { key: 'CONFIRMED', label: 'ยืนยันแล้ว', value: by.approved, color: 'var(--status-ok-dot)' },
    { key: 'SUBMITTED', label: 'รอตรวจสอบ', value: by.submitted, color: 'var(--status-wait-dot)' },
    { key: 'REJECTED', label: 'ถูกตีกลับ', value: by.rejected, color: 'var(--status-reject-dot)' },
    { key: 'DRAFT', label: 'กรอกค้างไว้', value: by.draft, color: 'var(--ink-200)' },
    { key: 'NONE', label: 'ยังไม่เริ่มกรอก', value: not_started, color: 'var(--ink-300)' },
  ].filter(s => s.value > 0 || s.key !== 'DRAFT'); // draft ปกติเป็น 0 ไม่ต้องรกตา

  const roundLabel = r => `รอบที่ ${r.attempt_number}/${r.academic_year}${r.status === 'open' ? ' · เปิดรับ' : ''}`;

  return (
    <div className="fade-up">
      <PageHead title="แดชบอร์ดสรุปผลสอบ"
        sub={`${roundLabel(round)} · นักศึกษารุ่น ${round.academic_year} ทั้งหมด ${total} คน เปิดสิทธิ์กรอกแล้ว ${eligible} คน`}
        actions={<>
          <select className="input" value={roundId} onChange={e => setRoundId(e.target.value)}
            style={{ minWidth: 200, height: 40 }} aria-label="เลือกรอบการกรอกผลสอบ">
            <option value="">รอบที่เปิดรับอยู่</option>
            {rounds.map(r => <option key={r.round_id} value={r.round_id}>{roundLabel(r)}</option>)}
          </select>
          {!readonly && <button className="btn btn-primary" onClick={() => go('review')}><Icon name="checkCircle" size={17} /> ไปตรวจสอบ
            <span className="nav-badge" style={{ background: 'var(--gold-500)', color: '#3a2c05', marginLeft: 2 }}>{by.submitted}</span></button>}
        </>} />

      <div className="grid g-5" style={{ marginBottom: 20 }}>
        <StatCard icon="users" label="กรอกผลสอบได้" value={eligible} sub={`จากนักศึกษารุ่นนี้ ${total} คน`} tone="navy" accent onClick={() => go('students')} />
        <StatCard icon="edit" label="ส่งผลสอบแล้ว" value={submitted} sub={`คิดเป็น ${fillRate}% ของคนที่กรอกได้`} tone="blue" accent onClick={() => go('students')} />
        <StatCard icon="clock" label="รอตรวจสอบ" value={by.submitted} sub="รอเจ้าหน้าที่ยืนยัน" tone="wait" accent onClick={() => !readonly && go('review')} />
        <StatCard icon="checkCircle" label="ยืนยันแล้ว" value={by.approved} sub={`ผ่านครบทุกวิชา ${fullyPassed} คน (${fullyPassedRate}%)`} tone="ok" accent />
        <StatCard icon="xCircle" label="ถูกตีกลับ" value={by.rejected} sub="ต้องแก้ไขและส่งใหม่" tone="reject" accent onClick={() => !readonly && go('review')} />
      </div>

      <div className="row wrap-m" style={{ alignItems: 'flex-start' }}>
        <div className="card card-pad" style={{ flex: '1 1 320px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>สัดส่วนสถานะการตรวจสอบ</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <Donut segments={segs} center={<><div className="tnum" style={{ fontSize: 26, fontWeight: 800 }}>{eligible}</div><div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>กรอกได้</div></>} />
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
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>อัตราผ่านรายวิชา</h3>
            <span className="tnum chip" style={{ background: 'var(--blue-50)', color: 'var(--blue-600)', fontWeight: 700 }}>เฉลี่ยทุกวิชา {subjectPassRate}%</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {perSubject.map(sub => (
              <BarRow key={sub.subject_id} label={`${sub.subject_code} · ${sub.subject_name}`} value={sub.rate} max={100}
                color={sub.rate >= 70 ? 'var(--status-ok-dot)' : sub.rate >= 40 ? 'var(--status-wait-dot)' : 'var(--status-reject-dot)'}
                right={`${sub.rate}%`} sub={`ผ่าน ${sub.pass} / ไม่ผ่าน ${sub.fail}`} />
            ))}
          </div>
        </div>
      </div>

      {history && history.years.length > 0 && <YearCompare history={history} />}
    </div>
  );
}

/* เทียบผลรุ่นต่อรุ่นย้อนหลัง — นับเป็นรายคน คนที่กรอกหลายรอบในปีเดียวนับครั้งเดียว */
function YearCompare({ history }) {
  return (
    <div className="card card-pad" style={{ marginTop: 20 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>เปรียบเทียบย้อนหลัง {history.years.length} ปีการศึกษา</h3>
      <p style={{ margin: '0 0 16px', color: 'var(--ink-500)', fontSize: 13 }}>
        รวมทุกรอบในปีนั้นเข้าด้วยกัน นับเป็นรายคน — คนที่กรอกหลายรอบนับครั้งเดียว
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--ink-500)', fontSize: 12.5 }}>
              <th style={{ padding: '8px 10px' }}>ปีการศึกษา</th>
              <th style={{ padding: '8px 10px' }}>จำนวนรอบ</th>
              <th style={{ padding: '8px 10px' }}>กรอกได้</th>
              <th style={{ padding: '8px 10px' }}>ส่งแล้ว</th>
              <th style={{ padding: '8px 10px', minWidth: 150 }}>ผ่านครบทุกวิชา</th>
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
                  <BarRow label="" value={y.passRate} max={100} right={`${y.fullyPassed} คน · ${y.passRate}%`}
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
