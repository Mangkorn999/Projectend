/* ============================================================
   Mock data + shared helpers
   ============================================================ */

/* ---- Icon set (inline SVG, 24x24 stroke) ---- */
export const ICONS = {
  home:'M3 11.5 12 4l9 7.5M5 10v10h5v-6h4v6h5V10',
  news:'M4 5h16v14H4zM8 9h8M8 13h8M8 17h5',
  doc:'M6 3h8l4 4v14H6zM14 3v4h4',
  upload:'M12 16V5M8 9l4-4 4 4M5 19h14',
  clock:'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  history:'M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 8v4l3 2',
  check:'M20 6 9 17l-5-5',
  checkCircle:'M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  x:'M18 6 6 18M6 6l12 12',
  xCircle:'M15 9l-6 6M9 9l6 6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  grid:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  users:'M16 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM22 19v-2a4 4 0 0 0-3-3.8M16 2.2A4 4 0 0 1 16 9.8',
  user:'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  book:'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM19 3v18',
  calendar:'M8 2v4M16 2v4M3 9h18M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  chart:'M3 3v18h18M7 15l3-4 3 2 4-6',
  bars:'M5 21V10M12 21V4M19 21v-7',
  report:'M9 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5ZM14 3v5h5M9 13h6M9 17h6',
  search:'M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z',
  bell:'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  logout:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  chevR:'M9 18l6-6-6-6',
  chevL:'M15 18l-6-6 6-6',
  chevD:'M6 9l6 6 6-6',
  plus:'M12 5v14M5 12h14',
  edit:'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
  trash:'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6',
  download:'M12 3v12M8 11l4 4 4-4M5 21h14',
  filter:'M3 5h18l-7 8v6l-4-2v-4z',
  eye:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  pdf:'M6 3h8l4 4v14H6zM14 3v4h4M9 13h1.5a1.5 1.5 0 0 1 0 3H9zM9 13v6M14 13h2M14 13v6M14 16h1.6',
  send:'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
  alert:'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  info:'M12 16v-4M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  shield:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
  key:'M21 2l-2 2m-7.6 7.6a5 5 0 1 0-1.4 1.4l2-2 2 2 2-2 2 2 2.6-2.6-3.2-3.2Z',
  menu:'M3 6h18M3 12h18M3 18h18',
  arrowR:'M5 12h14M13 6l6 6-6 6',
  graduation:'M22 10 12 5 2 10l10 5 10-5ZM6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5',
  trend:'M22 7l-8.5 8.5-5-5L2 17M22 7h-6M22 7v6',
  cloud:'M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.3A3.5 3.5 0 0 1 18 18z',
  star:'M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.8 6.2 21l1.1-6.5L2.6 9.8l6.5-.9z',
  printer:'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 14h12v7H6z',
  settings:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z',
};

export function Icon({ name, size = 20, stroke = 2, style, className }) {
  const d = ICONS[name];
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {(d||'').split('M').filter(Boolean).map((seg,i)=><path key={i} d={'M'+seg} />)}
    </svg>
  );
}

/* ---- Domain data ---- */
export const SUBJECTS = [
  { id:1, code:'NLE1', name:'การพยาบาลมารดาและทารก' },
  { id:2, code:'NLE2', name:'การพยาบาลเด็กและวัยรุ่น' },
  { id:3, code:'NLE3', name:'การพยาบาลผู้ใหญ่' },
  { id:4, code:'NLE4', name:'การพยาบาลผู้สูงอายุ' },
  { id:5, code:'NLE5', name:'การพยาบาลสุขภาพจิตและจิตเวช' },
  { id:6, code:'NLE6', name:'การผดุงครรภ์' },
  { id:7, code:'NLE7', name:'การพยาบาลอนามัยชุมชน' },
  { id:8, code:'NLE8', name:'กฎหมายและจรรยาบรรณวิชาชีพ' },
];

/* user roles — keys match backend `roles` table naming (roles.name), so backend/frontend stay in sync
   when auth switches from PSU One Passport SSO to normal signin/signup */
export const ROLES = {
  STUDENT:   'student',
  OFFICER:   'officer',
  EXECUTIVE: 'executive',
  ADMIN:     'admin',
};

/* status keys: DRAFT, SUBMITTED(รอตรวจสอบ), CONFIRMED(ยืนยันแล้ว), REJECTED(ตีกลับ) */
export const STATUS = {
  DRAFT:     { key:'draft',  label:'ยังไม่กรอก' },
  SUBMITTED: { key:'wait',   label:'รอตรวจสอบ' },
  CONFIRMED: { key:'ok',     label:'ยืนยันแล้ว' },
  REJECTED:  { key:'reject', label:'ถูกตีกลับ' },
};

export const ROUNDS = [
  { id:3, year:2569, attempt:1, open:'1 มิ.ย. 2569', close:'15 มิ.ย. 2569', status:'OPEN' },
  { id:2, year:2568, attempt:2, open:'5 ม.ค. 2569', close:'20 ม.ค. 2569', status:'CLOSED' },
  { id:1, year:2568, attempt:1, open:'1 มิ.ย. 2568', close:'15 มิ.ย. 2568', status:'CLOSED' },
];

const THAI_FIRST = ['ฉันท์ชนก','ธัญเทพ','ปาริชาต','กฤตยา','ศุภวิชญ์','นภัสสร','ธีรภัทร','อรพรรณ','พิมพ์มาดา','กิตติพงศ์','ชนัญชิดา','วรินทร','ภาคิน','สุพิชญา','ณัฐวุฒิ','เบญจวรรณ','อนุชา','ปุณยนุช','ธนกฤต','มนัสนันท์','รัตนาภรณ์','จิรายุ','พรนภา','สิทธิชัย'];
const THAI_LAST = ['ทองรัดแก้ว','จิ้วตั้น','แซ่ลิ่ม','บุญส่ง','ชูเกียรติ','พงศ์ธร','รุ่งเรือง','ศรีสุข','มากมี','วัฒนกุล','แก้วมณี','สุวรรณ','ใจดี','ภักดี','อินทร์ทอง','พรหมจันทร์','ดวงแก้ว','เพชรรัตน์','คงทอง','นวลจันทร์'];
export const ROOMS = ['A','B','C','D'];

function seededRand(seed){ let s=seed; return ()=>{ s=(s*9301+49297)%233280; return s/233280; }; }

function genStudents(n){
  const r = seededRand(42);
  const arr = [];
  for(let i=0;i<n;i++){
    const sid = '6610'+String(210000 + Math.floor(r()*900)).padStart(6,'0');
    const fn = THAI_FIRST[Math.floor(r()*THAI_FIRST.length)];
    const ln = THAI_LAST[Math.floor(r()*THAI_LAST.length)];
    const room = ROOMS[Math.floor(r()*ROOMS.length)];
    // status distribution
    const roll = r();
    let status;
    if(roll<0.50) status='CONFIRMED';
    else if(roll<0.74) status='SUBMITTED';
    else if(roll<0.86) status='REJECTED';
    else status='DRAFT';
    // subject results: 8 pass/fail
    const subs = SUBJECTS.map(s=>{
      if(status==='DRAFT') return { id:s.id, passed:null };
      return { id:s.id, passed: r() < 0.82 };
    });
    const passedCount = subs.filter(s=>s.passed===true).length;
    const allPass = status!=='DRAFT' && subs.every(s=>s.passed===true);
    arr.push({
      sid, prefix: i%3===0?'นาย':'นางสาว', firstName:fn, lastName:ln,
      room, year:2569, status, subjects:subs, passedCount, allPass,
      submittedAt: status==='DRAFT'?null:'5 มิ.ย. 2569 10:30',
      confirmedAt: status==='CONFIRMED'?'10 มิ.ย. 2569 14:00':null,
      remark: status==='REJECTED' ? ['เอกสารหลักฐานไม่ชัดเจน กรุณาอัปโหลดใหม่','ผลสอบรายวิชาไม่ตรงกับไฟล์แนบ','ไฟล์ใบประกอบวิชาชีพไม่สมบูรณ์'][Math.floor(r()*3)] : null,
      files: status==='DRAFT'?[]:[
        { name:'ผลสอบ_NLE_'+sid+'.pdf', type:'LICENSE', size:'1.2 MB' },
      ],
    });
  }
  return arr;
}

export const STUDENTS = genStudents(120);

/* the "current" logged-in student (rich object for student view) */
export const ME = {
  sid:'6610210631', prefix:'นาย', firstName:'ธัญเทพ', lastName:'จิ้วตั้น',
  room:'B', year:2569, email:'6610210631@psu.ac.th',
  councilEmail:'6610210631@nurse.or.th', councilSet:true,
};

export const NEWS = [
  { id:3, title:'เปิดรับกรอกผลสอบใบประกอบวิชาชีพ รอบที่ 1 ปีการศึกษา 2569', round:'รอบ 1/2569',
    date:'1 มิ.ย. 2569', author:'งานบริการการศึกษา', pinned:true,
    body:'ขอให้นักศึกษาที่เข้าสอบความรู้ขอขึ้นทะเบียนฯ ครั้งที่ 1/2569 กรอกผลสอบรายวิชาทั้ง 8 วิชา พร้อมแนบไฟล์ใบรายงานผลสอบ (PDF) ภายในวันที่ 15 มิถุนายน 2569 เวลา 16.00 น.' },
  { id:2, title:'แนวปฏิบัติการอัปโหลดเอกสารหลักฐานผลสอบ', round:'รอบ 1/2569',
    date:'28 พ.ค. 2569', author:'งานบริการการศึกษา', pinned:false,
    body:'ไฟล์เอกสารต้องเป็น PDF ขนาดไม่เกิน 10 MB ตั้งชื่อไฟล์เป็นรหัสนักศึกษา และต้องเห็นผลสอบรายวิชาชัดเจน' },
  { id:1, title:'ประกาศผลการขึ้นทะเบียนผู้ประกอบวิชาชีพการพยาบาล', round:'รอบ 2/2568',
    date:'22 ม.ค. 2569', author:'ฝ่ายวิชาการ', pinned:false,
    body:'สภาการพยาบาลได้ประกาศผลการสอบความรู้ฯ ครั้งที่ 2/2568 แล้ว นักศึกษาสามารถตรวจสอบผลได้ที่เว็บไซต์สภาการพยาบาล' },
];

/* aggregate stats for dashboards */
export function computeStats(students){
  const total = students.length;
  const by = { DRAFT:0, SUBMITTED:0, CONFIRMED:0, REJECTED:0 };
  students.forEach(s=>by[s.status]++);
  const submitted = total - by.DRAFT;
  // per-subject pass rate (only among non-draft)
  const perSubject = SUBJECTS.map(sub=>{
    let pass=0, fail=0;
    students.forEach(st=>{
      if(st.status==='DRAFT') return;
      const r = st.subjects.find(x=>x.id===sub.id);
      if(r && r.passed===true) pass++; else if(r && r.passed===false) fail++;
    });
    const tot = pass+fail;
    return { ...sub, pass, fail, rate: tot?Math.round(pass/tot*100):0 };
  });
  const fullyPassed = students.filter(s=>s.status!=='DRAFT' && s.allPass).length;
  const evaluated = submitted;
  const overallPassRate = evaluated? Math.round(fullyPassed/evaluated*100):0;
  return { total, by, submitted, perSubject, fullyPassed, overallPassRate,
    fillRate: Math.round(submitted/total*100) };
}

/* trend over rounds (mock historical) */
export const TREND = [
  { round:'1/2568', rate:71, count:118 },
  { round:'2/2568', rate:78, count:96 },
  { round:'1/2569', rate:83, count:120 },
];

/* ---- Multi-year analytics (3 ปีย้อนหลัง) ---- */
export const YEARS = [2569, 2568, 2567];
export const YEARLY = {
  2569: { students:120, registered:104, firstAttempt:83, cumulative:96,
    attempts:[ { label:'ครั้งที่ 1', rate:83, sat:120, pass:100 },
               { label:'ครั้งที่ 2', rate:62, sat:20, pass:12 },
               { label:'ครั้งที่ 3', rate:50, sat:8, pass:4 } ] },
  2568: { students:118, registered:101, firstAttempt:78, cumulative:94,
    attempts:[ { label:'ครั้งที่ 1', rate:78, sat:118, pass:92 },
               { label:'ครั้งที่ 2', rate:58, sat:26, pass:15 },
               { label:'ครั้งที่ 3', rate:45, sat:11, pass:5 } ] },
  2567: { students:112, registered:95, firstAttempt:74, cumulative:91,
    attempts:[ { label:'ครั้งที่ 1', rate:74, sat:112, pass:83 },
               { label:'ครั้งที่ 2', rate:55, sat:29, pass:16 },
               { label:'ครั้งที่ 3', rate:40, sat:13, pass:5 } ] },
};
/* per-year first-attempt vs cumulative — for 3-year comparison chart */
export const YEAR_COMPARE = YEARS.slice().reverse().map(y=>({
  label:'พ.ศ. '+y, year:y,
  first:YEARLY[y].firstAttempt, cumulative:YEARLY[y].cumulative, students:YEARLY[y].students,
}));

/* fmt helper */
export function plural(n){ return n.toLocaleString('th-TH'); }
