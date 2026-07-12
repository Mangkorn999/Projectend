/* ============================================================
   Brand logos — original placeholder emblems
   PSU university seal + Faculty of Nursing lamp emblem
   (clean geometric marks; swap for official art when available)
   ============================================================ */

/* PSU university seal — navy disc, gold ring, lamp of wisdom + ม.อ. monogram */
function PSUSeal({ size = 44, light }) {
  const ring = light ? 'rgba(255,255,255,.9)' : '#d4a017';
  const disc = light ? 'rgba(255,255,255,.14)' : '#15366b';
  const fg = light ? '#fff' : '#fff';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flex:'none' }} aria-label="PSU">
      <circle cx="50" cy="50" r="48" fill={disc} stroke={ring} strokeWidth="2.5" />
      <circle cx="50" cy="50" r="40" fill="none" stroke={ring} strokeWidth="1.2" opacity=".7" />
      {/* lamp of wisdom */}
      <g fill="#d4a017">
        {/* flame */}
        <path d="M50 22 C55 30 53 34 50 38 C47 34 45 30 50 22Z" />
        {/* lamp bowl */}
        <path d="M34 50 Q50 43 66 50 Q62 60 50 60 Q38 60 34 50Z" />
        {/* spout */}
        <path d="M30 47 L37 50 L34 55Z" />
        {/* base */}
        <rect x="42" y="61" width="16" height="3.4" rx="1.7" />
      </g>
      {/* monogram */}
      <text x="50" y="82" textAnchor="middle" fontFamily="Sarabun, sans-serif" fontWeight="800" fontSize="16" fill={fg} letterSpacing="1">ม.อ.</text>
    </svg>
  );
}

/* Faculty of Nursing emblem — rounded teal-navy badge, heart + cross of care */
function NurseEmblem({ size = 44, light }) {
  const bg = light ? 'rgba(255,255,255,.14)' : '#0d7a6e';
  const ring = light ? 'rgba(255,255,255,.9)' : '#0a5f56';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flex:'none' }} aria-label="Faculty of Nursing">
      <rect x="5" y="5" width="90" height="90" rx="26" fill={bg} stroke={ring} strokeWidth="2.5" />
      <rect x="13" y="13" width="74" height="74" rx="20" fill="none" stroke="#fff" strokeWidth="1.1" opacity=".28" />
      {/* heart of care */}
      <path d="M50 73 C33 61 26 50 33 41 C38 35 46 36 50 43 C54 36 62 35 67 41 C74 50 67 61 50 73Z" fill="#fff" />
      {/* cross */}
      <g fill={bg}>
        <rect x="46" y="45" width="8" height="18" rx="1.8" />
        <rect x="41" y="50" width="18" height="8" rx="1.8" />
      </g>
      {/* small flame accent above */}
      <path d="M50 20 C54 26 52.5 29 50 32 C47.5 29 46 26 50 20Z" fill="#d4a017" />
    </svg>
  );
}

/* Combined lockup used in topbar / login */
function Logo({ size = 38, light }) {
  return (
    <div style={{ display:'flex', alignItems:'center' }}>
      <PSUSeal size={size} light={light} />
      <div style={{ marginLeft:-Math.round(size*0.22) }}><NurseEmblem size={size} light={light} /></div>
    </div>
  );
}

Object.assign(window, { PSUSeal, NurseEmblem, Logo });
