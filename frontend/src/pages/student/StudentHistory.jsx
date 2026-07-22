/* ============================================================
   นักศึกษา — ประวัติการกรอกผลสอบทุกรอบที่ผ่านมา
   ============================================================ */
import { Icon } from '../../components/Icon.jsx';
import { PageHead, StatusBadge } from '../../components/ui.jsx';

export function StudentHistory({ go }) {
  const rows = [
    { round:'1/2569', date:'5 มิ.ย. 2569', status:'SUBMITTED', passed:7 },
    { round:'2/2568', date:'8 ม.ค. 2569', status:'CONFIRMED', passed:8 },
    { round:'1/2568', date:'6 มิ.ย. 2568', status:'REJECTED', passed:5 },
  ];
  return (
    <div className="fade-up">
      <PageHead title="ประวัติการกรอกผลสอบ" sub="บันทึกการกรอกของคุณทุกรอบที่ผ่านมา" />
      <div className="card" style={{ overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table className="tbl">
            <thead><tr><th>รอบการสอบ</th><th>วันที่กรอก</th><th>ผลสอบ</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={i} className="clickable">
                  <td style={{ fontWeight:700 }}>รอบ {r.round}</td>
                  <td style={{ color:'var(--ink-600)' }}>{r.date}</td>
                  <td><span className="tnum" style={{ fontWeight:700, color: r.passed===8?'var(--pass)':'var(--ink-800)' }}>{r.passed}/8</span> <span style={{ color:'var(--ink-400)', fontSize:13 }}>ผ่าน</span></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ textAlign:'right' }}>
                    <button className="btn btn-ghost btn-sm" disabled={r.status==='CONFIRMED'||r.status==='REJECTED'}
                      onClick={()=>go('form')}><Icon name="edit" size={15}/> แก้ไข</button>{' '}
                    <button className="btn btn-ghost btn-sm"><Icon name="eye" size={15}/> ดู</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
