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
import { apiFetch, getToken } from './api.js';

export function ReportsReal({ toast, readonly }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    apiFetch('/dashboard/stats').then(setStats).catch(e => setError(e.message));
  }, []);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      // ไฟล์ PDF ต้องแนบ Authorization header — เลย fetch เป็น blob เองแทนใช้ <a href> ตรงๆ
      const res = await fetch(`http://localhost:3000/api/dashboard/export?round_id=${stats.round.round_id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'ออกรายงาน PDF ไม่สำเร็จ');
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

  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>โหลดข้อมูลไม่สำเร็จ: {error}</div>;
  if (!stats) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>กำลังโหลดข้อมูล…</div>;

  const { round, total, by, not_started, submitted, fullyPassed, overallPassRate, perSubject } = stats;
  const summaryCards = [
    ['นักศึกษาทั้งหมด', total, 'navy'],
    ['ส่งผลสอบแล้ว', submitted, 'blue'],
    ['ผ่านครบทุกวิชา', fullyPassed, 'ok'],
    ['อัตราผ่านรวม', overallPassRate + '%', 'gold'],
  ];
  const byStatus = [
    ['CONFIRMED', by.approved], ['SUBMITTED', by.submitted], ['REJECTED', by.rejected], ['DRAFT', not_started],
  ];

  return (
    <div className="fade-up">
      <PageHead title="รายงานสรุปผลสอบ" sub={`รอบที่ ${round.attempt_number}/${round.academic_year}`}
        actions={<>
          <button className="btn btn-ghost no-print" onClick={() => window.print()}><Icon name="printer" size={16} /> พิมพ์</button>
          {!readonly && <button className="btn btn-primary no-print" disabled={downloading} onClick={downloadPdf}><Icon name="pdf" size={16} /> {downloading ? 'กำลังสร้างไฟล์…' : 'ดาวน์โหลด PDF'}</button>}
        </>} />

      <div className="card" style={{ padding: '34px 40px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 18, borderBottom: '2px solid var(--navy-700)' }}>
          <Logo size={48} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy-700)' }}>รายงานสรุปผลสอบใบประกอบวิชาชีพ</div>
            <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>รอบที่ {round.attempt_number}/{round.academic_year}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--ink-500)' }}>ออกรายงานเมื่อ<br />{new Date().toLocaleDateString('th-TH')}</div>
        </div>

        <div className="sec-title" style={{ margin: '24px 0 12px', color: 'var(--ink-900)' }}>ภาพรวม</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {summaryCards.map(([label, v, tone]) => (
            <div key={label} style={{ padding: '14px 16px 14px 22px', background: '#fff', borderRadius: 11, border: '1px solid var(--ink-200)', borderLeft: '6px solid ' +
              ({ navy: 'var(--navy-700)', blue: 'var(--blue-600)', ok: 'var(--pass)', gold: 'var(--gold-500)' }[tone]) }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink-500)', fontWeight: 600 }}>{label}</div>
              <div className="tnum" style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>

        <div className="sec-title" style={{ margin: '26px 0 12px', color: 'var(--ink-900)' }}>แยกตามสถานะ</div>
        <table className="tbl" style={{ border: '1px solid var(--ink-200)', borderRadius: 10, overflow: 'hidden' }}>
          <thead><tr><th>สถานะ</th><th style={{ textAlign: 'right' }}>จำนวน</th><th style={{ textAlign: 'right' }}>สัดส่วน</th></tr></thead>
          <tbody>{byStatus.map(([k, n]) => (
            <tr key={k}><td><StatusBadge status={k} /></td>
              <td className="tnum" style={{ textAlign: 'right', fontWeight: 700 }}>{n}</td>
              <td className="tnum" style={{ textAlign: 'right', color: 'var(--ink-600)' }}>{total ? Math.round(n / total * 100) : 0}%</td></tr>
          ))}</tbody>
        </table>

        <div className="sec-title" style={{ margin: '26px 0 12px', color: 'var(--ink-900)' }}>อัตราผ่านรายวิชา</div>
        <table className="tbl" style={{ border: '1px solid var(--ink-200)', borderRadius: 10, overflow: 'hidden' }}>
          <thead><tr><th>รหัสวิชา</th><th>ชื่อวิชา</th><th style={{ textAlign: 'right' }}>ผ่าน</th><th style={{ textAlign: 'right' }}>ไม่ผ่าน</th><th style={{ textAlign: 'right' }}>อัตราผ่าน</th></tr></thead>
          <tbody>{perSubject.map(s => (
            <tr key={s.subject_id}><td className="mono">{s.subject_code}</td>
              <td style={{ fontWeight: 500 }}>{s.subject_name}</td>
              <td className="tnum" style={{ textAlign: 'right', color: 'var(--pass)', fontWeight: 700 }}>{s.pass}</td>
              <td className="tnum" style={{ textAlign: 'right', color: 'var(--fail)', fontWeight: 700 }}>{s.fail}</td>
              <td style={{ textAlign: 'right' }}><span className="badge" style={{ background: s.rate >= 80 ? 'var(--status-ok-bg)' : s.rate >= 60 ? 'var(--gold-50)' : 'var(--status-reject-bg)', color: s.rate >= 80 ? 'var(--status-ok-fg)' : s.rate >= 60 ? '#3a2c05' : 'var(--status-reject-fg)' }}>{s.rate}%</span></td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
