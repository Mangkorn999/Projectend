# Frontend 10 — Dashboard สถิติ (`dashboardReal.jsx`, 1,262 บรรทัด)

หน้าเดียวใช้ได้ทั้ง **officer** (`readonly` ไม่ส่ง) และ **executive** (`readonly` = true — ดูภาพรวม ไม่มีปุ่มคลิกลงรายชื่อ)
backend: `GET /rounds`, `GET /dashboard/history?years=20`, `GET /dashboard/stats?round_id=` (ดู backend [10](../backend/10-dashboard-สถิติ.md))

> **กฎ:** ตัวเลข/เปอร์เซ็นต์ทุกตัว **backend คำนวณมาให้แล้ว** — ไฟล์นี้แค่ "หยิบมาแสดง/เรียงลำดับ/แบ่งกลุ่ม" ไม่คิดสูตรเอง (ยกเว้นเรื่องรูปแบบ เช่น `toFixed(2)`)
> นับ "ผ่าน" เฉพาะใบที่ยืนยันแล้ว, ตัวหาร = ทั้งรุ่น — ดูกฎที่ backend 10 (หน้าจอมีแถบ `PendingNotice` เตือนเรื่องใบรอตรวจที่ยังไม่นับ)

## โครงหน้า
- **บนสุด:** หัวหน้า (ปีที่เลือก + จำนวนนักศึกษา/เปิดสิทธิ์) + ตัวเลือกปี (`yearPicker`) + แถบเตือนใบรอตรวจ
- **officer:** โซนรอบ — `RoundTabs` (เลือกรอบ/รวมทั้งปี) → การ์ดตัวเลข → `MainTabs` 3-5 แท็บ (สถานะ / อัตราผ่านรายวิชา / ผ่านครั้งแรกรายวิชา / ผ่านกี่วิชา / สถิติเชิงรายงาน)
- **executive:** `ExecutiveOverview` (ตัวเลขหลัก + วิชาเฝ้าระวัง + กราฟรายครั้งที่สอบ) + โซนรายงานหลายปี 5 แท็บ

---

## ค่าคงที่และ state (17-58)
| บรรทัด | อธิบาย |
|---|---|
| 18 | `ALL_ROUNDS = 'all'` ค่าคงที่ตัวเดียวทั้งไฟล์ (ไม่พิมพ์ string ซ้ำแล้วสะกดต่างกัน) |
| 21 | `YEAR_ONLY_TABS = ['firstBySubject','firstCount']` — แท็บที่ตัวเลขเป็นระดับ "ทั้งรุ่น/รอบแรก" ไม่ผูกกับรอบที่เลือก → มีให้กดเฉพาะ "รวมทั้งปี" |
| 28-35 | `subjectTarget` + `openSubjectList(subjectCode, passed, name)` — คลิก "ผ่าน/ไม่ผ่าน" ในการ์ดวิชา เปิด `SubjectResultModal` บนหน้าเดิม; `scope` = `{roundId: Number(tab)}` หรือ (`tab === 'all'`) `{year}` — จำขอบเขตที่ดูอยู่ ณ ตอนกด |
| 37-40 | `goToFirstAttemptStudents(targetYear, passed)` — ส่งตัวกรองให้หน้านักศึกษา (`setStudentsFilter({kind:'firstAttempt', year, passed, tab, mainTab})`) แล้ว `go('students')`; ใช้ `targetYear` ของการ์ดที่กด ไม่ใช่ `year` บนสุด |
| 41-58 | `rounds`, `history`, `year`, `reportYears` (ปีของโซนรายงาน แยกอิสระจาก `year` — ติ๊กได้สูงสุด 3 ปี), `tab` (`ALL_ROUNDS` หรือ round_id), `mainTab` (เริ่มจาก `restoreView?.mainTab` เมื่อกลับมาจากหน้านักศึกษา), `reportTab`, `stats`, `loading`, `error`, `firstRoundSubjects` (`{[ปี]: perSubject[]}`) |

## โหลดข้อมูล
- **ครั้งแรก (61-96)** `Promise.all([/rounds, /dashboard/history?years=20])` — ดึงย้อนหลังยาว ๆ (เผื่อ 10 ปี) ให้ติ๊กปีเก่าในโซนรายงานได้ครบ. แล้วใน `.then`: ตั้ง `year` = `restoreView?.year ?? (ปีของรอบที่เปิด หรือ ปีล่าสุด)` (`Math.max(...ปีทั้งหมด)`); `reportYears` = 3 ปีล่าสุด; `tab` = restore หรือ (officer และมีรอบเปิด → รอบนั้น) ไม่งั้น 'all' (ผู้บริหารดูทั้งปี); **คืน `Promise.all` อีกชุดต่อท้าย (chain `.then`)** ดึง `/dashboard/stats?round_id=` ของ **รอบ 1 ของแต่ละปี** → `Object.fromEntries(pairs)` (อัตราผ่านรายวิชาย้อนหลังต้องใช้ผลรอบแรกอย่างเดียว; `history.years[].perSubject` รวมทุกรอบ ใช้ไม่ได้)
- **สถิติของรอบที่เลือก (100-107)** `useEffect([tab])` — แท็บ "รวมทั้งปี" ข้าม (ใช้ตัวเลขรายปีจาก history); `dropped` flag กัน race สลับแท็บเร็ว
- `changeYear` — เปลี่ยนปี = กลับ "รวมทั้งปี" เสมอ (round_id ของปีเก่าใช้กับปีใหม่ไม่ได้)
- `changeRoundTab` — เลือกรอบเดียวขณะเปิดแท็บที่มีเฉพาะ "รวมทั้งปี" → เด้งกลับ `'status'` (ไม่งั้นปุ่มหายแต่ `mainTab` ค้าง เนื้อหาว่างเปล่า)

## คำนวณก่อน render (122-171)
early return: error → โหลดแรก → ไม่มีรอบเลย (`<Empty>`); `yearOptions` = ปีที่มีรอบ 3 ปีล่าสุด; `roundsInYear` เรียงตามครั้ง; `yearSummary` = สรุปปีของปีที่เลือกจาก history; `showingRound` ตรวจ `String(stats.round.round_id) === tab` (กันแสดง stats ของรอบก่อนหน้าค้าง); `reportHistory` = `history` กรองเฉพาะ `reportYears`; `pendingCount` — officer ที่ดูรอบเดียวใช้ `stats.by.submitted` ไม่งั้น `yearSummary.statusByStudent.submitted`

## JSX หลัก
- (194-263) **โซน officer:** `RoundTabs` → `<div key={tab} className="blur-in">` (key เปลี่ยน = เล่นแอนิเมชันเบลอเข้าใหม่) การ์ดตัวเลข (รอบเดียว = `RoundView statCardsOnly`, ทั้งปี = `YearRoundsView statCardsOnly`) → `MainTabs` → เนื้อหาตาม `mainTab`:
  - `status`: ทั้งปี `StatusDonut` (`perStudent` นับเป็นคน — **ห้ามเอา `by` ของแต่ละรอบมาบวกเอง** นั่นคือจำนวนใบ คนที่กรอก 2 รอบนับซ้ำจนเกิน 100%) / รอบเดียว `RoundView statusOnly`
  - `subjects`: `SubjectRateCard` (ทั้งปีใช้ `yearSummary.perSubject` / รอบเดียวใช้ `stats.perSubject`); executive ไม่ส่ง `onSubjectClick`
  - `firstBySubject`: `FirstAttemptSubjectTable` (components.jsx), `firstCount`: `PassDistribution`
  - `reports`: แท็บย่อย 3 อัน (`FirstAttemptPassRate`, `SubjectHistoryChart`, `YearCompare`)
- (266-289) **โซน executive:** `ExecutiveOverview` + แท็บรายงาน 5 อัน (ไม่ส่ง `onViewStudents` → ไม่มีปุ่มดูรายชื่อ)
- (292-295) `SubjectResultModal` เฉพาะ officer

---

## คอมโพเนนต์ย่อยในไฟล์

### `MainTabs({items, value, onChange})` (301-318)
แถวปุ่มแท็บทั่วไป (`items.map`) ใช้ทั้งแท็บบนและแท็บย่อย ต่างจาก `RoundTabs` ที่มีจุดสถานะเปิด

### `YearMultiPicker` (322-374)
ติ๊กเลือกปีหลายปี สูงสุด `max` (3) — ปุ่มโชว์สรุป `"2569 / 2568"` กดเปิด popover (ฉากหลังโปร่ง `position:fixed inset:0` คลิกนอกปิด)
- `isLastSelected(y)` **ต้องเหลืออย่างน้อย 1 ปีเสมอ** — เดิมติ๊กออกได้หมด → `selected=[]` → กราฟขึ้น "ไม่มีข้อมูล" ผู้ใช้นึกว่าพัง
- `toggle(y)` — เอาออก (ถ้าเหลือ >1) / เพิ่มถ้ายังไม่ครบ `max` (`[...selected, y].sort((a,b) => b - a)`)
- `disabled = atMax || lastOne` (ครบโควตาแล้วติ๊กเพิ่มไม่ได้ / ปีสุดท้ายเอาออกไม่ได้)

### `Section` (377-390) — หัวข้อคั่นโซน สีกำหนดเอง (อยู่บนพื้น canvas ไม่ใช่ในการ์ด ถ้า inherit อาจจางจนอ่านไม่ออก)

### `RoundTabs` (394-421)
`items = [...รอบ(ป้ายตามครั้ง, open = status==='open'), {key: ALL_ROUNDS, label 'รวมทั้งปี'}]`; จุดเขียวข้างปุ่มรอบที่เปิดอยู่; ใช้แท็บแทน dropdown (รอบต่อปีมีไม่กี่รอบ กดทีเดียวถึง)

### `RoundView` (427-461) — มุมมองรอบเดียว (2 โหมดผ่าน flag)
- `statCardsOnly`: `RoundBar` + การ์ด 5 ใบ (grid `g-5`): ผู้ต้องกรอกรอบนี้ (`roundTotal` — ไม่ใช่ `canSubmit` เพราะ `canSubmit` ไม่นับคนที่ถูกถอนสิทธิ์หลังส่งผลแต่ใบยังอยู่ในรอบ ตัวเลขเคยไม่ตรงกับกลางโดนัท), ส่งแล้ว, รอตรวจ, ยืนยันแล้ว, ตีกลับ; การ์ดคลิกได้ไปหน้านักศึกษา/คิวตรวจ
- `statusOnly`: `StatusDonut` (ฐาน = `roundTotal` คนของรอบนี้; คนที่ผ่านครบแล้วแจ้งเป็นบรรทัดข้อมูลแยก ไม่เอาเข้าวง)
- ไม่ส่ง flag = `null` (กันเรียกผิดเงียบ ๆ)

### `StatusDonut` (466-532)
- `segs` 5 ชิ้น (ยืนยัน/รอตรวจ/ตีกลับ/ร่าง/ยังไม่เริ่ม) **`.filter(s => s.value > 0 || s.key !== 'DRAFT')`** (ซ่อนแต่ "ร่าง" เมื่อเป็น 0) — **5 ช่องบวกกันได้เท่า `total` พอดี** %จึงไม่เกิน 100
- `papers` = ใบที่มีจริง; `reviewed` = approved + rejected; `reviewRate` ความคืบหน้าการตรวจ (ตัวหาร = ใบที่ส่งเข้ามา คนละตัวกับสัดส่วนข้างบนที่ตัวหาร = ทั้งรุ่น)
- `pct(n)` = `round(n/total*10000)/100` (ทศนิยม 2 ตำแหน่ง); `Donut` + รายการแต่ละสถานะมีแถบสัดส่วนของตัวเอง

### `YearRoundsView` (538-589) — มุมมองรวมทั้งปี
การ์ด 5 ใบ (ใบแรกเป็นยอดคนเหมือนมุมมองรอบ — สลับแท็บแล้วการ์ดไม่ขยับ) + ตาราง "ผลแยกตามรอบ" (รอบ/จำนวนวิชา/ส่งแล้ว/ผ่านครบ) เรียง `attempt_number`; `roundOf(rid)` หาข้อมูลรอบเพื่อใส่ป้าย phase

### `SubjectRateCard` (592-636)
วน `perSubject` สร้าง `BarRow`: **`rate === null` = ไม่มีใครสอบวิชานี้ (ทุกคนยกผลมา) ขึ้น `—` + "ไม่มีผู้สอบรอบนี้" ไม่ใช่ 0%** (0% = สอบแล้วตกหมด); ปกติ `color="var(--pass)" track="var(--fail)"` (ส่วนที่เหลือเป็นแดง = ไม่ผ่าน), `rightSub` = จำนวนที่สอบ, ปุ่มผ่าน/ไม่ผ่านกดได้เมื่อมี `onSubjectClick`

### `SubjectWatchCard` (644-721) — วิชาที่ต้องเฝ้าระวัง (ผู้บริหาร)
**3 มุมมอง** (แต่ละมุมสูงสุด 3 วิชา) เพราะวิชาอัตราผ่านต่ำสุดอาจไม่ใช่วิชาที่น่ากังวลที่สุด:
1. **ผ่านครั้งแรกต่ำสุด** — `[...subjectsSat].sort((a,b) => a.pass_rate - b.pass_rate).slice(0, 3)` (เฉพาะวิชาที่ `sat > 0`)
2. **ตกลงมากสุดเทียบปีก่อน** — `.map` หาวิชาเดียวกันในปีก่อน `drop = before.pass_rate - s.pass_rate`; `.filter(s => s !== null && s.drop > 0)`; `drops === null` = ไม่มีปีก่อนให้เทียบ (ข้อความต่างจาก "ไม่มีวิชาที่ตก")
3. **ยังไม่ผ่านหลังสอบทุกรอบ** — `year.perSubject.filter(s => s.fail > 0).sort(fail มาก→น้อย)`
`rateColor` เกณฑ์ 80 / 60; `columns` เป็น array ของ object `{key, title, note, empty, rows}` วนสร้าง 3 กล่อง; `@media(max-width:860px)` เรียงลงล่าง

### `ExecutiveOverview` (726-820)
- hero ไล่สีน้ำเงิน: **ร้อยละผ่านครั้งแรก** (`year.firstAttempt.rate`) + `delta` เทียบปีก่อน (▲เขียว/▼แดง) และ **ร้อยละผ่านภายในปีแรก** (`year.firstYear.rate`) + แถบ
- `attemptBars` — อัตราผ่านต่อครั้งที่สอบ = `round(fullyPassed / confirmed * 100)` (**ตัวหาร = `confirmed` ใบที่ยืนยัน** ตัวตั้งนับจากใบยืนยันเหมือนกัน ไม่ใช่ `submitted`), สีไล่จางตามลำดับครั้ง (`palette[Math.min(i, len-1)]`)
- `SubjectWatchCard`, `ColumnChart` + กล่อง `ผ่าน/ทั้งหมด คน` ต่อครั้ง

### `RoundBar` (824-893) — แถบสรุปรอบ + นับถอยหลัง
- `daysLeft` = ผลต่าง "วัน" ต่อ "วัน" (ตัดเวลา: `setHours(0,0,0,0)` ทั้งสองฝั่ง แล้ว `Math.round((startOfClose - startOfToday) / 86400000)`) — ไม่งั้นปิด 23:59 วันนี้กลายเป็น 0 วันตั้งแต่เช้า
  > **ข้อสังเกต:** ที่นี่ใช้ `setHours` (ตาม timezone เครื่องผู้ใช้) ขณะที่ฝั่ง backend จงใจเลี่ยง `setHours` (ใช้ UTC+7 คงที่) — ผู้ใช้ในไทยผลเหมือนกัน แต่ถ้าเปิดจากเครื่องที่ตั้ง timezone อื่นอาจเลื่อน 1 วัน (`buildAlerts` ฝั่ง backend คำนวณแบบ UTC+7 ถูกต้องกว่า)
- `countsDown = phase === 'active' || 'expired'` — นับถอยหลังเฉพาะรอบที่เปิดจริง (scheduled บอก "เหลือ 6 วัน" คนอ่านเข้าใจผิด; closed ไม่มีใครกรอกได้อยู่แล้ว)
- สี: `< 0` แดง "สิ้นสุดแล้ว", `0` แดง "วันสุดท้าย", `≤ 3` ส้ม, อื่น ๆ เทา
- `flex: '0 1 auto'` + `minWidth: 0` ให้หดได้บนจอแคบ (เดิม `flex:'none'` มือถือ 390px ล้นขอบขวา 22px)

### `PassDistribution` (898-971)
ตาราง "ผ่านกี่วิชา × ห้อง" (ข้อมูลจาก `passDistribution` ของ backend): หัว 2 ชั้น (`rowSpan`/`colSpan`), คอลัมน์ต่อห้องมี 2 ช่อง (จำนวน/%), คอลัมน์รวมพื้นทอง; `dist.rooms.map(r => [<th/>, <th/>])` คืน array ของ element (React ต้องมี `key` ทุกตัว); แถวไม่มีคนจางลง (`opacity .45`); แถว `label === 'not_submitted'` เส้นบนหนา = คนที่ไม่ได้ส่งผลเลย; footnote บอกตัวหาร

### `SubjectHistoryChart` (977-1050)
- เลือกปีที่มี `firstRoundSubjects[ปี]?.length > 0` เรียงเก่า→ใหม่
- **แกน x = union ของวิชาทุกปี** (`new Set(years.flatMap(...))` + `sort(localeCompare numeric)`) ไม่ใช่เฉพาะปีล่าสุด — ถ้ารอบแรกปีล่าสุดสอบไม่ครบ วิชาจะหายจากกราฟทั้งที่ปีอื่นมีข้อมูล
- `series` ต่อปี: `values` = `rate` หรือ **`null`** (ไม่ได้เปิดสอบวิชานั้น/ไม่มีคนสอบ — ส่ง null ไม่ใช่ 0 กัน MultiLineChart วาดจุดหลอกว่า "สอบแล้วตกหมด"), `tooltips`
- สลับ เส้น/แท่ง (`chartType`), ปุ่มขยายเป็น modal กว้าง 1200 (`MultiLineChart`/`MultiBarChart` ขนาดใหญ่)

### `YearCompare` (1054-1095)
ตาราง "ผ่านครบทุกวิชา ปีนี้ × ห้อง": `rooms = [...new Map(history.years.flatMap(y => y.byRoom.map(r => [r.room_id, r]))).values()].sort(...)` — **`Map` ตัดซ้ำตาม `room_id`** รวมห้องจากทุกปี (เผื่อบางปีไม่มีคนส่งบางห้อง); ตัวหาร = นักศึกษาทั้งห้อง (`room.total`); `room_name` มาจาก DB ไม่ hardcode

### `FirstAttemptPassRate` (1100-1216)
การ์ดร้อยละผ่านครั้งแรกรายปี: `yearsOldToNew = [...history.years].reverse()`; `YearBlock` (คอมโพเนนต์ย่อยในฟังก์ชัน) แสดง % ผ่านครั้งแรก, แถบ (เขียวเมื่อ ≥ 80), จำนวน, **ผ่านภายในปีแรก** (รวมรอบ 2,3 จึง ≥ ผ่านครั้งแรกเสมอ), ส่วนต่างเทียบปีก่อน; ใช้ `div role="button"` ไม่ใช่ `<button>` เพราะข้างในมีปุ่ม "ดูรายชื่อ" (button ซ้อน button ผิด HTML browser จะแก้ DOM แล้วคลิกไม่ทำงาน); ปุ่มดูรายชื่อ `e.stopPropagation()` แยกจากการคลิกเปิด modal รายรอบ; เลือกหลายปี → `ColumnChart` เทียบ, ปีเดียว → ข้อความให้ติ๊กปีเพิ่ม; `grid auto-fit minmax(...)` ยืดการ์ดเต็มกว้างเสมอ; modal ขยาย + modal รายรอบ (`RoundBreakdownTable`)

### `RoundBreakdownTable` (1221-1247)
การ์ดต่อรอบ: `hasBase = r.confirmed > 0`; **ไม่มีฐาน = `—` ไม่ใช่ 0.00%**; ผ่านครั้งแรกของรอบ = `fullyPassed / confirmed`

### `PendingNotice` (1252-1262)
แถบเตือน "ยังมีใบรอตรวจ N ใบ ยังไม่นับ" — ระหว่างตรวจไม่ครบตัวเลขจะต่ำกว่าจริงชั่วคราว แถบนี้บอกเหตุผล (`role="status"`); `go` = ไปคิวตรวจ (executive ส่ง `null` ไม่มีปุ่ม)
