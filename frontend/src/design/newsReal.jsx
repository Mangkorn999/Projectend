/* ============================================================
   ข่าวสาร/ประกาศ (ข้อมูลจริงจาก backend) — ทั้งฝั่งนักศึกษา (อ่านอย่างเดียว) และเจ้าหน้าที่ (CRUD)
   แทนที่ StudentNews (student.jsx) และ ManageNews (officer-manage.jsx) ที่ใช้ mock NEWS/ROUNDS
   ============================================================ */
import { useState, useEffect, useRef } from 'react';
import { Icon } from './data.jsx';
import { PageHead, Modal, StatusBadge, Select, Pagination, actorLabel } from './components.jsx';
import { usePagedList } from './usePagedList.js';
import { SkeletonList } from './skeletons.jsx';
import { apiFetch, ApiError, fetchAuthedObjectUrl } from './api.js';
import { t } from './i18n.js';

/* รูปประกอบประกาศ — endpoint ต้อง login ก่อน แต่ <img src> ยิงเองแล้วคุม credentials ไม่ได้
   เลยต้องโหลดเป็น blob ก่อนแล้วค่อยชี้ src ไปที่ object URL
   รูปที่แนบมามีได้ทุกขนาด/สัดส่วน — จำกัดด้วย maxHeight + object-fit ให้การ์ดไม่ยืดตามรูป */
/* รูปเต็มจอพร้อมซูม — รูปประกาศมักเป็นไดอะแกรมที่อ่านไม่ออกในขนาดย่อ
   ใช้ CSS transform ล้วน ไม่ต้องพึ่ง library ซูมสำเร็จรูป */
function Lightbox({ url, onClose, tt }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef(null); // จุดที่เริ่มลาก — null = ตอนนี้ไม่ได้ลากอยู่

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // กันหน้าเบื้องหลังเลื่อนตามตอน overlay เปิดอยู่
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  // จำกัด 1–5 เท่า ต่ำกว่า 1 ไม่มีประโยชน์ สูงกว่า 5 ก็เห็นแต่พิกเซล
  const zoom = next => {
    const s = Math.min(5, Math.max(1, next));
    setScale(s);
    if (s === 1) setPos({ x: 0, y: 0 }); // กลับขนาดเดิมแล้วต้องกลับมากลางจอด้วย
  };

  const onDown = e => { if (scale > 1) drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; };
  const onMove = e => { if (drag.current) setPos({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); };
  const onUp = () => { drag.current = null; };

  const btn = { border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 16, fontWeight: 700,
    fontFamily: 'inherit', cursor: 'pointer', background: 'rgba(255,255,255,.92)', color: 'var(--ink-900)' };

  return (
    <div onClick={onClose} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,.86)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {/* stopPropagation กันคลิกปุ่มแล้วทะลุไปโดน overlay จนปิดไปเลย */}
      <div onClick={e => e.stopPropagation()}
        style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 1 }}>
        <button style={btn} title={tt('news.zoomOut')} onClick={() => zoom(scale - 0.5)}>−</button>
        <button style={btn} title={tt('news.zoomReset')} onClick={() => zoom(1)}>{Math.round(scale * 100)}%</button>
        <button style={btn} title={tt('news.zoomIn')} onClick={() => zoom(scale + 0.5)}>+</button>
        <button style={btn} title={tt('news.zoomClose')} onClick={onClose}>✕</button>
      </div>
      <img src={url} alt="" draggable={false}
        onClick={e => e.stopPropagation()}
        onMouseDown={onDown}
        onWheel={e => zoom(scale + (e.deltaY < 0 ? 0.3 : -0.3))}
        style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', userSelect: 'none',
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          cursor: scale > 1 ? 'grab' : 'zoom-in',
          transition: drag.current ? 'none' : 'transform .12s' }} />
    </div>
  );
}

function NewsImage({ newsId, maxHeight = 320, height, radius = 12, fit = 'cover', zoomable = false, tt }) {
  const [url, setUrl] = useState('');
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    let revoked = false, current = '';
    fetchAuthedObjectUrl(`/news/${newsId}/image`)
      .then(u => { if (revoked) { URL.revokeObjectURL(u); return; } current = u; setUrl(u); })
      .catch(() => {});
    return () => { revoked = true; if (current) URL.revokeObjectURL(current); };
  }, [newsId]);
  if (!url) return null;
  return (<>
    <img src={url} alt="" onClick={zoomable ? () => setZoom(true) : undefined}
      style={{ display: 'block', width: '100%', maxHeight, height, objectFit: fit,
        borderRadius: radius, border: '1px solid var(--ink-200)', background: 'var(--ink-50)',
        cursor: zoomable ? 'zoom-in' : 'default' }} />
    {zoom && <Lightbox url={url} onClose={() => setZoom(false)} tt={tt} />}
  </>);
}

// staff_status (backend) -> key ที่ StatusBadge เข้าใจ — pattern เดียวกับ studentDetailReal.jsx
const STAFF_STATUS_TO_BADGE = { pending: 'SUBMITTED', approved: 'CONFIRMED', rejected: 'REJECTED' };

// หน้าตาประกาศเต็ม — ใช้ทั้งตอนนักศึกษาเปิดอ่าน และตอนเจ้าหน้าที่กด "ดูตัวอย่าง" ก่อนเผยแพร่
// ใช้ component เดียวกันเพื่อให้ตัวอย่างเหมือนที่นักศึกษาเห็นจริงเป๊ะ (ไม่ต้องแก้ 2 ที่ให้ตรงกัน)
function NewsPostView({ round, postedAt, image, content, postedBy, tt }) {
  return <>
    <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
      {round && <span className="chip">{tt('news.roundSlash', { attempt: round.attempt_number, year: round.academic_year })}</span>}
      <span className="chip" style={{ background: 'transparent', color: 'var(--ink-500)' }}><Icon name="calendar" size={13} /> {new Date(postedAt).toLocaleDateString('th-TH')}</span>
    </div>
    {image && <div style={{ marginBottom: 14 }}>{image}</div>}
    <p style={{ margin: 0, fontSize: 17, lineHeight: 1.7, color: 'var(--ink-900)', whiteSpace: 'pre-wrap' }}>{content}</p>
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--ink-100)', fontSize: 15, color: 'var(--ink-500)' }}>
      {tt('news.postedByFooter', { name: postedBy })}
    </div>
  </>;
}

export function StudentNewsReal({ go, lang }) {
  const [news, setNews] = useState(null);
  const [round, setRound] = useState(null);
  const [blocked, setBlocked] = useState('');
  const [open, setOpen] = useState(null);
  const [myResult, setMyResult] = useState(null); // ผลของรอบที่เปิดอยู่ตอนนี้ (ถ้ามี) — null = ยังไม่เคยกรอก
  const tt = (key, vars) => t(lang, key, vars);

  useEffect(() => {
    apiFetch('/news').then(setNews).catch(e => setNews([]));
    apiFetch('/rounds/active').then(r => setRound(r)).catch(e => setBlocked(e.message));
    // ประวัติทั้งหมดของตัวเอง เรียงใหม่->เก่า — กรองเอาแค่ใบของรอบที่เปิดอยู่ทีหลัง (ตอนนี้ยังไม่รู้ round_id)
    apiFetch('/exam-results/me').then(setMyResult).catch(() => setMyResult([]));
  }, []);

  // ใบล่าสุดของรอบที่กำลังเปิดอยู่ (ถ้ามี) — ใช้โชว์ "สถานะของคุณ" ให้ตรงกับความจริง
  // ไม่ใช่แค่ปุ่ม "เริ่มกรอกผลสอบ" ตายตัวเหมือนเดิม ทั้งที่กรอกไปแล้วก็ยังขึ้นแบบนี้
  // รอบที่ตั้งเปิดไว้ล่วงหน้า / เลยวันปิดแล้ว ก็ส่งมาด้วย — ป้าย "เปิดอยู่" กับปุ่มกรอกต้องดู phase ด้วย
  const acceptingNow = round?.phase === 'active';
  // ใบที่ถูกตีกลับแก้ได้แม้รอบปิดแล้ว — backend บอกมาทาง can_fix_rejected (ปุ่มต้องกดได้ ป้ายต้องบอกให้แก้)
  const canFixRejected = round?.can_fix_rejected === true;
  let badgeText = tt('news.openRoundBadge');
  if (!round) {
    badgeText = tt('news.noOpenRound');
  } else if (canFixRejected && !acceptingNow) {
    badgeText = tt('news.fixRejectedBadge');
  } else if (round.phase === 'scheduled') {
    badgeText = tt('news.scheduledBadge');
  } else if (round.phase === 'expired') {
    badgeText = tt('news.expiredBadge');
  } else if (round.phase === 'closed') {
    badgeText = tt('news.closedBadge');
  }

  const currentResult = round && myResult ? myResult.find(r => r.round_id === round.round_id) : null;
  // ยืนยันแล้ว แก้ไขไม่ได้อีก (backend บล็อก 409) ปุ่มจึงต้องเปลี่ยนเป็นดูสถานะแทนที่จะชวนกดแล้วชนกำแพง
  const startBtnLabel = currentResult?.staff_status === 'approved' ? tt('news.viewStatusBtn')
    : currentResult ? tt('news.editBtn') : tt('news.startBtn');

  // แบ่งหน้าประกาศ — ประกาศสะสมทุกปีทุกรอบ ปล่อยไว้จะยาวจนเลื่อนหาไม่เจอ
  // hook ต้องเรียกก่อน early-return ทุกอัน ไม่งั้นผิดกฎ React (จำนวน hook ต้องเท่ากันทุกครั้งที่ render)
  const newsPage = usePagedList(news ?? [], 10);

  if (!news) return <div className="fade-up"><SkeletonList count={4} /></div>;

  return (
    <div className="fade-up">
      <PageHead title={tt('news.pageTitle')} />
      <div className="card" style={{ padding: 0, marginBottom: 22, overflow: 'hidden', border: '1px solid var(--gold-100)' }}>
        <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div style={{ background: 'linear-gradient(135deg,var(--navy-700),var(--navy-800))', color: '#fff', padding: '22px 26px', flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="chip" style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,.14)', color: 'var(--gold-500)', fontWeight: 700 }}>
              <Icon name="clock" size={14} /> {badgeText}
            </div>
            {round && <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4 }}>{tt('news.roundSlash', { attempt: round.attempt_number, year: round.academic_year })}</div>}
            {round && <div style={{ fontSize: 15.5, opacity: .85 }}>{tt('news.openPeriod', { open: new Date(round.open_date).toLocaleDateString('th-TH'), close: new Date(round.close_date).toLocaleDateString('th-TH') })}</div>}
            {!round && blocked && <div style={{ fontSize: 15.5, opacity: .85 }}>{blocked}</div>}
          </div>
          <div style={{ padding: '22px 26px', flex: '1 1 280px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 15.5, color: 'var(--ink-500)', fontWeight: 600, marginBottom: currentResult ? 7 : 0 }}>{tt('news.yourStatusLabel')}</div>
              {currentResult && <StatusBadge status={STAFF_STATUS_TO_BADGE[currentResult.staff_status]} size="lg" lang={lang} />}
            </div>
            <button className="btn btn-gold btn-lg" disabled={!acceptingNow && !canFixRejected && currentResult?.staff_status !== 'approved'}
              onClick={() => go(currentResult?.staff_status === 'approved' ? 'status' : 'formIntro')}>
              <Icon name="edit" size={18} /> {startBtnLabel}</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {news.length === 0 && <div style={{ color: 'var(--ink-500)', textAlign: 'center', padding: 30 }}>{tt('news.noNews')}</div>}
        {newsPage.rows.map(n => (
          <div key={n.news_id} className="card" style={{ padding: '18px 22px', cursor: 'pointer' }} onClick={() => setOpen(n)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 15 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--blue-50)', color: 'var(--blue-600)' }}>
                <Icon name="news" size={21} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ marginBottom: 5 }}><span className="chip" style={{ fontSize: 13.5, padding: '3px 9px' }}>{tt('news.roundSlash', { attempt: n.round.attempt_number, year: n.round.academic_year })}</span></div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)' }}>{n.title}</div>
                <div style={{ fontSize: 15.5, color: 'var(--ink-700)', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.content}</div>
                <div style={{ fontSize: 14.5, color: 'var(--ink-600)', marginTop: 9, display: 'flex', gap: 14 }}>
                  <span><Icon name="calendar" size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{new Date(n.posted_at).toLocaleDateString('th-TH')}</span>
                  <span>{actorLabel(n.poster, tt)}</span>
                </div>
              </div>
              {n.image_path && <div style={{ width: 76, flex: 'none' }}><NewsImage newsId={n.news_id} maxHeight={76} radius={9} /></div>}
              <Icon name="chevR" size={20} style={{ color: 'var(--ink-300)', flex: 'none', marginTop: 4 }} />
            </div>
          </div>
        ))}
        {newsPage.pages > 1 && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <Pagination page={newsPage.page} pages={newsPage.pages} onPage={newsPage.setPage} lang={lang} />
          </div>
        )}
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.title} width={560}
        footer={<button className="btn btn-ghost" onClick={() => setOpen(null)}>{tt('common.close')}</button>}>
        {open && <NewsPostView round={open.round} postedAt={open.posted_at} content={open.content}
          postedBy={actorLabel(open.poster, tt)} tt={tt}
          image={open.image_path && <>
            <NewsImage newsId={open.news_id} maxHeight={420} fit="contain" zoomable tt={tt} />
            <div className="hint" style={{ marginTop: 6, textAlign: 'center' }}>{tt('news.zoomHint')}</div>
          </>} />}
      </Modal>
    </div>
  );
}

// รูปที่เพิ่งเลือกจากเครื่อง แสดงเต็มความกว้างแบบที่นักศึกษาจะเห็น (ใช้ในหน้า "ดูตัวอย่าง" ไม่มีปุ่มลบ)
function LocalImage({ file }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url ? <img src={url} alt="" style={{ display: 'block', width: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 12 }} /> : null;
}

// พรีวิวรูปที่เพิ่งเลือกจากเครื่อง (ยังไม่ได้อัปโหลด)
function ImagePreview({ file, onRemove, label }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div style={{ position: 'relative' }}>
      {url && <img src={url} alt="" style={{ display: 'block', width: '100%', maxHeight: 200, objectFit: 'cover',
        borderRadius: 12, border: '1px solid var(--ink-200)' }} />}
      <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove}
        style={{ position: 'absolute', top: 8, right: 8, background: '#fff' }}><Icon name="x" size={14} /> {label}</button>
      <div style={{ fontSize: 14, color: 'var(--ink-500)', marginTop: 6 }}>
        {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
      </div>
    </div>
  );
}

export function ManageNewsReal({ toast, lang, currentUserName }) {
  const [items, setItems] = useState(null);
  const [showPreview, setShowPreview] = useState(false); // true = โมดัลกำลังโชว์ "ตัวอย่างที่นักศึกษาจะเห็น" แทนฟอร์ม
  const [rounds, setRounds] = useState([]);
  const [modal, setModal] = useState(null); // {} (new) | news | null
  const [form, setForm] = useState({ title: '', content: '', round_id: '' });
  const [deleteTarget, setDeleteTarget] = useState(null); // ประกาศที่กำลังจะลบ (ยืนยันก่อน)
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);   // รูปใหม่ที่เพิ่งเลือก (ยังไม่อัปโหลด)
  const [dropImage, setDropImage] = useState(false);  // กดเอารูปเดิมออก
  const [imgError, setImgError] = useState('');
  const [roundFilter, setRoundFilter] = useState('ALL');
  const tt = (key, vars) => t(lang, key, vars);

  const load = () => apiFetch('/news').then(setItems).catch(e => toast(e.message, 'error'));
  useEffect(() => { load(); apiFetch('/rounds').then(setRounds).catch(() => {}); }, []);

  const openModal = (n) => {
    setModal(n || {});
    setForm({ title: n?.title || '', content: n?.content || '', round_id: n?.round_id ?? (rounds[0]?.round_id || '') });
    setImageFile(null); setDropImage(false); setImgError(''); setShowPreview(false);
  };

  const pickImage = (file) => {
    setImgError('');
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { setImgError(tt('newsMgmt.imageTypeError')); return; }
    if (file.size > 5 * 1024 * 1024) { setImgError(tt('newsMgmt.imageSizeError')); return; }
    setImageFile(file); setDropImage(false);
  };

  // รูปอัปโหลดแยกจากตัวประกาศ (multipart) — ต้องมี news_id ก่อน ตอนสร้างใหม่เลยยิงหลังบันทึกสำเร็จ
  const syncImage = async (newsId) => {
    if (imageFile) {
      const fd = new FormData();
      fd.append('image', imageFile);
      await apiFetch(`/news/${newsId}/image`, { method: 'POST', body: fd });
    } else if (dropImage) {
      await apiFetch(`/news/${newsId}/image`, { method: 'DELETE' });
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      if (modal?.news_id) {
        await apiFetch(`/news/${modal.news_id}`, { method: 'PUT', body: form });
        await syncImage(modal.news_id);
        toast(tt('newsMgmt.savedToast'));
      } else {
        const created = await apiFetch('/news', { method: 'POST', body: form });
        await syncImage(created.news_id);
        toast(tt('newsMgmt.publishedToast'));
      }
      setModal(null);
      load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : tt('newsMgmt.saveFailMsg'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (n) => {
    setDeleteTarget(null);
    try {
      await apiFetch(`/news/${n.news_id}`, { method: 'DELETE' });
      toast(tt('newsMgmt.deletedToast'), 'info');
      load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : tt('newsMgmt.deleteFailMsg'), 'error');
    }
  };

  // ตัวกรองเดียว = รอบ (ชื่อรอบมีปีอยู่แล้ว เช่น "รอบที่ 2/2569" จึงไม่ต้องมีตัวกรองปีแยก)
  const filtered = (items ?? []).filter(n =>
    roundFilter === 'ALL' || String(n.round_id) === roundFilter);
  // 6 อันต่อหน้า — หน้านี้จะได้ไม่ยาวเกินหนึ่งจอ ไม่ต้องเลื่อนลงเรื่อย ๆ
  const itemsPage = usePagedList(filtered, 6, roundFilter);

  if (!items) return <div className="fade-up"><SkeletonList count={5} /></div>;

  return (
    <div className="fade-up">
      {/* ทั้งหน้ากว้างสูงสุด 1120 อยู่กลางจอ — ไม่ให้ชื่อหน้าอยู่ซ้ายสุด ปุ่มอยู่ขวาสุด */}
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <PageHead title={tt('nav.officer.newsmgmt')}
          actions={<button className="btn btn-primary" onClick={() => openModal(null)}><Icon name="plus" size={17} /> {tt('newsMgmt.writeBtn')}</button>} />

        {items.length === 0 && <div className="card" style={{ color: 'var(--ink-500)', textAlign: 'center', padding: 40 }}>{tt('newsMgmt.noNews')}</div>}

        {items.length > 0 && (
          // การ์ดเดียวรวม: แถบตัวกรองด้านบน + รายการ (คั่นด้วยเส้น) + เลขหน้าท้ายการ์ด
          // เดิมแต่ละประกาศเป็นการ์ดแยก ซ้อนกันยาวลงไปเรื่อย ๆ
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', display: 'flex', gap: 12, alignItems: 'center', background: 'var(--ink-50, #fafafa)', borderBottom: '1px solid var(--ink-200)' }}>
              <Select style={{ width: 'auto', minWidth: 220 }} value={roundFilter} onChange={setRoundFilter} lang={lang}
                ariaLabel={tt('newsMgmt.allRound')}
                options={[{ value: 'ALL', label: tt('newsMgmt.allRound') },
                  ...rounds.map(r => ({ value: String(r.round_id),
                    label: tt('news.roundSlash', { attempt: r.attempt_number, year: r.academic_year }) }))]} />
              <div style={{ flex: 1 }}></div>
              <div style={{ fontSize: 15.5, color: 'var(--ink-500)', whiteSpace: 'nowrap' }}>{Math.min((itemsPage.page + 1) * 6, filtered.length)} / {filtered.length}</div>
            </div>

            {filtered.length === 0 && <div style={{ color: 'var(--ink-500)', textAlign: 'center', padding: 40 }}>{tt('newsMgmt.filterEmpty')}</div>}
            {itemsPage.rows.map((n, i) => (
              <div key={n.news_id} style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 18,
                borderTop: i === 0 ? 'none' : '1px solid var(--ink-100)' }}>
                {n.image_path
                  ? <div style={{ width: 76, height: 76, flex: 'none', borderRadius: 12, overflow: 'hidden' }}><NewsImage newsId={n.news_id} height={76} radius={12} /></div>
                  : <div style={{ width: 76, height: 76, borderRadius: 12, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--blue-50)', color: 'var(--blue-600)' }}><Icon name="news" size={30} /></div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 19, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
                  <div style={{ fontSize: 15.5, color: 'var(--ink-500)', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tt('news.roundSlash', { attempt: n.round.attempt_number, year: n.round.academic_year })} · {new Date(n.posted_at).toLocaleDateString('th-TH')} · {actorLabel(n.poster, tt)}
                    {n.updater && <> · {tt('newsMgmt.editedBy', { name: actorLabel(n.updater, tt) })}</>}
                  </div>
                </div>
                <button className="btn btn-ghost" onClick={() => openModal(n)}><Icon name="edit" size={17} /> {tt('newsMgmt.editBtn')}</button>
                <button className="btn btn-ghost" style={{ padding: 10, border: 'none', color: 'var(--fail)' }}
                  aria-label={tt('newsMgmt.deleteAria')} onClick={() => setDeleteTarget(n)}><Icon name="trash" size={20} /></button>
              </div>
            ))}

            {itemsPage.pages > 1 && (
              <div style={{ borderTop: '1px solid var(--ink-200)' }}>
                <Pagination page={itemsPage.page} pages={itemsPage.pages} onPage={itemsPage.setPage} lang={lang} />
              </div>
            )}
          </div>
        )}
      </div>
      {/* ยืนยันก่อนลบ — เดิมกดถังขยะแล้วประกาศหายทันที ไม่มีทางเรียกคืน */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={tt('newsMgmt.deleteTitle')} width={440} tone="danger"
        footer={<><button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>{tt('newsMgmt.cancelBtn')}</button>
          <button className="btn btn-primary" style={{ background: 'var(--fail)', borderColor: 'var(--fail)' }}
            onClick={() => remove(deleteTarget)}>{tt('newsMgmt.deleteBtn')}</button></>}>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7 }}>{tt('newsMgmt.deleteBody', { title: deleteTarget?.title })}</p>
      </Modal>

      <Modal open={!!modal} onClose={() => setModal(null)}
        title={showPreview ? (form.title.trim() || tt('newsMgmt.previewNoTitle')) : (modal?.news_id ? tt('newsMgmt.editModalTitle') : tt('newsMgmt.newModalTitle'))} width={560}
        footer={<><button className="btn btn-ghost" onClick={() => setModal(null)}>{tt('newsMgmt.cancelBtn')}</button>
          <button className="btn btn-ghost" onClick={() => setShowPreview(p => !p)}>
            <Icon name={showPreview ? 'edit' : 'eye'} size={16} /> {showPreview ? tt('newsMgmt.backToEditBtn') : tt('newsMgmt.previewBtn')}</button>
          <button className="btn btn-primary" disabled={saving} onClick={submit}><Icon name="send" size={16} /> {saving ? tt('newsMgmt.publishing') : modal?.news_id ? tt('newsMgmt.saveEditBtn') : tt('newsMgmt.publishBtn')}</button></>}>
        {showPreview ? (
          <>
            <div style={{ marginBottom: 14, padding: '10px 13px', background: 'var(--blue-50)', color: 'var(--navy-700)', borderRadius: 10, fontSize: 15, lineHeight: 1.6, display: 'flex', gap: 8 }}>
              <Icon name="info" size={17} style={{ flex: 'none', marginTop: 3 }} /> <span>{tt('newsMgmt.previewNote')}</span>
            </div>
            <NewsPostView tt={tt}
              round={rounds.find(r => String(r.round_id) === String(form.round_id))}
              postedAt={modal?.posted_at || new Date()}
              content={form.content.trim() || tt('newsMgmt.previewNoContent')}
              postedBy={modal?.poster ? actorLabel(modal.poster, tt) : currentUserName}
              image={imageFile ? <LocalImage file={imageFile} />
                : (modal?.image_path && !dropImage) ? <NewsImage newsId={modal.news_id} maxHeight={420} fit="contain" tt={tt} /> : null} />
          </>
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field"><label>{tt('newsMgmt.fieldTitle')}</label><input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={tt('newsMgmt.titlePh')} /></div>
          <div className="field"><label>{tt('newsMgmt.fieldRound')}</label>
            <Select value={String(form.round_id)} onChange={v => setForm(f => ({ ...f, round_id: v }))} lang={lang}
              options={rounds.map(r => ({ value: String(r.round_id),
                label: tt('news.roundSlash', { attempt: r.attempt_number, year: r.academic_year }) }))} />
          </div>
          <div className="field"><label>{tt('newsMgmt.fieldContent')}</label><textarea className="input" rows={4} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder={tt('newsMgmt.contentPh')} /></div>
          <div className="field">
            <label>{tt('newsMgmt.fieldImage')} <span style={{ fontWeight: 400, color: 'var(--ink-500)' }}>{tt('newsMgmt.imageOptional')}</span></label>
            {imageFile ? (
              <ImagePreview file={imageFile} onRemove={() => setImageFile(null)} label={tt('newsMgmt.removeImageBtn')} />
            ) : modal?.image_path && !dropImage ? (
              <div style={{ position: 'relative' }}>
                <NewsImage newsId={modal.news_id} maxHeight={200} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDropImage(true)}
                  style={{ position: 'absolute', top: 8, right: 8, background: '#fff' }}><Icon name="trash" size={14} /> {tt('newsMgmt.removeImageBtn')}</button>
              </div>
            ) : (
              <label className="btn btn-ghost" style={{ cursor: 'pointer', alignSelf: 'flex-start' }}>
                <Icon name="upload" size={16} /> {tt('newsMgmt.pickImageBtn')}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }}
                  onChange={e => pickImage(e.target.files?.[0])} />
              </label>
            )}
            <span className="hint" style={imgError ? { color: 'var(--status-reject-fg)' } : undefined}>
              {imgError || tt('newsMgmt.imageHint')}
            </span>
          </div>
        </div>
        )}
      </Modal>
    </div>
  );
}
