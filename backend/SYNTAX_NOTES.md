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
