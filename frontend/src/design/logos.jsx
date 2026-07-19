/* ============================================================
   Brand logo — PSU Nurse emblem
   single-line heart unraveling into a curling tail + bevelled diamond/cross + wordmark
   ============================================================ */

/* PSU Nurse emblem */
export function NurseEmblem({ size = 44, light }) {
  const orange = light ? '#fff' : '#e8791c';
  const shadow = light ? 'rgba(255,255,255,.45)' : '#c9600f';
  const cross = light ? '#e8791c' : '#fff';

  return (
    <svg width={size} height={size*1.1} viewBox="0 0 100 110" style={{ flex:'none' }} aria-label="PSU Nurse">
      {/* heart — single continuous stroke: right lobe → left lobe → curling tail, no fill */}
      <path d="M97 24
               C90 12 77 12 66 29
               C51 11 27 13 15 29
               C3 45 9 63 27 71
               C41 77 47 83 43 91
               C39 98 31 100 26 95"
        fill="none" stroke={orange} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />

      {/* accent — 3D-bevelled diamond, overlapping the right lobe's end so it reads as one piece */}
      <path d="M90 13 L106 28 L90 43 L74 28 Z" fill={shadow} transform="translate(3,3)" />
      <path d="M90 13 L106 28 L90 43 L74 28 Z" fill={orange} />
      {/* plain cross inside the diamond */}
      <rect x="86.5" y="19" width="7" height="18" rx="1.2" fill={cross} />
      <rect x="81" y="24.5" width="18" height="7" rx="1.2" fill={cross} />

      {/* wordmark — stacked, sized to fit the open belly of the heart */}
      <text x="28" y="53" textAnchor="start" fontFamily="'LINE Seed Sans TH', sans-serif"
        fontWeight="800" fontSize="18" fill={orange}>PSU</text>
      <text x="28" y="65" textAnchor="start" fontFamily="'LINE Seed Sans TH', sans-serif"
        fontWeight="700" fontSize="8.5" fill={orange}>Nursing License</text>
    </svg>
  );
}

/* Combined lockup used in topbar / login */
export function Logo({ size = 38, light }) {
  return (
    <div style={{ display:'flex', alignItems:'center' }}>
      <NurseEmblem size={size} light={light} />
    </div>
  );
}
