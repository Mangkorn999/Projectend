// Targeted test: a student sees only the announcements of their own cohort.
// Officers and executives keep seeing every announcement (they manage them).
// Creates its own year/round/news/student and deletes all of it at the end.
const BASE = process.env.BASE || "http://localhost:3000"; // ตั้ง BASE ได้ตอนรันผ่าน test:clean (server ชั่วคราวอยู่คนละพอร์ต)
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
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, json, data: json.data, cookie: setCookie ? setCookie.split(";")[0] : null };
};

const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${JSON.stringify(actual)}${ok ? "" : ` (want ${JSON.stringify(expected)})`}`);
};

const STAMP = String(Date.now()).slice(-6);
const YEAR_A = 2591;
const YEAR_B = 2592;
// 2 หลักแรกของรหัสนักศึกษาคำนวณเป็นปีจบฝั่ง server (entry+4) — ต้องตั้งให้ตรงกับ YEAR_A/YEAR_B
const A_ID = `${String(YEAR_A - 4).slice(-2)}10${STAMP}`; // 2+2+6 = 10 หลักพอดี ตามกฎรหัสนักศึกษา
const B_ID = `${String(YEAR_B - 4).slice(-2)}20${STAMP}`;
const A_NATIONAL_ID = `1${STAMP}1`.padEnd(13, "0").slice(0, 13);
const B_NATIONAL_ID = `1${STAMP}2`.padEnd(13, "0").slice(0, 13);
const PAST = { open_date: "2020-01-01", close_date: "2020-01-31" };

const main = async () => {
  const officer = await call("POST", "/api/auth/login", { body: { psu_passport_id: "456", password: "456" } });
  const oToken = officer.cookie;
  if (!oToken) { console.log("officer login failed:", JSON.stringify(officer.json)); process.exit(1); }

  const rooms = (await call("GET", "/api/rooms", { token: oToken })).data;

  const addStudent = async (id, year, nationalId) => {
    await call("POST", "/api/students", {
      token: oToken,
      body: { student_id: id, national_id: nationalId },
    });
    const login = await call("POST", "/api/auth/login", { body: { psu_passport_id: id, password: nationalId } });
    if (!login.cookie) { console.log(`student ${id} login failed:`, JSON.stringify(login.json)); process.exit(1); }
    const profile = await call("POST", "/api/students/complete-profile", {
      token: login.cookie,
      body: {
        first_name: "ข่าว", last_name: "ทดสอบ",
        first_name_en: "News", last_name_en: "Test",
        email: `${id}@test.local`, phone: "0800000000",
        room_id: rooms[0].room_id,
      },
    });
    if (profile.status !== 201) { console.log(`complete-profile ${id} failed:`, JSON.stringify(profile.json)); process.exit(1); }
    return login.cookie;
  };

  const aToken = await addStudent(A_ID, YEAR_A, A_NATIONAL_ID);
  const bToken = await addStudent(B_ID, YEAR_B, B_NATIONAL_ID);

  const mkRound = async (year) => {
    const r = await call("POST", "/api/rounds", { token: oToken, body: { academic_year: year, attempt_number: 1, ...PAST } });
    if (r.status !== 200) { console.log("create round failed", JSON.stringify(r.json)); process.exit(1); }
    return r.data.round_id;
  };
  const roundA = await mkRound(YEAR_A);
  const roundB = await mkRound(YEAR_B);

  const mkNews = async (roundId, title) => {
    const n = await call("POST", "/api/news", { token: oToken, body: { title, content: "เนื้อหาทดสอบ", round_id: roundId } });
    check(`โพสต์ประกาศ "${title}" -> 201`, n.status, 201);
    return n.data?.news_id;
  };
  const newsA = await mkNews(roundA, `ประกาศรุ่น ${YEAR_A}`);
  const newsB = await mkNews(roundB, `ประกาศรุ่น ${YEAR_B}`);

  const titlesFor = async (token) => (await call("GET", "/api/news", { token })).data.map(n => n.title);

  const aSees = await titlesFor(aToken);
  check(`นักศึกษารุ่น ${YEAR_A} เห็นประกาศของรุ่นตัวเอง`, aSees.includes(`ประกาศรุ่น ${YEAR_A}`), true);
  check(`  และไม่เห็นของรุ่น ${YEAR_B}`, aSees.includes(`ประกาศรุ่น ${YEAR_B}`), false);

  const bSees = await titlesFor(bToken);
  check(`นักศึกษารุ่น ${YEAR_B} เห็นประกาศของรุ่นตัวเอง`, bSees.includes(`ประกาศรุ่น ${YEAR_B}`), true);
  check(`  และไม่เห็นของรุ่น ${YEAR_A}`, bSees.includes(`ประกาศรุ่น ${YEAR_A}`), false);

  const oSees = await titlesFor(oToken);
  check("เจ้าหน้าที่เห็นประกาศครบทุกรุ่น", [`ประกาศรุ่น ${YEAR_A}`, `ประกาศรุ่น ${YEAR_B}`].every(t => oSees.includes(t)), true);

  const exec = await call("POST", "/api/auth/login", { body: { psu_passport_id: "789", password: "789" } });
  if (exec.cookie) {
    const eSees = await titlesFor(exec.cookie);
    check("ผู้บริหารเห็นประกาศครบทุกรุ่น", [`ประกาศรุ่น ${YEAR_A}`, `ประกาศรุ่น ${YEAR_B}`].every(t => eSees.includes(t)), true);
  }

  // cleanup
  for (const id of [newsA, newsB]) if (id) await call("DELETE", `/api/news/${id}`, { token: oToken });
  for (const id of [A_ID, B_ID]) await call("DELETE", `/api/students/${id}`, { token: oToken });
  for (const id of [roundA, roundB]) await call("DELETE", `/api/rounds/${id}`, { token: oToken });

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
};

main();
