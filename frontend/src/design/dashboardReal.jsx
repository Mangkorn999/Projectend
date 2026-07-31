/* ============================================================
   Dashboard สรุปผลสอบ (officer + executive) — ข้อมูลจริงจาก backend
   แทนที่ OfficerDashboard/ExecutiveDashboard เดิมที่ใช้ mock STUDENTS/TREND
   ดึงจาก GET /api/dashboard/stats (คำนวณรวมฝั่ง backend อยู่แล้ว ไม่คำนวณซ้ำฝั่ง frontend)
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, StatCard, Donut, BarRow } from './components.jsx';
import { apiFetch } from './api.js';

export function DashboardReal({ go, readonly }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/dashboard/stats')
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>กำลังโหลดข้อมูล…</div>;
  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>โหลดข้อมูลไม่สำเร็จ: {error}</div>;
  if (!stats) return null;

  const { round, total, by, not_started, submitted, fillRate, fullyPassed, overallPassRate, perSubject } = stats;
  const segs = [
    { key: 'CONFIRMED', label: 'ยืนยันแล้ว', value: by.approved, color: 'var(--status-ok-dot)' },
    { key: 'SUBMITTED', label: 'รอตรวจสอบ', value: by.submitted, color: 'var(--status-wait-dot)' },
    { key: 'REJECTED', label: 'ถูกตีกลับ', value: by.rejected, color: 'var(--status-reject-dot)' },
    { key: 'DRAFT', label: 'ยังไม่กรอก', value: not_started, color: 'var(--ink-300)' },
  ];

  return (
    <div className="fade-up">
      <PageHead title="แดชบอร์ดสรุปผลสอบ" sub={`รอบที่ ${round.attempt_number}/${round.academic_year} · สถานะ: ${round.status === 'open' ? 'เปิดรับ' : 'ปิดรับแล้ว'}`}
        actions={!readonly && <button className="btn btn-primary" onClick={() => go('review')}><Icon name="checkCircle" size={17} /> ไปตรวจสอบ
          <span className="nav-badge" style={{ background: 'var(--gold-500)', color: '#3a2c05', marginLeft: 2 }}>{by.submitted}</span></button>} />

      <div className="grid g-5" style={{ marginBottom: 20 }}>
        <StatCard icon="users" label="นักศึกษาทั้งหมด" value={total} sub={`ปีการศึกษา ${round.academic_year}`} tone="navy" accent onClick={() => go('students')} />
        <StatCard icon="edit" label="ส่งผลสอบแล้ว" value={submitted} sub={`คิดเป็น ${fillRate}%`} tone="blue" accent onClick={() => go('students')} />
        <StatCard icon="clock" label="รอตรวจสอบ" value={by.submitted} sub="รอเจ้าหน้าที่ยืนยัน" tone="wait" accent onClick={() => !readonly && go('review')} />
        <StatCard icon="checkCircle" label="ยืนยันแล้ว" value={by.approved} sub={`ผ่านครบทุกวิชา ${fullyPassed} คน`} tone="ok" accent />
        <StatCard icon="xCircle" label="ถูกตีกลับ" value={by.rejected} sub="ต้องแก้ไขและส่งใหม่" tone="reject" accent onClick={() => !readonly && go('review')} />
      </div>

      <div className="row wrap-m" style={{ alignItems: 'flex-start' }}>
        <div className="card card-pad" style={{ flex: '1 1 320px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>สัดส่วนสถานะการตรวจสอบ</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <Donut segments={segs} center={<><div className="tnum" style={{ fontSize: 26, fontWeight: 800 }}>{total}</div><div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>ทั้งหมด</div></>} />
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
            <span className="tnum chip" style={{ background: 'var(--blue-50)', color: 'var(--blue-600)', fontWeight: 700 }}>รวม {overallPassRate}%</span>
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
    </div>
  );
}
