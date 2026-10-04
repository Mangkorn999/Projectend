/* ============================================================
   นักศึกษากรอกโปรไฟล์ครั้งแรกหลัง login — เจ้าหน้าที่ import มาแค่ student_id
   + เลขบัตร ปชช เท่านั้น ยังไม่มี Student row จนกว่าจะกรอกหน้านี้เสร็จ
   backend บล็อกทุก endpoint ยกเว้น /me กับ /complete-profile จนกว่าจะกรอกสำเร็จ
   ปีการศึกษาที่จบตั้งฝั่ง server เท่านั้น (ปีที่เจ้าหน้าที่ระบุตอน import ถ้ามี ไม่งั้นคำนวณจากรหัส)
   หน้านี้แค่โชว์ผล นักศึกษาแก้เองไม่ได้
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { Logo } from './logos.jsx';
import { Select } from './components.jsx';
import { apiFetch, ApiError } from './api.js';

const EMPTY = {
  first_name: '', last_name: '', first_name_en: '', last_name_en: '',
  email: '', phone: '', room_id: '',
};

export function CompleteProfile({ onDone }) {
  const [step, setStep] = useState('form'); // 'form' | 'review' | 'done'
  const [form, setForm] = useState(EMPTY);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    // โหลดห้องไม่ได้ต้องบอก — ไม่งั้น dropdown ว่างเฉยๆ นักศึกษาไม่รู้ว่าทำไมเลือกไม่ได้
    apiFetch('/rooms')
      .then(setRooms)
      .catch(() => setError('โหลดรายชื่อห้องเรียนไม่สำเร็จ กรุณารีเฟรชหน้านี้'))
      .finally(() => setLoadingRooms(false));
  }, []);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const roomName = rooms.find(r => String(r.room_id) === String(form.room_id))?.room_name || '';

  const goReview = () => {
    setError('');
    const { first_name, last_name, first_name_en, last_name_en, email, phone, room_id } = form;
    if (!first_name || !last_name || !first_name_en || !last_name_en || !email || !phone || !room_id) {
      setError('กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }
    setStep('review');
  };

  const submit = async () => {
    setError('');
    setSaving(true);
    try {
      const data = await apiFetch('/students/complete-profile', {
        method: 'POST',
        body: { ...form, room_id: Number(form.room_id) },
      });
      setResult(data);
      setStep('done');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'เกิดข้อผิดพลาด');
      setStep('form');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(155deg,var(--ink-50),var(--gold-100) 180%)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460 }} className="fade-up">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}><Logo size={44} /></div>
        <div className="card" style={{ padding: 28 }}>

          {step === 'done' ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--pass,#16a34a)', marginBottom: 10 }}><Icon name="checkCircle" size={40} /></div>
              <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: 'var(--ink-900)' }}>กรอกโปรไฟล์สำเร็จ</h2>
              <p style={{ color: 'var(--ink-500)', fontSize: 16, marginBottom: 4 }}>
                ปีการศึกษาที่จบ: <b>{result?.student?.academic_year ?? '-'}</b>
              </p>
              <p style={{ color: 'var(--ink-500)', fontSize: 15, marginBottom: 20 }}>เข้าใช้งานระบบต่อได้เลย</p>
              <button className="btn btn-primary btn-block" onClick={onDone}>เข้าสู่ระบบ</button>
            </div>
          ) : step === 'review' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, flex: 'none', background: 'var(--gold-100)',
                  color: 'var(--navy-800)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="checkCircle" size={22} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: 'var(--ink-900)' }}>ตรวจสอบข้อมูลก่อนยืนยัน</h2>
                  <p style={{ margin: '2px 0 0', color: 'var(--ink-500)', fontSize: 15 }}>กรอกครั้งเดียว แก้ไขทีหลังต้องให้เจ้าหน้าที่แก้ให้</p>
                </div>
              </div>
              <ReviewRow label="ชื่อ-สกุล (ไทย)" value={`${form.first_name} ${form.last_name}`} />
              <ReviewRow label="ชื่อ-สกุล (อังกฤษ)" value={`${form.first_name_en} ${form.last_name_en}`} />
              <ReviewRow label="อีเมล" value={form.email} />
              <ReviewRow label="เบอร์โทร" value={form.phone} />
              <ReviewRow label="ห้องเรียน" value={roomName} last />
              {error && <div style={{ color: 'var(--status-reject-fg)', background: 'var(--status-reject-bg)',
                borderRadius: 9, padding: '9px 12px', fontSize: 15, marginBottom: 14 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep('form')} disabled={saving}>← แก้ไข</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={submit} disabled={saving}>
                  {saving ? 'กำลังบันทึก…' : 'ยืนยันข้อมูล'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, flex: 'none', background: 'var(--gold-100)',
                  color: 'var(--navy-800)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="user" size={22} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: 'var(--ink-900)' }}>กรอกโปรไฟล์ครั้งแรก</h2>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>ชื่อจริง (ไทย)</label>
                  <input className="input" value={form.first_name} onChange={set('first_name')} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>นามสกุล (ไทย)</label>
                  <input className="input" value={form.last_name} onChange={set('last_name')} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>First name (EN)</label>
                  <input className="input" value={form.first_name_en} onChange={set('first_name_en')} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Last name (EN)</label>
                  <input className="input" value={form.last_name_en} onChange={set('last_name_en')} />
                </div>
              </div>
              <div className="field" style={{ marginBottom: 10 }}>
                <label>อีเมล</label>
                <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="you@psu.ac.th" />
              </div>
              <div className="field" style={{ marginBottom: 10 }}>
                <label>เบอร์โทร</label>
                <input className="input tnum" value={form.phone} onChange={set('phone')} placeholder="0812345678" />
              </div>
              <div className="field" style={{ marginBottom: 16 }}>
                <label>ห้องเรียน</label>
                <Select value={String(form.room_id)} disabled={loadingRooms}
                  onChange={v => setForm(f => ({ ...f, room_id: v }))}
                  options={[{ value: '', label: loadingRooms ? 'กำลังโหลด…' : '— เลือกห้องเรียน —' },
                    ...rooms.map(r => ({ value: String(r.room_id), label: r.room_name }))]} />
              </div>

              {error && <div style={{ color: 'var(--status-reject-fg)', background: 'var(--status-reject-bg)',
                borderRadius: 9, padding: '9px 12px', fontSize: 15, marginBottom: 14 }}>{error}</div>}
              <button className="btn btn-primary btn-lg btn-block" onClick={goReview}>ตรวจสอบข้อมูล</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0',
      borderBottom: last ? 'none' : '1px solid var(--ink-100)', marginBottom: last ? 16 : 0 }}>
      <span style={{ color: 'var(--ink-500)', fontSize: 15 }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: 15, textAlign: 'right' }}>{value || '-'}</span>
    </div>
  );
}
