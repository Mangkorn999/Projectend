/* ============================================================
   เจ้าหน้าที่ — คิวตรวจสอบผลสอบ (ข้อมูลจริงจาก backend)
   แทนที่ OfficerReview เดิมใน officer.jsx ที่ใช้ mock STUDENTS

   ทำงานทีละ "รอบ" เสมอ (เลือกจาก dropdown) ไม่รวมทุกรอบทุกปีเข้าด้วยกัน:
   นักศึกษาคนเดียวมีผลสอบได้หลายรอบ ถ้าไม่แยกรอบ คนที่ถูกตีกลับรอบเก่า
   จะไปโผล่ปนกับคิวรอตรวจของรอบปัจจุบัน และเลข badge จะไม่ตรงกับ Dashboard
   ที่นับรอบเดียว

   4 แท็บ: รอตรวจสอบ / ตีกลับ / ยืนยันแล้ว / ยังไม่กรอก
   (ยังไม่กรอก = นักศึกษารุ่นเดียวกับรอบ ที่เปิดสิทธิ์แล้วแต่ยังไม่มีผลสอบในรอบนี้)
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, Avatar, Empty, Pagination } from './components.jsx';
import { apiFetch } from './api.js';
import { t, roomName } from './i18n.js';

const STAFF_STATUS_TO_TAB = { pending: 'SUBMITTED', approved: 'CONFIRMED', rejected: 'REJECTED' };
const TABS = ['SUBMITTED', 'REJECTED', 'CONFIRMED', 'NOT_STARTED'];
const PER_PAGE = 20;

// รอบที่ควรเลือกให้ตอนเปิดหน้ามา — รอบที่เปิดรับอยู่ ถ้าไม่มีก็รอบล่าสุด (rounds เรียงใหม่→เก่ามาแล้ว)
const defaultRound = (rounds) => rounds.find(r => r.status === 'open') || rounds[0];

export function OfficerReviewReal({ go, setSel, lang }) {
  const tt = (key, vars) => t(lang, key, vars);
  const [tab, setTab] = useState('SUBMITTED');
  const [page, setPage] = useState(0);
  const [rounds, setRounds] = useState(null);
  const [roundId, setRoundId] = useState('');
  const [results, setResults] = useState(null);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // รายการรอบ + รายชื่อนักศึกษา + รายวิชา ไม่เปลี่ยนตามรอบที่เลือก โหลดครั้งเดียวพอ
  useEffect(() => {
    Promise.all([apiFetch('/rounds'), apiFetch('/students'), apiFetch('/subjects')])
      .then(([roundList, studentList, subjectList]) => {
        setRounds(roundList);
        setStudents(studentList);
        setSubjects(subjectList);
        setRoundId(String(defaultRound(roundList)?.round_id || ''));
      })
      .catch(e => setError(e.message));
  }, []);

  // ผลสอบดึงเฉพาะรอบที่เลือก — ให้ backend กรองให้ ไม่ดึงทุกรอบมากรองเองฝั่ง client
  useEffect(() => {
    if (!roundId) return;
    setLoading(true);
    apiFetch(`/exam-results?round_id=${roundId}`)
      .then(setResults)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [roundId]);

  // เปลี่ยนแท็บ/เปลี่ยนรอบ ต้องเด้งกลับหน้า 1 ไม่งั้นค้างอยู่หน้า 5 ของลิสต์ที่มี 2 หน้า
  const selectTab = (k) => { setTab(k); setPage(0); };
  const selectRound = (id) => { setRoundId(id); setPage(0); };

  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>{tt('statuspage.loadFailPrefix', { msg: error })}</div>;
  if (!rounds) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>{tt('common.loading')}</div>;
  if (!rounds.length) return <div className="fade-up" style={{ padding: 40 }}><Empty icon="calendar" title={tt('officer.review.noRoundTitle')} sub={tt('officer.review.noRoundSub')} /></div>;
  if (!results) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>{tt('common.loading')}</div>;

  const round = rounds.find(r => String(r.round_id) === String(roundId));
  const roundLabel = r => tt('dashReal.roundLabel', { attempt: r.attempt_number, year: r.academic_year }) + (r.status === 'open' ? tt('dashReal.roundOpenSuffix') : '');

  // รอบหนึ่งอาจสอบไม่ครบทุกวิชา — ตัวหารต้องเป็นจำนวนวิชาของรอบนี้ ไม่ใช่ 8 ตายตัว
  const roundSubjectIds = round?.subject_ids?.length ? round.subject_ids : subjects.map(s => s.subject_id);
  const subjectCount = roundSubjectIds.length;

  // ยังไม่กรอก = นักศึกษารุ่นเดียวกับรอบ + เปิดสิทธิ์แล้ว + ไม่มีผลสอบในรอบนี้
  const submittedIds = new Set(results.map(r => r.student_id));
  const notStarted = students.filter(s =>
    s.academic_year === round?.academic_year && s.exam_eligible && !submittedIds.has(s.student_id));

  const counts = {
    SUBMITTED: results.filter(r => r.staff_status === 'pending').length,
    REJECTED: results.filter(r => r.staff_status === 'rejected').length,
    CONFIRMED: results.filter(r => r.staff_status === 'approved').length,
    NOT_STARTED: notStarted.length,
  };

  const rows = results.filter(r => STAFF_STATUS_TO_TAB[r.staff_status] === tab).map(r => ({
    resultId: r.result_id, // ต้องส่งไปด้วย ไม่งั้นหน้า detail จะเดาเอาใบล่าสุดของคนนั้นแทนใบที่กดมา
    sid: r.student_id,
    firstName: r.student.user.first_name,
    lastName: r.student.user.last_name,
    room: r.student.room?.room_name || '-',
    year: r.student.academic_year,
    // นับเฉพาะวิชาของรอบนี้ ผลเก่าที่ copy-forward มาอาจมีวิชานอกรอบติดมาด้วย
    passedCount: r.subject_results.filter(s => s.is_passed && roundSubjectIds.includes(s.subject_id)).length,
    subjectCount,
    files: r.certificates,
    submittedAt: new Date(r.submitted_at).toLocaleDateString('th-TH'),
  }));
  rows.forEach(r => { r.allPass = r.passedCount === subjectCount; });

  const list = tab === 'NOT_STARTED' ? notStarted : rows;
  const pages = Math.ceil(list.length / PER_PAGE);
  const pageRows = list.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const openDetail = (row) => { setSel(row); go('detail'); };

  return (
    <div className="fade-up">
      <PageHead title={tt('officer.review.title')} sub={tt('officer.review.sub')}
        actions={
          <select className="input" value={roundId} onChange={e => selectRound(e.target.value)}
            style={{ minWidth: 200 }} aria-label={tt('dashReal.roundSelectLabel')}>
            {rounds.map(r => <option key={r.round_id} value={String(r.round_id)}>{roundLabel(r)}</option>)}
          </select>} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(k => (
          <button key={k} onClick={() => selectTab(k)} className="btn" style={{
            background: tab === k ? 'var(--navy-700)' : '#fff', color: tab === k ? '#fff' : 'var(--ink-900)',
            border: '1px solid ' + (tab === k ? 'var(--navy-700)' : 'var(--ink-200)') }}>
            {k === 'NOT_STARTED' ? tt('officer.review.tabNotStarted') : tt('status.' + k)}
            <span className="tnum" style={{ background: tab === k ? 'rgba(255,255,255,.2)' : 'var(--ink-100)', padding: '1px 8px', borderRadius: 999, fontSize: 12.5, marginLeft: 8 }}>{counts[k]}</span>
          </button>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>{tt('common.loading')}</div>
          : !pageRows.length ? <Empty icon="checkCircle"
              title={tab === 'NOT_STARTED' ? tt('officer.review.emptyNotStartedTitle') : tt('officer.review.emptyTitle')}
              sub={tab === 'NOT_STARTED' ? tt('officer.review.emptyNotStartedSub') : undefined} />
          : <>
            <div style={{ overflowX: 'auto' }}>
              {tab === 'NOT_STARTED'
                ? <table className="tbl">
                    <thead><tr><th>{tt('officer.review.colStudent')}</th><th>{tt('officer.review.colRoom')}</th><th>{tt('officer.students.colYear')}</th></tr></thead>
                    <tbody>{pageRows.map(s => (
                      <tr key={s.student_id}>
                        <td><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={s.user.first_name} size={34} />
                          <div><div style={{ fontWeight: 600, fontSize: 14 }}>{s.user.first_name} {s.user.last_name}</div>
                          <div className="mono" style={{ fontSize: 12, color: 'var(--ink-400)' }}>{s.student_id}</div></div></div></td>
                        <td><span className="chip" style={{ fontSize: 12 }}>{s.room ? roomName(lang, s.room.room_name) : '-'}</span></td>
                        <td className="tnum" style={{ fontSize: 13, color: 'var(--ink-700)' }}>{s.academic_year || '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                : <table className="tbl">
                    <thead><tr><th>{tt('officer.review.colStudent')}</th><th>{tt('officer.review.colRoom')}</th><th>{tt('officer.review.colResult')}</th><th>{tt('officer.review.colEvidence')}</th><th>{tt('officer.review.colSubmitted')}</th><th></th></tr></thead>
                    <tbody>{pageRows.map(s => (
                      <tr key={s.resultId} className="clickable" onClick={() => openDetail(s)}>
                        <td><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={s.firstName} size={34} />
                          <div><div style={{ fontWeight: 600, fontSize: 14 }}>{s.firstName} {s.lastName}</div>
                          <div className="mono" style={{ fontSize: 12, color: 'var(--ink-400)' }}>{s.sid}</div></div></div></td>
                        <td><span className="chip" style={{ fontSize: 12 }}>{roomName(lang, s.room)}</span></td>
                        <td className="tnum" style={{ fontWeight: 700, color: s.allPass ? 'var(--pass)' : 'var(--ink-800)' }}>{s.passedCount}/{s.subjectCount}</td>
                        <td>{s.files.length ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--status-reject-fg)', fontSize: 13 }}><Icon name="pdf" size={15} /> {tt('officer.review.filesCount', { n: s.files.length })}</span> : <span style={{ color: 'var(--ink-400)' }}>—</span>}</td>
                        <td style={{ color: 'var(--ink-500)', fontSize: 13 }}>{s.submittedAt}</td>
                        <td style={{ textAlign: 'right' }}><button className="btn btn-subtle btn-sm" style={{ background: 'var(--navy-700)', color: '#fff' }}>{tt('officer.review.reviewBtn')} <Icon name="chevR" size={14} /></button></td>
                      </tr>
                    ))}</tbody>
                  </table>}
            </div>
            <Pagination page={page} pages={pages} onPage={setPage} lang={lang} />
          </>}
      </div>
    </div>
  );
}
