/* ============================================================
   เจ้าหน้าที่ / ผู้บริหาร — รายชื่อนักศึกษา (ข้อมูลจริงจาก backend)
   แทนที่ OfficerStudents เดิมใน officer.jsx ที่ยังใช้ mock STUDENTS/ROOMS

   สิทธิ์กรอกผลสอบ (exam_eligible) เปิด/ปิดจากหน้านี้ผ่าน PATCH /api/students/bulk-eligible
   — เจ้าหน้าที่เท่านั้น (ผู้บริหารเห็นสถานะได้ แต่แก้ไม่ได้)
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, Avatar, StatusBadge, Pagination, Modal, Select } from './components.jsx';
import { SkeletonTable } from './skeletons.jsx';
import { apiFetch, ApiError, API_BASE } from './api.js';
import { t, roomName, subjectName } from './i18n.js';

// แปลง staff_status จาก backend (pending/approved/rejected) → status key ที่ StatusBadge เข้าใจ
const STAFF_STATUS_TO_BADGE = {
  pending: 'SUBMITTED',
  approved: 'CONFIRMED',
  rejected: 'REJECTED',
};

export function OfficerStudentsReal({ go, setSel, setDetailFrom, toast, readonly, lang, initialFilter, onInitialFilterConsumed, onBackToDashboard }) {
  const tt = (key, vars) => t(lang, key, vars);
  const [students, setStudents] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [room, setRoom] = useState('ALL');
  const [year, setYear] = useState(() => initialFilter?.year ? String(initialFilter.year) : 'ALL');
  const [eligible, setEligible] = useState('ALL');
  const [examResult, setExamResult] = useState('ALL');
  // กรองรายวิชา — มาจากการคลิก "ผ่าน/ไม่ผ่าน" ในการ์ดอัตราผ่านรายวิชาที่ Dashboard เท่านั้น ไม่มี dropdown ให้เลือกเอง
  // ตั้งค่าเริ่มต้นจาก initialFilter ตรงๆ (lazy init) ไม่ต้อง setState ใน effect
  // roundId = null หมายถึง "รวมทั้งปี" (initialFilter.tab === 'all') — ไม่งั้นเป็น round_id ของรอบที่กดมาจาก Dashboard
  // ต้องแนบมาด้วย ไม่งั้นตัวกรองจะไปเทียบกับ "ผลล่าสุดของนักศึกษา" เฉยๆ ซึ่งอาจเป็นคนละรอบกับที่ Dashboard กำลังนับอยู่
  // (บั๊กที่เจอจริง: การ์ดรอบที่ 2 บอกไม่ผ่าน 5 คน แต่คลิกแล้วเจอ 7 คน เพราะมีคนที่ "ผลล่าสุด" ดันเป็นรอบอื่นปนมาด้วย)
  const [subjectFilter, setSubjectFilter] = useState(() => initialFilter?.kind === 'subject'
    ? { subjectCode: initialFilter.subjectCode, passed: initialFilter.passed, subjectFullName: initialFilter.subjectFullName,
        roundId: initialFilter.tab === 'all' ? null : Number(initialFilter.tab),
        year: initialFilter.year } // ใช้ตอน export PDF กรณี "รวมทั้งปี" (roundId เป็น null) — เก็บแยกไว้กันปีเปลี่ยนไปตาม year state ทีหลัง
    : null); // { subjectCode, passed, subjectFullName, roundId, year } | null
  // กรอง "ผ่าน/ไม่ผ่านครั้งแรก" — มาจากปุ่ม "ดูรายชื่อ" ในการ์ดร้อยละผ่านครั้งแรกย้อนหลังที่ Dashboard เท่านั้น
  const [firstAttemptFilter, setFirstAttemptFilter] = useState(() => initialFilter?.kind === 'firstAttempt' ? { year: initialFilter.year, passed: initialFilter.passed } : null); // { year, passed } | null
  // widget เดิมของ Dashboard (ปี/รอบ/แท็บ) ตอนกดมาที่นี่ — เก็บแยกจาก subjectFilter เพราะแม้ผู้ใช้จะกดเคลียร์ตัวกรองวิชา
  // ปุ่ม "กลับไปหน้าแดชบอด" ก็ยังต้องอยู่ (มีค่าก็ต่อเมื่อมาจากการคลิกในแดชบอดเท่านั้น ไม่ใช่มาจากแท็บด้านซ้าย)
  const [returnView] = useState(() => initialFilter ? { year: initialFilter.year, tab: initialFilter.tab, mainTab: initialFilter.mainTab } : null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(() => new Set()); // student_id ที่ติ๊กไว้
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null); // นักศึกษาที่กำลังจะลบ (รอยืนยันในโมดัล)
  const [resetting, setResetting] = useState(null); // นักศึกษาที่กำลังจะรีเซ็ตรหัส (รอยืนยันในโมดัล)
  const [resetNationalId, setResetNationalId] = useState('');
  const [resetError, setResetError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const per = 10;

  useEffect(() => {
    // แค่แจ้ง parent ให้เคลียร์ state ทิ้ง (กันคลิกลิงก์เดิมซ้ำจาก history) — subjectFilter อ่านจาก initialFilter ไปแล้วตอน useState init ด้านบน
    if (initialFilter) onInitialFilterConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // ดึงนักศึกษา + ผลสอบทุกคนพร้อมกัน แล้ว join ฝั่ง client:
    // นักศึกษาคนหนึ่งอาจมีผลสอบหลายรอบ — เอาผลล่าสุด (findAll เรียงจาก submitted_at desc อยู่แล้ว) มาแสดงสถานะ
    Promise.all([apiFetch('/students'), apiFetch('/exam-results')])
      .then(([studentList, examResults]) => {
        const latestByStudent = new Map();
        // ใบของรอบที่ 1 (attempt_number=1) เท่านั้น — ใช้แยกจาก "ผลล่าสุด" เพราะ "ผ่านครั้งแรก" ต้องดูเฉพาะรอบแรก
        // ไม่ใช่ใบล่าสุดที่อาจมาจากรอบถัดไป (round_id ไม่ซ้ำต่อคน/รอบ จึงมีใบรอบ 1 ได้แค่ใบเดียวต่อคน)
        const round1ByStudent = new Map();
        // ใบ "ทุกรอบ" ของนักศึกษาแต่ละคน (ไม่ใช่แค่ล่าสุด) — subjectFilter ต้องเช็คใบของรอบที่ Dashboard
        // กำลังดูอยู่จริงๆ ใช้แค่ "ล่าสุด" ไม่พอ เพราะนักศึกษาบางคนล่าสุดอาจเป็นรอบอื่นที่ไม่ใช่รอบที่กด
        const allResultsByStudent = new Map();
        for (const r of examResults) {
          if (!latestByStudent.has(r.student_id)) latestByStudent.set(r.student_id, r);
          if (r.round.attempt_number === 1) round1ByStudent.set(r.student_id, r);
          if (!allResultsByStudent.has(r.student_id)) allResultsByStudent.set(r.student_id, []);
          allResultsByStudent.get(r.student_id).push(r);
        }
        setStudents(studentList.map(s => {
          const latest = latestByStudent.get(s.student_id);
          const passedCount = latest ? latest.subject_results.filter(sr => sr.is_passed).length : 0;
          const r1 = round1ByStudent.get(s.student_id);
          const allResults = allResultsByStudent.get(s.student_id) || [];
          return {
            sid: s.student_id,
            userId: s.user.user_id,
            prefix: '',
            firstName: s.user.first_name,
            lastName: s.user.last_name,
            room: s.room?.room_name || '-',
            year: s.academic_year,
            eligible: !!s.exam_eligible,
            status: latest ? STAFF_STATUS_TO_BADGE[latest.staff_status] : 'DRAFT',
            passedCount,
            // ตัวหารคือจำนวนวิชาที่ผลใบนั้นเก็บไว้จริง — บางรอบสอบไม่ครบทุกวิชา
            subjectCount: latest ? latest.subject_results.length : 0,
            allPass: passedCount === latest?.subject_results.length && passedCount > 0,
            // ใช้กรองตาม subjectFilter (คลิกมาจากการ์ดอัตราผ่านรายวิชาที่ Dashboard) — ดูแค่ผลล่าสุดเหมือนคอลัมน์อื่นในตารางนี้
            subjectResults: latest ? latest.subject_results.map(sr => ({ code: sr.subject.subject_code, passed: sr.is_passed })) : [],
            // ทุกใบของนักศึกษาคนนี้ (คนละอันกับ subjectResults ด้านบนที่เป็นแค่ใบล่าสุด) — subjectFilter ใช้ตัวนี้แทน
            // academicYear + carriedForward ต้องมีด้วย ไม่งั้น "รวมทั้งปี" กรองปีไม่ได้ และนับคนที่ยกผลมาเป็น "สอบจริง" ผิด
            allResults: allResults.map(r => ({
              roundId: r.round_id, academicYear: r.round.academic_year, approved: r.staff_status === 'approved',
              subjects: r.subject_results.map(sr => ({ code: sr.subject.subject_code, passed: sr.is_passed, carriedForward: sr.carried_forward })),
            })),
            // ใช้กรองตาม firstAttemptFilter (ปุ่ม "ดูรายชื่อ" การ์ดร้อยละผ่านครั้งแรกที่ Dashboard) — carry-forward เติมผลรอบก่อนให้ครบทุกวิชาของรอบ 1 อยู่แล้ว
            // (ดูแบบเดียวกับ countFullyPassed ฝั่ง backend) เช็ค every ตรงๆ จึงพอ ไม่ต้องเทียบ subjectIds ของรอบ
            firstAttempt: r1 ? {
              year: r1.round.academic_year,
              passed: r1.subject_results.length > 0 && r1.subject_results.every(sr => sr.is_passed),
              confirmed: r1.staff_status === 'approved',
            } : null,
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
    if (year !== 'ALL' && String(s.year) !== year) return false;
    if (eligible !== 'ALL' && s.eligible !== (eligible === 'YES')) return false;
    if (examResult === 'PASS' && !(s.allPass && s.status === 'CONFIRMED')) return false;
    if (examResult === 'FAIL' && !(s.subjectCount > 0 && s.passedCount === 0 && s.status === 'CONFIRMED')) return false;
    // มาจากคลิก "ผ่าน/ไม่ผ่าน" ในการ์ดอัตราผ่านรายวิชาที่ Dashboard — ต้องคำนวณด้วยกฎ**เดียวกันเป๊ะ**กับที่
    // dashboard.service.js ใช้คิดเลขบนบัตร ไม่งั้นตัวเลขบัตรกับจำนวนคนในลิสต์นี้จะไม่ตรงกัน (เจอบั๊กนี้มาแล้ว 2 รอบ):
    //
    // รอบแรกที่เจอ: เช็คแค่ "ผลล่าสุด" ของนักศึกษา ไม่กรองรอบ/ปี — แก้ไปแล้วด้วย roundId ด้านล่าง
    // รอบสองที่เจอ (ทดสอบแล้วเจอจริง — 57 คนหลุดเข้ามาทั้งที่บัตรบอก 5): กรณี "รวมทั้งปี" เดิมเช็คทุกใบ
    // "ทุกปี" ไม่ใช่แค่ปีที่กำลังดู แล้วใช้ .some() เช็คแยกอิสระ ทำให้คนที่ตกวิชานี้ไปแล้วแต่ "ไปสอบแก้ตัวผ่านทีหลัง
    // ในปีเดียวกัน" ยังติดอยู่ในลิสต์ "ไม่ผ่าน" ทั้งที่ปัจจุบันผ่านแล้ว (บัตรใช้กฎ "เคยผ่านสักรอบ = นับว่าผ่าน ชนะเสมอ")
    if (subjectFilter) {
      const relevant = subjectFilter.roundId
        ? s.allResults.filter(r => r.roundId === subjectFilter.roundId)
        : s.allResults.filter(r => r.academicYear === subjectFilter.year); // "รวมทั้งปี" — เฉพาะปีที่กำลังดู ไม่ใช่ทุกปีที่เคยมี
      const approved = relevant.filter(r => r.approved);
      const sitReal = (sub) => sub.code === subjectFilter.subjectCode && !sub.carriedForward; // สอบจริง ไม่ใช่ยกผลมา
      const everPassed = approved.some(r => r.subjects.some(sub => sitReal(sub) && sub.passed));
      const everAttempted = approved.some(r => r.subjects.some(sitReal));
      // เคยผ่านสักครั้ง = นับเป็นผ่านเสมอ (ชนะการตกครั้งก่อนหน้า) — ตกได้ก็ต่อเมื่อสอบจริงแล้วไม่เคยผ่านเลย
      const studentPassed = everPassed;
      if (!everAttempted) return false; // ไม่เคยสอบวิชานี้จริงเลยในสโคปนี้ ไม่เกี่ยว ไม่นับ
      if (studentPassed !== subjectFilter.passed) return false;
    }
    // มาจากปุ่ม "ดูรายชื่อ" การ์ดร้อยละผ่านครั้งแรก — ต้องเป็นใบรอบ 1 ของปีนั้น + ยืนยันแล้ว + ผ่าน/ไม่ผ่านตรงที่เลือก
    if (firstAttemptFilter && !(s.firstAttempt && s.firstAttempt.confirmed
      && s.firstAttempt.year === firstAttemptFilter.year && s.firstAttempt.passed === firstAttemptFilter.passed)) return false;
    if (q && !(`${s.firstName}${s.lastName}${s.sid}`.includes(q))) return false;
    return true;
  });
  const pageRows = filtered.slice(page * per, (page + 1) * per);
  const pages = Math.ceil(filtered.length / per);

  useEffect(() => setPage(0), [q, status, room, year, eligible, examResult, subjectFilter, firstAttemptFilter]);

  // ปีการศึกษา (พ.ศ.) ของนักศึกษาที่มีจริงในระบบ เรียงใหม่→เก่า
  const years = [...new Set(students.map(s => s.year).filter(Boolean))].sort((a, b) => b - a);

  // ─── เปิด/ปิดสิทธิ์กรอกผลสอบ ─────────────────────────
  // ติ๊กเลือกได้ทั้งที่ถูกกรองไว้ ไม่ใช่แค่หน้าปัจจุบัน — เปิดสิทธิ์ทั้งรุ่นทีเดียวจบ
  const allFilteredSelected = filtered.length > 0 && filtered.every(s => selected.has(s.sid));

  const toggleOne = (sid) => setSelected(prev => {
    const next = new Set(prev);
    next.has(sid) ? next.delete(sid) : next.add(sid);
    return next;
  });

  const toggleAllFiltered = () => setSelected(prev => {
    if (allFilteredSelected) {
      const next = new Set(prev);
      filtered.forEach(s => next.delete(s.sid));
      return next;
    }
    return new Set([...prev, ...filtered.map(s => s.sid)]);
  });

  const setEligibilityFor = async (ids, value) => {
    if (!ids.length) return;
    setSaving(true);
    try {
      await apiFetch('/students/bulk-eligible', {
        method: 'PATCH',
        body: { student_ids: ids, exam_eligible: value },
      });
      // อัปเดตในตารางเลย ไม่ต้องโหลดรายชื่อ+ผลสอบใหม่ทั้งชุด
      const touched = new Set(ids);
      setStudents(prev => prev.map(s => (touched.has(s.sid) ? { ...s, eligible: value } : s)));
      setSelected(new Set());
      toast?.(tt(value ? 'officer.students.grantedToast' : 'officer.students.revokedToast', { n: ids.length }));
    } catch (e) {
      toast?.(e instanceof ApiError ? e.message : tt('officer.students.eligibleFailMsg'), 'error');
    } finally {
      setSaving(false);
    }
  };
  // ลบนักศึกษาที่ import ผิด/ซ้ำ — ยืนยันก่อนเสมอเพราะลบแล้วกู้คืนไม่ได้
  const confirmDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await apiFetch(`/students/${deleting.sid}`, { method: 'DELETE' });
      setStudents(prev => prev.filter(s => s.sid !== deleting.sid));
      toast?.(tt('officer.students.deletedToast', { name: `${deleting.firstName} ${deleting.lastName}` }));
      setDeleting(null);
    } catch (e) {
      // backend ตอบ 409 พร้อมเหตุผลถ้าคนนี้มีผลสอบแล้ว — โชว์ข้อความนั้นตรงๆ
      toast?.(e instanceof ApiError ? e.message : tt('officer.students.deleteFailMsg'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // รีเซ็ตรหัสผ่านนักศึกษา = กรอกเลขบัตร ปชช เดิมซ้ำ (password นักศึกษา = hash(เลขบัตร ปชช) เสมอ ไม่มีรหัสชั่วคราว)
  // endpoint แยกจาก officer/executive (POST /students/:id/reset-password) เพราะ semantics ไม่เหมือนกัน
  const confirmReset = async () => {
    if (!resetting) return;
    setResetError('');
    if (!/^\d{13}$/.test(resetNationalId)) {
      setResetError('เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก');
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/students/${resetting.sid}/reset-password`, { method: 'POST', body: { national_id: resetNationalId } });
      toast?.(tt('usersMgmt.resetToast', { name: resetting.firstName }));
      setResetting(null);
      setResetNationalId('');
    } catch (e) {
      setResetError(e instanceof ApiError ? e.message : tt('detailReal.actionFailMsg'));
    } finally {
      setSaving(false);
    }
  };

  // export รายชื่อ (เฉพาะตอนกรองด้วย subjectFilter — คลิกมาจากปุ่ม "ผ่าน/ไม่ผ่าน N คน" ที่ Dashboard เท่านั้น)
  // ไฟล์ PDF ต้อง login ก่อน — fetch เป็น blob เองพร้อม credentials แทนใช้ <a href> ตรงๆ (pattern เดียวกับ reportsReal.jsx)
  const downloadSubjectPdf = async () => {
    if (!subjectFilter) return;
    setDownloading(true);
    try {
      const scope = subjectFilter.roundId
        ? `round_id=${subjectFilter.roundId}`
        : `year=${subjectFilter.year}`;
      const res = await fetch(
        `${API_BASE}/students/export-subject?subject_code=${subjectFilter.subjectCode}&passed=${subjectFilter.passed}&${scope}`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || tt('detailReal.actionFailMsg'));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `รายชื่อ-${subjectFilter.passed ? 'ผ่าน' : 'ไม่ผ่าน'}-${subjectFilter.subjectCode}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast?.(e.message, 'error');
    } finally {
      setDownloading(false);
    }
  };

  const setEligibility = (value) => setEligibilityFor([...selected], value);
  const toggleOneEligibility = (s) => {
    setEligibilityFor([s.sid], !s.eligible);
  };

  if (loading) return <div className="fade-up"><SkeletonTable rows={10} cols={5} /></div>;
  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>{tt('statuspage.loadFailPrefix', { msg: error })}</div>;

  return (
    <div className="fade-up">
      <PageHead title={tt('officer.students.title')} sub={tt('officer.students.sub', { found: filtered.length, total: students.length })}
        actions={returnView && (
          <button className="btn btn-ghost" onClick={() => onBackToDashboard?.(returnView)}>
            <Icon name="chevL" size={17} /> {tt('officer.students.backToDashboardBtn')}
          </button>
        )} />

      {subjectFilter && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <div className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
            background: subjectFilter.passed ? 'var(--status-ok-bg)' : 'var(--status-reject-bg)',
            color: subjectFilter.passed ? 'var(--status-ok-fg)' : 'var(--status-reject-fg)', fontWeight: 700 }}>
            <Icon name="eye" size={15} />
            {tt(subjectFilter.passed ? 'officer.students.subjectFilterPass' : 'officer.students.subjectFilterFail',
              { subject: `${subjectFilter.subjectCode} ${subjectName(lang, subjectFilter.subjectCode, subjectFilter.subjectFullName)}` })}
            <button onClick={() => setSubjectFilter(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer',
              color: 'inherit', display: 'flex', padding: 0 }} title={tt('officer.students.subjectFilterClear')}>
              <Icon name="xCircle" size={15} />
            </button>
          </div>
          <button className="btn btn-ghost btn-sm" disabled={downloading} onClick={downloadSubjectPdf}>
            <Icon name="pdf" size={15} /> {downloading ? tt('reportsReal.generating') : tt('reportsReal.downloadPdfBtn')}
          </button>
        </div>
      )}

      {firstAttemptFilter && (
        <div className="chip" style={{ marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 8,
          background: firstAttemptFilter.passed ? 'var(--status-ok-bg)' : 'var(--status-reject-bg)',
          color: firstAttemptFilter.passed ? 'var(--status-ok-fg)' : 'var(--status-reject-fg)', fontWeight: 700 }}>
          <Icon name="eye" size={15} />
          {tt(firstAttemptFilter.passed ? 'officer.students.firstAttemptFilterPass' : 'officer.students.firstAttemptFilterFail',
            { year: firstAttemptFilter.year })}
          <button onClick={() => setFirstAttemptFilter(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'inherit', display: 'flex', padding: 0 }} title={tt('officer.students.subjectFilterClear')}>
            <Icon name="xCircle" size={15} />
          </button>
        </div>
      )}

      <div className="card" style={{ padding: 14, marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Icon name="search" size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)' }} />
          <input className="input" placeholder={tt('officer.students.searchPh')} value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: 40 }} />
        </div>
        <Select style={{ width: 'auto', minWidth: 150 }} value={status} onChange={setStatus} lang={lang}
          ariaLabel={tt('officer.students.allStatus')}
          options={[
            { value: 'ALL', label: tt('officer.students.allStatus') },
            { value: 'SUBMITTED', label: tt('status.SUBMITTED') },
            { value: 'CONFIRMED', label: tt('status.CONFIRMED') },
            { value: 'REJECTED', label: tt('status.REJECTED') },
            { value: 'DRAFT', label: tt('status.DRAFT') },
          ]} />
        <Select style={{ width: 'auto', minWidth: 150 }} value={examResult} onChange={setExamResult} lang={lang}
          ariaLabel={tt('officer.students.allExamResult')}
          options={[
            { value: 'ALL', label: tt('officer.students.allExamResult') },
            { value: 'PASS', label: tt('officer.students.examResultPass') },
            { value: 'FAIL', label: tt('officer.students.examResultFail') },
          ]} />
        <Select style={{ width: 'auto', minWidth: 120 }} value={room} onChange={setRoom} lang={lang}
          ariaLabel={tt('officer.students.allRoom')}
          options={[{ value: 'ALL', label: tt('officer.students.allRoom') },
            ...rooms.map(r => ({ value: r, label: roomName(lang, r) }))]} />
        <Select style={{ width: 'auto', minWidth: 130 }} value={year} onChange={setYear} lang={lang}
          ariaLabel={tt('officer.students.allYear')}
          options={[{ value: 'ALL', label: tt('officer.students.allYear') },
            ...years.map(y => ({ value: String(y), label: tt('officer.students.yearOpt', { year: y }) }))]} />
        <Select style={{ width: 'auto', minWidth: 150 }} value={eligible} onChange={setEligible} lang={lang}
          ariaLabel={tt('officer.students.allEligible')}
          options={[
            { value: 'ALL', label: tt('officer.students.allEligible') },
            { value: 'YES', label: tt('officer.students.eligibleYes') },
            { value: 'NO', label: tt('officer.students.eligibleNo') },
          ]} />
      </div>

      {/* แถบจัดการสิทธิ์ — โผล่เฉพาะตอนติ๊กเลือกไว้ ไม่งั้นกินที่เปล่าๆ */}
      {!readonly && selected.size > 0 && (
        <div className="card" style={{ padding: '12px 18px', marginBottom: 18, display: 'flex', alignItems: 'center',
          gap: 12, flexWrap: 'wrap', borderColor: 'var(--navy-600)' }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{tt('officer.students.selectedCount', { n: selected.size })}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())} disabled={saving}>{tt('officer.students.clearSelection')}</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setEligibility(false)} disabled={saving}>
              <Icon name="xCircle" size={15} /> {tt('officer.students.revokeBtn')}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setEligibility(true)} disabled={saving}>
              <Icon name="checkCircle" size={15} /> {saving ? tt('officer.students.savingEligible') : tt('officer.students.grantBtn')}
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr>
              {!readonly && <th style={{ width: 40 }}>
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered}
                  aria-label={tt('officer.students.selectAllAria')} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              </th>}
              <th>{tt('officer.students.colStudent')}</th><th>{tt('officer.students.colRoom')}</th><th>{tt('officer.students.colYear')}</th>
              <th>{tt('officer.students.colEligible')}</th>
              <th>{tt('officer.students.colResult')}</th><th>{tt('officer.students.colStatus')}</th><th>{tt('officer.students.colSubmitted')}</th>
              {!readonly && <th>{tt('officer.students.revokeBtn')}</th>}
              <th></th>
            </tr></thead>
            <tbody>
              {pageRows.map(s => (
                <tr key={s.sid} className="clickable" onClick={() => { setSel(s); setDetailFrom('students'); go('detail'); }}>
                  {!readonly && <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(s.sid)} onChange={() => toggleOne(s.sid)}
                      aria-label={tt('officer.students.selectOneAria', { name: `${s.firstName} ${s.lastName}` })}
                      style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  </td>}
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={s.firstName} size={34} />
                    <div><div style={{ fontWeight: 600, fontSize: 16 }}>{s.firstName} {s.lastName}</div>
                    <div className="mono" style={{ fontSize: 14, color: 'var(--ink-500)' }}>{s.sid}</div></div></div></td>
                  <td><span className="chip" style={{ fontSize: 14 }}>{roomName(lang, s.room)}</span></td>
                  <td className="tnum" style={{ fontSize: 15, color: 'var(--ink-700)' }}>{s.year || '—'}</td>
                  <td><span className={'badge ' + (s.eligible ? 'ok' : 'draft')}><span className="dot"></span>
                    {s.eligible ? tt('officer.students.eligibleYes') : tt('officer.students.eligibleNo')}</span></td>
                  <td>{s.status === 'DRAFT' ? <span style={{ color: 'var(--ink-400)' }}>—</span> :
                    <span className="tnum" style={{ fontWeight: 700, color: s.allPass ? 'var(--pass)' : 'var(--ink-800)' }}>{s.passedCount}/{s.subjectCount}</span>}</td>
                  <td><StatusBadge status={s.status} lang={lang} /></td>
                  <td style={{ color: 'var(--ink-500)', fontSize: 15 }}>{s.submittedAt || '—'}</td>
                  {!readonly && <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                    <button disabled={saving} onClick={() => { setResetting(s); setResetNationalId(''); setResetError(''); }} title={tt('usersMgmt.resetHint')}
                      className="btn btn-ghost btn-sm" style={{ marginRight: 6 }}>
                      <Icon name="key" size={15} /> {tt('usersMgmt.resetBtn')}</button>
                    {s.eligible && <button disabled={saving} onClick={() => toggleOneEligibility(s)}
                      className="badge reject" style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <Icon name="xCircle" size={13} /> {tt('officer.students.revokeBtn')}</button>}
                    {/* ลบได้เฉพาะคนที่ยังไม่มีผลสอบ — คนที่กรอกแล้วลบไม่ได้ ไม่งั้นสถิติปีนั้นเปลี่ยนย้อนหลัง
                        backend กันซ้ำอีกชั้น ตรงนี้แค่ไม่โชว์ปุ่มให้กดเปล่าๆ */}
                    {s.status === 'DRAFT' && (
                      <button disabled={saving} onClick={() => setDeleting(s)} title={tt('officer.students.deleteHint')}
                        className="badge" style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 6,
                          background: 'var(--ink-100)', color: 'var(--ink-600)' }}>
                        <Icon name="trash" size={13} /> {tt('officer.students.deleteBtn')}</button>
                    )}
                  </td>}
                  <td style={{ textAlign: 'right' }}><Icon name="chevR" size={18} style={{ color: 'var(--ink-300)' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} onPage={setPage} lang={lang} />
      </div>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} width={430} title={tt('officer.students.deleteTitle')}
        footer={<><button className="btn btn-ghost" onClick={() => setDeleting(null)}>{tt('officer.students.cancelBtn')}</button>
          <button className="btn btn-danger" disabled={saving} onClick={confirmDelete}>
            {saving ? tt('officer.students.deleting') : tt('officer.students.deleteBtn')}</button></>}>
        {deleting && (
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: 'var(--ink-700)' }}>
            {tt('officer.students.deleteBody', { name: `${deleting.firstName} ${deleting.lastName}`, sid: deleting.sid })}
          </p>
        )}
      </Modal>

      <Modal open={!!resetting} onClose={() => setResetting(null)} width={430} title={tt('usersMgmt.resetBtn')}
        footer={<><button className="btn btn-ghost" onClick={() => setResetting(null)}>{tt('officer.students.cancelBtn')}</button>
          <button className="btn btn-primary" disabled={saving} onClick={confirmReset}>{tt('usersMgmt.resetBtn')}</button></>}>
        {resetting && (
          <>
            <p style={{ margin: '0 0 14px', fontSize: 16, lineHeight: 1.6, color: 'var(--ink-700)' }}>
              {tt('officer.students.resetNationalIdHint')}
            </p>
            <div className="field">
              <label>{tt('officer.students.resetNationalIdLabel')}</label>
              <input className="input mono" value={resetNationalId} onChange={e => setResetNationalId(e.target.value)}
                placeholder="1234567890123" autoFocus />
            </div>
            {resetError && <div style={{ color: 'var(--reject,#dc2626)', fontSize: 15, marginTop: 10 }}>{resetError}</div>}
          </>
        )}
      </Modal>
    </div>
  );
}
