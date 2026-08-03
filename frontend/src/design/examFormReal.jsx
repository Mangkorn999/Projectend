/* ============================================================
   นักศึกษา — กรอกผลสอบ 8 วิชา + แนบเอกสาร PDF (ข้อมูลจริงจาก backend)
   แทนที่ ExamForm เดิมใน student.jsx ที่ยังใช้ mock SUBJECTS แล้ว toast ปลอมตอน submit
   flow จริง: ต้องมีรอบเปิด (GET /rounds/active) + exam_eligible=true (เจ้าหน้าที่เปิดสิทธิ์ให้)
   → POST /exam-results ได้ result_id → แนบไฟล์ทีละไฟล์ผ่าน POST /exam-results/:id/certificates
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, Donut, PassBadge } from './components.jsx';
import { apiFetch, ApiError } from './api.js';

export function ExamFormReal({ go, toast }) {
  const [subjects, setSubjects] = useState([]);
  const [round, setRound] = useState(null);
  const [blocked, setBlocked] = useState(''); // ข้อความเหตุผลที่กรอกไม่ได้ (ไม่มีสิทธิ์/ไม่มีรอบ/กรอกไปแล้ว)
  const [rejected, setRejected] = useState(null); // ใบที่ถูกตีกลับ ต้องกรอกใหม่ทับของเดิม
  const [results, setResults] = useState({}); // { [subject_id]: true|false }
  const [files, setFiles] = useState({}); // { EXAM: File, LICENSE: File }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // /rounds/active คืนรอบพร้อมรายวิชาของรอบนั้นมาให้เลย (ไม่ใช่ทุกวิชาในระบบเสมอไป)
    // แต่ละวิชามี already_passed บอกว่านักศึกษาคนนี้เคยสอบผ่านไปแล้วหรือยัง
    apiFetch('/rounds/active')
      .then(async (activeRound) => {
        if (!activeRound) {
          setBlocked('ขณะนี้ไม่มีรอบกรอกผลสอบที่เปิดอยู่');
          return;
        }
        setRound(activeRound);
        setSubjects(activeRound.subjects || []);
        if (activeRound.all_passed) {
          setBlocked('ผ่านครบทุกวิชาที่รอบนี้สอบแล้ว ไม่ต้องกรอกอีก');
          return;
        }
        // เช็คว่ารอบนี้กรอกไปแล้วหรือยัง — กันเสีย submit ซ้ำ (backend ก็เช็คซ้ำอีกชั้นตอน POST อยู่แล้ว)
        // ยกเว้นใบที่ถูกตีกลับ ต้องให้กรอกใหม่ได้ ไม่งั้นแก้ตามที่เจ้าหน้าที่บอกไม่ได้เลย
        const mine = await apiFetch('/exam-results/me');
        const inRound = mine.find(r => r.round_id === activeRound.round_id);
        if (inRound && inRound.staff_status === 'rejected') setRejected(inRound);
        else if (inRound) setBlocked('กรอกผลสอบรอบนี้ไปแล้ว ดูสถานะได้ที่หน้าสถานะการกรอก');
      })
      .catch(e => {
        // 403 = ยังไม่ได้รับสิทธิ์ — เป็นเหตุผลที่กรอกไม่ได้ ไม่ใช่ระบบพัง
        if (e instanceof ApiError) setBlocked(e.message);
        else setError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);

  // วิชาที่เคยผ่านแล้วไม่ต้องกรอกซ้ำ backend เติมให้เป็น "ผ่าน" ตอนบันทึกเอง
  const toAnswer = subjects.filter(s => !s.already_passed);
  const passedBefore = subjects.filter(s => s.already_passed);

  const filled = toAnswer.filter(s => results[s.subject_id] !== undefined).length;
  const allPass = toAnswer.length > 0 && toAnswer.every(s => results[s.subject_id] === true);

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const data = await apiFetch('/exam-results', {
        method: 'POST',
        body: { subject_results: toAnswer.map(s => ({ subject_id: s.subject_id, is_passed: results[s.subject_id] })) },
      });
      const resultId = data.result_id;
      for (const [type, file] of Object.entries(files)) {
        const form = new FormData();
        form.append('file', file);
        form.append('certificate_type', type === 'EXAM' ? 'exam_result' : 'license');
        await apiFetch(`/exam-results/${resultId}/certificates`, { method: 'POST', body: form });
      }
      toast('ส่งผลสอบสำเร็จ รอเจ้าหน้าที่ตรวจสอบ', 'success');
      go('status');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'ส่งผลสอบไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>กำลังโหลดข้อมูล…</div>;
  if (error) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--reject,#dc2626)' }}>เกิดข้อผิดพลาด: {error}</div>;
  if (blocked) return (
    <div className="fade-up">
      <PageHead title="กรอกผลสอบ" />
      <div className="card card-pad" style={{ maxWidth: 520, textAlign: 'center', padding: 40 }}>
        <Icon name="info" size={34} style={{ color: 'var(--navy-600)', marginBottom: 12 }} />
        <p style={{ color: 'var(--ink-700)', fontSize: 14.5 }}>{blocked}</p>
      </div>
    </div>
  );

  return (
    <div className="fade-up">
      <PageHead title={rejected ? 'แก้ไขและส่งผลสอบใหม่' : 'กรอกผลสอบ'}
        sub={round ? `รอบที่ ${round.attempt_number}/${round.academic_year}` : ''} />

      {rejected && (
        <div className="card card-pad" style={{ marginBottom: 18, borderLeft: '4px solid var(--status-reject-dot)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="xCircle" size={19} style={{ color: 'var(--status-reject-dot)', flex: 'none', marginTop: 1 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 3 }}>ผลสอบที่ส่งไปถูกตีกลับ</div>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-700)' }}>
                {rejected.remark || 'เจ้าหน้าที่ไม่ได้ระบุเหตุผล กรุณาติดต่อเจ้าหน้าที่คณะ'}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--ink-500)' }}>
                กรอกใหม่แล้วส่งอีกครั้ง ระบบจะแทนที่ผลเดิมและกลับไปรอเจ้าหน้าที่ตรวจ
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="row wrap-m" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ink-100)' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>ผลสอบรายวิชา</h3>
              <p style={{ margin: '3px 0 0', color: 'var(--ink-500)', fontSize: 13 }}>
                เลือกผ่าน/ไม่ผ่านให้ครบทั้ง {toAnswer.length} วิชา
                {passedBefore.length > 0 && ` (อีก ${passedBefore.length} วิชาผ่านไปแล้วจากรอบก่อน)`}
              </p>
            </div>
            {subjects.map((s, i) => (
              <div key={s.subject_id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                borderBottom: i < subjects.length - 1 ? '1px solid var(--ink-100)' : 'none',
                background: s.already_passed ? 'var(--ink-50, #fafafa)' : 'transparent' }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--ink-400)', width: 60, flex: 'none' }}>{s.subject_code}</span>
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, color: s.already_passed ? 'var(--ink-500)' : 'var(--ink-800)' }}>{s.subject_name}</span>
                {s.already_passed ? (
                  <span className="badge ok" style={{ flex: 'none' }}><span className="dot" />ผ่านแล้วจากรอบก่อน</span>
                ) : (
                  <div className="seg">
                    <button className={results[s.subject_id] === true ? 'on pass' : ''} onClick={() => setResults(r => ({ ...r, [s.subject_id]: true }))}>ผ่าน</button>
                    <button className={results[s.subject_id] === false ? 'on fail' : ''} onClick={() => setResults(r => ({ ...r, [s.subject_id]: false }))}>ไม่ผ่าน</button>
                  </div>
                )}
              </div>
            ))}
            <style>{`.seg{display:inline-flex;background:var(--ink-100);border-radius:999px;padding:3px;gap:3px;flex:none;}
              .seg button{border:none;background:transparent;padding:7px 16px;border-radius:999px;font-size:13.5px;font-weight:600;color:var(--ink-500);transition:.13s;font-family:inherit;cursor:pointer;}
              .seg button.on.pass{background:var(--pass);color:#fff;}
              .seg button.on.fail{background:var(--fail);color:#fff;}`}</style>
          </div>

          <div className="card card-pad">
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>แนบเอกสารหลักฐาน (PDF)</h3>
            <p style={{ margin: '0 0 16px', color: 'var(--ink-500)', fontSize: 13 }}>{allPass ? 'ผ่านครบทุกวิชา — แนบทั้งใบผลสอบและใบประกอบวิชาชีพ' : 'แนบใบผลสอบ (ใบประกอบวิชาชีพแนบได้เมื่อผ่านครบทุกวิชา)'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <FileSlot label="ใบผลสอบ" file={files.EXAM} onChange={f => setFiles(x => ({ ...x, EXAM: f }))} />
              {allPass && <FileSlot label="ใบประกอบวิชาชีพ" file={files.LICENSE} onChange={f => setFiles(x => ({ ...x, LICENSE: f }))} />}
            </div>
          </div>
        </div>

        <div style={{ width: 260, flex: 'none' }}>
          <div className="card card-pad" style={{ position: 'sticky', top: 84 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-500)', marginBottom: 12 }}>ความคืบหน้า</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Donut size={130} thickness={16} segments={[
                { value: toAnswer.filter(s => results[s.subject_id] === true).length, color: 'var(--pass)' },
                { value: toAnswer.filter(s => results[s.subject_id] === false).length, color: 'var(--fail)' },
                { value: toAnswer.length - filled, color: 'var(--ink-200)' },
              ]} center={<><div className="tnum" style={{ fontSize: 26, fontWeight: 800 }}>{filled}/{toAnswer.length}</div><div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>กรอกแล้ว</div></>} />
            </div>
            {error && <div style={{ color: 'var(--reject,#dc2626)', fontSize: 13, marginTop: 10 }}>{error}</div>}
            <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 14 }}
              disabled={filled < toAnswer.length || submitting} onClick={submit}>
              {submitting ? 'กำลังส่ง…' : rejected ? 'ส่งผลสอบใหม่' : 'ส่งผลสอบ'} <Icon name="send" size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FileSlot({ label, file, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px dashed var(--ink-300)', borderRadius: 11 }}>
      <Icon name="pdf" size={22} style={{ color: file ? 'var(--pass)' : 'var(--ink-400)', flex: 'none' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{file ? file.name : 'ยังไม่ได้แนบไฟล์'}</div>
      </div>
      <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
        เลือกไฟล์
        <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => onChange(e.target.files?.[0] || null)} />
      </label>
    </div>
  );
}
