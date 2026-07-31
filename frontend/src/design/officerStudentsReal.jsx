/* ============================================================
   เจ้าหน้าที่ / ผู้บริหาร — รายชื่อนักศึกษา (ข้อมูลจริงจาก backend)
   แทนที่ OfficerStudents เดิมใน officer.jsx ที่ยังใช้ mock STUDENTS/ROOMS
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, Avatar, StatusBadge } from './components.jsx';
import { apiFetch } from './api.js';

// แปลง staff_status จาก backend (pending/approved/rejected) → status key ที่ StatusBadge เข้าใจ
const STAFF_STATUS_TO_BADGE = {
  pending: 'SUBMITTED',
  approved: 'CONFIRMED',
  rejected: 'REJECTED',
};

export function OfficerStudentsReal({ go, setSel }) {
  const [students, setStudents] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [room, setRoom] = useState('ALL');
  const [page, setPage] = useState(0);
  const per = 10;

  useEffect(() => {
    // ดึงนักศึกษา + ผลสอบทุกคนพร้อมกัน แล้ว join ฝั่ง client:
    // นักศึกษาคนหนึ่งอาจมีผลสอบหลายรอบ — เอาผลล่าสุด (findAll เรียงจาก submitted_at desc อยู่แล้ว) มาแสดงสถานะ
    Promise.all([apiFetch('/students'), apiFetch('/exam-results')])
      .then(([studentList, examResults]) => {
        const latestByStudent = new Map();
        for (const r of examResults) {
          if (!latestByStudent.has(r.student_id)) latestByStudent.set(r.student_id, r);
        }
        setStudents(studentList.map(s => {
          const latest = latestByStudent.get(s.student_id);
          const passedCount = latest ? latest.subject_results.filter(sr => sr.is_passed).length : 0;
          return {
            sid: s.student_id,
            prefix: '',
            firstName: s.user.first_name,
            lastName: s.user.last_name,
            room: s.room?.room_name || '-',
            year: s.academic_year,
            status: latest ? STAFF_STATUS_TO_BADGE[latest.staff_status] : 'DRAFT',
            passedCount,
            allPass: passedCount === latest?.subject_results.length && passedCount > 0,
            submittedAt: latest ? new Date(latest.submitted_at).toLocaleDateString('th-TH') : null,
            // StudentDetail (officer.jsx) ยังไม่ต่อ backend จริง — ใส่ค่าว่างกันหน้าแตกตอนคลิกเข้าไปดู
            subjects: [],
            files: [],
          };
        }));
        setRooms([...new Set(studentList.map(s => s.room?.room_name).filter(Boolean))]);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(s => {
    if (status !== 'ALL' && s.status !== status) return false;
    if (room !== 'ALL' && s.room !== room) return false;
    if (q && !(`${s.firstName}${s.lastName}${s.sid}`.includes(q))) return false;
    return true;
  });
  const pageRows = filtered.slice(page * per, (page + 1) * per);
  const pages = Math.ceil(filtered.length / per);

  useEffect(() => setPage(0), [q, status, room]);

  if (loading) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>กำลังโหลดข้อมูล…</div>;
  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>โหลดข้อมูลไม่สำเร็จ: {error}</div>;

  return (
    <div className="fade-up">
      <PageHead title="ข้อมูลนักศึกษา" sub={`พบ ${filtered.length} จาก ${students.length} คน`} />

      <div className="card" style={{ padding: 14, marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Icon name="search" size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)' }} />
          <input className="input" placeholder="ค้นหาชื่อ หรือ รหัสนักศึกษา…" value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: 40 }} />
        </div>
        <select className="select" style={{ width: 'auto', minWidth: 150 }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="ALL">ทุกสถานะ</option><option value="SUBMITTED">รอตรวจสอบ</option>
          <option value="CONFIRMED">ยืนยันแล้ว</option><option value="REJECTED">ถูกตีกลับ</option><option value="DRAFT">ยังไม่กรอก</option>
        </select>
        <select className="select" style={{ width: 'auto', minWidth: 120 }} value={room} onChange={e => setRoom(e.target.value)}>
          <option value="ALL">ทุกห้อง</option>{rooms.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>นักศึกษา</th><th>ห้อง</th><th>ผลสอบ</th><th>สถานะ</th><th>ส่งเมื่อ</th><th></th></tr></thead>
            <tbody>
              {pageRows.map(s => (
                <tr key={s.sid} className="clickable" onClick={() => { setSel(s); go('detail'); }}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={s.firstName} size={34} />
                    <div><div style={{ fontWeight: 600, fontSize: 14 }}>{s.firstName} {s.lastName}</div>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--ink-400)' }}>{s.sid}</div></div></div></td>
                  <td><span className="chip" style={{ fontSize: 12 }}>{s.room}</span></td>
                  <td>{s.status === 'DRAFT' ? <span style={{ color: 'var(--ink-400)' }}>—</span> :
                    <span className="tnum" style={{ fontWeight: 700, color: s.allPass ? 'var(--pass)' : 'var(--ink-800)' }}>{s.passedCount}/8</span>}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td style={{ color: 'var(--ink-500)', fontSize: 13 }}>{s.submittedAt || '—'}</td>
                  <td style={{ textAlign: 'right' }}><Icon name="chevR" size={18} style={{ color: 'var(--ink-300)' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderTop: '1px solid var(--ink-100)' }}>
          <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>หน้า {page + 1} จาก {pages}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><Icon name="chevL" size={15} /> ก่อนหน้า</button>
            <button className="btn btn-ghost btn-sm" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>ถัดไป <Icon name="chevR" size={15} /></button>
          </div>
        </div>}
      </div>
    </div>
  );
}
