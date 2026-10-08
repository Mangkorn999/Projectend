# Backend 04 — Users (จัดการบัญชีเจ้าหน้าที่ / ผู้บริหาร / ผู้ตรวจ)

โฟลเดอร์: `backend/src/modules/users/` — เฉพาะ role `officer` เข้าได้ทุก endpoint (ดู `users.routes.js` ใน [02](02-auth-และแผนที่-routes.md))

> นักศึกษาไม่ได้ถูกสร้างที่นี่ — นักศึกษาถูก import ผ่านโมดูล `students` (ดู [05](05-students-repository-และ-controller.md))
> บัญชีที่สร้างที่นี่ได้เฉพาะ role `officer`, `executive`, `reviewer`

---

## `users.repository.js` (113 บรรทัด)

| บรรทัด | ทำอะไร |
|---|---|
| 1-2 | import `prisma`, `ACTOR_SELECT`, `toActor` |
| 6-22 | `USER_FIELDS_WITH_HASH` — object `select` ระบุ field ที่ดึง. มี `password_hash` **เพื่อคำนวณ `is_revoked` เท่านั้น**. `creator`/`closer` = ผู้สร้าง/ผู้ปิดบัญชี (relation ดึงด้วย `ACTOR_SELECT`), `role: true` ดึง role ทั้งก้อน |
| 26-30 | `toPublicUser(user)` — **ต้องเรียกก่อนส่งออกทุกครั้ง**: ตัด `password_hash` ทิ้ง (`const { password_hash, ...rest } = user`), แปลง creator/closer ด้วย `toActor`, เพิ่ม `is_revoked = (hash === null)` |
| 33-36 | `findAll` — ผู้ใช้ทุกคน → `map(toPublicUser)` |
| 39-41 | `findRoleByName` — หา role จากชื่อ |
| 43-45 | `findByPsuId` — `findUnique` ด้วย `psu_passport_id` (ใช้เช็คซ้ำตอนสร้าง) |
| 47-50 | `create(data)` |
| 53-59 | `findById` — `Number(id)` แปลงจาก string ใน URL |
| 62-69 | `updateRole(id, role_id)` |
| 74-81 | `revokeAccess(id, closedBy)` — **ไม่ลบแถว** (กัน FK พังจากประวัติที่เคยสร้าง) แต่ตั้ง `password_hash: null` (login ไม่ได้), `must_change_password: true`, `closed_at: now`, `closed_by` = คนกดปิด |
| 85-92 | `setPassword(id, hash)` — ตั้งรหัสชั่วคราวใหม่ + `must_change_password: true` และ **ล้าง `closed_at/closed_by` = เปิดบัญชีคืน** |
| 99-107 | `countLinkedHistory(id)` — นับประวัติผูกอยู่: รอบที่สร้าง (`created_by`), ข่าวที่โพสต์ (`posted_by`), log การตรวจ (`reviewer_id`) ด้วย `Promise.all` (นับพร้อมกัน ไม่รอทีละอัน) คืน `{rounds, news, reviewLogs, total}`. ไม่นับ `exam_results.confirmed_by` เพราะ FK เป็น `SET NULL` |
| 111-113 | `remove(id)` — ลบจริง (controller เรียกได้เมื่อ `total = 0` เท่านั้น) |

**ทำไมต้องนับเองก่อนลบ:** FK ทุกตัวตั้ง `ON DELETE RESTRICT` ซึ่ง Postgres ตอบ SQLSTATE `23001` ไม่ใช่ `23503` → Prisma ไม่แปลงเป็น `P2003` → หลุดเป็น 500

---

## `users.controller.js` (292 บรรทัด)

### `getAll` (บรรทัด 7-14)
ส่ง `UserRepo.findAll()` ทั้งหมด

### `create` (19-103) — `POST /api/users`
| บรรทัด | ทำอะไร |
|---|---|
| 17 | `CREATABLE_ROLES = ["officer","executive","reviewer"]` — 3 role ที่ officer สร้างให้ได้ ไม่มีสมัครเอง (กันปลอมตัว) |
| 21-29 | destructuring field จาก body |
| 34 | `contactRequired = role_name !== "executive"` — ผู้บริหารไม่ต้องกรอกอีเมล/เบอร์ |
| 35-46 | ขาด field ที่จำเป็นอย่างใดอย่างหนึ่ง → 400 "กรุณากรอกข้อมูลให้ครบ" |
| 49-53 | ทุกช่องต้องเป็น string (`.some(v => typeof v !== "string")`) — ส่งตัวเลข/object มา bcrypt/Prisma พังเป็น 500 |
| 55-61 | role ต้องอยู่ใน `CREATABLE_ROLES` |
| 63-69 | รหัสผ่านยาว ≥ 8 |
| 71-76 | `findByPsuId` ซ้ำ → 409 |
| 78-83 | หา role จริงใน DB |
| 85-97 | `create`: `password_hash` = `bcrypt.hash(password, 10)`, **`must_change_password: true`** (รหัสที่ตั้งให้เป็นรหัสชั่วคราว), **`created_by: req.user.userId`** (จาก JWT ไม่เชื่อ body), email/phone ว่าง → `null` ไม่ใช่สตริงว่าง |
| 99 | ตอบ `201 Created` |

### `updateRole` (105-162) — `POST /api/users/:id/role`
| ด่านตรวจ | ผลถ้าไม่ผ่าน |
|---|---|
| ไม่ส่ง `role_name` | 400 |
| role ไม่อยู่ใน `ASSIGNABLE_ROLES` (officer/executive/reviewer) | 400 |
| id ไม่ใช่จำนวนเต็ม | 400 |
| `targetId === req.user.userId` (เปลี่ยนของตัวเอง) | 400 — กันลดสิทธิ์ตัวเองจนล็อกตัวเองออก |
| ไม่พบผู้ใช้ | 404 |
| ผู้ใช้เป็น `student` | 400 — แถวใน `students` ยังอยู่และนับในสถิติรุ่น ให้สร้างบัญชีใหม่แทน |
| หา role ไม่เจอ | 400 |
ผ่านหมด → `UserRepo.updateRole`

### `revokeAccess` (164-192) — `POST /api/users/:id/revoke`
ตรวจ id (400) → ห้ามถอนสิทธิ์ตัวเอง (400) → หา target (404) → `UserRepo.revokeAccess(targetId, req.user.userId)` (บันทึกว่าใครปิด)

### `resetPassword` (194-240) — `POST /api/users/:id/reset-password`
ตรวจ id → `new_password` ต้องเป็น string ไม่ว่าง ≥ 8 ตัว → หา target → `setPassword(id, bcrypt.hash(...))` ตอบข้อความว่าผู้ใช้ต้องเปลี่ยนรหัสตอน login ครั้งถัดไป (ยังใช้เปิดบัญชีที่เคยถูกถอนสิทธิ์คืนได้ด้วย)

### `deleteUser` (242-292) — `DELETE /api/users/:id`
| บรรทัด | ทำอะไร |
|---|---|
| 242-243 | `HISTORY_BLOCKED_MSG` ข้อความเดียวใช้ 2 จุด |
| 249-260 | ตรวจ id, ห้ามลบตัวเอง, หา target (404) |
| 272-277 | `countLinkedHistory` — `total > 0` → 409 แนะนำให้ใช้ "ถอนสิทธิ์" แทน |
| 279-280 | `remove` ลบจริง |
| 281-292 | `catch` — **กัน race condition** (มีคนสร้างประวัติผูกระหว่างนับกับลบ): ถ้า error เป็น `P2003` หรือข้อความตรง regex `/restrict.*foreign key constraint/i` ให้ตั้ง `err.statusCode = 409` และ `err.message` เป็นข้อความไทย แล้ว `next(err)` |

> **ถอนสิทธิ์ vs ลบ vs รีเซ็ตรหัส:** ถอนสิทธิ์ = ล็อกถาวร (เก็บประวัติ); ลบ = ลบแถวจริง ได้เฉพาะบัญชีที่ไม่เคยมีประวัติ; รีเซ็ตรหัส = ตั้งรหัสชั่วคราวใหม่ + เปิดบัญชีคืน
