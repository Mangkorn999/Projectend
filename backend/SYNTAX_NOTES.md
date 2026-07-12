# Syntax Notes — JS / SQL / Prisma / Git

เอกสารสอนอ่าน-เขียนโค้ดเอง อ้างอิงจากไฟล์จริงในโปรเจกต์นี้. ไม่ใช่ spec — แค่ cheat sheet.

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
