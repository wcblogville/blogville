// SOC-04 이웃: 버튼으로 추가·취소, 조작한 요청은 저장하지 않는다 (#22)
// 사용: 개발 서버를 띄운 상태에서 node e2e/blog.mjs 를 한 번 돌린 뒤 (tester1 블로그 필요) node e2e/social.mjs <스크린샷 폴더>
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const userId = async (username) => (await db.query("SELECT id FROM users WHERE username = $1", [username])).rows[0]?.id;
const followCount = async (followerId, followeeId) =>
  (await db.query("SELECT count(*)::int AS n FROM follows WHERE follower_id = $1 AND followee_id = $2", [followerId, followeeId])).rows[0].n;

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();

// 온보딩 전 회원: 가입만 하고 멈춘다
const pre = await browser.newPage();
await pre.goto(BASE);
await pre.getByLabel("아이디").fill("preonboard01");
await pre.getByLabel("비밀번호", { exact: true }).fill("test-password-1234");
await pre.getByRole("button", { name: "로그인", exact: true }).click();
await pre.locator('canvas, input[name="nickname"]').or(pre.getByText("아이디 또는 비밀번호가")).first().waitFor({ timeout: 20000 });
if (await pre.getByText("아이디 또는 비밀번호가").isVisible()) {
  await pre.getByRole("tab", { name: "회원가입" }).click();
  await pre.getByLabel("아이디").fill("preonboard01");
  await pre.getByLabel("비밀번호", { exact: true }).fill("test-password-1234");
  await pre.getByLabel("비밀번호 확인").fill("test-password-1234");
  await pre.getByRole("button", { name: "회원가입", exact: true }).click();
  await pre.locator('input[name="nickname"]').waitFor({ timeout: 20000 });
}
const preId = await userId("preonboard01");

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = collectErrors(page);
await loginDev(page, "tester2", "여자 주민");
const me = await userId("tester2");
const owner = await userId("tester1");
await db.query("DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2", [me, owner]);

// ── 버튼으로 이웃 추가 → 취소 ──
const followButton = () => page.locator("form", { has: page.getByRole("button", { name: /이웃/ }) }).first().getByRole("button");
await page.goto(`${BASE}/@tester1`);
const requestP = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
await followButton().click();
const request = await requestP;
await page.getByRole("button", { name: "✓ 이웃" }).waitFor();
check("SOC-04 [+ 이웃 추가]를 누르면 이웃이 된다", (await followCount(me, owner)) === 1);
await page.screenshot({ path: `${outDir}/60-follow.png` });
await followButton().click();
await page.getByRole("button", { name: "+ 이웃 추가" }).waitFor();
check("SOC-04 [✓ 이웃]을 다시 누르면 취소된다", (await followCount(me, owner)) === 0);

// ── 조작한 요청: 상대 회원 ID만 바꿔 같은 Server Action을 부른다 ──
const forge = (targetId) =>
  page.evaluate(
    async ({ actionId, contentType, body }) => {
      const r = await fetch(location.href, {
        method: "POST",
        headers: { "Next-Action": actionId, Accept: "text/x-component", "Content-Type": contentType },
        body,
      });
      return r.status;
    },
    {
      actionId: request.headers()["next-action"],
      contentType: request.headers()["content-type"],
      body: request.postData().split(owner).join(targetId),
    },
  );

const missingStatus = await forge("no-such-user-id");
check("SOC-04 없는 회원 ID로 보내도 오류 없이 무시", missingStatus === 200 && (await followCount(me, "no-such-user-id")) === 0, `HTTP ${missingStatus}`);
const preStatus = await forge(preId);
check("SOC-04 온보딩 전(블로그 없는) 회원 ID로 보내도 저장되지 않음", preStatus === 200 && (await followCount(me, preId)) === 0, `HTTP ${preStatus}`);

console.log(results.join("\n"));
console.log("errors:", errors.length ? errors : "none");
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
