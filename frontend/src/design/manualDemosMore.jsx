/* eslint-disable react-refresh/only-export-components --
   ไฟล์นี้ export "ข้อมูลสคริปต์สาธิต" (MORE_DEMOS) ไม่ใช่คอมโพเนนต์ — ไม่มีผลกับ fast refresh ของหน้าจริง */
/* ============================================================
   สคริปต์สาธิตชุดที่ 2 ของหน้าคู่มือ — งานที่เจ้าหน้าที่ทำนอกเหนือจากตรวจ/ยืนยันผลสอบ
   (รูปแบบและวิธีแก้เหมือน manualDemos.jsx: steps[k] = { target, text } และ stage(done) วาดหน้าจอจำลอง)

   ข้อความบนปุ่ม/หัวข้อในหน้าจอจำลองต้องตรงกับ i18n.js ของระบบจริง — เปลี่ยนหน้าจอจริงแล้วให้มาแก้ที่นี่ด้วย
   ============================================================ */
import { Icon } from './data.jsx';
import { MockFrame, MockToast, MockTyped, MockModal, MockBadge, Field, Box, Btn } from './manualDemo.jsx';

/* ---------- ชิ้นส่วนย่อย ---------- */
// ช่องเลือก (dropdown) จำลอง
const Sel = ({ dm, children, style }) => (
  <Box dm={dm} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, ...style }}><span>{children}</span><span style={{ color: 'var(--ink-500)' }}>▾</span></Box>
);
const Hint = ({ children }) => <div style={{ fontSize: 12.5, color: 'var(--ink-500)', lineHeight: 1.5 }}>{children}</div>;
const Empty = ({ children }) => <span style={{ color: 'var(--ink-400)' }}>{children}</span>;

// แถบแท็บของหน้า "นำเข้ารายชื่อนักศึกษา"
function ImportTabs({ active, pending }) {
  const tab = (key, dm, icon, label, extra) => (
    <span data-demo={dm} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 9, fontSize: 13.5, fontWeight: 700, background: active === key ? '#fff' : 'transparent', color: active === key ? 'var(--navy-800)' : 'var(--ink-600)', boxShadow: active === key ? 'var(--sh-sm)' : 'none' }}>
      <Icon name={icon} size={14} /> {label}{extra}
    </span>
  );
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
      <div style={{ display: 'inline-flex', gap: 3, padding: 4, background: 'var(--ink-100)', borderRadius: 12 }}>
        {tab('csv', 'tab-csv', 'upload', 'นำเข้าไฟล์ (Excel / CSV)')}
        {tab('manual', 'tab-manual', 'edit', 'กรอกเองทีละคน')}
        {tab('pending', 'tab-pending', 'users', 'บัญชีที่ยังไม่เข้าระบบ', pending ? <span className="chip" style={{ fontSize: 12, padding: '0 7px', background: 'var(--gold-100)', color: 'var(--status-wait-fg)' }}>{pending}</span> : null)}
      </div>
    </div>
  );
}

// ตารางรายชื่อนักศึกษา (หน้า "ข้อมูลนักศึกษา") — pick(id) → { dm, on } ; eligible(id) → boolean ; extra(id) → ปุ่มท้ายแถว
const STUDENTS = [
  ['6610210201', 'นางสาวกานดา ตัวอย่าง', 'A', '—'],
  ['6610210202', 'นายสมชาย จำลอง', 'A', '3/3'],
  ['6610210203', 'นางสาวมาลี ทดสอบ', 'B', '—'],
];
function StudentTable({ pick, eligible, extra, rows = STUDENTS }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="mn-th">
        {pick && <span style={{ width: 22 }} />}
        <span style={{ flex: 2 }}>นักศึกษา</span><span style={{ width: 40 }}>ห้อง</span><span style={{ flex: 1.3 }}>สิทธิ์กรอกผล</span><span style={{ width: 50 }}>ผลสอบ</span>{extra && <span style={{ flex: 1.6 }} />}
      </div>
      {rows.map(([id, name, room, res]) => {
        const pk = pick?.(id);
        return (
          <div key={id} className="mn-tr">
            {pick && <span style={{ width: 22 }}><span className="mn-check" data-demo={pk?.dm} data-on={pk?.on ? '1' : '0'}>{pk?.on ? '✓' : ''}</span></span>}
            <span style={{ flex: 2 }}><b>{name}</b><br /><span className="mono" style={{ fontSize: 12, color: 'var(--ink-500)' }}>{id}</span></span>
            <span style={{ width: 40 }}>{room}</span>
            <span style={{ flex: 1.3 }}>{eligible?.(id) ? <MockBadge tone="ok">เปิดสิทธิ์แล้ว</MockBadge> : <MockBadge tone="draft">ยังไม่เปิดสิทธิ์</MockBadge>}</span>
            <span style={{ width: 50, fontWeight: 700 }}>{res}</span>
            {extra && <span style={{ flex: 1.6, display: 'flex', gap: 5, justifyContent: 'flex-end' }}>{extra(id)}</span>}
          </div>
        );
      })}
    </div>
  );
}

const DELETE_WARN = 'นักศึกษาคนนี้มีผลสอบในระบบแล้ว — การลบจะลบผลสอบ เอกสารหลักฐาน และประวัติการตรวจทั้งหมดของเขาด้วย และสถิติของรุ่นจะเปลี่ยนย้อนหลัง (ตัวเลขในรายงานที่ออกไปแล้วจะไม่ตรงกับในระบบ) กู้คืนไม่ได้';

/* ============ 1) เพิ่มนักศึกษาทีละคน ============ */
const manualAddDemo = {
  title: 'การเพิ่มนักศึกษาทีละคน (กรอกเอง)',
  height: 440,
  steps: [
    { target: 'tab-manual', text: 'ที่หน้า "นำเข้ารายชื่อนักศึกษา" คลิกแท็บ "กรอกเองทีละคน" (ใช้เมื่อมีนักศึกษาเพิ่มเติมเพียงไม่กี่คน)' },
    { target: 'f-sid', text: 'กรอก "รหัสนักศึกษา" (ตัวเลขอย่างน้อย 2 หลัก ระบบใช้ 2 หลักแรกคำนวณปีการศึกษาที่จบ)' },
    { target: 'f-nid', text: 'กรอก "เลขบัตรประชาชน" 13 หลัก ซึ่งเป็นรหัสผ่านเริ่มต้นของนักศึกษา' },
    { target: 'add', text: 'ช่อง "ปีการศึกษาที่จบ" เว้นว่างได้ (ระบบคำนวณจากรหัสนักศึกษา) กรอกเฉพาะผู้ซ้ำชั้นหรือลาพัก แล้วคลิก "เพิ่มนักศึกษา"', hold: 2000 },
  ],
  stage: (done) => (
    <MockFrame title="นำเข้ารายชื่อนักศึกษา">
      <ImportTabs active={done < 1 ? 'csv' : 'manual'} />
      {done < 1 ? (
        <div className="card" style={{ padding: 14, color: 'var(--ink-500)', fontSize: 14 }}>นำเข้าจากไฟล์ Excel / CSV — เลือกไฟล์แล้วกด "ตรวจไฟล์"</div>
      ) : (
        <div className="card mn-pop" style={{ padding: 14, width: 420, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>เพิ่มนักศึกษา 1 คน <span style={{ fontWeight: 400, fontSize: 12.5, color: 'var(--ink-500)' }}>· รหัสผ่าน = เลขบัตรประชาชนที่กรอกไว้</span></div>
          <Field label="รหัสนักศึกษา *"><Box dm="f-sid">{done >= 2 && done < 4 ? <MockTyped text="6610210201" /> : <Empty>6610210001</Empty>}</Box></Field>
          <Field label="เลขบัตรประชาชน (13 หลัก) *"><Box dm="f-nid">{done >= 3 && done < 4 ? <MockTyped text="1234567890123" /> : <Empty>1234567890123</Empty>}</Box></Field>
          <Field label="ปีการศึกษาที่จบ (พ.ศ.) (ไม่บังคับ)"><Box style={{ minHeight: 20 }} /><Hint>เว้นว่าง = ระบบคำนวณจากรหัส (ปีที่เข้า + 4)</Hint></Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><Btn>ล้างฟอร์ม</Btn><Btn dm="add" kind="primary"><Icon name="plus" size={14} /> เพิ่มนักศึกษา</Btn></div>
        </div>
      )}
      <MockToast show={done >= 4}>เพิ่มนักศึกษา 6610210201 สำเร็จ</MockToast>
    </MockFrame>
  ),
};

/* ============ 2) ไฟล์ที่ชื่อคอลัมน์ไม่ตรง → เลือกคอลัมน์เอง ============ */
const mappingDemo = {
  title: 'กรณีชื่อคอลัมน์ในไฟล์ไม่ตรงกับที่ระบบรู้จัก (เลือกคอลัมน์เอง)',
  height: 440,
  steps: [
    { target: 'choose-file', text: 'เลือกไฟล์ตามปกติ (เช่น ไฟล์คำตอบจาก Google Form ที่ตั้งชื่อคำถามเอง และมีคอลัมน์อื่นปนอยู่)' },
    { target: 'check', text: 'คลิก "ตรวจไฟล์" หากระบบจับคู่ชื่อคอลัมน์ไม่ได้ จะไม่ปฏิเสธไฟล์ แต่แสดงกล่อง "เลือกว่าคอลัมน์ไหนคืออะไร"' },
    { target: 'map-sid', text: 'เลือกคอลัมน์ที่เก็บ "รหัสนักศึกษา" จากรายการชื่อคอลัมน์ในไฟล์' },
    { target: 'map-nid', text: 'เลือกคอลัมน์ที่เก็บ "เลขบัตรประชาชน" (คอลัมน์ "ปีการศึกษาที่จบ" ไม่บังคับ และคอลัมน์อื่นในไฟล์ถูกข้ามอัตโนมัติ)' },
    { target: 'recheck', text: 'คลิก "ตรวจไฟล์ด้วยคอลัมน์ที่เลือก" ระบบแสดงผลตรวจพร้อมบรรทัด "คอลัมน์ที่ใช้" ให้ตรวจว่าจับคู่ถูกต้อง' },
    { target: 'confirm', text: 'เมื่อถูกต้อง คลิก "ยืนยันนำเข้า" จึงจะบันทึกข้อมูลจริง', hold: 2000 },
  ],
  stage: (done) => (
    <MockFrame title="นำเข้ารายชื่อนักศึกษา">
      <ImportTabs active="csv" />
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {done < 1 ? <Btn dm="choose-file"><Icon name="upload" size={14} /> เลือกไฟล์ Excel / CSV</Btn> : <span className="mn-pop" style={{ padding: '5px 12px', border: '1px solid var(--ink-200)', borderRadius: 9, fontSize: 13.5 }}>📄 คำตอบแบบฟอร์ม.xlsx</span>}
          {done < 5 ? <Btn dm="check" kind="primary">ตรวจไฟล์</Btn> : <><Btn>ยกเลิก</Btn><Btn dm="confirm" kind="primary"><Icon name="checkCircle" size={14} /> ยืนยันนำเข้า 3 คน</Btn></>}
        </div>
        {done >= 2 && done < 5 && (
          <div className="mn-pop" style={{ marginTop: 10, padding: 12, borderRadius: 10, background: 'var(--status-wait-bg)', border: '1px solid var(--gold-100)' }}>
            <div style={{ fontWeight: 800, color: 'var(--status-wait-fg)', fontSize: 14.5 }}>เลือกว่าคอลัมน์ไหนคืออะไร</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-700)', margin: '3px 0 9px' }}>ระบบจับคู่ชื่อคอลัมน์ในไฟล์ไม่ได้ กรุณาเลือกว่าคอลัมน์ไหนคือข้อมูลอะไร แล้วกดตรวจไฟล์อีกครั้ง</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Field label="รหัสนักศึกษา *" style={{ flex: 1 }}><Sel dm="map-sid">{done >= 3 ? 'เลขประจำตัวนักศึกษา' : <Empty>— เลือกคอลัมน์ —</Empty>}</Sel></Field>
              <Field label="เลขบัตรประชาชน *" style={{ flex: 1 }}><Sel dm="map-nid">{done >= 4 ? 'เลขบัตร ปชช. 13 หลัก' : <Empty>— เลือกคอลัมน์ —</Empty>}</Sel></Field>
              <Field label="ปีการศึกษาที่จบ (ไม่บังคับ)" style={{ flex: 1 }}><Sel><Empty>— ไม่มี —</Empty></Sel></Field>
            </div>
            <div style={{ marginTop: 10 }}><Btn dm="recheck" kind="primary">ตรวจไฟล์ด้วยคอลัมน์ที่เลือก</Btn></div>
          </div>
        )}
        {done >= 5 && (
          <div className="mn-pop" style={{ marginTop: 10 }}>
            <div style={{ padding: '8px 12px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, background: done >= 6 ? 'var(--status-ok-bg)' : 'var(--status-wait-bg)', color: done >= 6 ? 'var(--status-ok-fg)' : 'var(--status-wait-fg)' }}>
              {done >= 6 ? 'นำเข้าสำเร็จครบทุกแถว รวม 3 คน' : 'ตรวจแล้ว — นำเข้าได้ครบทุกแถว 3 คน ยังไม่ได้บันทึก'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-500)', margin: '6px 2px 0' }}>คอลัมน์ที่ใช้: รหัสนักศึกษา ← <b>เลขประจำตัวนักศึกษา</b> · เลขบัตรประชาชน ← <b>เลขบัตร ปชช. 13 หลัก</b> · ปีที่จบ ← <b>— ไม่มี —</b></div>
          </div>
        )}
      </div>
      <MockToast show={done >= 6}>นำเข้าสำเร็จ 3 คน</MockToast>
    </MockFrame>
  ),
};

/* ============ 3) ผลตรวจมีแถวที่ถูกข้าม ============ */
const SKIPPED = [
  [3, '6610210302', 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก'],
  [4, '6610210303', 'มีในระบบแล้ว'],
  [6, '6610210301', 'รหัสนักศึกษาซ้ำกับแถว 2 ในไฟล์เดียวกัน'],
];
const skippedDemo = {
  title: 'กรณีผลตรวจไฟล์พบแถวที่มีปัญหา (แถวที่ถูกข้าม)',
  height: 440,
  steps: [
    { target: 'view-skipped', text: 'หลังตรวจไฟล์ หากมีแถวที่นำเข้าไม่ได้ ระบบแจ้งจำนวนแถวที่ "จะข้าม" คลิกที่ช่องนี้เพื่อดูเหตุผลของแต่ละแถว' },
    { target: 'dl-skipped', text: 'คลิก "โหลดรายการที่ข้าม (CSV)" เพื่อเก็บรายการไปแก้ไขข้อมูลต้นทาง (แถวที่ระบุเลขที่แถวตรงกับที่เห็นในไฟล์)' },
    { target: 'confirm', text: 'คลิก "ยืนยันนำเข้า" ระบบนำเข้าเฉพาะแถวที่ถูกต้อง แถวที่ถูกข้ามไม่ถูกบันทึก แก้ไขแล้วอัปโหลดเฉพาะแถวเหล่านั้นอีกครั้งได้', hold: 2200 },
  ],
  stage: (done) => (
    <MockFrame title="นำเข้ารายชื่อนักศึกษา">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ padding: '5px 12px', border: '1px solid var(--ink-200)', borderRadius: 9, fontSize: 13.5, background: '#fff' }}>📄 รายชื่อนักศึกษา.xlsx</span>
        <span style={{ flex: 1 }} />
        {done < 3 ? <><Btn>ยกเลิก</Btn><Btn dm="confirm" kind="primary"><Icon name="checkCircle" size={14} /> ยืนยันนำเข้า 2 คน</Btn></> : <span style={{ color: 'var(--status-ok-fg)', fontWeight: 700, fontSize: 13.5 }}>✓ นำเข้าเรียบร้อย</span>}
      </div>
      <div style={{ padding: '8px 12px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, marginBottom: 8, background: 'var(--status-wait-bg)', color: 'var(--status-wait-fg)' }}>
        {done < 3 ? 'ตรวจแล้ว — นำเข้าได้ 2 คน จะข้าม 3 แถว ยังไม่ได้บันทึก ดูเหตุผลด้านล่าง' : 'นำเข้าสำเร็จ 2 คน แต่ข้ามไป 3 แถว — ตรวจสอบเหตุผลด้านล่าง แล้วอัปโหลดเฉพาะแถวที่แก้แล้วอีกครั้งได้'}
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 8, padding: 10, borderBottom: '1px solid var(--ink-100)', alignItems: 'center' }}>
          <span style={{ padding: '5px 12px', borderRadius: 9, fontSize: 13.5, fontWeight: 700, background: done < 1 ? 'var(--status-ok-bg)' : '#fff', color: 'var(--status-ok-fg)', border: '1px solid var(--ink-200)' }}>✓ {done < 3 ? 'จะนำเข้า' : 'นำเข้าสำเร็จ'} 2</span>
          <span data-demo="view-skipped" style={{ padding: '5px 12px', borderRadius: 9, fontSize: 13.5, fontWeight: 700, background: done >= 1 ? 'var(--status-reject-bg)' : '#fff', color: 'var(--status-reject-fg)', border: '1px solid var(--ink-200)' }}>⚠ {done < 3 ? 'จะข้าม' : 'ข้าม'} 3</span>
          <span style={{ flex: 1 }} />
          <Btn dm="dl-skipped"><Icon name="download" size={14} /> โหลดรายการที่ข้าม (CSV)</Btn>
        </div>
        {done < 1 ? (
          [['1', '6610210301'], ['2', '6610210304']].map(([n, id]) => (
            <div key={id} className="mn-tr"><span style={{ width: 50 }}>{n}</span><span className="mono" style={{ flex: 1 }}>{id}</span><MockBadge tone="wait">พร้อมนำเข้า</MockBadge></div>
          ))
        ) : (
          <>
            <div className="mn-th" style={{ background: 'var(--ink-100)', color: 'var(--ink-700)' }}><span style={{ width: 50 }}>แถวที่</span><span style={{ width: 110 }}>รหัสนักศึกษา</span><span style={{ flex: 1 }}>เหตุผล</span></div>
            {SKIPPED.map(([n, id, why]) => (
              <div key={id} className="mn-tr mn-pop"><span style={{ width: 50 }}>{n}</span><span className="mono" style={{ width: 110 }}>{id}</span><span style={{ flex: 1, color: 'var(--status-reject-fg)', fontWeight: 600 }}>{why}</span></div>
            ))}
          </>
        )}
      </div>
      <MockToast show={done === 2}>ดาวน์โหลดรายการที่ข้ามแล้ว</MockToast>
      <MockToast show={done >= 3}>นำเข้าสำเร็จ 2 คน</MockToast>
    </MockFrame>
  ),
};

/* ============ 4) เปิดสิทธิ์กรอกผลสอบ (หลายคนพร้อมกัน) ============ */
const eligibleDemo = {
  title: 'การเปิดสิทธิ์กรอกผลสอบให้นักศึกษา (ทีละคนหรือหลายคนพร้อมกัน)',
  height: 380,
  steps: [
    { target: 'pick1', text: 'ที่หน้า "ข้อมูลนักศึกษา" ติ๊กเลือกนักศึกษาที่ยังแสดง "ยังไม่เปิดสิทธิ์" (กรองตามห้อง ปี หรือสิทธิ์ เพื่อเลือกทั้งรุ่นได้สะดวก)' },
    { target: 'pick2', text: 'ติ๊กเลือกคนถัดไปได้ตามต้องการ (ช่องหัวตารางใช้เลือกทุกคนที่กรองอยู่)' },
    { target: 'grant', text: 'คลิก "เปิดสิทธิ์กรอกผลสอบ" นักศึกษาจะกรอกผลสอบได้เมื่อมีรอบของรุ่นตนเองเปิดรับอยู่ (ถอนสิทธิ์ได้ด้วยปุ่ม "ถอนสิทธิ์")', hold: 2000 },
  ],
  stage: (done) => {
    const granted = done >= 3;
    const on = (id) => !granted && ((id === '6610210201' && done >= 1) || (id === '6610210202' && done >= 2));
    const n = (done >= 1 ? 1 : 0) + (done >= 2 ? 1 : 0);
    return (
      <MockFrame title="ข้อมูลนักศึกษา">
        <div style={{ height: 44, display: 'flex', alignItems: 'center' }}>
          {n > 0 && !granted && (
            <div className="mn-pop" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 10px', borderRadius: 10, background: 'var(--gold-100)' }}>
              <b style={{ fontSize: 13.5 }}>เลือกไว้ {n} คน</b><span style={{ flex: 1 }} />
              <Btn dm="grant" kind="primary">เปิดสิทธิ์กรอกผลสอบ</Btn><Btn>ถอนสิทธิ์</Btn><Btn><Icon name="trash" size={13} /> ลบที่เลือก</Btn><Btn>ล้างที่เลือก</Btn>
            </div>
          )}
        </div>
        <StudentTable
          pick={(id) => ({ dm: id === '6610210201' ? 'pick1' : id === '6610210202' ? 'pick2' : undefined, on: on(id) })}
          eligible={(id) => id === '6610210203' || (granted && id !== '6610210203')}
        />
        <MockToast show={granted}>เปิดสิทธิ์กรอกผลสอบให้ 2 คนแล้ว</MockToast>
      </MockFrame>
    );
  },
};

/* ============ 5) รีเซ็ตรหัสผ่านนักศึกษา ============ */
const resetStudentDemo = {
  title: 'การรีเซ็ตรหัสผ่านของนักศึกษา (ลืมรหัสผ่าน / สงสัยว่ามีผู้อื่นใช้บัญชี)',
  height: 400,
  steps: [
    { target: 'reset-btn', text: 'ที่หน้า "ข้อมูลนักศึกษา" คลิก "รีเซ็ตรหัส" ที่แถวของนักศึกษาที่ต้องการ' },
    { target: 'reset-input', text: 'กรอกเลขบัตรประชาชน 13 หลักของนักศึกษาผู้นั้นซ้ำ (รหัสผ่านของนักศึกษาคือเลขบัตรประชาชน จึงเป็นการตั้งรหัสผ่านกลับเป็นค่าเริ่มต้น)' },
    { target: 'reset-confirm', text: 'คลิก "รีเซ็ตรหัส" นักศึกษาเข้าสู่ระบบด้วยรหัสนักศึกษาและเลขบัตรประชาชนนั้นได้ทันที', hold: 2000 },
  ],
  stage: (done) => (
    <MockFrame title="ข้อมูลนักศึกษา">
      <StudentTable eligible={() => true} extra={(id) => <Btn dm={id === '6610210201' ? 'reset-btn' : undefined}><Icon name="key" size={13} /> รีเซ็ตรหัส</Btn>} />
      {done >= 1 && done < 3 && (
        <MockModal title="รีเซ็ตรหัส" footer={<><Btn>ยกเลิก</Btn><Btn dm="reset-confirm" kind="primary">รีเซ็ตรหัส</Btn></>}>
          <div style={{ fontSize: 13, color: 'var(--ink-600)', marginBottom: 9, lineHeight: 1.6 }}>รหัสผ่านของนักศึกษาคือเลขบัตรประชาชน — กรอกเลขเดิมซ้ำเพื่อตั้งรหัสผ่านใหม่ (ใช้เมื่อพิมพ์ผิดตอนนำเข้า หรือสงสัยมีคนอื่นสวมสิทธิ์)</div>
          <Field label="เลขบัตรประชาชน (13 หลัก)"><Box dm="reset-input">{done >= 2 ? <MockTyped text="1234567890123" /> : <Empty>1234567890123</Empty>}</Box></Field>
        </MockModal>
      )}
      <MockToast show={done >= 3}>รีเซ็ตรหัสผ่านของ กานดา แล้ว</MockToast>
    </MockFrame>
  ),
};

/* ============ 6) แก้ไขข้อมูลนักศึกษา ============ */
const editStudentDemo = {
  title: 'การแก้ไขข้อมูลนักศึกษา (ห้องเรียน เบอร์โทร ปีการศึกษาที่จบ ฯลฯ)',
  height: 470,
  steps: [
    { target: 'edit-btn', text: 'เข้าหน้ารายละเอียดของนักศึกษา แล้วคลิก "แก้ไขข้อมูล"' },
    { target: 'edit-phone', text: 'แก้ข้อมูลที่ต้องการ เช่น เบอร์โทร ห้องเรียน หรือปีการศึกษาที่จบ (ปีที่จบแก้ได้เฉพาะผู้ที่ยังไม่เคยส่งผลสอบ)' },
    { target: 'edit-save', text: 'คลิก "บันทึก" ข้อมูลถูกปรับทันที', hold: 2000 },
  ],
  stage: (done) => (
    <MockFrame title="ข้อมูลนักศึกษา › รายละเอียด">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}><b style={{ fontSize: 16 }}>นางสาวกานดา ตัวอย่าง</b><div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>ห้อง A · ปีการศึกษา 2572</div></div>
        <Btn dm="edit-btn"><Icon name="edit" size={14} /> แก้ไขข้อมูล</Btn><Btn kind="danger"><Icon name="trash" size={14} /> ลบนักศึกษา</Btn>
      </div>
      <div className="card" style={{ padding: 12, fontSize: 13.5, color: 'var(--ink-600)' }}>ผลสอบรายวิชา — ยังไม่มีรอบที่ส่งผลสอบ</div>
      {done >= 1 && done < 3 && (
        <MockModal title="แก้ไขข้อมูลนักศึกษา" footer={<><Btn>ยกเลิก</Btn><Btn dm="edit-save" kind="primary">บันทึก</Btn></>}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="อีเมล" style={{ flex: 1 }}><Box>kanda@email.com</Box></Field>
            <Field label="เบอร์โทร" style={{ flex: 1 }}><Box dm="edit-phone">{done >= 2 ? <MockTyped text="0812345678" /> : '0899999999'}</Box></Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Field label="ห้องเรียน" style={{ flex: 1 }}><Sel>A</Sel></Field>
            <Field label="ปีการศึกษาที่จบ (พ.ศ.)" style={{ flex: 1 }}><Box>2572</Box></Field>
          </div>
          <div style={{ marginTop: 6 }}><Hint>ระบบคำนวณจากรหัสนักศึกษาได้ 2572 — แก้ได้ถ้าซ้ำชั้นหรือลาพัก</Hint></div>
        </MockModal>
      )}
      <MockToast show={done >= 3}>แก้ไขข้อมูลนักศึกษาเรียบร้อย</MockToast>
    </MockFrame>
  ),
};

/* ============ 7) ลบนักศึกษาที่มีผลสอบแล้ว ============ */
const deleteStudentDemo = {
  title: 'การลบนักศึกษาที่มีผลสอบในระบบแล้ว (ต้องยืนยันด้วยความระมัดระวัง)',
  height: 440,
  steps: [
    { target: 'del-btn', text: 'ที่หน้า "ข้อมูลนักศึกษา" คลิก "ลบ" ที่แถวของนักศึกษา (ลบได้ทุกกรณี รวมผู้ที่มีผลสอบแล้ว)' },
    { target: 'del-warn', text: 'อ่านคำเตือนสีแดง: การลบจะลบผลสอบ เอกสาร และประวัติการตรวจของบุคคลนี้ทั้งหมด สถิติของรุ่นเปลี่ยนย้อนหลัง และกู้คืนไม่ได้' },
    { target: 'del-confirm', text: 'หากแน่ใจ คลิก "ลบ" (ควรเก็บสำเนารายงาน PDF ของรอบนั้นไว้ก่อน) หากไม่แน่ใจให้คลิก "ยกเลิก"', hold: 2200 },
  ],
  stage: (done) => (
    <MockFrame title="ข้อมูลนักศึกษา">
      <StudentTable
        rows={done >= 3 ? STUDENTS.filter(([id]) => id !== '6610210202') : STUDENTS}
        eligible={() => true}
        extra={(id) => <Btn dm={id === '6610210202' ? 'del-btn' : undefined}><Icon name="trash" size={13} /> ลบ</Btn>}
      />
      {done >= 1 && done < 3 && (
        <MockModal title="ลบนักศึกษาออกจากระบบ?" tone="var(--status-reject-fg)" footer={<><Btn>ยกเลิก</Btn><Btn dm="del-confirm" kind="danger"><Icon name="trash" size={13} /> ลบ</Btn></>}>
          <div style={{ fontSize: 14 }}>ลบ นายสมชาย จำลอง (6610210202) พร้อมบัญชีเข้าใช้งาน กู้คืนไม่ได้</div>
          <div data-demo="del-warn" style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--status-reject-bg)', color: 'var(--status-reject-fg)', fontSize: 13, lineHeight: 1.6, fontWeight: 600 }}>{DELETE_WARN}</div>
        </MockModal>
      )}
      <MockToast show={done >= 3}>ลบ นายสมชาย ออกจากระบบแล้ว</MockToast>
    </MockFrame>
  ),
};

/* ============ 8) เลื่อนวันปิดรอบ / เปิดรอบที่ปิดแล้วอีกครั้ง ============ */
const extendRoundDemo = {
  title: 'การเลื่อนวันปิดรอบ หรือเปิดรอบที่ปิดไปแล้วอีกครั้ง (ให้นักศึกษาแก้ผลสอบได้)',
  height: 470,
  steps: [
    { target: 'edit-round', text: 'ที่เมนู "รอบการกรอก & รายวิชา" คลิกไอคอนแก้ไขที่รอบที่สถานะเป็น "ปิดรับ" หรือ "เลยกำหนดปิดแล้ว"' },
    { target: 'close-date', text: 'แก้ "วันที่ปิดรับ" ให้เป็นวันที่ในอนาคต (ระบบไม่ยอมเปิดรอบที่ปิดรับไปแล้ว)' },
    { target: 'open-status', text: 'ติ๊ก "สถานะ: เปิดใช้งาน" (ถ้ารอบอื่นเปิดค้างอยู่ ต้องปิดรอบนั้นก่อน เพราะเปิดรับได้ทีละรอบเดียว)' },
    { target: 'save', text: 'คลิก "บันทึก" รอบกลับเป็น "เปิดรับอยู่" นักศึกษาที่ใบรอตรวจสอบหรือถูกตีกลับแก้ไขและส่งใหม่ได้', hold: 2200 },
  ],
  stage: (done) => (
    <MockFrame title="จัดการรอบการกรอก และรายวิชา">
      <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        {done >= 4 ? <MockBadge tone="ok">เปิดรับอยู่</MockBadge> : <MockBadge tone="draft">ปิดรับ</MockBadge>}
        <div style={{ flex: 1 }}><b>รอบที่ 1 / 2569</b><div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>เปิดรับ 1 ก.ย. 2569 ปิดรับ {done >= 4 ? '30 ต.ค. 2569 23:59' : '20 ก.ย. 2569 23:59'}</div></div>
        <span data-demo="edit-round" style={{ padding: 7, color: 'var(--ink-600)' }}><Icon name="edit" size={17} /></span>
        <span style={{ padding: 7, color: 'var(--fail)' }}><Icon name="trash" size={17} /></span>
      </div>
      {done >= 1 && done < 4 && (
        <MockModal title="แก้ไขรอบที่ 1/2569" footer={<><Btn>ยกเลิก</Btn><Btn dm="save" kind="primary">บันทึก</Btn></>}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="วันที่เปิดรับ *" style={{ flex: 1 }}><Box>1/9/2569 00:00</Box></Field>
            <Field label="วันที่ปิดรับ *" style={{ flex: 1 }}><Box dm="close-date">{done >= 2 ? <MockTyped text="30/10/2569 23:59" /> : '20/9/2569 23:59'}</Box></Field>
          </div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
            <span className="mn-check" data-demo="open-status" data-on={done >= 3 ? '1' : '0'} style={{ width: 18, height: 18 }}>{done >= 3 ? '✓' : ''}</span>สถานะ: เปิดใช้งาน
          </div>
          <div style={{ marginTop: 8 }}><Hint>รอบที่เปิดรับอยู่ แก้ไขรายวิชาไม่ได้ — ปิดรอบก่อนถึงจะแก้ได้</Hint></div>
        </MockModal>
      )}
      <MockToast show={done >= 4}>บันทึกการแก้ไขเรียบร้อย</MockToast>
    </MockFrame>
  ),
};

/* ============ 9) เพิ่มรายวิชา ============ */
const subjectDemo = {
  title: 'การเพิ่มรายวิชาที่ใช้สอบ',
  height: 400,
  steps: [
    { target: 'tab-subjects', text: 'ที่เมนู "รอบการกรอก & รายวิชา" คลิกแท็บ "รายวิชา"' },
    { target: 'add-subject', text: 'คลิก "เพิ่มรายวิชา"' },
    { target: 'subject-code', text: 'กรอก "รหัสวิชา" (ต้องไม่ซ้ำกับวิชาอื่น) และ "ชื่อวิชา"' },
    { target: 'subject-save', text: 'คลิก "บันทึก" วิชาที่เพิ่มแล้วจึงเลือกใช้ในรอบสอบได้ (ลบวิชาไม่ได้ถ้ามีผลสอบหรือถูกใช้ในรอบอยู่แล้ว)', hold: 2000 },
  ],
  stage: (done) => (
    <MockFrame title="จัดการรอบการกรอก และรายวิชา">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'inline-flex', gap: 3, padding: 4, background: 'var(--ink-100)', borderRadius: 12 }}>
          <span style={{ padding: '5px 13px', borderRadius: 9, fontSize: 13.5, fontWeight: 700, background: done < 1 ? '#fff' : 'transparent' }}>รอบการกรอก</span>
          <span data-demo="tab-subjects" style={{ padding: '5px 13px', borderRadius: 9, fontSize: 13.5, fontWeight: 700, background: done >= 1 ? '#fff' : 'transparent' }}>รายวิชา</span>
        </div>
        <span style={{ flex: 1 }} />
        {done >= 1 && <Btn dm="add-subject" kind="primary"><Icon name="plus" size={14} /> เพิ่มรายวิชา</Btn>}
      </div>
      {done >= 1 ? (
        <div className="card mn-pop" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="mn-th"><span style={{ width: 50 }}>ลำดับ</span><span style={{ width: 100 }}>รหัสวิชา</span><span style={{ flex: 1 }}>ชื่อวิชา</span></div>
          {[['1', 'NUR01', 'การผดุงครรภ์'], ['2', 'NUR02', 'การพยาบาลมารดาและทารก'], ...(done >= 4 ? [['3', 'NUR09', 'การพยาบาลชุมชน']] : [])].map(([n, c, name]) => (
            <div key={c} className="mn-tr"><span style={{ width: 50 }}>{n}</span><span className="mono" style={{ width: 100 }}>{c}</span><span style={{ flex: 1 }}>{name}</span></div>
          ))}
        </div>
      ) : <div className="card" style={{ padding: 14, color: 'var(--ink-500)', fontSize: 14 }}>รอบการกรอกทั้งหมด</div>}
      {done >= 2 && done < 4 && (
        <MockModal title="เพิ่มรายวิชา" footer={<><Btn>ยกเลิก</Btn><Btn dm="subject-save" kind="primary">บันทึก</Btn></>}>
          <Field label="รหัสวิชา"><Box dm="subject-code">{done >= 3 ? <MockTyped text="NUR09" /> : <Empty>เช่น NUR09</Empty>}</Box></Field>
          <Field label="ชื่อวิชา" style={{ marginTop: 8 }}><Box>{done >= 3 ? <MockTyped text="การพยาบาลชุมชน" /> : <Empty>ชื่อรายวิชา</Empty>}</Box></Field>
        </MockModal>
      )}
      <MockToast show={done >= 4}>บันทึกรายวิชาเรียบร้อย</MockToast>
    </MockFrame>
  ),
};

/* ============ 10) เพิ่มผู้ใช้งาน (เจ้าหน้าที่ / ผู้ช่วยตรวจสอบ / ผู้บริหาร) ============ */
const userRows = (extra) => [
  ['สมหญิง ใจดี', 'staff01', 'เจ้าหน้าที่คณะ', 'ใช้งานได้', 'ok'],
  ['ประเสริฐ ผู้บริหาร', 'exec01', 'ผู้บริหารคณะ', 'ใช้งานได้', 'ok'],
  ...(extra ? [extra] : []),
];
function UsersTable({ extra, action }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="mn-th"><span style={{ flex: 1.5 }}>ชื่อ-นามสกุล</span><span style={{ flex: 1 }}>รหัสผู้ใช้</span><span style={{ flex: 1.2 }}>บทบาท</span><span style={{ flex: 1.2 }}>สถานะบัญชี</span><span style={{ flex: 1.7 }} /></div>
      {userRows(extra).map(([name, uid, role, st, tone]) => (
        <div key={uid} className="mn-tr">
          <span style={{ flex: 1.5 }}><b>{name}</b></span><span className="mono" style={{ flex: 1 }}>{uid}</span><span style={{ flex: 1.2 }}>{role}</span>
          <span style={{ flex: 1.2 }}><MockBadge tone={tone}>{st}</MockBadge></span>
          <span style={{ flex: 1.7, display: 'flex', gap: 5, justifyContent: 'flex-end' }}>{action?.(uid)}</span>
        </div>
      ))}
    </div>
  );
}
const userAddDemo = {
  title: 'การเพิ่มผู้ใช้งาน (เจ้าหน้าที่คณะ / ผู้ช่วยตรวจสอบ / ผู้บริหารคณะ)',
  height: 470,
  steps: [
    { target: 'add-user', text: 'ที่เมนู "จัดการผู้ใช้งาน" คลิก "เพิ่มผู้ใช้งาน"' },
    { target: 'u-role', text: 'เลือก "บทบาท" ของบัญชี (เจ้าหน้าที่คณะ ผู้ช่วยตรวจสอบ หรือผู้บริหารคณะ — ใต้ช่องมีคำอธิบายสิทธิ์ของแต่ละบทบาท) แล้วกรอกรหัสผู้ใช้ และ "รหัสผ่านชั่วคราว" อย่างน้อย 8 ตัวอักษร' },
    { target: 'u-save', text: 'กรอกชื่อ-นามสกุล (เจ้าหน้าที่คณะและผู้ช่วยตรวจสอบกรอกอีเมลและเบอร์โทรด้วย ส่วนผู้บริหารไม่ต้องกรอก) แล้วคลิก "เพิ่มผู้ใช้งาน" ผู้ใช้ต้องตั้งรหัสผ่านใหม่เองเมื่อเข้าสู่ระบบครั้งแรก (สถานะ "รอตั้งรหัสผ่าน")', hold: 2200 },
  ],
  stage: (done) => (
    <MockFrame title="จัดการผู้ใช้งาน">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><Btn dm="add-user" kind="primary"><Icon name="plus" size={14} /> เพิ่มผู้ใช้งาน</Btn></div>
      <UsersTable extra={done >= 3 ? ['วรรณา ใหม่', 'staff02', 'ผู้ช่วยตรวจสอบ', 'รอตั้งรหัสผ่าน', 'wait'] : null} />
      {done >= 1 && done < 3 && (
        <MockModal title="เพิ่มผู้ใช้งาน" footer={<><Btn>ยกเลิก</Btn><Btn dm="u-save" kind="primary">เพิ่มผู้ใช้งาน</Btn></>}>
          <Field label="บทบาท"><Sel dm="u-role">{done >= 2 ? 'ผู้ช่วยตรวจสอบ' : 'ผู้บริหารคณะ'}</Sel></Field>
          <div style={{ marginTop: 4 }}><Hint>{done >= 2
            ? 'ผู้ช่วยตรวจสอบ — ตรวจสอบ ยืนยัน หรือตีกลับผลสอบได้เท่านั้น ไม่เห็นเมนูจัดการอื่น'
            : 'ผู้บริหารคณะ — ดูแดชบอร์ดและรายงานสรุปได้อย่างเดียว'}</Hint></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Field label="รหัสผู้ใช้ (สำหรับเข้าสู่ระบบ)" style={{ flex: 1 }}><Box>{done >= 2 ? 'staff02' : <Empty>เช่น รหัสพนักงาน</Empty>}</Box></Field>
            <Field label="รหัสผ่านชั่วคราว" style={{ flex: 1 }}><Box>{done >= 2 ? 'Temp#2569' : <Empty>อย่างน้อย 8 ตัวอักษร</Empty>}</Box></Field>
          </div>
          <div style={{ marginTop: 6 }}><Hint>ผู้ใช้ต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก · กรอกชื่อ-นามสกุลต่อด้านล่าง</Hint></div>
        </MockModal>
      )}
      <MockToast show={done >= 3}>เพิ่มผู้ใช้งานเรียบร้อย — บัญชีต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก</MockToast>
    </MockFrame>
  ),
};

/* ============ 11) รีเซ็ตรหัสผ่าน / ถอนสิทธิ์ผู้ใช้งาน ============ */
const userAccessDemo = {
  title: 'การรีเซ็ตรหัสผ่านและการถอนสิทธิ์ผู้ใช้งาน',
  height: 470,
  steps: [
    { target: 'u-reset', text: 'กรณีผู้ใช้ลืมรหัสผ่าน คลิก "รีเซ็ตรหัส" ที่แถวของผู้ใช้ (ใช้กับบัญชีตนเองไม่ได้)' },
    { target: 'u-newpw', text: 'กรอก "รหัสผ่านชั่วคราวใหม่" อย่างน้อย 8 ตัวอักษร (รหัสเดิมจะใช้เข้าสู่ระบบไม่ได้อีกทันที)' },
    { target: 'u-reset-confirm', text: 'คลิก "รีเซ็ตรหัส" แจ้งรหัสชั่วคราวให้ผู้ใช้ทราบ ผู้ใช้ต้องเปลี่ยนรหัสผ่านเองเมื่อเข้าสู่ระบบครั้งถัดไป' },
    { target: 'u-revoke', text: 'กรณีผู้ใช้พ้นหน้าที่ คลิก "ถอนสิทธิ์" ที่แถวของผู้ใช้ เพื่อระงับการเข้าสู่ระบบ' },
    { target: 'u-revoke-confirm', text: 'ตรวจชื่อในหน้าต่างยืนยัน แล้วคลิก "ถอนสิทธิ์" บัญชีและประวัติการทำงานยังอยู่ครบ แต่เข้าสู่ระบบไม่ได้อีก', hold: 2200 },
  ],
  stage: (done) => (
    <MockFrame title="จัดการผู้ใช้งาน">
      <UsersTable action={(uid) => uid === 'staff01' ? (
        <><Btn dm="u-reset"><Icon name="key" size={13} /> รีเซ็ตรหัส</Btn><Btn dm="u-revoke" kind="danger"><Icon name="trash" size={13} /> ถอนสิทธิ์</Btn></>
      ) : null} />
      {(done === 1 || done === 2) && (
        <MockModal title="รีเซ็ตรหัสผ่าน?" footer={<><Btn>ยกเลิก</Btn><Btn dm="u-reset-confirm" kind="primary">รีเซ็ตรหัส</Btn></>}>
          <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>สมหญิง ใจดี จะเข้าสู่ระบบด้วยรหัสเดิมไม่ได้อีก ต้องใช้รหัสชั่วคราวที่ตั้งด้านล่างแทน แล้วเปลี่ยนเองเมื่อเข้าสู่ระบบครั้งถัดไป</div>
          <Field label="รหัสผ่านชั่วคราวใหม่" style={{ marginTop: 9 }}><Box dm="u-newpw">{done >= 2 ? <MockTyped text="Temp#2570" /> : <Empty>อย่างน้อย 8 ตัวอักษร</Empty>}</Box></Field>
        </MockModal>
      )}
      {done === 4 && (
        <MockModal title="ถอนสิทธิ์ผู้ใช้?" tone="var(--status-reject-fg)" footer={<><Btn>ยกเลิก</Btn><Btn dm="u-revoke-confirm" kind="danger">ถอนสิทธิ์</Btn></>}>
          <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>สมหญิง ใจดี จะเข้าสู่ระบบไม่ได้อีกจนกว่าเจ้าหน้าที่จะเปิดให้ใหม่ บัญชีและประวัติที่เคยทำไว้ยังอยู่ครบ ไม่ได้ถูกลบ</div>
        </MockModal>
      )}
      <MockToast show={done === 3}>รีเซ็ตรหัสผ่านของ สมหญิง แล้ว</MockToast>
      <MockToast show={done >= 5}>ถอนสิทธิ์เรียบร้อย</MockToast>
    </MockFrame>
  ),
};

/* ============ 12) เขียนประกาศ ============ */
const newsDemo = {
  title: 'การโพสต์ข่าวสารและประกาศถึงนักศึกษา',
  height: 470,
  steps: [
    { target: 'write', text: 'ที่เมนู "ข่าวสาร / ประกาศ" คลิก "เขียนประกาศ"' },
    { target: 'news-title', text: 'กรอก "หัวข้อประกาศ" และ "เนื้อหา" เลือก "รอบที่เกี่ยวข้อง" (จำเป็น — นักศึกษาเห็นเฉพาะประกาศของรอบในรุ่นของตนเอง) และแนบรูปภาพประกอบได้ 1 รูป (ไม่บังคับ)' },
    { target: 'publish', text: 'คลิก "เผยแพร่" ประกาศแสดงแก่นักศึกษาทันที แก้ไขหรือลบภายหลังได้', hold: 2200 },
  ],
  stage: (done) => (
    <MockFrame title="ข่าวสาร / ประกาศ">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ flex: 1, fontSize: 14, color: 'var(--ink-600)' }}>โพสต์ประกาศถึงนักศึกษาในแต่ละรอบการกรอก</span>
        <Btn dm="write" kind="primary"><Icon name="plus" size={14} /> เขียนประกาศ</Btn>
      </div>
      {done >= 3 && (
        <div className="card mn-pop" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}><b>กำหนดยื่นผลสอบรอบที่ 1/2569</b><div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>รอบที่ 1 / 2569 · เผยแพร่วันนี้</div></div>
          <Btn>แก้ไข</Btn><Btn kind="danger"><Icon name="trash" size={13} /></Btn>
        </div>
      )}
      {done < 3 && done < 1 && <div className="card" style={{ padding: 14, color: 'var(--ink-500)', fontSize: 14 }}>ยังไม่มีประกาศ</div>}
      {done >= 1 && done < 3 && (
        <MockModal title="เขียนประกาศใหม่" footer={<><Btn>ยกเลิก</Btn><Btn dm="publish" kind="primary">เผยแพร่</Btn></>}>
          <Field label="หัวข้อประกาศ"><Box dm="news-title">{done >= 2 ? <MockTyped text="กำหนดยื่นผลสอบรอบที่ 1/2569" /> : <Empty>หัวข้อ…</Empty>}</Box></Field>
          <Field label="รอบที่เกี่ยวข้อง" style={{ marginTop: 8 }}><Sel>รอบที่ 1 / 2569</Sel></Field>
          <Field label="เนื้อหา" style={{ marginTop: 8 }}><Box style={{ minHeight: 44 }}>{done >= 2 ? 'ขอให้นักศึกษายื่นผลสอบภายในวันที่ 30 ต.ค. 2569' : <Empty>รายละเอียดประกาศ…</Empty>}</Box></Field>
        </MockModal>
      )}
      <MockToast show={done >= 3}>เผยแพร่ประกาศเรียบร้อย</MockToast>
    </MockFrame>
  ),
};

/* ============ 13) รายงานสรุป: ดูรายชื่อ + ดาวน์โหลด PDF ============ */
const reportDemo = {
  title: 'การดูรายงานสรุป ดูรายชื่อรายวิชา และดาวน์โหลด PDF',
  height: 440,
  steps: [
    { target: 'pick-round', text: 'ที่เมนู "รายงานสรุป" เลือกปีการศึกษาและรอบสอบที่ต้องการ ตัวเลขทั้งหน้าเปลี่ยนตามที่เลือก' },
    { target: 'pass-num', text: 'ในตารางรายวิชา คลิกตัวเลข "ผ่าน" หรือ "ไม่ผ่าน" เพื่อดูรายชื่อนักศึกษาของวิชานั้น (นับจากใบที่ยืนยันแล้ว)' },
    { target: 'dl-list', text: 'ในหน้าต่างรายชื่อ คลิก "ส่งออก" แล้วเลือก PDF หรือ Excel เพื่อเก็บรายชื่อเป็นไฟล์' },
    { target: 'dl-report', text: 'ปิดหน้าต่าง แล้วคลิก "ดาวน์โหลด PDF" ที่มุมขวาบนเพื่อออกรายงานสรุปทั้งฉบับ (หรือคลิก "พิมพ์" เพื่อพิมพ์จากเบราว์เซอร์) — ไฟล์อื่นๆ ทั้งหมดอยู่ในแผง "ส่งออกข้อมูล" (ดูข้อ 10.2)', hold: 2200 },
  ],
  stage: (done) => (
    <MockFrame title="รายงานสรุปผลการสอบ">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Sel dm="pick-round" style={{ width: 190 }}>รอบที่ 1 / 2569</Sel>
        <span style={{ flex: 1 }} />
        <Btn><Icon name="printer" size={14} /> พิมพ์</Btn>
        <Btn dm="dl-report" kind="primary"><Icon name="pdf" size={14} /> ดาวน์โหลด PDF</Btn>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="mn-th"><span style={{ width: 60 }}>รหัส</span><span style={{ flex: 1 }}>รายวิชา</span><span style={{ width: 60 }}>ผ่าน</span><span style={{ width: 70 }}>ไม่ผ่าน</span><span style={{ width: 80 }}>อัตราผ่าน</span></div>
        {[['NUR01', 'การผดุงครรภ์', 42, 3, '93%'], ['NUR02', 'การพยาบาลมารดาและทารก', 40, 5, '89%']].map(([c, n, p, f, r], k) => (
          <div key={c} className="mn-tr">
            <span className="mono" style={{ width: 60 }}>{c}</span><span style={{ flex: 1 }}>{n}</span>
            <span data-demo={k === 0 ? 'pass-num' : undefined} style={{ width: 60, color: 'var(--pass)', fontWeight: 800, textDecoration: 'underline' }}>{p}</span>
            <span style={{ width: 70, color: 'var(--fail)', fontWeight: 800, textDecoration: 'underline' }}>{f}</span><span style={{ width: 80 }}>{r}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 6 }}>คลิกตัวเลขในตาราง "ผ่าน"/"ไม่ผ่าน" เพื่อดูรายชื่อ</div>
      {done === 2 && (
        <MockModal title="นักศึกษาที่สอบผ่าน การผดุงครรภ์" footer={<><Btn>ปิด</Btn><Btn dm="dl-list"><Icon name="download" size={14} /> ส่งออก ▾</Btn></>}>
          <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 6 }}>พบ 42 คน</div>
          {[['6610210201', 'นางสาวกานดา ตัวอย่าง'], ['6610210202', 'นายสมชาย จำลอง'], ['6610210203', 'นางสาวมาลี ทดสอบ']].map(([id, nm]) => (
            <div key={id} style={{ display: 'flex', gap: 10, padding: '5px 0', borderTop: '1px solid var(--ink-100)', fontSize: 13.5 }}><span className="mono" style={{ width: 96, color: 'var(--ink-500)' }}>{id}</span>{nm}</div>
          ))}
        </MockModal>
      )}
      <MockToast show={done >= 3}>กำลังสร้างไฟล์ PDF…</MockToast>
    </MockFrame>
  ),
};

/* ============ 13.1) ดูรายชื่อผ่าน/ไม่ผ่านรายวิชาบนแดชบอร์ด ============ */
const dashSubjectDemo = {
  title: 'การดูรายชื่อนักศึกษาที่ผ่าน / ไม่ผ่านรายวิชา บนแดชบอร์ด',
  height: 440,
  steps: [
    { target: 'dash-subject-tab', text: 'ที่เมนู "แดชบอร์ด" เลือกรอบ (หรือ "รวมทั้งปี") แล้วคลิกแท็บ "อัตราผ่านรายวิชา"' },
    { target: 'dash-fail-num', text: 'คลิกตัวเลข "ผ่าน" หรือ "ไม่ผ่าน" ของวิชาที่ต้องการ (มีคำแนะนำ "กดตัวเลข…" อยู่ใต้กราฟ)' },
    { target: 'dash-export', text: 'หน้าต่างรายชื่อแสดงชื่อ รหัส และห้อง คลิก "ส่งออก" เพื่อเก็บรายชื่อเป็น Excel หรือ PDF', hold: 2200 },
  ],
  stage: (done) => (
    <MockFrame title="แดชบอร์ด">
      <div style={{ display: 'inline-flex', gap: 3, padding: 4, background: 'var(--ink-100)', borderRadius: 12, marginBottom: 10 }}>
        <span style={{ padding: '5px 13px', borderRadius: 9, fontSize: 13.5, fontWeight: 700, background: done < 1 ? '#fff' : 'transparent' }}>สัดส่วนสถานะ</span>
        <span data-demo="dash-subject-tab" style={{ padding: '5px 13px', borderRadius: 9, fontSize: 13.5, fontWeight: 700, background: done >= 1 ? '#fff' : 'transparent' }}>อัตราผ่านรายวิชา</span>
      </div>
      {done >= 1 ? (
        <div className="card mn-pop" style={{ padding: 12 }}>
          {[['1101 · การผดุงครรภ์', '93%', 42, 3], ['1102 · การพยาบาลมารดาและทารก', '89%', 40, 5]].map(([name, rate, p, f], k) => (
            <div key={name} style={{ padding: '6px 0', borderTop: k ? '1px solid var(--ink-100)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 600 }}><span>{name}</span><span>{rate}</span></div>
              <div style={{ display: 'flex', gap: 14, fontSize: 13, marginTop: 3 }}>
                <span style={{ color: 'var(--pass)', fontWeight: 700, textDecoration: 'underline' }}>ผ่าน {p} คน</span>
                <span data-demo={k === 0 ? 'dash-fail-num' : undefined} style={{ color: 'var(--fail)', fontWeight: 700, textDecoration: 'underline' }}>ไม่ผ่าน {f} คน</span>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 8 }}>กดตัวเลข "ผ่าน" หรือ "ไม่ผ่าน" ของแต่ละวิชา เพื่อดูรายชื่อนักศึกษา และดาวน์โหลดเป็นไฟล์ Excel หรือ PDF</div>
        </div>
      ) : <div className="card" style={{ padding: 14, color: 'var(--ink-500)', fontSize: 14 }}>สัดส่วนสถานะของรอบที่เลือก</div>}
      {done >= 2 && done < 3 && (
        <MockModal title="นักศึกษาที่ไม่ผ่าน การผดุงครรภ์" footer={<><Btn>ปิด</Btn><Btn dm="dash-export"><Icon name="download" size={14} /> ส่งออก ▾</Btn></>}>
          <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 6 }}>พบ 3 คน · รอบ 1/2569</div>
          {[['6610210211', 'นางสาวสุนิสา ตัวอย่าง', 'ห้องเรียนปกติ'], ['6610210212', 'นายวีระ จำลอง', 'ห้องเรียนอังกฤษ'], ['6610210213', 'นางสาวพิมพ์ ทดสอบ', 'ห้องเรียนปกติ']].map(([id, nm, room]) => (
            <div key={id} style={{ display: 'flex', gap: 10, padding: '5px 0', borderTop: '1px solid var(--ink-100)', fontSize: 13.5 }}><span className="mono" style={{ width: 96, color: 'var(--ink-500)' }}>{id}</span><span style={{ flex: 1 }}>{nm}</span><span style={{ color: 'var(--ink-500)' }}>{room}</span></div>
          ))}
        </MockModal>
      )}
      <MockToast show={done >= 3}>กำลังสร้างไฟล์…</MockToast>
    </MockFrame>
  ),
};

/* ============ 14) ส่งออกรายชื่อระดับปี (ผ่าน/ไม่ผ่านครั้งแรก, ผ่าน/ไม่ผ่านภายในปีแรก) จากแผง "ส่งออกข้อมูล" ============ */
const exportPanelDemo = {
  title: 'การส่งออกรายชื่อนักศึกษาที่สอบผ่าน / ไม่ผ่าน (ครั้งแรก และภายในปีแรก) ของปีการศึกษา',
  height: 430,
  steps: [
    { target: 'pick-round', text: 'ที่เมนู "รายงานสรุป" เลือกปีการศึกษาที่ต้องการ (รายชื่อระดับปีเป็นของทั้งปี ไม่ผูกกับรอบที่เลือก)' },
    { target: 'exp-fail', text: 'ในแผง "ส่งออกข้อมูล" คลิก "ส่งออก" ที่แถว "รายชื่อนักศึกษาที่สอบไม่ผ่านภายในปีแรก" (แถวผ่าน/ไม่ผ่านครั้งแรก และผ่านภายในปีแรก ใช้วิธีเดียวกัน)' },
    { target: 'exp-xlsx', text: 'เลือกรูปแบบไฟล์ Excel (.xlsx) หรือ PDF ระบบสร้างไฟล์และดาวน์โหลดให้ทันที', hold: 2200 },
  ],
  stage: (done) => (
    <MockFrame title="รายงานสรุปผลการสอบ">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Sel dm="pick-round" style={{ width: 160 }}>ปีการศึกษา 2569</Sel>
        <span style={{ flex: 1 }} />
        <Btn><Icon name="printer" size={14} /> พิมพ์</Btn>
      </div>
      <div className="card" style={{ padding: '10px 14px' }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>ส่งออกข้อมูล</div>
        {[
          ['รายชื่อนักศึกษาที่สอบผ่านครั้งแรก ปี 2569', 'ผ่านครบทุกวิชาตั้งแต่รอบที่ 1', false],
          ['รายชื่อนักศึกษาที่สอบไม่ผ่านครั้งแรก ปี 2569', 'รวมคนที่ยังไม่ส่งผลหรือถูกตีกลับ มีคอลัมน์บอกสาเหตุ', false],
          ['รายชื่อนักศึกษาที่สอบผ่านภายในปีแรก ปี 2569', 'ผ่านครบทุกวิชาในรอบใดรอบหนึ่งของปี (รวมรอบที่ 2 และ 3)', false],
          ['รายชื่อนักศึกษาที่สอบไม่ผ่านภายในปีแรก ปี 2569', 'ยังไม่ผ่านครบทุกวิชาภายในปีนั้น', true],
          ['ข้อมูลนักศึกษาทั้งรุ่น 2569', '', false],
        ].map(([title, sub, target]) => (
          <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid var(--ink-100)', position: 'relative' }}>
            <div style={{ flex: 1 }}><b style={{ fontSize: 13.5 }}>{title}</b>{sub && <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{sub}</div>}</div>
            <span style={{ position: 'relative' }}>
              <Btn dm={target ? 'exp-fail' : undefined}><Icon name="download" size={13} /> ส่งออก ▾</Btn>
              {target && done === 2 && (
                <div className="mn-pop" style={{ position: 'absolute', right: 0, bottom: '100%', marginBottom: 4, zIndex: 6, width: 150, background: '#fff', border: '1px solid var(--ink-200)', borderRadius: 10, boxShadow: 'var(--sh-lg)', padding: 4, fontSize: 13.5 }}>
                  <div data-demo="exp-xlsx" style={{ padding: '6px 10px', borderRadius: 7, background: 'var(--ink-100)' }}>Excel (.xlsx)</div>
                  <div style={{ padding: '6px 10px' }}>PDF</div>
                </div>
              )}
            </span>
          </div>
        ))}
      </div>
      <MockToast show={done >= 3}>ดาวน์โหลด รายชื่อนักศึกษาไม่ผ่านภายในปีแรก-2569.xlsx</MockToast>
    </MockFrame>
  ),
};

export const MORE_DEMOS = {
  manualAdd: manualAddDemo,
  mapping: mappingDemo,
  skipped: skippedDemo,
  eligible: eligibleDemo,
  resetStudent: resetStudentDemo,
  editStudent: editStudentDemo,
  deleteStudent: deleteStudentDemo,
  extendRound: extendRoundDemo,
  subject: subjectDemo,
  userAdd: userAddDemo,
  userAccess: userAccessDemo,
  news: newsDemo,
  report: reportDemo,
  dashSubject: dashSubjectDemo,
  exportPanel: exportPanelDemo,
};
