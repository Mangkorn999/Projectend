/* ============================================================
   ข้อมูลปลอมสำหรับเดโม (mock data)
   ⚠️ ชั่วคราวเท่านั้น — ลบทีละก้อนเมื่อหน้าจอต่อ API จริงแล้ว
   ============================================================ */

/* ---- รายวิชาที่ใช้สอบ 8 วิชา ---- */
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

/* ---- รอบการกรอกผลสอบ ---- */
export const ROUNDS = [
  { id:3, year:2569, attempt:1, open:'1 มิ.ย. 2569', close:'15 มิ.ย. 2569', status:'OPEN' },
  { id:2, year:2568, attempt:2, open:'5 ม.ค. 2569', close:'20 ม.ค. 2569', status:'CLOSED' },
  { id:1, year:2568, attempt:1, open:'1 มิ.ย. 2568', close:'15 มิ.ย. 2568', status:'CLOSED' },
];

export const ROOMS = ['A','B','C','D'];

/* ---- สุ่มรายชื่อนักศึกษาแบบคงที่ (seed เดิมเสมอ ข้อมูลจะไม่เปลี่ยนทุกครั้งที่ refresh) ---- */
const THAI_FIRST = ['ฉันท์ชนก','ธัญเทพ','ปาริชาต','กฤตยา','ศุภวิชญ์','นภัสสร','ธีรภัทร','อรพรรณ','พิมพ์มาดา','กิตติพงศ์','ชนัญชิดา','วรินทร','ภาคิน','สุพิชญา','ณัฐวุฒิ','เบญจวรรณ','อนุชา','ปุณยนุช','ธนกฤต','มนัสนันท์','รัตนาภรณ์','จิรายุ','พรนภา','สิทธิชัย'];
const THAI_LAST = ['ทองรัดแก้ว','จิ้วตั้น','แซ่ลิ่ม','บุญส่ง','ชูเกียรติ','พงศ์ธร','รุ่งเรือง','ศรีสุข','มากมี','วัฒนกุล','แก้วมณี','สุวรรณ','ใจดี','ภักดี','อินทร์ทอง','พรหมจันทร์','ดวงแก้ว','เพชรรัตน์','คงทอง','นวลจันทร์'];

function seededRand(seed){ let s=seed; return ()=>{ s=(s*9301+49297)%233280; return s/233280; }; }

function genStudents(n){
  const r = seededRand(42);
  const arr = [];
  for(let i=0;i<n;i++){
    const sid = '6610'+String(210000 + Math.floor(r()*900)).padStart(6,'0');
    const fn = THAI_FIRST[Math.floor(r()*THAI_FIRST.length)];
    const ln = THAI_LAST[Math.floor(r()*THAI_LAST.length)];
    const room = ROOMS[Math.floor(r()*ROOMS.length)];
    // กระจายสถานะให้เหมือนของจริง
    const roll = r();
    let status;
    if(roll<0.50) status='CONFIRMED';
    else if(roll<0.74) status='SUBMITTED';
    else if(roll<0.86) status='REJECTED';
    else status='DRAFT';
    // ผลสอบ 8 วิชา ผ่าน/ไม่ผ่าน
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

/* ---- นักศึกษาที่ "ล็อกอินอยู่" (ใช้ในหน้าฝั่งนักศึกษา) ---- */
export const ME = {
  sid:'6610210631', prefix:'นาย', firstName:'ธัญเทพ', lastName:'จิ้วตั้น',
  room:'B', year:2569, email:'6610210631@psu.ac.th',
};

/* ---- ข่าวสาร / ประกาศ ---- */
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

/* ---- คำนวณสถิติรวมสำหรับ dashboard ---- */
export function computeStats(students){
  const total = students.length;
  const by = { DRAFT:0, SUBMITTED:0, CONFIRMED:0, REJECTED:0 };
  students.forEach(s=>by[s.status]++);
  const submitted = total - by.DRAFT;
  // อัตราผ่านรายวิชา (นับเฉพาะคนที่กรอกแล้ว)
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

/* ---- สถิติย้อนหลัง 3 ปี (หน้าผู้บริหาร) ---- */
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

/* เทียบสอบผ่านครั้งแรก vs ผ่านสะสม ใช้กับกราฟ 3 ปี */
export const YEAR_COMPARE = YEARS.slice().reverse().map(y=>({
  label:'พ.ศ. '+y, year:y,
  first:YEARLY[y].firstAttempt, cumulative:YEARLY[y].cumulative, students:YEARLY[y].students,
}));

/* แปลงตัวเลขเป็นรูปแบบไทย เช่น 1,234 */
export function plural(n){ return n.toLocaleString('th-TH'); }
