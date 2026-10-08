// 마을 개편 1차 (사용자 요청 2026-10-08): 집 11채 원형 배치, 정류장 텔레포트, 우체통, ☰ 메뉴(프로필·알림·텔레포트·친구), ⭐ 즐겨찾기
// 사용: 개발 서버를 띄운 상태에서 node e2e/town.mjs <스크린샷 폴더>
// 실행마다 새 회원 A와 이웃 B~L(11명)을 만들고, 이웃 관계·글은 pg로 넣어 준비한다
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { BASE, collectErrors, loginDev } from "./helpers.mjs";

config({ path: ".env.local", quiet: true });
const outDir = process.argv[2] ?? "e2e-shots";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async (q, p) => (await db.query(q, p)).rows[0];

const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "✅" : "❌"} ${name}${extra ? ` (${extra})` : ""}`);
const browser = await chromium.launch();
const n = Date.now() % 100_000_000;
const A = `twa${n}`;
const neighbors = "bcdefghijkl".split("").map((c) => `tw${c}${n}`); // 11명

const userId = async (username) => (await one("SELECT id FROM users WHERE username = $1", [username])).id;
const blogOf = async (username) => (await one("SELECT b.id FROM blogs b JOIN users u ON u.id = b.owner_id WHERE u.username = $1", [username])).id;

// 이웃 11명 가입 (브라우저 하나로 차례로)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const id of neighbors) {
    const page = await ctx.newPage();
    collectErrors(page);
    await loginDev(page, id);
    await ctx.clearCookies();
    await page.close();
  }
  await ctx.close();
}

// A 가입: 데스크톱
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await loginDev(page, A);
const aId = await userId(A);
const ids = Object.fromEntries(await Promise.all(neighbors.map(async (u) => [u, await userId(u)])));
const B = neighbors[0];
const menu = () => page.getByRole("button", { name: /메뉴/ });
const panel = () => page.locator("[data-town-panel]");
async function openMenu(item) {
  if (!(await panel().isVisible())) await menu().click();
  if ((await panel().getAttribute("data-town-panel")) !== "menu") await panel().getByRole("button", { name: "메뉴로" }).click();
  if (item) await panel().getByRole("button", { name: new RegExp(item) }).click();
}

// 이웃이 없을 때: 둘레 10자리는 모두 빈 집터
await page.locator("canvas").waitFor();
await openMenu("텔레포트");
const houseButtons = panel().locator('[data-spot^="house:"]');
check("텔레포트 목록: 마을 5곳 + 집 11자리", (await panel().locator('[data-spot]:not([data-spot^="house:"])').count()) === 5 && (await houseButtons.count()) === 11);
const disabled = await houseButtons.evaluateAll((els) => els.filter((e) => e.disabled).length);
check("이웃이 없으면 빈 집터 10자리 (누를 수 없음), 내 집은 누를 수 있음", disabled === 10 && (await panel().locator('[data-spot="house:0"]').isEnabled()));
await page.screenshot({ path: `${outDir}/town-teleport.png` });

// 프로필: 헤더와 같은 코인, 경험치 n/m
await openMenu("내 프로필");
const banner = await page.getByRole("banner").innerText();
const coinText = await panel().locator("[data-profile-coins]").innerText();
const expText = await panel().locator("[data-profile-exp]").innerText();
check("프로필: 코인이 헤더와 같음", banner.includes(coinText), `${coinText}`);
check("프로필: 경험치 `현재 / 필요`", /^[\d,]+ \/ [\d,]+$/.test(expText), expText);

// 알림: 알림 없음 안내와 알림함 링크
await openMenu("알림");
check("알림 창: 알림함 링크", (await panel().getByRole("link", { name: /알림함 전체 보기/ }).getAttribute("href")) === "/notifications");

// 친구: 이웃이 없으면 안내
await openMenu("친구 목록");
check("친구 목록: 이웃 없음 안내", await panel().getByText("아직 이웃이 없어요").isVisible());
await page.keyboard.press("Escape");
check("Esc로 메뉴 창 닫힘", (await panel().count()) === 0);

// 준비: A가 11명을 이웃으로 추가, B는 A를 맞이웃. B에게 공개 글 2개
for (const [i, u] of neighbors.entries()) {
  await db.query("INSERT INTO follows (follower_id, followee_id, created_at) VALUES ($1, $2, now() - make_interval(mins => $3))", [aId, ids[u], 100 - i]);
}
await db.query("INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)", [ids[B], aId]);
for (const title of ["B의 첫 글", "B의 둘째 글"]) {
  await db.query("INSERT INTO posts (blog_id, title, content_html, content_text) VALUES ($1, $2, '<p>x</p>', 'x')", [await blogOf(B), title]);
}
await page.reload();
await page.locator("canvas").waitFor();

await openMenu("친구 목록");
check("친구 목록: 이웃 11명", (await panel().locator("[data-friend]").count()) === 11);
check("친구 목록: 맞이웃 표시", await panel().locator(`[data-friend="${B}"]`).getByText("서로 이웃").isVisible());

// ⭐ 즐겨찾기: B를 켜면 둘레 집이 생기고 DB가 바뀐다
await panel().getByRole("button", { name: `${B} 즐겨찾기`, exact: true }).click();
await panel().getByRole("button", { name: `${B} 즐겨찾기 끄기` }).waitFor({ timeout: 10000 });
const fav = await one("SELECT is_favorite FROM follows WHERE follower_id = $1 AND followee_id = $2", [aId, ids[B]]);
check("⭐ 누르면 즐겨찾기 저장", fav.is_favorite === true);
await page.waitForLoadState("networkidle");
await openMenu("텔레포트");
check("즐겨찾기한 B의 집이 1번 자리", (await panel().locator('[data-spot="house:1"]').innerText()).includes(`${B}의 집`));

// 10명 제한: 나머지 9명을 DB로 켜고, 11번째를 누르면 안내
await db.query("UPDATE follows SET is_favorite = true WHERE follower_id = $1 AND followee_id = ANY($2)", [aId, neighbors.slice(1, 10).map((u) => ids[u])]);
await page.reload();
await page.locator("canvas").waitFor();
await openMenu("친구 목록");
const last = neighbors[10];
await panel().getByRole("button", { name: `${last} 즐겨찾기`, exact: true }).click();
await panel().getByRole("alert").waitFor({ timeout: 10000 });
check("즐겨찾기 11번째는 `10명까지` 안내, 저장 안 됨", (await panel().getByRole("alert").innerText()).includes("10명까지") &&
  (await one("SELECT is_favorite FROM follows WHERE follower_id = $1 AND followee_id = $2", [aId, ids[last]])).is_favorite === false);
await page.screenshot({ path: `${outDir}/town-friends.png` });

// 텔레포트 목록: 둘레 10자리가 모두 집
await openMenu("텔레포트");
const disabled2 = await houseButtons.evaluateAll((els) => els.filter((e) => e.disabled).length);
check("즐겨찾기 10명이면 빈 집터 없음", disabled2 === 0);

// 정류장으로 텔레포트 → Space → 집 11채 목록
await panel().locator('[data-spot="signpost"]').click();
check("텔레포트하면 창이 닫힘", (await panel().count()) === 0);
await page.waitForTimeout(500);
await page.locator("canvas").focus().catch(() => {});
await page.keyboard.press("Space");
await panel().waitFor({ timeout: 5000 }).catch(() => {});
check("정류장에서 Space → 집 11채 목록", (await panel().getAttribute("data-town-panel").catch(() => null)) === "signpost" &&
  (await panel().locator('[data-spot^="house:"]').count()) === 11);
await page.screenshot({ path: `${outDir}/town-signpost.png` });

// 정류장 목록에서 B의 집 → 문 앞에서 Space → B의 블로그
await panel().locator('[data-spot="house:1"]').click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/town-house-front.png` });
await page.keyboard.press("Space");
await page.waitForURL(new RegExp(`/@${B}$`), { timeout: 10000 }).catch(() => {});
check("집 앞에서 Space → 그 사람 블로그", page.url().endsWith(`/@${B}`), page.url());

// 방문자: 메뉴에 텔레포트와 로그인만
{
  const g = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const gp = await g.newPage();
  const gErrors = collectErrors(gp);
  await gp.goto(`${BASE}/town`);
  await gp.locator("canvas").waitFor();
  await gp.getByRole("button", { name: /메뉴/ }).click();
  const items = await gp.locator("[data-town-panel]").getByRole("listitem").allInnerTexts();
  check("방문자 메뉴: 텔레포트·로그인", items.length === 2 && items[0].includes("텔레포트") && items[1].includes("로그인"), items.join("|"));
  errors.push(...gErrors);
  await g.close();
}

// 휴대폰: 간단 메뉴에 알림·프로필 숫자·친구 목록
{
  const m = await browser.newContext({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true });
  const mp = await m.newPage();
  errors.push(...collectErrors(mp));
  await loginDev(mp, A);
  await mp.goto(`${BASE}/town`);
  const menuBox = mp.locator("[data-town-menu]");
  await menuBox.waitFor();
  const text = await menuBox.innerText();
  check("휴대폰: Lv·코인·경험치, 알림, 친구 목록", /Lv\.\d+ · 🪙/.test(text) && text.includes("알림") && text.includes("친구 목록") && (await menuBox.locator("[data-friend]").count()) === 11);
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("휴대폰: 가로 스크롤 없음", overflow <= 0, String(overflow));
  await mp.screenshot({ path: `${outDir}/town-phone.png`, fullPage: true });
  await m.close();
}

const pageErrors = errors.filter((e) => e.startsWith("pageerror"));
check("화면 오류 없음", pageErrors.length === 0, pageErrors.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
