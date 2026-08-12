// Targeted test: one academic year cannot have two rounds with the same attempt_number.
// Uses far-future years (2501+) with past dates so nothing here can become the active round.
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

const PAST = { open_date: "2020-01-01", close_date: "2020-01-31" };

const main = async () => {
  const login = await call("POST", "/api/auth/login", {
    body: { psu_passport_id: "456", password: "456" },
  });
  check("login officer -> 200", login.status, 200);
  const token = login.cookie;
  if (!token) { console.log("no token, abort:", JSON.stringify(login.json)); process.exit(1); }

  const created = [];
  const mk = (year, attempt) =>
    call("POST", "/api/rounds", { token, body: { academic_year: year, attempt_number: attempt, ...PAST } });

  // 1. first round of a year is fine
  const first = await mk(2501, 1);
  check("create 2501/1 -> 200", first.status, 200);
  if (first.json.data) created.push(first.json.data.round_id);

  // 2. same year + same attempt = the bug this test guards
  const dup = await mk(2501, 1);
  check("create 2501/1 again -> 400", dup.status, 400);
  if (dup.json.data) created.push(dup.json.data.round_id);

  // 3. same year, different attempt is allowed
  const second = await mk(2501, 2);
  check("create 2501/2 -> 200", second.status, 200);
  if (second.json.data) created.push(second.json.data.round_id);

  // 4. same attempt, different year is allowed
  const otherYear = await mk(2502, 1);
  check("create 2502/1 -> 200", otherYear.status, 200);
  if (otherYear.json.data) created.push(otherYear.json.data.round_id);

  // 5. update must not be able to collide either
  const collide = await call("PUT", `/api/rounds/${otherYear.json.data?.round_id}`, {
    token, body: { academic_year: 2501, attempt_number: 1 },
  });
  check("update 2502/1 into 2501/1 -> 400", collide.status, 400);

  // 6. updating a round to the values it already has must still work (must not clash with itself)
  const self = await call("PUT", `/api/rounds/${otherYear.json.data?.round_id}`, {
    token, body: { academic_year: 2502, attempt_number: 1, status: "closed" },
  });
  check("update round to its own year/attempt -> 200", self.status, 200);

  // cleanup so repeat runs start clean
  for (const id of created) await call("DELETE", `/api/rounds/${id}`, { token });

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
};

main();
