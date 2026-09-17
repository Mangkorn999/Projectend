/* ============================================================
   เจ้าหน้าที่ — เพิ่มนักศึกษาเข้าระบบ 2 แบบ: import CSV (ทีละหลายคน) หรือกรอกเองทีละคน
   เรียก POST /api/students/import และ POST /api/students จริง ไม่ใช่ mock
   ============================================================ */
import { useState } from 'react';
import { Icon } from './data.jsx';
import { PageHead } from './components.jsx';
import { apiFetch, ApiError } from './api.js';
import { t } from './i18n.js';

const CSV_TEMPLATE =
  'student_id,national_id\n' +
  '6610210001,1234567890123\n';

export function StudentImport({ toast, lang }) {
  const [tab, setTab] = useState('csv'); // 'csv' | 'manual'
  const tt = (key, vars) => t(lang, key, vars);

  return (
    <div className="fade-up">
      <PageHead title={tt('importReal.title')} sub={tt('importReal.sub')} />
      {/* แถบสลับโหมดชิดขวา — ให้หัวเรื่องฝั่งซ้ายเป็นตัวนำสายตา ปุ่มสลับเป็นตัวรอง */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:20 }}>
        <div style={{ display:'inline-flex', gap:3, padding:4, background:'var(--ink-100)', borderRadius:12 }}>
          <button onClick={()=>setTab('csv')} style={tabBtnStyle(tab==='csv')}>
            <Icon name="upload" size={15}/> {tt('importReal.tabCsv')}
          </button>
          <button onClick={()=>setTab('manual')} style={tabBtnStyle(tab==='manual')}>
            <Icon name="edit" size={15}/> {tt('importReal.tabManual')}
          </button>
        </div>
      </div>
      {tab==='csv' ? <CsvImport toast={toast} tt={tt} /> : <ManualAdd toast={toast} tt={tt} />}
    </div>
  );
}

function tabBtnStyle(active) {
  return {
    display:'inline-flex', alignItems:'center', gap:7, border:'none', cursor:'pointer',
    padding:'9px 16px', borderRadius:9, fontSize:15.5, fontWeight:700, fontFamily:'inherit',
    transition:'.15s', background: active ? '#fff' : 'transparent',
    color: active ? 'var(--navy-800)' : 'var(--ink-500)',
    boxShadow: active ? 'var(--sh-xs)' : 'none',
  };
}

// จัดกลุ่ม reason ข้อความยาวๆ จาก backend ให้เหลือ badge สั้นๆ กวาดตาดูรอบเดียวรู้ว่าปัญหาประเภทไหนเยอะสุด
// (รายละเอียดเต็มยังอยู่ในคอลัมน์ "เหตุผล" เหมือนเดิม อันนี้แค่ช่วยจัดหมวด)
const REASON_MATCHERS = [
  { match: 'มีในระบบแล้ว', labelKey: 'importReal.reasonExists', tone: 'wait' },
  { match: 'เลขบัตรประชาชน', labelKey: 'importReal.reasonInvalidId', tone: 'reject' },
  { match: 'รหัสนักศึกษาต้องเป็นตัวเลข', labelKey: 'importReal.reasonInvalidId', tone: 'reject' },
  { match: 'ข้อมูลไม่ครบ', labelKey: 'importReal.reasonIncomplete', tone: 'draft' },
  { match: 'บันทึกไม่สำเร็จ', labelKey: 'importReal.reasonError', tone: 'reject' },
];
const tagForReason = (reason, tt) => {
  const m = REASON_MATCHERS.find((r) => reason?.includes(r.match));
  return m ? { label: tt(m.labelKey), tone: m.tone } : { label: tt('importReal.reasonOther'), tone: 'draft' };
};

// แปลงรายการที่ถูกข้าม เป็นไฟล์ CSV ให้เจ้าหน้าที่โหลดไปแก้ในไฟล์เดิมแล้วอัปใหม่เฉพาะแถวที่พลาด
const skippedToCsv = (skipped) => {
  const header = 'row,student_id,reason\n';
  const rows = skipped.map(s => `${s.row},${s.student_id || ''},"${(s.reason || '').replace(/"/g, '""')}"`).join('\n');
  return header + rows;
};

function CsvImport({ toast, tt }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null); // { imported_count, skipped_count, imported, skipped }
  const [view, setView] = useState('skipped'); // 'imported' | 'skipped' — ตารางไหนกำลังโชว์อยู่
  const [error, setError] = useState('');

  const downloadTemplate = () => {
    // สร้างไฟล์ CSV ตัวอย่างในเบราว์เซอร์ ไม่ต้องพึ่ง backend — ให้เจ้าหน้าที่เอาไปแก้เป็นรายชื่อจริง
    // '﻿' = BOM นำหน้าไฟล์ ไม่งั้น Excel เดา encoding เป็น ANSI/Windows-874 แล้วภาษาไทยเพี้ยน
    const blob = new Blob(['﻿' + CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'student_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSkipped = () => {
    const blob = new Blob(['﻿' + skippedToCsv(result.skipped)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'student_import_skipped.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    if (!file) { setError(tt('importReal.selectFileFirst')); return; }
    setError(''); setResult(null); setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      // apiFetch ตรวจเจอ FormData แล้วไม่ใส่ Content-Type เอง (browser จัดการ boundary ให้)
      const data = await apiFetch('/students/import', { method: 'POST', body: form });
      setResult(data);
      setView(data.skipped_count > 0 ? 'skipped' : 'imported'); // มีแถวที่ข้ามให้เห็นก่อน ไม่งั้นโชว์รายชื่อที่สำเร็จ
      toast && toast(tt('importReal.importedToast', { n: data.imported_count }), data.skipped_count ? 'info' : 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tt('importReal.importFailMsg'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="card" style={{ padding:22, marginBottom:18 }}>
        <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:16,
          background:'var(--blue-50)', border:'1px solid var(--blue-100)', borderRadius:12, padding:14 }}>
          <Icon name="info" size={17} style={{ color:'var(--blue-600)', flex:'none', marginTop:1 }} />
          <div style={{ fontSize:15, color:'var(--ink-700)', lineHeight:1.7 }}>
            {tt('importReal.csvColumnsNote').replace('{cols}', '')}<span className="mono" style={{ fontSize:14 }}>student_id, national_id</span><br/>
            {tt('importReal.noPasswordNote')}
          </div>
        </div>
        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <button className="btn btn-ghost" onClick={downloadTemplate}><Icon name="download" size={16}/> {tt('importReal.downloadTemplateBtn')}</button>
          {file ? (
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'8px 8px 8px 14px',
              borderRadius:9, border:'1px solid var(--ink-200)', fontSize:15.5 }}>
              <Icon name="doc" size={15} style={{ color:'var(--ink-500)', flex:'none' }} />
              <span style={{ maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.name}</span>
              <button type="button" aria-label={tt('importReal.removeFileLabel')} onClick={()=>{ setFile(null); setResult(null); setError(''); }}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', width:22, height:22, border:'none',
                  borderRadius:'50%', background:'var(--ink-100)', color:'var(--ink-500)', cursor:'pointer', flex:'none' }}>
                <Icon name="x" size={13}/>
              </button>
            </div>
          ) : (
            <label className="btn btn-ghost" style={{ cursor:'pointer' }}>
              <Icon name="upload" size={16}/> {tt('importReal.chooseCsvBtn')}
              <input type="file" accept=".csv,text/csv" style={{ display:'none' }}
                onChange={e=>{ setFile(e.target.files?.[0]||null); setResult(null); setError(''); }} />
            </label>
          )}
          <button className="btn btn-primary" onClick={submit} disabled={uploading || !file}>
            {uploading ? tt('importReal.importing') : tt('importReal.importBtn')}
          </button>
        </div>
        {error && (
          <div role="alert" style={{ display:'flex', gap:10, alignItems:'flex-start', color:'var(--status-reject-fg)',
            background:'var(--status-reject-bg)', borderRadius:9, padding:'11px 14px', fontSize:15, marginTop:14 }}>
            <Icon name="xCircle" size={16} style={{ flex:'none', marginTop:1 }} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {result && (
        <div aria-live="polite" className="fade-up">
          <ResultBanner result={result} tt={tt} />

          <div className="card" style={{ overflow:'hidden' }}>
            <div style={{ padding:'18px 20px', display:'flex', gap:10, borderBottom:'1px solid var(--ink-100)', flexWrap:'wrap' }}>
              <StatToggle
                active={view==='imported'} onClick={()=>setView('imported')}
                icon="checkCircle" tone="pass" count={result.imported_count} label={tt('importReal.importedSuccessLabel')}
                disabled={result.imported_count===0} tt={tt}
              />
              <StatToggle
                active={view==='skipped'} onClick={()=>setView('skipped')}
                icon="alert" tone="fail" count={result.skipped_count} label={tt('importReal.skippedLabel')}
                disabled={result.skipped_count===0} tt={tt}
              />
              {result.skipped_count > 0 && (
                <button className="btn btn-ghost" style={{ marginLeft:'auto', alignSelf:'center' }} onClick={downloadSkipped}>
                  <Icon name="download" size={15}/> {tt('importReal.downloadSkippedBtn')}
                </button>
              )}
            </div>

            {view === 'imported' && (
              result.imported.length > 0 ? (
                <table className="tbl">
                  <thead><tr><th>{tt('importReal.colOrder')}</th><th>{tt('importReal.colStudentId')}</th><th>{tt('importReal.colStatus')}</th></tr></thead>
                  <tbody>
                    {result.imported.map((studentId,i)=>(
                      <tr key={i}>
                        <td className="tnum">{i+1}</td>
                        <td className="mono">{studentId}</td>
                        <td><span className="badge ok"><span className="dot" />{tt('importReal.enteredSystem')}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyRows text={tt('importReal.noImportedRows')} />
              )
            )}

            {view === 'skipped' && (
              result.skipped.length > 0 ? (
                <table className="tbl">
                  <thead><tr><th>{tt('importReal.colRow')}</th><th>{tt('importReal.colStudentId')}</th><th>{tt('importReal.colType')}</th><th>{tt('importReal.colReason')}</th></tr></thead>
                  <tbody>
                    {result.skipped.map((s,i)=>{
                      const tag = tagForReason(s.reason, tt);
                      return (
                        <tr key={i}>
                          <td className="tnum">{s.row}</td>
                          <td className="mono">{s.student_id||'-'}</td>
                          <td><span className={`badge ${tag.tone}`}><span className="dot" />{tag.label}</span></td>
                          <td style={{ color:'var(--ink-700)' }}>{s.reason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <EmptyRows text={tt('importReal.noSkippedRows')} />
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}

// การ์ดตัวเลขที่กดสลับได้ — active โชว์กรอบ+พื้นหลังตัดกันชัด ไม่ได้พึ่งแค่สีตัวเลข (คนตาบอดสีก็แยกออกว่าอันไหนกำลังเปิดอยู่)
function StatToggle({ active, onClick, icon, tone, count, label, disabled, tt }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      style={{
        display:'flex', alignItems:'center', gap:10, padding:'8px 14px', borderRadius:10,
        border: active ? `1.5px solid var(--${tone})` : '1.5px solid transparent',
        background: active ? `var(--status-${tone==='pass'?'ok':'reject'}-bg)` : 'transparent',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .45 : 1,
        fontFamily:'inherit', transition:'.15s',
      }}
    >
      <Icon name={icon} size={19} style={{ color:`var(--${tone})`, flex:'none' }} />
      <div style={{ textAlign:'left' }}>
        <div className="tnum" style={{ fontSize:26, fontWeight:800, color:`var(--${tone})`, lineHeight:1.1 }}>{count}</div>
        <div style={{ fontSize:14.5, color:'var(--ink-500)' }}>{label}{!disabled && tt('importReal.viewListSuffix')}</div>
      </div>
    </button>
  );
}

function EmptyRows({ text }) {
  return <div style={{ padding:'32px 20px', textAlign:'center', color:'var(--ink-500)', fontSize:15.5 }}>{text}</div>;
}

// สรุปสถานะรวมแบบเห็นปุ๊บรู้ปั๊บ — โทนสีเปลี่ยนตามผลจริง ไม่ใช่ตอบเขียวทุกครั้งที่กดสำเร็จ (success ≠ ไม่มีปัญหาเสมอไป)
function ResultBanner({ result, tt }) {
  const { imported_count, skipped_count } = result;
  let tone, icon, message;
  if (imported_count === 0 && skipped_count > 0) {
    tone = 'reject'; icon = 'xCircle';
    message = tt('importReal.allFailedMsg', { n: skipped_count });
  } else if (skipped_count > 0) {
    tone = 'wait'; icon = 'alert';
    message = tt('importReal.partialMsg', { imported: imported_count, skipped: skipped_count });
  } else {
    tone = 'ok'; icon = 'checkCircle';
    message = tt('importReal.allSuccessMsg', { n: imported_count });
  }
  return (
    <div style={{ display:'flex', gap:10, alignItems:'center', padding:'12px 16px', borderRadius:12, marginBottom:14,
      background:`var(--status-${tone}-bg)`, color:`var(--status-${tone}-fg)`, fontSize:15.5, fontWeight:600 }}>
      <Icon name={icon} size={18} style={{ flex:'none' }} />
      <span>{message}</span>
    </div>
  );
}

const EMPTY_FORM = { student_id:'', national_id:'' };

// เพิ่มทีละคน — สร้างแค่ user (student_id + เลขบัตร ปชช = password) ชื่อ/ห้อง/ปีจบ
// นักศึกษากรอกเองตอน login ครั้งแรก (complete-profile) ไม่ใช่หน้าที่เจ้าหน้าที่กรอกอีกต่อไป
function ManualAdd({ toast, tt }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const submit = async () => {
    setError('');
    const { student_id, national_id } = form;
    if (!student_id || !national_id) {
      setError(tt('importReal.fillAllFields'));
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/students', {
        method: 'POST',
        body: { student_id, national_id },
      });
      toast && toast(tt('importReal.addedToast', { name: student_id }), 'success');
      setForm(EMPTY_FORM);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tt('importReal.addFailMsg'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ padding:0, maxWidth:520, margin:'0 auto', overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 22px',
        borderBottom:'1px solid var(--ink-100)', background:'var(--ink-50)' }}>
        <div style={{ width:38, height:38, borderRadius:10, flex:'none', background:'var(--gold-100)',
          color:'var(--navy-800)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon name="user" size={18} />
        </div>
        <div>
          <div style={{ fontWeight:700, fontSize:16.5, color:'var(--ink-900)' }}>{tt('importReal.addOneTitle')}</div>
          <div style={{ fontSize:14.5, color:'var(--ink-500)' }}>{tt('importReal.addOneSub')}</div>
        </div>
      </div>

      <div style={{ padding:'20px 24px 4px' }}>
        <FormSection title={tt('importReal.sectionStudent')}>
          <div className="field">
            <label>{tt('importReal.fieldStudentId')} <Req /></label>
            <input className="input mono" value={form.student_id} onChange={set('student_id')} placeholder="6610210001" />
          </div>
          <div className="field">
            <label>{tt('importReal.fieldNationalId')} <Req /></label>
            <input className="input mono" value={form.national_id} onChange={set('national_id')} placeholder="1234567890123" />
          </div>
        </FormSection>

        {error && (
          <div role="alert" style={{ display:'flex', gap:9, alignItems:'flex-start', color:'var(--status-reject-fg)',
            background:'var(--status-reject-bg)', borderRadius:9, padding:'10px 13px', fontSize:15, marginBottom:16 }}>
            <Icon name="xCircle" size={16} style={{ flex:'none', marginTop:1 }} />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', alignItems:'center', padding:'14px 24px',
        borderTop:'1px solid var(--ink-100)', background:'var(--ink-50)' }}>
        <span style={{ marginRight:'auto', fontSize:14.5, color:'var(--ink-500)' }}><Req /> {tt('importReal.requiredHint')}</span>
        <button className="btn btn-ghost" onClick={()=>{ setForm(EMPTY_FORM); setError(''); }} disabled={saving}>{tt('importReal.resetBtn')}</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>
          <Icon name="plus" size={16} /> {saving ? tt('importReal.saving') : tt('importReal.addBtn')}
        </button>
      </div>
    </div>
  );
}

const Req = () => <span style={{ color:'var(--status-reject-fg)' }} aria-hidden="true">*</span>;

// หัวข้อกลุ่ม field — ฟอร์มยาว 7 ช่องรวดเดียวอ่านยาก แบ่งเป็นกลุ่มให้กวาดตาเจอเร็วขึ้น
function FormSection({ title, children }) {
  return (
    <div style={{ marginBottom:18 }}>
      <div style={{ fontSize:14, fontWeight:700, letterSpacing:'.04em', textTransform:'uppercase',
        color:'var(--ink-500)', marginBottom:10 }}>{title}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>{children}</div>
    </div>
  );
}
