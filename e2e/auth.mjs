// 회원가입·로그인·관리자 권한 (AUTH-01, AUTH-02, AUTH-08 / quickstart 4.1)
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import { BASE, collectErrors } from "./helpers.mjs";

// 관리자 비밀번호는 코드에 쓰지 않고 .env.local에서 읽는다
config({ path: ".env.local", quiet: true });
const ADMIN = { username: process.env.ADMIN_USERNAME ?? "admin", password: process.env.ADMIN_PASSWORD ?? "" };

const outDir = process.argv[2] ?? "e2e-shots";
const browser = await chromium.launch();
const results = [];
const check = (name, ok) => results.push(`${ok ? "✅" : "❌"} ${name}`);

async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  return { ctx, page, errors: collectErrors(page) };
}

// 실행마다 새 아이디 (DB를 비우지 않고 여러 번 돌려도 같은 결과)
const NEWBIE = `au${Date.now() % 100_000_000}`;
const NEWBIE_PW = "newbie-pass-1";

async function signUp(page, id, pw, confirm = pw) {
  await page.goto(BASE);
  await page.getByRole("tab", { name: "회원가입" }).click();
  await page.getByLabel("아이디").fill(id);
  await page.getByLabel("비밀번호", { exact: true }).fill(pw);
  await page.getByLabel("비밀번호 확인").fill(confirm);
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
}

async function signIn(page, id, pw) {
  await page.goto(BASE);
  await page.getByLabel("아이디").fill(id);
  await page.getByLabel("비밀번호", { exact: true }).fill(pw);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
}

// 1) 새 회원가입 → 온보딩 없이 바로 광장, 환영 문구
{
  const { ctx, page, errors } = await fresh();
  await page.goto(BASE);
  await page.getByRole("tab", { name: "회원가입" }).click();
  await page.screenshot({ path: `${outDir}/40-signup.png` });
  await signUp(page, NEWBIE, NEWBIE_PW);
  await page.waitForURL(/\/town/, { timeout: 15000 }).catch(() => {});
  check("회원가입 후 바로 광장(/town)으로 이동", new URL(page.url()).pathname === "/town");
  check(
    "광장에 환영 문구",
    await page
      .getByText(/님, Blogville에 오신 걸 환영해요!/)
      .filter({ visible: true }) // 휴대폰용 메뉴의 같은 문구는 숨어 있다
      .first()
      .waitFor({ timeout: 10000 })
      .then(() => true)
      .catch(() => false),
  );
  check("환영 문구에 닉네임(= 아이디)", (await page.getByText(`${NEWBIE}님, Blogville에 오신 걸 환영해요!`).count()) > 0);
  await page.screenshot({ path: `${outDir}/40-signup-town.png` });
  check("콘솔 오류 없음", errors.length === 0);
  if (errors.length) console.log(errors.join("\n"));
  await ctx.close();
}

// 2) 같은 아이디로 다시 가입 → 오류, 비밀번호 확인 불일치 → 오류
{
  const { ctx, page } = await fresh();
  await signUp(page, NEWBIE, "another-pass-1");
  check("중복 아이디 거부", await page.getByText("이미 있는 아이디예요").waitFor({ timeout: 10000 }).then(() => true).catch(() => false));
  await signUp(page, `${NEWBIE}x`, "pass-word-1", "pass-word-2");
  check("비밀번호 확인 불일치 거부", await page.getByText("비밀번호가 서로 달라요").waitFor({ timeout: 10000 }).then(() => true).catch(() => false));
  await ctx.close();
}

// 3) 틀린 비밀번호 → 오류, 맞으면 로그인 → 광장, 헤더에 레벨·코인·캐릭터
{
  const { ctx, page } = await fresh();
  await signIn(page, NEWBIE, "wrong-password");
  check("틀린 비밀번호 거부", await page.getByText("아이디 또는 비밀번호가 맞지 않아요").waitFor({ timeout: 10000 }).then(() => true).catch(() => false));
  await signIn(page, NEWBIE, NEWBIE_PW);
  await page.waitForURL(/\/town/, { timeout: 15000 }).catch(() => {});
  check("맞는 비밀번호로 로그인 → 광장", new URL(page.url()).pathname === "/town");
  const banner = page.getByRole("banner");
  check(
    "헤더에 레벨·코인 100",
    (await banner.getByTitle("레벨").isVisible()) && (await banner.getByTitle("코인").innerText()).includes("100"),
  );
  await ctx.close();
}

// 3-2) 일반 회원도 /admin은 404
{
  const { ctx, page } = await fresh();
  const { loginDev } = await import("./helpers.mjs");
  await loginDev(page, "normal01");
  const res = await page.goto(`${BASE}/admin`);
  check("일반 회원 /admin → 404", res?.status() === 404 && (await page.getByText("최근 가입").count()) === 0);
  check("일반 회원 헤더에 관리자 배지 없음", (await page.getByRole("link", { name: "👑 관리자" }).count()) === 0);
  await ctx.close();
}

// 4) 관리자 로그인 → 광장, 관리자 배지, /admin
{
  const { ctx, page, errors } = await fresh();
  await signIn(page, ADMIN.username, ADMIN.password);
  await page.waitForURL(/town/, { timeout: 15000 }).catch(() => {});
  check("관리자 로그인 → 광장", page.url().includes("/town"));
  check("헤더에 관리자 배지", await page.getByRole("link", { name: "👑 관리자" }).isVisible());
  await page.getByRole("link", { name: "👑 관리자" }).click();
  await page.waitForURL(/admin/);
  await page.getByText("최근 가입").waitFor();
  await page.screenshot({ path: `${outDir}/41-admin.png`, fullPage: true });
  check("관리자 페이지 열림", true);
  check("관리자 콘솔 오류 없음", errors.length === 0);
  await ctx.close();
}

console.log(results.join("\n"));
await browser.close();
