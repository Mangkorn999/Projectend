/* ============================================================
   โครงร่างตอนกำลังโหลด (skeleton)
   ใช้แทน <div>กำลังโหลด…</div> กลางจอ

   หลักคิด: วาดโครงให้ "หน้าตาใกล้เคียงของจริง" ที่กำลังจะมา
   พอข้อมูลมาถึงจะไปแทนที่ในตำแหน่งเดิม หน้าไม่กระโดด
   ============================================================ */

/* กล่องเทาอันเดียว — ใช้ประกอบเป็นโครงอื่นๆ */
export function SkeletonBox({ w = '100%', h = 16, r = 8, style }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/* โครงตาราง — rows แถว, cols คอลัมน์
   คอลัมน์แรกกว้างกว่าเพื่อน เพราะตารางในระบบนี้ขึ้นต้นด้วยชื่อคนเสมอ */
export function SkeletonTable({ rows = 8, cols = 4 }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }} aria-busy="true" aria-live="polite">
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--ink-100)', display: 'flex', gap: 16 }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBox key={i} w={i === 0 ? '30%' : '16%'} h={13} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ padding: '15px 18px', borderBottom: '1px solid var(--ink-100)',
          display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, width: '30%' }}>
            <SkeletonBox w={34} h={34} r={999} style={{ flex: 'none' }} />
            <SkeletonBox w="70%" h={14} />
          </div>
          {Array.from({ length: cols - 1 }).map((_, c) => (
            <SkeletonBox key={c} w="16%" h={14} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* โครงการ์ดเรียงเป็นตาราง — ใช้กับหน้ารอบการกรอก */
export function SkeletonCards({ count = 6 }) {
  return (
    <div className="grid g-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card card-pad">
          <SkeletonBox w={92} h={22} r={999} />
          <SkeletonBox w="65%" h={22} style={{ marginTop: 14 }} />
          <SkeletonBox w="45%" h={13} style={{ marginTop: 8 }} />
          <div className="hr" style={{ margin: '14px 0' }} />
          <SkeletonBox h={13} style={{ marginBottom: 9 }} />
          <SkeletonBox w="80%" h={13} />
        </div>
      ))}
    </div>
  );
}

/* โครงรายการแบบการ์ดเรียงลง — ใช้กับหน้าข่าวสาร */
export function SkeletonList({ count = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ padding: '18px 22px', display: 'flex', gap: 15, alignItems: 'flex-start' }}>
          <SkeletonBox w={44} h={44} r={12} style={{ flex: 'none' }} />
          <div style={{ flex: 1 }}>
            <SkeletonBox w="55%" h={17} />
            <SkeletonBox w="35%" h={13} style={{ marginTop: 9 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* โครงหน้า dashboard — แถวตัวเลข 4-5 ใบ แล้วตามด้วยการ์ดกราฟใหญ่ */
export function SkeletonDashboard() {
  return (
    <div aria-busy="true" aria-live="polite">
      <SkeletonBox w={240} h={30} />
      <SkeletonBox w={380} h={15} style={{ marginTop: 10 }} />
      <div className="grid g-4" style={{ marginTop: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card card-pad">
            <SkeletonBox w="60%" h={14} />
            <SkeletonBox w={72} h={34} style={{ marginTop: 12 }} />
            <SkeletonBox w="80%" h={12} style={{ marginTop: 12 }} />
          </div>
        ))}
      </div>
      <div className="card card-pad" style={{ marginTop: 18 }}>
        <SkeletonBox w={200} h={19} />
        <div style={{ display: 'flex', gap: 24, marginTop: 20, alignItems: 'center' }}>
          <SkeletonBox w={150} h={150} r={999} style={{ flex: 'none' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Array.from({ length: 4 }).map((_, i) => <SkeletonBox key={i} h={14} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
