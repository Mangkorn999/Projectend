/* ============================================================
   เจ้าหน้าที่ / ผู้ช่วยตรวจสอบ — รายละเอียดผลสอบนักศึกษาคนเดียว (ข้อมูลจริงจาก backend)
   แทนที่ StudentDetail เดิมใน officer.jsx ที่ยังใช้ mock SUBJECTS/STUDENTS
   canEdit = เห็นปุ่มแก้ไขข้อมูล, canReview = เห็นปุ่มยืนยัน/ตีกลับ — แยกกัน 2 flag เพราะ reviewer
   ต้องการ canReview แต่ไม่เอา canEdit (officer ได้ทั้งคู่) ผู้บริหารไม่มีสิทธิ์เข้าหน้านี้เลยอยู่แล้ว (backend block ที่ route)

   โชว์ผลสอบ "ทุกรอบ" ที่นักศึกษาคนนี้เคยส่ง เป็น block คลิกสลับได้ฝั่งขวา (ไม่ใช่แค่รอบล่าสุดแบบเดิม)
   ข้อมูลมีอยู่แล้วจาก /exam-results?student_id=... (ไม่ต้องยิง API เพิ่ม) แค่ไม่ทิ้งรอบอื่นทิ้งเหมือนก่อน
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, Modal, StatusBadge, PassBadge, Empty, Select, Loading, actorLabel } from './components.jsx';
import { apiFetch, ApiError, fetchAuthedObjectUrl } from './api.js';
import { t, subjectName, roomName } from './i18n.js';
import { certificateTypeLabel, fileKindOf, fileKindLabel, fileKindIcon } from './evidenceFiles.js';

// action ที่เก็บใน review_logs -> key ข้อความบนจอ
const REVIEW_LOG_LABEL = { approved: 'officer.detail.logApproved', rejected: 'officer.detail.logRejected', revoked: 'officer.detail.logRevoked' };

const STAFF_STATUS_TO_BADGE = { pending: 'SUBMITTED', approved: 'CONFIRMED', rejected: 'REJECTED' };

export function StudentDetailReal({ student, go, backTo = 'students', toast, canEdit, canReview, lang }) {
  const tt = (key, vars) => t(lang, key, vars);
  const quickReasons = [tt('officer.detail.quickReason1'), tt('officer.detail.quickReason2'), tt('officer.detail.quickReason3')];
  const [subjects, setSubjects] = useState([]); // [{subject_id, subject_code, subject_name}]
  const [results, setResults] = useState([]); // exam_result ทุกรอบของนักศึกษาคนนี้ เรียงใหม่→เก่า
  const [selectedId, setSelectedId] = useState(null); // result_id ของรอบที่กำลังดูอยู่
  const [studentFull, setStudentFull] = useState(null); // GET /students/:id เต็มๆ ไว้ prefill ฟอร์มแก้ไข
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reject, setReject] = useState(false);
  const [remark, setRemark] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false); // ยืนยันลบนักศึกษา (เฉพาะ officer)
  // "ตอนนี้" จับครั้งเดียวตอนเปิดหน้า ไว้เทียบกับวันปิดรอบ — เรียก Date.now() ตรงๆ ระหว่าง render ไม่ได้ (ผลไม่นิ่ง)
  const [nowMs] = useState(() => Date.now());
  // ถอนการยืนยัน (ยืนยันผิด) — เฉพาะ officer (canEdit)
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeRemark, setRevokeRemark] = useState('');
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [preview, setPreview] = useState(null); // { url, filename, kind, detail } ไฟล์หลักฐานที่กำลังดูอยู่ใน modal
  const [previewRejecting, setPreviewRejecting] = useState(false); // true = กำลังพิมพ์เหตุผลตีกลับอยู่ใน modal ดูไฟล์ (ไฟล์ยังเปิดค้างให้ดูระหว่างพิมพ์)
  const [previewLoadingId, setPreviewLoadingId] = useState(null); // certificate_id ที่กำลังโหลดอยู่ (กันกดซ้ำ + โชว์สปินเนอร์)

  // เปิด PDF/รูปในแท็บใหม่ไม่ได้ให้ดูในหน้าเดิมเลย ต้องรอโหลดก่อนค่อยเปลี่ยนแท็บ — ขอดูในหน้าเดิมแทน
  const openPreview = (certificate, kind, detail) => {
    setPreviewLoadingId(certificate.certificate_id);
    fetchAuthedObjectUrl(`/certificates/${certificate.certificate_id}/file`)
      .then((url) => setPreview({ url, filename: certificate.file_name, kind, detail }))
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setPreviewLoadingId(null));
  };
  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setPreviewRejecting(false);
  };

  // keepResultId = ใบที่ผู้ตรวจเลือกดูอยู่ก่อนโหลดใหม่ (ส่งมาตอนโหลดซ้ำหลังกดยืนยัน/ตีกลับ/ถอน หรือเจอ 409)
  // ถ้าใบนั้นยังอยู่ ให้เปิดใบเดิมต่อ ไม่เด้งไปใบล่าสุด — ตอนเปิดหน้าครั้งแรก useEffect เรียกแบบไม่ส่งค่า (undefined)
  const load = (keepResultId) => {
    setLoading(true);
    Promise.all([
      apiFetch('/subjects'),
      apiFetch(`/exam-results?student_id=${student.sid}`),
      apiFetch(`/students/${student.sid}`),
      apiFetch('/rooms'),
    ]).then(([subjectList, resultList, fullStudent, roomList]) => {
      setSubjects(subjectList);
      setResults(resultList);
      setStudentFull(fullStudent);
      setRooms(roomList);
      // มาจากหน้าคิวตรวจสอบจะระบุใบที่กดมาด้วย (resultId) — ต้องเปิดใบนั้น ไม่ใช่ใบล่าสุด
      // ไม่งั้นกดจากแท็บ "รอตรวจสอบ" แล้วเปิดมาเจอใบรอบอื่นที่ถูกตีกลับไปแล้ว
      // มาจากหน้ารายชื่อนักศึกษาไม่มี resultId — ใช้ใบล่าสุด (เรียง submitted_at desc มาแล้ว)
      let picked = null;
      if (keepResultId) {
        picked = resultList.find(r => r.result_id === keepResultId) || null;
      }
      if (!picked && student.resultId) {
        picked = resultList.find(r => r.result_id === student.resultId) || null;
      }
      setSelectedId((picked || resultList[0])?.result_id ?? null);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, [student.sid, student.resultId]);

  const examResult = results.find(r => r.result_id === selectedId) || null;
  const status = examResult ? STAFF_STATUS_TO_BADGE[examResult.staff_status] : 'DRAFT';
  // ตัวหาร = จำนวนวิชา "ของรอบนั้น" ไม่ใช่วิชาทั้งระบบ — รอบที่สอบ 3 วิชาเคยขึ้น "ผ่าน 2/8 วิชา"
  // (subject_ids ว่าง = รอบเก่าก่อนมี field นี้ ถือว่าสอบทุกวิชา)
  const roundSubjectIds = examResult?.round?.subject_ids?.length
    ? examResult.round.subject_ids
    : subjects.map(s => s.subject_id);
  const passedCount = examResult
    ? examResult.subject_results.filter(r => r.is_passed && roundSubjectIds.includes(r.subject_id)).length
    : 0;
  const allPass = examResult && roundSubjectIds.length > 0 && passedCount === roundSubjectIds.length;

  const review = async (action, reasonText) => {
    // จำใบที่กำลังตรวจไว้ก่อน — หลังโหลดใหม่จะได้กลับมาเปิดใบเดิม (ไม่เด้งไปใบล่าสุด)
    const reviewingId = examResult.result_id;

    // แนบ "สิ่งที่ผู้ตรวจเห็นบนจอตอนนี้" ไปให้ backend เทียบ:
    // ถ้านักศึกษาแก้ผลสอบหรือเพิ่ม/ลบไฟล์ระหว่างที่เปิดหน้านี้ค้างไว้ ค่าจะไม่ตรง → backend ตอบ 409
    // กันยืนยันใบที่ไม่ใช่ใบที่ผู้ตรวจดูจริง (ใช้ใบที่เลือกอยู่ examResult ไม่ใช่ใบล่าสุด)
    const certificateIds = [];
    const shownCertificates = examResult.certificates || [];
    for (const c of shownCertificates) {
      certificateIds.push(c.certificate_id);
    }
    const body = {
      expected_submitted_at: examResult.submitted_at,
      expected_certificate_ids: certificateIds,
    };
    if (action === 'reject') {
      body.remark = reasonText;
    }

    setBusy(true);
    try {
      await apiFetch(`/exam-results/${reviewingId}/${action}`, {
        method: 'PATCH',
        body: body,
      });
      // บอก app.jsx ให้นับ badge "รอตรวจ" ใหม่ทันที — ไม่งั้นเลขค้างจนกว่าจะเปลี่ยนหน้า (เจ้าหน้าที่ยังอยู่หน้านี้หลังกดตรวจ)
      window.dispatchEvent(new Event('review-changed'));
      toast(action === 'approve' ? tt('officer.detail.confirmToast') : tt('officer.detail.rejectToast'), action === 'approve' ? 'success' : 'info');
      setReject(false);
      load(reviewingId); // ดึงสถานะล่าสุดจาก backend ใหม่ ไม่เชื่อ state เดิมที่เดาเอง (อยู่ใบเดิมต่อ)
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // 409 = ข้อมูลบนจอเก่าแล้ว (นักศึกษาแก้ผลสอบ/เอกสารระหว่างตรวจ) — โชว์ข้อความจาก backend
        // แล้วปิดหน้าต่างที่เปิดค้าง + โหลดใบเดิมใหม่ให้เลย ผู้ตรวจจะได้เห็นของล่าสุดก่อนตัดสินอีกครั้ง
        // เหตุผลตีกลับที่พิมพ์ไว้ (remark) ไม่ล้าง — ใช้ซ้ำได้ถ้ายังจะตีกลับ
        toast(e.message, 'error');
        closePreview();
        setReject(false);
        window.dispatchEvent(new Event('review-changed')); // เผื่อสถานะใบเปลี่ยนไปแล้ว ให้ badge "รอตรวจ" นับใหม่
        load(reviewingId);
        return false;
      }
      toast(e instanceof ApiError ? e.message : tt('detailReal.actionFailMsg'), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  // ยืนยัน/ตีกลับจากใน modal ดูไฟล์ — ใช้ review() ตัวเดียวกับปุ่มในหน้า (กฎเดียวกัน API เดียวกัน)
  // สำเร็จแล้วปิด modal ให้กลับมาที่หน้ารายละเอียดซึ่งโหลดสถานะใหม่แล้ว
  // footer ของ modal ดูไฟล์สูงขึ้นเมื่อมีข้อความเตือนหลายไฟล์ / ช่องเหตุผลตีกลับ — หักความสูงส่วนที่เพิ่มออกจากกรอบไฟล์ (ดู .preview-split ใน styles.css)
  const previewFooterExtra = (canReview && status === 'SUBMITTED')
    ? ((examResult?.certificates?.length || 0) > 1 ? 58 : 0) + (previewRejecting ? 108 : 0)
    : 0;

  const reviewFromPreview = async (action) => {
    const ok = await review(action, remark);
    if (ok) { closePreview(); setRemark(''); }
  };

  const revoke = async () => {
    setBusy(true);
    try {
      await apiFetch(`/exam-results/${examResult.result_id}/revoke-approval`, {
        method: 'PATCH',
        body: { remark: revokeRemark },
      });
      window.dispatchEvent(new Event('review-changed')); // badge "รอตรวจ" ต้องนับใหม่ — ใบกลับมารอตรวจแล้ว
      toast(tt('officer.detail.revokeToast'), 'info');
      setRevokeOpen(false);
      setRevokeRemark('');
      load(examResult.result_id); // อยู่ใบเดิมที่เพิ่งถอนการยืนยัน ไม่เด้งไปใบล่าสุด
    } catch (e) {
      toast(e instanceof ApiError ? e.message : tt('detailReal.actionFailMsg'), 'error');
    } finally {
      setBusy(false);
    }
  };

  // สถานะรอบของใบที่เปิดดู: 'closed' = ปิดรับแล้ว · 'soon' = เหลือไม่ถึง 3 วัน · null = ยังเปิดรับอีกนาน
  // ตีกลับ: นักศึกษาแก้ใบที่ถูกตีกลับได้แม้รอบปิดแล้ว → แค่บอกให้รู้ (ไม่ต้องเลื่อนวันปิดรอบ)
  // ถอนการยืนยัน: ใบกลับเป็น "รอตรวจสอบ" ซึ่งนักศึกษาแก้เองได้เฉพาะตอนรอบเปิด → ยังต้องเตือน
  const roundWarn = (() => {
    const r = examResult?.round;
    if (!r) return null;
    const msLeft = new Date(r.close_date).getTime() - nowMs;
    if (r.status !== 'open' || msLeft < 0) return 'closed';
    return msLeft < 3 * 24 * 60 * 60 * 1000 ? 'soon' : null;
  })();
  const roundWarnBox = roundWarn && (
    <div style={{ marginTop: 14, padding: '11px 13px', background: 'var(--status-wait-bg)', color: 'var(--status-wait-fg)', borderRadius: 10, fontSize: 15, lineHeight: 1.6, display: 'flex', gap: 8 }}>
      <Icon name="alert" size={17} style={{ flex: 'none', marginTop: 3 }} /> <span>{tt(roundWarn === 'closed' ? 'officer.detail.roundClosedWarn' : 'officer.detail.roundSoonWarn')}</span>
    </div>
  );

  // ลบนักศึกษาออกจากระบบ — ลบได้ทุกคน รวมคนที่มีผลสอบแล้ว (ลบผลสอบ/เอกสารทั้งหมดของเขาด้วย สถิติของรุ่นเปลี่ยนย้อนหลัง)
  const removeStudent = async () => {
    setBusy(true);
    try {
      // มีผลสอบแล้ว = ผู้ใช้เห็นคำเตือนแรงในโมดัลแล้ว ส่งค่ายืนยันไปด้วย ไม่งั้น backend ตอบ 409
      await apiFetch(`/students/${student.sid}${hasResults ? '?delete_results=true' : ''}`, { method: 'DELETE' });
      toast(tt('officer.students.deletedToast', { name: `${student.firstName} ${student.lastName}` }));
      setDeleteOpen(false);
      go(backTo); // คนนี้ไม่อยู่แล้ว อยู่หน้าเดิมต่อไม่ได้ — กลับไปหน้ารายชื่อ
    } catch (e) {
      toast(e instanceof ApiError ? e.message : tt('officer.students.deleteFailMsg'), 'error');
      setBusy(false);
    }
  };

  const openEdit = () => {
    if (!studentFull) return;
    setEditForm({
      first_name: studentFull.user.first_name || '',
      last_name: studentFull.user.last_name || '',
      first_name_en: studentFull.first_name_en || '',
      last_name_en: studentFull.last_name_en || '',
      email: studentFull.user.email || '',
      phone: studentFull.user.phone || '',
      room_id: studentFull.room?.room_id || '',
      academic_year: studentFull.academic_year || '',
    });
    setEditError('');
    setEditOpen(true);
  };

  const submitEdit = async () => {
    setEditError('');
    setEditSaving(true);
    try {
      const updated = await apiFetch(`/students/${student.sid}`, {
        method: 'PATCH',
        body: { ...editForm, room_id: Number(editForm.room_id), academic_year: Number(editForm.academic_year) },
      });
      // PATCH ตอบกลับมาเป็นแถว student ดิบ ไม่มี academic_year_derived / exam_result_count
      // (2 ตัวนั้น GET /students/:id คำนวณเพิ่มให้ตอนส่งออก) — ถ้า setStudentFull(updated) ตรง ๆ
      // ค่าจะหายไป แล้ว hint ใต้ช่องปีจะขึ้น '—' ทันทีหลังกดบันทึก เลยต้องรวมของเดิมไว้ด้วย
      setStudentFull(prev => ({ ...prev, ...updated }));
      toast(tt('officer.detail.editSuccessToast'), 'success');
      setEditOpen(false);
    } catch (e) {
      setEditError(e instanceof ApiError ? e.message : tt('officer.detail.editFailMsg'));
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) return <Loading label={tt('common.loading')} />;
  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>{tt('statuspage.loadFailPrefix', { msg: error })}</div>;

  const displayName = studentFull ? `${studentFull.user.first_name} ${studentFull.user.last_name}` : `${student.firstName} ${student.lastName}`;
  const displayRoom = studentFull?.room?.room_name || student.room;
  const displayYear = studentFull?.academic_year || student.year;
  // ส่งผลสอบไปแล้ว = ย้ายรุ่นไม่ได้ (backend บล็อกอยู่แล้ว ตรงนี้แค่ทำให้ช่องกดไม่ได้ + บอกเหตุผล
  // ดีกว่าปล่อยให้พิมพ์จนเสร็จแล้วค่อยเด้ง error ตอนกดบันทึก)
  const yearLocked = (studentFull?.exam_result_count ?? 0) > 0;
  // มีผลสอบในระบบแล้วไหม — ดูทั้งจำนวนจาก backend และรายการที่โหลดมา (อันไหนรู้ก่อนใช้อันนั้น)
  const hasResults = yearLocked || results.length > 0;

  return (
    <div className="fade-up">
      <PageHead title={displayName}
        // ลิงก์ breadcrumb กลับไปหน้าที่เข้ามา (backTo) — ผู้ช่วยตรวจสอบไม่มีหน้า students ต้องกลับคิวตรวจสอบ
        // ป้ายต้องตรงกับปลายทาง: มาจากคิวตรวจ = ชื่อเมนูคิวตรวจ (คีย์เดียวกับเมนูซ้าย) · นอกนั้น = "ข้อมูลนักศึกษา" เหมือนเดิม
        crumb={<><a onClick={() => go(backTo)} style={{ cursor: 'pointer' }}>{backTo === 'review' ? tt('nav.officer.review') : tt('officer.detail.crumbList')}</a> <Icon name="chevR" size={13} /> {tt('officer.detail.crumbDetail')}</>}
        sub={<span className="mono">{student.sid} · {tt('officer.detail.subInfo', { room: roomName(lang, displayRoom), year: displayYear })}
          {/* ชื่อ-สกุลภาษาอังกฤษ (students.first_name_en/last_name_en) ที่นักศึกษากรอกตอนตั้งโปรไฟล์ */}
          {studentFull?.first_name_en && <> · {studentFull.first_name_en} {studentFull.last_name_en}</>}
          {/* เบอร์โทรมาจาก users.phone (GET /students/:id) — ไม่มีเบอร์ก็ไม่ต้องโชว์ช่องเปล่า */}
          {studentFull?.user?.phone && <> · {tt('officer.detail.phoneLabel')} {studentFull.user.phone}</>}
          {/* ใครเปิด/ปิดสิทธิ์กรอกผลสอบล่าสุด เมื่อไหร่ (students.eligible_set_by / eligible_set_at) */}
          {studentFull?.eligible_setter && <> · {tt('officer.detail.eligibleSetBy', { name: actorLabel(studentFull.eligible_setter, tt), date: new Date(studentFull.eligible_set_at).toLocaleDateString('th-TH') })}</>}</span>}
        actions={<div style={{ display: 'flex', gap: 8 }}>
          {canEdit && <button className="btn btn-ghost" onClick={openEdit}><Icon name="edit" size={16} /> {tt('officer.detail.editBtn')}</button>}
          {canEdit && <button className="btn btn-ghost" style={{ color: 'var(--fail)' }}
            title={tt('officer.students.deleteHint')} onClick={() => setDeleteOpen(true)}><Icon name="trash" size={16} /> {tt('officer.detail.deleteStudentBtn')}</button>}
          <button className="btn btn-ghost" onClick={() => go(backTo)}><Icon name="chevL" size={16} /> {tt('officer.detail.backBtn')}</button>
        </div>} />

      <div className="row wrap-m" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ink-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{tt('officer.detail.resultsTitle')}</h3>
              <span className="tnum chip" style={{ background: allPass ? 'var(--status-ok-bg)' : 'var(--ink-100)', color: allPass ? 'var(--status-ok-fg)' : 'var(--ink-900)', fontWeight: 700 }}>{tt('officer.detail.passChip', { passed: passedCount, total: roundSubjectIds.length })}</span>
            </div>
            <table className="tbl">
              <thead><tr><th style={{ width: 80 }}>{tt('officer.detail.colCode')}</th><th>{tt('officer.detail.colSubject')}</th><th style={{ textAlign: 'right' }}>{tt('officer.detail.colResult')}</th></tr></thead>
              <tbody>{subjects.map(sub => {
                const r = examResult?.subject_results.find(x => x.subject_id === sub.subject_id);
                return <tr key={sub.subject_id}><td className="mono" style={{ color: 'var(--ink-400)' }}>{sub.subject_code}</td>
                  <td style={{ fontWeight: 500 }}>{subjectName(lang, sub.subject_code, sub.subject_name)}</td>
                  <td style={{ textAlign: 'right' }}><PassBadge passed={r ? r.is_passed : undefined} lang={lang} /></td></tr>;
              })}</tbody>
            </table>
          </div>

          <div className="card card-pad">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{tt('officer.detail.evidenceTitle')}</h3>
              {examResult?.certificates?.length > 0 && (
                <span className="chip tnum">{tt('officer.review.filesCount', { n: examResult.certificates.length })}</span>
              )}
            </div>
            {/* นักศึกษาแนบได้หลายไฟล์ (PDF หรือรูปถ่าย) — ชนิดเอกสาร/ชนิดไฟล์แปลงเป็นคำไทยก่อนโชว์เสมอ (ห้ามโชว์ exam_result ฯลฯ) */}
            {examResult?.certificates?.length ? examResult.certificates.map((f) => {
              const kind = fileKindOf(f.file_type, f.file_name);
              const isImage = kind === 'jpg' || kind === 'png';
              return (
                <div key={f.certificate_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid var(--ink-200)', borderRadius: 11, marginBottom: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 9, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isImage ? 'var(--blue-50)' : 'var(--status-reject-bg)', color: isImage ? 'var(--blue-600)' : 'var(--status-reject-fg)' }}>
                    <Icon name={fileKindIcon(kind)} size={21} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file_name}</div>
                    <div style={{ fontSize: 14, color: 'var(--ink-500)' }}>{certificateTypeLabel(tt, f.certificate_type)} · {fileKindLabel(tt, kind)}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 'none' }} disabled={previewLoadingId === f.certificate_id}
                    onClick={() => openPreview(f, kind, certificateTypeLabel(tt, f.certificate_type) + ' · ' + fileKindLabel(tt, kind))}>
                    {previewLoadingId === f.certificate_id
                      ? <span className="spinner-sm" />
                      : <Icon name="eye" size={15} />} {tt('officer.detail.viewBtn')}</button>
                </div>
              );
            }) : <Empty icon="doc" title={tt('officer.detail.noEvidence')} />}
          </div>
        </div>

        <div style={{ width: 312, flex: 'none', display: 'flex', flexDirection: 'column', gap: 16 }} className="exam-aside">
          <div className="card card-pad">
            <div style={{ fontSize: 15, color: 'var(--ink-500)', fontWeight: 600, marginBottom: 8 }}>{tt('officer.detail.reviewStatusTitle')}</div>
            <StatusBadge status={status} size="lg" lang={lang} />
            {examResult?.remark && status === 'REJECTED' && <div style={{ marginTop: 12, padding: '11px 13px', background: 'var(--status-reject-bg)', borderRadius: 10, fontSize: 15, color: 'var(--status-reject-fg)' }}>
              <b>{tt('officer.detail.rejectReasonLabel')}</b><br />{examResult.remark}</div>}
            {canReview && status === 'SUBMITTED' && <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
              <button className="btn btn-success btn-block btn-lg" disabled={busy} onClick={() => review('approve')}>
                <Icon name="checkCircle" size={18} /> {tt('officer.detail.confirmBtn')}</button>
              <button className="btn btn-danger btn-block" disabled={busy} onClick={() => setReject(true)}>
                <Icon name="xCircle" size={17} /> {tt('officer.detail.rejectBtn')}</button>
            </div>}
            {canEdit && status === 'CONFIRMED' && <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} disabled={busy} onClick={() => setRevokeOpen(true)}>
              <Icon name="xCircle" size={16} /> {tt('officer.detail.revokeBtn')}</button>}
            {status === 'DRAFT' && <div style={{ marginTop: 12, fontSize: 15, color: 'var(--ink-500)' }}>{tt('detailReal.notFilledYet')}</div>}
          </div>

          {/* บล็อกทุกรอบที่เคยส่งผล — คลิกสลับรอบที่ดูฝั่งซ้ายได้เลย ไม่ต้องออกไปหน้าอื่น */}
          <div className="card card-pad">
            <div style={{ fontSize: 15, color: 'var(--ink-500)', fontWeight: 600, marginBottom: 12 }}>{tt('officer.detail.roundsTitle')}</div>
            {results.length === 0 ? (
              <div style={{ fontSize: 15, color: 'var(--ink-500)' }}>{tt('officer.detail.noRounds')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {results.map(r => {
                  const rPassed = r.subject_results.filter(x => x.is_passed).length;
                  const rTotal = r.subject_results.length;
                  const isSelected = r.result_id === selectedId;
                  return (
                    <button key={r.result_id} onClick={() => setSelectedId(r.result_id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                        textAlign: 'left', width: '100%', cursor: 'pointer', fontFamily: 'inherit',
                        padding: '10px 12px', borderRadius: 10,
                        border: isSelected ? '1.5px solid var(--navy-700)' : '1.5px solid var(--ink-150,var(--ink-100))',
                        background: isSelected ? 'var(--blue-50)' : 'transparent',
                      }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink-900)' }}>
                          {tt('officer.detail.roundLabel', { attempt: r.round.attempt_number, year: r.round.academic_year })}
                        </div>
                        <div className="tnum" style={{ fontSize: 13.5, color: 'var(--ink-500)', marginTop: 2 }}>
                          {tt('officer.detail.roundPassChip', { passed: rPassed, total: rTotal })}
                        </div>
                      </div>
                      <StatusBadge status={STAFF_STATUS_TO_BADGE[r.staff_status]} lang={lang} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card card-pad">
            <div style={{ fontSize: 15, color: 'var(--ink-500)', fontWeight: 600, marginBottom: 12 }}>{tt('officer.detail.historyTitle')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, fontSize: 15 }}>
              {[[tt('officer.detail.step1'), examResult ? new Date(examResult.submitted_at).toLocaleString('th-TH') : '—', 'user'],
                // มีประวัติการตรวจ (review_logs) → โชว์ทุกครั้งที่ตรวจ พร้อมชื่อผู้ตรวจ (ปิดบัญชีแล้วก็ยังเห็นชื่อ)
                // ใบเก่าที่ตรวจก่อนมี review_logs จะไม่มีแถวพวกนี้ → ใช้แถว "ตรวจสอบ" แบบเดิมแทน
                ...(examResult?.review_logs?.length
                  ? examResult.review_logs.map(log => [
                      tt(REVIEW_LOG_LABEL[log.action] || 'officer.review.reviewBtn'),
                      new Date(log.created_at).toLocaleString('th-TH') + ' · ' + tt('officer.detail.logBy', { name: actorLabel(log.reviewer, tt) }) + (log.remark ? ' · “' + log.remark + '”' : ''),
                      'shield'])
                  : [[tt('officer.review.reviewBtn'), status === 'SUBMITTED' ? tt('officer.detail.waitAction') : (examResult?.confirmed_at ? new Date(examResult.confirmed_at).toLocaleString('th-TH') : '—'), 'shield']])
              ].map(([l, d, ic], i) => (
                <div key={i} style={{ display: 'flex', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--ink-100)', color: 'var(--ink-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={ic} size={15} /></div>
                  <div><div style={{ fontWeight: 600, color: 'var(--ink-800)' }}>{l}</div><div style={{ fontSize: 14, color: 'var(--ink-500)' }}>{d}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal open={reject} onClose={() => setReject(false)} title={tt('officer.detail.rejectModalTitle')} tone="var(--status-reject-fg)"
        footer={<><button className="btn btn-ghost" onClick={() => setReject(false)}>{tt('officer.detail.cancelBtn')}</button>
          <button className="btn" style={{ background: 'var(--fail)', color: '#fff' }} disabled={!remark.trim() || busy}
            onClick={() => review('reject', remark)}>
            <Icon name="send" size={16} /> {tt('officer.detail.confirmRejectBtn')}</button></>}>
        <p style={{ margin: '0 0 14px', color: 'var(--ink-600)', fontSize: 16 }}>{tt('officer.detail.rejectHint')}</p>
        {/* ตีกลับหลังปิดรอบได้ — นักศึกษายังแก้ใบที่ถูกตีกลับได้ แค่บอกให้รู้ ไม่ใช่คำเตือน */}
        {roundWarn === 'closed' && (
          <div style={{ marginBottom: 14, marginTop: -4, padding: '11px 13px', background: 'var(--blue-50)', color: 'var(--navy-700)', borderRadius: 10, fontSize: 15, lineHeight: 1.6, display: 'flex', gap: 8 }}>
            <Icon name="info" size={17} style={{ flex: 'none', marginTop: 3 }} /> <span>{tt('officer.detail.rejectAfterCloseNote')}</span>
          </div>
        )}
        <div className="field"><label>{tt('officer.detail.rejectFieldLabel')}</label>
          <textarea className="input" rows={3} placeholder={tt('officer.detail.rejectPlaceholder')} value={remark} onChange={e => setRemark(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {quickReasons.map(r => (
            <button key={r} className="chip" style={{ cursor: 'pointer', border: '1px solid var(--ink-200)' }} onClick={() => setRemark(r)}>{r}</button>
          ))}
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => !busy && setDeleteOpen(false)} width={430} title={tt('officer.students.deleteTitle')} tone="danger"
        footer={<><button className="btn btn-ghost" disabled={busy} onClick={() => setDeleteOpen(false)}>{tt('officer.detail.cancelBtn')}</button>
          <button className="btn btn-danger" disabled={busy} onClick={removeStudent}>
            {busy ? tt('officer.students.deleting') : tt('officer.detail.deleteStudentBtn')}</button></>}>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: 'var(--ink-700)' }}>
          {tt('officer.students.deleteBody', { name: `${student.firstName} ${student.lastName}`, sid: student.sid })}
        </p>
        {hasResults && (
          <div role="alert" style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: 'var(--status-reject-bg)', color: 'var(--status-reject-fg)', fontSize: 15, lineHeight: 1.65, fontWeight: 600 }}>
            {tt('officer.students.deleteWithResultsWarn')}
          </div>
        )}
      </Modal>

      <Modal open={revokeOpen} onClose={() => setRevokeOpen(false)} title={tt('officer.detail.revokeModalTitle')} tone="var(--status-reject-fg)"
        footer={<><button className="btn btn-ghost" onClick={() => setRevokeOpen(false)}>{tt('officer.detail.cancelBtn')}</button>
          <button className="btn" style={{ background: 'var(--fail)', color: '#fff' }} disabled={!revokeRemark.trim() || busy} onClick={revoke}>
            <Icon name="send" size={16} /> {tt('officer.detail.revokeConfirmBtn')}</button></>}>
        <p style={{ margin: '0 0 14px', color: 'var(--ink-600)', fontSize: 16, lineHeight: 1.6 }}>{tt('officer.detail.revokeHint')}</p>
        <div className="field"><label>{tt('officer.detail.revokeFieldLabel')}</label>
          <textarea className="input" rows={3} maxLength={500} placeholder={tt('officer.detail.revokePlaceholder')} value={revokeRemark} onChange={e => setRevokeRemark(e.target.value)} />
        </div>
        {roundWarnBox && <div style={{ marginTop: -4 }}>{roundWarnBox}</div>}
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={tt('officer.detail.editModalTitle')} width={480}
        footer={<><button className="btn btn-ghost" onClick={() => setEditOpen(false)}>{tt('officer.detail.cancelBtn')}</button>
          <button className="btn btn-primary" disabled={editSaving} onClick={submitEdit}>
            {editSaving ? tt('officer.detail.savingBtn') : tt('officer.detail.saveBtn')}</button></>}>
        {editForm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="field" style={{ flex: 1 }}><label>{tt('officer.detail.fieldFirstName')}</label>
                <input className="input" value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} /></div>
              <div className="field" style={{ flex: 1 }}><label>{tt('officer.detail.fieldLastName')}</label>
                <input className="input" value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="field" style={{ flex: 1 }}><label>{tt('officer.detail.fieldFirstNameEn')}</label>
                <input className="input" value={editForm.first_name_en} onChange={e => setEditForm(f => ({ ...f, first_name_en: e.target.value }))} /></div>
              <div className="field" style={{ flex: 1 }}><label>{tt('officer.detail.fieldLastNameEn')}</label>
                <input className="input" value={editForm.last_name_en} onChange={e => setEditForm(f => ({ ...f, last_name_en: e.target.value }))} /></div>
            </div>
            <div className="field"><label>{tt('officer.detail.fieldEmail')}</label>
              <input className="input" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="field"><label>{tt('officer.detail.fieldPhone')}</label>
              <input className="input tnum" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="field" style={{ flex: 1 }}><label>{tt('officer.detail.fieldRoom')}</label>
                <Select value={String(editForm.room_id)} onChange={v => setEditForm(f => ({ ...f, room_id: v }))} lang={lang}
                  options={rooms.map(r => ({ value: String(r.room_id), label: r.room_name }))} /></div>
              {/* ปีการศึกษาที่จบ = รุ่นของนักศึกษา และเป็นตัวตัดสินว่าจะเห็นฟอร์มของรอบไหน
                  (backend เปิดรอบให้เฉพาะคนที่ academic_year ตรงกับรอบนั้น)
                  เคสซ้ำชั้น/ลาพัก ค่าที่คำนวณจากรหัสจะผิด เจ้าหน้าที่ต้องแก้ตรงนี้ให้ตรงปีที่จบจริง
                  แต่แก้ได้เฉพาะคนที่ยังไม่เคยส่งผลสอบ — ย้ายรุ่นทีหลังทำให้สถิติรุ่นเดิมเพี้ยน (ดู update() ฝั่ง backend) */}
              <div className="field" style={{ flex: 1 }}><label>{tt('officer.detail.fieldYear')}</label>
                <input className="input tnum" type="number" value={editForm.academic_year}
                  disabled={yearLocked}
                  // แก้ปีแล้วล้าง error เดิมทิ้ง — ไม่งั้นข้อความแดงของค่าก่อนหน้า ("ต้องไม่น้อยกว่า 2592")
                  // ค้างอยู่คู่กับกล่องเตือนย้ายรุ่นของค่าใหม่ อ่านแล้วนึกว่าค่าใหม่ก็ผิด
                  onChange={e => { setEditForm(f => ({ ...f, academic_year: e.target.value })); setEditError(''); }} />
                <span className="hint">
                  {yearLocked
                    ? tt('officer.detail.yearLockedHint', { n: studentFull.exam_result_count })
                    : tt('officer.detail.yearDerivedHint', { year: studentFull?.academic_year_derived ?? '—' })}
                </span>
              </div>
            </div>
            {/* เตือนตอนกรอกค่าที่ต่างจากที่คำนวณได้ — กันพิมพ์ผิดแล้วนักศึกษาหายไปจากรุ่นทั้งรุ่น */}
            {!yearLocked && studentFull?.academic_year_derived != null
              && Number(editForm.academic_year) !== studentFull.academic_year_derived
              && String(editForm.academic_year).length === 4 && (
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10,
                background: 'var(--status-wait-bg)', color: 'var(--status-wait-fg)', fontSize: 14.5 }}>
                <Icon name="alert" size={17} style={{ flex: 'none', marginTop: 1 }} />
                <span>{tt('officer.detail.yearOverrideWarn', {
                  derived: studentFull.academic_year_derived, picked: editForm.academic_year })}</span>
              </div>
            )}
            {editError && <div style={{ color: 'var(--reject,#dc2626)', fontSize: 15 }}>{editError}</div>}
          </div>
        )}
      </Modal>

      <Modal open={!!preview} onClose={closePreview} width={preview?.kind === 'pdf' || preview?.kind === 'jpg' || preview?.kind === 'png' ? 1240 : 560}
        title={<span style={{ display: 'block', maxWidth: 520, margin: '0 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={preview?.filename}>{preview?.filename}</span>}
        footer={<div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          {/* ใบมีหลายไฟล์ — กันเข้าใจผิดว่ายืนยัน/ตีกลับเฉพาะไฟล์ที่เปิดอยู่ (จริงๆ มีผลทั้งใบ) */}
          {canReview && status === 'SUBMITTED' && (examResult?.certificates?.length || 0) > 1 && (
            <div style={{ padding: '8px 12px', background: 'var(--blue-50)', color: 'var(--navy-700)', borderRadius: 10, fontSize: 14.5, display: 'flex', gap: 8 }}>
              <Icon name="info" size={16} style={{ flex: 'none', marginTop: 3 }} /> <span>{tt('officer.detail.previewMultiFile', { n: examResult.certificates.length })}</span>
            </div>
          )}
          {previewRejecting && (
            <div className="field" style={{ margin: 0 }}>
              <label>{tt('officer.detail.rejectFieldLabel')}</label>
              <textarea className="input" rows={2} placeholder={tt('officer.detail.rejectPlaceholder')} value={remark} onChange={e => setRemark(e.target.value)} />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, color: 'var(--ink-500)' }}>{preview?.detail}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <a className="btn btn-ghost btn-sm" href={preview?.url} target="_blank" rel="noreferrer">
                <Icon name="eye" size={15} /> {tt('officer.detail.openNewTabBtn')}</a>
              {/* ปุ่มตัดสิน: เฉพาะคนที่มีสิทธิ์ตรวจ และใบยังรอตรวจ (เงื่อนไขเดียวกับปุ่มในหน้า) */}
              {canReview && status === 'SUBMITTED' && (previewRejecting ? <>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setPreviewRejecting(false)}>{tt('officer.detail.cancelBtn')}</button>
                <button className="btn btn-sm" style={{ background: 'var(--fail)', color: '#fff' }} disabled={!remark.trim() || busy} onClick={() => reviewFromPreview('reject')}>
                  <Icon name="send" size={15} /> {tt('officer.detail.confirmRejectBtn')}</button>
              </> : <>
                <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => setPreviewRejecting(true)}>
                  <Icon name="xCircle" size={15} /> {tt('officer.detail.rejectBtn')}</button>
                <button className="btn btn-success btn-sm" disabled={busy} onClick={() => reviewFromPreview('approve')}>
                  <Icon name="checkCircle" size={15} /> {tt('officer.detail.confirmBtn')}</button>
              </>)}
            </div>
          </div>
        </div>}>
        {/* ไฟล์ซ้าย + ผลที่นักศึกษาติ๊กขวา — เจ้าหน้าที่เทียบใบผลสอบกับที่กรอกได้ในจอเดียว ไม่ต้องปิดไปมา */}
        {(preview?.kind === 'pdf' || preview?.kind === 'jpg' || preview?.kind === 'png') && (
          <div className="preview-split" style={{ '--preview-footer-extra': previewFooterExtra + 'px' }}>
            <div className="preview-split-file">
              {preview.kind === 'pdf'
                ? <iframe src={preview.url} title={preview.filename} />
                : <img src={preview.url} alt={preview.filename} />}
            </div>
            {examResult && (
              <aside className="preview-split-side">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
                  <h4 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{tt('officer.detail.previewSelfTitle')}</h4>
                  <span className="tnum chip" style={{ background: allPass ? 'var(--status-ok-bg)' : 'var(--ink-100)', color: allPass ? 'var(--status-ok-fg)' : 'var(--ink-900)', fontWeight: 700 }}>
                    {tt('officer.detail.passChip', { passed: passedCount, total: roundSubjectIds.length })}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {subjects.filter(s => roundSubjectIds.includes(s.subject_id)).map(sub => {
                    const r = examResult.subject_results.find(x => x.subject_id === sub.subject_id);
                    return (
                      <div key={sub.subject_id} className="preview-sub-row">
                        <span className="mono" style={{ color: 'var(--ink-400)', fontSize: 13.5, flex: 'none', width: 38 }}>{sub.subject_code}</span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, lineHeight: 1.35 }}>{subjectName(lang, sub.subject_code, sub.subject_name)}</span>
                        <PassBadge passed={r ? r.is_passed : undefined} lang={lang} />
                      </div>
                    );
                  })}
                </div>
              </aside>
            )}
          </div>
        )}
        {preview && preview.kind !== 'pdf' && preview.kind !== 'jpg' && preview.kind !== 'png' && (
          <p style={{ margin: 0, color: 'var(--ink-600)' }}>{tt('officer.detail.previewUnsupported')}</p>
        )}
      </Modal>
    </div>
  );
}
