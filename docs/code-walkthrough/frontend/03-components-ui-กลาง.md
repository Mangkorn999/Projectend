# Frontend 03 — คอมโพเนนต์ UI กลาง (`components.jsx`) + data/logo/skeleton/tweaks/modal

ไฟล์ (`frontend/src/design/`): `components.jsx` (1204), `data.jsx` (240), `logos.jsx` (46), `skeletons.jsx` (101), `tweaks-panel.jsx` (139), `subjectResultModal.jsx` (122)
> ทุกหน้าใช้ชิ้นส่วนจากไฟล์เหล่านี้ — เข้าใจที่นี่แล้วอ่านหน้าอื่นง่ายขึ้นมาก
> สไตล์: CSS ตัวแปรใน `styles.css` (เช่น `var(--navy-700)`, `var(--ink-500)`), class ร่วม (`card`, `btn`, `badge`, `tbl`, `input`) — ดู [frontend 04 ท้ายไฟล์](04-helpers-notifications-evidence-pdf.md) เรื่อง CSS

## React ที่ใช้ในไฟล์นี้ (เพิ่มจาก [frontend 02](02-login-forcechange-completeprofile.md))
- **`useRef`** = กล่องเก็บค่า/ชี้ DOM ที่ **เปลี่ยนแล้วไม่ทำให้วาดใหม่** (`ref.current`)
- **cleanup ของ `useEffect`** = ฟังก์ชันที่ `return` ออกมา ทำงานตอนคอมโพเนนต์ถูกถอด/ก่อนรัน effect รอบหน้า (ใช้ล้าง timer, ถอด event listener — กัน memory รั่ว)
- **`createPortal(jsx, document.body)`** = วาดลงที่อื่นของ DOM (นอก parent) — ใช้กับ Modal/Select เพราะ parent ที่ตั้ง `overflow:hidden` จะตัดครึ่ง
- **`React.Fragment` / `<>...</>`** = ห่อหลาย element โดยไม่เพิ่ม tag
- **optional chaining `onClick?.()`** = เรียกถ้ามี ไม่ error ถ้าไม่มี

---

## `data.jsx`
| บรรทัด | อธิบาย |
|---|---|
| 6-57 | `ICONS` = object ชื่อไอคอน → ข้อความ path ของ SVG (ขนาด 24×24 เส้นขอบ) เช่น `home:'M3 11.5 12 4l...'` |
| 59-67 | `Icon({name, size, stroke, style, className})` — วาด `<svg>` ใช้ `currentColor` (สีตาม text color ของ parent). `(d\|\|'').split('M').filter(Boolean).map(seg => <path d={'M'+seg}/>)` — path ที่มีหลายส่วนแยกด้วย `M` แตกเป็นหลาย `<path>` |
| 70-79 | `SUBJECTS` **ข้อมูลตัวอย่าง** (รหัส NLE1-8) — ไม่ใช้กับข้อมูลจริง (ข้อมูลจริงมาจาก `/api/subjects`) |
| 83-88 | `ROLES` ค่าชื่อ role |
| 91-96 | `STATUS` — map ชื่อสถานะ → `{key (ชื่อ class สี), label}`: `DRAFT/SUBMITTED/CONFIRMED/REJECTED` ใช้โดย `StatusBadge` |
| 98-240 | ข้อมูลจำลองยุคต้นแบบ UI: `ROUNDS`, `genStudents` (สร้างนักศึกษาปลอมด้วย `seededRand` — PRNG แบบ linear congruential `s*9301+49297 mod 233280` ผลเหมือนเดิมทุกครั้ง), `NEWS`, `computeStats`, `TREND`, `YEARLY` ฯลฯ — **เป็น mock ที่หน้าจอจริงเลิกใช้แล้ว** (เหลือไว้ให้ import ไม่พัง และให้ `Icon`/`STATUS` ใช้) |
| 240 | `plural(n)` — จัดรูปตัวเลขแบบไทย `toLocaleString('th-TH')` |

## `logos.jsx` (46 บรรทัด)
- `NurseEmblem({size, light})` — SVG โลโก้ PSU Nurse: เส้นหัวใจเส้นเดียวเป็นหางม้วน (`<path>` สี `orange`), เพชร 2 ชั้น (ชั้นเงา `translate(3,3)` + ชั้นหน้า), กากบาทด้วย `<rect>` 2 อัน, ข้อความ "PSU Nursing License". `light` = โหมดสีขาวบนพื้นเข้ม (สลับสี orange/cross)
- `Logo({size, light})` — ห่อ emblem ใน flex

## `skeletons.jsx` (101 บรรทัด) — โครงตอนโหลด
หลักคิด: วาดโครงให้หน้าตาใกล้ของจริง ข้อมูลมาถึงแล้วแทนที่ตำแหน่งเดิม หน้าไม่กระโดด (ดีกว่าข้อความ "กำลังโหลด…")
| ฟังก์ชัน | วาดอะไร |
|---|---|
| `SkeletonBox({w,h,r,style})` | กล่องเทาพร้อมแอนิเมชัน (`.skeleton`) — ตัวประกอบพื้นฐาน |
| `SkeletonTable({rows=8, cols=4})` | ตาราง: `Array.from({length: n}).map(...)` สร้าง n รายการ; คอลัมน์แรกกว้างกว่า (ตารางของระบบขึ้นต้นชื่อคนเสมอ); `aria-busy`/`aria-live` บอกโปรแกรมอ่านหน้าจอ |
| `SkeletonCards({count=6})` | การ์ดเรียงกริด (หน้ารอบการกรอก) |
| `SkeletonList({count=4})` | รายการการ์ดเรียงลง (ข่าว) |
| `SkeletonDashboard()` | หัวหน้า + แถวตัวเลข 4 ใบ + การ์ดโดนัทใหญ่ |

---

## `tweaks-panel.jsx` (139 บรรทัด) — แผงปรับแต่ง (เครื่องมือ design/เดโม ไม่ใช่ flow ผู้ใช้)
| ส่วน | อธิบาย |
|---|---|
| `useTweaks(defaults)` | custom hook: เก็บ object ค่า; `setTweak(key, val)` หรือ `setTweak({a:1,b:2})` (แยกด้วย `typeof === 'object'`) รวมเข้า state ด้วย `{...prev, ...edits}`; `useCallback` ทำให้ฟังก์ชันคงที่ ไม่สร้างใหม่ทุก render |
| `__TWEAKS_STYLE` | CSS ทั้งแผงเป็นสตริง `<style>{...}</style>` (class `twk-*`) |
| `TweaksPanel` | ปุ่ม ⚙ มุมจอ → กดเปิดแผง (state `open`) |
| `TweakSection`, `TweakRow`, `TweakToggle` (สวิตช์ `role="switch"`), `TweakRadio` (กลุ่มปุ่ม `role="radiogroup"`), `TweakColor` (ชิปสี เทียบด้วย `JSON.stringify(...).toLowerCase()`) | ตัวควบคุมฟอร์มย่อย |

---

## `components.jsx` — ไล่ตามลำดับในไฟล์

### ป้าย/อวาตาร์ (10-27)
- `StatusBadge({status, size, lang})` — `STATUS[status] || STATUS.DRAFT` เลือก class สี + ข้อความแปลจาก `t(lang, 'status.'+status)`; `size==='lg'` ใหญ่ขึ้น
- `PassBadge({passed, lang})` — `null/undefined` = "ยังไม่มีข้อมูล" (เทา), `true` ผ่าน (เขียว), `false` ไม่ผ่าน (แดง)
- `Avatar({name, size, bg})` — วงกลมตัวอักษรแรกของชื่อ (`charAt(0)`)

### `TopBar` (38-137) — แถบบนสุด
| บรรทัด | อธิบาย |
|---|---|
| 39-43 | state เปิดเมนูผู้ใช้ `open`, เปิดกระดิ่ง `notifOpen`, `clearing`; `clearTimer` เป็น `useRef` เก็บ id ของ `setTimeout` |
| 44 | `useEffect(() => () => clearTimeout(...), [])` — cleanup ตอนถอดคอมโพเนนต์ (ฟังก์ชันที่ return ฟังก์ชัน) |
| 45 | `openNotif` — ปิดโหมด clearing, เปิด modal, เรียก `onNotifOpen?.()` (app.jsx ทำเครื่องหมายอ่านหมด) |
| 46-51 | `clearAllSmooth` — กด "ล้างทั้งหมด": ตั้ง `clearing`; รอเวลา = `(จำนวน−1)*CLEAR_STAGGER_MS + ROW_LEAVE_MS` ให้แถวหลุดออกทีละบรรทัดจบก่อน แล้วค่อยเรียก `onNotifClearAll()` ลบจริง (กันกดซ้ำด้วย `if (clearing) return`) |
| 54-55 | แยกแจ้งเตือน 2 กลุ่ม: `live` (ต้องลงมือทำ) กับเหตุการณ์ปกติ — ไม่ปนกันเพื่อให้เรื่องด่วนไม่จมกองประกาศ |
| 57-135 | JSX: ปุ่มเมนู (เฉพาะมือถือ `only-mobile`), โลโก้+ชื่อระบบ (เฉพาะเดสก์ท็อป `only-desktop`), ปุ่มสลับ TH/EN (วงกลม spinner ระหว่างเปลี่ยน), ปุ่มกระดิ่ง (จุดแดงเมื่อ `unread>0`, มี `aria-label` สำหรับ screen reader), `<Modal>` แจ้งเตือน (2 กลุ่ม `NotifRow` + footer ปุ่มล้างทั้งหมด หรือ `<Empty>`), เมนูผู้ใช้ (ฉากหลังโปร่ง `position:fixed inset:0` คลิกนอกเมนูแล้วปิด; ปุ่ม logout `onSwitchRole('logout')`) |

### `NotifRow` (139-241) — แถวแจ้งเตือนที่ลากทิ้งได้
- ค่าคงที่: `SWIPE_DISTANCE=90` (ลากเกินนี้ = ลบ), `ROW_LEAVE_MS=460`, `CLEAR_STAGGER_MS=90`
- state: `dragX` (ระยะลาก), `dragging`, `leaving`, `collapsed`; ref: `startX`, `moved` (แยก "ลากจริง" จาก "คลิก")
- **Pointer Events** (รองรับเมาส์+นิ้วด้วยชุดเดียว): `onPointerDown` เก็บ x เริ่ม + `setPointerCapture` (ติดตามต่อแม้เมาส์ออกนอกกล่อง); `onPointerMove` คำนวณ `dx`, ขยับเกิน 6px นับว่าลาก; `onPointerUp` — ลากเกิน 90px → 3 จังหวะ: เลื่อนออกนอกจอ (`setDragX(±700)`) → 220ms หดความสูง → 480ms `onDismiss(key)`; ไม่ถึง → เด้งกลับ `setDragX(0)`
- `useEffect([clearDelay])` — โหมด "ล้างทั้งหมด" รอตามคิวแล้วเลื่อนออกขวา; cleanup `ids.forEach(clearTimeout)`; **ไม่เรียก onDismiss เอง** parent ลบทั้งชุดครั้งเดียวทีหลัง (ไม่งั้น setState ซ้ำรัว ๆ)
- `handleClick` ข้ามถ้า `moved.current` (เพิ่งลาก); `handleKeyDown` กด Delete/Backspace ลบ (ผู้ไม่ใช้เมาส์)
- สีแดงชั้นล่างเข้มขึ้นตามระยะลาก `redAmount = min(|dragX|/90, 1)`; แถวอ่านแล้วจาง `opacity .7` เฉพาะเนื้อหา (ถ้าจางทั้งแถว สีแดงทะลุ)

### `Sidebar` (244-270)
เมนูซ้าย: `items.map(it => it.section ? หัวข้อ : ปุ่มเมนู)`; ปุ่มเมนู `className={'nav-item'+(active===it.k?' active':'')}`; `badge` แสดงเลขเตือน; มือถือมีฉากหลังมืดคลิกปิด; ปุ่มพับ sidebar (`collapsed`) เฉพาะเดสก์ท็อป

### `StatCard` (273-299) — การ์ดตัวเลข KPI
`tones` = map ชื่อโทน → `[สีตัวอักษร, สีพื้น]`; `onClick` ทำให้การ์ดคลิกได้ + เอฟเฟกต์ยกขึ้น (`onMouseEnter/Leave` ตั้ง `style.transform` ตรง ๆ); `accent` = แถบสีซ้าย

### `Donut` (302-328) — กราฟโดนัท SVG
- `R = (size - thickness)/2`, `C = 2πR` (เส้นรอบวง)
- แต่ละชิ้นเป็น `<circle>` เส้นขอบหนา ใช้ `strokeDasharray = "ความยาวชิ้น ที่เหลือ"` และ `strokeDashoffset = -off` (เลื่อนเริ่มต้นชิ้นต่อไปตามความยาวสะสม `off += len`)
- `pad` เว้นช่องว่างระหว่างชิ้น (เฉพาะเมื่อมี >1 ชิ้นที่มีค่า)
- `center` = JSX กลางวง (ตัวเลขสรุป)

### `BarRow` (334-377) — แท่งอัตราผ่านรายวิชา
- `pct = value/max*100`, `failPct = 100 - pct`
- แท่งเขียว (`w`) กับแท่งแดง `track` (`fw`) เริ่มที่ 0 แล้ว `setTimeout 600ms` ตั้งเป็นค่าจริง → CSS transition ไล่ความกว้าง (รอให้ animation เบลอเข้าของการ์ดจบก่อน)
- `onPassClick`/`onFailClick` → ปุ่ม badge "ผ่าน N คน"/"ไม่ผ่าน N คน" กดดูรายชื่อ (เปิด `SubjectResultModal`)
- `rightSub` ฐานที่ใช้คิด % ใต้ตัวเลขใหญ่

### `FirstAttemptSubjectTable` (385-479)
ตารางผ่านครั้งแรกรายวิชา — **ตัวเลขทุกตัวมาจาก backend** (`firstAttemptBySubject`) ฝั่งนี้ไม่คิด % เอง
- ไม่มีข้อมูล (`!data.cohort_total` / ไม่มีวิชา) → `<Empty>`
- `rows = [...subjects].sort((a,b) => a.subject_code.localeCompare(b.subject_code))` (copy ก่อน sort)
- ค่าคงที่สไตล์ `BORDER`, `HEAD`, `NUM`; คอมโพเนนต์ย่อย `Cell({count, rate, bold, dash})` คู่ "จำนวน + ร้อยละ" (`rate.toFixed(2)`; `dash` = `—` เมื่อไม่มีใครสอบ)
- หัวตาราง 2 ชั้น: `rowSpan={2}` / `colSpan={2}`; `[0,1].map(...)` สร้างหัวย่อย จำนวน/ร้อยละ ซ้ำ 2 กลุ่ม (ผ่าน/ไม่ผ่าน)
- `hoverRow` ไฮไลต์แถวที่เมาส์อยู่; `tfoot` แถวรวม (นับเป็นคน)
- footnote 2 บรรทัด: ตัวหาร + หมายเหตุรายงานสภา (ห้ามเอาออก — อธิบายว่าทำไมผ่าน%+ไม่ผ่าน% ไม่ครบ 100%)

### กราฟอื่น
| คอมโพเนนต์ | อธิบาย |
|---|---|
| `ColumnChart` (482-497) | แท่งแนวตั้ง: `max = Math.max(...values, 1)` (`...` spread array เป็น argument; `1` กันหารศูนย์), ความสูงเป็น % ของ max, `minHeight:6`, `animationDelay` ไล่ตามลำดับ |
| `LineChart` (500-524) | เส้น+พื้นที่ใต้เส้น: `xs(i)`, `ys(v)` ฟังก์ชันแปลงค่า → พิกัด SVG; `path` สร้างจาก `M x,y L x,y ...` (`i ? 'L' : 'M'`); `area` ปิดพื้นที่ลงเส้นฐาน; `linearGradient` ไล่สีจาง; จุด+ป้ายค่า |
| `MultiLineChart` (527-613) | หลายเส้นเทียบกัน (เช่น อัตราผ่านรายวิชาหลายปี): (a) `hover` ข้อมูล tooltip; (b) `front` — กดชื่อปีใน legend ดันเส้นนั้นขึ้นบนสุด (วาดหลังสุดใน DOM = อยู่บนสุด; `[...series.keys()].sort(...)` เรียงใหม่แต่คง `si` เดิม); (c) **แอนิเมชันเลื้อยเส้น:** `getTotalLength()` วัดความยาวเส้นจริงของ `<path>` ผ่าน `pathRefs`; `strokeDasharray = ความยาว`, `strokeDashoffset = drawn ? 0 : ความยาว` + transition → เส้นไล่วาดจากซ้ายไปขวา; ก่อนวัดเสร็จใช้เลข 2000 ไม่ใช่ 0 (`dasharray:0` = ปิด dash เส้นจะโผล่เต็มก่อนแล้วหด); (d) `useEffect([], ...)` ทำครั้งเดียวตอน mount เพราะ props `series` สร้างใหม่ทุก render ถ้าผูก deps animation จะรีเซ็ตไม่จบ; (e) ค่า `null` = ข้ามจุด (ปีนั้นไม่ได้สอบวิชานี้) เส้นต่อข้ามช่อง ไม่ลากไปหา 0; (f) วงกลมโปร่งใส r=11 ใหญ่กว่าจุดจริงให้ hover ง่าย |
| `MultiBarChart` (616-682) | หลายแท่งจัดกลุ่มต่อหมวด แกนเดียวกับเส้น: `groupW`, `barW = max((groupW - gap*(n-1))/n, 2)`, แท่งที่ไม่ใช่ที่ hover จางลง |

### `PageHead`, `Toast`, `useToast` (685-716)
- `PageHead({title, sub, actions, crumb})` หัวหน้า
- `Toast` ข้อความลอยกลางล่าง — `map` ชนิด → `[class, icon]`
- `useToast()` คืน `[toast, show]`; `show(msg, type='success')` ตั้ง state และ `setTimeout 2600ms` ปิด; เก็บ id timer ที่ `window.__t` เพื่อ `clearTimeout` ของเก่าก่อน (toast ใหม่ทับของเก่าไม่หายก่อนเวลา)

### แจ้งเตือน popup (718-768)
- `TOAST_MS = 6000` (เดิม 30 วิ นานเกินจนบังปุ่มหัวหน้า)
- `useNotifToasts()` คืน `[items, push, setItems]`; `push` ใส่ `_toastId = key + ':' + Date.now()` ให้ id ไม่ซ้ำแม้ key เดิม แล้วตั้ง timer ลบเอง
- `NotifToastStack` — `position:fixed top:70 right:16` ห้อยใต้กระดิ่ง; กล่องแม่ `pointerEvents:none` (ช่องว่างคลิกทะลุ) การ์ดลูก `auto`; ใช้ `div role="button"` ไม่ใช่ `<button>` เพราะข้างในมีปุ่มปิดซ้อน (HTML ห้ามปุ่มซ้อนปุ่ม browser จะแก้ DOM เพี้ยน); รองรับคีย์บอร์ด Enter/Space; `e.stopPropagation()` ที่ปุ่มปิดกันไม่ให้คลิกทะลุไปการ์ด; `aria-live="polite"`

### `ExportMenu` (775-821) — ปุ่ม "ส่งออก ▾" ตัวเดียวของทุกหน้า
- props: `items=[{key,label,icon,run}]`, `up` (เมนูกางขึ้น), `align`, `onError`
- `tr` = ใช้ `tt` ของหน้าถ้าส่งมา ไม่งั้นแปลเอง
- `useEffect([open])` — เปิดอยู่: ฟัง `mousedown` นอกกล่อง + `keydown` Esc เพื่อปิด; cleanup ถอด listener
- `run(item)`: ปิดเมนู → `setBusyKey` → `await item.run()` ใน `try/catch` (error → `onError?.(msg)`) → `finally` ปลด busy; ระหว่างทำปุ่ม disabled + "กำลังสร้างไฟล์…"
- `single` (มีรูปแบบเดียว) = กดแล้วโหลดเลย ไม่เปิดเมนู; `onClick={e => e.stopPropagation()}` เพราะบางที่วางในการ์ดคลิกได้
- computed key: `[up ? 'bottom' : 'top']: '100%'` เลือกชื่อ property ตามเงื่อนไข

### `Modal` (825-853)
- ปิดแล้วไม่หายทันที: state `mounted` + `MODAL_EXIT_MS=170` ให้เล่นแอนิเมชันออก (`is-closing`) แล้วถอดจริง
- `if (open && !mounted) setMounted(true)` — ตั้ง state ระหว่าง render ตามที่ React แนะนำ
- `createPortal(..., document.body)`; คลิกฉากหลัง = `onClose`; `e.stopPropagation()` ที่การ์ดกันคลิกข้างในปิด modal; `title`, `footer` ไม่บังคับ

### `Loading`, `Empty` (856-871)
วงกลมหมุน + ข้อความ (`role="status"`) / สถานะว่าง ไอคอน+หัวข้อ+คำอธิบาย+ปุ่ม

### `Select` (888-1093) — dropdown ค้นหาได้ แทน `<select>` ของ browser
**ทำไมสร้างเอง:** `<select>` ของ browser (1) รายการยาวล้นจอ เลื่อนไม่ได้ (2) พิมพ์ค้นหาไม่ได้
- ใช้เหมือน `<select>` แต่ส่ง `options=[{value,label}]`; `value` เทียบด้วย `===` (state string → value ต้อง string)
- `searchable` ไม่ส่ง → มีช่องค้นหาเมื่อเกิน 7 ตัวเลือก
- `shown` = กรองด้วย label **และ value** (ไม่สนตัวพิมพ์: `toLowerCase`)
- **`measure()`** วัดตำแหน่งปุ่ม (`getBoundingClientRect`) คำนวณกล่อง: ที่ว่างใต้ปุ่ม < 300px และข้างบนมากกว่า → พลิกขึ้นบน (`dropUp`)
- วาดผ่าน `createPortal` (การ์ดหลายใบ `overflow:hidden` จะตัดกล่อง) + ฉากหลังโปร่งใส `zIndex:300` คลิกนอกกล่องปิด
- ปิดแบบจางออก `SELECT_EXIT_MS=120`; เปิดซ้ำตอนกำลังปิด = ยกเลิกการปิด
- effect: ฟัง `scroll` (capture `true` ได้ยินการเลื่อนของกล่องด้านในด้วย) และ `resize` → `measure()` ใหม่; เปิดแล้ว focus ช่องค้นหา; `scrollIntoView({block:'nearest'})` แถวที่ไฮไลต์
- `changeQuery` ตั้ง `query` และ `activeIndex=0` พร้อมกันใน handler เดียว (React รวมเป็น render เดียว — ถ้าใช้ useEffect ตามหลังจะ render 2 รอบ รอบแรกไฮไลต์ผิด)
- **คีย์บอร์ด (`onKeyDown`):** ปิดอยู่: Enter/Space/↓ เปิด; เปิดอยู่: Esc ปิด, ↓/↑ ขยับ (`Math.min/max` หนีบ), Home/End, Enter เลือก, Tab ปิด; `e.preventDefault()` กัน browser เลื่อนหน้า
- `pick` เรียก `onChange(opt.value)` แล้ว `focus()` กลับปุ่ม (ไม่งั้น Tab ต่อจะกระโดดไปต้นหน้า)
- ARIA: `aria-haspopup="listbox"`, `role="option"`, `aria-selected`

### `Pagination` (1098-1169)
- `pageNumbers(page, pages)` — ≤ 7 หน้า แสดงทุกหน้า; มากกว่านั้น: หน้าแรก + หน้าข้างเคียง + หน้าสุดท้าย คั่นด้วย `'…'` (`page` เริ่มที่ 0)
- `PageJump` ช่องพิมพ์เลขหน้า (แสดงเมื่อ > 7 หน้า): `onChange` กรองเหลือตัวเลข `replace(/[^0-9]/g,'')`; **กระโดดเมื่อกด Enter เท่านั้น** (ไม่ใช่ระหว่างพิมพ์ — พิมพ์ "50" ผ่าน "5" หน้าจะกระพริบ); blur = ล้างทิ้งไม่กระโดด; `n - 1` แปลงเลขที่ผู้ใช้นับจาก 1 เป็น index จาก 0 ที่เดียว; หนีบช่วง
- `Pagination({page, pages, onPage, lang})` — `pages <= 1` ไม่แสดง; ปุ่มก่อนหน้า/ถัดไป `disabled` ที่ขอบ; ใช้คู่ `usePagedList`

### `Stepper` (1172-1197)
ขั้นตอนเป็นวงกลมเลข (`done` = เขียว+เครื่องหมายถูก, `on` = น้ำเงิน, ยังไม่ถึง = ขาว) เชื่อมด้วยเส้น (เขียวถ้าผ่านแล้ว)

### `actorLabel(actor, tt)` (1201-1204)
ชื่อผู้ดำเนินการ + ต่อท้าย "(ปิดบัญชีแล้ว)" ถ้า `actor.is_closed` (ชื่อยังอยู่ ประวัติไม่หาย)

---

## `subjectResultModal.jsx` (122 บรรทัด)
หน้าต่างรายชื่อนักศึกษาที่ผ่าน/ไม่ผ่านวิชาหนึ่ง ใช้ร่วม Dashboard + รายงานสรุป (logic ที่เดียว) — `target={subjectCode, subjectName, passed}`, `scope={roundId}` หรือ `{year}`
| บรรทัด | อธิบาย |
|---|---|
| 22-27 | `scopeQuery(scope)` → `round_id=..` หรือ `year=..` |
| 30-31 | state `data` (null = กำลังโหลด), `error` |
| 33 | `query` สตริงเดียวใช้ทั้ง list และ export (กฎตรงกัน) |
| 36-52 | `useEffect([query])` โหลด `GET /students/subject-result-list?...`; ตัวแปร `dropped` กันตั้ง state หลังปิดหน้าต่าง; cleanup ตั้ง `dropped = true` |
| 55-75 | สร้าง `exportItems` สำหรับ `ExportMenu` (PDF, Excel) ด้วย `for...of` — `run` เรียก `downloadFile('/students/export-subject?...&format=..')` ตั้งชื่อไฟล์ `รายชื่อ-ผ่าน-1106.pdf` |
| 82 | `hasStudents` |
| 85-120 | `<Modal open>`: เลือกแสดง error / กำลังโหลด / ว่าง (`Empty`) / ตาราง (ชื่อ+รหัส+ห้อง `roomName(lang, ...)` แปลชื่อห้อง); ปุ่มส่งออกมีเมื่อมีรายชื่อ |
