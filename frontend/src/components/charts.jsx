/* ============================================================
   กราฟ — เขียนเป็น SVG เอง ไม่ใช้ library ภายนอก
   ============================================================ */

/* ---- โดนัท (สัดส่วน) ---- */
export function Donut({ segments, size=180, thickness=26, center }) {
  const total = segments.reduce((a,s)=>a+s.value,0) || 1;
  const R = (size-thickness)/2; const C = 2*Math.PI*R; let off = 0;
  return (
    <div style={{ position:'relative', width:size, height:size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="var(--ink-100)" strokeWidth={thickness} />
        {segments.map((s,i)=>{
          const len = s.value/total*C;
          const el = <circle key={i} cx={size/2} cy={size/2} r={R} fill="none" stroke={s.color}
            strokeWidth={thickness} strokeDasharray={`${len} ${C-len}`} strokeDashoffset={-off}
            strokeLinecap="butt" style={{ transition:'stroke-dasharray .6s' }} />;
          off += len; return el;
        })}
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', textAlign:'center' }}>
        {center}
      </div>
    </div>
  );
}

/* ---- แถบแนวนอน 1 แถว (ใช้กับอัตราผ่านรายวิชา) ---- */
export function BarRow({ label, value, max=100, color='var(--navy-600)', right, sub }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:10 }}>
        <span style={{ fontSize:13.5, color:'var(--ink-700)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>
        <span className="tnum" style={{ fontSize:13.5, fontWeight:700, color:'var(--ink-900)', flex:'none' }}>{right}</span>
      </div>
      <div className="pbar" style={{ height:9 }}>
        <i style={{ width:(value/max*100)+'%', background:color }}></i>
      </div>
      {sub && <div style={{ fontSize:11.5, color:'var(--ink-400)' }}>{sub}</div>}
    </div>
  );
}

/* ---- กราฟแท่งแนวตั้ง ---- */
export function ColumnChart({ data, height=160, color='var(--navy-600)', fmt=(v)=>v }) {
  const max = Math.max(...data.map(d=>d.value), 1);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:14, height, padding:'0 4px' }}>
      {data.map((d,i)=>(
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:8, height:'100%', justifyContent:'flex-end' }}>
          <div className="tnum" style={{ fontSize:13, fontWeight:700, color:'var(--ink-800)' }}>{fmt(d.value)}</div>
          <div style={{ width:'100%', maxWidth:54, borderRadius:'8px 8px 0 0', background:d.color||color,
            height:(d.value/max*100)+'%', minHeight:6, transition:'height .6s cubic-bezier(.4,0,.2,1)' }}></div>
          <div style={{ fontSize:12, color:'var(--ink-500)', fontWeight:500, textAlign:'center' }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ---- กราฟเส้นหลายชุด (เทียบข้ามปี) ---- */
export function MultiLineChart({ series, categories, height=180, suffix='%', yMin=0, yMax=100 }) {
  const w=340, padL=10, padR=10, padT=24, padB=26;
  const n = categories.length;
  const xs = i => padL + (n===1?0:i*(w-padL-padR)/(n-1));
  const ys = v => padT + (1-(v-yMin)/(yMax-yMin))*(height-padT-padB);
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ overflow:'visible' }}>
        {[0,25,50,75,100].map(g=>(<line key={g} x1={padL} x2={w-padR} y1={ys(g)} y2={ys(g)} stroke="var(--ink-100)" strokeWidth="1" />))}
        {series.map((s,si)=>{
          const path = s.values.map((v,i)=>`${i?'L':'M'}${xs(i)},${ys(v)}`).join(' ');
          return <g key={si}>
            <path d={path} fill="none" stroke={s.color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            {s.values.map((v,i)=>(<g key={i}>
              <circle cx={xs(i)} cy={ys(v)} r="4.5" fill="#fff" stroke={s.color} strokeWidth="2.6" />
              <text x={xs(i)} y={ys(v)-11} textAnchor="middle" fontSize="6" fontWeight="700" fill={s.color} fontFamily="'LINE Seed Sans TH', sans-serif">{v}{suffix}</text>
            </g>))}
          </g>;
        })}
        {categories.map((c,i)=>(<text key={i} x={xs(i)} y={height-7} textAnchor="middle" fontSize="9" fill="var(--ink-500)" fontFamily="'LINE Seed Sans TH', sans-serif">{c}</text>))}
      </svg>
      <div style={{ display:'flex', gap:18, justifyContent:'center', marginTop:8 }}>
        {series.map((s,i)=>(<div key={i} style={{ display:'flex', alignItems:'center', gap:7, fontSize:12.5, color:'var(--ink-600)' }}>
          <span style={{ width:14, height:3, borderRadius:2, background:s.color }}></span>{s.label}</div>))}
      </div>
    </div>
  );
}
