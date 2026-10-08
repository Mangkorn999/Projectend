# Frontend 06 — ข่าวสาร/ประกาศ (`newsReal.jsx`, 448 บรรทัด)

ไฟล์เดียว 2 หน้า: **`StudentNewsReal`** (นักศึกษา อ่านอย่างเดียว) และ **`ManageNewsReal`** (เจ้าหน้าที่ CRUD)
backend: `GET/POST/PUT/DELETE /news`, `POST/DELETE/GET /news/:id/image` (ดู backend [09](../backend/09-news-และ-notifications.md))

> ประกาศ **ผูกกับรอบสอบ** — backend ส่งให้นักศึกษาเฉพาะประกาศของรุ่นตัวเอง (หน้าจอไม่กรองเอง)

---

## ส่วนช่วยร่วม (1-107)

### `Lightbox({ url, onClose, tt })` (18-68) — ดูรูปเต็มจอ + ซูม (CSS transform ล้วน ไม่ใช้ไลบรารี)
| บรรทัด | อธิบาย |
|---|---|
| 19-21 | state `scale` (ซูม), `pos` (ตำแหน่งที่ถูกลากไป); `drag = useRef(null)` จุดเริ่มลาก (`null` = ไม่ได้ลาก — ใช้ ref เพราะเปลี่ยนแล้วไม่ต้องวาดใหม่) |
| 23-30 | `useEffect`: ฟัง `keydown` Esc ปิด; **ล็อกการเลื่อนหน้าเบื้องหลัง** `document.body.style.overflow='hidden'` (เก็บค่าเดิม `prev` ไว้คืน); cleanup ถอด listener + คืน overflow |
| 33-37 | `zoom(next)` — หนีบ 1-5 เท่า (`Math.min(5, Math.max(1, next))`) (ต่ำกว่า 1 ไม่มีประโยชน์ สูงกว่า 5 เห็นแต่พิกเซล); กลับ 1 เท่า → รีเซ็ตตำแหน่งกลางจอ |
| 39-41 | ลากรูป: `onDown` (เฉพาะตอนซูม >1) จดระยะ `clientX - pos.x`; `onMove` อัปเดต `pos`; `onUp` ปล่อย |
| 47-65 | JSX: ฉากหลังดำ คลิกปิด; กล่องปุ่ม −/%/+/✕ `stopPropagation` (กันคลิกปุ่มทะลุไปปิด overlay); `<img>` ใช้ `transform: translate(..) scale(..)`, ล้อเมาส์ซูม `onWheel` (`deltaY < 0` = เลื่อนขึ้น = ซูมเข้า), `transition` ปิดตอนลาก (ไม่งั้นรูปหน่วง) |

### `NewsImage({ newsId, maxHeight, ... })` (70-88)
รูปประกอบประกาศ — endpoint ต้อง login แต่ `<img src>` ยิงเองคุม credentials ไม่ได้ → **โหลดเป็น blob** ด้วย `fetchAuthedObjectUrl` แล้วชี้ `src` ไป object URL
- `revoked` flag กัน race: ถ้าถอดคอมโพเนนต์ก่อนโหลดเสร็จ `URL.revokeObjectURL(u)` ทิ้งทันที (กัน memory รั่ว)
- cleanup `revokeObjectURL(current)`
- `zoomable` → คลิกเปิด `Lightbox`

### `NewsPostView(...)` (95-107)
หน้าตาประกาศเต็ม ใช้ **ทั้งตอนนักศึกษาอ่าน และตอนเจ้าหน้าที่กด "ดูตัวอย่าง"** — ใช้คอมโพเนนต์เดียวให้ตัวอย่างเหมือนของจริงเป๊ะ (ไม่ต้องแก้ 2 ที่ให้ตรงกัน); `whiteSpace:'pre-wrap'` รักษาการขึ้นบรรทัดใหม่ของข้อความ

---

## `StudentNewsReal({ go, lang })` (109-219)
| บรรทัด | อธิบาย |
|---|---|
| 110-115 | state: `news` (null = โหลด), `round` (รอบที่เปิด), `blocked`, `open` (ประกาศที่เปิดอ่าน), `myResult` |
| 117-122 | `useEffect([])` ยิง 3 request: `/news`, `/rounds/active`, `/exam-results/me` (แต่ละตัวมี `.catch` ของตัวเอง ล้มอันหนึ่งไม่กระทบอื่น) |
| 127-129 | `acceptingNow = round?.phase === 'active'`; `canFixRejected = round?.can_fix_rejected === true` |
| 130-141 | **ข้อความป้ายรอบ** เลือกด้วย `if / else if` ตามสถานะ: ไม่มีรอบ → "ไม่มีรอบเปิด"; แก้ใบตีกลับ; scheduled; expired; closed (ป้าย "เปิดอยู่" ต้องดู `phase` ไม่ใช่แค่ `status`) |
| 143 | `currentResult` = ใบของรอบที่เปิดอยู่ (`myResult.find(r => r.round_id === round.round_id)`) |
| 145-146 | ข้อความปุ่ม: ยืนยันแล้ว → "ดูสถานะ" (แก้ไม่ได้ ไม่ชวนกดแล้วชนกำแพง 409); มีใบ → "แก้ไข"; ไม่มี → "เริ่มกรอก" |
| 150 | **`usePagedList(news ?? [], 10)`** — แบ่งหน้า 10 ต่อหน้า; **ต้องเรียก hook ก่อน early return ทุกตัว** (ผิดกฎ React ถ้าจำนวน hook ต่างกันในแต่ละ render) |
| 152 | `news` ยังเป็น null → `<SkeletonList>` |
| 157-177 | แบนเนอร์รอบ (ซ้ายพื้นน้ำเงินไล่สี: ป้าย/รอบ/ช่วงวัน; ขวา: "สถานะของคุณ" + ปุ่ม `disabled` เมื่อกรอก/แก้ไม่ได้และยังไม่ยืนยัน) ปุ่มไป `status` ถ้ายืนยันแล้ว ไม่งั้น `formIntro` |
| 179-206 | รายการประกาศ `newsPage.rows.map` (คลิกเปิด modal; รูปย่อ 76px ถ้ามี `image_path`; `actorLabel(n.poster, tt)` ชื่อผู้โพสต์+"ปิดบัญชีแล้ว") + `<Pagination>` |
| 208-216 | `<Modal>` อ่านประกาศ ใช้ `NewsPostView` + รูปซูมได้ |

---

## ส่วนช่วยของหน้าเจ้าหน้าที่ (221-251)
- `LocalImage({file})` — โชว์รูปที่ **เพิ่งเลือกจากเครื่อง** (ยังไม่อัปโหลด) ในหน้าดูตัวอย่าง: `URL.createObjectURL(file)` ใน `useEffect([file])` + cleanup `revokeObjectURL`
- `ImagePreview({file, onRemove, label})` — พรีวิวย่อ + ปุ่มนำออกลอยมุมขวาบน + ชื่อไฟล์/ขนาด MB

---

## `ManageNewsReal({ toast, lang, currentUserName })` (253-448)

### state (254-265)
`items`, `showPreview`, `rounds`, `modal` (`{}` = สร้างใหม่ / ข่าวที่แก้ / `null` = ปิด), `form {title, content, round_id}`, `deleteTarget`, `saving`, `imageFile` (รูปใหม่ที่เลือก), `dropImage` (กดเอารูปเดิมออก), `imgError`, `roundFilter`

### ฟังก์ชัน
| บรรทัด | ฟังก์ชัน | อธิบาย |
|---|---|---|
| 267-268 | `load` + `useEffect([])` | โหลดข่าว + รายการรอบ (`.catch(() => {})` รอบโหลดไม่ได้ไม่ทำให้หน้าพัง) |
| 270-274 | `openModal(n)` | `setModal(n \|\| {})`; เติมฟอร์มจากข่าวเดิม; `round_id: n?.round_id ?? (rounds[0]?.round_id \|\| '')` (ค่าเริ่มต้น = รอบแรกของลิสต์) ; ล้างสถานะรูป/ตัวอย่าง |
| 276-282 | `pickImage(file)` | ตรวจชนิดด้วย regex `/^image\/(jpeg\|png\|webp\|gif)$/` และขนาด ≤ 5 MB (ตรงกับ `upload.js` ฝั่ง backend) ผิด → `imgError` |
| 285-293 | `syncImage(newsId)` | รูป **อัปโหลดแยก** จากตัวประกาศ (multipart) ต้องมี `news_id` ก่อน — ตอนสร้างใหม่จึงยิงหลังบันทึกสำเร็จ: มี `imageFile` → `FormData` `POST /news/:id/image`; ไม่มีแต่ `dropImage` → `DELETE` |
| 295-314 | `submit` | แก้: `PUT /news/:id` → `syncImage`; สร้าง: `POST /news` (ได้ `created.news_id`) → `syncImage`; ปิด modal + `load()`; `catch` toast ข้อความ; `finally` ปลด saving |
| 316-325 | `remove(n)` | `DELETE /news/:id` + toast + reload |
| 328-331 | `filtered` + `usePagedList(filtered, 6, roundFilter)` | กรองด้วยรอบ (ชื่อรอบมีปีอยู่แล้ว ไม่ต้องมีตัวกรองปี); `resetKey = roundFilter` เปลี่ยนตัวกรองกลับหน้า 1 |

### JSX (333-446)
- การ์ดเดียวรวม: แถบตัวกรอง (`<Select>` รอบ + "N / ทั้งหมด") + รายการคั่นเส้น + `Pagination` — (เดิมแต่ละประกาศเป็นการ์ดแยกซ้อนกันยาว)
- แต่ละแถว: รูป 76px หรือไอคอน, หัวข้อ (ตัดด้วย `…`), บรรทัดรอง (รอบ · วันที่ · ผู้โพสต์ · "แก้ไขโดย" ถ้า `n.updater`), ปุ่มแก้ไข/ลบ (ปุ่มลบมี `aria-label`)
- Modal **ยืนยันก่อนลบ** (`tone="danger"`) — เดิมกดถังขยะแล้วหายทันทีเรียกคืนไม่ได้
- Modal เขียน/แก้: สลับ 2 โหมดด้วย `showPreview` — **ตัวอย่าง** (ใช้ `NewsPostView` เดียวกับที่นักศึกษาเห็น; รูป: ไฟล์ใหม่ → `LocalImage`, รูปเดิมที่ไม่ถูกเอาออก → `NewsImage`) / **ฟอร์ม** (หัวข้อ, รอบ `<Select>`, เนื้อหา `<textarea>`, รูป: มีไฟล์ใหม่ → `ImagePreview`; มีรูปเดิม → รูป + ปุ่มเอาออก; ไม่มี → ปุ่มเลือกไฟล์ `<input type="file" accept=...>` ซ่อนใน `<label>`)
- ปุ่ม footer: ยกเลิก / ดูตัวอย่าง↔กลับไปแก้ / เผยแพร่ (`disabled={saving}`)
- ฟอร์ม controlled: `onChange={e => setForm(f => ({ ...f, title: e.target.value }))}` (คัดลอก object เดิมแล้วเขียนทับ 1 key)
