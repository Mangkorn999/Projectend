# 10 — JavaScript และ React ทุกท่าที่โปรเจกต์ใช้ แปลงเป็น if / else / for

**สำหรับคนที่รู้แค่ `if/else`, `for`, `while`** — ทุกท่าในไฟล์นี้ "ย่อมาจาก" สิ่งที่รู้อยู่แล้ว
วิธีอ่าน: ดู **โค้ดจริงจากโปรเจกต์** → ดู **แบบ if/for ที่ทำงานเหมือนกันทุกประการ** → จำว่า "ท่านี้ = for + if แบบไหน"
ตอนกรรมการถาม "บรรทัดนี้ทำอะไร" ให้ตอบเป็นแบบ if/for ก่อน แล้วค่อยบอกชื่อท่า

> ทุกตัวอย่างคัดจากโค้ดจริง (บอกไฟล์และฟังก์ชันไว้) · มีแบบฝึกท้ายแต่ละกลุ่ม เฉลยอยู่ท้ายไฟล์
> ติดสัญลักษณ์อื่น ดูเพิ่มที่ `backend/SYNTAX_NOTES.md`

## สารบัญ
- กลุ่ม 1: ตัวแปร ฟังก์ชัน ข้อความ (const/let, arrow function, template string, default/rest parameter)
- กลุ่ม 2: ตัดสินใจแบบย่อ (ternary, `&&`, `||`, `??`, `?.`)
- กลุ่ม 3: วนลูปแบบย่อของ array (map, filter, some, every, find, includes, reduce, slice)
- กลุ่ม 4: กล่องเก็บของ (object, array, Set, Map, spread, destructuring)
- กลุ่ม 5: งานที่ต้องรอ (async/await, Promise.all, try/catch/finally, throw, class Error)
- กลุ่ม 6: แบ่งไฟล์ (import/export)
- กลุ่ม 7: Express (router, req, res, next)
- กลุ่ม 8: Prisma (findMany, where, include, select, findUnique, count, create, updateMany, $transaction)
- กลุ่ม 9: React (component, props, useState, useEffect, useRef, แสดงตามเงื่อนไข, list + key, event, controlled input)

---

# กลุ่ม 1 — ตัวแปร ฟังก์ชัน ข้อความ

### 1.1 `const` / `let`
```js
const MAX_FILES_PER_RESULT = 5;   // certificates.controller.js — const = กำหนดครั้งเดียว ห้ามกำหนดใหม่
let bytesRead = 0;                // detectFileType — let = เปลี่ยนค่าได้ภายหลัง
bytesRead = readResult.bytesRead;
```
**กฎของทีม:** ใช้ `const` ก่อนเสมอ ต้องเปลี่ยนค่าค่อยใช้ `let` · ไม่ใช้ `var`
**จุดหลอก:** `const` กับ object/array ห้ามแค่ "เปลี่ยนตัวใหม่ทั้งก้อน" แต่ **แก้ของข้างในได้** — `const answers = new Map(); answers.set(1, true);` ใช้ได้

### 1.2 Arrow function `=>` (ฟังก์ชันแบบย่อ)
```js
// examResults.controller.js
const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};
```
เหมือนกับ
```js
function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}
```
**แบบบรรทัดเดียว** (ไม่มี `{}` = คืนค่าทันที ไม่ต้องเขียน `return`)
```js
const onlyConfirmed = (results) => results.filter((r) => r.staff_status === "approved"); // dashboard.service.js
```

### 1.3 Template string (ข้อความที่แทรกตัวแปร) — เครื่องหมาย backtick `` ` ``
```js
const roundLabel = `รอบ ${existing.round.attempt_number}/${existing.round.academic_year}`; // reviewExamResult
```
เหมือนกับ `"รอบ " + existing.round.attempt_number + "/" + existing.round.academic_year` → ได้ `"รอบ 2/2569"`

### 1.4 ค่าเริ่มต้นของพารามิเตอร์ และ rest parameter `...`
```js
export const getRoundPhase = (round, now = new Date()) => { ... }   // roundPhase.js — ไม่ส่ง now มา ใช้เวลาปัจจุบัน
export const requireRole = (...allowedRoles) => { ... }             // requireRole.js — รับกี่ตัวก็ได้ มัดเป็น array
```
แบบ if:
```js
function getRoundPhase(round, now) {
  if (now === undefined) {
    now = new Date();
  }
  ...
}
// requireRole("officer", "reviewer")  →  allowedRoles = ["officer", "reviewer"]
```

### 1.5 ฟังก์ชันที่คืนฟังก์ชัน (ใช้ทำ middleware ที่ตั้งค่าได้)
```js
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {          // คืน "ฟังก์ชัน" ไม่ใช่ค่าธรรมดา
    if (!allowedRoles.includes(req.user.role)) { return res.status(403).json({...}); }
    next();
  };
};
router.get("/", authenticate, requireRole("officer", "reviewer"), getAll);
```
อ่านว่า: `requireRole("officer","reviewer")` **ถูกเรียกครั้งเดียวตอนเปิด server** ได้ฟังก์ชันตรวจสิทธิ์ที่ "จำ" รายการบทบาทไว้ → Express เรียกฟังก์ชันนั้นทุก request (ความสามารถ "จำค่าจากข้างนอก" นี้เรียกว่า closure)

**แบบฝึกกลุ่ม 1**
1.1 เขียน `const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);` (`dashboard.service.js`) ใหม่เป็น `function` ที่ใช้ `if/else`
1.2 `` `ผลสอบ${roundLabel}ได้รับการยืนยันแล้ว` `` ได้ข้อความอะไร ถ้า `roundLabel = "รอบ 1/2570"`

---

# กลุ่ม 2 — ตัดสินใจแบบย่อ

### 2.1 Ternary `เงื่อนไข ? ค่าถ้าจริง : ค่าถ้าเท็จ`
```js
res.status(dryRun ? 200 : 201).json({ ... });   // student.controller.js → bulkImport
```
แบบ if:
```js
let statusCode;
if (dryRun) { statusCode = 200; } else { statusCode = 201; }
res.status(statusCode).json({ ... });
```
**กฎของทีม:** ห้าม ternary ซ้อนกัน (อ่านยาก) — ใช้ if/else แทน

### 2.2 `||` (หรือ) — "ถ้าซ้ายว่าง/เป็นเท็จ ใช้ขวา"
```js
const PORT = process.env.PORT || 3000;                                   // server.js
throw new ApiError(json.message || fallbackMessage(res.status), ...);    // api.js → apiFetch
```
แบบ if:
```js
let PORT = process.env.PORT;
if (!PORT) { PORT = 3000; }   // ว่าง, undefined, null, 0, "" , false ทั้งหมดนับว่า "เท็จ"
```

### 2.3 `??` (nullish) — "ถ้าซ้ายเป็น null หรือ undefined เท่านั้น ใช้ขวา"
```js
const academic_year = account?.import_academic_year ?? calcGraduationYear(student_id); // completeProfile
export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000/api';  // api.js
```
แบบ if:
```js
let academic_year;
if (account && account.import_academic_year !== null && account.import_academic_year !== undefined) {
  academic_year = account.import_academic_year;
} else {
  academic_year = calcGraduationYear(student_id);
}
```
**`||` ต่างจาก `??` ตรงไหน:** ค่า `0` หรือ `""` — `||` ถือว่าว่างแล้วใช้ขวา, `??` ถือว่ามีค่าแล้วใช้ซ้าย
ตัวอย่างจริง: `const years = Number(req.query.years) || 3;` (`dashboard.controller.js → getHistory`) — ส่ง `years=0` มาจะได้ 3 (ตั้งใจ: 0 ปีไม่มีความหมาย)

### 2.4 `&&` (และ) — "ถ้าซ้ายจริง ค่อยทำ/ค่อยใช้ขวา"
```js
all_passed: subjects.length > 0 && subjects.every((s) => s.already_passed),  // rounds.controller.js → getActive
```
แบบ if:
```js
let all_passed;
if (subjects.length > 0) { all_passed = subjects.every(...); } else { all_passed = false; }
```
ใน React ใช้แสดงตามเงื่อนไข (ดูกลุ่ม 9)

### 2.5 `?.` (optional chaining) — "ถ้าตัวหน้าไม่มี ให้ได้ undefined แทนการพัง"
```js
const remark = req.body?.remark?.trim();                         // reviewExamResult
if (existing?.staff_status === STAFF_STATUS.APPROVED) { ... }    // create
onInitialFilterConsumed?.();                                     // officerStudentsReal.jsx — เรียกฟังก์ชันถ้ามี
```
แบบ if:
```js
let remark = undefined;
if (req.body !== null && req.body !== undefined) {
  if (req.body.remark !== null && req.body.remark !== undefined) {
    remark = req.body.remark.trim();
  }
}
```
**ทำไมสำคัญ:** ไม่มี `?.` แล้ว `existing` เป็น `null` (ยังไม่เคยส่งใบ) → `null.staff_status` = **TypeError พังเป็น 500**

**แบบฝึกกลุ่ม 2**
2.1 `user.student?.student_id ?? null` (`auth.js`) — ถ้า `user.student` เป็น `null` ได้ค่าอะไร
2.2 เขียน `const time = hour !== undefined ? (second !== undefined ? A : B) : C;` (ternary ซ้อนใน `rounds.controller.js → parseThaiDateTime`) ใหม่เป็น if/else ให้อ่านง่าย

---

# กลุ่ม 3 — วนลูปแบบย่อของ array

> **หลักจำ:** ทุกตัวในกลุ่มนี้ = `for (const x of array) { ... }` + `if` บางแบบ + ตัวแปรเก็บผล
> ลูกศร `(x) => ...` ที่ส่งเข้าไป คือ "สิ่งที่ทำกับแต่ละตัว" (เรียกว่า callback)

### 3.1 `.map()` = วนทุกตัว แปลงแล้วเก็บ → ได้ array ใหม่ขนาดเท่าเดิม
```js
const roundSubjectIds = subjectsOfRound(round, allSubjects).map((s) => s.subject_id); // create
```
แบบ for:
```js
const roundSubjectIds = [];
for (const s of subjectsOfRound(round, allSubjects)) {
  roundSubjectIds.push(s.subject_id);
}
// [{subject_id:1,...},{subject_id:2,...}]  →  [1, 2]
```

### 3.2 `.filter()` = วนทุกตัว เก็บเฉพาะตัวที่เงื่อนไขจริง
```js
const mustAnswer = roundSubjectIds.filter((id) => !passedIds.includes(id)); // create
```
แบบ for:
```js
const mustAnswer = [];
for (const id of roundSubjectIds) {
  if (!passedIds.includes(id)) {
    mustAnswer.push(id);
  }
}
```

### 3.3 `.some()` = มี "สักตัว" ที่จริงไหม → true/false (เจอแล้วหยุด)
```js
r.subject_results.some((sr) => sr.subject_id === id && sr.is_passed)   // dashboard.service.js → countFullyPassed
```
แบบ for:
```js
let found = false;
for (const sr of r.subject_results) {
  if (sr.subject_id === id && sr.is_passed) {
    found = true;
    break;            // เจอแล้วไม่ต้องดูต่อ
  }
}
```

### 3.4 `.every()` = จริง "ทุกตัว" ไหม → true/false (เจอตัวที่ไม่จริงแล้วหยุด)
```js
subjects.every((s) => s.already_passed)     // getActive
```
แบบ for:
```js
let allTrue = true;
for (const s of subjects) {
  if (!s.already_passed) {
    allTrue = false;
    break;
  }
}
```
**กับดัก:** array ว่าง → ลูปไม่ทำงานเลย → `allTrue` ยังเป็น `true` = **`[].every(...)` ได้ `true` เสมอ** → โค้ดจริงจึงเขียน `subjects.length > 0 && subjects.every(...)` (รอบที่ไม่เหลือวิชาต้องไม่นับว่า "ผ่านครบ")

### 3.5 `.find()` = ตัว "แรก" ที่เงื่อนไขจริง (ไม่เจอ = `undefined`)
```js
const round = rounds.find(r => r.status === 'open') || rounds[0];   // app.jsx (นับใบรอตรวจ)
```
แบบ for:
```js
let round = undefined;
for (const r of rounds) {
  if (r.status === 'open') { round = r; break; }
}
if (!round) { round = rounds[0]; }
```
โปรเจกต์มีฟังก์ชันที่เขียนแบบ for ตรง ๆ ให้ดูเทียบ: `examFormReal.jsx → findPaperOfRound`

### 3.6 `.includes()` = มีค่านี้อยู่ใน array ไหม
```js
if (!allowedRoles.includes(req.user.role)) { ... }   // requireRole.js
```
แบบ for:
```js
let has = false;
for (const r of allowedRoles) {
  if (r === req.user.role) { has = true; break; }
}
```
ใช้กับข้อความได้ด้วย: `normalizeHeader(h).includes(k)` = "หัวคอลัมน์นี้มีคำ k อยู่ข้างในไหม" (`guessColumns`)

### 3.7 `.reduce()` = วนทุกตัว สะสมผลไว้ในตัวแปรเดียว
ที่เดียวในโปรเจกต์: `frontend/src/design/i18n.js → t`
```js
return Object.keys(vars).reduce((acc, k) => acc.replaceAll('{' + k + '}', vars[k]), s);
```
แบบ for:
```js
let acc = s;                                   // เริ่มจากข้อความต้นฉบับ เช่น "แสดง {shown} จาก {found} คน"
for (const k of Object.keys(vars)) {           // k = "shown", แล้ว "found"
  acc = acc.replaceAll('{' + k + '}', vars[k]);
}
return acc;                                    // "แสดง 10 จาก 23 คน"
```
**สังเกต:** โค้ดที่ทีมเขียนใหม่เลี่ยง `reduce` (อ่านยาก) ใช้ `for` + ตัวแปรสะสมแทน เช่น `dashboard.service.js → buildStats` (`totalPass = totalPass + s.pass`)

### 3.8 `.slice(เริ่ม, จบ)` = ตัดช่วง (ไม่แก้ array เดิม)
```js
const pageRows = filtered.slice(page * per, (page + 1) * per);   // officerStudentsReal.jsx
```
แบบ for:
```js
const pageRows = [];
for (let i = page * per; i < (page + 1) * per && i < filtered.length; i++) {
  pageRows.push(filtered[i]);
}
```

### 3.9 ท่าต่อกันหลายชั้น — อ่านจาก "ในออกนอก"
```js
const countFullyPassed = (sent, subjectIds) =>
  sent.filter((r) =>
    subjectIds.every((id) =>
      r.subject_results.some((sr) => sr.subject_id === id && sr.is_passed),
    ),
  ).length;
```
แบบ for (3 ชั้นซ้อน):
```js
let count = 0;
for (const r of sent) {                       // filter: วนทุกใบ
  let passedEvery = true;
  for (const id of subjectIds) {              // every: ทุกวิชาของรอบ
    let passedThis = false;
    for (const sr of r.subject_results) {     // some: มีสักแถวที่เป็นวิชานี้และผ่าน
      if (sr.subject_id === id && sr.is_passed) { passedThis = true; break; }
    }
    if (!passedThis) { passedEvery = false; break; }
  }
  if (passedEvery) { count = count + 1; }     // .length ของผล filter
}
```

**แบบฝึกกลุ่ม 3**
3.1 `const missing = mustAnswer.filter((id) => !answers.has(id));` ถ้า `mustAnswer = [2,3,5]` และ `answers` มี 2 กับ 5 → `missing` คืออะไร
3.2 เขียน `subjectIds.every((id) => s.passed_subject_ids.includes(id))` (`buildStats`) เป็น for
3.3 `[].some(x => x > 0)` ได้อะไร ทำไม

---

# กลุ่ม 4 — กล่องเก็บของ

### 4.1 Object (กล่องมีชื่อช่อง) กับ Array (แถวเรียงลำดับ)
```js
req.user = { userId: 2, role: "officer", studentId: null };   // object — อ่านด้วย req.user.role
const TABS = ['SUBMITTED', 'REJECTED', 'CONFIRMED', 'NOT_STARTED']; // array — อ่านด้วย TABS[0]
```
อ่านช่องด้วยชื่อที่อยู่ในตัวแปร ใช้วงเล็บเหลี่ยม: `req.body?.[keyField]` (`rateLimit.js`) = "ช่องชื่อตามค่าของ keyField"

### 4.2 `Set` = กล่องที่ห้ามมีของซ้ำ
```js
return [...new Set(rows.map((r) => r.subject_id))];   // findPassedSubjectIds: [1,2,2,3] → [1,2,3]
```
แบบ for (ตัดซ้ำด้วยมือ):
```js
const unique = [];
for (const r of rows) {
  if (!unique.includes(r.subject_id)) {
    unique.push(r.subject_id);
  }
}
```
คำสั่งของ Set: `.add(x)` เพิ่ม · `.has(x)` มีไหม · `.delete(x)` ลบ · `.size` จำนวน
**ทำไมใช้ Set:** `.has` เร็วคงที่ ไม่ต้องวนทั้งกล่องแบบ `includes` ของ array

### 4.3 `Map` = สมุด "กุญแจ → ค่า" (กุญแจเป็นอะไรก็ได้)
```js
const answers = new Map();                       // create
answers.set(subjectId, item.is_passed);          // จด
if (answers.has(subjectId)) throw ...;           // เคยจดไหม
answers.get(id);                                 // อ่าน
```
วนทุกคู่ในสมุด:
```js
for (const [studentId, passedSet] of passedByStudent) { ... }   // buildYearSummary
```
**ทำไมไม่ใช้ object ธรรมดา:** Map ใช้กุญแจตัวเลขได้ตรง ๆ (object แปลงกุญแจเป็นข้อความ) และมี `.size`, `.has` ชัดเจน
ตัวอย่างอื่น: `rateLimit.js → buckets`, `student.controller.js → seenInFile`, `dashboard.service.js → passedByStudent` (Map ของ Set)

### 4.4 Spread `...` = "กางของออกมาวาง"
```js
return { ...round, phase: getRoundPhase(round) };        // roundPhase.js → withPhase (คัดลอก object + เพิ่มช่อง)
const items = [...live, ...events];                      // app.jsx (ต่อ 2 array)
setKeptFiles([...keptFiles, ...removedFiles]);           // examFormReal.jsx → undoRemove
...buildExcludeRound(excludeRoundId),                    // findPassedSubjectIds (กางเงื่อนไขเข้า where)
```
แบบ for (คัดลอก object):
```js
const result = {};
for (const key of Object.keys(round)) {
  result[key] = round[key];
}
result.phase = getRoundPhase(round);
```
**ทำไม React ต้องคัดลอกก่อนแก้:** React ดูว่า state เปลี่ยนจาก "ตัวใหม่หรือตัวเดิม" ถ้าแก้ของเดิมตรง ๆ React คิดว่าไม่เปลี่ยน จอไม่วาดใหม่ (ดูกลุ่ม 9)
**ท่าใส่ช่องแบบมีเงื่อนไข:** `...(process.env.NODE_ENV === "development" && { stack: err.stack })` (`errorHandler.js`) — เงื่อนไขเท็จได้ `false`, `...false` ไม่เพิ่มอะไร

### 4.5 Destructuring = "แกะของออกจากกล่องเป็นตัวแปร"
```js
const { subject_results } = req.body;                       // = const subject_results = req.body.subject_results;
const { count } = await examRepo.updateStaffStatusIfPending(...);
const [news, rows, alertRes] = await Promise.all([...]);    // แกะ array ตามลำดับ
const [mainLine, ...subLines] = n.message.split("\n");      // ตัวแรก + ที่เหลือมัดเป็น array
export const rateLimit = ({ windowMs, max, keyField }) => { ... }   // แกะตั้งแต่ในวงเล็บพารามิเตอร์
const [, year, month, day, hour, minute, second] = matched; // parseThaiDateTime — เว้นช่องแรก (ข้อความเต็ม) ไม่ใช้
```

**แบบฝึกกลุ่ม 4**
4.1 `const merged = [...new Set([...readKeys(userId), ...keys])];` (`notifications.js → markAllRead`) ทำอะไร อธิบายจากในออกนอก
4.2 `const [mainLine, ...subLines] = "ถูกตีกลับ: ไฟล์ไม่ชัด\nกรุณากรอกใหม่".split("\n");` → `mainLine`, `subLines` คืออะไร

---

# กลุ่ม 5 — งานที่ต้องรอ

### 5.1 `async` / `await`
งานที่ช้า (คุยกับฐานข้อมูล, เรียก API, อ่านไฟล์) ไม่ได้ค่าทันที — `await` = "หยุดรอบรรทัดนี้จนได้ผล แล้วค่อยทำบรรทัดถัดไป" (ระหว่างรอ server ไปรับ request ของคนอื่นได้ ไม่ค้างทั้งเครื่อง)
```js
export const create = async (req, res, next) => {          // ฟังก์ชันที่มี await ข้างใน ต้องเขียน async
  const student = await studentRepo.findById(req.user.studentId);
  if (!student) throw httpError("ไม่พบข้อมูลนักศึกษา", 404);
```
**ลืม `await`:** `student` จะเป็น "สัญญาว่าจะได้ค่า" (Promise) ไม่ใช่ข้อมูล → `student.exam_eligible` เป็น `undefined` → ตรวจผิดเงียบ ๆ

### 5.2 `Promise.all` = ยิงหลายงานพร้อมกัน รอให้เสร็จครบ
```js
const [resultCount, newsCount] = await Promise.all([      // rounds.controller.js → remove
  roundsRepo.countExamResults(round.round_id),
  roundsRepo.countNews(round.round_id),
]);
```
เทียบกับแบบรอทีละงาน (ได้ผลเหมือนกัน แต่ช้ากว่า):
```js
const resultCount = await roundsRepo.countExamResults(round.round_id);
const newsCount = await roundsRepo.countNews(round.round_id);
```
ใช้ได้เมื่องานไม่ขึ้นต่อกัน · ถ้างานใดล้ม `Promise.all` ล้มทั้งก้อน → หน้าเว็บจึงใส่ `.catch(()=>[])` ทีละงานเมื่ออยากให้งานอื่นยังใช้ได้ (`app.jsx` แจ้งเตือน)

### 5.3 `try / catch / finally`
```js
// examFormReal.jsx → submit
setSubmitting(true);
try {
  ... await apiFetch('/exam-results', { method: 'POST', body: ... });   // ถ้าบรรทัดไหน error กระโดดไป catch ทันที
  toast(tt('examform.submitSuccessToast'), 'success');
} catch (e) {
  setSubmitError(messageOf(e));         // แสดงข้อความไทย
} finally {
  setSubmitting(false);                 // ทำเสมอ ไม่ว่าสำเร็จหรือ error → ปุ่มกดได้อีกครั้ง
}
```
ท่าประจำของ controller ฝั่ง backend:
```js
try { ...ตรวจ → เรียก repository → res.json({ success: true, data }) } catch (err) { next(err); }
```
`return` ใน `try` ก็ยังทำ `finally` (ใช้ใน `detectFileType` เพื่อปิดไฟล์เสมอ)

### 5.4 `throw` และ Error ที่มี status code
```js
throw httpError("ใบนี้ถูกตรวจไปแล้ว กรุณารีเฟรชหน้า", 409);   // กระโดดไป catch → next(err) → errorHandler อ่าน err.statusCode
```
ฝั่งหน้าเว็บสร้างชนิด error ของตัวเอง:
```js
export class ApiError extends Error {           // api.js — "ApiError คือ Error ที่มีช่อง status, payload เพิ่ม"
  constructor(message, status, payload) { super(message); this.status = status; this.payload = payload; }
}
if (e instanceof ApiError) { ... }              // ถามว่า error นี้เป็นชนิด ApiError ไหม (ข้อความไทยจาก backend)
```

**แบบฝึกกลุ่ม 5**
5.1 ถ้าลบ `finally { setSubmitting(false); }` ใน `submit` แล้วส่งไม่สำเร็จ ผู้ใช้จะเจออะไร
5.2 ใน `rounds.controller.js → remove` ทำไมใช้ `Promise.all` ได้ (สองงานขึ้นต่อกันไหม)

---

# กลุ่ม 6 — แบ่งไฟล์ (import / export)

```js
// ไฟล์ส่งออก
export const findSubmittableRound = async (student) => { ... };   // examResults.service.js (ส่งออกแบบมีชื่อ)
export default router;                                             // *.routes.js (ส่งออกตัวหลัก 1 ตัวต่อไฟล์)

// ไฟล์นำเข้า
import { findSubmittableRound } from "./examResults.service.js";  // เอาเฉพาะชื่อนี้ (ต้องสะกดตรง)
import * as examRepo from "./examResults.repository.js";          // เอาทุกอย่าง มัดไว้ใต้ชื่อ examRepo → examRepo.findById(...)
import examResultsRouter from "./modules/examResults/examResults.routes.js"; // ตัว default ตั้งชื่อเองได้
```
**แบบฝึกกลุ่ม 6**
6.1 เพิ่มฟังก์ชัน `getLogs` ใน controller แล้วลืมเพิ่มใน `import { ... } from "./examResults.controller.js"` ของไฟล์ routes จะเกิดอะไรตอนเปิด server

---

# กลุ่ม 7 — Express

```js
const router = express.Router();                                      // ① กลุ่มเส้นทางของเรื่องหนึ่ง
router.get("/", authenticate, requireRole("officer", "reviewer"), getAll);
router.patch("/:id/approve", authenticate, requireRole("officer", "reviewer"), approve);
export default router;
// app.js:  app.use("/api/exam-results", examResultsRouter);         // ② ติดคำนำหน้า
```
① `router.<method>(path, ...ฟังก์ชันเรียงกัน)` — Express เรียกฟังก์ชันจากซ้ายไปขวา
② URL เต็ม = คำนำหน้า + path ใน router → `PATCH /api/exam-results/12/approve`

**ของที่อยู่ใน `req` (คำขอ)**
| ช่อง | มาจาก | ตัวอย่างในโปรเจกต์ |
|---|---|---|
| `req.params.id` | ส่วนของ URL ที่เขียน `:id` | `examRepo.findById(req.params.id)` (เป็นข้อความเสมอ → `Number(...)`) |
| `req.query.round_id` | หลัง `?` ใน URL | `getAll` → `?round_id=4&staff_status=pending` (เป็นข้อความ: `req.query.dry_run === "true"`) |
| `req.body` | JSON ที่ส่งมา (ต้องมี `express.json()`) | `const { subject_results } = req.body;` |
| `req.cookies` | cookie (ต้องมี `cookieParser()`) | `req.cookies.token` |
| `req.user` | **เราใส่เอง** ใน `authenticate` | `req.user.userId`, `req.user.role` |
| `req.file` | multer ใส่ให้ตอนอัปโหลด | `req.file.path`, `req.file.originalname` |

**ของที่ใช้กับ `res` (คำตอบ)**
```js
res.json({ success: true, data: result });                         // 200 + JSON
res.status(201).json({ success: true, data: user });               // กำหนด status เอง
res.cookie("token", token, TOKEN_COOKIE_OPTIONS);                  // ตั้ง cookie
res.setHeader("Content-Type", "application/pdf");                  // ตั้ง header (ส่งไฟล์)
```
**`next`**: `next()` = ไปตัวถัดไป · `next(err)` = ข้ามไป `errorHandler` · **ห้ามตอบ 2 ครั้ง** — หลัง `res.json(...)` ต้อง `return` (โค้ดจริงเขียน `return res.status(401).json(...)`)

**แบบฝึกกลุ่ม 7**
7.1 `GET /api/exam-results?round_id=4` — `req.query.round_id` เป็นชนิดอะไร ทำไม repository เขียน `Number(round_id)`
7.2 ทำไม `router.get("/active", ...)` ต้องอยู่ก่อน `router.get("/:id", ...)` (ดูคอมเมนต์ใน `rounds.routes.js`)

---

# กลุ่ม 8 — Prisma (เขียน JavaScript แทน SQL)

| Prisma | SQL ที่ได้ (โดยประมาณ) | ตัวอย่างในโปรเจกต์ |
|---|---|---|
| `findMany({ where, orderBy })` | `SELECT * … WHERE … ORDER BY …` | `examResults.repository.js → findAll` |
| `findUnique({ where: { คอลัมน์ unique } })` | `SELECT … WHERE id = … LIMIT 1` | `findById` |
| `findFirst({ where, orderBy })` | `… LIMIT 1` (ไม่ต้องเป็น unique) | `rounds.repository.js → findActive` |
| `count({ where })` | `SELECT COUNT(*) …` | `certificates.repository.js → countByResult` |
| `create({ data })` | `INSERT …` | `certificates.repository.js → create` |
| `update({ where: { unique }, data })` | `UPDATE … WHERE id = …` (ไม่พบ → error P2025) | `rounds.repository.js → update` |
| `updateMany({ where, data })` | `UPDATE … WHERE …` คืน `{ count }` | `updateStaffStatusIfPending` |
| `delete` / `deleteMany` | `DELETE …` | `resubmitWithSubjects` |

### 8.1 `where` — เงื่อนไข
```js
where: {
  status: "open",                       // เท่ากับ
  open_date: { lte: now },              // lte = น้อยกว่าหรือเท่ากับ (lt, gt, gte ก็มี)
  close_date: { gte: now },
  academic_year: academicYear,          // หลายช่องในก้อนเดียว = AND
}                                        // rounds.repository.js → findActive
staff_status: { not: "rejected" }       // ไม่เท่ากับ
student_id: { in: [...] }               // อยู่ในรายการ
OR: [ { ... }, { ... } ]                // หรือ (findEligibleWithPassedSubjects)
exam_result: { student_id, ... }        // เงื่อนไขของ "ตารางที่ผูกกัน" (subject_results → exam_results)
```
แบบ if (ความหมาย):
```js
for (const round of ทุกรอบ) {
  if (round.status === "open" && round.open_date <= now && round.close_date >= now && round.academic_year === academicYear) {
    เก็บ round   // แต่ทำในฐานข้อมูล (เร็วกว่าดึงมาวนเองมาก ใช้ index ได้)
  }
}
```
**กับดักที่เจอจริง:** `{ in: undefined }` Prisma ถือว่า **"ไม่มีเงื่อนไข"** ไม่ใช่ "ไม่ตรงอะไรเลย" → `updateMany` แก้ **ทุกแถว** → `bulkSetEligible` จึงตรวจว่า `student_ids` เป็น array ไม่ว่างก่อนเสมอ (และ `notifications.repository.js → requireStudentId` ด้วยเหตุผลเดียวกัน)

### 8.2 `include` vs `select`
```js
include: { round: true, subject_results: { include: { subject: true } }, certificates: true } // ดึงตารางที่ผูกกันมาด้วย (withDetails)
select: { student_id: true, room: { select: { room_name: true } } }                         // เลือกเฉพาะช่องที่ระบุ (findStudentsByYear)
```
**ทำไมข้อมูลผู้ใช้ใช้ `select`:** ช่องใหม่ที่เพิ่มทีหลัง (เช่น `password_hash`) จะไม่หลุดออกไปเอง (`users.repository.js → PUBLIC_USER_FIELDS`)

### 8.3 กุญแจหลายคอลัมน์ (compound unique)
```js
prisma.examResult.findUnique({ where: { student_id_round_id: { student_id, round_id: Number(round_id) } } });
```
มาจาก `@@unique([student_id, round_id])` ใน schema — Prisma ตั้งชื่อเป็นชื่อคอลัมน์ต่อกันด้วย `_`

### 8.4 สร้างพร้อมตารางลูก (nested create) และ `$transaction`
```js
prisma.examResult.create({ data: { student_id, round_id, ..., subject_results: { create: [...] } } }); // createWithSubjects
prisma.$transaction(async (tx) => {                       // resubmitWithSubjects
  const { count } = await tx.examResult.updateMany({ ... });
  if (count === 0) { throw err; }                         // throw ใน transaction = ย้อนทุกคำสั่งในก้อน
  await tx.subjectResult.deleteMany({ ... });
  await tx.subjectResult.createMany({ ... });
});
```
ภายใน transaction ต้องใช้ `tx.` (ไม่ใช่ `prisma.`) ไม่งั้นคำสั่งนั้นอยู่นอก transaction

**แบบฝึกกลุ่ม 8**
8.1 เขียน `where` ของ Prisma สำหรับ "ใบผลสอบของรอบ 4 ที่ถูกตีกลับ"
8.2 ทำไม `updateStaffStatusIfPending` ใช้ `updateMany` แทน `update`

---

# กลุ่ม 9 — React

### 9.1 Component และ props
Component = ฟังก์ชันที่คืนหน้าตา (JSX = HTML ที่เขียนใน JavaScript) · props = ค่าที่ส่งเข้ามา (อ่านอย่างเดียว)
```jsx
// examFormReal.jsx
function EvidenceRow({ name, kind, detail, isNew, removeLabel, disabled, onRemove }) {   // แกะ props
  const isImage = kind === 'jpg' || kind === 'png';
  return (
    <div className={'evidence-row' + (isNew ? ' is-new' : '')}>
      ...
      <button type="button" disabled={disabled} onClick={onRemove}>{removeLabel}</button>
    </div>
  );
}
// เรียกใช้:
<EvidenceRow key={'kept-' + certificate.certificate_id} name={certificate.file_name} kind={kind}
  detail={detail} removeLabel={tt('examform.removeFileBtn')} disabled={submitting} onRemove={() => removeKeptFile(certificate)} />
```
- `{ ... }` ใน JSX = "ตรงนี้เป็น JavaScript" · `className` แทน `class` · `style={{ ... }}` = object ของ CSS
- `onRemove` เป็นฟังก์ชันที่ "แม่" ส่งให้ "ลูก" เรียกกลับ — ลูกไม่ต้องรู้ว่าลบยังไง

### 9.2 `useState` = ความจำของหน้าจอ
```jsx
const [results, setResults] = useState({});   // examFormReal.jsx — { [subject_id]: true | false }
```
- `results` = ค่าปัจจุบัน · `setResults(ค่าใหม่)` = เปลี่ยนค่า **แล้ว React วาดจอใหม่ให้เอง**
- เปลี่ยนตัวแปรธรรมดา (`results.x = 1`) จอ **ไม่** เปลี่ยน
```jsx
// examFormReal.jsx → setAnswer — แก้ object ใน state ต้องคัดลอกก่อน
const setAnswer = (subjectId, passed) => {
  setResults((previous) => {          // ส่งเป็นฟังก์ชัน = ได้ค่าล่าสุดแน่นอน
    const next = { ...previous };     // คัดลอก (ตัวใหม่)
    next[subjectId] = passed;
    return next;
  });
};
```

### 9.3 `useEffect` = "ทำหลังวาดจอ" (ใช้ดึงข้อมูล / ตั้งตัวจับเวลา)
```jsx
// examFormReal.jsx — [] = ทำครั้งเดียวตอนเปิดหน้า
useEffect(() => {
  apiFetch('/rounds/active')
    .then((activeRound) => prepareForm(activeRound))
    .catch((e) => { ... })
    .finally(() => setLoading(false));
}, []);
```
```jsx
// app.jsx — ทำใหม่ทุกครั้งที่ role/currentUser/page/lang เปลี่ยน + มีฟังก์ชันเก็บกวาด
useEffect(() => {
  let dropped = false;
  ...
  fetchNotifs();
  const iv = setInterval(fetchNotifs, 30000);
  return () => { dropped = true; clearInterval(iv); };   // เก็บกวาดก่อนรอบใหม่/ก่อนออกจากหน้า
}, [role, currentUser, page, lang]);
```
แปลเป็นภาษาคน: "ทุกครั้งที่ค่าในวงเล็บเหลี่ยมเปลี่ยน → เก็บกวาดของรอบก่อน (หยุดตัวจับเวลา, ทิ้งผลเก่า) → ทำงานรอบใหม่"
`.then(...)` / `.catch(...)` / `.finally(...)` = อีกวิธีเขียนแทน `await` + `try/catch/finally`

### 9.4 `useRef` = กล่องจำค่า ที่เปลี่ยนแล้ว **ไม่** วาดจอใหม่
```jsx
// components.jsx → NotifRow (ลากแจ้งเตือนทิ้ง)
const startX = useRef(0);        // ตำแหน่งที่เริ่มกด
const moved = useRef(false);     // ลากจริงหรือแค่คลิก
const onPointerDown = (e) => { startX.current = e.clientX; moved.current = false; ... };
```
ใช้ `.current` อ่าน/เขียน · อีกแบบ: ชี้ไปที่ element จริง `const box = useRef(null); <span ref={box}>` (`ExportMenu` ใช้เช็คว่าคลิกนอกกล่องไหม)

### 9.5 แสดงตามเงื่อนไข
```jsx
if (loading) { return <Loading label={tt('common.loading')} />; }          // 1) return ก่อน (ทั้งหน้า)

{removedFiles.length > 0 && ( <div>…ยกเลิกการนำออก…</div> )}                // 2) && = แสดงเมื่อจริง

{subject.already_passed ? <span className="badge ok">…</span> : <div className="seg">…</div>} // 3) ternary = อย่างใดอย่างหนึ่ง
```
**กับดักของ `&&`:** ถ้าซ้ายเป็นเลข `0` React จะพิมพ์ "0" บนจอ → โค้ดจริงเขียน `removedFiles.length > 0 &&` (ได้ true/false) ไม่ใช่ `removedFiles.length &&`

### 9.6 รายการ + `key`
```jsx
{keptFiles.map((certificate) => (
  <EvidenceRow key={'kept-' + certificate.certificate_id} ... />
))}
```
`map` สร้าง component 1 ตัวต่อ 1 รายการ · `key` = ป้ายชื่อที่ไม่ซ้ำ ให้ React รู้ว่าแถวไหนเป็นแถวไหนเมื่อรายการเปลี่ยน (ลบแถวกลางแล้ว state ของแถวอื่นไม่สลับกัน) — ใช้ id จากฐานข้อมูล ไม่ใช้เลขลำดับถ้าเลี่ยงได้

### 9.7 Event handler (ตอบสนองการกด)
```jsx
<button onClick={() => setAnswer(subject.subject_id, true)}>ผ่าน</button>   // ต้องห่อด้วย () => ...
```
ถ้าเขียน `onClick={setAnswer(subject.subject_id, true)}` (ไม่มี `() =>`) = **เรียกทันทีตอนวาดจอ** ทุกครั้ง → วนวาดไม่จบ
`e.stopPropagation()` = กันไม่ให้การคลิกทะลุไปถึงกล่องแม่ (ใช้ในตารางนักศึกษา: คลิก checkbox ไม่ให้เปิดหน้ารายละเอียด)

### 9.8 Controlled input (ช่องกรอกที่ค่าอยู่ใน state)
```jsx
<input className="input" value={q} onChange={e => setQ(e.target.value)} />   // officerStudentsReal.jsx (ช่องค้นหา)
```
วงจร: พิมพ์ → `onChange` → `setQ(ค่าใหม่)` → วาดจอใหม่ → ช่องแสดง `q` ใหม่ + ตาราง `filtered` คำนวณใหม่
ช่องเลือกไฟล์: `<input type="file" multiple onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />` (`examFormReal.jsx`) — ล้างค่าเพื่อให้เลือกไฟล์เดิมซ้ำได้

### 9.9 ค่าที่คำนวณจาก state ทุกครั้งที่วาด (ไม่ต้องเป็น state)
```jsx
// examFormReal.jsx — คำนวณใหม่ทุกครั้งที่วาด จาก subjects + results
const toAnswer = [];
const passedBefore = [];
for (const subject of subjects) {
  if (subject.already_passed) { passedBefore.push(subject); } else { toAnswer.push(subject); }
}
const allAnswered = filledCount === toAnswer.length;
```
**หลัก:** เก็บใน state เฉพาะ "ข้อมูลต้นทาง" ค่าที่คิดได้จากข้อมูลต้นทางให้คิดใหม่ (ไม่ต้องเก็บซ้ำ จะได้ไม่ขัดกัน)

**แบบฝึกกลุ่ม 9**
9.1 ใน `ExamFormReal` ปุ่มส่งถูกปิด (`disabled`) เมื่อไหร่บ้าง (อ่านจากโค้ดปุ่ม) — ตอบเป็น if
9.2 ทำไม `NotifRow` ใช้ `useRef` เก็บ `moved` แทน `useState`
9.3 เพิ่มข้อความ "ยังไม่ได้เลือกไฟล์" ให้แสดงเฉพาะตอน `totalFiles === 0` — เขียน JSX 1 บรรทัด (มีอยู่แล้วในไฟล์ ลองหาเทียบ)

---

# เฉลย

**1.1**
```js
function percent(part, whole) {
  if (whole) {
    return Math.round((part / whole) * 100);
  } else {
    return 0;
  }
}
```
**1.2** `"ผลสอบรอบ 1/2570ได้รับการยืนยันแล้ว"`

**2.1** `user.student?.student_id` → `undefined` (เพราะ `student` เป็น null) → `?? null` → ได้ `null`
**2.2**
```js
let time;
if (hour !== undefined) {
  if (second !== undefined) { time = A; } else { time = B; }
} else {
  time = C;
}
```

**3.1** `[3]` (2 และ 5 มีคำตอบแล้ว)
**3.2**
```js
let passedAll = true;
for (const id of subjectIds) {
  if (!s.passed_subject_ids.includes(id)) { passedAll = false; break; }
}
```
**3.3** `false` — ลูปไม่ทำงานเลย ตัวแปร "เจอ" ยังเป็นค่าเริ่มต้น false (ตรงข้ามกับ `every` ที่ได้ true)

**4.1** ในสุด: กาง key ที่อ่านแล้ว + key ใหม่ต่อกันเป็น array เดียว → `new Set(...)` ตัดตัวซ้ำ → `[...]` แปลงกลับเป็น array = "รวม 2 รายการแบบไม่ซ้ำ"
**4.2** `mainLine = "ถูกตีกลับ: ไฟล์ไม่ชัด"`, `subLines = ["กรุณากรอกใหม่"]`

**5.1** ปุ่มค้างเป็น "กำลังส่ง…" กดไม่ได้อีก ต้องรีเฟรชหน้า
**5.2** ได้ เพราะนับผลสอบกับนับประกาศไม่ขึ้นต่อกัน (ไม่ต้องใช้ผลของอันหนึ่งไปทำอีกอัน)

**6.1** ตอน `router.get(..., getLogs)` ตัวแปร `getLogs` ไม่ถูกประกาศ → server เปิดไม่ขึ้น (ReferenceError: getLogs is not defined) — เห็นใน terminal ทันที

**7.1** ข้อความ (string) `"4"` — ทุกค่าใน URL เป็นข้อความ แต่คอลัมน์ `round_id` เป็นตัวเลข ต้องแปลงก่อนให้ Prisma
**7.2** Express จับคู่จากบนลงล่าง — ถ้า `/:id` มาก่อน คำว่า `active` จะถูกจับเป็น `id = "active"`

**8.1** `where: { round_id: 4, staff_status: "rejected" }`
**8.2** `update` รับ `where` ได้เฉพาะคอลัมน์ unique ใส่เงื่อนไข `staff_status: "pending"` เพิ่มไม่ได้ · `updateMany` ใส่ได้ และคืน `count` ไว้รู้ว่ามีคนตัดหน้าไหม (ดู `09` หัวข้อ 7)

**9.1** `disabled={!allAnswered || !hasAttachment || totalFiles > MAX_EVIDENCE_FILES || submitting}`
```js
let disabled = false;
if (!allAnswered) disabled = true;                       // ยังตอบไม่ครบทุกวิชาที่ต้องตอบ
if (!hasAttachment) disabled = true;                     // ยังไม่มีไฟล์แนบ
if (totalFiles > MAX_EVIDENCE_FILES) disabled = true;    // ไฟล์เกินจำนวน
if (submitting) disabled = true;                         // กำลังส่งอยู่
```
**9.2** `moved` ใช้แค่ตัดสินตอนปล่อยเมาส์ว่าเป็นคลิกหรือลาก ไม่ต้องแสดงบนจอ — ถ้าใช้ state จะทำให้วาดจอใหม่ทุกครั้งที่ขยับเมาส์โดยไม่จำเป็น
**9.3** `{totalFiles === 0 && (<div>{tt('examform.noFilesYet')}</div>)}` — ในไฟล์จริงอยู่ในส่วน "แนบเอกสารหลักฐาน"
