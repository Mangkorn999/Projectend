# Syntax Notes — JS / SQL / Prisma / Git

เอกสารสอนอ่าน-เขียนโค้ดเอง อ้างอิงจากไฟล์จริงในโปรเจกต์นี้. ไม่ใช่ spec — แค่ cheat sheet.

> **เจอสัญลักษณ์แปลกๆ อ่านไม่ออก** (`...` `?.` `??` `=>` `?:`) → ข้ามไป [ส่วนที่ 5](#5-สัญลักษณ์แปลกๆ-ที่เจอในโค้ดเรา) ล่างสุด มีตัวอย่างจากโค้ดจริงทุกตัว พร้อมเวอร์ชันเขียนยาวๆ ให้เทียบ

---

## 1. JavaScript (ES Modules + async/await)

### import/export
โปรเจกต์นี้ใช้ **ES Modules** (`import`/`export`) ไม่ใช่ CommonJS (`require`).

```js
// backend/src/utils/crypto.js
import crypto from "crypto";           // import default export จาก package
export function encrypt(plaintext) {}  // named export — เรียกใช้ต้อง { encrypt }
export function decrypt(ciphertext) {} // มี export ได้หลายตัวในไฟล์เดียว
```

ใช้ที่อื่น:
```js
import { encrypt, decrypt } from "../utils/crypto.js";  // ต้องมี .js ต่อท้าย
```

`export default` vs named export:
- `export const login = ...` → named, import ด้วย `{ login }`
- `export default login` → default, import ด้วยชื่ออะไรก็ได้ `import login from ...`

### async/await + try/catch
ทุก controller เป็น `async function` เพราะคุย DB ผ่าน Prisma (คืนค่าเป็น Promise เสมอ).

```js
// backend/src/controllers/authController.js
export const login = async (req, res) => {
  try {
    const { psu_passport_id, first_name, last_name, email } = req.body; // destructuring จาก req.body
    let user = await prisma.user.findFirst({ ... });  // await = รอผลจน Promise resolve
    // ...
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "server error" });
  }
};
```

กฎ: **ทุกจุดที่เรียก Prisma ต้องมี `await`** ไม่งั้นจะได้ Promise object แทนค่าจริง แล้วโค้ดพัง silent.

### destructuring
```js
const { psu_passport_id, first_name, last_name, email } = req.body;
// เท่ากับ
const psu_passport_id = req.body.psu_passport_id;
const first_name = req.body.first_name;
// ...
```

### middleware pattern (Express)
```js
// backend/src/middlewares/auth.js
export const authenticate = (req, res, next) => {
  // ทำงานบางอย่าง...
  if (!token) {
    return res.status(401).json({ ... });  // return ตัด flow ทันที ไม่ไป next()
  }
  req.user = decoded;   // แนบข้อมูลไว้ใน req object ให้ตัวถัดไปใช้
  next();                // เรียก middleware/route handler ตัวถัดไป
};
```

`req, res, next` คือ 3 พารามิเตอร์มาตรฐานของ Express middleware. ลืมเรียก `next()` = request ค้าง ไม่ตอบกลับ.

### template literal
```js
return `${iv.toString("hex")}:${authTag}:${encrypted}`;
// backtick ` ` + ${expr} แทรกค่าตัวแปรใน string
```

### res.on("finish") + Date.now() (จับเวลาของ request)
```js
// backend/src/middlewares/requestLogger.js
const startTime = Date.now();          // เวลาตอนนี้เป็นมิลลิวินาที (ตัวเลข)
res.on("finish", () => {               // "finish" = response ส่งกลับ client เสร็จแล้ว
  const durationMs = Date.now() - startTime;   // เวลาที่ใช้ = เวลาจบ - เวลาเริ่ม
  console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs} ms)`);
});
next();                                // ปล่อยให้ request วิ่งต่อ — callback ข้างบนจะทำงานทีหลังตอนตอบเสร็จ
```
`res.on("ชื่อเหตุการณ์", ฟังก์ชัน)` = "เมื่อเกิดเหตุการณ์นี้ ให้เรียกฟังก์ชันนี้" ใช้ตอนที่ต้องรอให้บางอย่างเสร็จก่อนค่อยทำ.

---

## 2. SQL พื้นฐาน (เทียบกับ Prisma ด้านล่าง)

โปรเจกต์นี้ใช้ PostgreSQL แต่ **ไม่เขียน raw SQL เอง** — ใช้ Prisma ORM แทนเกือบทั้งหมด. รู้ SQL ไว้เข้าใจว่า Prisma แปลไปเป็นอะไร.

```sql
-- SELECT: หา user จาก psu_passport_id พร้อม join role
SELECT u.*, r.role_name
FROM users u
JOIN roles r ON u.role_id = r.role_id
WHERE u.psu_passport_id = 'xxxxx';

-- INSERT
INSERT INTO users (psu_passport_id, first_name, last_name, email, phone, role_id)
VALUES ('xxxxx', 'สมชาย', 'ใจดี', 'a@psu.ac.th', '', 2);

-- UPDATE
UPDATE users
SET first_name = 'สมชาย', last_name = 'ใจดี', email = 'a@psu.ac.th'
WHERE user_id = 1;
```

ตัวช่วยดู SQL จริงที่ Prisma รันเบื้องหลัง — เปิด log:
```js
const prisma = new PrismaClient({ log: ["query"] });
```

---

## 3. Prisma ORM

### findFirst / findUnique / findMany
```js
// backend/src/controllers/authController.js
let user = await prisma.user.findFirst({
  where: { psu_passport_id: psu_passport_id },
  include: { role: true },   // JOIN ตาราง role มาด้วย (relation)
});
```
- `findFirst` — หาตัวแรกที่ match, field ไม่ unique ก็ใช้ได้
- `findUnique` — ต้องหาด้วย field ที่เป็น `@id` หรือ `@unique` เท่านั้น เร็วกว่า
- `findMany` — คืน array ทั้งหมดที่ match

### create
```js
user = await prisma.user.create({
  data: {
    psu_passport_id: psu_passport_id,
    role_id: 2,
  },
  include: { role: true },
});
```

### update
```js
user = await prisma.user.update({
  where: { user_id: user.user_id },   // ต้องระบุ unique field
  data: { first_name: first_name },
});
```

### updateMany — ใส่เงื่อนไขกันชน (optimistic guard)

`update` ธรรมดา `where` ต้องเป็น unique field ล้วน (เช่น `user_id`) — ใส่เงื่อนไขอื่นเพิ่มไม่ได้ ถ้าอยากเช็คว่า "แถวนี้ยังอยู่ในสถานะที่คาดไว้ไหมก่อนแก้" (กัน 2 คนแก้แถวเดียวกันพร้อมกันทับกันเงียบๆ) ต้องใช้ `updateMany` แทน เพราะ `where` ของ `updateMany` ใส่เงื่อนไขอะไรก็ได้:

```js
// ตัวอย่างจริงจาก examResults.repository.js — กัน officer/reviewer 2 คนตรวจใบเดียวกันซ้อนกัน
const { count } = await prisma.examResult.updateMany({
  where: { result_id: Number(result_id), staff_status: "pending" }, // ต้องยัง "pending" อยู่เท่านั้นถึงจะแก้ได้
  data: { staff_status: "approved" },
});
if (count === 0) {
  // where ไม่ match แถวไหนเลย = มีคนแก้ไปก่อนแล้ว (สถานะเปลี่ยนไปแล้ว) ไม่ใช่ error ของ DB
  // ต้องเช็คแยกเอง ไม่มี exception โยนมาให้เหมือน update() ที่หา record ไม่เจอ
  throw new Error("มีคนแก้ไปก่อนแล้ว");
}
```

`updateMany` **ไม่คืน record ที่แก้ไปเหมือน `update`** — คืนแค่ `{ count: จำนวนแถวที่แก้ }`. อยากได้ข้อมูลล่าสุดไปตอบ frontend ต้อง `findUnique`/`findFirst` แยกอีกที**หลัง** `updateMany` เสร็จ.

`count === 0` เช็คสำคัญมาก — คือหัวใจของการกันชน (2 request เข้ามาพร้อมกันเป๊ะ ฝั่งที่แพ้จะได้ `count: 0` ไม่ใช่ error) ถ้าลืมเช็คจุดนี้เท่ากับไม่ได้กันอะไรเลย เหมือนใช้ `update` ธรรมดา.

### where เทียบ SQL WHERE
```js
where: { psu_passport_id: psu_passport_id }   // = WHERE psu_passport_id = ...
where: { user_id: { in: [1, 2, 3] } }          // = WHERE user_id IN (1,2,3)
where: { email: { contains: "psu.ac.th" } }    // = WHERE email LIKE '%psu.ac.th%'
```

### schema.prisma อ่านยังไง
```prisma
// backend/prisma/schema.prisma
model User {
  user_id         Int      @id @default(autoincrement())  // primary key, auto increment
  role_id         Int                                       // foreign key column
  psu_passport_id String   @db.VarChar(100)                 // ชนิด column ใน Postgres จริง
  student         Student?                                  // 1:0..1 relation (nullable)
  role            Role     @relation(fields: [role_id], references: [role_id])

  @@map("users")   // ชื่อตารางจริงใน DB (Prisma model ชื่อ User แต่ table ชื่อ users)
}
```
- `Int?` / `String?` → nullable column
- `[]` ท้ายชื่อ type (เช่น `ExamResult[]`) → relation แบบ 1-to-many ฝั่ง "many"
- `@relation("ชื่อ", fields: [...], references: [...])` → ใช้ตอนมี 2 relation ไป model เดียวกัน ต้องตั้งชื่อแยก (ดู `UserToExamResult` vs `UserToRound` ใน schema)

### คำสั่ง CLI ที่ใช้บ่อย
```bash
npx prisma migrate dev --name add_sessions_table   # สร้าง migration ใหม่จากการแก้ schema.prisma
npx prisma generate                                  # gen prisma client ใหม่ (ต้องรันหลัง pull/merge ที่มี schema เปลี่ยน)
npx prisma studio                                    # เปิด GUI ดู/แก้ข้อมูลใน DB
npx prisma db seed                                   # รัน prisma/seed.js
```

---

## 4. Git commands

```bash
git status                    # ดูว่าไฟล์ไหนแก้ ไฟล์ไหนยังไม่ add
git add backend/src/xxx.js    # add เฉพาะไฟล์ (อย่า git add -A มั่ว ๆ)
git commit -m "feat: xxx"     # commit พร้อมข้อความ
git log --oneline -10         # ดู commit ล่าสุด 10 อัน แบบบรรทัดเดียว
git diff                      # ดูว่าไฟล์ที่แก้ต่างจากล่าสุดตรงไหน
git diff --staged             # ดู diff เฉพาะไฟล์ที่ add แล้ว

git checkout -b feature/xxx   # สร้าง branch ใหม่แล้วสลับไป
git switch feature/xxx        # สลับ branch (คำสั่งใหม่กว่า checkout)
git push origin feature/xxx   # push branch ขึ้น remote
git pull                      # ดึงโค้ดล่าสุดจาก remote มา merge

git stash                     # เก็บงานที่แก้ค้างไว้ชั่วคราว (ยังไม่ commit)
git stash pop                 # เอากลับมา
```

Commit message convention ที่ repo นี้ใช้อยู่ (ดูจาก `git log`):
```
feat(auth): fix CORS and resolve database/Prisma login issues
feat: implement authentication routes and login controller
chore: remove SyntaxCraft (wrong project) files
```
รูปแบบ: `<type>(<scope>): <อธิบายสั้น>` — type ที่ใช้: `feat`, `fix`, `chore`, `merge`.

---

## 5. สัญลักษณ์แปลกๆ ที่เจอในโค้ดเรา

ทุกตัวในนี้เป็น **ทางลัดในการเขียน** ไม่ใช่ความสามารถพิเศษ — เขียนแบบยาวก็ได้ผลเหมือนกันเป๊ะ.
คอลัมน์ "เขียนยาว" คือสิ่งที่มันแปลว่าอะไรจริงๆ.

### 5.1 `=>` — arrow function (ฟังก์ชันแบบสั้น)

```js
// backend/src/modules/rounds/rounds.repository.js
export const findById = (id) => prisma.submissionRound.findUnique({ where: { round_id: Number(id) } });
```
เขียนยาว = อันเดียวกัน:
```js
export function findById(id) {
  return prisma.submissionRound.findUnique({ where: { round_id: Number(id) } });
}
```

กฎที่ต้องจำ: arrow ที่**ไม่มีปีกกา** `{}` = `return` ค่านั้นให้อัตโนมัติ.
ถ้าใส่ปีกกาแล้วต้องเขียน `return` เอง ไม่งั้นได้ `undefined`:
```js
const f = (x) => x * 2;          // คืน x*2
const g = (x) => { x * 2; };      // คืน undefined! ลืม return
const h = (x) => { return x * 2; }; // ถูก
```

### 5.2 `?.` — optional chaining (กันพังตอนค่าเป็น null)

```js
// frontend/src/design/officerReviewReal.jsx
room: r.student.room?.room_name || '-',
```
เขียนยาว:
```js
let room;
if (r.student.room) {          // ถ้ามี room จริง
  room = r.student.room.room_name;
} else {
  room = undefined;
}
if (!room) room = '-';          // ส่วนของ || '-'
```
มีไว้ทำไม: นักศึกษาบางคนยังไม่ได้ห้อง `room` เป็น `null`. เขียน `r.student.room.room_name` ตรงๆ จะพังทันทีด้วย
`TypeError: Cannot read properties of null (reading 'room_name')`.

### 5.3 `||` กับ `??` — ค่าสำรอง

```js
const PORT = process.env.PORT || 3000;     // backend/src/server.js
remark: remark ?? null,                     // backend/src/modules/examResults/examResults.controller.js
```
- `a || b` → ถ้า `a` เป็นค่า "เท็จ" (`null`, `undefined`, `0`, `""`, `false`) ให้ใช้ `b`
- `a ?? b` → ใช้ `b` **เฉพาะตอน** `a` เป็น `null` หรือ `undefined` เท่านั้น

ต่างกันตรงไหน สำคัญมาก:
```js
0 || 100     // = 100  ← 0 ถือเป็นเท็จ เลยโดนแทน (มักไม่ใช่สิ่งที่ต้องการ)
0 ?? 100     // = 0    ← 0 เป็นค่าจริง ไม่โดนแทน
```

### 5.4 `? :` — ternary (if/else แบบบรรทัดเดียว)

```js
// backend/src/modules/examResults/examResults.controller.js
const result = isRedo
  ? await examRepo.resubmitWithSubjects(existing.result_id, finalResults)
  : await examRepo.createWithSubjects({ ... }, finalResults);
```
เขียนยาว:
```js
let result;
if (isRedo) {
  result = await examRepo.resubmitWithSubjects(existing.result_id, finalResults);
} else {
  result = await examRepo.createWithSubjects({ ... }, finalResults);
}
```
อ่านว่า: `เงื่อนไข ? เอาอันนี้ : ไม่งั้นเอาอันนี้`

### 5.5 `...` — spread (คลายของในกล่องออกมา)

**กับ object** = ก๊อปทุก key ของก้อนเดิมมาใส่ก้อนใหม่:
```js
// backend/src/modules/examResults/examResults.repository.js
const withDetails = { round: true, subject_results: { include: { subject: true } }, certificates: true };

include: { ...withDetails, student: studentSafeSelect }
```
เขียนยาว = อันเดียวกัน:
```js
include: {
  round: true,
  subject_results: { include: { subject: true } },
  certificates: true,
  student: studentSafeSelect,
}
```
มีไว้ทำไม: ก้อน `withDetails` ถูกใช้ 5 ที่ในไฟล์เดียว. เขียนยาวทั้ง 5 ที่ = แก้ทีต้องไล่แก้ 5 จุด ลืมจุดเดียวก็บั๊ก.

**กับ array** = คลาย array ออกเป็นสมาชิกเดี่ยวๆ:
```js
const ids = [...selected];                 // Set → array ธรรมดา
const all = [...prev, ...filtered];        // ต่อ 2 array เข้าด้วยกัน (= prev.concat(filtered))
```

### 5.6 `.map()` / `.filter()` / `.some()` / `.every()` — วนลูปแบบสั้น

| เขียนสั้น | แปลว่า | ได้อะไรกลับมา |
|---|---|---|
| `arr.map(x => ...)` | แปลงทุกตัว | array ใหม่ **ขนาดเท่าเดิม** |
| `arr.filter(x => ...)` | คัดเฉพาะที่เงื่อนไขจริง | array ใหม่ **สั้นลงหรือเท่าเดิม** |
| `arr.some(x => ...)` | มีสักตัวที่จริงไหม | `true` / `false` |
| `arr.every(x => ...)` | จริงหมดทุกตัวไหม | `true` / `false` |
| `arr.find(x => ...)` | หาตัวแรกที่จริง | ตัวนั้น หรือ `undefined` |

```js
// backend/src/modules/dashboard/dashboard.service.js
const pass = marks.filter((m) => m.is_passed).length;
```
เขียนยาว:
```js
let pass = 0;
for (const m of marks) {
  if (m.is_passed) {
    pass = pass + 1;
  }
}
```

ต่อกันหลายตัวได้ อ่านจากซ้ายไปขวาทีละขั้น:
```js
results.filter(r => r.staff_status === 'pending').map(r => r.student_id)
// ขั้น 1 คัดเฉพาะใบที่รอตรวจ → ขั้น 2 ดึงเฉพาะรหัสนักศึกษาออกมา
```

### 5.7 `new Set()` — กล่องที่ห้ามมีของซ้ำ

```js
// backend/src/modules/examResults/examResults.repository.js
return [...new Set(rows.map((r) => r.subject_id))];
```
อ่านทีละชั้นจากในออกนอก:
1. `rows.map(r => r.subject_id)` → `[1, 2, 2, 3]` (มี 2 ซ้ำ)
2. `new Set(...)` → `Set {1, 2, 3}` (Set ตัดซ้ำให้เอง)
3. `[... ]` → `[1, 2, 3]` (แปลง Set กลับเป็น array ธรรมดา)

ใช้เช็ค "มีอยู่ในกลุ่มไหม" เร็วกว่า array มาก:
```js
const submittedIds = new Set(results.map(r => r.student_id));
submittedIds.has('6410001')   // true / false
```

### 5.8 `===` vs `==`

**ใช้ `===` เสมอ.** `==` แปลงชนิดให้เองก่อนเทียบ ทำให้เกิดเรื่องแบบนี้:
```js
"1" == 1     // true  ← แปลง string เป็นเลขให้ก่อน
"1" === 1    // false ← คนละชนิด ถือว่าไม่เท่า (ถูกต้องกว่า)
```
เวลาเทียบ id ที่มาจาก URL (เป็น string เสมอ) กับ id จาก DB (เป็น number) ต้องแปลงเองก่อน:
```js
String(r.round_id) === String(roundId)     // หรือ Number(...) ทั้งคู่
```

### 5.9 `async` / `await` / `Promise.all`

`await` = "รอตรงนี้จนกว่าจะได้ผล ค่อยไปบรรทัดถัดไป". ใช้ได้เฉพาะในฟังก์ชันที่มี `async`.

```js
// รอทีละอัน — ช้า เพราะอันที่ 2 ต้องรออันที่ 1 เสร็จก่อนทั้งที่ไม่เกี่ยวกัน
const total = await dashRepo.countStudentsByYear(year);
const eligible = await dashRepo.countEligibleByYear(year);

// ยิงพร้อมกันแล้วรอให้ครบ — เร็วกว่า (backend/src/modules/dashboard/dashboard.service.js)
const [total, eligible] = await Promise.all([
  dashRepo.countStudentsByYear(year),
  dashRepo.countEligibleByYear(year),
]);
```
`const [a, b] = ...` คือ **array destructuring** — เอาตัวที่ 0 ใส่ `a`, ตัวที่ 1 ใส่ `b` ตามลำดับ.

### 5.10 object shorthand — key กับ value ชื่อเดียวกัน

```js
const student_id = "6410001";
const data = { student_id };          // = { student_id: student_id }
```

### 5.11 default parameter — ค่าตั้งต้นของ argument

```js
// backend/src/modules/dashboard/dashboard.service.js
export const buildHistory = async (yearCount = 3) => { ... }

buildHistory();     // yearCount = 3 (ไม่ส่งมา ใช้ค่าตั้งต้น)
buildHistory(5);    // yearCount = 5
```

### 5.12 `({ a, b } = {})` — รับ object แล้วแกะทันที

```js
// backend/src/modules/examResults/examResults.repository.js
export const findAll = ({ round_id, staff_status, student_id } = {}) => { ... }
```
เขียนยาว:
```js
export function findAll(options) {
  if (options === undefined) options = {};   // ← ส่วน = {} ข้างหลัง กันเรียก findAll() เปล่าๆ แล้วพัง
  const round_id = options.round_id;
  const staff_status = options.staff_status;
  const student_id = options.student_id;
  ...
}
```

### 5.13 `Math.min` / `Math.max` ซ้อนกัน — ดึงเลขให้อยู่ในช่วง (clamp)

ช่องพิมพ์เลขหน้าในตาราง ผู้ใช้พิมพ์ 999 ทั้งที่มี 93 หน้า ต้องไม่พัง — ดึงกลับมาที่หน้าสุดท้ายแทน

```js
// frontend/src/design/components.jsx (PageJump)
const target = Math.min(Math.max(n - 1, 0), pages - 1);
```
อ่านจากในออกนอก:
```js
Math.max(n - 1, 0)        // ต่ำกว่า 0 ให้เป็น 0        → กันหน้าติดลบ
Math.min(  ...  , pages-1) // สูงกว่าหน้าสุดท้ายให้เท่าหน้าสุดท้าย
```
เขียนยาว:
```js
let target = n - 1;
if (target < 0) target = 0;
if (target > pages - 1) target = pages - 1;
```

### 5.14 `.replace(/[^0-9]/g, '')` — กรองให้เหลือแต่ตัวเลข

`/.../` คือ regular expression (แพตเทิร์นค้นหาข้อความ)

| ส่วน | แปลว่า |
|---|---|
| `[0-9]` | ตัวอักษรที่เป็นเลข 0 ถึง 9 |
| `[^0-9]` | `^` ข้างในวงเล็บเหลี่ยม = **กลับด้าน** → อะไรก็ได้ที่**ไม่ใช่**เลข |
| `g` | global = แทนที่ทุกตัวที่เจอ ไม่ใช่แค่ตัวแรก |

```js
// frontend/src/design/components.jsx
onChange={e => setText(e.target.value.replace(/[^0-9]/g, ''))}

'12a3!'.replace(/[^0-9]/g, '')   // → '123'
```

### 5.15 `getBoundingClientRect()` — ถามตำแหน่งจริงของ element บนจอ

Select ที่เขียนเองต้องวาดกล่องรายการให้ตรงใต้ปุ่มพอดี เลยต้องรู้ว่าปุ่มอยู่พิกัดไหน

```js
// frontend/src/design/components.jsx (Select)
const r = triggerRef.current.getBoundingClientRect();
r.top, r.bottom, r.left, r.width   // หน่วยเป็น px นับจากมุมซ้ายบนของ "ส่วนที่มองเห็น" ไม่ใช่ของทั้งหน้า
```
เลขจึงเปลี่ยนเมื่อเลื่อนหน้า — ต้องวัดใหม่ทุกครั้งที่เลื่อน ไม่ใช่วัดครั้งเดียวตอนเปิด

### 5.16 ทำไมห้ามเรียก `setState` ใน `useEffect` (react-hooks/set-state-in-effect)

`useEffect` ทำงาน **หลัง** วาดจอเสร็จแล้ว ถ้าไปสั่ง `setState` ตรงนั้นจะวาดอีกรอบ = ผู้ใช้เห็นของผิดแวบหนึ่ง

```js
// ❌ พิมพ์ค้นหาแล้วค่อยรีเซ็ตไฮไลต์ทีหลัง — วาด 2 รอบ รอบแรกไฮไลต์ยังผิด
useEffect(() => { setActiveIndex(0); }, [query]);

// ✅ ตั้งทั้งคู่ในเหตุการณ์เดียวกัน — React รวมให้เป็นรอบเดียว
const changeQuery = (text) => {
  setQuery(text);
  setActiveIndex(0);
};
```
หลักคิด: `useEffect` มีไว้คุยกับของนอก React (ยิง API, ฟัง event ของ browser) ไม่ใช่ไว้ไล่แก้ state ตามกัน

### 5.17 `createPortal` — วาด element ไว้ที่อื่นของหน้า

การ์ดหลายใบตั้ง `overflow: hidden` ไว้ ถ้าวาดกล่อง dropdown ไว้ข้างในการ์ดมันจะโดนตัดครึ่ง
`createPortal` ย้ายไปวาดที่ `document.body` แทน แต่ยังสั่งงาน/รับค่าจาก component เดิมได้ปกติ

```js
// frontend/src/design/components.jsx
import { createPortal } from 'react-dom';

return createPortal(
  <div className="select-panel">...</div>,   // สิ่งที่จะวาด
  document.body,                             // วาดไว้ตรงไหน
);
```

### 5.18 query string (`?dry_run=true`) — ค่าที่ได้เป็นข้อความเสมอ

ต่อท้าย URL ด้วย `?ชื่อ=ค่า` เพื่อส่งตัวเลือกเล็กๆ ไปกับ request โดยไม่ต้องแก้ body
Express แกะให้อยู่ใน `req.query`

```js
// POST /api/students/import?dry_run=true
// backend/src/modules/students/student.controller.js
const dryRun = req.query.dry_run === "true";
```
**กับดัก:** ทุกค่าใน `req.query` เป็น **string** — `req.query.dry_run` คือ `"true"` ไม่ใช่ `true`
```js
if (req.query.dry_run) { ... }            // ❌ ส่ง ?dry_run=false มาก็เข้า if เพราะ "false" เป็นข้อความที่ไม่ว่าง
if (req.query.dry_run === "true") { ... } // ✅
```

### 5.19 ฟังก์ชันคืน `{ year }` หรือ `{ error }` แทนการ throw

import CSV ต้อง "ข้ามแถวที่ผิด แล้วทำแถวต่อไป" ไม่ใช่ล้มทั้งไฟล์ — ถ้าตัวตรวจ throw ต้องห่อ try/catch ทุกที่ที่เรียก
เลยให้คืนผลเป็น object แล้วคนเรียกเลือกเองว่าจะทำอะไรกับ error

```js
// backend/src/utils/academicYear.js
const checked = validateGraduationYear("2566", "6610210001");
// → { error: "ปีการศึกษาที่จบต้องไม่น้อยกว่า 2570 ..." }

if (checked.error) {
  skipped.push({ row, student_id, reason: checked.error }); // import: ข้ามแถวนี้
  continue;
}
// เพิ่มทีละคน / แก้ไข: เอา checked.error ไป throw เป็น 400 แทน
```

### 5.20 Prisma — หาแถวที่ "ยังไม่มี" relation และข้อความขึ้นต้นด้วย

```js
// backend/tests/cleanupYears.mjs — user ที่ import แล้วแต่ยังไม่มีแถว students
prisma.user.deleteMany({
  where: {
    student: null,                              // relation 1:0..1 ยังไม่มี = null
    psu_passport_id: { startsWith: "87" },      // SQL: LIKE '87%'
  },
});
```

### 5.21 Prisma — `@@unique` / `@@index` และวิธีค้นด้วย compound unique

```prisma
model ExamResult {
  student_id String
  round_id   Int
  // ห้ามมี 2 แถวที่ student_id + round_id ซ้ำกัน (คู่กัน ไม่ใช่แยกตัว)
  @@unique([student_id, round_id])
  // index = สารบัญของตาราง ช่วยให้ค้นด้วยคอลัมน์นี้เร็วขึ้น ไม่ได้ห้ามค่าซ้ำ
  @@index([round_id])
}
```

พอประกาศ `@@unique` แล้ว Prisma สร้างชื่อ key ให้อัตโนมัติ = **เอาชื่อคอลัมน์มาต่อกันด้วย `_`**

```js
// ก่อนมี @@unique — findFirst เท่านั้น (Prisma ไม่รู้ว่าผลลัพธ์มีได้ตัวเดียว)
prisma.examResult.findFirst({ where: { student_id, round_id } });

// หลังมี @@unique — findUnique ได้ ต้องห่อไว้ใน key ที่ Prisma ตั้งให้
prisma.examResult.findUnique({
  where: { student_id_round_id: { student_id, round_id } },
});
```

**ทำไมต้องกันซ้ำที่ DB ทั้งที่ controller เช็คแล้ว:** เช็คใน controller มีช่องว่างระหว่าง "ตรวจว่ายังไม่มี" กับ "เขียนลงไป"
ถ้า 2 request วิ่งมาพร้อมกัน ทั้งคู่จะตรวจเจอว่า "ยังไม่มี" ก่อนที่ใครจะเขียนเสร็จ → ได้ 2 แถว
constraint ที่ DB เป็นด่านสุดท้ายที่ไม่มีช่องว่างแบบนั้น

### 5.22 Prisma error code — `P2002` (ข้อมูลซ้ำ constraint)

Prisma โยน error ที่มี `.code` เป็นรหัสตายตัว เอามาแยกแยะได้ว่าเป็นความผิดผู้ใช้หรือบัคของเรา

```js
// middlewares/errorHandler.js
const isDuplicate = err.code === "P2002";   // Unique constraint failed
if (isDuplicate) statusCode = 409;          // ไม่ใช่บัคเรา → ไม่ควรเป็น 500
```

รหัสที่เจอบ่อย: `P2002` ซ้ำ constraint · `P2003` FK ชี้ไปหาของที่ไม่มี · `P2025` หาแถวที่จะแก้/ลบไม่เจอ

### 5.23 `new URL()` — แก้ query string ของ URL โดยไม่ต้องต่อ string เอง

```js
const url = new URL("postgresql://user:pass@localhost:5432/mydb");
url.searchParams.set("schema", "verify_tmp");
url.toString();  // → postgresql://user:pass@localhost:5432/mydb?schema=verify_tmp
```

ดีกว่าต่อเอง (`url + "?schema=..."`) เพราะถ้า URL เดิมมี `?` อยู่แล้วต้องใช้ `&` แทน
`searchParams` รู้เองว่าต้องใช้ตัวไหน และทับค่าเดิมให้ถ้ามี key ซ้ำ

### 5.24 `spawn()` — สั่งรันโปรแกรมอื่นจากใน Node

```js
import { spawn } from "child_process";

// spawn คืน object ทันที ไม่ได้รอให้จบ — ต้องห่อ Promise เองถ้าอยาก await
function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      shell: true,           // จำเป็นบน Windows ไม่งั้นเรียก npx ไม่เจอ
      stdio: "inherit",      // ให้ output ของลูกไหลออกจอเลย ("pipe" = เก็บไว้อ่านเอง)
    });
    child.on("close", (code) => resolve(code ?? 1)); // 0 = สำเร็จ
  });
}

const code = await run("npx", ["prisma", "migrate", "deploy"]);
```

⚠️ **กับดักบน Windows:** `shell: true` = ได้ process ของ `cmd` ครอบโปรแกรมจริงอีกชั้น
`child.kill()` ฆ่าแค่ `cmd` ตัวนอก ตัวข้างในรอด (แล้วจองพอร์ตค้างไว้)
ต้องสั่งฆ่าทั้งต้นไม้: `taskkill /PID <pid> /T /F` (`/T` = ลูกหลานทั้งหมด, `/F` = บังคับ)

### 5.25 `process.platform` — เช็คว่ากำลังรันบน OS ไหน

```js
if (process.platform === "win32") {
  // Windows (เป็น "win32" เสมอ แม้เครื่องเป็น 64-bit)
} else {
  // "darwin" = macOS, "linux" = Linux
}
```

### 5.26 `.split(",").map((s) => s.trim())` — แปลงข้อความคั่น comma เป็น array

```js
// CORS_ORIGIN="http://localhost:5174, http://192.168.1.10:5174"
process.env.CORS_ORIGIN.split(",").map((o) => o.trim());
// → ["http://localhost:5174", "http://192.168.1.10:5174"]
```

`.trim()` ตัดช่องว่างหัวท้าย — ขาดไปแล้วค่าที่ 2 จะเป็น `" http://..."` (มีเว้นวรรคนำ) แล้วเทียบไม่ตรง

### 5.27 `import.meta.env` — อ่าน .env ฝั่ง frontend (Vite)

```js
// frontend/src/design/api.js
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000/api';
```

ต่างจาก backend ที่ใช้ `process.env` — ฝั่ง browser ไม่มี `process`

⚠️ 2 ข้อที่ต่างจาก backend:
1. **ต้องขึ้นต้นด้วย `VITE_`** เท่านั้น ตัวอื่น Vite ไม่ส่งให้ (กันความลับหลุดโดยไม่ตั้งใจ)
2. **ค่าถูกฝังลงไฟล์ที่ browser โหลด** = ทุกคนเปิดดูได้ → **ห้ามใส่รหัสผ่าน/key เด็ดขาด**

### 5.28 Prisma — `{ in: undefined }` ไม่ได้แปลว่า "ไม่ตรงกับอะไร"

```js
// ตั้งใจ: อัปเดตเฉพาะนักศึกษาที่อยู่ในรายชื่อ
prisma.student.updateMany({
  where: { student_id: { in: studentIds } },
  data: { exam_eligible: false },
});
```

ถ้า `studentIds` เป็น `undefined` (client ลืมส่งมา) Prisma จะ **ตัดเงื่อนไขนั้นทิ้ง**
→ `where` กลายเป็นก้อนว่าง → เข้าเงื่อนไข **ทุกแถวในตาราง**
= ปิดสิทธิ์นักศึกษาทั้งระบบในคำสั่งเดียว โดยตอบ 200 เหมือนสำเร็จปกติ

**กฎ:** ก่อนเรียก `updateMany` / `deleteMany` ต้องตรวจก่อนเสมอว่าเงื่อนไขมีค่าจริง

```js
if (!Array.isArray(student_ids) || student_ids.length === 0) {
  throw httpError("ต้องระบุ student_ids อย่างน้อย 1 รายการ", 400);
}
if (typeof exam_eligible !== "boolean") {   // "false" (ข้อความ) ต้องไม่ผ่าน
  throw httpError("exam_eligible ต้องเป็น true หรือ false", 400);
}
```

`findMany` ไม่อันตรายเท่า (แค่ได้ผลเกิน) แต่ `updateMany`/`deleteMany` แก้ข้อมูลจริง

### 5.29 ค่าที่คำนวณตอนส่งออก ไม่เก็บลง DB

```js
// backend/src/utils/roundPhase.js
export const getRoundPhase = (round, now = new Date()) => {
  if (round.status !== "open") return "closed";
  if (now < new Date(round.open_date)) return "scheduled";
  if (now > new Date(round.close_date)) return "expired";
  return "active";
};

// แปะเข้าไปตอนจะส่งให้ client
export const withPhase = (round) => ({ ...round, phase: getRoundPhase(round) });

res.json({ success: true, data: rounds.map(withPhase) });
```

**ทำไมไม่เก็บเป็นคอลัมน์:** ค่ามันเปลี่ยนเองเมื่อเวลาผ่านไป โดยไม่มีใครมากดอะไรเลย
รอบที่เป็น `scheduled` วันนี้ พรุ่งนี้กลายเป็น `active` เอง
ถ้าเก็บลง DB ต้องมีอะไรสักอย่างคอยวิ่งอัปเดตตลอดเวลา — คำนวณตอนอ่านจบกว่า

⚠️ สูตรต้องตรงกับ query ที่ใช้จริง (`findActive`) เป๊ะๆ ไม่งั้นหน้าจอจะบอกคนละเรื่องกับที่ระบบทำ

### 5.30 `prisma.$transaction(async (tx) => { ... })` — หลายคำสั่งต้องสำเร็จพร้อมกัน

```js
export const resubmit = (id, rows) =>
  prisma.$transaction(async (tx) => {
    const { count } = await tx.examResult.updateMany({
      where: { result_id: id, staff_status: { not: "approved" } },
      data: { staff_status: "pending" },
    });
    if (count === 0) throw new Error("ถูกยืนยันไปแล้ว"); // throw = ยกเลิกทุกคำสั่งในก้อนนี้
    await tx.subjectResult.deleteMany({ where: { result_id: id } });
    await tx.subjectResult.createMany({ data: rows });
  });
```

- ในก้อนนี้ใช้ `tx` แทน `prisma` ทุกที่ — ถ้า throw กลางทาง สิ่งที่ทำไปแล้วถูกย้อนกลับหมด
- `updateMany` + เงื่อนไขใน `where` = "แก้เฉพาะถ้าสถานะยังเป็นแบบนี้" แล้วดู `count`: 0 แปลว่ามีคนแก้ไปก่อนเรา
  (กัน 2 คนกดพร้อมกัน — เช็คใน controller อย่างเดียวไม่พอ เพราะระหว่างเช็คกับเขียนมีช่องว่าง)
- `{ not: "approved" }` = ไม่เท่ากับ · `{ has: 5 }` = array ใน column (`Int[]`) มีเลข 5 อยู่

### 5.31 `new Map()` — จำว่า "เจอค่านี้แล้วที่แถวไหน"

```js
const seen = new Map();                 // key -> value เหมือน object แต่ key เป็นอะไรก็ได้
if (seen.has(id)) { /* ซ้ำกับแถว */ seen.get(id); }
seen.set(id, rowNum);
```

ใช้ตอน import CSV จับรหัสซ้ำในไฟล์เดียว (`Set` ก็ได้ถ้าไม่ต้องจำค่า แต่เราอยากบอกเลขแถวแรกที่เจอ)

### 5.32 อ่านไบต์แรกของไฟล์ — เช็คว่าเป็น PDF จริง ไม่เชื่อ mimetype

```js
const head = Buffer.alloc(5);
const fh = await fs.open(path, "r");
try { await fh.read(head, 0, 5, 0); } finally { await fh.close(); }
head.toString("latin1") === "%PDF-";   // PDF จริงขึ้นต้นด้วย %PDF- เสมอ
```

`mimetype` มาจาก header ที่ client ส่งมา แก้เองได้ — เนื้อไฟล์จริงโกหกไม่ได้ · `finally` = ปิดไฟล์เสมอแม้ read พัง

### 5.33 อ่านไฟล์ Excel (.xlsx) — `readSheet` + เก็บตัวเลขเป็นข้อความ

```js
import { readSheet } from "read-excel-file/node";

const sheet = await readSheet(buffer, { parseNumber: (text) => text });
// sheet = [["student_id","national_id"], ["6610210001","1234567890123"], ...]  (แถวละ array)
```

- `.xlsx` คือไฟล์ zip ที่ข้างในเป็น XML — เลข 13 หลักที่พิมพ์ลงเซลล์ถูกเก็บครบ Excel แค่ *แสดง* เป็น `1.23457E+12`
- แต่ถ้า "บันทึกเป็น CSV" Excel เขียนตามที่แสดง เลขหลังหลักที่ 6 หายจริง กู้คืนไม่ได้ → อ่าน `.xlsx` ตรงๆ
- `parseNumber: (text) => text` = ไม่แปลงเป็น `number` ของ JS (ตัวเลขยาวๆ อาจเพี้ยน) เอาข้อความตามที่เก็บในไฟล์
- ตรวจว่าเป็น xlsx จากไบต์แรก `PK` (zip) ไม่เชื่อนามสกุลไฟล์ — ดู 5.32
- ทำแถวเป็น object: `Object.fromEntries(names.map((n, i) => [n, cells[i]]))` (`fromEntries` = แปลง array ของ `[key, value]` เป็น object)

### 5.34 ลบข้อมูลที่ผูกกันหลายตาราง — ลบจากลูกขึ้นแม่ + `groupBy` นับ

```js
// นับผลสอบต่อนักศึกษา (GROUP BY student_id) — ไว้เตือนก่อนลบ
const rows = await prisma.examResult.groupBy({
  by: ["student_id"],
  where: { student_id: { in: ids } },
  _count: { _all: true },        // จำนวนแถวในแต่ละกลุ่ม
});
const total = rows.reduce((n, r) => n + r._count._all, 0);   // reduce = วนบวกสะสมเป็นค่าเดียว

// ลบทีละตารางเรียงจาก "ลูก" ไป "แม่" ใน transaction เดียว (พังตรงไหนย้อนกลับทั้งหมด)
await prisma.$transaction([
  prisma.reviewLog.deleteMany({ where: { result_id: { in: rids } } }),
  prisma.examResult.deleteMany({ where: { result_id: { in: rids } } }),
  prisma.student.deleteMany({ where: { student_id: { in: sids } } }),
]);
```

- แถวลูกที่ยังชี้มาที่แม่ (FK) ทำให้ลบแม่ไม่ได้ → ต้องลบลูกก่อนเสมอ
- **ไฟล์บน disk ลบหลัง transaction สำเร็จ** ไม่ใช่ก่อน: ลบไฟล์แล้ว DB พัง = ข้อมูลยังอยู่แต่หลักฐานหาย
- `deleteMany` ที่ `where` ไม่เจอแถวเลยไม่ error คืน `{ count: 0 }` — เช็ค count เองถ้าต้องตอบ 404
- การลบที่ย้อนกลับไม่ได้ → บังคับให้ client ส่งค่ายืนยันชัดเจน (`=== true` ไม่ใช่แค่ truthy) ไม่งั้นตอบ 409


### 5.35 สร้างไฟล์ Excel (.xlsx) ส่งให้ดาวน์โหลด + เรียงหลายเงื่อนไข

```js
import writeXlsxFile from "write-excel-file/node";

// แถวแรก = หัวตาราง, แถวถัดไป = ข้อมูล — แต่ละเซลล์เป็น { value, type }
const buffer = await writeXlsxFile(
  [
    [{ value: "รหัส", type: String, fontWeight: "bold" }],
    [{ value: "6610210001", type: String }],
  ],
  { sheet: "รายชื่อ", columns: [{ width: 16 }], stickyRowsCount: 1 },
).toBuffer();                       // toBuffer() = ได้ไฟล์เป็นก้อนข้อมูลในหน่วยความจำ (ยังไม่เขียนลง disk)

res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
res.setHeader("Content-Disposition", `attachment; filename="export.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
res.send(buffer);                   // ส่ง buffer กลับไปตรงๆ ไม่ใช่ res.json
```

- `type: String` ทั้งเซลล์ (แม้จะเป็นตัวเลข เช่น เบอร์โทร `0812345678`) — ถ้าเป็นตัวเลข Excel ตัดเลข 0 หน้าทิ้ง หรือแปลงรหัสยาวเป็น `1.23E+12` (เรื่องเดียวกับ 5.33 แต่ขาออก) · ที่ใช้ซ้ำทุก export อยู่ใน `utils/xlsxExport.js`
- ชื่อไฟล์ภาษาไทยต้องมี `filename="..."` (ASCII สำรอง) + `filename*=UTF-8''...` คู่กัน
- เรียงหลายเงื่อนไข: `.sort((a, b) => b.year - a.year || b.attempt - a.attempt)` — `a || b` = ถ้าเงื่อนไขแรกเท่ากัน (ผลลบกันได้ 0 ซึ่งเป็น falsy) ค่อยดูเงื่อนไขถัดไป
- ทำ Map จาก array: `new Map(results.map((r) => [r.student_id, r]))` → `map.get(id)` หาแถวของนักศึกษาคนนั้นได้ทันที ไม่ต้องวนหาซ้ำ
- ชื่อ key แบบคำนวณ: `{ [up ? "bottom" : "top"]: "100%" }` (เครื่องหมาย `[ ]` = ให้ JS คำนวณชื่อ key จากเงื่อนไขก่อน)

### 5.36 เลขฐาน 16 (`0xff`) — ตรวจ "หัวไฟล์" ว่าเป็น PDF / JPG / PNG จริง

```js
const FILE_SIGNATURES = [
  { fileType: "pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },   // ตัวอักษร %PDF-
  { fileType: "jpg", bytes: [0xff, 0xd8, 0xff] },
  { fileType: "png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];
```

- `0x` นำหน้า = เขียนตัวเลขแบบ **ฐาน 16** (hex) — `0xff` คือเลข 255, `0x25` คือ 37 (ไบต์ 1 ตัวมีค่า 0–255 พอดี เขียน hex 2 หลักได้ทุกค่า)
- ทำไมใช้ hex: เอกสารรูปแบบไฟล์ทุกที่เขียนหัวไฟล์เป็น hex (เช่น "PNG ขึ้นต้นด้วย 89 50 4E 47") เขียนแบบเดียวกันจะเทียบกับเอกสารได้ตรงๆ
- วิธีตรวจ (`certificates.controller.js → detectFileType`): อ่าน 8 ไบต์แรกของไฟล์ แล้ว `for` วนทีละชนิด → `for` ซ้อนเทียบทีละไบต์ ตรงครบทุกไบต์ = เป็นไฟล์ชนิดนั้น ไม่ตรงสักชนิด = ปฏิเสธ
- ต่อยอดจาก 5.32 (เดิมตรวจแค่ PDF) — ชนิดที่เบราว์เซอร์บอกมา (mimetype) และนามสกุลไฟล์ปลอมได้ แต่เนื้อไฟล์จริงปลอมยากกว่า

### 5.37 `const { a, ...rest } = obj` — เอาบาง field ออก แล้วเก็บที่เหลือ (ตัด `password_hash` ก่อนส่งออก)

```js
export const toActor = (user) => {
  if (!user) return null;
  const { password_hash, ...rest } = user;      // แยก password_hash ออกมา ที่เหลือทั้งหมดอยู่ใน rest
  return { ...rest, is_closed: password_hash === null };
};
```

- `...rest` ฝั่งซ้าย (ตอนแกะ) = "เก็บที่เหลือทุก field ไว้ในตัวแปรนี้" · `...rest` ฝั่งขวา (ตอนสร้าง object) = "ก๊อปทุก field มาวางตรงนี้" — หน้าตาเหมือนกันแต่ทำงานตรงข้าม
- ใช้ดึง `password_hash` มาคำนวณ (ว่าบัญชีถูกปิดไหม) แล้วทิ้งก่อนส่งออก — ไฟล์ `utils/actor.js`
- `password_hash` ที่แกะออกมาแต่ไม่ได้ใช้ต่อ ถูกต้องแล้ว: มันถูกใช้ในบรรทัด `is_closed` ไปแล้ว

### 5.38 `...(เงื่อนไข ? {} : { ... })` — ใส่ field ลงใน object เฉพาะบางกรณี

```js
data: {
  status: isLatest ? "open" : "closed",
  ...(isLatest ? {} : { updated_by: someId, updated_at: new Date() }),   // รอบที่ปิดแล้วเท่านั้นที่มีคนแก้
  subject_ids: need,
}
```

- `...{}` (object ว่าง) = ไม่ใส่อะไรเลย · `...{ a, b }` = ใส่ a, b ลงมา — เลือกได้ด้วย `? :`
- ใช้แทนการเขียน `if` แยกสร้าง object สองแบบ

### 5.39 `delete obj.key` — ลบ field ออกจาก object ก่อนส่งให้ผู้ใช้

```js
if (req.user.role === "student") {
  delete round.creator;     // นักศึกษาไม่ต้องเห็นชื่อเจ้าหน้าที่ที่สร้างรอบ
  delete round.updater;
}
```

- ใช้กับ object ที่เราสร้างเอง (เช่นผลจาก `withPhase`) ได้เลย · role ต้องอ่านจาก JWT (`req.user.role`) เท่านั้น ห้ามเชื่อค่าที่ client ส่งมา

### 5.40 Prisma — ความสัมพันธ์ที่ชี้กลับตารางเดียวกัน (`users.created_by` → `users`) + `onDelete: SetNull`

```prisma
created_by    Int?
creator       User?   @relation("UserCreatedBy", fields: [created_by], references: [user_id], onDelete: SetNull)
created_users User[]  @relation("UserCreatedBy")
```

- ตารางชี้กลับตัวเอง (self-relation) ต้องตั้งชื่อความสัมพันธ์ (`"UserCreatedBy"`) ทั้งสองฝั่ง และถ้ามีหลายอัน (`created_by`, `closed_by`) แต่ละอันชื่อไม่ซ้ำกัน ไม่งั้น Prisma แยกไม่ออก
- `Int?` = ว่างได้ (แถวเก่าที่มีก่อนมีคอลัมน์นี้ไม่มีค่า)
- `onDelete: SetNull` = ถ้าคนที่ถูกอ้างถึงถูกลบ ช่องนี้กลับเป็นว่าง แทนที่จะห้ามลบ (ค่าปกติของระบบนี้คือ `RESTRICT` ซึ่งลบไม่ได้) — ใช้กับ "ใครทำ" เพราะเป็นแค่ข้อมูลประกอบ ไม่ควรขวางการลบบัญชี
- สร้าง SQL ของ migration โดยไม่ต้องมี shadow database: `npx prisma migrate diff --from-url "<DB ที่ migrate ถึงล่าสุดแล้ว>" --to-schema-datamodel prisma/schema.prisma --script`
