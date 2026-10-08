/* ============================================================
   เจ้าหน้าที่ — คิวตรวจสอบผลสอบ (ข้อมูลจริงจาก backend)
   แทนที่ OfficerReview เดิมใน officer.jsx ที่ใช้ mock STUDENTS

   ทำงานทีละ "รอบ" เสมอ (เลือกจาก dropdown) ไม่รวมทุกรอบทุกปีเข้าด้วยกัน:
   นักศึกษาคนเดียวมีผลสอบได้หลายรอบ ถ้าไม่แยกรอบ คนที่ถูกตีกลับรอบเก่า
   จะไปโผล่ปนกับคิวรอตรวจของรอบปัจจุบัน และเลข badge จะไม่ตรงกับ Dashboard
   ที่นับรอบเดียว

   4 แท็บ: รอตรวจสอบ / ตีกลับ / ยืนยันแล้ว / ยังไม่กรอก
   (ยังไม่กรอก = นักศึกษารุ่นเดียวกับรอบ ที่เปิดสิทธิ์แล้วแต่ยังไม่มีผลสอบในรอบนี้)
   ผู้ช่วยตรวจสอบ (reviewer) ไม่มีแท็บ "ยังไม่กรอก" — ต้องใช้ /dashboard/stats ตัดคนที่ผ่านครบแล้วออก ซึ่ง reviewer เรียกไม่ได้ (403)
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, Avatar, Empty, Pagination, Select, actorLabel } from './components.jsx';
import { SkeletonTable } from './skeletons.jsx';
import { apiFetch } from './api.js';
import { t, roomName } from './i18n.js';

const STAFF_STATUS_TO_TAB = { pending: 'SUBMITTED', approved: 'CONFIRMED', rejected: 'REJECTED' };
const TABS = ['SUBMITTED', 'REJECTED', 'CONFIRMED', 'NOT_STARTED'];
const PER_PAGE = 10; // ลดจาก 15 — เห็นเลขหน้าเร็วขึ้น ไม่ต้องรอคิวยาวถึง 15 แถวก่อนถึงจะขึ้น

// รอบที่ควรเลือกให้ตอนเปิดหน้ามา — รอบที่เปิดรับอยู่ ถ้าไม่มีก็รอบล่าสุด (rounds เรียงใหม่→เก่ามาแล้ว)
const defaultRound = (rounds) => rounds.find(r => r.status === 'open') || rounds[0];

export function OfficerReviewReal({ go, setSel, setDetailFrom, lang, role, restoreView, onLeave, onRestoreConsumed }) {
  const tt = (key, vars) => t(lang, key, vars);
  // ผู้ช่วยตรวจสอบไม่เห็นแท็บ "ยังไม่กรอก" และไม่เรียก /dashboard/stats (เรียกแล้วได้ 403 ขึ้นในคอนโซล)
  const canSeeNotStarted = role !== 'reviewer';
  const visibleTabs = canSeeNotStarted ? TABS : TABS.filter(k => k !== 'NOT_STARTED');
  // ค่าเริ่มต้นอ่านจาก restoreView ถ้ามี (กลับมาจากปุ่ม "กลับ" ที่หน้ารายละเอียด — จะได้อยู่แท็บ/หน้าเดิม)
  const [tab, setTab] = useState(() => {
    const startTab = restoreView?.tab || 'SUBMITTED';
    // แท็บที่เก็บไว้เป็น "ยังไม่กรอก" แต่ role นี้ไม่มีแท็บนั้น → ตกกลับ "รอตรวจสอบ"
    if (!canSeeNotStarted && startTab === 'NOT_STARTED') return 'SUBMITTED';
    return startTab;
  });
  const [page, setPage] = useState(() => restoreView?.page || 0);
  const [rounds, setRounds] = useState(null);
  const [roundId, setRoundId] = useState('');
  const [results, setResults] = useState(null);
  const [alreadyPassedIds, setAlreadyPassedIds] = useState([]); // ผ่านครบทุกวิชาไปแล้วตั้งแต่ก่อนรอบนี้ — ไม่ต้องมาโผล่ "ยังไม่กรอก"
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
        setRoundId(String(restoreView?.roundId || defaultRound(roundList)?.round_id || ''));
        if (restoreView) onRestoreConsumed?.();
      })
      .catch(e => setError(e.message));
  }, []);

  // ผลสอบดึงเฉพาะรอบที่เลือก — ให้ backend กรองให้ ไม่ดึงทุกรอบมากรองเองฝั่ง client
  // ดึง /dashboard/stats คู่กันเพื่อเอา alreadyPassedStudentIds (backend คำนวณย้อนรอบก่อนหน้าให้แล้ว)
  // ผู้ช่วยตรวจสอบไม่เรียก stats เลย (ไม่มีสิทธิ์ และไม่ได้ใช้แท็บ "ยังไม่กรอก")
  useEffect(() => {
    if (!roundId) return;
    // dropped = ผู้ใช้สลับรอบไปแล้วก่อนที่ response นี้จะกลับมา — ทิ้งผลเก่า ไม่ให้ทับของรอบใหม่
    let dropped = false;
    setLoading(true);
    Promise.all([
      apiFetch(`/exam-results?round_id=${roundId}`),
      // stats เป็นของเสริม (ใช้ตัดชื่อคนที่ผ่านครบแล้วออกเท่านั้น) ล้มก็ต้องไม่ทำให้คิวตรวจทั้งหน้าดับ
      // ถ้าปล่อยให้ throw จะไปโดน .catch ข้างล่างแล้ว setError ทับทั้งหน้า เจ้าหน้าที่ตรวจงานไม่ได้เลย
      canSeeNotStarted ? apiFetch(`/dashboard/stats?round_id=${roundId}`).catch(() => ({})) : Promise.resolve({}),
    ])
      .then(([resultList, stats]) => {
        if (dropped) return;
        setResults(resultList);
        setAlreadyPassedIds(stats.alreadyPassedStudentIds || []);
      })
      .catch(e => { if (!dropped) setError(e.message); })
      .finally(() => { if (!dropped) setLoading(false); });
    return () => { dropped = true; };
  }, [roundId, canSeeNotStarted]);

  // เปลี่ยนแท็บ/เปลี่ยนรอบ ต้องเด้งกลับหน้า 1 ไม่งั้นค้างอยู่หน้า 5 ของลิสต์ที่มี 2 หน้า
  const selectTab = (k) => { setTab(k); setPage(0); };
  const selectRound = (id) => { setRoundId(id); setPage(0); };

  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>{tt('statuspage.loadFailPrefix', { msg: error })}</div>;
  if (!rounds) return <div className="fade-up"><SkeletonTable rows={8} cols={5} /></div>;
  if (!rounds.length) return <div className="fade-up" style={{ padding: 40 }}><Empty icon="calendar" title={tt('officer.review.noRoundTitle')}
    sub={tt(canSeeNotStarted ? 'officer.review.noRoundSub' : 'officer.review.noRoundSubReviewer')} /></div>;
  if (!results) return <div className="fade-up"><SkeletonTable rows={8} cols={5} /></div>;

  const round = rounds.find(r => String(r.round_id) === String(roundId));
  const roundLabel = r => tt('dashReal.roundLabel', { attempt: r.attempt_number, year: r.academic_year }) + (r.status === 'open' ? tt('dashReal.roundOpenSuffix') : '');

  // รอบหนึ่งอาจสอบไม่ครบทุกวิชา — ตัวหารต้องเป็นจำนวนวิชาของรอบนี้ ไม่ใช่ 8 ตายตัว
  const roundSubjectIds = round?.subject_ids?.length ? round.subject_ids : subjects.map(s => s.subject_id);
  const subjectCount = roundSubjectIds.length;

  // ยังไม่กรอก = นักศึกษารุ่นเดียวกับรอบ + เปิดสิทธิ์แล้ว + ไม่มีผลสอบในรอบนี้ + ยังไม่เคยผ่านครบทุกวิชามาก่อน
  // (ผ่านครบตั้งแต่รอบไหนก็ตาม ไม่มีอะไรต้องทำในรอบถัดไปอีกแล้ว ไม่ควรค้างโชว์เป็น "ยังไม่กรอก")
  const submittedIds = new Set(results.map(r => r.student_id));
  const alreadyPassedSet = new Set(alreadyPassedIds);
  // ผู้ช่วยตรวจสอบไม่มีแท็บนี้ (ไม่มี alreadyPassedIds มาตัดคนที่ผ่านครบแล้ว รายชื่อจะผิด) เลยไม่คำนวณ
  const notStarted = !canSeeNotStarted ? [] : students.filter(s =>
    s.academic_year === round?.academic_year && s.exam_eligible
    && !submittedIds.has(s.student_id) && !alreadyPassedSet.has(s.student_id));

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
    // ใครตรวจ + ตรวจเมื่อไหร่ (confirmed_by / confirmed_at) — ใช้โชว์ในแท็บที่ตรวจแล้ว (ยืนยันแล้ว / ถูกตีกลับ)
    reviewer: r.confirmer,
    reviewedAt: r.confirmed_at ? new Date(r.confirmed_at).toLocaleDateString('th-TH') : '—',
  }));
  rows.forEach(r => { r.allPass = r.passedCount === subjectCount; });

  const showReviewer = tab === 'CONFIRMED' || tab === 'REJECTED'; // แท็บรอตรวจยังไม่มีผู้ตรวจ ไม่ต้องมีคอลัมน์
  const list = tab === 'NOT_STARTED' ? notStarted : rows;
  const pages = Math.ceil(list.length / PER_PAGE);
  // บีบหน้าให้อยู่ในช่วงเสมอ — ถ้าหน้าสุดท้ายหมดแถว (เช่น ตรวจเสร็จแล้วรายการหด) จะถอยมาหน้าสุดท้ายที่ยังมีแถว ไม่ใช่ตารางว่างเงียบๆ
  const safePage = Math.min(page, Math.max(pages - 1, 0));
  const pageRows = list.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);

  const openDetail = (row) => { setSel(row); setDetailFrom('review'); onLeave?.({ tab, roundId, page: safePage }); go('detail'); };

  return (
    <div className="fade-up">
      <PageHead title={tt('officer.review.title')}
        actions={
          <Select className="input" value={roundId} onChange={v => selectRound(v)} lang={lang}
            style={{ minWidth: 200 }} ariaLabel={tt('dashReal.roundSelectLabel')}
            options={rounds.map(r => ({ value: String(r.round_id), label: roundLabel(r) }))} />} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {visibleTabs.map(k => (
          // แท็บ "ยังไม่กรอก" ใช้กฎเดียวกับ roundNotStarted ที่ Dashboard มุมมองรายรอบใช้ (ฐานคนของรอบ:
          // เปิดสิทธิ์ + ยังผ่านไม่ครบทุกวิชา + ยังไม่มีใบในรอบนี้) ไม่ได้นับทั้งรุ่นแล้ว
          // tooltip มีไว้บอกผู้ใช้ว่าคนที่ผ่านครบทุกวิชาไปแล้วไม่ถูกนับในแท็บนี้
          <button key={k} onClick={() => selectTab(k)} className="btn"
            title={k === 'NOT_STARTED' ? tt('officer.review.tabNotStartedHint') : undefined} style={{
            background: tab === k ? 'var(--navy-700)' : '#fff', color: tab === k ? '#fff' : 'var(--ink-900)',
            border: '1px solid ' + (tab === k ? 'var(--navy-700)' : 'var(--ink-200)') }}>
            {k === 'NOT_STARTED' ? tt('officer.review.tabNotStarted') : tt('status.' + k)}
            <span className="tnum" style={{ background: tab === k ? 'rgba(255,255,255,.2)' : 'var(--ink-100)', padding: '1px 8px', borderRadius: 999, fontSize: 14.5, marginLeft: 8 }}>{counts[k]}</span>
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
                    <tbody key={`${roundId}|${tab}|${safePage}`}>{pageRows.map(s => (
                      <tr key={s.student_id}>
                        <td><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={s.user.first_name} size={34} />
                          <div><div style={{ fontWeight: 600, fontSize: 16 }}>{s.user.first_name} {s.user.last_name}</div>
                          <div className="mono" style={{ fontSize: 14, color: 'var(--ink-500)' }}>{s.student_id}</div></div></div></td>
                        <td><span className="chip" style={{ fontSize: 14 }}>{s.room ? roomName(lang, s.room.room_name) : '-'}</span></td>
                        <td className="tnum" style={{ fontSize: 15, color: 'var(--ink-700)' }}>{s.academic_year || '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                : <table className="tbl">
                    <thead><tr><th>{tt('officer.review.colStudent')}</th><th>{tt('officer.review.colRoom')}</th><th>{tt('officer.review.colResult')}</th><th>{tt('officer.review.colEvidence')}</th><th>{tt('officer.review.colSubmitted')}</th>{showReviewer && <><th>{tt('officer.review.colReviewer')}</th><th>{tt('officer.review.colReviewedAt')}</th></>}<th></th></tr></thead>
                    <tbody key={`${roundId}|${tab}|${safePage}`}>{pageRows.map(s => (
                      <tr key={s.resultId} className="clickable" onClick={() => openDetail(s)}>
                        <td><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={s.firstName} size={34} />
                          <div><div style={{ fontWeight: 600, fontSize: 16 }}>{s.firstName} {s.lastName}</div>
                          <div className="mono" style={{ fontSize: 14, color: 'var(--ink-500)' }}>{s.sid}</div></div></div></td>
                        <td><span className="chip" style={{ fontSize: 14 }}>{roomName(lang, s.room)}</span></td>
                        <td className="tnum" style={{ fontWeight: 700, color: s.allPass ? 'var(--pass)' : 'var(--ink-800)' }}>{s.passedCount}/{s.subjectCount}</td>
                        {/* แนบได้หลายไฟล์ทั้ง PDF และรูปภาพ — โชว์แค่จำนวนไฟล์ (ชนิดไฟล์ดูได้ในหน้ารายละเอียด) */}
                        <td>{s.files.length ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--navy-700)', fontSize: 15 }}><Icon name="doc" size={15} /> {tt('officer.review.filesCount', { n: s.files.length })}</span> : <span style={{ color: 'var(--ink-400)' }}>—</span>}</td>
                        <td style={{ color: 'var(--ink-500)', fontSize: 15 }}>{s.submittedAt}</td>
                        {showReviewer && <>
                          <td style={{ fontSize: 15 }}>{s.reviewer ? actorLabel(s.reviewer, tt) : '—'}</td>
                          <td style={{ color: 'var(--ink-500)', fontSize: 15 }}>{s.reviewedAt}</td>
                        </>}
                        <td style={{ textAlign: 'right' }}><button className="btn btn-subtle btn-sm" style={{ background: 'var(--navy-700)', color: '#fff' }}>{tt('officer.review.reviewBtn')} <Icon name="chevR" size={14} /></button></td>
                      </tr>
                    ))}</tbody>
                  </table>}
            </div>
            <Pagination page={safePage} pages={pages} onPage={setPage} lang={lang} />
          </>}
      </div>
    </div>
  );
}
