/* ============================================================
   เจ้าหน้าที่ — จัดการรอบการกรอกผลสอบ + รายวิชา (ข้อมูลจริงจาก backend)
   แทนที่ ManageRoundsSubjects เดิมใน officer-manage.jsx ที่ใช้ mock ROUNDS/SUBJECTS
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { phaseOf, phaseLabel, phaseBadgeClass } from './roundPhase.js';
import { PageHead, Modal, Select, Pagination } from './components.jsx';
import { usePagedList } from './usePagedList.js';
import { SkeletonCards } from './skeletons.jsx';
import { apiFetch, ApiError } from './api.js';
import { t, subjectName } from './i18n.js';

/* ---- วันที่/เวลา: ยึดเวลาไทยเสมอ ----
   backend เก็บลง DB เป็น UTC และตีความค่าที่ส่งไปเป็นเวลาไทยเสมอ (ดู rounds.controller.js)
   ฝั่งนี้ก็ต้องใช้เวลาไทยเหมือนกัน ไม่ใช่ timezone ของเครื่องเจ้าหน้าที่
   ไม่งั้นเปิดจากโน้ตบุ๊กที่ตั้ง timezone ผิด จะเห็นเวลาไม่ตรงกับที่ backend บันทึกไว้จริง */
const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;

// ISO จาก backend (UTC) → ค่าที่ใส่ใน <input type="datetime-local"> เป็นเวลาไทย "YYYY-MM-DDTHH:mm"
const toDateTimeInput = (iso) => {
  if (!iso) return '';
  // บวก 7 ชม. แล้วอ่านแบบ UTC = ได้ตัวเลขหน้าปัดเวลาไทยพอดี
  return new Date(new Date(iso).getTime() + ICT_OFFSET_MS).toISOString().slice(0, 16);
};

// แสดงวันที่+เวลาไทยในลิสต์ เช่น "9 ส.ค. 2569 23:59"
const showThaiDateTime = (iso) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

// ค่าเริ่มต้นตอนสร้างรอบใหม่ — วันนี้ตามเวลาไทย ตามด้วยเวลาที่ระบุ
const todayAt = (hhmm) =>
  `${new Date(Date.now() + ICT_OFFSET_MS).toISOString().slice(0, 10)}T${hhmm}`;

export function ManageRoundsSubjectsReal({ toast, lang }) {
  const tt = (key, vars) => t(lang, key, vars);
  const [tab, setTab] = useState('rounds');
  const [rounds, setRounds] = useState(null);
  const [subs, setSubs] = useState(null);
  const [roundModal, setRoundModal] = useState(null); // 'new' | round | null
  const [subjectModal, setSubjectModal] = useState(null); // {} (new) | subject | null
  const [deleteRound, setDeleteRound] = useState(null); // รอบที่กำลังจะลบ (ยืนยันก่อน)
  // รายวิชาที่กำลังจะลบ — เดิมกดปุ่มถังขยะแล้วลบทันทีไม่ถามอะไรเลย พลาดคลิกทีเดียวหายทั้งวิชา
  // (ลบรอบถามอยู่แล้ว ตรงนี้ขาดไป) วิชาถูกใช้ในรอบ/ผลสอบเก่า ลบผิดกระทบย้อนหลังทั้งระบบ
  const [deleteSubjectTarget, setDeleteSubjectTarget] = useState(null);
  const [cohorts, setCohorts] = useState([]); // [{ year, count }] รุ่นนักศึกษาที่มีจริงในระบบ
  // กรองรายการรอบ — 'open' = เฉพาะรอบที่ยังเปิดรับ, 'all' = ทุกรอบ, หรือเลือกปีเจาะจง
  const [yearFilter, setYearFilter] = useState('open');

  const loadRounds = () => apiFetch('/rounds').then(setRounds).catch(e => toast(e.message, 'error'));
  const loadSubs = () => apiFetch('/subjects').then(setSubs).catch(e => toast(e.message, 'error'));
  useEffect(() => {
    loadRounds(); loadSubs();
    // รุ่นนักศึกษาที่มีอยู่จริง — เอาไว้ช่วยเลือกกลุ่มเป้าหมายของรอบ กันพิมพ์ปีผิดเป็นรุ่นที่ไม่มีใครอยู่
    // เอาเฉพาะปีที่มีนักศึกษา import เข้ามาแล้วจริงๆ ไม่เดาปีปัจจุบันให้ — รุ่นที่ยังไม่ import ใช้ "กรอกเอง" ในฟอร์มแทน
    apiFetch('/students').then(list => {
      const byYear = new Map();
      for (const s of list) byYear.set(s.academic_year, (byYear.get(s.academic_year) || 0) + 1);
      setCohorts([...byYear.entries()].map(([year, count]) => ({ year, count })).sort((a, b) => b.year - a.year));
    }).catch(() => {});
  }, []);

  const saveRound = async (form) => {
    try {
      if (roundModal === 'new') {
        await apiFetch('/rounds', { method: 'POST', body: form });
        toast(tt('roundsMgmt.newRoundToast'));
      } else {
        await apiFetch(`/rounds/${roundModal.round_id}`, { method: 'PUT', body: form });
        toast(tt('roundsMgmt.savedToast'));
      }
      // รอบที่เพิ่งบันทึกต้องเห็นได้เสมอ ไม่งั้นดูเหมือนบันทึกไม่สำเร็จแล้วกดซ้ำ
      // เกิดได้ 2 แบบ: ปิดรอบทั้งที่กรอง "เฉพาะรอบที่เปิดรับ" · สร้างรอบให้รุ่นอื่นทั้งที่กรองรุ่นใดรุ่นหนึ่งอยู่
      // ตัวกรองไม่ครอบรอบนี้เมื่อไหร่ ก็สลับไปที่รุ่นของรอบนั้นให้เลย
      const visibleAfterSave =
        yearFilter === 'all' ||
        (yearFilter === 'open' && form.status === 'open') ||
        String(yearFilter) === String(form.academic_year);
      if (!visibleAfterSave) setYearFilter(String(form.academic_year));
      setRoundModal(null);
      loadRounds();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : tt('roundsMgmt.saveFailMsg'), 'error');
    }
  };

  const confirmDeleteRound = async () => {
    try {
      await apiFetch(`/rounds/${deleteRound.round_id}`, { method: 'DELETE' });
      toast('ลบรอบแล้ว', 'info');
      setDeleteRound(null);
      loadRounds();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'ลบไม่สำเร็จ', 'error');
    }
  };

  const saveSubject = async (form) => {
    try {
      if (subjectModal?.subject_id) {
        await apiFetch(`/subjects/${subjectModal.subject_id}`, { method: 'PUT', body: form });
      } else {
        await apiFetch('/subjects', { method: 'POST', body: form });
      }
      toast(tt('roundsMgmt.subjectSavedToast'));
      setSubjectModal(null);
      loadSubs();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : tt('roundsMgmt.saveFailMsg'), 'error');
    }
  };

  const deleteSubject = async (s) => {
    try {
      await apiFetch(`/subjects/${s.subject_id}`, { method: 'DELETE' });
      toast(tt('roundsMgmt.subjectDeletedToast'), 'info');
      setDeleteSubjectTarget(null);
      loadSubs();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : tt('roundsMgmt.deleteFailMsg'), 'error');
    }
  };

  // กรอง+เรียงรอบก่อน แล้วค่อยแบ่งหน้า (เดิมวาดทุกรอบรวดเดียว ปีผ่านไปการ์ดจะยาวไม่สิ้นสุด)
  const visibleRounds = (rounds ?? [])
    .filter(r => {
      // "รอบที่ยังเปิดอยู่" = รอบที่เจ้าหน้าที่ยังไม่ได้กดปิด (ไม่ใช่แค่รอบที่รับกรอกได้ตอนนี้)
      // ต้องรวม scheduled (ยังไม่ถึงวันเปิด) กับ expired (เลยวันปิดแต่ยังไม่กดปิด) ด้วย
      // ไม่งั้นรอบที่ตั้งวันผิดจะหายจากหน้าจอ แล้วเจ้าหน้าที่หาไม่เจอว่าจะไปแก้ตรงไหน
      if (yearFilter === 'open') return phaseOf(r) !== 'closed';
      if (yearFilter === 'all') return true;
      return String(r.academic_year) === String(yearFilter);
    })
    .sort((a, b) => b.academic_year - a.academic_year || b.attempt_number - a.attempt_number);

  // hook ต้องเรียกก่อน early-return เสมอ — resetKey = yearFilter ให้เด้งกลับหน้า 1 เมื่อเปลี่ยนตัวกรอง
  const roundsPage = usePagedList(visibleRounds, 9, yearFilter);
  const subsPage = usePagedList(subs ?? [], 15);

  if (!rounds || !subs) return <div className="fade-up"><SkeletonCards count={6} /></div>;

  // ปีในตัวกรอง = ปีที่ "มีรอบอยู่จริง" ไม่ใช่รุ่นนักศึกษาทั้งหมด — เลือกปีที่ไม่มีรอบแล้วได้หน้าว่างเปล่า
  const filterYears = [...new Set(rounds.map(r => r.academic_year))].sort((a, b) => b - a);

  return (
    <div className="fade-up">
      <PageHead title={tt('roundsMgmt.title')}
        sub={tab === 'rounds' ? tt('roundsMgmt.roundsSub') : tt('roundsMgmt.subjectsSub')}
        actions={tab === 'rounds'
          ? <button className="btn btn-primary" onClick={() => setRoundModal('new')}><Icon name="plus" size={17} /> {tt('roundsMgmt.newRoundBtn')}</button>
          : <button className="btn btn-primary" onClick={() => setSubjectModal({})}><Icon name="plus" size={17} /> {tt('roundsMgmt.addSubjectBtn')}</button>} />

      <div style={{ display: 'inline-flex', background: 'var(--ink-100)', borderRadius: 9, padding: 3, gap: 3, marginBottom: 18 }}>
        <button onClick={() => setTab('rounds')} style={{ border: 'none', padding: '8px 18px', borderRadius: 7, fontSize: 15.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
          background: tab === 'rounds' ? 'var(--navy-700)' : 'transparent', color: tab === 'rounds' ? '#fff' : 'var(--ink-500)' }}>{tt('roundsMgmt.tabRounds')}</button>
        <button onClick={() => setTab('subjects')} style={{ border: 'none', padding: '8px 18px', borderRadius: 7, fontSize: 15.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
          background: tab === 'subjects' ? 'var(--navy-700)' : 'transparent', color: tab === 'subjects' ? '#fff' : 'var(--ink-500)' }}>{tt('roundsMgmt.tabSubjects')}</button>
      </div>

      {tab === 'rounds' && (
        <>
        {/* ตัวกรองรายการ ไม่ใช่ช่องกรอกในฟอร์ม — ใช้ label คนละอันกับใน modal จะได้ไม่มี * หลอกว่าบังคับกรอก */}
        <div className="field" style={{ maxWidth: 240, marginBottom: 14 }}>
          <label>{tt('roundsMgmt.filterCohort')}</label>
          <Select value={yearFilter} onChange={setYearFilter} lang={lang}
            options={[
              { value: 'open', label: tt('roundsMgmt.yearFilterOpen') },
              { value: 'all', label: tt('roundsMgmt.yearFilterAll') },
              ...filterYears.map(y => ({ value: String(y), label: String(y) })),
            ]} />
        </div>
        <div className="grid g-3">
          {roundsPage.rows.map(r => {
            return (
            <div key={r.round_id} className="card card-pad">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span className={'badge ' + phaseBadgeClass(r)}><span className="dot"></span>{phaseLabel(r, tt)}</span>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button className="btn btn-ghost btn-sm" style={{ padding: 7, border: 'none' }} aria-label={tt('roundsMgmt.editRoundAria')}
                    onClick={() => setRoundModal(r)}><Icon name="edit" size={16} /></button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: 7, border: 'none', color: 'var(--fail)' }} aria-label={tt('roundsMgmt.deleteRoundAria')}
                    onClick={() => setDeleteRound(r)}><Icon name="trash" size={16} /></button>
                </div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{tt('roundsMgmt.roundLine', { attempt: r.attempt_number, year: r.academic_year })}</div>
              <div style={{ fontSize: 14.5, color: 'var(--ink-500)', marginTop: 4 }}>{tt('roundsMgmt.targetLine', { year: r.academic_year })}</div>
              <div className="hr" style={{ margin: '14px 0' }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 15 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--ink-500)' }}>{tt('roundsMgmt.openDateLabel')}</span><b>{showThaiDateTime(r.open_date)}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--ink-500)' }}>{tt('roundsMgmt.closeDateLabel')}</span><b>{showThaiDateTime(r.close_date)}</b></div>
                {/* บอกให้ชัดว่าทำไมนักศึกษายังกรอกไม่ได้ ทั้งที่รอบขึ้นว่าเปิด */}
                {phaseOf(r) === 'scheduled' && (
                  <div style={{ fontSize: 14, color: 'var(--ink-500)', background: 'var(--status-draft-bg)', padding: '7px 10px', borderRadius: 8 }}>
                    {tt('roundPhase.scheduledHint', { date: showThaiDateTime(r.open_date) })}
                  </div>
                )}
                {phaseOf(r) === 'expired' && (
                  <div style={{ fontSize: 14, color: 'var(--status-wait-fg)', background: 'var(--status-wait-bg)', padding: '7px 10px', borderRadius: 8 }}>
                    {tt('roundPhase.expiredHint')}
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
        {roundsPage.pages > 1 && (
          <div className="card" style={{ overflow: 'hidden', marginTop: 14 }}>
            <Pagination page={roundsPage.page} pages={roundsPage.pages} onPage={roundsPage.setPage} lang={lang} />
          </div>
        )}
        {visibleRounds.length === 0 && (
          <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--ink-500)', fontSize: 15.5 }}>
            {tt('roundsMgmt.noRoundInFilter')}
          </div>
        )}
        </>
      )}

      {tab === 'subjects' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="tbl">
            <thead><tr><th style={{ width: 80 }}>{tt('roundsMgmt.colOrder')}</th><th style={{ width: 120 }}>{tt('roundsMgmt.colCode')}</th><th>{tt('roundsMgmt.colName')}</th><th></th></tr></thead>
            {/* ลำดับต้องนับต่อจากหน้าก่อน ไม่ใช่เริ่ม 1 ใหม่ทุกหน้า */}
            <tbody>{subsPage.rows.map((s, i) => (
              <tr key={s.subject_id}><td className="tnum" style={{ color: 'var(--ink-500)' }}>{subsPage.page * 15 + i + 1}</td>
                <td><span className="chip mono" style={{ fontSize: 14.5 }}>{s.subject_code}</span></td>
                <td style={{ fontWeight: 500 }}>{subjectName(lang, s.subject_code, s.subject_name)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-ghost btn-sm" style={{ padding: 7, border: 'none' }} onClick={() => setSubjectModal(s)}><Icon name="edit" size={16} /></button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: 7, border: 'none', color: 'var(--fail)' }}
                    aria-label={tt('roundsMgmt.deleteSubjectAria')} onClick={() => setDeleteSubjectTarget(s)}><Icon name="trash" size={16} /></button>
                </td></tr>
            ))}</tbody>
          </table>
          <Pagination page={subsPage.page} pages={subsPage.pages} onPage={subsPage.setPage} lang={lang} />
        </div>
      )}

      <Modal open={!!deleteSubjectTarget} onClose={() => setDeleteSubjectTarget(null)} title={tt('roundsMgmt.deleteSubjectTitle')} width={440} tone="danger"
        footer={<><button className="btn btn-ghost" onClick={() => setDeleteSubjectTarget(null)}>{tt('roundsMgmt.cancelBtn')}</button>
          <button className="btn btn-primary" style={{ background: 'var(--fail)', borderColor: 'var(--fail)' }}
            onClick={() => deleteSubject(deleteSubjectTarget)}>{tt('roundsMgmt.deleteSubjectBtn')}</button></>}>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7 }}>
          {tt('roundsMgmt.deleteSubjectBody', { code: deleteSubjectTarget?.subject_code, name: deleteSubjectTarget?.subject_name })}
        </p>
        <p style={{ margin: '10px 0 0', fontSize: 14.5, color: 'var(--ink-500)' }}>{tt('roundsMgmt.deleteSubjectNote')}</p>
      </Modal>

      <RoundModal round={roundModal} allSubjects={subs} cohorts={cohorts} onClose={() => setRoundModal(null)} onSave={saveRound} tt={tt} lang={lang} />
      <Modal open={!!deleteRound} onClose={() => setDeleteRound(null)} title={tt('roundsMgmt.deleteRoundTitle')} width={440} tone="danger"
        footer={<><button className="btn btn-ghost" onClick={() => setDeleteRound(null)}>{tt('roundsMgmt.cancelBtn')}</button>
          <button className="btn btn-danger" onClick={confirmDeleteRound}><Icon name="trash" size={16} /> {tt('roundsMgmt.deleteRoundBtn')}</button></>}>
        <div style={{ fontSize: 16, lineHeight: 1.7 }}>
          {tt('roundsMgmt.deleteRoundBodyPre')} <b>{tt('roundsMgmt.roundLine', { attempt: deleteRound?.attempt_number, year: deleteRound?.academic_year })}</b> {tt('roundsMgmt.deleteRoundBodyPost')}<br />
          <span style={{ color: 'var(--ink-500)', fontSize: 15 }}>
            {tt('roundsMgmt.deleteRoundNote')}
          </span>
        </div>
      </Modal>
      <SubjectModal subject={subjectModal} onClose={() => setSubjectModal(null)} onSave={saveSubject} tt={tt} />
    </div>
  );
}

function RoundModal({ round, allSubjects, cohorts, onClose, onSave, tt, lang }) {
  const isNew = round === 'new';
  const r = isNew ? {} : (round || {});
  const [academicYear, setAcademicYear] = useState('');
  const [attemptNumber, setAttemptNumber] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [status, setStatus] = useState('open');
  const [subjectIds, setSubjectIds] = useState([]); // วิชาที่รอบนี้ทดสอบ
  const [customYear, setCustomYear] = useState(false); // เปิดรอบให้รุ่นที่ยังไม่มีนักศึกษาในระบบ

  useEffect(() => {
    if (!round) return;
    setAcademicYear(r.academic_year ?? '');
    setCustomYear(!!r.academic_year && !cohorts.some(c => c.year === r.academic_year));
    setAttemptNumber(r.attempt_number ?? '');
    // รอบใหม่: เปิดรับวันนี้ 00:00 ปิดรับวันนี้ 23:59 — เจ้าหน้าที่แก้เวลาต่อได้เอง
    setOpenDate(isNew ? todayAt('00:00') : toDateTimeInput(r.open_date));
    setCloseDate(isNew ? todayAt('23:59') : toDateTimeInput(r.close_date));
    setStatus(r.status ?? 'open');
    // รอบเก่าที่ยังไม่เคยเลือกวิชา (subject_ids ว่าง) ให้ถือว่าเลือกครบทุกวิชา
    const saved = r.subject_ids;
    setSubjectIds(saved?.length ? saved : allSubjects.map(s => s.subject_id));
  }, [round]);

  const toggleSubject = (id) =>
    setSubjectIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);

  // รอบที่เปิดรับอยู่แล้ว backend ล็อกไม่ให้แก้วิชา — ปิด checkbox ให้ตรงกัน
  const subjectsLocked = !isNew && r.status === 'open';

  // ต้องกรอกให้ครบก่อนกด "บันทึก" ได้ — กันส่งวันที่ว่างไป backend แล้วพัง
  const isValid = academicYear && attemptNumber && openDate && closeDate && subjectIds.length > 0;

  return (
    <Modal open={!!round} onClose={onClose} width={580} title={isNew ? tt('roundsMgmt.newRoundModalTitle') : tt('roundsMgmt.editRoundModalTitle', { attempt: r.attempt_number, year: r.academic_year })}
      footer={<><button className="btn btn-ghost" onClick={onClose}>{tt('roundsMgmt.cancelBtn')}</button>
        <button className="btn btn-primary" disabled={!isValid}
          onClick={() => onSave({
            academic_year: academicYear, attempt_number: attemptNumber,
            // ส่งเป็น "YYYY-MM-DDTHH:mm" ตรงๆ — backend ตีความเป็นเวลาไทยให้เอง
            open_date: openDate, close_date: closeDate, status,
            // รอบที่เปิดอยู่ห้ามส่ง subject_ids ไป ไม่งั้น backend ตอบ 400
            ...(subjectsLocked ? {} : { subject_ids: subjectIds }),
          })}>
          <Icon name="check" size={16} /> {tt('roundsMgmt.saveBtn')}</button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="grid g-2 fields-row" style={{ gap: 14 }}>
          {/* academic_year ของรอบ = กลุ่มเป้าหมาย: backend เปิดรอบนี้ให้เฉพาะนักศึกษารุ่นเดียวกันเท่านั้น */}
          <div className="field">
            <label>{tt('roundsMgmt.fieldCohort')}</label>
            {customYear || cohorts.length === 0 ? (
              <input className="input tnum" type="number" value={academicYear} placeholder="2568"
                onChange={e => setAcademicYear(e.target.value)} />
            ) : (
              <Select value={String(academicYear)} lang={lang}
                onChange={v => { if (v === '__custom') { setCustomYear(true); setAcademicYear(''); } else setAcademicYear(v); }}
                options={[
                  { value: '', label: tt('roundsMgmt.cohortPickOpt') },
                  ...cohorts.map(c => ({ value: String(c.year),
                    label: tt('roundsMgmt.cohortOpt', { year: c.year, count: c.count }) })),
                  { value: '__custom', label: tt('roundsMgmt.cohortCustomOpt') },
                ]} />
            )}
            <span className="hint">
              {customYear && cohorts.length > 0
                ? <>{tt('roundsMgmt.cohortManualHint')} <button type="button" onClick={() => { setCustomYear(false); setAcademicYear(''); }}
                    style={{ border: 'none', background: 'none', padding: 0, color: 'var(--navy-600)', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}>
                    {tt('roundsMgmt.cohortBackToList')}</button></>
                : tt('roundsMgmt.cohortHint')}
            </span>
          </div>
          <div className="field"><label>{tt('roundsMgmt.fieldAttempt')}</label><input className="input tnum" type="number" value={attemptNumber} onChange={e => setAttemptNumber(e.target.value)} placeholder="1" /></div>
        </div>
        <div className="grid g-2 fields-row" style={{ gap: 14 }}>
          {/* datetime-local = เลือกได้ทั้งวันที่และเวลา ค่าที่ได้คือ "YYYY-MM-DDTHH:mm" */}
          <div className="field"><label>{tt('roundsMgmt.fieldOpenDate')}</label><input className="input" type="datetime-local" value={openDate} onChange={e => setOpenDate(e.target.value)} /></div>
          <div className="field"><label>{tt('roundsMgmt.fieldCloseDate')}</label><input className="input" type="datetime-local" value={closeDate} onChange={e => setCloseDate(e.target.value)} /></div>
        </div>
        <div className="field">
          <label>{tt('roundsMgmt.fieldSubjects')} <span style={{ fontWeight: 400, color: 'var(--ink-500)' }}>{tt('roundsMgmt.selectedCount', { n: subjectIds.length, total: allSubjects.length })}</span></label>
          {subjectsLocked && <div style={{ fontSize: 14.5, color: 'var(--ink-500)', marginBottom: 8 }}>
            {tt('roundsMgmt.lockedNote')}
          </div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200, overflowY: 'auto',
            border: '1px solid var(--ink-200)', borderRadius: 9, padding: 8, opacity: subjectsLocked ? .55 : 1 }}>
            {allSubjects.map(s => (
              <label key={s.subject_id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 6px',
                fontSize: 15.5, cursor: subjectsLocked ? 'default' : 'pointer' }}>
                <input type="checkbox" disabled={subjectsLocked}
                  checked={subjectIds.includes(s.subject_id)}
                  onChange={() => toggleSubject(s.subject_id)}
                  style={{ width: 16, height: 16, flex: 'none' }} />
                <span className="mono" style={{ fontSize: 14, color: 'var(--ink-400)', width: 52, flex: 'none' }}>{s.subject_code}</span>
                <span>{subjectName(lang, s.subject_code, s.subject_name)}</span>
              </label>
            ))}
          </div>
        </div>

        {!isNew && <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
          <input type="checkbox" checked={status === 'open'} onChange={e => setStatus(e.target.checked ? 'open' : 'closed')} style={{ width: 17, height: 17 }} /> {tt('roundsMgmt.statusOpenLabel')}
        </label>}

        {/* สรุปก่อนกดบันทึก: รอบนี้จะเปิดให้ใครบ้าง
            รอบผูกกับรุ่นเดียว (backend เปิดให้เฉพาะคนที่ academic_year ตรงกับรอบ)
            พิมพ์ปีผิดไปตัวเดียวก็เปิดให้คนผิดรุ่น/ไม่เปิดให้ใครเลย ซึ่งเดิมไม่มีทางรู้จนกว่านักศึกษาจะโทรมาถาม
            เลขที่โชว์มาจาก cohorts (นับจากตาราง students จริง) ไม่ใช่เดาจากปี */}
        {/* รอให้พิมพ์ครบ 4 หลักก่อน — โหมดพิมพ์ปีเองจะเตือน "ไม่มีรุ่น 25" ตั้งแต่พิมพ์ตัวที่สองถ้าไม่เช็ค */}
        {String(academicYear).length === 4 &&
          <CohortPreview year={Number(academicYear)} cohorts={cohorts} tt={tt} />}

        {!isValid && <div style={{ fontSize: 14.5, color: 'var(--ink-500)' }}>{tt('roundsMgmt.fillAllNote')}</div>}
      </div>
    </Modal>
  );
}

/* กล่องสรุป "รอบนี้จะเปิดให้ใคร" ใต้ฟอร์มสร้าง/แก้รอบ
   2 สถานะ:
     มีนักศึกษาในรุ่นนั้น  → เขียว บอกจำนวนคน
     ไม่มีเลย (0 คน)      → ส้ม เตือนว่าเปิดไปก็ไม่มีใครกรอกได้ (ปกติแปลว่าพิมพ์ปีผิด) */
function CohortPreview({ year, cohorts, tt }) {
  const hit = cohorts.find(c => c.year === year);
  const count = hit ? hit.count : 0;
  const ok = count > 0;
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 10,
      background: ok ? 'var(--status-ok-bg)' : 'var(--status-wait-bg)',
      color: ok ? 'var(--status-ok-fg)' : 'var(--status-wait-fg)' }}>
      <Icon name={ok ? 'users' : 'alert'} size={18} style={{ flex: 'none', marginTop: 1 }} />
      <div style={{ fontSize: 15 }}>
        <div style={{ fontWeight: 700 }}>
          {ok ? tt('roundsMgmt.previewOk', { year, count }) : tt('roundsMgmt.previewEmpty', { year })}
        </div>
        <div style={{ fontSize: 14, marginTop: 2, opacity: .85 }}>
          {ok ? tt('roundsMgmt.previewOkHint') : tt('roundsMgmt.previewEmptyHint')}
        </div>
      </div>
    </div>
  );
}

function SubjectModal({ subject, onClose, onSave, tt }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  useEffect(() => { setCode(subject?.subject_code || ''); setName(subject?.subject_name || ''); }, [subject]);
  return (
    <Modal open={!!subject} onClose={onClose} title={subject?.subject_id ? tt('roundsMgmt.editSubjectTitle') : tt('roundsMgmt.addSubjectTitle')} width={440}
      footer={<><button className="btn btn-ghost" onClick={onClose}>{tt('roundsMgmt.cancelBtn')}</button>
        <button className="btn btn-primary" onClick={() => onSave({ subject_code: code, subject_name: name })}>{tt('roundsMgmt.saveBtn')}</button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field"><label>{tt('roundsMgmt.fieldSubjectCode')}</label><input className="input" value={code} onChange={e => setCode(e.target.value)} placeholder={tt('roundsMgmt.subjectCodePh')} /></div>
        <div className="field"><label>{tt('roundsMgmt.fieldSubjectName')}</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder={tt('roundsMgmt.subjectNamePh')} /></div>
      </div>
    </Modal>
  );
}
