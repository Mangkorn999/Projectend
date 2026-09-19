# Reviewer Role + Review Audit Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `reviewer` account role that can approve/reject exam results (a pooled queue, shared with `officer`) but cannot see dashboard stats or manage rounds/subjects/users/news — so the single officer can get help clearing a 200+ student review backlog — plus an audit trail of every review action and a fix for two reviewers accidentally overwriting each other's review of the same paper.

**Architecture:** Reuse existing components/endpoints wherever the permission boundary allows (the review queue page, the student-detail page, the account-management page); widen `requireRole(...)` allowlists rather than duplicating routes; add one new table (`review_logs`) for the audit trail.

**Tech Stack:** Node.js + Express + Prisma (Postgres) backend, plain React (no router library, hand-rolled `page` state) frontend. No test framework — this project tests the backend with hand-written smoke scripts under `backend/tests/` that hit the running server over HTTP, and tests the frontend by hand in the browser. This plan follows that same pattern rather than introducing a new one.

**Spec:** `docs/superpowers/specs/2026-09-19-reviewer-role-design.md` — read it alongside this plan. This plan is the "how", the spec is the "why"; where they'd ever conflict, the corrections made directly in the spec file (search it for "เช็คแล้ว" / "ผลข้างเคียงที่ยอมรับ") are the current truth.

## Global Constraints

- **Beginner-friendly syntax.** The repo owner is new to programming and has to defend this code himself. Prefer explicit, readable code over compressed one-liners or clever chaining — this repo's own convention (see `backend/SYNTAX_NOTES.md`) is short functions with a comment explaining *why*, not *what*. Every step below already writes code in that style; match it, don't "improve" it into denser JS.
- **Any Prisma/JS pattern not already explained in `backend/SYNTAX_NOTES.md` must get a paired short/long example added there in the same task that introduces it.** This plan only introduces one such pattern (`updateMany` used as an optimistic guard) — Task 9 adds it.
- **No new npm packages.** Everything needed already exists in `package.json` (`bcryptjs`, `express`, `@prisma/client`).
- **`db push`, not `migrate dev`.** This project's dev database has never had a real Prisma migration history (documented in `backend/BACKEND_GUIDE.md`'s 2026-09-17 changelog entry) — it has only ever been synced with `prisma db push`. Running `migrate dev` now would try to reconcile years of undocumented drift that has nothing to do with this feature. Keep using `db push`, same as every prior schema change in this repo.
- **Every backend route change is a one-line edit to an existing `requireRole(...)` call.** No new Express routes are created anywhere in this plan.

---

## Task 1: `review_logs` table

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma model `ReviewLog` with fields `log_id, result_id, reviewer_id, action, remark, created_at` and relations `exam_result` (→ `ExamResult`), `reviewer` (→ `User`). Later tasks write to this table through `prisma.reviewLog.create(...)`.

- [ ] **Step 1: Add the `ReviewLog` model**

Open `backend/prisma/schema.prisma`. Find the `ExamResult` model — it ends at line 124 with `@@map("exam_results")` and a closing `}`. Right after that closing `}` (and its blank line), insert:

```prisma
model ReviewLog {
  log_id      Int        @id @default(autoincrement())
  result_id   Int
  reviewer_id Int
  // "approved" | "rejected" — เก็บเป็น string เหมือน exam_results.staff_status ในไฟล์นี้ทำมาแบบนี้ทุกตาราง
  action      String     @db.VarChar(20)
  // สำเนา remark ตอนตรวจครั้งนั้น (ถ้ามี) — แยกจาก exam_results.remark ที่ถูกทับได้ทุกครั้งที่ตรวจซ้ำ
  remark      String?    @db.Text
  created_at  DateTime   @default(now())
  exam_result ExamResult @relation(fields: [result_id], references: [result_id])
  reviewer    User       @relation(fields: [reviewer_id], references: [user_id])

  @@map("review_logs")
}
```

- [ ] **Step 2: Wire the relation into `ExamResult`**

Same file — inside `model ExamResult { ... }`, find the line `subject_results SubjectResult[]` (line 121). Add a new line right after it:

```prisma
  subject_results SubjectResult[]
  review_logs     ReviewLog[]
```

- [ ] **Step 3: Wire the relation into `User`**

Find `model User { ... }`. It already has this line (around line 33):

```prisma
  confirmed_exams ExamResult[]      @relation("UserToExamResult")
```

Add a new line right after it:

```prisma
  confirmed_exams ExamResult[]      @relation("UserToExamResult")
  review_logs     ReviewLog[]
```

- [ ] **Step 4: Push the schema to the dev database**

Run:

```bash
cd backend
npx prisma db push
```

Expected output ends with something like `Your database is now in sync with your Prisma schema.` and `✔ Generated Prisma Client`. If it instead prints a warning about data loss or asks for confirmation, stop and read it carefully before continuing — that would mean something unrelated in the schema drifted; do not blindly accept.

- [ ] **Step 5: Verify the table is real and usable, then throw the check away**

Create a throwaway file `backend/tests/_verify-review-logs.mjs`:

```js
// throwaway — delete after running once, not part of the test suite
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const anyExamResult = await prisma.examResult.findFirst();
const anyUser = await prisma.user.findFirst();
if (!anyExamResult || !anyUser) {
  console.log("SKIP: no exam_result/user rows in db yet, run seed first");
  process.exit(0);
}

const row = await prisma.reviewLog.create({
  data: {
    result_id: anyExamResult.result_id,
    reviewer_id: anyUser.user_id,
    action: "approved",
    remark: null,
  },
});
console.log("created review_log row:", row);

await prisma.reviewLog.delete({ where: { log_id: row.log_id } });
console.log("cleaned up — PASS");
await prisma.$disconnect();
```

Run it: `node tests/_verify-review-logs.mjs` (from `backend/`). Expected: prints the created row, then `cleaned up — PASS`.

- [ ] **Step 6: Delete the throwaway file and commit**

```bash
rm backend/tests/_verify-review-logs.mjs
git add backend/prisma/schema.prisma
git commit -m "$(cat <<'EOF'
feat(schema): add review_logs table for review audit trail

Insert-only log of every approve/reject action, separate from
exam_results.confirmed_by/confirmed_at which gets overwritten every
time a paper is re-reviewed (rejected, resubmitted, approved by
someone else). Foundation for the reviewer role's audit requirement.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `reviewer` role can be created and reaches the right endpoints

**Files:**
- Modify: `backend/prisma/seed.js:62-66`
- Modify: `backend/src/modules/users/users.controller.js:17` (`CREATABLE_ROLES`), `:95` (`ASSIGNABLE_ROLES`)
- Modify: `backend/src/modules/examResults/examResults.routes.js:27-29`
- Modify: `backend/src/modules/students/students.routes.js:25-26`
- Test: `backend/tests/smoke-phase15-reviewer.mjs` (created here, extended in later tasks)

**Interfaces:**
- Consumes: nothing new.
- Produces: a `reviewer` role row queryable via `UserRepo.findRoleByName("reviewer")` (existing function, already used by `create`/`updateRole` in `users.controller.js`). `POST /api/users` and `POST /api/users/:id/role` now accept `role_name: "reviewer"`.

- [ ] **Step 1: Add the role to the seed data**

In `backend/prisma/seed.js`, find (around line 62):

```js
  const roleData = [
    { role_name: "student", description: "นักศึกษา" },
    { role_name: "officer", description: "เจ้าหน้าที่คณะ" },
    { role_name: "executive", description: "ผู้บริหารคณะ" },
  ];
```

Change to:

```js
  const roleData = [
    { role_name: "student", description: "นักศึกษา" },
    { role_name: "officer", description: "เจ้าหน้าที่คณะ" },
    { role_name: "executive", description: "ผู้บริหารคณะ" },
    { role_name: "reviewer", description: "เจ้าหน้าที่ตรวจสอบ" },
  ];
```

- [ ] **Step 2: Re-seed and confirm the role exists**

```bash
cd backend
npm run seed
```

(if there's no `seed` script, run `node prisma/seed.js` directly — check `package.json`'s `"prisma": { "seed": ... }` block, that's what `npx prisma db seed` calls). Expected: seed script finishes without error, prints its usual "created X roles" style output.

- [ ] **Step 3: Widen `CREATABLE_ROLES` and `ASSIGNABLE_ROLES`**

In `backend/src/modules/users/users.controller.js`, line 17:

```js
const CREATABLE_ROLES = ["officer", "executive"];
```

→

```js
const CREATABLE_ROLES = ["officer", "executive", "reviewer"];
```

And line 95:

```js
const ASSIGNABLE_ROLES = ["student", "officer", "executive"];
```

→

```js
const ASSIGNABLE_ROLES = ["student", "officer", "executive", "reviewer"];
```

- [ ] **Step 4: Open up the exam-results routes**

In `backend/src/modules/examResults/examResults.routes.js`, lines 27-29 currently read:

```js
router.get("/", authenticate, requireRole("officer"), getAll);
router.patch("/:id/approve", authenticate, requireRole("officer"), approve);
router.patch("/:id/reject", authenticate, requireRole("officer"), reject);
```

Change to:

```js
router.get("/", authenticate, requireRole("officer", "reviewer"), getAll);
router.patch("/:id/approve", authenticate, requireRole("officer", "reviewer"), approve);
router.patch("/:id/reject", authenticate, requireRole("officer", "reviewer"), reject);
```

- [ ] **Step 5: Open up the two students routes reviewer needs**

In `backend/src/modules/students/students.routes.js`, line 25:

```js
router.get("/", authenticate, requireRole("officer"), getAll);
```

→

```js
router.get("/", authenticate, requireRole("officer", "reviewer"), getAll);
```

And line 26:

```js
router.get("/:id", authenticate, requireRole("officer", "student"), getById); // student เช็ค ownership ต่อใน controller
```

→

```js
router.get("/:id", authenticate, requireRole("officer", "student", "reviewer"), getById); // student เช็ค ownership ต่อใน controller
```

Everything else in that file (`POST /`, `POST /complete-profile`, `PATCH /bulk-eligible`, `POST /import`, `POST /:id/reset-password`, `DELETE /:id`, `PATCH /:id`) stays `requireRole("officer")` only — do not touch those lines.

- [ ] **Step 6: Write the smoke test file and run it**

Create `backend/tests/smoke-phase15-reviewer.mjs`. Copy the `call`/`check` helpers verbatim from `backend/tests/smoke-phase12-reject-edit.mjs` (lines 1-36 of that file) — same pattern, same project convention:

```js
// Reviewer role: can be created, reaches the review queue endpoints, cannot
// reach dashboard/rounds/subjects/users/news-management endpoints.
// Needs the backend running on localhost:3000, and the db reseeded with the
// "reviewer" role (Task 2, Step 1-2 of this plan) before this will pass.
const BASE = "http://localhost:3000";
let failures = 0;

const call = async (method, url, { token, body } = {}) => {
  const headers = {};
  if (token) headers.Cookie = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  let cookie = null;
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return { status: res.status, json, cookie };
};

const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
};

const STAMP = Date.now().toString().slice(-8);
const REVIEWER_USERNAME = `reviewer_${STAMP}`;

const main = async () => {
  const officer = await call("POST", "/api/auth/login", {
    body: { psu_passport_id: "456", password: "456" },
  });
  const oToken = officer.cookie;
  if (!oToken) { console.log("officer login failed:", JSON.stringify(officer.json)); process.exit(1); }

  // ---- officer creates a reviewer account ----
  const created = await call("POST", "/api/users", {
    token: oToken,
    body: {
      psu_passport_id: REVIEWER_USERNAME,
      password: "reviewerpass123",
      role_name: "reviewer",
      first_name: "ทดสอบ",
      last_name: "ผู้ตรวจ",
      email: `${REVIEWER_USERNAME}@test.local`,
      phone: "0800000000",
    },
  });
  check("create reviewer account -> 201", created.status, 201);

  // ---- reviewer logs in (temp password, must change first) ----
  const firstLogin = await call("POST", "/api/auth/login", {
    body: { psu_passport_id: REVIEWER_USERNAME, password: "reviewerpass123" },
  });
  check("reviewer first login -> must_change_password", firstLogin.json?.must_change_password, true);

  const newPassword = "reviewerpass456";
  const changed = await call("PATCH", "/api/auth/password", {
    token: firstLogin.cookie,
    body: { current_password: "reviewerpass123", new_password: newPassword },
  });
  check("reviewer changes password -> 200", changed.status, 200);

  const rLogin = await call("POST", "/api/auth/login", {
    body: { psu_passport_id: REVIEWER_USERNAME, password: newPassword },
  });
  const rToken = rLogin.cookie;
  if (!rToken) { console.log("reviewer login failed:", JSON.stringify(rLogin.json)); process.exit(1); }

  // ---- reviewer CAN reach the review queue ----
  check("reviewer GET /exam-results -> 200", (await call("GET", "/api/exam-results", { token: rToken })).status, 200);
  check("reviewer GET /students -> 200", (await call("GET", "/api/students", { token: rToken })).status, 200);

  // ---- reviewer CANNOT reach officer-only management endpoints ----
  check("reviewer GET /dashboard/stats -> 403", (await call("GET", "/api/dashboard/stats", { token: rToken })).status, 403);
  check("reviewer GET /rounds -> 403", (await call("GET", "/api/rounds", { token: rToken })).status, 403);
  check("reviewer POST /students/import -> 403", (await call("POST", "/api/students/import", { token: rToken })).status, 403);
  check("reviewer PATCH /students/bulk-eligible -> 403", (await call("PATCH", "/api/students/bulk-eligible", { token: rToken })).status, 403);
  check("reviewer GET /users -> 403", (await call("GET", "/api/users", { token: rToken })).status, 403);

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
};

main();
```

(Confirmed against `backend/src/modules/auth/auth.routes.js:22` and `authController.js:104-113`: the route is `PATCH /api/auth/password`, and it requires **both** `current_password` and `new_password` in the body — not just the new one. The snippet above already uses the right method/body.)

Run the backend server in one terminal (`cd backend && npm start`), then in another:

```bash
cd backend
node tests/smoke-phase15-reviewer.mjs
```

Expected right now: **fails** on the 403 checks for `/exam-results` and `/students` would actually now be 200 (good, that's Steps 3-5 working) but if you run this file before Steps 3-5 are done, the create/login checks would fail instead. Run it now, after Steps 1-5 above, and expect `ALL PASSED`.

- [ ] **Step 7: Add the new file to the test suite runner**

In `backend/package.json`, find the `"test"` script:

```json
"test": "node tests/smoke-phase1-3.mjs && node tests/smoke-phase4-6.mjs && node tests/smoke-phase9-import.mjs && node tests/smoke-phase10-round-subjects.mjs && node tests/smoke-phase11-carry-forward.mjs && node tests/smoke-phase12-reject-edit.mjs && node tests/smoke-phase13-duplicate-round.mjs && node tests/smoke-phase14-news-scope.mjs",
```

Append ` && node tests/smoke-phase15-reviewer.mjs` to the end of that string (inside the same quotes).

- [ ] **Step 8: Commit**

```bash
git add backend/prisma/seed.js backend/src/modules/users/users.controller.js \
  backend/src/modules/examResults/examResults.routes.js \
  backend/src/modules/students/students.routes.js \
  backend/tests/smoke-phase15-reviewer.mjs backend/package.json
git commit -m "$(cat <<'EOF'
feat(auth): add reviewer role with access to the review queue only

Officer creates the account (POST /api/users, same flow as
officer/executive), reviewer reaches GET/approve/reject on
exam-results and GET on students (needed to build the review queue's
"not started" tab), and is blocked everywhere else (dashboard, rounds,
subjects, users, news management, student import/bulk-eligible) by
the existing requireRole() checks, untouched.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Stop two reviewers from overwriting each other's review of the same paper

**Files:**
- Modify: `backend/src/modules/examResults/examResults.repository.js:102-113`
- Modify: `backend/src/modules/examResults/examResults.controller.js:154-196`
- Test: `backend/tests/smoke-phase15-reviewer.mjs` (append)

**Interfaces:**
- Produces: `examRepo.updateStaffStatusIfSubmitted(result_id, { staff_status, remark, confirmed_by })` → `Promise<{ count: number }>`. `count === 0` means someone else already changed this paper's status since it was last read — the caller must treat that as a 409, not as success.

This bug already exists today with a single `officer` role (two officer browser tabs, or two officers, reviewing the same paper) — it just gets more likely once a second role shares the same queue. Fixing it is not reviewer-specific, but it's in scope here because the reviewer feature is what makes it likely enough to matter.

- [ ] **Step 1: Add a failing check to the smoke test**

Open `backend/tests/smoke-phase15-reviewer.mjs`. Before the final `console.log(failures ...)` line, add a new block. This needs a real exam result in `submitted` status to try to double-review, so it needs the same student-creation + round-opening dance as `smoke-phase12-reject-edit.mjs`. Add these imports at the top of the file (alongside the existing const declarations):

```js
import { cleanupYears } from "./cleanupYears.mjs";
```

Add this block right before `console.log(failures ? ...)`:

```js
// ---- two reviewers cannot both win reviewing the same paper ----
const YEAR = 2596; // clear of every other smoke test's fake year
const guardStamp = Date.now().toString().slice(-8);
const guardStudentId = `${String(YEAR - 4).slice(-2)}${guardStamp}`;
const guardNationalId = `1${guardStamp}00000`.slice(0, 13);

let guardRoundId = null;
try {
  const subjectIds = (await call("GET", "/api/subjects", { token: oToken })).json.data.map((s) => s.subject_id);
  const rooms = (await call("GET", "/api/rooms", { token: oToken })).json.data;

  const roundRes = await call("POST", "/api/rounds", {
    token: oToken,
    body: { academic_year: YEAR, attempt_number: 1, open_date: "2020-01-01", close_date: "2099-12-31", subject_ids: subjectIds },
  });
  guardRoundId = roundRes.json.data.round_id;
  await call("PUT", `/api/rounds/${guardRoundId}`, { token: oToken, body: { status: "open" } });

  await call("POST", "/api/students", { token: oToken, body: { student_id: guardStudentId, national_id: guardNationalId } });
  const guardLogin = await call("POST", "/api/auth/login", { body: { psu_passport_id: guardStudentId, password: guardNationalId } });
  await call("POST", "/api/students/complete-profile", {
    token: guardLogin.cookie,
    body: { first_name: "กัน", last_name: "ชน", first_name_en: "Guard", last_name_en: "Test", email: `${guardStudentId}@test.local`, phone: "0800000000", room_id: rooms[0].room_id },
  });
  await call("PATCH", "/api/students/bulk-eligible", { token: oToken, body: { student_ids: [guardStudentId], exam_eligible: true } });

  const submitRes = await call("POST", "/api/exam-results", {
    token: guardLogin.cookie,
    body: { subject_results: subjectIds.map((id) => ({ subject_id: id, is_passed: true })) },
  });
  const guardResultId = submitRes.json.data.result_id;

  // two reviewers race to review the same submitted paper
  const firstReview = await call("PATCH", `/api/exam-results/${guardResultId}/approve`, { token: oToken });
  check("first reviewer approves -> 200", firstReview.status, 200);

  const secondReview = await call("PATCH", `/api/exam-results/${guardResultId}/reject`, {
    token: rToken, body: { remark: "สาย 1 วินาที" },
  });
  check("second reviewer (too late) -> 409", secondReview.status, 409);

  const finalState = await call("GET", "/api/exam-results", { token: oToken, });
  const finalPaper = finalState.json.data.find((r) => r.result_id === guardResultId);
  check("paper stayed approved, not overwritten to rejected", finalPaper?.staff_status, "approved");
} finally {
  if (guardRoundId) await call("PUT", `/api/rounds/${guardRoundId}`, { token: oToken, body: { status: "closed" } });
  await cleanupYears([YEAR]);
}
```

- [ ] **Step 2: Run it and confirm it fails the way you expect**

```bash
node tests/smoke-phase15-reviewer.mjs
```

Expected: `first reviewer approves -> 200` passes, but `second reviewer (too late) -> 409` **fails** (actual status will be 200 — the bug) and `paper stayed approved, not overwritten to rejected` fails too (actual will be `"rejected"`). That's the bug this task fixes — confirm you see exactly this failure pattern before moving on, not some other error.

- [ ] **Step 3: Add the guarded update to the repository**

In `backend/src/modules/examResults/examResults.repository.js`, find (lines 102-113):

```js
// เจ้าหน้าที่ยืนยัน/ตีกลับ — บันทึกคนกดและเวลาไว้ด้วย
export const updateStaffStatus = (result_id, { staff_status, remark, confirmed_by }) =>
  prisma.examResult.update({
    where: { result_id: Number(result_id) },
    data: {
      staff_status,
      remark: remark ?? null,
      confirmed_by,
      confirmed_at: new Date(),
    },
    include: { ...withDetails, student: studentSafeSelect },
  });
```

Replace it with (keep the old function — nothing else calls it, but removing it isn't this task's job; add the new one alongside):

```js
// เจ้าหน้าที่ยืนยัน/ตีกลับ — บันทึกคนกดและเวลาไว้ด้วย
export const updateStaffStatus = (result_id, { staff_status, remark, confirmed_by }) =>
  prisma.examResult.update({
    where: { result_id: Number(result_id) },
    data: {
      staff_status,
      remark: remark ?? null,
      confirmed_by,
      confirmed_at: new Date(),
    },
    include: { ...withDetails, student: studentSafeSelect },
  });

// เหมือน updateStaffStatus ข้างบน แต่เช็คก่อนว่าใบนี้ยังเป็น "submitted" อยู่จริงตอน update
// (ดู SYNTAX_NOTES.md หัวข้อ "updateMany — เช็คก่อนว่าอัปเดตจริงกี่แถว" สำหรับคำอธิบายเต็ม)
//
// update() ปกติ (ด้านบน) ใส่เงื่อนไข staff_status ใน where ไม่ได้ เพราะ where ของ update()
// ต้องเป็น unique field ล้วนๆ (result_id เท่านั้น) — updateMany() ใส่เงื่อนไขอะไรก็ได้ใน where
// และคืนค่า { count } บอกว่าจริงๆ อัปเดตไปกี่แถว ใช้เช็คได้ว่า "มีคนแก้ไปแล้วหรือยัง"
export const updateStaffStatusIfSubmitted = (result_id, { staff_status, remark, confirmed_by }) =>
  prisma.examResult.updateMany({
    where: {
      result_id: Number(result_id),
      staff_status: "submitted", // เงื่อนไขกันชน — ถ้าใบนี้ถูกตรวจไปแล้ว (ไม่ใช่ submitted อีกต่อไป) count จะเป็น 0
    },
    data: {
      staff_status,
      remark: remark ?? null,
      confirmed_by,
      confirmed_at: new Date(),
    },
  });
```

- [ ] **Step 4: Use the guarded version in the controller**

In `backend/src/modules/examResults/examResults.controller.js`, find `reviewExamResult` (lines 154-196):

```js
const reviewExamResult = async (req, res, next, { staff_status, requireRemark }) => {
  try {
    const existing = await examRepo.findById(req.params.id);
    if (!existing) throw httpError("ไม่พบผลสอบที่ระบุ", 404);

    const remark = req.body?.remark?.trim();
    if (requireRemark && !remark) {
      throw httpError("ต้องระบุเหตุผลที่ตีกลับ (remark)", 400);
    }

    // ตอนตีกลับ (requireRemark = true) remark ผ่านการเช็คข้างบนแล้วว่าไม่ว่าง
    // ตอนยืนยัน เจ้าหน้าที่จะใส่ remark มาหรือไม่ก็ได้ — ไม่ใส่มาเลยให้เก็บ null ลง DB
    let remarkToSave = remark;
    if (remarkToSave === undefined || remarkToSave === null) {
      remarkToSave = null;
    }

    const result = await examRepo.updateStaffStatus(req.params.id, {
      staff_status,
      remark: remarkToSave,
      confirmed_by: req.user.userId, // อ่านจาก JWT เท่านั้น
    });

    // แจ้งเตือนนักศึกษาเจ้าของผลสอบ — ยิงแบบ fire-and-forget ไม่ให้ล้มการยืนยัน/ตีกลับถ้าแจ้งเตือนพลาด
    const roundLabel = `รอบ ${existing.round.attempt_number}/${existing.round.academic_year}`;
    // ข้อความแจ้งเตือนต่างกันตามว่าเจ้าหน้าที่กดยืนยันหรือกดตีกลับ
    let message;
    if (staff_status === "approved") {
      message = `ผลสอบ${roundLabel}ได้รับการยืนยันแล้ว`;
    } else {
      // \n = ขึ้นบรรทัดใหม่ ฝั่งหน้าเว็บเอาบรรทัดที่ 2 ไปโชว์เป็นตัวเล็กใต้หัวข้อ
      message = `ผลสอบ${roundLabel}ถูกตีกลับ: ${remark}\nกรุณากรอกผลสอบของท่านใหม่อีกครั้ง`;
    }
    notifRepo
      .create({ student_id: existing.student_id, type: staff_status, message })
      .catch((e) => console.error("สร้างแจ้งเตือนไม่สำเร็จ:", e.message));

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
```

Replace with:

```js
const reviewExamResult = async (req, res, next, { staff_status, requireRemark }) => {
  try {
    const existing = await examRepo.findById(req.params.id);
    if (!existing) throw httpError("ไม่พบผลสอบที่ระบุ", 404);

    // เช็คสถานะตั้งแต่ตรงนี้ — ให้ error message ที่อ่านง่าย ก่อนจะไปเจอ count 0 แบบไม่รู้สาเหตุ
    if (existing.staff_status !== "submitted") {
      throw httpError("ใบนี้ถูกตรวจไปแล้ว กรุณารีเฟรชหน้า", 409);
    }

    const remark = req.body?.remark?.trim();
    if (requireRemark && !remark) {
      throw httpError("ต้องระบุเหตุผลที่ตีกลับ (remark)", 400);
    }

    // ตอนตีกลับ (requireRemark = true) remark ผ่านการเช็คข้างบนแล้วว่าไม่ว่าง
    // ตอนยืนยัน เจ้าหน้าที่จะใส่ remark มาหรือไม่ก็ได้ — ไม่ใส่มาเลยให้เก็บ null ลง DB
    let remarkToSave = remark;
    if (remarkToSave === undefined || remarkToSave === null) {
      remarkToSave = null;
    }

    // updateMany แทน update ธรรมดา — เช็คในตัวว่าใบนี้ยังเป็น "submitted" อยู่จริง ณ วินาทีที่เขียน DB
    // (ไม่ใช่แค่ตอนอ่าน existing ด้านบน) กันเคส 2 คนกดพร้อมกันแล้วคนหลังทับคนแรกเงียบๆ
    const { count } = await examRepo.updateStaffStatusIfSubmitted(req.params.id, {
      staff_status,
      remark: remarkToSave,
      confirmed_by: req.user.userId, // อ่านจาก JWT เท่านั้น
    });
    if (count === 0) {
      // แพ้ race แม้เช็คตอนต้นฟังก์ชันผ่านมาแล้ว — มีคนตรวจแทรกเข้ามาพอดีระหว่างนี้
      throw httpError("ใบนี้ถูกตรวจไปแล้ว กรุณารีเฟรชหน้า", 409);
    }
    const result = await examRepo.findById(req.params.id); // ดึงค่าล่าสุดที่เพิ่งเขียนไปตอบ response

    // แจ้งเตือนนักศึกษาเจ้าของผลสอบ — ยิงแบบ fire-and-forget ไม่ให้ล้มการยืนยัน/ตีกลับถ้าแจ้งเตือนพลาด
    const roundLabel = `รอบ ${existing.round.attempt_number}/${existing.round.academic_year}`;
    // ข้อความแจ้งเตือนต่างกันตามว่าเจ้าหน้าที่กดยืนยันหรือกดตีกลับ
    let message;
    if (staff_status === "approved") {
      message = `ผลสอบ${roundLabel}ได้รับการยืนยันแล้ว`;
    } else {
      // \n = ขึ้นบรรทัดใหม่ ฝั่งหน้าเว็บเอาบรรทัดที่ 2 ไปโชว์เป็นตัวเล็กใต้หัวข้อ
      message = `ผลสอบ${roundLabel}ถูกตีกลับ: ${remark}\nกรุณากรอกผลสอบของท่านใหม่อีกครั้ง`;
    }
    notifRepo
      .create({ student_id: existing.student_id, type: staff_status, message })
      .catch((e) => console.error("สร้างแจ้งเตือนไม่สำเร็จ:", e.message));

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 5: Run the smoke test again, expect it to pass now**

```bash
node tests/smoke-phase15-reviewer.mjs
```

Expected: `ALL PASSED`.

- [ ] **Step 6: Run the full suite to check for regressions**

```bash
npm run seed && npm test
```

`smoke-phase12-reject-edit.mjs` exercises approve/reject/resubmit heavily — confirm it still passes unchanged (the new status check should never trigger for the single-actor flows it tests, since nothing else is racing there).

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/examResults/examResults.repository.js \
  backend/src/modules/examResults/examResults.controller.js \
  backend/tests/smoke-phase15-reviewer.mjs
git commit -m "$(cat <<'EOF'
fix(examResults): reject double-review of the same paper with 409

reviewExamResult wrote staff_status with a plain update() and no
check that the paper was still "submitted" at write time — two
reviewers (or two officer tabs) acting on the same pending paper
within the same window silently overwrote each other, no error on
either side, and the student got two contradictory notifications.
updateMany's where clause now doubles as an optimistic lock: it can
only succeed while staff_status is still "submitted", and the second
writer gets a 409 instead of a silent overwrite.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Audit log write on every approve/reject

**Files:**
- Create: `backend/src/modules/reviewLogs/reviewLogs.repository.js`
- Modify: `backend/src/modules/examResults/examResults.controller.js` (inside `reviewExamResult`, right after Task 3's guard)
- Modify: `backend/tests/cleanupYears.mjs`
- Test: `backend/tests/smoke-phase15-reviewer.mjs` (append)

**Interfaces:**
- Consumes: `examRepo.updateStaffStatusIfSubmitted` result from Task 3 (specifically, only runs when `count > 0`).
- Produces: `reviewLogRepo.create({ result_id, reviewer_id, action, remark })` → `Promise<ReviewLog>`. Nothing later in this plan consumes this directly (no read endpoint yet — see spec's Out of scope), but it's what a future workload-summary feature would query.

- [ ] **Step 1: Create the repository file**

```js
// backend/src/modules/reviewLogs/reviewLogs.repository.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// บันทึกทุกครั้งที่มีคนตรวจ (approve/reject) — insert อย่างเดียว ไม่มี update/delete
// ต่างจาก exam_results.confirmed_by ที่ถูกทับทุกครั้งที่ตรวจซ้ำ ตารางนี้เก็บประวัติทุกครั้งไว้ครบ
export const create = ({ result_id, reviewer_id, action, remark }) =>
  prisma.reviewLog.create({
    data: { result_id, reviewer_id, action, remark: remark ?? null },
  });
```

- [ ] **Step 2: Call it from the controller**

In `backend/src/modules/examResults/examResults.controller.js`, add the import at the top (alongside the other repository imports, after `import * as notifRepo from "../notifications/notifications.repository.js";`):

```js
import * as reviewLogRepo from "../reviewLogs/reviewLogs.repository.js";
```

Inside `reviewExamResult`, right after the `count === 0` check from Task 3 and its closing `}`, and before `const result = await examRepo.findById(...)`, add:

```js
    if (count === 0) {
      throw httpError("ใบนี้ถูกตรวจไปแล้ว กรุณารีเฟรชหน้า", 409);
    }

    // การตรวจสำเร็จแล้ว (DB commit ผ่าน) — insert log พลาดไม่ควรทำให้ request นี้ error
    // (จะทำให้เจ้าหน้าที่เห็นว่าตัวเอง "ตรวจไม่สำเร็จ" ทั้งที่จริงสำเร็จแล้ว) log error ไว้ฝั่ง server แทน
    try {
      await reviewLogRepo.create({
        result_id: Number(req.params.id),
        reviewer_id: req.user.userId,
        action: staff_status,
        remark: remarkToSave,
      });
    } catch (e) {
      console.error("บันทึก review_logs ไม่สำเร็จ:", e.message);
    }

    const result = await examRepo.findById(req.params.id); // ดึงค่าล่าสุดที่เพิ่งเขียนไปตอบ response
```

(This replaces the single line `const result = await examRepo.findById(req.params.id);` that Task 3 left in place — same line, now with the log-write block inserted just before it.)

- [ ] **Step 3: Fix `cleanupYears.mjs` before it breaks on a foreign key**

`review_logs.result_id` now references `exam_results.result_id`. `cleanupYears.mjs` deletes exam results directly via Prisma — if any smoke test leaves `review_logs` rows behind pointing at a deleted `exam_result`, the delete will fail with a foreign key error. In `backend/tests/cleanupYears.mjs`, find:

```js
    await prisma.certificate.deleteMany({ where: { result_id: { in: rids } } });
    await prisma.subjectResult.deleteMany({ where: { result_id: { in: rids } } });
    await prisma.examResult.deleteMany({ where: { result_id: { in: rids } } });
```

Add a line before the `examResult.deleteMany` call:

```js
    await prisma.certificate.deleteMany({ where: { result_id: { in: rids } } });
    await prisma.subjectResult.deleteMany({ where: { result_id: { in: rids } } });
    await prisma.reviewLog.deleteMany({ where: { result_id: { in: rids } } });
    await prisma.examResult.deleteMany({ where: { result_id: { in: rids } } });
```

- [ ] **Step 4: Add the audit-log assertion to the smoke test**

In `backend/tests/smoke-phase15-reviewer.mjs`, inside the `try` block added in Task 3, right after the `check("paper stayed approved, not overwritten to rejected", ...)` line, add:

```js
  // audit log has exactly one row — the approve that won, not the rejected attempt that lost
  const logsCheck = await call("GET", "/api/exam-results", { token: oToken }); // sanity: paper still queryable
  check("paper still reachable after guard test", logsCheck.status, 200);
```

This is a light touch-check, not a direct read of `review_logs` (there's no endpoint for that — see spec Out of scope). To actually verify a row landed, add one more disposable Prisma check right before the `finally` block:

```js
  const { PrismaClient } = await import("@prisma/client");
  const prismaCheck = new PrismaClient();
  const logRows = await prismaCheck.reviewLog.findMany({ where: { result_id: guardResultId } });
  check("exactly one review_log row for the winning approve", logRows.length, 1);
  check("  action recorded is 'approved'", logRows[0]?.action, "approved");
  await prismaCheck.$disconnect();
```

- [ ] **Step 5: Run it**

```bash
node tests/smoke-phase15-reviewer.mjs
```

Expected: `ALL PASSED`, including the two new checks.

- [ ] **Step 6: Run the full suite**

```bash
npm run seed && npm test
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/reviewLogs/reviewLogs.repository.js \
  backend/src/modules/examResults/examResults.controller.js \
  backend/tests/cleanupYears.mjs backend/tests/smoke-phase15-reviewer.mjs
git commit -m "$(cat <<'EOF'
feat(examResults): write review_logs on every approve/reject

Insert-only, one row per action — survives a paper being reviewed
multiple times across reject/resubmit cycles by different people,
unlike exam_results.confirmed_by which only ever holds the latest
reviewer. Log write failures are caught and logged server-side rather
than failing the request: the review itself already committed, and
telling the reviewer it failed when it didn't would be worse than a
missed log line.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Reviewer sidebar, routing, and the review-detail page

**Files:**
- Modify: `frontend/src/design/app.jsx` (`NAV`, `DEFAULT_PAGE`, `ROLE_PAGES`, `render()`, the existing `StudentDetailReal` call site)

**Interfaces:**
- Consumes: backend endpoints from Task 2 (`GET/PATCH /api/exam-results`, `GET /api/students`).
- Produces: `canEdit` / `canReview` boolean props on `<StudentDetailReal />` — Task 6 changes that component to read them (this task's edits will look broken/incomplete in isolation because `StudentDetailReal` doesn't accept those props yet; that's expected, Task 6 finishes the wiring).

This task has no automated test — this project has no frontend test suite; every prior frontend change in this repo's history was verified by hand in the browser (see any commit message mentioning "manual browser testing"). Follow that convention: the manual-check step at the end is the test.

- [ ] **Step 1: Add `reviewer` to `NAV`**

In `frontend/src/design/app.jsx`, find the `NAV` object (starts around line 45):

```js
const NAV = (lang, pendingCount)=>({
  student: [],
  officer: [
    ...
  ],
  executive: [
    { k:'dashboard', label:translate(lang,'nav.executive.dashboard'), icon:'grid' },
    { k:'reports', label:translate(lang,'nav.executive.reports'), icon:'report' },
    { k:'manual', label:translate(lang,'nav.executive.manual'), icon:'book' },
  ],
});
```

Add a `reviewer` key right after `executive`:

```js
const NAV = (lang, pendingCount)=>({
  student: [],
  officer: [
    ...
  ],
  executive: [
    { k:'dashboard', label:translate(lang,'nav.executive.dashboard'), icon:'grid' },
    { k:'reports', label:translate(lang,'nav.executive.reports'), icon:'report' },
    { k:'manual', label:translate(lang,'nav.executive.manual'), icon:'book' },
  ],
  reviewer: [
    // key เดิม 'nav.officer.review' ข้อความเดียวกัน ("ตรวจสอบ/ยืนยันผล") ไม่ต้องเพิ่ม key ใหม่
    { k:'review', label:translate(lang,'nav.officer.review'), icon:'checkCircle', badge: pendingCount || null },
  ],
});
```

- [ ] **Step 2: Add `reviewer` to `DEFAULT_PAGE` and `ROLE_PAGES`**

Find:

```js
const DEFAULT_PAGE = { student:'news', officer:'dashboard', executive:'dashboard' };
```

→

```js
const DEFAULT_PAGE = { student:'news', officer:'dashboard', executive:'dashboard', reviewer:'review' };
```

Find:

```js
const ROLE_PAGES = {
  student: ['news', 'formIntro', 'form', 'status', 'history'],
  officer: ['dashboard', 'review', 'students', 'import', 'detail', 'rounds', 'usermgmt', 'newsmgmt', 'reports'],
  executive: ['dashboard', 'reports'],
};
```

→

```js
const ROLE_PAGES = {
  student: ['news', 'formIntro', 'form', 'status', 'history'],
  officer: ['dashboard', 'review', 'students', 'import', 'detail', 'rounds', 'usermgmt', 'newsmgmt', 'reports'],
  executive: ['dashboard', 'reports'],
  reviewer: ['review', 'detail'], // 'detail' ต้องมี — คลิกแถวในคิวตรวจพาไปหน้านั้น
};
```

`NEEDS_SELECTION` already contains `'detail'` — nothing to change there.

- [ ] **Step 3: Add the `canEdit`/`canReview` props at the officer's existing call site**

Find (inside `render()`, `if(role==='officer'){ ... }`):

```js
      if(page==='detail') return <StudentDetailReal student={sel} go={go} toast={showToast} lang={lang} />;
```

→

```js
      if(page==='detail') return <StudentDetailReal student={sel} go={go} toast={showToast} canEdit canReview lang={lang} />;
```

- [ ] **Step 4: Add the `reviewer` block to `render()`**

Find the end of the `if(role==='executive'){ ... }` block (right before `return <Empty title="ไม่พบหน้าที่ต้องการ" />;`):

```js
    if(role==='executive'){
      if(page==='dashboard') return <DashboardReal go={go} readonly lang={lang} />;
      if(page==='reports') return <ReportsReal toast={showToast} readonly lang={lang} />;
      if(page==='manual') return <Empty icon="book" title={translate(lang,'nav.executive.manual')} sub={translate(lang,'common.comingSoon')} />;
    }
    return <Empty title="ไม่พบหน้าที่ต้องการ" />;
```

Add a `reviewer` block between them:

```js
    if(role==='executive'){
      if(page==='dashboard') return <DashboardReal go={go} readonly lang={lang} />;
      if(page==='reports') return <ReportsReal toast={showToast} readonly lang={lang} />;
      if(page==='manual') return <Empty icon="book" title={translate(lang,'nav.executive.manual')} sub={translate(lang,'common.comingSoon')} />;
    }
    // reviewer ใช้หน้าเดียวกับ officer 2 หน้า (คิวตรวจ + รายละเอียด) แค่จำกัดว่าเห็นแค่ 2 หน้านี้ (ROLE_PAGES)
    // และ canEdit=false ที่หน้า detail กันแก้ข้อมูลนักศึกษา (ดู studentDetailReal.jsx)
    if(role==='reviewer'){
      if(page==='review') return <OfficerReviewReal go={go} setSel={setSel} lang={lang} />;
      if(page==='detail') return <StudentDetailReal student={sel} go={go} toast={showToast} canEdit={false} canReview lang={lang} />;
    }
    return <Empty title="ไม่พบหน้าที่ต้องการ" />;
```

- [ ] **Step 5: Manual check — do this after Task 6 is also done, not before**

`StudentDetailReal` doesn't accept `canEdit`/`canReview` yet (that's Task 6), so skip the manual browser check for now and come back to it after Task 6's Step 4.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/design/app.jsx
git commit -m "$(cat <<'EOF'
feat(nav): route reviewer role to the review queue and detail page

Reuses OfficerReviewReal and StudentDetailReal as-is rather than
building new pages — the only permission difference at the frontend
layer is which two pages ROLE_PAGES lists and a canEdit=false on the
detail page (wired up in the next commit).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Split "edit student info" from "review this paper" in the detail page

**Files:**
- Modify: `frontend/src/design/studentDetailReal.jsx`

**Interfaces:**
- Consumes: `canEdit`, `canReview` boolean props from Task 5's call sites.
- Produces: none consumed elsewhere.

- [ ] **Step 1: Update the file header comment**

Find (lines 1-8):

```jsx
/* ============================================================
   เจ้าหน้าที่ / ผู้บริหาร — รายละเอียดผลสอบนักศึกษาคนเดียว (ข้อมูลจริงจาก backend)
   แทนที่ StudentDetail เดิมใน officer.jsx ที่ยังใช้ mock SUBJECTS/STUDENTS
   executive เปิดด้วย readonly=true — ปุ่มยืนยัน/ตีกลับ/แก้ไขข้อมูลจะไม่โชว์ (backend เองก็ block role นี้อยู่แล้วที่ระดับ route)

   โชว์ผลสอบ "ทุกรอบ" ที่นักศึกษาคนนี้เคยส่ง เป็น block คลิกสลับได้ฝั่งขวา (ไม่ใช่แค่รอบล่าสุดแบบเดิม)
   ข้อมูลมีอยู่แล้วจาก /exam-results?student_id=... (ไม่ต้องยิง API เพิ่ม) แค่ไม่ทิ้งรอบอื่นทิ้งเหมือนก่อน
   ============================================================ */
```

→

```jsx
/* ============================================================
   เจ้าหน้าที่ / เจ้าหน้าที่ตรวจสอบ — รายละเอียดผลสอบนักศึกษาคนเดียว (ข้อมูลจริงจาก backend)
   แทนที่ StudentDetail เดิมใน officer.jsx ที่ยังใช้ mock SUBJECTS/STUDENTS

   canEdit  = เห็นปุ่ม "แก้ไขข้อมูล" (เฉพาะ officer)
   canReview = เห็นปุ่มยืนยัน/ตีกลับ (officer + reviewer)
   ผู้บริหาร (executive) ไม่มีสิทธิ์เข้าหน้านี้เลย ตั้งแต่ตัด /students /exam-results
   ออกจากสิทธิ์ผู้บริหาร (data minimization) — ไม่มี call site ของ role นี้ใน app.jsx

   โชว์ผลสอบ "ทุกรอบ" ที่นักศึกษาคนนี้เคยส่ง เป็น block คลิกสลับได้ฝั่งขวา (ไม่ใช่แค่รอบล่าสุดแบบเดิม)
   ข้อมูลมีอยู่แล้วจาก /exam-results?student_id=... (ไม่ต้องยิง API เพิ่ม) แค่ไม่ทิ้งรอบอื่นทิ้งเหมือนก่อน
   ============================================================ */
```

- [ ] **Step 2: Change the function signature**

Find (line 17):

```jsx
export function StudentDetailReal({ student, go, toast, readonly, lang }) {
```

→

```jsx
export function StudentDetailReal({ student, go, toast, canEdit, canReview, lang }) {
```

- [ ] **Step 3: Swap the three `readonly` checks**

Find (line 125):

```jsx
          {!readonly && <button className="btn btn-ghost" onClick={openEdit}><Icon name="edit" size={16} /> {tt('officer.detail.editBtn')}</button>}
```

→

```jsx
          {canEdit && <button className="btn btn-ghost" onClick={openEdit}><Icon name="edit" size={16} /> {tt('officer.detail.editBtn')}</button>}
```

Find (line 167):

```jsx
            {!readonly && status === 'SUBMITTED' && <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
```

→

```jsx
            {canReview && status === 'SUBMITTED' && <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
```

Find (line 173):

```jsx
            {!readonly && status === 'CONFIRMED' && <div style={{ marginTop: 14, padding: '11px 13px', background: 'var(--status-ok-bg)', borderRadius: 10, fontSize: 15, color: 'var(--status-ok-fg)', display: 'flex', gap: 8, alignItems: 'center' }}>
```

→

```jsx
            {canReview && status === 'CONFIRMED' && <div style={{ marginTop: 14, padding: '11px 13px', background: 'var(--status-ok-bg)', borderRadius: 10, fontSize: 15, color: 'var(--status-ok-fg)', display: 'flex', gap: 8, alignItems: 'center' }}>
```

Search the whole file for `readonly` one more time after these three edits — there should be zero remaining occurrences. If you find one, you missed it; fix it the same way (`canEdit` for the edit-data capability, `canReview` for the approve/reject/status-banner capability).

- [ ] **Step 4: Manual browser check (does both this task and Task 5's Step 5)**

Start both servers if not already running:

```bash
cd backend && npm start
```
```bash
cd frontend && npm run dev
```

In a browser:

1. Log in as officer (`456` / `456`). Open any student's detail page (from the review queue or student list). Confirm: "แก้ไขข้อมูล" button visible, and if there's a `SUBMITTED` paper, the approve/reject buttons are visible too. This is the regression check — officer must look exactly like before.
2. Log in as the reviewer account created by Task 2's smoke test (or create a fresh one via "จัดการผู้ใช้งาน" as officer — role dropdown won't have "reviewer" as an option until Task 7, so for now create one via the API directly with `curl`/Postman, or reuse the one the smoke test creates: username starts with `reviewer_`, but that account's temp password was already changed and thrown away by the test — create a new one by hand instead: log in as officer, `POST /api/users` with `role_name: "reviewer"`).
3. Log in as that reviewer. Confirm the sidebar shows only "ตรวจสอบ/ยืนยันผล". Click into a submitted paper's detail page. Confirm: **no** "แก้ไขข้อมูล" button, but the approve/reject buttons **are** visible and work (approve one, confirm it goes through and the audit log gets a row — you can check via `npx prisma studio` if you want visual confirmation, not required).
4. Try navigating the reviewer's browser tab directly to `/dashboard` or `/students` by typing the URL. Confirm it bounces back to `/review`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/design/studentDetailReal.jsx
git commit -m "$(cat <<'EOF'
refactor(student-detail): split canEdit from canReview

readonly was all-or-nothing and had exactly one real caller (officer)
— executive lost access to this page entirely in an earlier change
and the readonly=true path documented for it was dead code. Reviewer
needs the opposite split from what readonly ever supported: review
actions visible, edit-student-info action hidden.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Reviewer accounts show up in "จัดการผู้ใช้งาน"

**Files:**
- Modify: `frontend/src/design/manageUsersReal.jsx`
- Modify: `frontend/src/design/i18n.js`

**Interfaces:** none — leaf UI change, nothing else depends on it.

- [ ] **Step 1: Add the `role.reviewer` translation key**

In `frontend/src/design/i18n.js`, find the Thai block (around line 30-32):

```js
    'role.student': 'นักศึกษา',
    'role.officer': 'เจ้าหน้าที่คณะ',
    'role.executive': 'ผู้บริหารคณะ',
```

→

```js
    'role.student': 'นักศึกษา',
    'role.officer': 'เจ้าหน้าที่คณะ',
    'role.executive': 'ผู้บริหารคณะ',
    'role.reviewer': 'เจ้าหน้าที่ตรวจสอบ',
```

Find the English block (around line 893-895):

```js
    'role.student': 'Student',
    'role.officer': 'Faculty Officer',
    'role.executive': 'Faculty Executive',
```

→

```js
    'role.student': 'Student',
    'role.officer': 'Faculty Officer',
    'role.executive': 'Faculty Executive',
    'role.reviewer': 'Reviewer',
```

- [ ] **Step 2: Include reviewer accounts in the list**

In `frontend/src/design/manageUsersReal.jsx`, find (line 27):

```js
  const load = () => { apiFetch('/users').then(all => setUsers(all.filter(u => u.role.role_name === 'officer' || u.role.role_name === 'executive'))).catch(e => toast(e.message, 'error')); };
```

→

```js
  const load = () => { apiFetch('/users').then(all => setUsers(all.filter(u => ['officer', 'executive', 'reviewer'].includes(u.role.role_name)))).catch(e => toast(e.message, 'error')); };
```

- [ ] **Step 3: Add it to the role label map**

Find (line 25):

```js
  const ROLE_LABEL = { officer: tt('role.officer'), executive: tt('role.executive') };
```

→

```js
  const ROLE_LABEL = { officer: tt('role.officer'), executive: tt('role.executive'), reviewer: tt('role.reviewer') };
```

- [ ] **Step 4: Add it to the create-account role dropdown**

Find (lines 112-115):

```jsx
            <select className="select" value={form.role_name} onChange={e => setForm(f => ({ ...f, role_name: e.target.value }))}>
              <option value="executive">{tt('role.executive')}</option>
              <option value="officer">{tt('role.officer')}</option>
            </select>
```

→

```jsx
            <select className="select" value={form.role_name} onChange={e => setForm(f => ({ ...f, role_name: e.target.value }))}>
              <option value="executive">{tt('role.executive')}</option>
              <option value="officer">{tt('role.officer')}</option>
              <option value="reviewer">{tt('role.reviewer')}</option>
            </select>
```

- [ ] **Step 5: Manual browser check**

Log in as officer, go to "จัดการผู้ใช้งาน". Confirm the create-account modal's role dropdown has 3 options now. Create a reviewer account through the UI (this replaces the manual API step from Task 6's Step 4 for any future testing). Confirm the new account shows up in the table with the role chip reading "เจ้าหน้าที่ตรวจสอบ". Log out, log in as that new reviewer with the temp password, go through ForceChangePassword, confirm you land on the review queue.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/design/manageUsersReal.jsx frontend/src/design/i18n.js
git commit -m "$(cat <<'EOF'
feat(usersMgmt): add reviewer to the account-creation role dropdown

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Docs — `BACKEND_GUIDE.md` and `SYNTAX_NOTES.md`

**Files:**
- Modify: `backend/BACKEND_GUIDE.md` (section 7.4 users, section 7.5 students, section 7.7 examResults, Changelog)
- Modify: `backend/SYNTAX_NOTES.md` (new subsection under "3. Prisma ORM")

This is required by this repo's own convention, quoted directly in `CLAUDE.md`: *"ทุกครั้งที่แก้โค้ด backend (เพิ่ม endpoint / เปลี่ยน schema / เปลี่ยน logic / เพิ่มไฟล์) — แก้ในคอมมิตเดียวกัน + เพิ่มบรรทัดใน Changelog ท้ายไฟล์"*. Doing it as its own task here (instead of "in the same commit" per that rule) is a deliberate deviation for plan-readability — squash Tasks 1-4's and this task's commits together before merging if you want to follow that rule to the letter, or note in the PR description that docs landed one commit later covering the same change set.

- [ ] **Step 1: Add the `role.reviewer` row context to section 7.4**

In `backend/BACKEND_GUIDE.md`, find (around line 411-427, section `### 7.4 users`):

```
| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| GET | `/api/users` | 🧑‍💼 | รายชื่อผู้ใช้ทั้งหมด |
| POST | `/api/users` | 🧑‍💼 | สร้างบัญชี officer/executive |
| POST | `/api/users/:id/role` | 🧑‍💼 | เปลี่ยน role |
| POST | `/api/users/:id/revoke` | 🧑‍💼 | ถอนสิทธิ์ |
| POST | `/api/users/:id/reset-password` | 🧑‍💼 | รีเซ็ตรหัสให้ไปตั้งใหม่เอง |

**กฎสำคัญ**
- สร้างได้แค่ `officer` / `executive` (`CREATABLE_ROLES`) — บัญชีนักศึกษาต้องมาทาง import CSV เท่านั้น
```

Change the `POST /api/users` row's description and the "สร้างได้แค่" line:

```
| POST | `/api/users` | 🧑‍💼 | สร้างบัญชี officer/executive/reviewer |
```

```
- สร้างได้แค่ `officer` / `executive` / `reviewer` (`CREATABLE_ROLES`) — บัญชีนักศึกษาต้องมาทาง import CSV เท่านั้น
```

Leave the rest of that section (the `password`/first-setup bullet) alone — it's stale for an unrelated reason (predates the Sept 17 auth rework) and fixing it isn't this task's job; don't get pulled into it.

- [ ] **Step 2: Note the reviewer access in section 7.5**

Find (around line 429-441):

```
### 7.5 students — นักศึกษา

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| GET | `/api/students` | 🧑‍💼 | รายชื่อนักศึกษาทั้งหมด |
| GET | `/api/students/:id` | 🧑‍💼 👤 | ดูรายคน (นักศึกษาดูได้แค่ตัวเอง) |
```

→

```
### 7.5 students — นักศึกษา

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| GET | `/api/students` | 🧑‍💼 🔍 | รายชื่อนักศึกษาทั้งหมด (🔍 = reviewer ก็เข้าได้ — คิวตรวจใช้ทำแท็บ "ยังไม่กรอก") |
| GET | `/api/students/:id` | 🧑‍💼 👤 🔍 | ดูรายคน (นักศึกษาดูได้แค่ตัวเอง) |
```

Check the legend near the top of the file (search for `🧑‍💼` near a line defining what each emoji means, likely close to the start of section 7 or in section 0/1) and add `🔍 = reviewer` to it if such a legend exists; if there's no legend, skip this — the inline parenthetical above is enough.

- [ ] **Step 3: Note the reviewer access in section 7.7 and describe the concurrency guard + audit log**

Find (around line 505-521):

```
### 7.7 examResults — ผลสอบ ⭐ หัวใจของระบบ

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| POST | `/api/exam-results` | 👤 | ส่ง/แก้ผลสอบของรอบที่เปิดอยู่ |
| GET | `/api/exam-results/me` | 👤 | ประวัติของตัวเอง |
| POST | `/api/exam-results/:id/certificates` | 👤 | แนบ PDF |
| GET | `/api/exam-results` | 🧑‍💼 | ดูทั้งหมด (กรองได้) |
| PATCH | `/api/exam-results/:id/approve` | 🧑‍💼 | ยืนยันผล |
| PATCH | `/api/exam-results/:id/reject` | 🧑‍💼 | ตีกลับ (ต้องมี remark) |
```

→

```
### 7.7 examResults — ผลสอบ ⭐ หัวใจของระบบ

| Method | URL | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| POST | `/api/exam-results` | 👤 | ส่ง/แก้ผลสอบของรอบที่เปิดอยู่ |
| GET | `/api/exam-results/me` | 👤 | ประวัติของตัวเอง |
| POST | `/api/exam-results/:id/certificates` | 👤 | แนบ PDF |
| GET | `/api/exam-results` | 🧑‍💼 🔍 | ดูทั้งหมด (กรองได้) |
| PATCH | `/api/exam-results/:id/approve` | 🧑‍💼 🔍 | ยืนยันผล |
| PATCH | `/api/exam-results/:id/reject` | 🧑‍💼 🔍 | ตีกลับ (ต้องมี remark) |

**🔍 = role `reviewer`** — เพิ่มเข้ามาเพื่อช่วยตรวจ (เจ้าหน้าที่คนเดียวตรวจ 200+ คนไม่ไหว) pooled queue เดียวกับ officer
ไม่มี assignment รายคน/รายห้อง เจตนาไว้แบบนี้ — ดู `docs/superpowers/specs/2026-09-19-reviewer-role-design.md`.
reviewer **ไม่มีสิทธิ์** `/api/dashboard/*`, `/api/rounds*`, `/api/subjects*`, `/api/users*` (นอกจากถูกสร้างโดย officer),
`/api/news*` จัดการ, `/api/students/import`, `/api/students/bulk-eligible` — เห็นแค่คิวตรวจ + รายละเอียดนักศึกษาที่กำลังตรวจ (แก้ข้อมูลไม่ได้)

**กันตรวจซ้อน:** `updateStaffStatus` เดิมเขียนทับ DB ตรงๆ ไม่เช็คว่าใบนี้ถูกตรวจไปแล้วหรือยัง — สองคนกดพร้อมกัน
คนหลังชนะเงียบๆ ไม่มี error ทั้งคู่ (บัคที่มีมาตั้งแต่มี officer คนเดียวก็เจอได้ แค่ไม่มีใครมาชนตัวเอง) แก้ด้วย
`updateStaffStatusIfSubmitted` — `updateMany` ที่มีเงื่อนไข `staff_status: "submitted"` ใน `where`, คืน `{ count }`,
`count === 0` = มีคนตรวจไปแล้วระหว่างที่กำลังเขียน ตอบ **409** แทนทับ

**Audit log:** ทุกครั้งที่ approve/reject สำเร็จ insert 1 แถวลง `review_logs` (`reviewLogs.repository.js`) — insert-only,
ต่างจาก `exam_results.confirmed_by/confirmed_at` ที่ถูกทับทุกครั้งที่ตรวจซ้ำ ใช้ตอบ "ใครตรวจใบไหน เมื่อไหร่" ย้อนหลังได้ครบ
ทุกรอบการตรวจ ไม่ใช่แค่ครั้งล่าสุด ยังไม่มี endpoint อ่าน (out of scope ของรอบนี้) query ตรง DB ไปก่อนถ้าต้องใช้
```

- [ ] **Step 4: Add the Changelog line**

Find `## 14. Changelog` and the table right after it — add a new row at the top (most recent first, matching the existing ordering):

```
| 2026-09-19 | เพิ่ม role `reviewer` — pooled review queue ร่วมกับ officer (`GET/PATCH /api/exam-results`, `GET /api/students`), ไม่มี dashboard/rounds/subjects/users/news. เพิ่มตาราง `review_logs` (insert-only audit log ทุกครั้งที่ approve/reject). แก้บัค `reviewExamResult` เขียนทับ DB โดยไม่เช็คสถานะก่อน — สองคนตรวจใบเดียวกันพร้อมกันคนหลังทับคนแรกเงียบๆ, เปลี่ยนเป็น `updateStaffStatusIfSubmitted` (`updateMany` + where `staff_status:"submitted"`) ตอบ 409 แทนทับ. Frontend: `canEdit`/`canReview` แทน `readonly` ตัวเดียวใน `StudentDetailReal` (`readonly` ไม่มีใครเรียกจริงมาก่อนหน้านี้แล้ว — executive เข้าหน้านี้ไม่ได้ตั้งแต่ตัด data-minimization รอบก่อน). `db push` เท่านั้น ไม่มี migration ใหม่ — สอดคล้องกับ dev DB ที่ไม่เคย apply migration history จริงมาตั้งแต่ต้น (`schema.prisma`, `seed.js`, `users.controller.js`, `examResults.{repository,controller,routes}.js`, `students.routes.js`, `reviewLogs/reviewLogs.repository.js`, `tests/cleanupYears.mjs`, `tests/smoke-phase15-reviewer.mjs`, `app.jsx`, `studentDetailReal.jsx`, `manageUsersReal.jsx`, `i18n.js`) |
```

- [ ] **Step 5: Add the `updateMany`-as-guard subsection to `SYNTAX_NOTES.md`**

In `backend/SYNTAX_NOTES.md`, find:

```
### update
```js
user = await prisma.user.update({
  where: { user_id: user.user_id },   // ต้องระบุ unique field
  data: { first_name: first_name },
});
```

### where เทียบ SQL WHERE
```

Insert a new subsection between them:

```
### update
```js
user = await prisma.user.update({
  where: { user_id: user.user_id },   // ต้องระบุ unique field
  data: { first_name: first_name },
});
```

### updateMany — เช็คก่อนว่าอัปเดตจริงกี่แถว (กันข้อมูลชนกัน)
`update()` ต้องระบุ `where` ด้วย unique field เท่านั้น (เช่น `user_id`) ใส่เงื่อนไขอื่นเพิ่มไม่ได้
`updateMany()` ใส่เงื่อนไขอะไรก็ได้ใน `where` และคืนค่าเป็น `{ count }` บอกว่าอัปเดตไปกี่แถวจริงๆ — เอาไปเช็คได้ว่า
"มีคนแก้ไปก่อนหน้าฉันหรือเปล่า" โดยไม่ต้องเขียน SQL transaction เอง

```js
// backend/src/modules/examResults/examResults.repository.js
// ปกติใบผลสอบ 1 ใบมี result_id เดียว ไม่จำเป็นต้องใช้ updateMany (update ตัวเดียวพอ)
// แต่ตรงนี้ตั้งใจใส่เงื่อนไข staff_status ไปด้วย เพื่อให้ Prisma อัปเดตให้ "ก็ต่อเมื่อ" เงื่อนไขนั้นยังจริงอยู่
export const updateStaffStatusIfSubmitted = (result_id, { staff_status, remark, confirmed_by }) =>
  prisma.examResult.updateMany({
    where: {
      result_id: Number(result_id),
      staff_status: "submitted",   // ถ้าใครแก้ไปแล้ว staff_status จะไม่ใช่ "submitted" อีกต่อไป — เงื่อนไขนี้จะไม่ match แถวไหนเลย
    },
    data: { staff_status, remark, confirmed_by, confirmed_at: new Date() },
  });

// ที่เรียกใช้:
const { count } = await updateStaffStatusIfSubmitted(id, {...});
if (count === 0) {
  // ไม่มีแถวไหนถูกอัปเดตเลย = ตอน Prismaรัน where เงื่อนไข staff_status:"submitted" ไม่จริงแล้ว
  // แปลว่ามีคนอื่นเปลี่ยนสถานะใบนี้ไปก่อนหน้าเรานิดเดียว (เช่น approve ไปแล้ว)
  throw new Error("มีคนแก้ไปแล้ว");
}
```

เทียบง่ายๆ: `update()` เหมือนพูดว่า *"แก้แถว user_id=5"* (เชื่อว่ามันยังอยู่ในสภาพที่แก้ได้เสมอ)
`updateMany()` แบบนี้เหมือนพูดว่า *"แก้แถว result_id=9 **ถ้า** ตอนนี้ยังเป็น submitted อยู่"* — เช็คและแก้ในคำสั่งเดียว
ไม่มีช่องว่างให้อีกคนแทรกเข้ามาระหว่างที่เรา "เช็คแล้วค่อยแก้" คนละ 2 คำสั่ง (นั่นคือบัคที่โค้ดเดิมเป็น)

### where เทียบ SQL WHERE
```

- [ ] **Step 6: Commit**

```bash
git add backend/BACKEND_GUIDE.md backend/SYNTAX_NOTES.md
git commit -m "$(cat <<'EOF'
docs: document the reviewer role, review_logs, and updateMany guard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Final check (all tasks done)

- [ ] `cd backend && npm run seed && npm test` — full suite passes, including `smoke-phase15-reviewer.mjs`.
- [ ] Manual browser pass: officer unaffected, reviewer sees only the review queue, can approve/reject, cannot edit student info, cannot reach any officer-only page by typing its URL.
- [ ] `grep -rn "readonly" frontend/src/design/studentDetailReal.jsx` returns nothing.
- [ ] `git log --oneline` shows 8 commits for this feature (Tasks 1-8), each independently reviewable.
