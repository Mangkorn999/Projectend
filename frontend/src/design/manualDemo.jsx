/* ============================================================
   เครื่องเล่นภาพเคลื่อนไหวสาธิตวิธีใช้ ("คลิกตรงนี้ ทำแบบนี้") สำหรับหน้าคู่มือ

   หลักการ: ไม่ใช้วิดีโอ/GIF — วาดหน้าจอจำลองด้วย React + class จริงของระบบ (btn, badge, card)
   แล้วให้ "เมาส์จำลอง" เคลื่อนไปคลิกปุ่มทีละขั้นตามสคริปต์ (steps) หน้าจอจำลองเปลี่ยนตามจำนวนขั้นที่คลิกไปแล้ว (done)
   ข้อดี: คมทุกขนาดจอ ไฟล์เล็ก แก้ข้อความ/ขั้นตอนได้ในโค้ด ไม่ต้องอัดหน้าจอใหม่ทุกครั้งที่ UI เปลี่ยน

   ทำงานอย่างไร (ตามลำดับต่อ 1 ขั้น):
     1. phase = 'move'  → เมาส์เลื่อนไปที่ปุ่มเป้าหมาย (element ที่มี data-demo="ชื่อ") + วงแหวนเรืองรอบปุ่ม
     2. phase = 'click' → เมาส์คลิก (ริ้วคลื่น) → หน้าจอจำลองเปลี่ยน (done เพิ่ม 1) → พักให้อ่านสักครู่
     3. ไปขั้นถัดไป · ครบทุกขั้นแล้วพักแล้ววนใหม่
   เล่นเองเมื่อเลื่อนมาเห็น · หยุด/เล่นต่อ/เริ่มใหม่/กระโดดไปขั้นที่ต้องการได้
   ผู้ใช้ที่ตั้งค่า "ลดการเคลื่อนไหว" (prefers-reduced-motion) ไม่เล่นเอง — ใช้ปุ่ม "ขั้นถัดไป" ทีละขั้นแทน
   ============================================================ */
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Icon } from './data.jsx';

const STAGE_W = 640;   // ความกว้างหน้าจอจำลอง (px) — จอเล็กกว่านี้ย่อทั้งก้อนด้วย transform: scale
const MOVE_MS = 1000;  // เวลาเมาส์เลื่อนไปถึงปุ่ม (ต้องตรงกับ transition ใน styles.css .mn-cursor)

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function StepDemo({ title, steps, stage, height = 340 }) {
  const n = steps.length;
  const [reduced] = useState(prefersReducedMotion);
  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const cursorRef = useRef(null);
  const ringRef = useRef(null);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState(0);    // เว้นซ้ายให้หน้าจอจำลองอยู่กลางเมื่อกรอบกว้างกว่า STAGE_W
  const [i, setI] = useState(0);              // ขั้นปัจจุบัน (0 ถึง n-1)
  const [phase, setPhase] = useState('move'); // 'move' | 'click'
  const [loop, setLoop] = useState(0);        // นับรอบที่เล่นวน — ใช้เป็น key ให้หน้าจอจำลองเริ่มใหม่สะอาด
  const [visible, setVisible] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  const playing = visible && !userPaused && !reduced;
  // จำนวนขั้นที่ "คลิกไปแล้ว" — หน้าจอจำลองวาดตามค่านี้
  // ตอนเมาส์ยังเคลื่อนอยู่ ขั้นนี้ยังไม่ถูกคลิก จึงนับแค่ขั้นก่อนหน้า
  const done = phase === 'click' ? i + 1 : i;

  // ย่อหน้าจอจำลองให้พอดีความกว้างที่มี (จอเล็ก/มือถือ)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      setScale(Math.min(1, el.clientWidth / STAGE_W));
      setOffset(Math.max(0, (el.clientWidth - STAGE_W) / 2));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // เล่นเฉพาะตอนเลื่อนมาเห็นอยู่บนจอ ไม่เล่นทิ้งไว้ข้างล่างโดยไม่มีคนดู
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // วัดตำแหน่งปุ่มเป้าหมายของขั้นนี้ แล้ว "สั่ง DOM ตรงๆ" ย้ายเมาส์กับวงแหวน (ไม่ใช้ state — ตำแหน่งเป็นเรื่องของ DOM ล้วน
  // และให้ CSS transition ทำภาพเคลื่อนไหวต่อเอง)
  useLayoutEffect(() => {
    const st = stageRef.current;
    if (!st) return;
    const target = st.querySelector(`[data-demo="${steps[i].target}"]`);
    if (!target) return;
    const s = st.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    const left = (r.left - s.left) / scale;
    const top = (r.top - s.top) / scale;
    const w = r.width / scale;
    const h = r.height / scale;
    if (cursorRef.current) cursorRef.current.style.transform = `translate(${left + w * 0.62}px, ${top + h * 0.6}px)`;
    if (ringRef.current) {
      Object.assign(ringRef.current.style, { left: `${left - 4}px`, top: `${top - 4}px`, width: `${w + 8}px`, height: `${h + 8}px` });
    }
  }, [i, loop, scale, steps]);

  // ไทม์ไลน์: เลื่อนเมาส์ → คลิก → พัก → ขั้นถัดไป (ทำงานเฉพาะตอน playing)
  useEffect(() => {
    if (!playing) return undefined;
    const advance = () => {
      if (i + 1 < n) {
        setI(i + 1);
      } else {
        setLoop(l => l + 1); // ครบทุกขั้น → เริ่มใหม่
        setI(0);
      }
      setPhase('move');
    };
    const timer = phase === 'move'
      ? setTimeout(() => setPhase('click'), MOVE_MS)
      : setTimeout(advance, (steps[i].hold ?? 1600) + (i === n - 1 ? 1400 : 0)); // ขั้นสุดท้ายพักนานหน่อยให้เห็นผลลัพธ์
    return () => clearTimeout(timer);
  }, [playing, phase, i, n, steps]);

  const goto = (k) => { setI(k); setPhase(reduced ? 'click' : 'move'); setUserPaused(false); };
  const replay = () => { setLoop(l => l + 1); goto(0); };
  const next = () => {
    if (phase === 'move') setPhase('click');           // ขั้นนี้ยังไม่คลิก → คลิกให้ก่อน
    else if (i + 1 < n) goto(i + 1);
    else replay();
  };

  const caption = steps[i];
  return (
    <figure className="mn-demo" ref={wrapRef}>
      <figcaption className="mn-demo-head">
        <span className="mn-demo-tag"><Icon name="play" size={13} /> ตัวอย่างการใช้งาน</span>
        <b>{title}</b>
      </figcaption>

      {/* หน้าจอจำลอง — ซ่อนจากโปรแกรมอ่านหน้าจอ (ขั้นตอนเดียวกันเขียนเป็นรายการตัวอักษรด้านล่างอยู่แล้ว) */}
      <div className="mn-stage-outer" style={{ height: height * scale }} aria-hidden="true">
        <div className="mn-stage" ref={stageRef} key={loop} style={{ width: STAGE_W, height, marginLeft: offset, transform: `scale(${scale})` }}>
          {stage(done)}
          <div className={`mn-ring${phase === 'move' ? ' on' : ''}`} ref={ringRef} />
          <div className="mn-cursor" ref={cursorRef}>
            <svg width="22" height="24" viewBox="0 0 22 24" fill="none">
              <path d="M2 2l6.5 18 2.7-7.3L18.5 10 2 2z" fill="#fff" stroke="#3d1c00" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
            {phase === 'click' && <span className="mn-ripple" key={`${loop}-${i}`} />}
          </div>
        </div>
      </div>

      <div className="mn-demo-ctl mn-noprint">
        {!reduced && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUserPaused(p => !p)} aria-label={playing ? 'หยุดชั่วคราว' : 'เล่นต่อ'}>
            <Icon name={playing ? 'pause' : 'play'} size={14} /> {playing ? 'หยุด' : 'เล่น'}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={replay}><Icon name="refresh" size={14} /> เริ่มใหม่</button>
        {reduced && <button type="button" className="btn btn-primary btn-sm" onClick={next}>ขั้นถัดไป</button>}
        <span className="mn-demo-now" role="status">ขั้นที่ {i + 1} จาก {n}: {caption.text}</span>
      </div>

      <ol className="mn-steps">
        {steps.map((s, k) => (
          <li key={k} className={k === i ? 'cur' : k < i ? 'past' : ''} aria-current={k === i ? 'step' : undefined}>
            <button type="button" className="mn-step-btn mn-noprint" onClick={() => goto(k)} aria-label={`ไปที่ขั้นที่ ${k + 1}`}>{k + 1}</button>
            <span className="mn-step-num">{k + 1}</span>
            <span>{s.text}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

/* ---------- ชิ้นส่วนหน้าจอจำลอง (ใช้ class จริงของระบบ ให้หน้าตาเหมือนของจริง) ---------- */

// กรอบหน้าจอ: แถบหัวจำลอง + ชื่อหน้า
export function MockFrame({ title, children }) {
  return (
    <div className="mn-frame">
      <div className="mn-frame-bar"><i /><i /><i /><span>{title}</span></div>
      <div className="mn-frame-body">{children}</div>
    </div>
  );
}

export const MockToast = ({ show, children }) => show ? <div className="mn-toast">{children}</div> : null;

// ข้อความที่ "ค่อยๆ พิมพ์ทีละตัว" (เผยจากซ้ายไปขวา) — เริ่มเล่นตอน mount จึงต้องเรนเดอร์เมื่อถึงขั้นที่พิมพ์เท่านั้น
export const MockTyped = ({ text }) => <span className="mn-typed">{text}</span>;

export const MockModal = ({ title, children, footer, tone }) => (
  <div className="mn-overlay">
    <div className="mn-modal">
      <div className="mn-modal-title" style={tone ? { color: tone } : undefined}>{title}</div>
      <div className="mn-modal-body">{children}</div>
      {footer && <div className="mn-modal-foot">{footer}</div>}
    </div>
  </div>
);

/* ---------- ชิ้นส่วนย่อยที่ใช้ซ้ำ ---------- */
const TONES = {
  wait:   { bg: 'var(--status-wait-bg)',   fg: 'var(--status-wait-fg)',   dot: 'var(--status-wait-dot)' },
  ok:     { bg: 'var(--status-ok-bg)',     fg: 'var(--status-ok-fg)',     dot: 'var(--status-ok-dot)' },
  reject: { bg: 'var(--status-reject-bg)', fg: 'var(--status-reject-fg)', dot: 'var(--status-reject-dot)' },
  draft:  { bg: 'var(--ink-100)',          fg: 'var(--ink-600)',          dot: 'var(--ink-400)' },
};
export const MockBadge = ({ tone, children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 11px', borderRadius: 999, whiteSpace: 'nowrap', fontSize: 13.5, fontWeight: 700, background: TONES[tone].bg, color: TONES[tone].fg }}>
    <span style={{ width: 7, height: 7, borderRadius: '50%', background: TONES[tone].dot }} />{children}
  </span>
);
export const Field = ({ label, children, style }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-600)' }}>{label}</span>
    {children}
  </div>
);
export const Box = ({ children, dm, style }) => (
  <div data-demo={dm} style={{ border: '1px solid var(--ink-200)', borderRadius: 9, background: '#fff', padding: '7px 11px', fontSize: 14, color: 'var(--ink-900)', minHeight: 20, ...style }}>{children}</div>
);
export const Btn = ({ dm, kind = 'ghost', children, style }) => (
  <button type="button" data-demo={dm} tabIndex={-1} className={`btn btn-sm btn-${kind}`} style={style}>{children}</button>
);

