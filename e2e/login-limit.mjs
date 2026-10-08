// 로그인 시도 제한 (AUTH-09 / FR-025~FR-028, SC-004, SC-006, research R8 / quickstart 4.4)
// 사용: 개발 서버를 띄운 상태에서 node e2e/login-limit.mjs <스크린샷 폴더>
// DB는 .env.local의 DATABASE_URL로 준비·확인한다. 실행마다 새 아이디를 쓴다.
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();

const n = Date.now() % 100_000_000;
const PW = "limit-pass-1234";
const WRONG = "wrong-pass-1234";
const MSG = {
  fail: "아이디 또는 비밀번호가 맞지 않아요",
  locked: "로그인을 너무 많이 시도했어요. 5분 뒤에 다시 시도해 주세요",
};

const one = async (q, params) => (await db.query(q, params)).rows[0];
const attemptRow = (id) => one("SELECT failed_count, locked_until FROM login_attempts WHERE username = $1", [id]);

async function fresh(viewport = { width: 1280, height: 860 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  return { ctx, page };
}

/** 회원을 만든다 (가입 → 광장) */
async function member(id) {
  const { ctx, page } = await fresh();
  await loginDev(page, id, "남자 주민", PW);
  await ctx.close();
}

// 폼 안의 오류 한 줄 (Next.js 경로 안내 요소도 role=alert라 폼으로 좁힌다)
const formError = (page) => page.locator('form [role="alert"]');

/** 화면에서 로그인. 결과: "town" 또는 화면의 오류 문구 */
async function uiSignIn(page, id, pw) {
  await page.goto(BASE);
  await page.getByLabel("아이디").fill(id);
  await page.getByLabel("비밀번호", { exact: true }).fill(pw);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  const town = page.waitForURL(/\/town/, { timeout: 20000 }).then(() => "town");
  const alert = formError(page)
    .waitFor({ timeout: 20000 })
    .then(() => formError(page).innerText());
  return Promise.race([town, alert]).catch(() => "(결과 없음)");
}

// ── 준비: 화면의 실제 로그인 Server Action 요청(Next-Action 헤더·multipart 본문)을 한 번 잡아 둔다 ──
// 이 요청의 아이디·비밀번호 값만 바꿔 "화면을 거치지 않은 요청"을 만든다 (FR-028)
const CAP_ID = `cap${n}`;
const CAP_PW = `cap-pw-${n}`;
let action;
{
  const { ctx, page } = await fresh();
  await page.goto(BASE);
  await page.getByLabel("아이디").fill(CAP_ID);
  await page.getByLabel("비밀번호", { exact: true }).fill(CAP_PW);
  const reqP = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  const req = await reqP;
  action = { id: req.headers()["next-action"], contentType: req.headers()["content-type"], body: req.postData() ?? "" };
  await formError(page).waitFor({ timeout: 20000 }).catch(() => {});
  await ctx.close();
}
check("준비: 로그인 Server Action 요청", Boolean(action.id && action.body.includes(CAP_ID) && action.body.includes(CAP_PW)));

/** 화면 없이 로그인 Server Action을 직접 보낸다. 결과: "fail" | "locked" | "town" | "?{status}" */
async function directSignIn(id, pw) {
  const res = await fetch(BASE, {
    method: "POST",
    redirect: "manual",
    headers: { "Next-Action": action.id, Accept: "text/x-component", "Content-Type": action.contentType },
    body: action.body.replaceAll(CAP_ID, id).replaceAll(CAP_PW, pw),
  });
  const text = await res.text();
  if (text.includes(MSG.locked)) return "locked";
  if (text.includes(MSG.fail)) return "fail";
  if ((res.headers.get("x-action-redirect") ?? "").includes("/town")) return "town";
  return `?${res.status}`;
}

// ── 1) 새 회원으로 5번 틀림 → 6번째에 맞는 비밀번호: 잠금 문구, 로그인 안 됨 ──
const A = `ll${n}`;
await member(A);
{
  const { ctx, page } = await fresh();
  const outs = [];
  for (let i = 0; i < 5; i++) outs.push(await uiSignIn(page, A, WRONG));
  check("1 1~5번째 `아이디 또는 비밀번호가 맞지 않아요`", outs.every((o) => o === MSG.fail), outs.join(" / "));
  const sixth = await uiSignIn(page, A, PW);
  check("1 6번째(맞는 비밀번호) 잠금 문구", sixth === MSG.locked, sixth);
  check("1 로그인 안 됨", new URL(page.url()).pathname === "/");
  await page.screenshot({ path: `${outDir}/70-login-locked.png` });
  const row = await attemptRow(A);
  check("1 DB 잠금 ≈ 5분 뒤", row?.locked_until && Math.abs(new Date(row.locked_until).getTime() - Date.now() - 5 * 60_000) < 60_000);
  await ctx.close();
}

// ── 2) locked_until을 과거로 → 맞는 비밀번호로 로그인, 실패 기록 행 없음 ──
{
  await db.query("UPDATE login_attempts SET locked_until = now() - interval '1 second' WHERE username = $1", [A]);
  const { ctx, page } = await fresh();
  const out = await uiSignIn(page, A, PW);
  check("2 잠금이 풀린 뒤 로그인됨", out === "town", out);
  check("2 그 아이디의 실패 기록 행 없음", !(await attemptRow(A)));
  await ctx.close();
}

// ── 3) 3번 틀림 → 성공 → 로그아웃 → 4번 틀림 → 맞는 비밀번호: 잠기지 않음 ──
{
  const B = `lm${n}`;
  await member(B);
  const { ctx, page } = await fresh();
  for (let i = 0; i < 3; i++) await uiSignIn(page, B, WRONG);
  const first = await uiSignIn(page, B, PW);
  await page.goto(`${BASE}/feed`); // 마을에는 헤더 막대가 없다 (사용자 요청 2026-10-08)
  await page.getByRole("banner").getByRole("button", { name: "로그아웃" }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 15000 }).catch(() => {});
  const fails = [];
  for (let i = 0; i < 4; i++) fails.push(await uiSignIn(page, B, WRONG));
  const last = await uiSignIn(page, B, PW);
  check("3 3번 실패 뒤 성공", first === "town", first);
  check("3 성공 뒤 4번 실패는 보통 실패 문구", fails.every((o) => o === MSG.fail), fails.join(" / "));
  check("3 그 뒤 맞는 비밀번호로 로그인됨 (잠기지 않음)", last === "town", last);
  await ctx.close();
}

// ── 4) 없는 아이디로 5번 → 6번째: 1과 같은 잠금 문구 ──
{
  const ghost = `nx${n}`;
  const { ctx, page } = await fresh();
  const outs = [];
  for (let i = 0; i < 5; i++) outs.push(await uiSignIn(page, ghost, WRONG));
  const sixth = await uiSignIn(page, ghost, WRONG);
  check("4 없는 아이디 1~5번째 보통 실패 문구", outs.every((o) => o === MSG.fail), outs.join(" / "));
  check("4 없는 아이디 6번째 잠금 문구 (문자열 같음)", sixth === MSG.locked, sixth);
  check("4 회원은 생기지 않음", !(await one("SELECT 1 FROM users WHERE username = $1", [ghost])));
  await ctx.close();
}

// ── 5) 같은 아이디로 틀린 시도 10개 동시 → 실패 문구 최대 5개, 나머지 잠금. 그 뒤 맞는 비밀번호도 잠금 ──
{
  const C = `lc${n}`;
  await member(C);
  const outs = await Promise.all(Array.from({ length: 10 }, () => directSignIn(C, WRONG)));
  const fails = outs.filter((o) => o === "fail").length;
  const locked = outs.filter((o) => o === "locked").length;
  check("5 동시 10개: 실패 문구 최대 5개, 나머지 잠금", fails <= 5 && fails + locked === 10, `실패 ${fails}, 잠금 ${locked}, ${outs.join(",")}`);
  const after = await directSignIn(C, PW);
  check("5 그 뒤 맞는 비밀번호도 잠금 문구", after === "locked", after);
}

// ── 6) Server Action을 화면 없이 직접 5번 → 화면에서 맞는 비밀번호: 잠금 문구 ──
const D = `ld${n}`;
await member(D);
{
  const outs = [];
  for (let i = 0; i < 5; i++) outs.push(await directSignIn(D, WRONG));
  check("6 직접 요청 5번 모두 보통 실패", outs.every((o) => o === "fail"), outs.join(","));
  const { ctx, page } = await fresh();
  const out = await uiSignIn(page, D, PW);
  check("6 그 뒤 화면에서 맞는 비밀번호: 잠금 문구", out === MSG.locked, out);
  await ctx.close();
}

// ── 7) 잠긴 아이디로 /api/auth/sign-in/username → 404 ──
{
  const res = await fetch(`${BASE}/api/auth/sign-in/username`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ username: D, password: PW }),
  });
  check("7 라이브러리 로그인 HTTP → 404", res.status === 404, `HTTP ${res.status}`);
}

// ── 8) 서로 다른 아이디 6개 + 같은 아이디 6개 동시 로그인 → 30초 안에 모두 응답, 서버가 멈추지 않음 ──
{
  const E = `le${n}`;
  await member(E);
  const started = Date.now();
  const timeout = (ms) => new Promise((resolve) => setTimeout(() => resolve("timeout"), ms));
  const reqs = [
    ...Array.from({ length: 6 }, (_, i) => directSignIn(`lx${n}_${i}`, WRONG)),
    ...Array.from({ length: 6 }, () => directSignIn(E, WRONG)),
  ];
  const outs = await Promise.race([Promise.all(reqs), timeout(30_000)]);
  const elapsed = Date.now() - started;
  check("8 12개 동시 요청이 30초 안에 모두 응답", Array.isArray(outs) && outs.every((o) => o === "fail" || o === "locked"), `${elapsed}ms ${Array.isArray(outs) ? outs.join(",") : outs}`);
  // 다른 회원 화면이 열리는지 (DB 연결 풀이 멈추지 않았는지)
  const { ctx, page } = await fresh();
  const out = await uiSignIn(page, A, PW);
  const res = out === "town" ? await page.goto(`${BASE}/write`, { timeout: 30_000 }) : null;
  check("8 그 뒤 다른 회원 로그인·화면 열림", out === "town" && res?.status() === 200 && new URL(page.url()).pathname === "/write", out);
  await ctx.close();
}

// ── (추가) 없는 아이디로 실패한 뒤 그 아이디로 가입 → 실패 기록이 지워져 예전 실패를 물려받지 않음 (data-model 2.6 순서 3) ──
{
  const F = `lf${n}`;
  for (let i = 0; i < 3; i++) await directSignIn(F, WRONG);
  const before = await attemptRow(F);
  await member(F); // 로그인 실패 → 회원가입
  check("가입하면 그 아이디의 실패 기록 삭제", before?.failed_count >= 3 && !(await attemptRow(F)), `가입 전 ${before?.failed_count}`);
}

console.log(results.join("\n"));
await browser.close();
await db.end();
if (results.some((r) => r.startsWith("❌"))) process.exitCode = 1;
