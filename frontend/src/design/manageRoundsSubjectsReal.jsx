/* ============================================================
   เจ้าหน้าที่ — จัดการรอบการกรอกผลสอบ + รายวิชา (ข้อมูลจริงจาก backend)
   แทนที่ ManageRoundsSubjects เดิมใน officer-manage.jsx ที่ใช้ mock ROUNDS/SUBJECTS
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, Modal } from './components.jsx';
import { apiFetch, ApiError } from './api.js';

const toDateInput = (iso) => iso ? iso.slice(0, 10) : '';

export function ManageRoundsSubjectsReal({ toast }) {
  const [tab, setTab] = useState('rounds');
  const [rounds, setRounds] = useState(null);
  const [subs, setSubs] = useState(null);
  const [roundModal, setRoundModal] = useState(null); // 'new' | round | null
  const [subjectModal, setSubjectModal] = useState(null); // {} (new) | subject | null

  const loadRounds = () => apiFetch('/rounds').then(setRounds).catch(e => toast(e.message, 'error'));
  const loadSubs = () => apiFetch('/subjects').then(setSubs).catch(e => toast(e.message, 'error'));
  useEffect(() => { loadRounds(); loadSubs(); }, []);

  const saveRound = async (form) => {
    try {
      if (roundModal === 'new') {
        await apiFetch('/rounds', { method: 'POST', body: form });
        toast('เปิดรอบใหม่เรียบร้อย');
      } else {
        await apiFetch(`/rounds/${roundModal.round_id}`, { method: 'PUT', body: form });
        toast('บันทึกการแก้ไขเรียบร้อย');
      }
      setRoundModal(null);
      loadRounds();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'บันทึกไม่สำเร็จ', 'error');
    }
  };

  const saveSubject = async (form) => {
    try {
      if (subjectModal?.subject_id) {
        await apiFetch(`/subjects/${subjectModal.subject_id}`, { method: 'PUT', body: form });
      } else {
        await apiFetch('/subjects', { method: 'POST', body: form });
      }
      toast('บันทึกรายวิชาเรียบร้อย');
      setSubjectModal(null);
      loadSubs();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'บันทึกไม่สำเร็จ', 'error');
    }
  };

  const deleteSubject = async (s) => {
    try {
      await apiFetch(`/subjects/${s.subject_id}`, { method: 'DELETE' });
      toast('ลบรายวิชาแล้ว', 'info');
      loadSubs();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'ลบไม่สำเร็จ', 'error');
    }
  };

  if (!rounds || !subs) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>กำลังโหลดข้อมูล…</div>;

  return (
    <div className="fade-up">
      <PageHead title="จัดการรอบการกรอก และรายวิชา"
        sub={tab === 'rounds' ? 'เปิด/ปิดรอบการกรอกผลสอบของแต่ละครั้งสอบ' : 'รายวิชาที่ใช้ในการสอบใบประกอบวิชาชีพ'}
        actions={tab === 'rounds'
          ? <button className="btn btn-primary" onClick={() => setRoundModal('new')}><Icon name="plus" size={17} /> เปิดรอบใหม่</button>
          : <button className="btn btn-primary" onClick={() => setSubjectModal({})}><Icon name="plus" size={17} /> เพิ่มรายวิชา</button>} />

      <div style={{ display: 'inline-flex', background: 'var(--ink-100)', borderRadius: 9, padding: 3, gap: 3, marginBottom: 18 }}>
        <button onClick={() => setTab('rounds')} style={{ border: 'none', padding: '8px 18px', borderRadius: 7, fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
          background: tab === 'rounds' ? 'var(--navy-700)' : 'transparent', color: tab === 'rounds' ? '#fff' : 'var(--ink-500)' }}>รอบการกรอก</button>
        <button onClick={() => setTab('subjects')} style={{ border: 'none', padding: '8px 18px', borderRadius: 7, fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
          background: tab === 'subjects' ? 'var(--navy-700)' : 'transparent', color: tab === 'subjects' ? '#fff' : 'var(--ink-500)' }}>รายวิชา</button>
      </div>

      {tab === 'rounds' && (
        <div className="grid g-3">
          {rounds.map(r => (
            <div key={r.round_id} className="card card-pad">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span className={'badge ' + (r.status === 'open' ? 'ok' : 'draft')}><span className="dot"></span>{r.status === 'open' ? 'เปิดรับ' : 'ปิดแล้ว'}</span>
                <button className="btn btn-ghost btn-sm" style={{ padding: 7, border: 'none' }} onClick={() => setRoundModal(r)}><Icon name="edit" size={16} /></button>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>รอบที่ {r.attempt_number} / {r.academic_year}</div>
              <div className="hr" style={{ margin: '14px 0' }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--ink-500)' }}>เปิดรับ</span><b>{new Date(r.open_date).toLocaleDateString('th-TH')}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--ink-500)' }}>ปิดรับ</span><b>{new Date(r.close_date).toLocaleDateString('th-TH')}</b></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'subjects' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="tbl">
            <thead><tr><th style={{ width: 80 }}>ลำดับ</th><th style={{ width: 120 }}>รหัสวิชา</th><th>ชื่อวิชา</th><th></th></tr></thead>
            <tbody>{subs.map((s, i) => (
              <tr key={s.subject_id}><td className="tnum" style={{ color: 'var(--ink-500)' }}>{i + 1}</td>
                <td><span className="chip mono" style={{ fontSize: 12.5 }}>{s.subject_code}</span></td>
                <td style={{ fontWeight: 500 }}>{s.subject_name}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-ghost btn-sm" style={{ padding: 7, border: 'none' }} onClick={() => setSubjectModal(s)}><Icon name="edit" size={16} /></button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: 7, border: 'none', color: 'var(--fail)' }} onClick={() => deleteSubject(s)}><Icon name="trash" size={16} /></button>
                </td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <RoundModal round={roundModal} onClose={() => setRoundModal(null)} onSave={saveRound} />
      <SubjectModal subject={subjectModal} onClose={() => setSubjectModal(null)} onSave={saveSubject} />
    </div>
  );
}

function RoundModal({ round, onClose, onSave }) {
  const isNew = round === 'new';
  const r = isNew ? {} : (round || {});
  const [academicYear, setAcademicYear] = useState('');
  const [attemptNumber, setAttemptNumber] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [status, setStatus] = useState('open');

  useEffect(() => {
    if (!round) return;
    setAcademicYear(r.academic_year ?? '');
    setAttemptNumber(r.attempt_number ?? '');
    setOpenDate(toDateInput(r.open_date));
    setCloseDate(toDateInput(r.close_date));
    setStatus(r.status ?? 'open');
  }, [round]);

  return (
    <Modal open={!!round} onClose={onClose} title={isNew ? 'เปิดรอบการกรอกใหม่' : `แก้ไขรอบที่ ${r.attempt_number}/${r.academic_year}`}
      footer={<><button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
        <button className="btn btn-primary" onClick={() => onSave({ academic_year: academicYear, attempt_number: attemptNumber, open_date: openDate, close_date: closeDate, status })}>
          <Icon name="check" size={16} /> บันทึก</button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="grid g-2" style={{ gap: 14 }}>
          <div className="field"><label>ปีการศึกษา</label><input className="input" value={academicYear} onChange={e => setAcademicYear(e.target.value)} /></div>
          <div className="field"><label>ครั้งที่สอบ</label><input className="input" value={attemptNumber} onChange={e => setAttemptNumber(e.target.value)} /></div>
        </div>
        <div className="grid g-2" style={{ gap: 14 }}>
          <div className="field"><label>วันที่เปิดรับ</label><input className="input" type="date" value={openDate} onChange={e => setOpenDate(e.target.value)} /></div>
          <div className="field"><label>วันที่ปิดรับ</label><input className="input" type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} /></div>
        </div>
        {!isNew && <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          <input type="checkbox" checked={status === 'open'} onChange={e => setStatus(e.target.checked ? 'open' : 'closed')} style={{ width: 17, height: 17 }} /> สถานะ: เปิดใช้งาน
        </label>}
      </div>
    </Modal>
  );
}

function SubjectModal({ subject, onClose, onSave }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  useEffect(() => { setCode(subject?.subject_code || ''); setName(subject?.subject_name || ''); }, [subject]);
  return (
    <Modal open={!!subject} onClose={onClose} title={subject?.subject_id ? 'แก้ไขรายวิชา' : 'เพิ่มรายวิชา'} width={440}
      footer={<><button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
        <button className="btn btn-primary" onClick={() => onSave({ subject_code: code, subject_name: name })}>บันทึก</button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field"><label>รหัสวิชา</label><input className="input" value={code} onChange={e => setCode(e.target.value)} placeholder="เช่น NUR09" /></div>
        <div className="field"><label>ชื่อวิชา</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อรายวิชา" /></div>
      </div>
    </Modal>
  );
}
