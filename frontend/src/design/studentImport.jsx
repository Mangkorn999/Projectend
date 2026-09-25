/* ============================================================
   เจ้าหน้าที่ — เพิ่มนักศึกษาเข้าระบบ 2 แบบ: import CSV (ทีละหลายคน) หรือกรอกเองทีละคน
   เรียก POST /api/students/import และ POST /api/students จริง ไม่ใช่ mock
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, Select, Modal, Pagination, Empty } from './components.jsx';
import { usePagedList } from './usePagedList.js';
import { apiFetch, ApiError } from './api.js';
import { t } from './i18n.js';

// BOM = ตัวอักษรล่องหนหัวไฟล์ บอก Excel ว่าไฟล์เป็น UTF-8 (ไม่งั้นภาษาไทยเพี้ยน)
const BOM = '\uFEFF';

export function StudentImport({ toast, lang }) {
  const [tab, setTab] = useState('csv'); // 'csv' | 'manual' | 'pending'
  // จำนวนบัญชีที่นำเข้าแล้วยังไม่เข้าระบบ — โชว์บนแท็บให้เจ้าหน้าที่เห็นตั้งแต่ยังไม่กดเข้าไปดู (null = ยังไม่รู้)
  // แท็บรายชื่อรายงานค่าใหม่กลับมาทุกครั้งที่โหลด/ลบ เลขบนแท็บจึงตรงเสมอ
  const [pendingCount, setPendingCount] = useState(null);
  useEffect(() => { apiFetch('/students/pending-accounts').then(d => setPendingCount(d.length)).catch(() => {}); }, []);
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
          <button onClick={()=>setTab('pending')} style={tabBtnStyle(tab==='pending')}>
            <Icon name="users" size={15}/> {tt('importReal.tabPending')}
            {pendingCount > 0 && <span className="chip" style={{ fontSize: 13, padding: '1px 8px', background: 'var(--gold-100)', color: 'var(--status-wait-fg)', fontWeight: 800 }}>{pendingCount}</span>}
          </button>
        </div>
      </div>
      {tab==='csv' ? <CsvImport toast={toast} tt={tt} />
        : tab==='manual' ? <ManualAdd toast={toast} tt={tt} />
        : <PendingAccounts toast={toast} tt={tt} lang={lang} onCount={setPendingCount} />}
    </div>
  );
}

/* บัญชีที่ import แล้วแต่ "ยังไม่กรอกโปรไฟล์" — ยังไม่มีแถวในตารางนักศึกษา จึงไม่โผล่ในหน้า "ข้อมูลนักศึกษา"
   ไว้ตรวจว่า import ถูกไหม และลบรหัสที่ใส่ผิดได้ (เช่น จาก Google Form) ก่อนที่จะมีใคร login
   คนที่กรอกโปรไฟล์แล้วไปลบที่หน้า "ข้อมูลนักศึกษา" (backend ก็กันไว้: บัญชีที่มีโปรไฟล์แล้วจะไม่ถูกลบจากหน้านี้) */
function PendingAccounts({ toast, tt, lang, onCount }) {
  const [rows, setRows] = useState(null);      // null = กำลังโหลด
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // "ตอนนี้" จับครั้งเดียวตอนเปิดแท็บ — เรียก Date.now() ตรงๆ ระหว่าง render ไม่ได้ (ผลไม่นิ่ง ทุก render ได้ค่าใหม่)
  const [now] = useState(() => Date.now());

  const load = () => apiFetch('/students/pending-accounts')
    .then(data => { setRows(data); onCount && onCount(data.length); setPicked(new Set()); setError(''); })
    .catch(e => setError(e instanceof ApiError ? e.message : tt('importReal.importFailMsg')));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = (rows ?? []).filter(r => r.student_id.includes(q.trim()));
  const pageList = usePagedList(filtered, 15, q);
  const pageIds = pageList.rows.map(r => r.student_id);
  const allOnPage = pageIds.length > 0 && pageIds.every(id => picked.has(id));

  const toggle = (id) => setPicked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const togglePage = () => setPicked(prev => { const n = new Set(prev); pageIds.forEach(id => { if (allOnPage) n.delete(id); else n.add(id); }); return n; });

  const remove = async () => {
    setBusy(true);
    try {
      const data = await apiFetch('/students/pending-accounts/delete', { method: 'POST', body: { student_ids: [...picked] } });
      toast && toast(tt('importReal.pendingDeletedToast', { n: data.deleted_count }), 'info');
      setConfirmOpen(false);
      await load();
    } catch (e) {
      toast && toast(e instanceof ApiError ? e.message : tt('importReal.importFailMsg'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const fmt = (iso) => new Date(iso).toLocaleDateString('th-TH');
  // นำเข้ามากี่วันแล้ว — ยิ่งนานยิ่งควรตามให้เข้ามากรอก (นับวันปฏิทินคร่าวๆ แค่ใช้ประกอบการตาม ไม่ใช่กติกาของระบบ)
  const daysSince = (iso) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86400000));
  const daysText = (iso) => { const d = daysSince(iso); return d === 0 ? tt('importReal.pendingToday') : tt('importReal.pendingDays', { n: d }); };

  // ดาวน์โหลดรายชื่อที่กำลังแสดง (ตามคำค้น) เป็น CSV ไว้เอาไปตามนักศึกษา — บัญชีกลุ่มนี้ยังไม่มีชื่อ/เบอร์ (ยังไม่กรอกโปรไฟล์) มีแค่รหัส
  const downloadList = () => {
    const header = 'student_id,academic_year,imported_at,days_since_import\n';
    const body = filtered.map(r => `${r.student_id},${r.academic_year},${new Date(r.imported_at).toISOString().slice(0, 10)},${daysSince(r.imported_at)}`).join('\n');
    const blob = new Blob([BOM + header + body + '\n'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'students_not_signed_in.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ fontSize: 15, color: 'var(--ink-600)', lineHeight: 1.7, marginBottom: 16 }}>{tt('importReal.pendingHint')}</div>
      {error && <div role="alert" style={{ color:'var(--status-reject-fg)', background:'var(--status-reject-bg)', borderRadius:9, padding:'11px 14px', fontSize:15, marginBottom:14 }}>{error}</div>}

      {rows && rows.length === 0 && !error && <Empty icon="users" title={tt('importReal.pendingEmpty')} sub={tt('importReal.pendingEmptySub')} />}

      {rows && rows.length > 0 && (
        <>
          <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:14 }}>
            <input className="input" style={{ maxWidth: 260 }} placeholder={tt('importReal.pendingSearch')} value={q} onChange={e => setQ(e.target.value)} />
            <span style={{ fontSize: 15, color: 'var(--ink-500)' }}>{tt('importReal.pendingCount', { shown: filtered.length, total: rows.length })}</span>
            <span style={{ flex: 1 }} />
            <button className="btn btn-ghost btn-sm" onClick={downloadList} disabled={filtered.length === 0}>
              <Icon name="download" size={15}/> {tt('importReal.pendingDownloadBtn')}</button>
            {filtered.length > 0 && picked.size < filtered.length && (
              <button className="btn btn-ghost btn-sm" onClick={() => setPicked(new Set(filtered.map(r => r.student_id)))}>{tt('importReal.pendingSelectAll', { n: filtered.length })}</button>
            )}
            {picked.size > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setPicked(new Set())}>{tt('importReal.pendingClear')}</button>}
            <button className="btn" style={{ background: picked.size ? 'var(--fail)' : undefined, color: picked.size ? '#fff' : undefined }}
              disabled={picked.size === 0} onClick={() => setConfirmOpen(true)}>
              <Icon name="trash" size={16}/> {tt('importReal.pendingDeleteBtn', { n: picked.size })}
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead><tr>
                <th style={{ width: 44 }}><input type="checkbox" aria-label={tt('importReal.pendingSelectPage')} checked={allOnPage} onChange={togglePage} /></th>
                <th>{tt('importReal.pendingColId')}</th>
                <th>{tt('importReal.pendingColYear')}</th>
                <th>{tt('importReal.pendingColAt')}</th>
                <th>{tt('importReal.pendingColDays')}</th>
              </tr></thead>
              <tbody>
                {pageList.rows.map(r => (
                  <tr key={r.student_id}>
                    <td><input type="checkbox" aria-label={r.student_id} checked={picked.has(r.student_id)} onChange={() => toggle(r.student_id)} /></td>
                    <td className="mono">{r.student_id}</td>
                    <td>{r.academic_year}{r.year_overridden && <span className="chip" style={{ marginLeft: 8, fontSize: 13 }}>{tt('importReal.pendingYearSet')}</span>}</td>
                    <td style={{ color: 'var(--ink-600)' }}>{fmt(r.imported_at)}</td>
                    <td style={{ color: daysSince(r.imported_at) >= 3 ? 'var(--status-wait-fg)' : 'var(--ink-600)', fontWeight: daysSince(r.imported_at) >= 3 ? 700 : 400 }}>{daysText(r.imported_at)}</td>
                  </tr>
                ))}
                {pageList.rows.length === 0 && <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--ink-500)', padding:24 }}>{tt('importReal.pendingNoMatch')}</td></tr>}
              </tbody>
            </table>
          </div>
          {pageList.pages > 1 && <Pagination page={pageList.page} pages={pageList.pages} onPage={pageList.setPage} lang={lang} />}
        </>
      )}

      <Modal open={confirmOpen} onClose={() => !busy && setConfirmOpen(false)} title={tt('importReal.pendingConfirmTitle')} width={460} tone="danger"
        footer={<><button className="btn btn-ghost" disabled={busy} onClick={() => setConfirmOpen(false)}>{tt('importReal.cancelPreviewBtn')}</button>
          <button className="btn btn-primary" style={{ background:'var(--fail)', borderColor:'var(--fail)' }} disabled={busy} onClick={remove}>
            {busy ? tt('importReal.pendingDeleting') : tt('importReal.pendingConfirmBtn', { n: picked.size })}</button></>}>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7 }}>{tt('importReal.pendingConfirmBody', { n: picked.size })}</p>
      </Modal>
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
  { match: 'ในไฟล์เดียวกัน', labelKey: 'importReal.reasonDupInFile', tone: 'wait' },
  { match: 'ปีการศึกษาที่จบ', labelKey: 'importReal.reasonYear', tone: 'reject' },
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

/* import CSV แบบ 2 ขั้น — กันนำเข้าผิดแล้วต้องมาไล่ลบทีหลัง
     1. "ตรวจไฟล์"      → ส่งไป backend พร้อม ?dry_run=true (ตรวจทุกแถวแต่ยังไม่บันทึก) → โชว์สรุป
     2. "ยืนยันนำเข้า"  → ส่งไฟล์เดิมอีกรอบแบบบันทึกจริง
   ใช้ backend ตรวจทั้งสองรอบ ไม่ได้อ่าน CSV เองในหน้าเว็บ — กฎตรวจ (เลขบัตร/รหัส/ปีจบ/encoding ไทย)
   อยู่ที่ backend ที่เดียว ถ้าเขียนซ้ำฝั่งนี้ สักวันสองที่จะตรวจไม่ตรงกัน */
function CsvImport({ toast, tt }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null); // ผล dry run — มีค่า = อยู่ขั้นรอยืนยัน
  const [result, setResult] = useState(null);   // ผลนำเข้าจริง — มีค่า = นำเข้าเสร็จแล้ว
  const [view, setView] = useState('skipped'); // 'imported' | 'skipped' — ตารางไหนกำลังโชว์อยู่
  const [error, setError] = useState('');
  // ระบบจับคู่ชื่อคอลัมน์ในไฟล์ไม่ได้ (เช่น Google Form ใช้ชื่อคำถามเป็นหัวคอลัมน์) → ให้เจ้าหน้าที่เลือกเองว่าคอลัมน์ไหนคืออะไร
  const [columnPick, setColumnPick] = useState(null); // { columns: [ชื่อคอลัมน์ในไฟล์] } — มีค่า = แสดงช่องเลือก
  const [mapping, setMapping] = useState({});        // { student_id, national_id, academic_year } → ชื่อคอลัมน์ในไฟล์ที่เลือก

  // เปลี่ยนไฟล์ = ผลตรวจเดิมใช้ไม่ได้แล้ว ต้องล้างทิ้งทั้งหมด (รวมคอลัมน์ที่เลือกไว้ด้วย — ไฟล์ใหม่หัวคอลัมน์อาจไม่เหมือนเดิม)
  // ไม่งั้นกด "ยืนยัน" จะนำเข้าไฟล์ใหม่โดยที่ผู้ใช้เห็นสรุปของไฟล์เก่าอยู่
  const pickFile = (f) => { setFile(f); setPreview(null); setResult(null); setError(''); setColumnPick(null); setMapping({}); };

  const downloadTemplate = () => {
    // ไฟล์ตัวอย่างเป็น .xlsx (อยู่ใน public/) ที่ตั้งทุกคอลัมน์เป็น Text ไว้แล้ว — เจ้าหน้าที่พิมพ์เลขบัตร 13 หลักทับได้เลย
    // ไม่ถูกแปลงเป็น 1.23E+12 · แถวตัวอย่างที่ 2 คือคนซ้ำชั้น (รหัส 66 ปกติจบ 2570 แต่จบจริง 2572), academic_year ไม่บังคับ
    const a = document.createElement('a');
    a.href = '/student_import_template.xlsx'; a.download = 'student_import_template.xlsx';
    a.click();
  };

  const downloadSkipped = (data) => {
    const blob = new Blob([BOM + skippedToCsv(data.skipped)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'student_import_skipped.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ส่งไฟล์ไป backend — dryRun=true แค่ตรวจ, false บันทึกจริง
  const send = async (dryRun) => {
    const form = new FormData();
    form.append('file', file);
    // คอลัมน์ที่เจ้าหน้าที่เลือกเอง — ส่งซ้ำทั้งตอนตรวจและตอนยืนยัน ไม่งั้นสองรอบจะอ่านไฟล์คนละแบบ
    if (Object.keys(mapping).length > 0) form.append('mapping', JSON.stringify(mapping));
    // apiFetch ตรวจเจอ FormData แล้วไม่ใส่ Content-Type เอง (browser จัดการ boundary ให้)
    const url = dryRun ? '/students/import?dry_run=true' : '/students/import';
    return apiFetch(url, { method: 'POST', body: form });
  };

  // ขั้นที่ 1: ตรวจไฟล์
  const check = async () => {
    if (!file) { setError(tt('importReal.selectFileFirst')); return; }
    setError(''); setResult(null); setPreview(null); setBusy(true);
    try {
      const data = await send(true);
      setColumnPick(null);
      setPreview(data);
      setView(data.skipped_count > 0 ? 'skipped' : 'imported'); // มีแถวที่ข้ามให้เห็นก่อน
    } catch (e) {
      if (e instanceof ApiError && e.payload?.code === 'missing_columns') {
        // backend เดาคอลัมน์ไม่ได้ → เปิดช่องให้เลือกเอง โดยเติมช่องที่เดาได้แล้วไว้ให้ก่อน (เจ้าหน้าที่แก้เฉพาะช่องที่เหลือ)
        setColumnPick({ columns: e.payload.columns || [] });
        setMapping(Object.fromEntries(Object.entries(e.payload.mapping || {}).filter(([, v]) => v)));
      } else {
        setError(e instanceof ApiError ? e.message : tt('importReal.importFailMsg'));
      }
    } finally {
      setBusy(false);
    }
  };

  // ขั้นที่ 2: ยืนยันนำเข้าจริง
  const confirm = async () => {
    setError(''); setBusy(true);
    try {
      const data = await send(false);
      setPreview(null);
      setResult(data);
      setView(data.skipped_count > 0 ? 'skipped' : 'imported');
      toast && toast(tt('importReal.importedToast', { n: data.imported_count }), data.skipped_count ? 'info' : 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tt('importReal.importFailMsg'));
    } finally {
      setBusy(false);
    }
  };

  // ข้อมูลที่กำลังโชว์ในตารางด้านล่าง — ผลตรวจ (ยังไม่บันทึก) หรือผลนำเข้าจริง อย่างใดอย่างหนึ่ง
  const shown = preview || result;

  return (
    <>
      <div className="card" style={{ padding:22, marginBottom:18 }}>
        <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:16,
          background:'var(--blue-50)', border:'1px solid var(--blue-100)', borderRadius:12, padding:14 }}>
          <Icon name="info" size={17} style={{ color:'var(--blue-600)', flex:'none', marginTop:1 }} />
          <div style={{ fontSize:15, color:'var(--ink-700)', lineHeight:1.7 }}>
            {tt('importReal.csvColumnsNote').replace('{cols}', '')}<span className="mono" style={{ fontSize:14 }}>student_id, national_id</span><br/>
            {tt('importReal.yearColumnNote')}<br/>
            {tt('importReal.noPasswordNote')}<br/>
            <b>{tt('importReal.excelNote')}</b><br/>
            {tt('importReal.anyNameNote')}
          </div>
        </div>
        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <button className="btn btn-ghost" onClick={downloadTemplate}><Icon name="download" size={16}/> {tt('importReal.downloadTemplateBtn')}</button>
          {file ? (
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'8px 8px 8px 14px',
              borderRadius:9, border:'1px solid var(--ink-200)', fontSize:15.5 }}>
              <Icon name="doc" size={15} style={{ color:'var(--ink-500)', flex:'none' }} />
              <span style={{ maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.name}</span>
              <button type="button" aria-label={tt('importReal.removeFileLabel')} onClick={()=>pickFile(null)} disabled={busy}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', width:22, height:22, border:'none',
                  borderRadius:'50%', background:'var(--ink-100)', color:'var(--ink-500)', cursor:'pointer', flex:'none' }}>
                <Icon name="x" size={13}/>
              </button>
            </div>
          ) : (
            <label className="btn btn-ghost" style={{ cursor:'pointer' }}>
              <Icon name="upload" size={16}/> {tt('importReal.chooseCsvBtn')}
              <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display:'none' }}
                onChange={e=>pickFile(e.target.files?.[0]||null)} />
            </label>
          )}
          {/* ยังไม่ตรวจ → ปุ่ม "ตรวจไฟล์" · ตรวจแล้ว → ปุ่ม "ยืนยันนำเข้า N คน" + "ยกเลิก" */}
          {preview ? (
            <>
              <button className="btn btn-ghost" onClick={()=>setPreview(null)} disabled={busy}>{tt('importReal.cancelPreviewBtn')}</button>
              <button className="btn btn-primary" onClick={confirm} disabled={busy || preview.imported_count === 0}>
                <Icon name="checkCircle" size={16}/> {busy ? tt('importReal.importing') : tt('importReal.confirmBtn', { n: preview.imported_count })}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={check} disabled={busy || !file}>
              {busy ? tt('importReal.checking') : tt('importReal.checkBtn')}
            </button>
          )}
        </div>
        {columnPick && (
          <div style={{ marginTop:14, padding:16, borderRadius:12, background:'var(--status-wait-bg)', border:'1px solid var(--gold-100)' }}>
            <div style={{ fontSize:16.5, fontWeight:800, color:'var(--status-wait-fg)', marginBottom:4 }}>{tt('importReal.mapTitle')}</div>
            <div style={{ fontSize:15, color:'var(--ink-700)', marginBottom:14, lineHeight:1.6 }}>{tt('importReal.mapHint')}</div>
            <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:14 }}>
              {[
                ['student_id', 'importReal.mapStudentId', false],
                ['national_id', 'importReal.mapNationalId', false],
                ['academic_year', 'importReal.mapYear', true],
              ].map(([field, labelKey, optional]) => (
                <div key={field} className="field" style={{ flex:'1 1 220px', minWidth:200 }}>
                  <label>{tt(labelKey)}</label>
                  <Select value={mapping[field] ?? ''} onChange={v => setMapping(m => ({ ...m, [field]: v }))}
                    options={[{ value:'', label: optional ? tt('importReal.mapNone') : tt('importReal.mapChoose') },
                      ...columnPick.columns.map(c => ({ value:c, label:c }))]} />
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={check} disabled={busy || !mapping.student_id || !mapping.national_id}>
              {busy ? tt('importReal.checking') : tt('importReal.mapRecheckBtn')}
            </button>
          </div>
        )}
        {error && (
          <div role="alert" style={{ display:'flex', gap:10, alignItems:'flex-start', color:'var(--status-reject-fg)',
            background:'var(--status-reject-bg)', borderRadius:9, padding:'11px 14px', fontSize:15, marginTop:14 }}>
            <Icon name="xCircle" size={16} style={{ flex:'none', marginTop:1 }} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {shown && (
        <div aria-live="polite" className="fade-up">
          <ResultBanner result={shown} isPreview={!!preview} tt={tt} />

          {/* บอกว่าระบบอ่านคอลัมน์ไหนของไฟล์ไปใช้ — ให้เจ้าหน้าที่เห็นก่อนยืนยัน กันจับคู่ผิดเงียบๆ */}
          {shown.columns_used && (
            <div style={{ fontSize:14, color:'var(--ink-500)', margin:'-6px 2px 14px', lineHeight:1.6 }}>
              {tt('importReal.columnsUsed')}: {tt('importReal.mapStudentId').replace(' *','')} ← <b>{shown.columns_used.student_id}</b> · {tt('importReal.mapNationalId').replace(' *','')} ← <b>{shown.columns_used.national_id}</b> · {tt('importReal.mapYear').replace(/ \(.*\)/,'')} ← <b>{shown.columns_used.academic_year || tt('importReal.mapNone')}</b>
            </div>
          )}

          {/* คนที่ใส่ปีจบไม่ตรงกับรหัส — ต้องเห็นก่อนยืนยัน เพราะเป็นตัวตัดสินว่านักศึกษาจะเห็นรอบสอบไหน */}
          {shown.year_overrides?.length > 0 && <OverridesCard rows={shown.year_overrides} tt={tt} />}

          <div className="card" style={{ overflow:'hidden' }}>
            <div style={{ padding:'18px 20px', display:'flex', gap:10, borderBottom:'1px solid var(--ink-100)', flexWrap:'wrap' }}>
              <StatToggle
                active={view==='imported'} onClick={()=>setView('imported')}
                icon="checkCircle" tone="pass" count={shown.imported_count}
                label={preview ? tt('importReal.willImportLabel') : tt('importReal.importedSuccessLabel')}
                disabled={shown.imported_count===0} tt={tt}
              />
              <StatToggle
                active={view==='skipped'} onClick={()=>setView('skipped')}
                icon="alert" tone="fail" count={shown.skipped_count}
                label={preview ? tt('importReal.willSkipLabel') : tt('importReal.skippedLabel')}
                disabled={shown.skipped_count===0} tt={tt}
              />
              {shown.skipped_count > 0 && (
                <button className="btn btn-ghost" style={{ marginLeft:'auto', alignSelf:'center' }} onClick={()=>downloadSkipped(shown)}>
                  <Icon name="download" size={15}/> {tt('importReal.downloadSkippedBtn')}
                </button>
              )}
            </div>

            {view === 'imported' && (
              shown.imported.length > 0 ? (
                <table className="tbl">
                  <thead><tr><th>{tt('importReal.colOrder')}</th><th>{tt('importReal.colStudentId')}</th><th>{tt('importReal.colStatus')}</th></tr></thead>
                  <tbody>
                    {shown.imported.map((studentId,i)=>(
                      <tr key={i}>
                        <td className="tnum">{i+1}</td>
                        <td className="mono">{studentId}</td>
                        <td>{preview
                          ? <span className="badge wait"><span className="dot" />{tt('importReal.willEnter')}</span>
                          : <span className="badge ok"><span className="dot" />{tt('importReal.enteredSystem')}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyRows text={tt('importReal.noImportedRows')} />
              )
            )}

            {view === 'skipped' && (
              shown.skipped.length > 0 ? (
                <table className="tbl">
                  <thead><tr><th>{tt('importReal.colRow')}</th><th>{tt('importReal.colStudentId')}</th><th>{tt('importReal.colType')}</th><th>{tt('importReal.colReason')}</th></tr></thead>
                  <tbody>
                    {shown.skipped.map((s,i)=>{
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

// ตารางคนที่ปีจบไม่ตรงกับรหัส (เคสซ้ำชั้น/ลาพัก) — โชว์ปีตามรหัสเทียบกับปีที่จะใช้จริง
function OverridesCard({ rows, tt }) {
  return (
    <div className="card" style={{ overflow:'hidden', marginBottom:14, borderColor:'var(--status-wait-dot)' }}>
      <div style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'14px 18px',
        background:'var(--status-wait-bg)', color:'var(--status-wait-fg)' }}>
        <Icon name="alert" size={18} style={{ flex:'none', marginTop:1 }} />
        <div>
          <div style={{ fontWeight:700, fontSize:15.5 }}>{tt('importReal.overrideTitle', { n: rows.length })}</div>
          <div style={{ fontSize:14.5, marginTop:2 }}>{tt('importReal.overrideSub')}</div>
        </div>
      </div>
      <table className="tbl">
        <thead><tr><th>{tt('importReal.colRow')}</th><th>{tt('importReal.colStudentId')}</th>
          <th>{tt('importReal.colDerived')}</th><th>{tt('importReal.colYearUsed')}</th></tr></thead>
        <tbody>
          {rows.map(o => (
            <tr key={o.student_id}>
              <td className="tnum">{o.row}</td>
              <td className="mono">{o.student_id}</td>
              <td className="tnum" style={{ color:'var(--ink-500)' }}>{o.derived}</td>
              <td className="tnum" style={{ fontWeight:700 }}>{o.academic_year}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
// isPreview = เป็นผลตรวจ (dry run) ยังไม่ได้บันทึก — ข้อความต้องบอกชัดว่ายังไม่ได้นำเข้า
function ResultBanner({ result, isPreview, tt }) {
  const { imported_count, skipped_count } = result;
  let tone, icon, message;
  if (isPreview) {
    if (imported_count === 0) {
      tone = 'reject'; icon = 'xCircle';
      message = tt('importReal.previewNone', { n: skipped_count });
    } else if (skipped_count > 0) {
      tone = 'wait'; icon = 'alert';
      message = tt('importReal.previewPartial', { imported: imported_count, skipped: skipped_count });
    } else {
      tone = 'ok'; icon = 'info';
      message = tt('importReal.previewAllOk', { n: imported_count });
    }
  } else if (imported_count === 0 && skipped_count > 0) {
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

const EMPTY_FORM = { student_id:'', national_id:'', academic_year:'' };

// เพิ่มทีละคน — สร้างแค่ user (student_id + เลขบัตร ปชช = password) + ปีจบถ้าซ้ำชั้น/ลาพัก (ไม่บังคับ)
// ชื่อ/ห้อง นักศึกษากรอกเองตอน login ครั้งแรก (complete-profile)
function ManualAdd({ toast, tt }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const submit = async () => {
    setError('');
    const { student_id, national_id, academic_year } = form;
    if (!student_id || !national_id) {
      setError(tt('importReal.fillAllFields'));
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/students', {
        method: 'POST',
        // ส่งปีเฉพาะตอนกรอกมา — เว้นว่างไม่ต้องส่ง ให้ backend คำนวณจากรหัสเอง
        body: academic_year.trim() ? { student_id, national_id, academic_year } : { student_id, national_id },
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
          <div className="field">
            <label>{tt('importReal.fieldYear')} <span style={{ fontWeight:400, color:'var(--ink-500)' }}>({tt('importReal.fieldYearOptional')})</span></label>
            {/* กรองเอาแต่ตัวเลขก่อน ค่อยตัดเหลือ 4 หลัก — ห้ามใช้ maxLength เพราะ browser ตัดข้อความ "ก่อน" กรอง
                (วาง "พ.ศ. 2572" จะเหลือ "พ.ศ." แล้วกรองทิ้งหมดกลายเป็นช่องว่าง) */}
            <input className="input tnum" inputMode="numeric" value={form.academic_year}
              onChange={e => setForm(f => ({ ...f, academic_year: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) }))} />
            <span className="hint">{tt('importReal.fieldYearHint')}</span>
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
