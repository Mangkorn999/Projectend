/* ============================================================
   ข่าวสาร/ประกาศ (ข้อมูลจริงจาก backend) — ทั้งฝั่งนักศึกษา (อ่านอย่างเดียว) และเจ้าหน้าที่ (CRUD)
   แทนที่ StudentNews (student.jsx) และ ManageNews (officer-manage.jsx) ที่ใช้ mock NEWS/ROUNDS
   ============================================================ */
import { useState, useEffect } from 'react';
import { Icon } from './data.jsx';
import { PageHead, Modal, StatusBadge } from './components.jsx';
import { apiFetch, ApiError } from './api.js';

export function StudentNewsReal({ go }) {
  const [news, setNews] = useState(null);
  const [round, setRound] = useState(null);
  const [blocked, setBlocked] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    apiFetch('/news').then(setNews).catch(e => setNews([]));
    apiFetch('/rounds/active').then(r => setRound(r)).catch(e => setBlocked(e.message));
  }, []);

  if (!news) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>กำลังโหลดข้อมูล…</div>;

  return (
    <div className="fade-up">
      <PageHead title="ข่าวสาร/ประกาศ" sub="ประกาศจากเจ้าหน้าที่คณะ" />
      <div className="card" style={{ padding: 0, marginBottom: 22, overflow: 'hidden', border: '1px solid var(--gold-100)' }}>
        <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div style={{ background: 'linear-gradient(135deg,var(--navy-700),var(--navy-800))', color: '#fff', padding: '22px 26px', flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="chip" style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,.14)', color: 'var(--gold-500)', fontWeight: 700 }}>
              <Icon name="clock" size={14} /> {round ? 'รอบกรอกผลสอบเปิดอยู่' : 'ไม่มีรอบกรอกผลสอบเปิดอยู่'}
            </div>
            {round && <div style={{ fontSize: 19, fontWeight: 800, marginTop: 4 }}>รอบที่ {round.attempt_number}/{round.academic_year}</div>}
            {round && <div style={{ fontSize: 13.5, opacity: .85 }}>เปิด {new Date(round.open_date).toLocaleDateString('th-TH')} — ปิด {new Date(round.close_date).toLocaleDateString('th-TH')}</div>}
            {!round && blocked && <div style={{ fontSize: 13.5, opacity: .85 }}>{blocked}</div>}
          </div>
          <div style={{ padding: '22px 26px', flex: '1 1 280px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-500)', fontWeight: 600 }}>สถานะของคุณ</div>
            </div>
            <button className="btn btn-gold btn-lg" disabled={!round} onClick={() => go('formIntro')}><Icon name="edit" size={18} /> เริ่มกรอกผลสอบ</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {news.length === 0 && <div style={{ color: 'var(--ink-500)', textAlign: 'center', padding: 30 }}>ยังไม่มีประกาศ</div>}
        {news.map(n => (
          <div key={n.news_id} className="card" style={{ padding: '18px 22px', cursor: 'pointer' }} onClick={() => setOpen(n)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 15 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--blue-50)', color: 'var(--blue-600)' }}>
                <Icon name="news" size={21} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ marginBottom: 5 }}><span className="chip" style={{ fontSize: 11.5, padding: '3px 9px' }}>รอบที่ {n.round.attempt_number}/{n.round.academic_year}</span></div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>{n.title}</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-700)', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.content}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 9, display: 'flex', gap: 14 }}>
                  <span><Icon name="calendar" size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{new Date(n.posted_at).toLocaleDateString('th-TH')}</span>
                  <span>{n.poster.first_name} {n.poster.last_name}</span>
                </div>
              </div>
              <Icon name="chevR" size={20} style={{ color: 'var(--ink-300)', flex: 'none', marginTop: 4 }} />
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.title} width={560}
        footer={<button className="btn btn-ghost" onClick={() => setOpen(null)}>ปิด</button>}>
        {open && <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <span className="chip">รอบที่ {open.round.attempt_number}/{open.round.academic_year}</span>
            <span className="chip" style={{ background: 'transparent', color: 'var(--ink-500)' }}><Icon name="calendar" size={13} /> {new Date(open.posted_at).toLocaleDateString('th-TH')}</span>
          </div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: 'var(--ink-900)', whiteSpace: 'pre-wrap' }}>{open.content}</p>
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--ink-100)', fontSize: 13, color: 'var(--ink-500)' }}>
            โพสต์โดย {open.poster.first_name} {open.poster.last_name}
          </div>
        </>}
      </Modal>
    </div>
  );
}

export function ManageNewsReal({ toast }) {
  const [items, setItems] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [modal, setModal] = useState(null); // {} (new) | news | null
  const [form, setForm] = useState({ title: '', content: '', round_id: '' });
  const [saving, setSaving] = useState(false);

  const load = () => apiFetch('/news').then(setItems).catch(e => toast(e.message, 'error'));
  useEffect(() => { load(); apiFetch('/rounds').then(setRounds).catch(() => {}); }, []);

  const openModal = (n) => {
    setModal(n || {});
    setForm({ title: n?.title || '', content: n?.content || '', round_id: n?.round_id ?? (rounds[0]?.round_id || '') });
  };

  const submit = async () => {
    setSaving(true);
    try {
      if (modal?.news_id) {
        await apiFetch(`/news/${modal.news_id}`, { method: 'PUT', body: form });
        toast('บันทึกการแก้ไขเรียบร้อย');
      } else {
        await apiFetch('/news', { method: 'POST', body: form });
        toast('เผยแพร่ประกาศเรียบร้อย');
      }
      setModal(null);
      load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'บันทึกไม่สำเร็จ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (n) => {
    try {
      await apiFetch(`/news/${n.news_id}`, { method: 'DELETE' });
      toast('ลบประกาศแล้ว', 'info');
      load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'ลบไม่สำเร็จ', 'error');
    }
  };

  if (!items) return <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>กำลังโหลดข้อมูล…</div>;

  return (
    <div className="fade-up">
      <PageHead title="จัดการข่าวสาร / ประกาศ" sub="โพสต์ประกาศถึงนักศึกษาในแต่ละรอบการกรอก"
        actions={<button className="btn btn-primary" onClick={() => openModal(null)}><Icon name="plus" size={17} /> เขียนประกาศ</button>} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.length === 0 && <div style={{ color: 'var(--ink-500)', textAlign: 'center', padding: 30 }}>ยังไม่มีประกาศ</div>}
        {items.map(n => (
          <div key={n.news_id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 15 }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--blue-50)', color: 'var(--blue-600)' }}><Icon name="news" size={20} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 3 }}>รอบที่ {n.round.attempt_number}/{n.round.academic_year} · {new Date(n.posted_at).toLocaleDateString('th-TH')} · {n.poster.first_name}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => openModal(n)}><Icon name="edit" size={15} /> แก้ไข</button>
            <button className="btn btn-ghost btn-sm" style={{ padding: 7, border: 'none', color: 'var(--fail)' }} onClick={() => remove(n)}><Icon name="trash" size={16} /></button>
          </div>
        ))}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.news_id ? 'แก้ไขประกาศ' : 'เขียนประกาศใหม่'} width={560}
        footer={<><button className="btn btn-ghost" onClick={() => setModal(null)}>ยกเลิก</button>
          <button className="btn btn-primary" disabled={saving} onClick={submit}><Icon name="send" size={16} /> {saving ? 'กำลังบันทึก…' : 'เผยแพร่'}</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field"><label>หัวข้อประกาศ</label><input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="หัวข้อ…" /></div>
          <div className="field"><label>รอบที่เกี่ยวข้อง</label>
            <select className="select" value={form.round_id} onChange={e => setForm(f => ({ ...f, round_id: e.target.value }))}>
              {rounds.map(r => <option key={r.round_id} value={r.round_id}>รอบที่ {r.attempt_number}/{r.academic_year}</option>)}
            </select>
          </div>
          <div className="field"><label>เนื้อหา</label><textarea className="input" rows={4} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="รายละเอียดประกาศ…" /></div>
        </div>
      </Modal>
    </div>
  );
}
