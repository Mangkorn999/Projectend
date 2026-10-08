/* ============================================================
   สคริปต์ภาพเคลื่อนไหวสาธิตวิธีใช้ของหน้าคู่มือ — แต่ละเรื่อง = { title, steps, stage }
     steps[k] = { target, text, hold? }
        target = ชื่อ data-demo ของปุ่มที่เมาส์จะไปคลิก (ต้องมีอยู่บนหน้าจอจำลอง ณ ตอนที่ทำขั้นนั้น)
        text   = คำอธิบายขั้นตอน (ใช้ทั้งใต้ภาพและเป็นข้อความสำหรับโปรแกรมอ่านหน้าจอ/พิมพ์)
     stage(done) = หน้าจอจำลองเมื่อคลิกไปแล้ว done ขั้น (done = 0 คือก่อนคลิกอะไรเลย)

   ตอนแก้ UI จริงของระบบ ให้มาแก้ข้อความ/ลำดับที่ไฟล์นี้ให้ตรงกัน
   ============================================================ */
import { Icon } from './data.jsx';
import { StepDemo, MockFrame, MockToast, MockTyped, MockModal, MockBadge, Field, Box, Btn } from './manualDemo.jsx';
import { MORE_DEMOS } from './manualDemosMore.jsx';
import { useManualLang, translateNode } from './manualDemoEn.js';

/* ---------- หน้ารายละเอียดนักศึกษา (ใช้ในเดโม ตรวจ/ตีกลับ/แก้ไขผลการตรวจ) ---------- */
const SUBJECTS = [['1101', 'การผดุงครรภ์', true], ['1102', 'การพยาบาลมารดาและทารก', true], ['1103', 'การพยาบาลเด็กและวัยรุ่น', false]];

function DetailScreen({ status, actions, remark, doc }) {
  const lang = useManualLang();
  const badge = { pending: ['wait', 'รอตรวจสอบ'], approved: ['ok', 'ยืนยันแล้ว'], rejected: ['reject', 'ถูกตีกลับ'] }[status];
  return translateNode((
    <div style={{ display: 'flex', gap: 12, height: '100%' }}>
      <div className="card" style={{ flex: 1, padding: 12, overflow: 'hidden', position: 'relative' }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>นางสาวทดสอบ ตัวอย่าง <span className="mono" style={{ fontWeight: 400, color: 'var(--ink-500)', fontSize: 13 }}>6610210007</span></div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-500)', margin: '2px 0 8px' }}>รอบที่ 2/2569 · ผ่าน 2/3 วิชา</div>
        {SUBJECTS.map(([code, name, pass]) => (
          <div key={code} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: '1px solid var(--ink-100)', fontSize: 13.5 }}>
            <span><span className="mono" style={{ color: 'var(--ink-500)', marginRight: 8 }}>{code}</span>{name}</span>
            <MockBadge tone={pass ? 'ok' : 'reject'}>{pass ? 'ผ่าน' : 'ไม่ผ่าน'}</MockBadge>
          </div>
        ))}
        {/* นักศึกษาแนบได้หลายไฟล์ ทั้ง PDF และรูปถ่าย — แต่ละไฟล์บอกชนิดเอกสาร/ชนิดไฟล์เป็นภาษาไทย */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, padding: '6px 10px', border: '1px solid var(--ink-200)', borderRadius: 10 }}>
          <Icon name="pdf" size={20} style={{ color: 'var(--status-reject-fg)' }} />
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>ใบรายงานผลสอบ.pdf <span style={{ fontWeight: 400, color: 'var(--ink-500)', fontSize: 12 }}>· ใบรายงานผลสอบ · PDF</span></span>
          <Btn dm="view-file"><Icon name="eye" size={14} /> ดู</Btn>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, padding: '6px 10px', border: '1px solid var(--ink-200)', borderRadius: 10 }}>
          <Icon name="image" size={20} style={{ color: 'var(--blue-600)' }} />
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>ถ่ายรูปใบคะแนน.jpg <span style={{ fontWeight: 400, color: 'var(--ink-500)', fontSize: 12 }}>· ใบรายงานผลสอบ · รูปภาพ (JPG)</span></span>
          <Btn><Icon name="eye" size={14} /> ดู</Btn>
        </div>
        {doc && (
          <div className="mn-pop" style={{ position: 'absolute', left: 14, right: 14, bottom: 8, top: 74, background: '#fff', border: '2px solid var(--navy-600)', borderRadius: 10, boxShadow: 'var(--sh-lg)', padding: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--navy-800)', marginBottom: 6 }}>ตัวอย่างเอกสารหลักฐาน</div>
            {[92, 76, 84, 60, 70].map((w, k) => <div key={k} style={{ height: 8, width: `${w}%`, background: 'var(--ink-100)', borderRadius: 4, margin: '7px 0' }} />)}
            <div style={{ fontSize: 12.5, color: 'var(--status-ok-fg)', fontWeight: 700, marginTop: 8 }}>✓ ผลในเอกสารตรงกับที่นักศึกษากรอก</div>
          </div>
        )}
      </div>
      <div className="card" style={{ width: 200, padding: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-500)' }}>สถานะการตรวจสอบ</div>
        <MockBadge tone={badge[0]}>{badge[1]}</MockBadge>
        {remark && <div style={{ padding: '7px 9px', borderRadius: 9, background: 'var(--status-reject-bg)', color: 'var(--status-reject-fg)', fontSize: 12.5 }}><b>เหตุผลการตีกลับ</b><br />{remark}</div>}
        {actions}
      </div>
    </div>
  ), lang);
}
function PendingActions() {
  const lang = useManualLang();
  return translateNode((
    <>
      <Btn dm="approve" kind="success" style={{ width: '100%' }}><Icon name="checkCircle" size={15} /> ยืนยันผลสอบ</Btn>
      <Btn dm="reject" kind="danger" style={{ width: '100%' }}><Icon name="xCircle" size={15} /> ตีกลับเพื่อแก้ไข</Btn>
    </>
  ), lang);
}
function ConfirmedActions() {
  const lang = useManualLang();
  return translateNode((
    <>
      <div style={{ padding: '7px 9px', borderRadius: 9, background: 'var(--status-ok-bg)', color: 'var(--status-ok-fg)', fontSize: 13, fontWeight: 700 }}>✓ ยืนยันแล้ว</div>
      <Btn dm="revoke" style={{ width: '100%' }}><Icon name="edit" size={15} /> แก้ไขผลการตรวจ</Btn>
    </>
  ), lang);
}

/* ============ 1) ตรวจและยืนยันผลสอบ ============ */
const approveDemo = {
  title: 'การตรวจสอบและยืนยันผลสอบ',
  steps: [
    { target: 'row-review', text: 'คลิกปุ่ม "ตรวจสอบ" ที่แถวของนักศึกษาที่อยู่ในสถานะรอตรวจสอบ' },
    { target: 'view-file', text: 'คลิก "ดู" ที่ไฟล์หลักฐานทีละไฟล์ (นักศึกษาแนบได้หลายไฟล์ ทั้ง PDF และรูปถ่าย) แล้วเทียบกับผลรายวิชาที่นักศึกษากรอก' },
    { target: 'approve', text: 'เมื่อถูกต้องครบถ้วน คลิก "ยืนยันผลสอบ" สถานะจะเปลี่ยนเป็น "ยืนยันแล้ว" และนักศึกษาได้รับการแจ้งเตือน', hold: 2000 },
  ],
  stage: (done) => (
    <MockFrame title={done < 1 ? 'ตรวจสอบและยืนยันผล' : 'รายละเอียดนักศึกษา'}>
      {done < 1 ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="mn-th"><span style={{ flex: 2 }}>นักศึกษา</span><span style={{ flex: 1 }}>ผลสอบ</span><span style={{ flex: 1 }}>หลักฐาน</span><span style={{ flex: 1 }}>ส่งเมื่อ</span><span style={{ width: 96 }} /></div>
          {[['นางสาวทดสอบ ตัวอย่าง', '6610210007', '2/3', true, 2], ['นายสมมติ ตัวอย่าง', '6610210039', '3/3', false, 1], ['นางสาวจำลอง ระบบ', '6610210052', '3/3', false, 3]].map(([nm, id, sc, first, files]) => (
            <div key={id} className="mn-tr">
              <span style={{ flex: 2 }}><b>{nm}</b><br /><span className="mono" style={{ fontSize: 12, color: 'var(--ink-500)' }}>{id}</span></span>
              <span style={{ flex: 1, fontWeight: 700 }}>{sc}</span><span style={{ flex: 1, color: 'var(--navy-700)' }}>{files} ไฟล์</span><span style={{ flex: 1 }}>20/9/2569</span>
              <span style={{ width: 96 }}>{first ? <Btn dm="row-review" kind="primary">ตรวจสอบ</Btn> : <Btn>ตรวจสอบ</Btn>}</span>
            </div>
          ))}
        </div>
      ) : (
        <DetailScreen status={done >= 3 ? 'approved' : 'pending'} doc={done === 2} actions={done >= 3 ? <ConfirmedActions /> : <PendingActions />} />
      )}
      <MockToast show={done >= 3}>✓ ยืนยันผลสอบเรียบร้อย</MockToast>
    </MockFrame>
  ),
};

/* ============ 2) ตีกลับพร้อมเหตุผล ============ */
const rejectDemo = {
  title: 'การตีกลับผลสอบเพื่อให้นักศึกษาแก้ไข',
  steps: [
    { target: 'reject', text: 'ในหน้ารายละเอียดนักศึกษา คลิก "ตีกลับเพื่อแก้ไข" เมื่อพบว่าข้อมูลหรือเอกสารไม่ถูกต้อง' },
    { target: 'reason-chip', text: 'ระบุเหตุผลให้นักศึกษาทราบ (บังคับ) — เลือกข้อความสำเร็จรูป หรือพิมพ์เองก็ได้' },
    { target: 'reject-confirm', text: 'คลิก "ยืนยันการตีกลับ" นักศึกษาจะได้รับแจ้งเตือนพร้อมเหตุผล และแก้ไขส่งใหม่ได้ แม้รอบจะปิดรับแล้ว', hold: 2000 },
  ],
  stage: (done) => (
    <MockFrame title="รายละเอียดนักศึกษา">
      <DetailScreen status={done >= 3 ? 'rejected' : 'pending'} remark={done >= 3 ? 'เอกสารไม่ชัดเจน' : undefined} actions={<PendingActions />} />
      {done >= 1 && done < 3 && (
        <MockModal title="ตีกลับผลสอบเพื่อแก้ไข" tone="var(--status-reject-fg)"
          footer={<><Btn>ยกเลิก</Btn><Btn dm="reject-confirm" kind="primary" style={{ background: done >= 2 ? 'var(--fail)' : 'var(--ink-300)', borderColor: 'transparent' }}><Icon name="send" size={14} /> ยืนยันการตีกลับ</Btn></>}>
          <Field label="เหตุผลการตีกลับ (จำเป็น)"><Box style={{ minHeight: 44 }}>{done >= 2 ? <MockTyped text="เอกสารไม่ชัดเจน" /> : <span style={{ color: 'var(--ink-400)' }}>เช่น เอกสารหลักฐานไม่ชัดเจน กรุณาอัปโหลดใหม่</span>}</Box></Field>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <span className="chip" data-demo="reason-chip" style={{ border: '1px solid var(--ink-200)' }}>เอกสารไม่ชัดเจน</span>
            <span className="chip" style={{ border: '1px solid var(--ink-200)' }}>ผลสอบไม่ตรงกับไฟล์</span>
          </div>
        </MockModal>
      )}
      <MockToast show={done >= 3}>ตีกลับเรียบร้อย · แจ้งนักศึกษาแล้ว</MockToast>
    </MockFrame>
  ),
};

/* ============ 3) แก้ไขผลการตรวจ (ยืนยันแล้ว/ถูกตีกลับ → กลับเป็นรอตรวจ) ============ */
const revokeDemo = {
  title: 'การแก้ไขผลการตรวจ (กรณียืนยันหรือตีกลับผิดพลาด)',
  steps: [
    { target: 'revoke', text: 'ในใบที่ "ยืนยันแล้ว" หรือ "ถูกตีกลับ" คลิก "แก้ไขผลการตรวจ" (เฉพาะเจ้าหน้าที่คณะ)' },
    { target: 'revoke-reason', text: 'ระบุเหตุผลที่แก้ไข (บังคับ) ระบบบันทึกประวัติไว้ตรวจย้อนหลัง' },
    { target: 'revoke-confirm', text: 'คลิก "แก้ไขผลการตรวจ" ใบจะกลับเป็น "รอตรวจสอบ" เพื่อยืนยันหรือตีกลับใหม่ และนักศึกษาได้รับแจ้งเตือน', hold: 2000 },
  ],
  stage: (done) => (
    <MockFrame title="รายละเอียดนักศึกษา">
      <DetailScreen status={done >= 3 ? 'pending' : 'approved'} actions={done >= 3 ? <PendingActions /> : <ConfirmedActions />} />
      {done >= 1 && done < 3 && (
        <MockModal title="แก้ไขผลการตรวจ" tone="var(--status-reject-fg)"
          footer={<><Btn>ยกเลิก</Btn><Btn dm="revoke-confirm" kind="primary" style={{ background: done >= 2 ? 'var(--fail)' : 'var(--ink-300)', borderColor: 'transparent' }}><Icon name="send" size={14} /> แก้ไขผลการตรวจ</Btn></>}>
          <div style={{ fontSize: 13, color: 'var(--ink-600)', marginBottom: 8 }}>ใบนี้จะกลับเป็น "รอตรวจสอบ" แล้วยืนยันหรือตีกลับใหม่ได้</div>
          <Field label="เหตุผลที่แก้ไขผลการตรวจ (จำเป็น)"><Box dm="revoke-reason" style={{ minHeight: 44 }}>{done >= 2 ? <MockTyped text="กดยืนยันผิดใบ" /> : <span style={{ color: 'var(--ink-400)' }}>เช่น กดยืนยันผิดใบ</span>}</Box></Field>
        </MockModal>
      )}
      <MockToast show={done >= 3}>แก้ไขผลการตรวจแล้ว · ใบกลับเป็นรอตรวจสอบ</MockToast>
    </MockFrame>
  ),
};

/* ============ 4) นำเข้ารายชื่อ ============ */
const importDemo = {
  title: 'การนำเข้ารายชื่อนักศึกษาจากไฟล์ Excel / Google Form',
  height: 400,
  steps: [
    { target: 'choose-file', text: 'คลิก "เลือกไฟล์ Excel / CSV" แล้วเลือกไฟล์รายชื่อ (แนะนำไฟล์ .xlsx ที่ดาวน์โหลดจาก Google Sheets)' },
    { target: 'check', text: 'คลิก "ตรวจไฟล์" ระบบตรวจทุกแถวโดยยังไม่บันทึกข้อมูล และแจ้งแถวที่มีปัญหาพร้อมเหตุผล' },
    { target: 'confirm', text: 'เมื่อผลการตรวจถูกต้อง คลิก "ยืนยันนำเข้า" ระบบจึงสร้างบัญชีนักศึกษา', hold: 2000 },
  ],
  stage: (done) => (
    <MockFrame title="นำเข้ารายชื่อนักศึกษา">
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn><Icon name="download" size={14} /> โหลดไฟล์ตัวอย่าง</Btn>
          {done < 1
            ? <Btn dm="choose-file"><Icon name="upload" size={14} /> เลือกไฟล์ Excel / CSV</Btn>
            : <span className="mn-pop" style={{ padding: '5px 12px', border: '1px solid var(--ink-200)', borderRadius: 9, fontSize: 14 }}>📄 รายชื่อนักศึกษา.xlsx</span>}
          {done < 2 ? <Btn dm="check" kind="primary">ตรวจไฟล์</Btn>
            : done < 3 ? <><Btn>ยกเลิก</Btn><Btn dm="confirm" kind="primary"><Icon name="checkCircle" size={14} /> ยืนยันนำเข้า 3 คน</Btn></>
            : <span style={{ color: 'var(--status-ok-fg)', fontWeight: 700, fontSize: 14 }}>✓ นำเข้าเรียบร้อย</span>}
        </div>
      </div>
      {done >= 2 && (
        <div className="mn-pop" style={{ marginTop: 10 }}>
          <div style={{ padding: '9px 13px', borderRadius: 10, fontSize: 14, fontWeight: 600, background: done >= 3 ? 'var(--status-ok-bg)' : 'var(--status-wait-bg)', color: done >= 3 ? 'var(--status-ok-fg)' : 'var(--status-wait-fg)' }}>
            {done >= 3 ? 'นำเข้าสำเร็จ 3 คน — นักศึกษาเข้าสู่ระบบด้วยรหัสนักศึกษาและเลขบัตรประชาชน' : 'ตรวจแล้ว — นำเข้าได้ครบทุกแถว 3 คน ยังไม่ได้บันทึก กด "ยืนยันนำเข้า" เพื่อบันทึกจริง'}
          </div>
          <div className="card" style={{ marginTop: 8, padding: 0, overflow: 'hidden' }}>
            <div className="mn-th"><span style={{ flex: 1 }}>ลำดับ</span><span style={{ flex: 2 }}>รหัสนักศึกษา</span><span style={{ flex: 2 }}>สถานะ</span></div>
            {['6610210101', '6610210102', '6610210103'].map((id, k) => (
              <div key={id} className="mn-tr"><span style={{ flex: 1 }}>{k + 1}</span><span className="mono" style={{ flex: 2 }}>{id}</span><span style={{ flex: 2 }}><MockBadge tone={done >= 3 ? 'ok' : 'wait'}>{done >= 3 ? 'นำเข้าแล้ว' : 'พร้อมนำเข้า'}</MockBadge></span></div>
            ))}
          </div>
        </div>
      )}
      <MockToast show={done >= 3}>นำเข้านักศึกษาแล้ว 3 คน</MockToast>
    </MockFrame>
  ),
};

/* ============ 5) ลบบัญชีที่ยังไม่เข้าระบบ (ตามปีที่จบ) ============ */
const PENDING = [['8966082601', 2593], ['8966082602', 2593], ['9066082603', 2594], ['9066082604', 2594]];
const pendingDemo = {
  title: 'การตรวจและลบบัญชีที่นักศึกษายังไม่เข้าระบบครั้งแรก',
  steps: [
    { target: 'year', text: 'ที่แท็บ "บัญชีที่ยังไม่เข้าระบบ" คลิกตัวกรอง "ทุกปีการศึกษาที่จบ" เพื่อแยกดูทีละรุ่น' },
    { target: 'year-opt', text: 'เลือกปีการศึกษาที่จบที่ต้องการ (แสดงจำนวนคนต่อปีให้เห็น)' },
    { target: 'select-all', text: 'คลิก "เลือกทั้งหมด" เพื่อเลือกทุกบัญชีของปีที่กรองไว้ (หรือติ๊กเลือกทีละคน)' },
    { target: 'delete', text: 'คลิก "ลบที่เลือก" เมื่อต้องการนำรหัสที่นำเข้าผิดออกจากระบบ' },
    { target: 'del-confirm', text: 'ตรวจจำนวนในหน้าต่างยืนยัน แล้วคลิก "ลบ" ระบบจะลบบัญชีทันทีและนักศึกษาเหล่านั้นเข้าสู่ระบบไม่ได้อีก', hold: 2000 },
  ],
  stage: (done) => {
    const rows = done >= 2 ? PENDING.filter(([, y]) => y === 2593) : PENDING;
    const removed = done >= 5;
    const picked = done >= 3 && !removed;
    return (
      <MockFrame title="นำเข้ารายชื่อนักศึกษา › บัญชีที่ยังไม่เข้าระบบ">
        <div className="card" style={{ padding: 12, minHeight: 240 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <Box style={{ width: 150, whiteSpace: 'nowrap', color: 'var(--ink-400)', padding: '5px 10px' }}>ค้นหารหัสนักศึกษา…</Box>
            <div style={{ position: 'relative' }}>
              <Btn dm="year">{done >= 2 ? 'ปี 2593 (2 คน)' : 'ทุกปีการศึกษาที่จบ'} ▾</Btn>
              {done === 1 && (
                <div className="mn-pop" style={{ position: 'absolute', top: 36, left: 0, zIndex: 5, width: 170, background: '#fff', border: '1px solid var(--ink-200)', borderRadius: 10, boxShadow: 'var(--sh-lg)', padding: 4, fontSize: 13.5 }}>
                  <div style={{ padding: '6px 10px', color: 'var(--ink-600)' }}>ทุกปีการศึกษาที่จบ</div>
                  <div data-demo="year-opt" style={{ padding: '6px 10px', borderRadius: 7, background: 'var(--ink-100)' }}>ปี 2593 (2 คน)</div>
                  <div style={{ padding: '6px 10px', color: 'var(--ink-600)' }}>ปี 2594 (2 คน)</div>
                </div>
              )}
            </div>
            <span style={{ flex: 1 }} />
            {!removed && (done >= 3 ? <Btn>ล้างที่เลือก</Btn> : <Btn dm="select-all">เลือกทั้งหมด ({rows.length})</Btn>)}
            <Btn dm="delete" kind={picked ? 'danger' : 'ghost'}><Icon name="trash" size={14} /> ลบที่เลือก ({picked ? rows.length : 0})</Btn>
          </div>
          {!removed ? (
            <div style={{ border: '1px solid var(--ink-100)', borderRadius: 10, overflow: 'hidden' }}>
              <div className="mn-th"><span style={{ width: 30 }} /><span style={{ flex: 2 }}>รหัสนักศึกษา</span><span style={{ flex: 1 }}>ปีที่จบ</span><span style={{ flex: 1 }}>ผ่านมาแล้ว</span></div>
              {rows.map(([id, y]) => (
                <div key={id} className="mn-tr">
                  <span style={{ width: 30 }}><span className="mn-check" data-on={picked ? '1' : '0'}>{picked ? '✓' : ''}</span></span>
                  <span className="mono" style={{ flex: 2 }}>{id}</span><span style={{ flex: 1 }}>{y}</span><span style={{ flex: 1 }}>วันนี้</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mn-pop" style={{ textAlign: 'center', padding: '34px 0', color: 'var(--ink-500)' }}>
              <div style={{ fontWeight: 800, color: 'var(--ink-900)', fontSize: 16 }}>ไม่มีบัญชีของปี 2593 แล้ว</div>
              <div style={{ fontSize: 13.5, marginTop: 4 }}>ระบบกลับไปแสดงทุกปีการศึกษาที่จบ (เหลือ 2 คน)</div>
            </div>
          )}
        </div>
        {done === 4 && (
          <MockModal title="ลบบัญชีที่เลือก?" tone="var(--status-reject-fg)" footer={<><Btn>ยกเลิก</Btn><Btn dm="del-confirm" kind="primary" style={{ background: 'var(--fail)', borderColor: 'var(--fail)' }}>ลบ 2 บัญชี</Btn></>}>
            <div style={{ fontSize: 14 }}>จะลบ 2 บัญชีออกจากระบบถาวร นักศึกษาเหล่านี้จะเข้าสู่ระบบไม่ได้อีก</div>
          </MockModal>
        )}
        <MockToast show={removed}>ลบบัญชีแล้ว 2 คน</MockToast>
      </MockFrame>
    );
  },
};

/* ============ 6) เปิดรอบการกรอกผลสอบ ============ */
const roundDemo = {
  title: 'การเปิดรอบการกรอกผลสอบ',
  height: 440,
  steps: [
    { target: 'new-round', text: 'ที่เมนู "รอบการกรอก & รายวิชา" คลิก "เปิดรอบใหม่"' },
    { target: 'subjects', text: 'กำหนดรุ่นนักศึกษา ครั้งที่สอบ วันเปิด–ปิดรับ แล้วเลือกรายวิชาที่ใช้สอบในรอบนี้' },
    { target: 'save', text: 'คลิก "บันทึก" รอบจะเปิดรับทันที (เปิดได้ทีละหนึ่งรอบ) และนักศึกษาของรุ่นนั้นกรอกผลสอบได้', hold: 2000 },
  ],
  stage: (done) => (
    <MockFrame title="จัดการรอบการกรอก และรายวิชา">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 14, color: 'var(--ink-600)' }}>เปิด/ปิดรอบการกรอกผลสอบของแต่ละครั้งสอบ</span>
        <Btn dm="new-round" kind="primary"><Icon name="plus" size={14} /> เปิดรอบใหม่</Btn>
      </div>
      {done >= 3 ? (
        <div className="card mn-pop" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <MockBadge tone="ok">เปิดรับอยู่</MockBadge>
          <div style={{ flex: 1 }}><b>รอบที่ 1 / 2570</b><div style={{ fontSize: 13, color: 'var(--ink-500)' }}>เปิดรับ 1 ต.ค. 2569 ปิดรับ 31 ต.ค. 2569 23:59</div></div>
        </div>
      ) : <div className="card" style={{ padding: 14, color: 'var(--ink-500)', fontSize: 14 }}>ยังไม่มีรอบที่เปิดอยู่</div>}
      {done >= 1 && done < 3 && (
        <MockModal title="เปิดรอบใหม่" footer={<><Btn>ยกเลิก</Btn><Btn dm="save" kind="primary">บันทึก</Btn></>}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="รุ่นนักศึกษา (พ.ศ.) *" style={{ flex: 1 }}><Box>รุ่น 2570</Box></Field>
            <Field label="ครั้งที่สอบ *" style={{ width: 90 }}><Box>1</Box></Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Field label="วันที่เปิดรับ *" style={{ flex: 1 }}><Box>1/10/2569 00:00</Box></Field>
            <Field label="วันที่ปิดรับ *" style={{ flex: 1 }}><Box>31/10/2569 23:59</Box></Field>
          </div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
            <span className="mn-check" data-demo="subjects" data-on={done >= 2 ? '1' : '0'} style={{ width: 18, height: 18 }}>{done >= 2 ? '✓' : ''}</span>
            รายวิชาที่สอบในรอบนี้ ({done >= 2 ? 'เลือกแล้ว 8/8' : 'เลือกแล้ว 0/8'})
          </div>
        </MockModal>
      )}
      <MockToast show={done >= 3}>สร้างรอบและเปิดรับเรียบร้อย</MockToast>
    </MockFrame>
  ),
};

const DEMOS = { approve: approveDemo, reject: rejectDemo, revoke: revokeDemo, import: importDemo, pending: pendingDemo, round: roundDemo, ...MORE_DEMOS };

export function Demo({ name }) {
  const d = DEMOS[name];
  return <StepDemo title={d.title} steps={d.steps} stage={d.stage} height={d.height} />;
}
