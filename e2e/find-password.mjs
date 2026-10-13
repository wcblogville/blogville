// 비밀번호 찾기 (AUTH-12): 로그인 카드 링크 → /find-password, 새 세션 10분 안의 새 비밀번호, 관리자 임시 비밀번호
// 사용: 개발 서버를 띄운 상태에서 node e2e/find-password.mjs <스크린샷 폴더>
// 소셜 키 없이 확인한다. "간편 로그인 직후"는 아이디 로그인 직후의 새 세션으로 대신한다 (화면·서버 확인은 세션 시각만 본다).
// 10분이 지난 세션은 DB에서 sessions.created_at을 11분 전으로 옮겨 만든다. DB는 .env.local의 DATABASE_URL (실행 환경 값이 먼저).
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
mkdirSync(outDir, { recursive: true });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();

const n = Date.now() % 100_000_000;
const ID = `fp${n}`;
const PW = "find-pass-1234";
const NEW_PW = "brand-new-5678";
const ADMIN = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PW = process.env.ADMIN_PASSWORD;

const one = async (q, params) => (await db.query(q, params)).rows[0];
const userId = async (name = ID) => (await one("SELECT id FROM users WHERE username = $1", [name])).id;
const sessionCount = async (name = ID) => (await one("SELECT count(*)::int AS c FROM sessions WHERE user_id = $1", [await userId(name)])).c;

async function fresh(viewport = { width: 1280, height: 860 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  return { ctx, page, errors: collectErrors(page) };
}

/** 아이디 로그인만 (가입하지 않음). 성공하면 true */
async function login(page, id, pw) {
  await page.goto(BASE);
  await page.getByLabel("아이디").fill(id);
  await page.getByLabel("비밀번호", { exact: true }).fill(pw);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL(/\/town|\/@/, { timeout: 15000 }).catch(() => {});
  return !(await page.getByText("아이디 또는 비밀번호가").isVisible());
}
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

try {
  // 1. 로그인 카드의 링크
  {
    const { ctx, page, errors } = await fresh();
    await page.goto(BASE);
    const link = page.getByRole("link", { name: "비밀번호를 잊었어요" });
    const box = await link.boundingBox();
    check("1. 로그인 카드에 `비밀번호를 잊었어요` 링크, 높이 44px 이상", (box?.height ?? 0) >= 44, `${box?.height}px`);
    await page.locator("#login").screenshot({ path: `${outDir}/01-login-card.png` });
    await link.focus();
    const outline = await link.evaluate((el) => getComputedStyle(el).outlineStyle);
    check("1-2. 키보드 초점 테두리", outline !== "none", outline);
    await link.click();
    await page.waitForURL(/\/find-password$/);
    await page.getByRole("heading", { name: "비밀번호 찾기" }).waitFor();
    const sections = await page.locator('[data-section="find-social"], [data-section="find-admin"]').count();
    check("2. /find-password: 간편 로그인·관리자 두 방법", sections === 2);
    await page.screenshot({ path: `${outDir}/02-find-password.png`, fullPage: true });
    check("2-1. 화면 오류 없음", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  // 3. 소셜 오류 문구 (연동 없음) + 375px
  {
    const { ctx, page } = await fresh({ width: 375, height: 812 });
    await page.goto(`${BASE}/find-password?provider=kakao&error=signup_disabled`);
    const text = await page.locator("[data-social-error]").textContent();
    check("3. 연동 없음 → 관리자 안내 문구", text?.includes("관리자에게 임시 비밀번호를") ?? false, text ?? "");
    check("3-1. 375px 가로 스크롤 없음", await noHScroll(page));
    const back = await page.getByRole("link", { name: "← 로그인 화면으로" }).boundingBox();
    check("3-2. 돌아가기 링크 44px 이상", (back?.height ?? 0) >= 44);
    await page.screenshot({ path: `${outDir}/03-find-password-375-error.png`, fullPage: true });
    await ctx.close();
  }

  // 4. 새 세션: 지금 비밀번호 없이 새 비밀번호 (다른 기기 세션은 끊긴다)
  const other = await fresh();
  await loginDev(other.page, ID, "남자 주민", PW); // 가입 + 다른 기기 세션
  const me = await fresh();
  check("4. 다시 로그인", await login(me.page, ID, PW));
  check("4-1. 세션 2개 (두 기기)", (await sessionCount()) === 2);
  // 로그인한 회원이 비밀번호 찾기에 오면 새 비밀번호 화면으로
  await me.page.goto(`${BASE}/find-password`);
  await me.page.waitForURL(/\/settings\/account\/new-password$/);
  check("4-2. 로그인한 채 /find-password → 새 비밀번호 화면", true);
  check("4-3. 새 세션이라 폼이 보인다", (await me.page.locator('[data-section="new-password"]').getAttribute("data-fresh")) === "1");
  await me.page.screenshot({ path: `${outDir}/04-new-password-fresh.png`, fullPage: true });
  await me.page.getByLabel("새 비밀번호", { exact: true }).fill(NEW_PW);
  await me.page.getByLabel("새 비밀번호 확인").fill("different-0000");
  await me.page.getByRole("button", { name: "새 비밀번호 정하기" }).click();
  await me.page.getByRole("alert").filter({ hasText: "비밀번호가 서로 달라요" }).waitFor();
  check("4-4. 확인이 다르면 `비밀번호가 서로 달라요`", true);
  await me.page.getByLabel("새 비밀번호", { exact: true }).fill(NEW_PW);
  await me.page.getByLabel("새 비밀번호 확인").fill(NEW_PW);
  await me.page.getByRole("button", { name: "새 비밀번호 정하기" }).click();
  await me.page.locator("[data-new-password-done]").waitFor();
  check("4-5. 새 비밀번호를 정했어요", true);
  await me.page.screenshot({ path: `${outDir}/05-new-password-done.png`, fullPage: true });
  check("4-6. 다른 기기 세션은 지워지고 이 세션만 남음", (await sessionCount()) === 1);
  await me.page.goto(`${BASE}/settings/account`);
  check("4-7. 이 브라우저는 로그인 유지", me.page.url().includes("/settings/account"));
  {
    const t = await fresh();
    check("4-8. 옛 비밀번호로는 로그인 안 됨", !(await login(t.page, ID, PW)));
    check("4-9. 새 비밀번호로 로그인", await login(t.page, ID, NEW_PW));
    await t.ctx.close();
  }

  // 5. 10분이 지난 세션: 화면은 안내, 저장은 서버가 거부
  await me.page.goto(`${BASE}/settings/account/new-password`);
  await me.page.locator('[data-section="new-password"][data-fresh="1"]').waitFor();
  await db.query("UPDATE sessions SET created_at = now() - interval '11 minutes' WHERE user_id = $1", [await userId()]);
  await me.page.getByLabel("새 비밀번호", { exact: true }).fill("stale-pass-0000");
  await me.page.getByLabel("새 비밀번호 확인").fill("stale-pass-0000");
  await me.page.getByRole("button", { name: "새 비밀번호 정하기" }).click();
  await me.page.getByRole("alert").filter({ hasText: "로그인한 지 오래됐어요" }).waitFor();
  check("5. 폼을 연 채 10분이 지나면 저장 거부 (서버 확인)", true);
  await me.page.reload();
  check("5-1. 다시 열면 안내만", (await me.page.locator("[data-stale]").count()) === 1);
  await me.page.screenshot({ path: `${outDir}/06-new-password-stale.png`, fullPage: true });
  {
    const t = await fresh();
    check("5-2. 거부된 비밀번호로는 로그인 안 됨", !(await login(t.page, ID, "stale-pass-0000")));
    await t.ctx.close();
  }
  await me.ctx.close();
  await other.ctx.close();

  // 6. 관리자 비밀번호 초기화
  if (!ADMIN_PW) {
    check("6. 관리자 비밀번호 초기화", false, ".env.local에 ADMIN_PASSWORD가 없어 건너뜀");
  } else {
    const member = await fresh();
    check("6-0. 회원 로그인 (끊길 세션)", await login(member.page, ID, NEW_PW));
    const adm = await fresh();
    check("6. 관리자 로그인", await login(adm.page, ADMIN, ADMIN_PW));
    await adm.page.goto(`${BASE}/admin`);
    const form = adm.page.locator("[data-admin-reset-password]");
    const submit = form.getByRole("button", { name: "임시 비밀번호 만들기" });
    await form.getByLabel("회원 아이디").fill("nobody_here_1");
    await submit.click();
    await form.getByRole("alert").filter({ hasText: "아이디의 회원이 없어요" }).waitFor();
    check("6-1. 없는 아이디 → 문구", true);
    await form.getByLabel("회원 아이디").fill(ADMIN.toUpperCase());
    await submit.click();
    await form.getByRole("alert").filter({ hasText: "내 계정은 여기서 초기화할 수 없어요" }).waitFor();
    check("6-2. 내 아이디 → 거부", true);
    await form.getByLabel("회원 아이디").fill(` ${ID.toUpperCase()} `);
    await submit.click();
    const temp = (await form.locator("[data-temp-password]").textContent())?.trim() ?? "";
    check("6-3. 임시 비밀번호 12자", /^[A-Za-z2-9]{12}$/.test(temp));
    await form.screenshot({ path: `${outDir}/07-admin-reset.png` });
    check("6-4. 그 회원의 세션 모두 지워짐", (await sessionCount()) === 0);
    await member.page.goto(`${BASE}/settings/account`);
    check("6-5. 회원 브라우저는 로그아웃", new URL(member.page.url()).pathname === "/");
    const t = await fresh();
    check("6-6. 이전 비밀번호로는 로그인 안 됨", !(await login(t.page, ID, NEW_PW)));
    check("6-7. 임시 비밀번호로 로그인", await login(t.page, ID, temp));
    const stored = await one("SELECT password FROM accounts WHERE user_id = $1 AND provider_id = 'credential'", [await userId()]);
    check("6-8. 원문이 아니라 해시로 저장", !!stored?.password && !stored.password.includes(temp));
    check("6-9. 관리자 화면 오류 없음", adm.errors.length === 0, adm.errors.join(" | "));
    await t.ctx.close();
    await adm.ctx.close();
    await member.ctx.close();
  }

  // 7. 관리자가 아니면 /admin은 404
  {
    const t = await fresh();
    await login(t.page, ID, "x".repeat(8));
    const res = await t.page.goto(`${BASE}/admin`);
    check("7. 로그인 안 한 사람의 /admin → 404", res?.status() === 404);
    await t.ctx.close();
  }
} catch (err) {
  check("예상 밖 오류", false, String(err).slice(0, 300));
} finally {
  console.log(results.join("\n"));
  await browser.close();
  await db.end();
  if (results.some((r) => r.startsWith("❌"))) process.exitCode = 1;
}
