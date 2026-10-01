/* ============================================================
   หน้าต่างรายชื่อนักศึกษาที่ "ผ่าน" หรือ "ไม่ผ่าน" รายวิชาหนึ่งวิชา (เจ้าหน้าที่คณะเท่านั้น)
   ใช้ร่วมกัน 2 หน้า: แดชบอร์ด (การ์ดอัตราผ่านรายวิชา) และรายงานสรุป (ตารางรายวิชา)
   จึงเขียน logic ไว้ที่เดียว ไม่ซ้ำกัน

   ข้อมูลมาจาก GET /api/students/subject-result-list (backend นับเฉพาะใบที่ยืนยันแล้ว กฎเดียวกับตัวเลขบนการ์ด)
   ปุ่ม "ส่งออก" ในหน้าต่างโหลด Excel/PDF จาก GET /api/students/export-subject (query ชุดเดียวกัน)

   วิธีใช้ — ให้หน้าที่เรียกเก็บ target ไว้ใน state แล้วแสดง component นี้เฉพาะตอนมี target:
     const [subjectTarget, setSubjectTarget] = useState(null);
     setSubjectTarget({ subjectCode: '1101', subjectName: 'การผดุงครรภ์', passed: true });
     {subjectTarget && <SubjectResultModal target={subjectTarget} scope={{ roundId: 7 }}
        onClose={() => setSubjectTarget(null)} lang={lang} tt={tt} toast={toast} />}
   scope = { roundId } ดูรอบเดียว  หรือ  { year } ดู "รวมทั้งปีการศึกษา"
   ============================================================ */
import { useState, useEffect } from 'react';
import { Modal, Empty, ExportMenu } from './components.jsx';
import { apiFetch, downloadFile } from './api.js';
import { subjectName, roomName } from './i18n.js';

// ต่อ query ของขอบเขตที่ดู: รอบเดียว (round_id) หรือทั้งปี (year) — backend ต้องการอย่างใดอย่างหนึ่ง
function scopeQuery(scope) {
  if (scope.roundId) {
    return `round_id=${scope.roundId}`;
  }
  return `year=${scope.year}`;
}

export function SubjectResultModal({ target, scope, onClose, lang, tt, toast }) {
  const [data, setData] = useState(null);   // ผลจาก backend (null = กำลังโหลด)
  const [error, setError] = useState('');   // ข้อความ error ภาษาไทย (ว่าง = ไม่มี error)

  const query = `subject_code=${target.subjectCode}&passed=${target.passed}&${scopeQuery(scope)}`;

  // เปิดหน้าต่างทีไร ดึงรายชื่อใหม่ทุกครั้ง (กันเห็นข้อมูลของวิชา/รอบก่อนหน้าค้างอยู่)
  useEffect(() => {
    let dropped = false; // ปิดหน้าต่างก่อนโหลดเสร็จ = ทิ้งผลที่มาทีหลัง
    apiFetch(`/students/subject-result-list?${query}`)
      .then((result) => {
        if (!dropped) {
          setData(result);
        }
      })
      .catch((e) => {
        if (!dropped) {
          setError(e.message);
        }
      });
    return () => {
      dropped = true;
    };
  }, [query]);

  // รายการในปุ่ม "ส่งออก": PDF และ Excel
  const exportItems = [];
  for (const format of ['pdf', 'xlsx']) {
    let label = tt('export.pdf');
    let icon = 'pdf';
    if (format === 'xlsx') {
      label = tt('export.excel');
      icon = 'report';
    }
    let resultWord = 'ไม่ผ่าน';
    if (target.passed) {
      resultWord = 'ผ่าน';
    }
    exportItems.push({
      key: format,
      label,
      icon,
      run: () => downloadFile(`/students/export-subject?${query}&format=${format}`, {
        filename: `รายชื่อ-${resultWord}-${target.subjectCode}.${format}`,
      }),
    });
  }

  let titleKey = 'reportsReal.subjectModalTitleFail';
  if (target.passed) {
    titleKey = 'reportsReal.subjectModalTitlePass';
  }
  const subjectLabel = `${target.subjectCode} ${subjectName(lang, target.subjectCode, target.subjectName)}`;
  const hasStudents = data !== null && data.students.length > 0;

  return (
    <Modal open onClose={onClose} title={tt(titleKey, { subject: subjectLabel })} width={640}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>{tt('common.close')}</button>
        {hasStudents && <ExportMenu up items={exportItems} tt={tt} onError={(msg) => toast?.(msg, 'error')} />}
      </>}>
      {error && <div style={{ color: 'var(--reject,#dc2626)', padding: '10px 0' }}>{error}</div>}
      {!error && data === null && (
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink-500)' }}>{tt('common.loading')}</div>
      )}
      {data !== null && !hasStudents && <Empty icon="users" title={tt('reportsReal.subjectModalEmpty')} />}
      {hasStudents && (
        <>
          <div style={{ fontSize: 15, color: 'var(--ink-600)', marginBottom: 10 }}>
            {tt('reportsReal.subjectModalCount', { n: data.students.length })} · {data.scope_label}
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--ink-200)', borderRadius: 10 }}>
            <table className="tbl">
              <thead>
                <tr><th>{tt('officer.students.colStudent')}</th><th>{tt('officer.students.colRoom')}</th></tr>
              </thead>
              <tbody>
                {data.students.map((student) => (
                  <tr key={student.student_id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{student.first_name} {student.last_name}</div>
                      <div className="mono" style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>{student.student_id}</div>
                    </td>
                    <td>{roomName(lang, student.room_name)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
