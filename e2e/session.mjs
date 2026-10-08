// 로그인 유지·로그아웃 (AUTH-04, AUTH-09 / FR-015~FR-024, FR-029, SC-005, SC-009 / quickstart 4.3)
// 사용: 개발 서버를 띄운 상태에서 node e2e/session.mjs <스크린샷 폴더>
// 시간 조건(2시간·7일)은 기다리지 않고 DB의 sessions.expires_at·updated_at을 당겨 만든다. 실행마다 새 아이디를 쓴다.
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const ADMIN = { username: process.env.ADMIN_USERNAME ?? "admin", password: process.env.ADMIN_PASSWORD ?? "" };
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const note = (name) => results.push(`ℹ️  ${name}`);
const browser = await chromium.launch();

const n = Date.now() % 100_000_000;
const ID = `se${n}`;
const PW = "session-pass-1234";
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const MSG = { empty: "아이디와 비밀번호를 적어 주세요", wrong: "아이디 또는 비밀번호가 맞지 않아요" };

const one = async (q, params) => (await db.query(q, params)).rows[0];
const userId = async () => (await one("SELECT id FROM users WHERE username = $1", [ID])).id;
// 가장 최근에 만든 이 회원의 세션 (로그인 직후에 부른다)
const newestSession = async () =>
  one(
    `SELECT id, remember_me, extract(epoch FROM expires_at - now()) * 1000 AS left_ms, extract(epoch FROM now() - updated_at) * 1000 AS idle_ms
     FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [await userId()],
  );
const sessionById = (id) =>
  one(
    `SELECT id, remember_me, extract(epoch FROM expires_at - now()) * 1000 AS left_ms, extract(epoch FROM now() - updated_at) * 1000 AS idle_ms
     FROM sessions WHERE id = $1`,
    [id],
  );
const setSession = (id, sets) => db.query(`UPDATE sessions SET ${sets} WHERE id = $1`, [id]);
const near = (ms, target, tolerance = 3 * 60_000) => Math.abs(ms - target) <= tolerance;
const fmt = (ms) => `${(ms / HOUR).toFixed(2)}시간`;

async function fresh(viewport = { width: 1280, height: 860 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  return { ctx, page, errors: collectErrors(page) };
}

async function fillLogin(page, { id = ID, pw = PW, remember = false } = {}) {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("아이디").fill(id);
  await page.getByLabel("비밀번호", { exact: true }).fill(pw);
  if (remember) await page.getByLabel("로그인 상태 유지").check();
}

// 로그인 폼을 보내고 결과: "town"(광장 도착) 또는 폼의 오류 문구
async function login(page, opts) {
  await fillLogin(page, opts);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  const town = page.waitForURL(/\/town/, { timeout: 20000 }).then(() => "town");
  const alert = page
    .locator('form [role="alert"]')
    .waitFor({ timeout: 20000 })
    .then(() => page.locator('form [role="alert"]').innerText());
  return Promise.race([town, alert]).catch(() => "(결과 없음)");
}

const sessionCookie = async (ctx) => (await ctx.cookies()).find((c) => c.name.endsWith("session_token"));
const dontRemember = async (ctx) => (await ctx.cookies()).find((c) => c.name.endsWith("dont_remember"));

// 회원 화면(/write)을 열고 도착한 경로
async function memberPath(page) {
  await page.goto(`${BASE}/write`);
  return new URL(page.url()).pathname;
}

// 브라우저를 닫았다 연 것: 만료(expires) 있는 쿠키만 옮긴 새 컨텍스트
async function reopen(ctx) {
  const kept = (await ctx.cookies()).filter((c) => c.expires !== -1);
  const next = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await next.addCookies(kept);
  return { ctx: next, page: await next.newPage(), kept };
}

// ── 준비: 테스트 회원 (가입 뒤 로그아웃) ──
{
  const { ctx, page } = await fresh();
  await loginDev(page, ID, "남자 주민", PW);
  check("준비: 테스트 회원 가입", new URL(page.url()).pathname === "/town");
  await ctx.close();
}

// ── 1~4) [로그인 상태 유지] 없이 로그인 ──
{
  const { ctx, page, errors } = await fresh();
  check("1 로그인 상태 유지 체크박스는 처음에 선택 안 됨", !(await (async () => {
    await page.goto(BASE);
    return page.getByLabel("로그인 상태 유지").isChecked();
  })()));
  await page.screenshot({ path: `${outDir}/60-login-form.png` });
  const r = await login(page);
  check("1 유지 없이 로그인 → 광장", r === "town", r);
  const c = await sessionCookie(ctx);
  check("1 세션 쿠키: 만료 없음(브라우저 종료 때 삭제)", c?.expires === -1, String(c?.expires));
  check("1 세션 쿠키: HttpOnly, SameSite=Lax, 로컬은 Secure 없음", c?.httpOnly === true && c?.sameSite === "Lax" && c?.secure === false, JSON.stringify({ h: c?.httpOnly, s: c?.sameSite, sec: c?.secure }));
  const s = await newestSession();
  check("1 DB remember_me = false", s?.remember_me === false);
  check("1 DB expires_at ≈ 지금 + 2시간", near(s?.left_ms, 2 * HOUR), fmt(s?.left_ms));

  // 2) 브라우저를 닫았다 열면 로그아웃
  const re = await reopen(ctx);
  check("2 만료 없는 쿠키를 뺀 새 컨텍스트로 /write → /", (await memberPath(re.page)) === "/");
  await re.ctx.close();

  // 3) 남은 시간 100분 → 회원 화면을 열면 다시 2시간
  await setSession(s.id, "expires_at = now() + interval '100 minutes'");
  check("3 회원 화면 열림", (await memberPath(page)) === "/write");
  const s3 = await sessionById(s.id);
  check("3 expires_at ≈ 지금 + 2시간으로 다시 늘어남", near(s3?.left_ms, 2 * HOUR), fmt(s3?.left_ms));
  check("3 updated_at ≈ 지금", s3?.idle_ms < 60_000, `${Math.round(s3?.idle_ms / 1000)}초`);

  // 4) 만료 → 첫 화면
  await setSession(s.id, "expires_at = now() - interval '1 minute'");
  check("4 만료된 세션으로 /write → /", (await memberPath(page)) === "/");
  check("1~4 콘솔 오류 없음", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// ── 4-2) 유지 안 함 세션: SessionKeeper 없음, dont_remember 쿠키를 지워 라이브러리가 늘려도 마지막 사용 2시간이 이긴다 ──
{
  const { ctx, page } = await fresh();
  const keeperCalls = [];
  page.on("request", (req) => req.url().includes("/api/auth/get-session") && keeperCalls.push(req.url()));
  await login(page);
  const s = await newestSession();
  await page.goto(`${BASE}/town`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  check("4-2 유지 안 함 회원 화면에서 get-session 요청 없음(SessionKeeper 없음)", keeperCalls.length === 0, String(keeperCalls.length));
  check("4-2 준비: dont_remember 쿠키가 있음", Boolean(await dontRemember(ctx)));
  await ctx.clearCookies({ name: /dont_remember$/ });
  const res = await page.request.get(`${BASE}/api/auth/get-session`);
  const after = await sessionById(s.id);
  check("4-2 get-session 직접 호출 200", res.status() === 200, String(res.status()));
  note(`4-2 라이브러리가 늘린 expires_at: ${fmt(after?.left_ms)} (dont_remember 없음 → 7일로 연장되는 것이 라이브러리 동작)`);
  await setSession(s.id, "updated_at = now() - interval '2 hours 10 minutes'");
  check("4-2 마지막 사용 2시간 10분 전 → /write → /", (await memberPath(page)) === "/");
  check("4-2 그 세션 행 삭제", !(await sessionById(s.id)));
  await ctx.close();
}

// ── 5~7) [로그인 상태 유지]를 골라 로그인 ──
{
  const { ctx, page, errors } = await fresh();
  // 예전 유지 안 함 로그인이 남긴 dont_remember 쿠키가 있는 브라우저 (세션 쿠키만 지워 로그아웃된 상태)
  await login(page);
  await ctx.clearCookies({ name: /session_token$/ });
  check("5 준비: 남은 dont_remember 쿠키", Boolean(await dontRemember(ctx)));

  const r = await login(page, { remember: true });
  check("5 유지로 로그인 → 광장", r === "town", r);
  check("5 남아 있던 dont_remember 쿠키를 지움", !(await dontRemember(ctx)));
  const c = await sessionCookie(ctx);
  check("5 세션 쿠키 만료 ≈ 7일 뒤", c && near(c.expires * 1000 - Date.now(), 7 * DAY, HOUR), c ? fmt(c.expires * 1000 - Date.now()) : "쿠키 없음");
  check("5 세션 쿠키 HttpOnly, SameSite=Lax", c?.httpOnly === true && c?.sameSite === "Lax");
  const s = await newestSession();
  check("5 DB remember_me = true", s?.remember_me === true);
  check("5 DB expires_at ≈ 지금 + 7일", near(s?.left_ms, 7 * DAY), fmt(s?.left_ms));

  const re = await reopen(ctx);
  check("5 브라우저를 닫았다 열어도 로그인 유지", (await memberPath(re.page)) === "/write");

  // 6) 6일 남은 유지 세션, 2시간 안 씀 → 회원 화면을 열면 SessionKeeper가 다시 7일로
  await setSession(s.id, "expires_at = now() + interval '6 days', updated_at = now() - interval '2 hours'");
  const cookie = await sessionCookie(re.ctx);
  await re.ctx.addCookies([{ ...cookie, expires: Math.floor((Date.now() + 6 * DAY) / 1000) }]);
  const keeper = await re.ctx.newPage(); // 새 탭: SessionKeeper의 10분 제한(sessionStorage)이 비어 있다
  const kept = keeper.waitForResponse((res) => res.url().includes("/api/auth/get-session"), { timeout: 15000 }).catch(() => null);
  await keeper.goto(`${BASE}/town`);
  const keptRes = await kept;
  check("6 SessionKeeper가 get-session을 부름", keptRes?.status() === 200, String(keptRes?.status()));
  const s6 = await sessionById(s.id);
  check("6 expires_at ≈ 지금 + 7일로 다시 늘어남", near(s6?.left_ms, 7 * DAY), fmt(s6?.left_ms));
  const c6 = await sessionCookie(re.ctx);
  check("6 쿠키 만료도 ≈ 7일 뒤로 다시 설정", c6 && near(c6.expires * 1000 - Date.now(), 7 * DAY, HOUR), c6 ? fmt(c6.expires * 1000 - Date.now()) : "쿠키 없음");

  // 7) 유지 세션 만료 → 첫 화면
  await setSession(s.id, "expires_at = now() - interval '1 minute'");
  check("7 만료된 유지 세션으로 /write → /", (await memberPath(keeper)) === "/");
  check("5~7 콘솔 오류 없음", errors.length === 0, errors.join(" | "));
  await re.ctx.close();
  await ctx.close();
}

// ── 8) 헤더 [로그아웃] ──
{
  const { ctx, page, errors } = await fresh();
  const dialogs = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    d.dismiss();
  });
  await login(page);
  const s = await newestSession();
  const out = page.getByRole("banner").getByRole("button", { name: "로그아웃" });
  const box = await out.boundingBox();
  check("8 로그아웃 누르는 영역 44×44px 이상", box && box.width >= 44 && box.height >= 44, box ? `${Math.round(box.width)}×${Math.round(box.height)}` : "버튼 없음");
  await out.click();
  await page.waitForURL(`${BASE}/`, { timeout: 15000 }).catch(() => {});
  check("8 확인 창 없이 첫 화면으로", new URL(page.url()).pathname === "/" && dialogs.length === 0, page.url());
  check("8 헤더에 [시작하기]", await page.getByRole("banner").getByRole("link", { name: "시작하기" }).isVisible());
  check("8 그 세션 행 삭제", !(await sessionById(s.id)));
  check("8 세션·dont_remember 쿠키 삭제", !(await sessionCookie(ctx)) && !(await dontRemember(ctx)));
  check("8 /write → /", (await memberPath(page)) === "/");
  await page.screenshot({ path: `${outDir}/61-after-signout.png` });
  const lib = await ctx.request.post(`${BASE}/api/auth/sign-out`, { data: {}, headers: { origin: BASE } });
  check("8 라이브러리 /api/auth/sign-out 직접 POST → 404", lib.status() === 404, String(lib.status()));
  check("8 콘솔 오류 없음", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// ── 9~11) 아이디 대소문자·공백, 빈 칸, 처리 중 버튼 ──
{
  const { ctx, page } = await fresh();
  const r9 = await login(page, { id: `  ${ID.toUpperCase()} ` });
  check("9 대문자·앞뒤 공백 섞은 아이디로 로그인", r9 === "town", r9);
  await ctx.clearCookies();

  const r10a = await login(page, { id: "", pw: PW });
  check("10 아이디 빈 칸 → 문구", r10a === MSG.empty, r10a);
  const r10b = await login(page, { id: ID, pw: "" });
  check("10 비밀번호 빈 칸 → 문구", r10b === MSG.empty, r10b);
  check("10 빈 칸 뒤 아이디 그대로", (await page.getByLabel("아이디").inputValue()) === ID);
  const r10c = await login(page, { id: `nobody${n}`, pw: PW });
  const r10d = await login(page, { id: ID, pw: "wrong-password-1" });
  check("10 없는 아이디·틀린 비밀번호는 같은 문구", r10c === MSG.wrong && r10d === MSG.wrong, `${r10c} / ${r10d}`);
  await page.screenshot({ path: `${outDir}/62-login-error.png` });

  // 11) Server Action 응답을 늦춰 처리 중 버튼을 본다
  await page.route(`${BASE}/`, async (route) => {
    if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await fillLogin(page);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  const busy = page.locator("form button", { hasText: "들어가는 중..." });
  const busyShown = await busy.waitFor({ timeout: 1400 }).then(() => true).catch(() => false);
  check("11 처리 중 `들어가는 중...`", busyShown);
  check("11 처리 중 버튼 누를 수 없음", busyShown && (await busy.isDisabled()));
  await page.screenshot({ path: `${outDir}/63-login-pending.png` });
  await page.waitForURL(/\/town/, { timeout: 20000 }).catch(() => {});
  check("11 늦어도 로그인 완료", new URL(page.url()).pathname === "/town");
  await page.unroute(`${BASE}/`);
  await ctx.close();
}

// ── 12) 다른 사이트 Origin으로 보낸 상태 변경 Server Action → 거부, 데이터 그대로 ──
// 화면의 실제 요청(Next-Action 헤더·본문)을 그대로 두고 Origin만 바꾼다
async function forgeOrigin(page) {
  const statuses = [];
  await page.route("**/*", async (route) => {
    const req = route.request();
    if (req.method() === "POST" && req.headers()["next-action"]) {
      const res = await route.fetch({ headers: { ...req.headers(), origin: "https://evil.example" } });
      statuses.push(res.status());
      return route.fulfill({ response: res });
    }
    return route.continue();
  });
  return statuses;
}
{
  // 로그아웃
  const { ctx, page } = await fresh();
  await login(page);
  const s = await newestSession();
  const statuses = await forgeOrigin(page);
  await page.getByRole("banner").getByRole("button", { name: "로그아웃" }).click();
  await page.waitForTimeout(2500);
  check("12 다른 Origin 로그아웃: 성공 아님", statuses.length > 0 && statuses.every((st) => st >= 400), statuses.join(","));
  check("12 다른 Origin 로그아웃: 세션 행 그대로", Boolean(await sessionById(s.id)));
  await page.unrouteAll({ behavior: "ignoreErrors" });
  check("12 다른 Origin 로그아웃 뒤에도 로그인 상태", (await memberPath(page)) === "/write");
  await ctx.close();
}
{
  // 관리자 글 삭제 (관리자 쿠키)
  const { ctx, page } = await fresh();
  page.on("dialog", (d) => d.accept());
  const r = await login(page, { id: ADMIN.username, pw: ADMIN.password });
  if (r !== "town") {
    check("12 준비: 관리자 로그인", false, r);
  } else {
    await page.goto(`${BASE}/admin`);
    const del = page.getByRole("button", { name: "삭제", exact: true }).first();
    if (!(await del.count())) {
      note("12 관리자 글 삭제: 최근 30일 글이 없어 건너뜀 (blog e2e를 먼저 돌리면 생김)");
    } else {
      const before = (await one("SELECT count(*)::int AS c FROM posts")).c;
      const statuses = await forgeOrigin(page);
      await del.click();
      await page.waitForTimeout(2500);
      const after = (await one("SELECT count(*)::int AS c FROM posts")).c;
      check("12 다른 Origin 관리자 글 삭제: 성공 아님", statuses.length > 0 && statuses.every((st) => st >= 400), statuses.join(","));
      check("12 다른 Origin 관리자 글 삭제: 글 수 그대로", before === after, `${before} → ${after}`);
    }
  }
  await ctx.close();
}
note("12 연동 해제·탈퇴 Server Action은 아직 없음 (US4 T046, US7 T065에서 이 파일에 더한다)");

console.log(results.join("\n"));
await browser.close();
await db.end();
if (results.some((r) => r.startsWith("❌"))) process.exitCode = 1;
