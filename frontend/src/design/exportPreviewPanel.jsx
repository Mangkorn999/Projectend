/* ============================================================
   เนื้อในป๊อปอัพ "ตัวอย่างไฟล์ส่งออก" — กดปุ่ม "ดูตัวอย่าง" ในแผง "ส่งออกข้อมูล" ของหน้ารายงานสรุปแล้วเด้งขึ้นมา
   (เจ้าหน้าที่ดูข้อมูลได้โดยไม่ต้องดาวน์โหลดไฟล์ — ปุ่มส่งออกอยู่ท้ายป๊อปอัพและในแผงตามเดิม)

   แสดงเป็นตารางหน้าตาแบบ Excel (มีแท็บชีตถ้ามีหลายชีต) ไม่ว่าไฟล์ที่จะโหลดเป็น Excel หรือ PDF
   ข้อมูลคือชุดเดียวกับที่ใส่ลงไฟล์ — backend ส่งให้เองที่ format=json / preview:true ไม่ได้คำนวณใหม่ฝั่งหน้าจอ
   spec = { kind: 'first-attempt' | 'first-year' | 'students', year, passed? }
   ============================================================ */
import { useState, useEffect } from 'react';
import { apiFetch } from './api.js';
import { Loading } from './components.jsx';
import { t } from './i18n.js';

const loadSheets = async ({ kind, year, passed }) => {
  if (kind === 'students') {
    // ข้อมูลนักศึกษาทั้งรุ่นแยกรอบ = ไฟล์เดียวกับปุ่มส่งออก (ชีตแรกข้อมูลนักศึกษา + 1 ชีตต่อรอบ)
    return apiFetch('/students/export', { method: 'POST', body: { year, by_round: true, preview: true } });
  }
  const route = kind === 'first-year' ? 'export-first-year' : 'export-first-attempt';
  return apiFetch(`/dashboard/${route}?year=${year}&passed=${passed}&format=json`);
};

export function ExportPreviewPanel({ spec, lang }) {
  const tt = (key, vars) => t(lang, key, vars);
  const [loaded, setLoaded] = useState({ status: 'loading' }); // loading | table | error
  const [sheetIdx, setSheetIdx] = useState(0);

  // ผู้เรียกใส่ key ใหม่ทุกครั้งที่เปิดป๊อปอัพ จึงโหลดข้อมูลสดครั้งเดียวต่อการเปิด
  useEffect(() => {
    let dropped = false;
    loadSheets(spec)
      .then(data => { if (!dropped) setLoaded({ status: 'table', sheets: data.sheets }); })
      .catch(e => { if (!dropped) setLoaded({ status: 'error', message: e.message || tt('export.previewFailed') }); });
    return () => { dropped = true; };
    // spec ไม่เปลี่ยนตลอดอายุของแผง · tt อ่านจาก lang ตอนเกิด error เท่านั้น
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sheet = loaded.status === 'table' ? (loaded.sheets[sheetIdx] || loaded.sheets[0]) : null;

  return (
    <div>
      {loaded.status === 'loading' && <Loading label={tt('common.loading')} />}

      {loaded.status === 'error' && (
        <div style={{ color: 'var(--reject,#dc2626)', fontSize: 15 }}>{tt('export.previewFailed')} — {loaded.message}</div>
      )}

      {sheet && (
        <>
          {/* แท็บชีต เหมือนแท็บล่างของ Excel — แสดงเฉพาะเมื่อมีมากกว่า 1 ชีต */}
          {loaded.sheets.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {loaded.sheets.map((sh, i) => (
                <button key={sh.sheet_name} className={'btn btn-sm ' + (sh === sheet ? 'btn-primary' : 'btn-ghost')}
                  onClick={() => setSheetIdx(i)}>{sh.sheet_name}</button>
              ))}
            </div>
          )}
          <div style={{ overflow: 'auto', maxHeight: 'calc(90vh - 300px)', minHeight: 200, border: '1px solid var(--ink-200)', borderRadius: 8 }}>
            <table className="tbl" style={{ whiteSpace: 'nowrap' }}>
              {/* หัวตารางตรึงไว้ตอนเลื่อนลง — ดูหลายสิบแถวแล้วยังรู้ว่าคอลัมน์ไหนคืออะไร */}
              <thead><tr>{sheet.columns.map(c => (
                <th key={c.key} style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--ink-50)' }}>{c.header}</th>
              ))}</tr></thead>
              <tbody>{sheet.rows.map((r, i) => (
                <tr key={i}>{sheet.columns.map(c => <td key={c.key}>{r[c.key] ?? ''}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, fontSize: 14, color: 'var(--ink-500)' }}>
            {tt('export.previewShowing', { n: sheet.rows.length, total: sheet.total })}
          </div>
        </>
      )}
    </div>
  );
}
