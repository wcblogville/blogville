// 연못 낚시터 (사용자 요청 2026-10-08): 하루 한 번 낚시, 코인은 원장 fishing, 먹이는 수량 +1, 마을 텔레포트·건물
// 사용: 개발 서버를 띄운 상태에서 node e2e/fishing.mjs <스크린샷 폴더>
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
const N = `fs${Date.now() % 100_000_000}`;
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await loginDev(page, N);
const uid = (await one("SELECT id FROM users WHERE username = $1", [N])).id;
const coinSum = async () => (await one("SELECT COALESCE(SUM(coin_delta), 0)::int AS c FROM point_ledger WHERE user_id = $1", [uid])).c;
const feedQty = async () => (await one("SELECT COALESCE(SUM(ui.quantity), 0)::int AS q FROM user_items ui JOIN items i ON i.id = ui.item_id WHERE ui.user_id = $1 AND i.code = 'growth_feed'", [uid])).q;

// 마을: 텔레포트 목록에 낚시터
await page.goto(`${BASE}/town`);
await page.locator("canvas").waitFor();
await page.getByRole("button", { name: /메뉴/ }).click();
await page.locator("[data-town-panel]").getByRole("button", { name: /텔레포트/ }).click();
check("텔레포트 목록에 🎣 낚시터", await page.locator('[data-spot="fishing"]').isVisible());
await page.locator('[data-spot="fishing"]').click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}/fishing-town.png` });
await page.locator("canvas").focus().catch(() => {});
await page.keyboard.press("Space");
await page.waitForURL(/\/fishing$/, { timeout: 10000 }).catch(() => {});
check("낚시터 앞에서 Space → /fishing", page.url().endsWith("/fishing"), page.url());

// 낚싯대 던지기
await page.goto(`${BASE}/fishing`);
// 도트 그림 (2026-10-12 "낚을 수 있는 것들도 도트로"): 목록 6칸이 모두 도트 그림(그림 글자 없음), 연못에 찌가 떠 있다
const listArt = await page.locator("[data-catch]").evaluateAll((els) =>
  els.map((el) => ({ img: el.querySelector("img.pixelated")?.getAttribute("src")?.startsWith("data:image/svg+xml") ?? false, text: el.textContent })),
);
check("낚을 수 있는 것 6칸 모두 도트 그림", listArt.length === 6 && listArt.every((a) => a.img), `${listArt.length}칸`);
check("목록에 그림 글자(🐟 👢 🌱 ✨) 없음", listArt.every((a) => !/[🐟🐠👢🌱✨]/u.test(a.text)));
check("연못에 찌가 떠 있다 (data-bobber=float)", await page.locator('[data-bobber="float"]').isVisible());
await page.screenshot({ path: `${outDir}/fishing-1280.png`, fullPage: true });
const coinsBefore = await coinSum();
const feedBefore = await feedQty();
await page.getByRole("button", { name: /낚싯대 던지기/ }).click();
const result = page.locator("[data-fishing-result]");
await result.waitFor({ timeout: 10000 });
// 낚은 것이 물보라와 함께 튀어 오른다 (연출 중간을 찍는다)
await page.waitForTimeout(300);
await page.locator("[data-pond]").screenshot({ path: `${outDir}/fishing-reveal-mid.png` });
await page.waitForTimeout(800);
await page.locator("[data-pond]").screenshot({ path: `${outDir}/fishing-reveal.png` });
check("낚은 것 도트 그림이 연못 위에 나온다 (data-catch-art)", (await page.locator("[data-catch-art]").getAttribute("data-catch-art")) === (await result.getAttribute("data-fishing-result")));
const key = await result.getAttribute("data-fishing-result");
const row = await one("SELECT catch_key, coins FROM fishing_catches WHERE user_id = $1", [uid]);
check("낚시 기록 1행", row?.catch_key === key, `${key}`);
if (key === "feed") check("먹이 꾸러미 → 동물 먹이 +1", (await feedQty()) === feedBefore + 1);
else check("물고기 → 원장 fishing 코인", (await coinSum()) === coinsBefore + row.coins && row.coins > 0, `${coinsBefore} → ${await coinSum()}`);
await page.screenshot({ path: `${outDir}/fishing.png`, fullPage: true });

// 하루 한 번: 새로고침하면 버튼 없음, 요청을 다시 보내도 1행
await page.reload();
check("오늘 이미 낚시하면 던지기 버튼 없음", (await page.getByRole("button", { name: /낚싯대 던지기/ }).count()) === 0 && (await result.isVisible()));
const blocked = await db
  .query("INSERT INTO fishing_catches (user_id, date, catch_key) SELECT user_id, date, 'minnow' FROM fishing_catches WHERE user_id = $1", [uid])
  .then(() => false, () => true);
check("DB: 같은 날 두 번 못 낚음", blocked);
check("최근 기록에 오늘", (await page.locator("[data-fishing-log]").innerText()).length > 0);

// 휴대폰 너비: 목록 2칸, 가로로 넘치지 않는다
{
  const m = await browser.newContext({ viewport: { width: 375, height: 812 }, storageState: await ctx.storageState() });
  const mp = await m.newPage();
  await mp.goto(`${BASE}/fishing`);
  check("휴대폰 375px에서 가로로 넘치지 않음", await mp.evaluate(() => document.documentElement.scrollWidth <= 375));
  await mp.screenshot({ path: `${outDir}/fishing-375.png`, fullPage: true });
  await m.close();
}

// 지갑 내역에 🎣 낚시 (코인을 받았을 때)
if (row.coins > 0) {
  await page.goto(`${BASE}/wallet`);
  check("지갑 내역에 🎣 낚시", (await page.locator("main").innerText()).includes("🎣 낚시"));
}

// 로그인하지 않으면 첫 화면으로
{
  const g = await browser.newContext();
  const gp = await g.newPage();
  await gp.goto(`${BASE}/fishing`);
  check("방문자는 첫 화면으로", new URL(gp.url()).pathname === "/", gp.url());
  await g.close();
}

const pageErrors = errors.filter((e) => e.startsWith("pageerror"));
check("화면 오류 없음", pageErrors.length === 0, pageErrors.join(" | "));
console.log(results.join("\n"));
await db.end();
await browser.close();
if (results.some((r) => r.startsWith("❌"))) process.exit(1);
