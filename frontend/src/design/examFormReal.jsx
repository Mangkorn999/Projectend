/* ============================================================
   นักศึกษา — กรอกผลสอบรายวิชา + แนบใบรายงานผลสอบ (ข้อมูลจริงจาก backend)
   แนบได้หลายไฟล์: PDF หรือรูปถ่าย (JPG, PNG) สูงสุด 5 ไฟล์ ไฟล์ละไม่เกิน 10 MB
   (ค่าตัวเลขอยู่ใน evidenceFiles.js ที่เดียว)

   เงื่อนไขที่กรอกได้: มีรอบของรุ่นตัวเองเปิดรับอยู่ (GET /rounds/active) + เจ้าหน้าที่เปิดสิทธิ์ให้แล้ว
   ข้อยกเว้น: ใบที่ถูกตีกลับ แก้และส่งใหม่ได้แม้รอบปิดไปแล้ว — backend บอกมาทาง can_fix_rejected: true

   ลำดับการส่ง (ต้องเรียงแบบนี้ เพราะ backend ให้แนบ/ลบไฟล์ได้เฉพาะตอนรอบเปิด หรือตอนใบยัง "ถูกตีกลับ" อยู่):
     ใบใหม่ → 1) POST /exam-results (ได้เลขใบ result_id)  2) อัปโหลดไฟล์ทีละไฟล์
     ใบเดิม → 1) ลบไฟล์เดิมที่กด "นำออก"  2) อัปโหลดไฟล์ใหม่  3) POST /exam-results
              ถ้าส่งผลก่อน ใบที่ถูกตีกลับจะกลับเป็น "รอตรวจสอบ" แล้วถ้ารอบปิดไปแล้วจะแนบไฟล์ไม่ได้อีก
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, Donut, Loading } from './components.jsx';
import { apiFetch, ApiError } from './api.js';
import { t, subjectName } from './i18n.js';
import {
  MAX_EVIDENCE_FILES, MAX_FILE_SIZE_MB, EVIDENCE_ACCEPT,
  certificateTypeLabel, fileKindOf, fileKindLabel, fileKindIcon, fileSizeText,
} from './evidenceFiles.js';

export function ExamFormReal({ go, toast, lang }) {
  const tt = (key, vars) => t(lang, key, vars);
  const [subjects, setSubjects] = useState([]);
  const [round, setRound] = useState(null);
  const [blocked, setBlocked] = useState('');       // เหตุผลที่กรอกไม่ได้ (ไม่มีสิทธิ์/ไม่มีรอบ/ยืนยันแล้ว)
  const [blockedSub, setBlockedSub] = useState(''); // คำอธิบายเพิ่มใต้เหตุผล (ว่าง = ไม่แสดง)
  // ใบของรอบนี้ที่ส่งไปแล้ว (ถ้ามี) — แก้ทับได้จนกว่าเจ้าหน้าที่จะยืนยัน
  const [existing, setExisting] = useState(null);
  const [results, setResults] = useState({}); // { [subject_id]: true | false }

  // ไฟล์หลักฐานแบ่งเป็น 3 กลุ่ม
  const [keptFiles, setKeptFiles] = useState([]);       // ไฟล์เดิมของใบนี้ที่ยังเก็บไว้ (ข้อมูลจาก backend)
  const [removedFiles, setRemovedFiles] = useState([]); // ไฟล์เดิมที่กด "นำออก" — ลบจริงตอนกดส่ง
  const [newFiles, setNewFiles] = useState([]);         // ไฟล์ที่เพิ่งเลือกจากเครื่อง — อัปโหลดตอนกดส่ง
  const [fileErrors, setFileErrors] = useState([]);     // ไฟล์ที่แนบไม่ได้ พร้อมเหตุผล (ทีละไฟล์)

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');   // โหลดหน้าไม่สำเร็จ — แสดงแทนทั้งหน้า
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(''); // ส่งไม่สำเร็จ — แสดงในการ์ดด้านขวา ฟอร์มยังอยู่ครบ

  // ข้อความ error ที่โชว์ผู้ใช้ได้ — ApiError มีข้อความภาษาไทยจาก backend อยู่แล้ว
  const messageOf = (error) => {
    if (error instanceof ApiError) {
      return error.message;
    }
    return tt('examform.submitFailMsg');
  };

  // หาใบของรอบที่ระบุ จากประวัติทั้งหมดของตัวเอง (ไม่เจอ = null)
  const findPaperOfRound = (papers, roundId) => {
    for (const paper of papers) {
      if (paper.round_id === roundId) {
        return paper;
      }
    }
    return null;
  };

  // บอกเหตุผลที่รอบนี้กรอกไม่ได้ ตามสถานะของรอบ
  const showRoundBlocked = (activeRound) => {
    if (activeRound.phase === 'scheduled') {
      const openText = new Date(activeRound.open_date).toLocaleDateString(
        lang === 'EN' ? 'en-GB' : 'th-TH',
        { day: 'numeric', month: 'long', year: 'numeric' },
      );
      setBlocked(tt('examform.scheduledRound', { attempt: activeRound.attempt_number, date: openText }));
      setBlockedSub(tt('examform.scheduledSub'));
    } else if (activeRound.phase === 'expired') {
      setBlocked(tt('examform.expiredRound'));
      setBlockedSub(tt('examform.expiredSub'));
    } else {
      setBlocked(tt('examform.closedRound'));
      setBlockedSub(tt('examform.expiredSub'));
    }
  };

  // เตรียมฟอร์มจากรอบที่ได้มา + ใบของรอบนี้ (ถ้ามี) — ถ้าโหลดไม่สำเร็จจะโยน error ต่อให้ useEffect ด้านล่างจัดการ
  const prepareForm = async (activeRound) => {
    if (!activeRound) {
      setBlocked(tt('examform.noActiveRound'));
      return;
    }

    // รอบที่ไม่ได้เปิดรับ (ยังไม่ถึงวันเปิด / เลยวันปิด / ปิดแล้ว) กรอกไม่ได้
    // ยกเว้น backend บอกว่ามีใบที่ถูกตีกลับรอแก้อยู่ (can_fix_rejected)
    const acceptingNow = activeRound.phase === 'active';
    const canFixRejected = activeRound.can_fix_rejected === true;
    if (!acceptingNow && !canFixRejected) {
      showRoundBlocked(activeRound);
      return;
    }

    setRound(activeRound);
    setSubjects(activeRound.subjects || []);
    if (activeRound.all_passed) {
      setBlocked(tt('examform.allPassedRound'));
      return;
    }

    const myPapers = await apiFetch('/exam-results/me');
    const paper = findPaperOfRound(myPapers, activeRound.round_id);

    // ยืนยันแล้ว = แก้ไม่ได้อีก (pending กับ rejected ยังแก้ได้ — backend เช็คซ้ำอีกชั้นตอนส่ง)
    if (paper && paper.staff_status === 'approved') {
      setBlocked(tt('examform.alreadySubmittedRound'));
      return;
    }
    // รอบไม่ได้เปิดรับแล้ว — แก้ได้เฉพาะใบที่ถูกตีกลับเท่านั้น
    if (!acceptingNow) {
      if (!paper || paper.staff_status !== 'rejected') {
        showRoundBlocked(activeRound);
        return;
      }
    }

    if (paper) {
      setExisting(paper);
      setKeptFiles(paper.certificates || []);
      // เติมคำตอบเดิมกลับเข้าฟอร์ม ไม่งั้นต้องติ๊กใหม่หมดทั้งที่แก้แค่วิชาเดียว
      // (วิชาที่ยกผลมาจากรอบก่อน carried_forward ไม่ใช่คำตอบของนักศึกษา ไม่ต้องเติม)
      const previousAnswers = {};
      const subjectResults = paper.subject_results || [];
      for (const subjectResult of subjectResults) {
        if (!subjectResult.carried_forward) {
          previousAnswers[subjectResult.subject_id] = subjectResult.is_passed;
        }
      }
      setResults(previousAnswers);
    }
  };

  // โหลดตอนเปิดหน้า: /rounds/active คืนรอบพร้อมรายวิชาของรอบนั้น (แต่ละวิชามี already_passed = เคยผ่านจากรอบก่อนแล้ว)
  useEffect(() => {
    apiFetch('/rounds/active')
      .then((activeRound) => prepareForm(activeRound))
      .catch((e) => {
        // ApiError (เช่น 403 ยังไม่ได้รับสิทธิ์) = เหตุผลที่กรอกไม่ได้ ไม่ใช่ระบบพัง — backend ส่งข้อความไทยมาแล้ว
        if (e instanceof ApiError) {
          setBlocked(e.message);
        } else {
          setLoadError(tt('examform.loadFailMsg'));
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // หลังส่งไม่สำเร็จกลางทาง — ดึงไฟล์ของใบนี้จาก backend ใหม่ ให้รายการบนจอตรงกับของจริง
  // (ไฟล์ที่อัปโหลดสำเร็จแล้วจะย้ายมาอยู่ใน "ไฟล์เดิม" · ไฟล์ที่ยังรอลบยังซ่อนไว้เหมือนเดิม)
  const reloadPaperFiles = async (stillToRemove) => {
    try {
      const myPapers = await apiFetch('/exam-results/me');
      const paper = findPaperOfRound(myPapers, round.round_id);
      if (!paper) {
        return;
      }
      setExisting(paper);
      const kept = [];
      const certificates = paper.certificates || [];
      for (const certificate of certificates) {
        let waitingToRemove = false;
        for (const removed of stillToRemove) {
          if (removed.certificate_id === certificate.certificate_id) {
            waitingToRemove = true;
          }
        }
        if (!waitingToRemove) {
          kept.push(certificate);
        }
      }
      setKeptFiles(kept);
    } catch {
      // ดึงใหม่ไม่ได้ก็ไม่เป็นไร ข้อความ error ของการส่งยังแสดงอยู่ ผู้ใช้รีเฟรชหน้าเองได้
    }
  };

  // ─── แยกวิชาของรอบ + นับความคืบหน้า ───────────────────────
  // วิชาที่เคยผ่านแล้ว (already_passed) ไม่ต้องกรอกซ้ำ — backend เติมเป็น "ผ่าน" ให้ตอนบันทึกเอง
  const toAnswer = [];
  const passedBefore = [];
  for (const subject of subjects) {
    if (subject.already_passed) {
      passedBefore.push(subject);
    } else {
      toAnswer.push(subject);
    }
  }

  let filledCount = 0;
  let passCount = 0;
  let failCount = 0;
  for (const subject of toAnswer) {
    const answer = results[subject.subject_id];
    if (answer === true) {
      filledCount = filledCount + 1;
      passCount = passCount + 1;
    } else if (answer === false) {
      filledCount = filledCount + 1;
      failCount = failCount + 1;
    }
  }
  const allAnswered = filledCount === toAnswer.length;
  const allPass = toAnswer.length > 0 && passCount === toAnswer.length;

  const totalFiles = keptFiles.length + newFiles.length;
  const hasAttachment = totalFiles > 0;
  const filesFull = totalFiles >= MAX_EVIDENCE_FILES;
  // รอบไม่ได้เปิดรับแล้ว แต่ยังอยู่หน้านี้ได้ = กำลังแก้ใบที่ถูกตีกลับหลังปิดรอบ
  const fixingAfterClose = round !== null && round.phase !== 'active';

  const setAnswer = (subjectId, passed) => {
    setResults((previous) => {
      const next = { ...previous };
      next[subjectId] = passed;
      return next;
    });
  };

  // ─── จัดการไฟล์แนบ ───────────────────────────────────
  // เพิ่มไฟล์ที่เพิ่งเลือก — ตรวจชนิด ขนาด และจำนวน ทีละไฟล์ ไฟล์ที่ไม่ผ่านบอกเหตุผลเป็นรายไฟล์
  const addFiles = (fileList) => {
    const accepted = [];
    const problems = [];
    let countAfterAdd = keptFiles.length + newFiles.length;
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const kind = fileKindOf(file.type, file.name);
      if (kind === '') {
        problems.push(tt('examform.fileWrongType', { name: file.name }));
      } else if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        problems.push(tt('examform.fileTooBig', { name: file.name, size: fileSizeText(file.size), max: MAX_FILE_SIZE_MB }));
      } else if (countAfterAdd >= MAX_EVIDENCE_FILES) {
        problems.push(tt('examform.tooManyFiles', { name: file.name, max: MAX_EVIDENCE_FILES }));
      } else {
        accepted.push(file);
        countAfterAdd = countAfterAdd + 1;
      }
    }
    const nextNewFiles = [];
    for (const file of newFiles) {
      nextNewFiles.push(file);
    }
    for (const file of accepted) {
      nextNewFiles.push(file);
    }
    setNewFiles(nextNewFiles);
    setFileErrors(problems);
  };

  // นำไฟล์ใหม่ (ยังไม่ได้อัปโหลด) ออก — แค่เอาออกจากรายการ ไม่ต้องบอก backend
  const removeNewFile = (indexToRemove) => {
    const remaining = [];
    for (let i = 0; i < newFiles.length; i++) {
      if (i !== indexToRemove) {
        remaining.push(newFiles[i]);
      }
    }
    setNewFiles(remaining);
    setFileErrors([]);
  };

  // นำไฟล์เดิมออก — ยังไม่ลบจริง ย้ายไปรอลบตอนกดส่ง (กดยกเลิกการนำออกได้จนกว่าจะส่ง)
  const removeKeptFile = (certificateToRemove) => {
    const remaining = [];
    for (const certificate of keptFiles) {
      if (certificate.certificate_id !== certificateToRemove.certificate_id) {
        remaining.push(certificate);
      }
    }
    setKeptFiles(remaining);
    setRemovedFiles([...removedFiles, certificateToRemove]);
    setFileErrors([]);
  };

  // ยกเลิกการนำออก — ไฟล์เดิมกลับมาทั้งหมด (ถ้ารวมกับไฟล์ใหม่แล้วเกินจำนวนที่แนบได้ ให้นำไฟล์ใหม่ออกก่อน)
  const undoRemove = () => {
    const totalAfterUndo = keptFiles.length + removedFiles.length + newFiles.length;
    if (totalAfterUndo > MAX_EVIDENCE_FILES) {
      setFileErrors([tt('examform.undoTooMany', { max: MAX_EVIDENCE_FILES })]);
      return;
    }
    setKeptFiles([...keptFiles, ...removedFiles]);
    setRemovedFiles([]);
    setFileErrors([]);
  };

  // ลบไฟล์เดิมที่กด "นำออก" ทีละไฟล์ — คืนค่า { ok, stillToRemove }
  const deleteRemovedFiles = async () => {
    const stillToRemove = [...removedFiles];
    while (stillToRemove.length > 0) {
      const certificate = stillToRemove[0];
      try {
        await apiFetch(`/certificates/${certificate.certificate_id}`, { method: 'DELETE' });
      } catch (e) {
        setRemovedFiles(stillToRemove);
        setSubmitError(tt('examform.deleteFailMsg', { name: certificate.file_name, msg: messageOf(e) }));
        return { ok: false, stillToRemove };
      }
      stillToRemove.shift(); // ลบสำเร็จแล้ว เอาออกจากคิว
    }
    setRemovedFiles([]);
    return { ok: true, stillToRemove };
  };

  // อัปโหลดไฟล์ใหม่ทีละไฟล์เข้าใบ resultId — คืนค่า true ถ้าครบทุกไฟล์
  // ล้มกลางทาง = เก็บเฉพาะไฟล์ที่ยังไม่ได้อัปโหลดไว้ในรายการ ให้กดส่งซ้ำได้โดยไม่อัปโหลดซ้ำ
  const uploadNewFiles = async (resultId) => {
    const waiting = [...newFiles];
    while (waiting.length > 0) {
      const file = waiting[0];
      const form = new FormData();
      form.append('file', file);
      form.append('certificate_type', 'exam_result');
      try {
        await apiFetch(`/exam-results/${resultId}/certificates`, { method: 'POST', body: form });
      } catch (e) {
        setNewFiles(waiting);
        setSubmitError(tt('examform.uploadFailMsg', { name: file.name, msg: messageOf(e) }));
        return false;
      }
      waiting.shift(); // อัปโหลดสำเร็จแล้ว เอาออกจากคิว
    }
    setNewFiles([]);
    return true;
  };

  // ─── กดส่ง ─────────────────────────────────────────
  const submit = async () => {
    setSubmitting(true);
    setSubmitError('');
    setFileErrors([]);

    // ผลรายวิชาที่จะส่ง (เฉพาะวิชาที่ต้องกรอก)
    const subjectResults = [];
    for (const subject of toAnswer) {
      subjectResults.push({ subject_id: subject.subject_id, is_passed: results[subject.subject_id] });
    }

    try {
      if (existing) {
        // ใบเดิม: จัดการไฟล์ให้เสร็จก่อน แล้วค่อยส่งผลสอบ
        const deleted = await deleteRemovedFiles();
        if (!deleted.ok) {
          await reloadPaperFiles(deleted.stillToRemove);
          return;
        }
        const uploaded = await uploadNewFiles(existing.result_id);
        if (!uploaded) {
          await reloadPaperFiles([]);
          return;
        }
        await apiFetch('/exam-results', { method: 'POST', body: { subject_results: subjectResults } });
      } else {
        // ใบใหม่: ส่งผลสอบก่อนเพื่อให้ได้เลขใบ แล้วค่อยอัปโหลดไฟล์เข้าใบนั้น
        const created = await apiFetch('/exam-results', { method: 'POST', body: { subject_results: subjectResults } });
        const uploaded = await uploadNewFiles(created.result_id);
        if (!uploaded) {
          // ใบถูกสร้างแล้ว — ดึงใบนั้นมา กดส่งครั้งถัดไปจะเป็นการแก้ใบเดิม (ไม่สร้างใบซ้ำ)
          await reloadPaperFiles([]);
          return;
        }
      }
      toast(tt('examform.submitSuccessToast'), 'success');
      go('status');
    } catch (e) {
      setSubmitError(messageOf(e));
    } finally {
      setSubmitting(false);
    }
  };

  // ─── หน้าจอ ────────────────────────────────────────
  if (loading) {
    return <Loading label={tt('common.loading')} />;
  }
  if (loadError) {
    return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>{loadError}</div>;
  }
  if (blocked) {
    return (
      <div className="fade-up">
        <PageHead title={tt('nav.student.form')} />
        <div className="card card-pad" style={{ maxWidth: 860, margin: '0 auto', minHeight: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 24px' }}>
          <Icon name="info" size={34} style={{ color: 'var(--navy-600)', marginBottom: 12 }} />
          <p style={{ color: 'var(--ink-700)', fontSize: 16.5, margin: 0 }}>{blocked}</p>
          {blockedSub && <p style={{ color: 'var(--ink-500)', fontSize: 15, margin: '8px 0 0' }}>{blockedSub}</p>}
        </div>
      </div>
    );
  }

  // ข้อความบนปุ่มส่ง
  let submitLabel = tt('review.submitBtn');
  if (submitting) {
    submitLabel = tt('common.submitting');
  } else if (existing && existing.staff_status === 'rejected') {
    submitLabel = tt('examform.resubmitBtn');
  } else if (existing) {
    submitLabel = tt('examform.editBtn');
  }

  return (
    <div className="fade-up">
      <PageHead title={existing ? tt('examform.editTitle') : tt('nav.student.form')}
        sub={round ? tt('news.roundSlash', { attempt: round.attempt_number, year: round.academic_year }) : ''} />

      {existing && existing.staff_status === 'rejected' && (
        <div className="card card-pad" style={{ marginBottom: 18, borderLeft: '4px solid var(--status-reject-dot)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="xCircle" size={19} style={{ color: 'var(--status-reject-dot)', flex: 'none', marginTop: 1 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16.5, marginBottom: 3 }}>{tt('examform.rejectedTitle')}</div>
              <p style={{ margin: 0, fontSize: 15.5, color: 'var(--ink-700)' }}>
                {existing.remark || tt('examform.rejectedDefaultReason')}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 14.5, color: 'var(--ink-500)' }}>
                {tt('examform.rejectedResubmitNote')}
              </p>
              {/* รอบปิดแล้วแต่ยังแก้ได้ — บอกให้รีบส่ง จะได้ไม่เข้าใจว่าแก้ได้ตลอดไป */}
              {fixingAfterClose && (
                <p style={{ margin: '6px 0 0', fontSize: 14.5, color: 'var(--status-wait-fg)', fontWeight: 600 }}>
                  {tt('examform.fixAfterCloseNote')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {existing && existing.staff_status === 'pending' && (
        <div className="card card-pad" style={{ marginBottom: 18, borderLeft: '4px solid var(--status-wait-dot)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="clock" size={19} style={{ color: 'var(--status-wait-dot)', flex: 'none', marginTop: 1 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16.5, marginBottom: 3 }}>{tt('examform.editableTitle')}</div>
              <p style={{ margin: 0, fontSize: 15.5, color: 'var(--ink-700)' }}>{tt('examform.editableNote')}</p>
            </div>
          </div>
        </div>
      )}

      <div className="row wrap-m" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* ── ผลสอบรายวิชา ── */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ink-100)' }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{tt('examform.subjectsTitle')}</h3>
              <p style={{ margin: '3px 0 0', color: 'var(--ink-500)', fontSize: 15 }}>
                {tt('examform.fillCountNote', { n: toAnswer.length })}
                {passedBefore.length > 0 && tt('examform.passedBeforeNote', { n: passedBefore.length })}
              </p>
            </div>
            {subjects.map((subject, index) => {
              const isLast = index === subjects.length - 1;
              const answer = results[subject.subject_id];
              return (
                <div key={subject.subject_id} className="exam-subject-row" style={{
                  borderBottom: isLast ? 'none' : '1px solid var(--ink-100)',
                  background: subject.already_passed ? 'var(--ink-50, #fafafa)' : 'transparent' }}>
                  <span className="mono" style={{ fontSize: 14, color: 'var(--ink-400)', width: 60, flex: 'none' }}>{subject.subject_code}</span>
                  <span style={{ flex: '1 1 150px', minWidth: 0, fontSize: 16.5, fontWeight: 500, color: subject.already_passed ? 'var(--ink-500)' : 'var(--ink-800)' }}>
                    {subjectName(lang, subject.subject_code, subject.subject_name)}
                  </span>
                  {subject.already_passed ? (
                    <span className="badge ok" style={{ flex: 'none', marginLeft: 'auto' }}><span className="dot" />{tt('examform.alreadyPassedChip')}</span>
                  ) : (
                    <div className="seg">
                      <button type="button" className={answer === true ? 'on pass' : ''} onClick={() => setAnswer(subject.subject_id, true)}>{tt('pass.true')}</button>
                      <button type="button" className={answer === false ? 'on fail' : ''} onClick={() => setAnswer(subject.subject_id, false)}>{tt('pass.false')}</button>
                    </div>
                  )}
                </div>
              );
            })}
            {/* แถววิชา: จอแคบ (มือถือ) ปุ่มผ่าน/ไม่ผ่านขึ้นบรรทัดใหม่ได้ ไม่ดันให้ล้นจอ */}
            <style>{`.exam-subject-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;padding:14px 20px;}
              .seg{display:inline-flex;background:var(--ink-100);border-radius:999px;padding:3px;gap:3px;flex:none;margin-left:auto;}
              .seg button{border:none;background:transparent;padding:8px 18px;border-radius:999px;font-size:14px;font-weight:600;color:var(--ink-500);transition:.13s;font-family:inherit;cursor:pointer;}
              .seg button.on.pass{background:var(--pass);color:#fff;}
              .seg button.on.fail{background:var(--fail);color:#fff;}
              .evidence-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--ink-200);border-radius:11px;background:#fff;}
              .evidence-row.is-new{border-style:dashed;border-color:var(--navy-500,var(--ink-300));}`}</style>
          </div>

          {/* ── แนบเอกสารหลักฐาน ── */}
          <div className="card card-pad">
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>{tt('examform.attachTitle')}</h3>
            <p style={{ margin: '0 0 4px', color: 'var(--ink-600)', fontSize: 15 }}>{allPass ? tt('upload.allPassNote') : tt('upload.partialNote')}</p>
            <p style={{ margin: '0 0 14px', color: 'var(--ink-500)', fontSize: 14.5 }}>
              {tt('examform.attachHint', { max: MAX_EVIDENCE_FILES, size: MAX_FILE_SIZE_MB })}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {keptFiles.map((certificate) => {
                const kind = fileKindOf(certificate.file_type, certificate.file_name);
                const detail = certificateTypeLabel(tt, certificate.certificate_type) + ' · ' + fileKindLabel(tt, kind) + ' · ' + tt('examform.existingFileTag');
                return (
                  <EvidenceRow key={'kept-' + certificate.certificate_id} name={certificate.file_name} kind={kind}
                    detail={detail} removeLabel={tt('examform.removeFileBtn')} disabled={submitting}
                    onRemove={() => removeKeptFile(certificate)} />
                );
              })}
              {newFiles.map((file, index) => {
                const kind = fileKindOf(file.type, file.name);
                const detail = fileKindLabel(tt, kind) + ' · ' + fileSizeText(file.size) + ' · ' + tt('examform.newFileTag');
                return (
                  <EvidenceRow key={'new-' + index + '-' + file.name} name={file.name} kind={kind} isNew
                    detail={detail} removeLabel={tt('examform.removeFileBtn')} disabled={submitting}
                    onRemove={() => removeNewFile(index)} />
                );
              })}
              {totalFiles === 0 && (
                <div style={{ padding: '14px 12px', border: '1px dashed var(--ink-300)', borderRadius: 11, color: 'var(--ink-500)', fontSize: 15, textAlign: 'center' }}>
                  {tt('examform.noFilesYet')}
                </div>
              )}
            </div>

            {/* ไฟล์เดิมที่กดนำออก — ยังไม่ถูกลบจนกว่าจะกดส่ง จึงยกเลิกได้ */}
            {removedFiles.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10, padding: '9px 12px', borderRadius: 10, background: 'var(--status-wait-bg)', color: 'var(--status-wait-fg)', fontSize: 14.5 }}>
                <span style={{ flex: '1 1 200px' }}>{tt('examform.removedFilesNote', { n: removedFiles.length })}</span>
                <button type="button" className="btn btn-ghost btn-sm" disabled={submitting} onClick={undoRemove}>
                  <Icon name="refresh" size={14} /> {tt('examform.undoRemoveBtn')}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
              {/* multiple = เลือกได้หลายไฟล์พร้อมกัน · accept มีรูปภาพ → บนโทรศัพท์เลือก "ถ่ายรูป" ได้ */}
              <label className="btn btn-ghost" style={{ cursor: filesFull || submitting ? 'not-allowed' : 'pointer', opacity: filesFull || submitting ? 0.55 : 1 }}>
                <Icon name="upload" size={16} /> {tt('examform.addFilesBtn')}
                <input type="file" multiple accept={EVIDENCE_ACCEPT} disabled={filesFull || submitting} style={{ display: 'none' }}
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = ''; // ล้างค่า ให้เลือกไฟล์เดิมซ้ำได้หลังกดนำออก
                  }} />
              </label>
              <span style={{ fontSize: 14.5, color: 'var(--ink-500)' }}>
                {filesFull ? tt('examform.filesFullNote', { max: MAX_EVIDENCE_FILES }) : tt('examform.filesCount', { n: totalFiles, max: MAX_EVIDENCE_FILES })}
              </span>
            </div>

            {fileErrors.length > 0 && (
              <div role="alert" style={{ marginTop: 12, padding: '10px 13px', borderRadius: 10, background: 'var(--status-reject-bg)', color: 'var(--status-reject-fg)', fontSize: 14.5, lineHeight: 1.6 }}>
                {fileErrors.map((message, index) => <div key={index}>{message}</div>)}
              </div>
            )}
          </div>
        </div>

        {/* ── การ์ดความคืบหน้า + ปุ่มส่ง ── exam-aside = เต็มความกว้างบนจอมือถือ (styles.css) */}
        <div className="exam-aside" style={{ width: 260, flex: 'none' }}>
          <div className="card card-pad" style={{ position: 'sticky', top: 84 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-500)', marginBottom: 12 }}>{tt('progress.title')}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Donut size={130} thickness={16} segments={[
                { value: passCount, color: 'var(--pass)' },
                { value: failCount, color: 'var(--fail)' },
                { value: toAnswer.length - filledCount, color: 'var(--ink-200)' },
              ]} center={<><div className="tnum" style={{ fontSize: 28, fontWeight: 800 }}>{filledCount}/{toAnswer.length}</div><div style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>{tt('progress.filled')}</div></>} />
            </div>
            <div style={{ textAlign: 'center', fontSize: 14, color: 'var(--ink-500)' }}>
              {tt('examform.filesCount', { n: totalFiles, max: MAX_EVIDENCE_FILES })}
            </div>
            {submitError && <div role="alert" style={{ color: 'var(--reject,#dc2626)', fontSize: 15, marginTop: 10, lineHeight: 1.55 }}>{submitError}</div>}
            {/* ต้องแนบใบรายงานผลสอบอย่างน้อย 1 ไฟล์ทุกครั้ง (ทั้งผ่านครบและยังไม่ผ่าน) */}
            {allAnswered && !hasAttachment && !submitting && (
              <div style={{ color: 'var(--reject,#dc2626)', fontSize: 14, marginTop: 10 }}>{tt('examform.needAttachMsg')}</div>
            )}
            <button type="button" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 14 }}
              disabled={!allAnswered || !hasAttachment || totalFiles > MAX_EVIDENCE_FILES || submitting} onClick={submit}>
              {submitLabel} <Icon name="send" size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* แถวไฟล์ 1 ไฟล์: ไอคอนตามชนิด + ชื่อไฟล์ + รายละเอียด + ปุ่มนำออก
   ชื่อไฟล์ยาวตัดด้วย … (minWidth: 0) ไม่ดันปุ่มนำออกให้ล้นจอบนมือถือ */
function EvidenceRow({ name, kind, detail, isNew, removeLabel, disabled, onRemove }) {
  const isImage = kind === 'jpg' || kind === 'png';
  return (
    <div className={'evidence-row' + (isNew ? ' is-new' : '')}>
      <div style={{ width: 38, height: 38, borderRadius: 9, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isImage ? 'var(--blue-50)' : 'var(--status-reject-bg)', color: isImage ? 'var(--blue-600)' : 'var(--status-reject-fg)' }}>
        <Icon name={fileKindIcon(kind)} size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        <div style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>{detail}</div>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" style={{ flex: 'none' }} disabled={disabled} onClick={onRemove}>
        <Icon name="x" size={14} /> {removeLabel}
      </button>
    </div>
  );
}
