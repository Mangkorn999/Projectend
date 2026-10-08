/* ============================================================
   ชิ้นส่วนเอกสารที่คู่มือภาษาไทย (userManual.jsx) และภาษาอังกฤษ (userManualEn.jsx) ใช้ร่วมกัน
   แยกออกมาเป็นไฟล์เดียวกัน เพื่อไม่ให้ 2 ไฟล์ import กันเป็นวงกลม
   ============================================================ */
import { Icon } from './data.jsx';
import { useManualLang } from './manualDemoEn.js';

const CALLOUT_ICON = { note: 'info', warn: 'alert', danger: 'alert' };
const CALLOUT_TITLE = {
  TH: { note: 'หมายเหตุ', warn: 'ข้อควรระวัง', danger: 'ข้อห้าม / ผลกระทบสำคัญ' },
  EN: { note: 'Note', warn: 'Caution', danger: 'Restriction / important impact' },
};

export function Callout({ type = 'note', title, children }) {
  const lang = useManualLang();
  return (
    <div className={`mn-callout ${type}`} role="note">
      <Icon name={CALLOUT_ICON[type]} size={19} className="ic" />
      <div><span className="t">{title || CALLOUT_TITLE[lang][type]}</span>{children}</div>
    </div>
  );
}

export const Proc = ({ children }) => <ol className="mn-proc">{children}</ol>;
