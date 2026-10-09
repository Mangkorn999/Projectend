// ตั้งรหัสผ่านครั้งแรกแล้วเข้าระบบต่อได้เลย ไม่ต้อง login ใหม่
//   - ก่อนเปลี่ยน: ใช้ได้แค่ /auth/me กับ /auth/password (endpoint อื่น 403)
//   - เปลี่ยนสำเร็จ: cookie เดิมต้องใช้ต่อได้ทันที (must_change_password เช็คจาก DB สดทุก request ไม่ได้ดูใน token)
//   - รหัสเดิมใช้ login ไม่ได้อีก / รหัสใหม่ login ได้
//   - ใช้ได้กับทุก role ที่เจ้าหน้าที่สร้างให้ (ผู้บริหาร, เจ้าหน้าที่, ผู้ช่วยตรวจ)
const BASE = process.env.BASE || "http://localhost:3000";
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
  const text = await res.text();
  const json = (() => { try { return JSON.parse(text); } catch { return {}; } })();
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

const login = (psu_passport_id, password) =>
  call("POST", "/api/auth/login", { body: { psu_passport_id, password } });

const STAMP = Date.now().toString().slice(-7);

const main = async () => {
  const officer = await login("456", "456");
  const oToken = officer.cookie;
  if (!oToken) { console.log("officer login failed:", JSON.stringify(officer.json)); process.exit(1); }

  const roles = ["executive", "officer", "reviewer"];
  for (const [i, role] of roles.entries()) {
    const psu = `${i + 1}${STAMP}`;
    console.log(`\n--- role: ${role} ---`);

    const created = await call("POST", "/api/users", {
      token: oToken,
      body: { psu_passport_id: psu, password: "test1234", role_name: role, first_name: "Pw", last_name: role, email: `pw${i}${STAMP}@test.local`, phone: "0800000010" },
    });
    check("เจ้าหน้าที่สร้างบัญชี -> 201", created.status, 201);

    const first = await login(psu, "test1234");
    check("login รหัสชั่วคราว -> must_change_password = true", first.json.must_change_password, true);
    const cookie = first.cookie;

    const blocked = await call("GET", "/api/subjects", { token: cookie });
    check("ก่อนเปลี่ยนรหัส: endpoint อื่นถูกบล็อก -> 403", blocked.status, 403);

    const change = await call("PATCH", "/api/auth/password", {
      token: cookie,
      body: { current_password: "test1234", new_password: "newpass5678" },
    });
    check("เปลี่ยนรหัส -> 200", change.status, 200);
    check("  ข้อความไม่บังคับ login ใหม่", /เข้าสู่ระบบใหม่/.test(change.json.data?.message ?? ""), false);

    // หัวใจของเทส: ใช้ cookie ใบเดิม ไม่ login ใหม่
    const me = await call("GET", "/api/auth/me", { token: cookie });
    check("cookie เดิม /auth/me -> 200", me.status, 200);
    check("  must_change_password เป็น false แล้ว", me.json.data?.must_change_password, false);
    check("  role ยังเหมือนเดิม", me.json.data?.role, role);

    const open = await call("GET", "/api/subjects", { token: cookie });
    check("cookie เดิมใช้ endpoint อื่นได้ -> 200", open.status, 200);

    const oldPw = await login(psu, "test1234");
    check("รหัสเก่า login ไม่ได้ -> 401", oldPw.status, 401);
    const newPw = await login(psu, "newpass5678");
    check("รหัสใหม่ login ได้ และ must_change_password = false", [newPw.status, newPw.json.must_change_password], [200, false]);
  }

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
};

main();
