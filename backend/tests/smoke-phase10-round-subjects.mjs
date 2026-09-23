// Targeted test for round subject_ids. Creates only closed rounds with past dates
// so it cannot become the active round and disturb anything else.
const BASE = process.env.BASE || "http://localhost:3000"; // ตั้ง BASE ได้ตอนรันผ่าน test:clean (server ชั่วคราวอยู่คนละพอร์ต)
let failures = 0;

const call = async (method, url, { token, body } = {}) => {
  const headers = {};
  // `token` ที่ส่งเข้ามาคือข้อความ cookie เต็มๆ เช่น "token=eyJhbGci..."
  // backend อ่าน JWT จาก httpOnly cookie แล้ว ไม่ได้อ่านจาก Authorization header อีก
  if (token) headers.Cookie = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  // ดึง cookie ที่ server ส่งกลับมา (มีเฉพาะตอน login) เพื่อเอาไปใช้ request ถัดๆ ไป
  // set-cookie มาเป็น "token=eyJ...; Path=/; HttpOnly; SameSite=Lax" — เอาแค่ชิ้นแรกก่อน ;
  let cookie = null;
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    cookie = setCookie.split(";")[0];
  }
  return { status: res.status, json, cookie };
};

const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`);
};

const PAST = { open_date: "2020-01-01", close_date: "2020-01-31" };

const main = async () => {
  const login = await call("POST", "/api/auth/login", {
    body: { psu_passport_id: "456", password: "456" },
  });
  check("login officer -> 200", login.status, 200);
  const token = login.cookie;
  if (!token) { console.log("no token, abort:", JSON.stringify(login.json)); process.exit(1); }

  const subs = await call("GET", "/api/subjects", { token });
  const ids = subs.json.data.map((s) => s.subject_id);
  console.log(`   subjects in db: ${ids.length}`);

  // Only one round system-wide may be open, and step 5 needs to open one of ours.
  // Park anything already open and put it back at the end.
  const allRounds = (await call("GET", "/api/rounds", { token })).json.data || [];
  const parked = allRounds.filter((r) => r.status === "open").map((r) => r.round_id);
  for (const id of parked) await call("PUT", `/api/rounds/${id}`, { token, body: { status: "closed" } });

  // 1. no subject_ids -> defaults to all subjects (old behaviour still works)
  const a = await call("POST", "/api/rounds", {
    token,
    body: { academic_year: 2500, attempt_number: 1, ...PAST },
  });
  check("create without subject_ids -> 200", a.status, 200);
  check("  defaults to all subjects", a.json.data?.subject_ids?.length, ids.length);

  // 2. explicit subset
  const b = await call("POST", "/api/rounds", {
    token,
    body: { academic_year: 2500, attempt_number: 2, ...PAST, subject_ids: ids.slice(0, 3) },
  });
  check("create with 3 subject_ids -> 200", b.status, 200);
  check("  stores exactly those ids", b.json.data?.subject_ids, ids.slice(0, 3));

  // 3. rejections
  const empty = await call("POST", "/api/rounds", {
    token, body: { academic_year: 2500, attempt_number: 3, ...PAST, subject_ids: [] },
  });
  check("empty subject_ids -> 400", empty.status, 400);

  const bad = await call("POST", "/api/rounds", {
    token, body: { academic_year: 2500, attempt_number: 3, ...PAST, subject_ids: [999999] },
  });
  check("unknown subject id -> 400", bad.status, 400);

  const dup = await call("POST", "/api/rounds", {
    token, body: { academic_year: 2500, attempt_number: 3, ...PAST, subject_ids: [ids[0], ids[0]] },
  });
  check("duplicate subject id -> 400", dup.status, 400);

  // 4. update while closed is allowed
  const roundId = b.json.data.round_id;
  const upd = await call("PUT", `/api/rounds/${roundId}`, {
    token, body: { subject_ids: ids.slice(0, 5) },
  });
  check("update subject_ids while closed -> 200", upd.status, 200);
  check("  new ids saved", upd.json.data?.subject_ids, ids.slice(0, 5));

  // 5. once open, subject_ids are locked
  const open = await call("PUT", `/api/rounds/${roundId}`, { token, body: { status: "open" } });
  check("set status open -> 200", open.status, 200);
  const locked = await call("PUT", `/api/rounds/${roundId}`, {
    token, body: { subject_ids: ids.slice(0, 2) },
  });
  check("update subject_ids while open -> 400", locked.status, 400);
  const stillFine = await call("PUT", `/api/rounds/${roundId}`, { token, body: { status: "closed" } });
  check("other fields still editable while open -> 200", stillFine.status, 200);

  const missing = await call("PUT", "/api/rounds/999999", { token, body: { subject_ids: ids } });
  check("update subject_ids on missing round -> 404", missing.status, 404);

  // delete the rounds this run created and reopen whatever was open before,
  // so a repeat run starts from the same state and the db keeps no test rounds
  for (const r of [a, b]) {
    if (r.json.data) await call("DELETE", `/api/rounds/${r.json.data.round_id}`, { token });
  }
  for (const id of parked) await call("PUT", `/api/rounds/${id}`, { token, body: { status: "open" } });

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
};

main();
