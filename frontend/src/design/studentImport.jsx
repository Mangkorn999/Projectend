/* ============================================================
   เจ้าหน้าที่ — เพิ่มนักศึกษาเข้าระบบ 2 แบบ: import CSV (ทีละหลายคน) หรือกรอกเองทีละคน
   เรียก POST /api/students/import และ POST /api/students จริง ไม่ใช่ mock
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead } from './components.jsx';
import { apiFetch, ApiError } from './api.js';

const CSV_TEMPLATE =
  'student_id,first_name,last_name,email,phone,room_name,academic_year\n' +
  '6610210001,สมชาย,ใจดี,somchai.j@psu.ac.th,0812345678,ห้องเรียนปกติ,2566\n';

export function StudentImport({ toast }) {
  const [tab, setTab] = useState('csv'); // 'csv' | 'manual'

  return (
    <div className="fade-up">
      <PageHead title="นำเข้ารายชื่อนักศึกษา" sub="เพิ่มนักศึกษาเข้าระบบด้วยไฟล์ CSV หรือกรอกเองทีละคน" />
      <div style={{ display:'inline-flex', gap:3, padding:4, background:'var(--ink-100)', borderRadius:12, marginBottom:20 }}>
        <button onClick={()=>setTab('csv')} style={tabBtnStyle(tab==='csv')}>
          <Icon name="upload" size={15}/> นำเข้าไฟล์ CSV
        </button>
        <button onClick={()=>setTab('manual')} style={tabBtnStyle(tab==='manual')}>
          <Icon name="edit" size={15}/> กรอกเองทีละคน
        </button>
      </div>
      {tab==='csv' ? <CsvImport toast={toast} /> : <ManualAdd toast={toast} />}
    </div>
  );
}

function tabBtnStyle(active) {
  return {
    display:'inline-flex', alignItems:'center', gap:7, border:'none', cursor:'pointer',
    padding:'9px 16px', borderRadius:9, fontSize:13.5, fontWeight:700, fontFamily:'inherit',
    transition:'.15s', background: active ? '#fff' : 'transparent',
    color: active ? 'var(--navy-800)' : 'var(--ink-500)',
    boxShadow: active ? 'var(--sh-xs)' : 'none',
  };
}

function CsvImport({ toast }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null); // { imported_count, skipped_count, imported, skipped }
  const [error, setError] = useState('');
  const [rooms, setRooms] = useState([]);

  // โชว์ชื่อห้องจริงในระบบตรงนี้เลย — กันพิมพ์ room_name ใน CSV ไม่ตรง (ต้องตรงเป๊ะทุกตัวอักษร)
  useEffect(() => { apiFetch('/rooms').then(setRooms).catch(()=>{}); }, []);

  const downloadTemplate = () => {
    // สร้างไฟล์ CSV ตัวอย่างในเบราว์เซอร์ ไม่ต้องพึ่ง backend — ให้เจ้าหน้าที่เอาไปแก้เป็นรายชื่อจริง
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'student_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    if (!file) { setError('กรุณาเลือกไฟล์ CSV ก่อน'); return; }
    setError(''); setResult(null); setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      // apiFetch ตรวจเจอ FormData แล้วไม่ใส่ Content-Type เอง (browser จัดการ boundary ให้)
      const data = await apiFetch('/students/import', { method: 'POST', body: form });
      setResult(data);
      toast && toast(`นำเข้าสำเร็จ ${data.imported_count} คน`, data.skipped_count ? 'info' : 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'นำเข้าไม่สำเร็จ');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="card" style={{ padding:22, marginBottom:18 }}>
        <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:16,
          background:'var(--blue-50)', border:'1px solid var(--blue-100)', borderRadius:12, padding:14 }}>
          <Icon name="checkCircle" size={17} style={{ color:'var(--blue-600)', flex:'none', marginTop:1 }} />
          <div style={{ fontSize:13, color:'var(--ink-700)', lineHeight:1.7 }}>
            ไฟล์ต้องมีคอลัมน์: <span className="mono" style={{ fontSize:12 }}>student_id, first_name, last_name, email, phone, room_name, academic_year</span><br/>
            <b>room_name ต้องพิมพ์ให้ตรงกับชื่อห้องด้านล่างเป๊ะทุกตัวอักษร</b> — พิมพ์ไม่ตรงแถวนั้นจะถูกข้าม:{' '}
            {rooms.length > 0
              ? rooms.map(r => <span key={r.room_id} className="chip" style={{ marginRight:6 }}>{r.room_name}</span>)
              : <span style={{ color:'var(--ink-500)' }}>(ยังไม่มีห้องเรียนในระบบ)</span>}
            <br/>
            นักศึกษาที่นำเข้าจะยังไม่มีรหัสผ่าน — ต้องไปตั้งรหัสผ่านเองที่หน้า "เข้าใช้งานครั้งแรก" บนหน้า login
          </div>
        </div>
        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <button className="btn btn-ghost" onClick={downloadTemplate}><Icon name="download" size={16}/> โหลดไฟล์ตัวอย่าง</button>
          <label className="btn btn-ghost" style={{ cursor:'pointer' }}>
            <Icon name="upload" size={16}/> {file ? file.name : 'เลือกไฟล์ CSV'}
            <input type="file" accept=".csv,text/csv" style={{ display:'none' }}
              onChange={e=>{ setFile(e.target.files?.[0]||null); setResult(null); setError(''); }} />
          </label>
          <button className="btn btn-primary" onClick={submit} disabled={uploading || !file}>
            {uploading ? 'กำลังนำเข้า…' : 'นำเข้าไฟล์'}
          </button>
        </div>
        {error && <div style={{ color:'var(--status-reject-fg)', background:'var(--status-reject-bg)',
          borderRadius:9, padding:'9px 12px', fontSize:13, marginTop:14 }}>{error}</div>}
      </div>

      {result && (
        <div className="card" style={{ overflow:'hidden' }}>
          <div style={{ padding:'18px 20px', display:'flex', gap:28, borderBottom:'1px solid var(--ink-100)' }}>
            <div><div className="tnum" style={{ fontSize:24, fontWeight:800, color:'var(--pass)' }}>{result.imported_count}</div>
              <div style={{ fontSize:12.5, color:'var(--ink-500)' }}>นำเข้าสำเร็จ</div></div>
            <div><div className="tnum" style={{ fontSize:24, fontWeight:800, color:'var(--fail)' }}>{result.skipped_count}</div>
              <div style={{ fontSize:12.5, color:'var(--ink-500)' }}>ข้าม (ดูเหตุผลด้านล่าง)</div></div>
          </div>
          {result.skipped.length > 0 && (
            <table className="tbl">
              <thead><tr><th>แถวที่</th><th>รหัสนักศึกษา</th><th>เหตุผล</th></tr></thead>
              <tbody>
                {result.skipped.map((s,i)=>(
                  <tr key={i}><td>{s.row}</td><td className="mono">{s.student_id||'-'}</td><td>{s.reason}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}

const EMPTY_FORM = { student_id:'', first_name:'', last_name:'', email:'', phone:'', room_id:'', academic_year:'' };

// เพิ่มทีละคน — field ตรงกับตาราง users (first_name/last_name/email/phone) + students (student_id/room_id/academic_year)
// room ให้เลือกจาก dropdown จริงจาก GET /api/rooms เท่านั้น กันพิมพ์ชื่อห้องผิดแบบตอน import CSV
function ManualAdd({ toast }) {
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/rooms').then(setRooms).catch(()=>{}).finally(()=>setLoadingRooms(false));
  }, []);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const submit = async () => {
    setError('');
    const { student_id, first_name, last_name, email, phone, room_id, academic_year } = form;
    if (!student_id || !first_name || !last_name || !email || !phone || !room_id || !academic_year) {
      setError('กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/students', {
        method: 'POST',
        body: { student_id, first_name, last_name, email, phone, room_id: Number(room_id), academic_year: Number(academic_year) },
      });
      toast && toast(`เพิ่มนักศึกษา ${first_name} ${last_name} สำเร็จ`, 'success');
      setForm(EMPTY_FORM);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'เพิ่มนักศึกษาไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ padding:0, maxWidth:560, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 22px',
        borderBottom:'1px solid var(--ink-100)', background:'var(--ink-50)' }}>
        <div style={{ width:38, height:38, borderRadius:10, flex:'none', background:'var(--gold-100)',
          color:'var(--navy-800)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon name="user" size={18} />
        </div>
        <div>
          <div style={{ fontWeight:700, fontSize:14.5, color:'var(--ink-900)' }}>เพิ่มนักศึกษา 1 คน</div>
          <div style={{ fontSize:12.5, color:'var(--ink-500)' }}>ยังไม่มีรหัสผ่าน — นักศึกษาไปตั้งเองที่หน้า "เข้าใช้งานครั้งแรก"</div>
        </div>
      </div>

      <div style={{ padding:22 }}>
        <div className="field" style={{ marginBottom:14 }}>
          <label>รหัสนักศึกษา (student_id)</label>
          <input className="input" value={form.student_id} onChange={set('student_id')} placeholder="6610210001" />
        </div>
        <div className="grid g-2" style={{ marginBottom:14 }}>
          <div className="field">
            <label>ชื่อจริง</label>
            <input className="input" value={form.first_name} onChange={set('first_name')} />
          </div>
          <div className="field">
            <label>นามสกุล</label>
            <input className="input" value={form.last_name} onChange={set('last_name')} />
          </div>
        </div>
        <div className="field" style={{ marginBottom:14 }}>
          <label>อีเมล</label>
          <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="6610210001@psu.ac.th" />
        </div>
        <div className="field" style={{ marginBottom:14 }}>
          <label>เบอร์โทร</label>
          <input className="input" value={form.phone} onChange={set('phone')} placeholder="0812345678" />
        </div>
        <div className="grid g-2" style={{ marginBottom:8 }}>
          <div className="field">
            <label>ห้องเรียน</label>
            <select className="select" value={form.room_id} onChange={set('room_id')} disabled={loadingRooms}>
              <option value="">{loadingRooms ? 'กำลังโหลด…' : '— เลือกห้องเรียน —'}</option>
              {rooms.map(r => <option key={r.room_id} value={r.room_id}>{r.room_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>ปีการศึกษา (พ.ศ.)</label>
            <input className="input" type="number" value={form.academic_year} onChange={set('academic_year')} placeholder="2568" />
          </div>
        </div>
        {!loadingRooms && rooms.length === 0 && (
          <div style={{ color:'var(--status-wait-fg)', background:'var(--status-wait-bg)',
            borderRadius:9, padding:'9px 12px', fontSize:12.5, marginBottom:14 }}>
            ยังไม่มีห้องเรียนในระบบ — ติดต่อผู้ดูแลระบบให้เพิ่มห้องเรียนก่อน
          </div>
        )}
        {error && <div style={{ color:'var(--status-reject-fg)', background:'var(--status-reject-bg)',
          borderRadius:9, padding:'9px 12px', fontSize:13, marginBottom:14 }}>{error}</div>}
        <button className="btn btn-primary btn-block" onClick={submit} disabled={saving}>
          {saving ? 'กำลังบันทึก…' : 'เพิ่มนักศึกษา'}
        </button>
      </div>
    </div>
  );
}
