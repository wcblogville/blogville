// 관리자 테스트 지급 (AUTH-10): 관리자가 회원에게 코인·경험치를 넣고, 레벨업 알림·내역·권한을 확인한다
// 사용: 개발 서버를 띄운 상태에서 node e2e/admin-grant.mjs <스크린샷 폴더>. DB는 .env.local의 DATABASE_URL로 확인한다
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, coins, collectErrors, loginDev } from "./helpers.mjs";

// 관리자 비밀번호는 코드에 쓰지 않고 .env.local에서 읽는다
config({ path: ".env.local", quiet: true });
const ADMIN = { username: process.env.ADMIN_USERNAME ?? "admin", password: process.env.ADMIN_PASSWORD ?? "" };
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, params) => (await db.query(q, params)).rows[0];

const outDir = process.argv[2] ?? "e2e-shots";
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "✅" : "❌"} ${name}${detail ? ` (${detail})` : ""}`);

async function fresh(viewport = { width: 1280, height: 860 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  return { ctx, page, errors: collectErrors(page) };
}

const wallet = (username) =>
  one(
    `SELECT COALESCE(SUM(l.coin_delta), 0)::int AS coins, COALESCE(SUM(l.exp_delta), 0)::int AS exp,
            (SELECT COUNT(*)::int FROM notifications n WHERE n.user_id = u.id AND n.kind = 'level_up') AS level_ups,
            (SELECT COUNT(*)::int FROM point_ledger g WHERE g.user_id = u.id AND g.reason = 'admin_grant') AS grants
       FROM users u LEFT JOIN point_ledger l ON l.user_id = u.id WHERE u.username = $1 GROUP BY u.id`,
    [username],
  );

// 2번에서 잡은 관리자의 지급 요청(받을 회원 = MEMBER, 코인 5,000·경험치 120)을 그 페이지의 로그인으로 그대로 다시 보낸다
const replayGrant = (page) =>
  page.evaluate(
    async ({ actionId, contentType, body }) =>
      (await fetch(location.href, { method: "POST", headers: { "Next-Action": actionId, Accept: "text/x-component", "Content-Type": contentType }, body })).status,
    grantAction,
  );

// 실행마다 새 회원 (DB를 비우지 않고 여러 번 돌려도 같은 결과)
const MEMBER = `ag${Date.now() % 100_000_000}`;
let grantAction = null;

// 1) 새 회원 가입. 일반 회원은 /admin 404
{
  const { ctx, page } = await fresh();
  await loginDev(page, MEMBER);
  const res = await page.goto(`${BASE}/admin`);
  check("1 일반 회원 /admin → 404", res?.status() === 404 && (await page.getByText("테스트 지급").count()) === 0);
  await ctx.close();
}

// 2) 관리자: 폼 보이기 → 숫자 지급 → [+10,000 코인] → [Lv.99까지 경험치] → 잘못된 입력
{
  const { ctx, page, errors } = await fresh();
  await page.goto(BASE);
  await page.getByLabel("아이디").fill(ADMIN.username);
  await page.getByLabel("비밀번호", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL(/town/, { timeout: 20000 }).catch(() => {});
  await page.goto(`${BASE}/admin`);
  const form = page.locator("[data-admin-grant]");
  // 제목 앞 🧪는 도트 시험관 그림이 되었다 (2026-10-12 도트 화면)
  check("2 관리자 화면에 `🧪 테스트 지급`", await page.getByRole("heading", { name: "테스트 지급", exact: true }).isVisible());
  check("2 시험용이라는 한 줄 설명", await page.getByText("기능을 시험해 볼 때 쓰는 관리자 전용 도구예요").isVisible());
  await page.locator("section", { has: form }).screenshot({ path: `${outDir}/admin-grant-form.png` });

  const before = await wallet(MEMBER);
  await form.getByLabel("받을 회원 아이디").fill(MEMBER.toUpperCase()); // 대문자도 같은 아이디
  await form.getByLabel("코인").fill("5000");
  await form.getByLabel("경험치").fill("120"); // 0 → 120: Lv.4 (20·60·120)
  const requestP = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
  await form.getByRole("button", { name: "지급하기" }).click();
  const req = await requestP;
  grantAction = { actionId: req.headers()["next-action"], contentType: req.headers()["content-type"], body: req.postData() };
  await form.locator("[data-grant-result]").waitFor({ timeout: 15000 });
  const after = await wallet(MEMBER);
  check("2 코인 +5,000 (DB)", after.coins - before.coins === 5000, `${before.coins} → ${after.coins}`);
  check("2 경험치 +120 (DB)", after.exp - before.exp === 120, `${before.exp} → ${after.exp}`);
  check("2 레벨업 알림이 같이 생김 (Lv.2·3·4)", after.level_ups - before.level_ups === 3, `${after.level_ups - before.level_ups}개`);
  check("2 원장 사유 admin_grant 1줄", after.grants === 1);
  check("2 결과에 지금 레벨·코인", (await form.locator("[data-grant-level]").innerText()) === "Lv.4" && (await form.locator("[data-grant-coins]").innerText()) === after.coins.toLocaleString());
  await page.locator("section", { has: form }).screenshot({ path: `${outDir}/admin-grant-result.png` });
  // 대조군: 같은 요청을 관리자 로그인으로 다시 보내면 지급된다 (3번의 조작 시험이 요청 모양 탓에 실패하는 게 아님을 확인)
  await replayGrant(page);
  const replayed = await wallet(MEMBER);
  check("2 같은 요청을 관리자가 다시 보내면 지급됨 (대조군)", replayed.coins - after.coins === 5000, `${after.coins} → ${replayed.coins}`);

  check("2 지급 뒤에도 받을 회원 아이디가 남음", (await form.getByLabel("받을 회원 아이디").inputValue()) === MEMBER.toUpperCase());
  check("2 지급 뒤 코인·경험치 칸은 비움", (await form.getByLabel("코인").inputValue()) === "" && (await form.getByLabel("경험치").inputValue()) === "");
  await form.getByRole("button", { name: "+10,000 코인" }).click();
  await form.getByText("코인 +10,000").waitFor({ timeout: 15000 });
  const afterCoins = await wallet(MEMBER);
  check("2 [+10,000 코인]", afterCoins.coins - replayed.coins === 10000, `${replayed.coins} → ${afterCoins.coins}`);

  await form.getByRole("button", { name: "Lv.99까지 경험치" }).click();
  await form.locator("[data-grant-level]", { hasText: "Lv.99" }).waitFor({ timeout: 20000 });
  const maxed = await wallet(MEMBER);
  check("2 [Lv.99까지 경험치] → 경험치 97,020", maxed.exp === 97020, String(maxed.exp));
  check("2 Lv.99까지 레벨업 알림 98개 (Lv.2~99)", maxed.level_ups - before.level_ups === 98, String(maxed.level_ups - before.level_ups));
  await form.getByRole("button", { name: "Lv.99까지 경험치" }).click();
  await form.getByText("경험치 +0").waitFor({ timeout: 15000 }).catch(() => {});
  check("2 이미 Lv.99면 더 주지 않음", (await wallet(MEMBER)).exp === 97020);

  await form.getByLabel("받을 회원 아이디").fill("nobody_here_zz");
  await form.getByLabel("코인").fill("10");
  await form.getByRole("button", { name: "지급하기" }).click();
  check("2 없는 아이디 → 문구", await form.getByText("'nobody_here_zz' 아이디의 회원이 없어요").waitFor({ timeout: 15000 }).then(() => true).catch(() => false));

  // 빈 아이디 = 관리자 자신. 헤더 코인이 바로 바뀐다 (revalidatePath)
  const adminBefore = await wallet(ADMIN.username);
  await form.getByLabel("받을 회원 아이디").fill("");
  await form.getByLabel("코인").fill("7");
  await form.getByLabel("경험치").fill("");
  await form.getByRole("button", { name: "지급하기" }).click();
  await form.getByText(`(@${ADMIN.username})에게 코인 +7`).waitFor({ timeout: 15000 }).catch(() => {});
  check("2 빈 아이디 → 관리자 자신에게", (await wallet(ADMIN.username)).coins - adminBefore.coins === 7);
  const headerCoins = await coins(page);
  check("2 헤더 코인도 바뀜", headerCoins === adminBefore.coins + 7, String(headerCoins));

  // 375px: 가로 스크롤 없음, 버튼 44px·한 줄
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`${BASE}/admin`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check("2 375px 가로 스크롤 없음", !overflow);
  const phoneCoins = await page.getByRole("banner").getByTitle("코인").locator("span:visible").last().innerText();
  check("2 375px 헤더 코인은 짧게 (1만 이상이면 `만`)", headerCoins < 10_000 || phoneCoins.endsWith("만"), phoneCoins);
  const btns = await form.getByRole("button").evaluateAll((els) => els.map((b) => b.getBoundingClientRect().height));
  check("2 375px 버튼 높이 44px 이상", btns.length === 3 && btns.every((h) => h >= 44), btns.join(","));
  await page.locator("section", { has: form }).screenshot({ path: `${outDir}/admin-grant-375.png` });
  check("2 관리자 콘솔 오류 없음", errors.length === 0);
  if (errors.length) console.log(errors.join("\n"));
  await ctx.close();
}

// 3) 일반 회원이 지급 Server Action을 조작해 보내도 코인이 그대로
{
  const { ctx, page } = await fresh();
  await loginDev(page, MEMBER);
  const before = await wallet(MEMBER);
  if (grantAction) {
    const status = await replayGrant(page);
    check("3 조작한 지급 요청(일반 회원 로그인): 코인 그대로", (await wallet(MEMBER)).coins === before.coins, `HTTP ${status}`);
  } else {
    check("3 조작 요청 준비(2번의 Server Action)", false);
  }
  // 내 내역에 `👑 관리자 테스트 지급`
  await page.goto(`${BASE}/wallet`);
  check("3 내역에 `👑 관리자 테스트 지급`", (await page.getByText("👑 관리자 테스트 지급").count()) > 0);
  await ctx.close();
}

console.log(results.join("\n"));
await browser.close();
await db.end();
if (results.some((r) => r.startsWith("❌"))) process.exitCode = 1;
