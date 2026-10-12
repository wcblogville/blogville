// 연못 낚시터 (사용자 요청 2026-10-08, 2026-10-12 더 풍성하게): 하루 세 번 낚시·입질 타이밍·도감·랭킹, 코인은 원장 fishing, 먹이는 수량 +1, 마을 텔레포트·건물
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

// 낚싯대 던지기 (2026-10-12 "낚시 컨텐츠 더 풍성하게": 하루 3번, 입질 타이밍, 길이, 도감, 이번 주 랭킹)
await page.goto(`${BASE}/fishing`);
// 도감: 모든 칸이 도트 그림(못 낚은 것은 그림자), 그림 글자 없음
const listArt = await page.locator("[data-catch]").evaluateAll((els) =>
  els.map((el) => ({ img: el.querySelector("img.pixelated")?.getAttribute("src")?.startsWith("data:image/svg+xml") ?? false, text: el.textContent })),
);
check("도감 15칸 모두 도트 그림", listArt.length === 15 && listArt.every((a) => a.img), `${listArt.length}칸`);
check("도감에 그림 글자(🐟 👢 🌱 ✨) 없음", listArt.every((a) => !/[🐟🐠👢🌱✨]/u.test(a.text)));
check("처음엔 도감 0 / 15", (await page.locator("[data-dex-count]").innerText()).replace(/\s/g, "") === "0/15");
check("밤·계절 물고기에 언제 나오는지 안내", (await page.locator('[data-catch="catfish"]').innerText()).includes("밤 19시~5시에만"));
check("연못에 찌가 떠 있다 (data-bobber=float)", await page.locator('[data-bobber="float"]').isVisible());
check("오늘 칸 3개 모두 빈 칸", (await page.locator('[data-cast-slot="empty"]').count()) === 3);
await page.screenshot({ path: `${outDir}/fishing-1280.png`, fullPage: true });
const coinsBefore = await coinSum();
const feedBefore = await feedQty();
const result = page.locator("[data-fishing-result]");

// 1번째: 입질을 기다렸다가 딱 맞춰 당긴다 → 타이밍 성공
await page.getByRole("button", { name: /낚싯대 던지기 \(3번 남음\)/ }).click();
await page.locator('[data-fishing-status="waiting"]').waitFor({ timeout: 10000 });
check("던지면 찌를 지켜보라는 안내 (aria-live)", (await page.locator('[data-fishing-status="waiting"]').getAttribute("aria-live")) === "assertive");
await page.locator('[data-bobber="bite"]').waitFor({ timeout: 8000 });
check("입질: 찌가 잠기고 '지금 당기기!'에 초점", await page.getByRole("button", { name: "지금 당기기!" }).evaluate((el) => el === document.activeElement));
await page.locator("[data-pond]").screenshot({ path: `${outDir}/fishing-bite.png` });
await page.screenshot({ path: `${outDir}/fishing-bite-1280.png` });
await page.getByRole("button", { name: "지금 당기기!" }).click();
await result.waitFor({ timeout: 10000 });
await page.waitForTimeout(300);
await page.locator("[data-pond]").screenshot({ path: `${outDir}/fishing-reveal-mid.png` });
await page.waitForTimeout(800);
await page.locator("[data-pond]").screenshot({ path: `${outDir}/fishing-reveal.png` });
check("타이밍 성공 (data-timing=good)", (await result.getAttribute("data-timing")) === "good", await result.getAttribute("data-timing"));
check("낚은 것 도트 그림이 연못 위에 나온다 (data-catch-art)", (await page.locator("[data-catch-art]").getAttribute("data-catch-art")) === (await result.getAttribute("data-fishing-result")));
check("결과에 등급 배지", ["common", "rare", "legendary", "junk"].includes(await result.locator("[data-tier]").getAttribute("data-tier")));
const row1 = await one("SELECT catch_key, coins, size_mm, cast_no FROM fishing_catches WHERE user_id = $1 ORDER BY cast_no DESC LIMIT 1", [uid]);
check("낚시 기록 1행 (cast_no 1)", row1?.catch_key === (await result.getAttribute("data-fishing-result")) && row1.cast_no === 1, row1?.catch_key);
const isFish = row1.size_mm !== null;
if (isFish) check("물고기면 길이가 기록되고 화면에 cm", Number(await result.locator("[data-catch-size]").getAttribute("data-catch-size")) === row1.size_mm && /\d+\.\dcm/.test(await result.innerText()));
if (row1.catch_key === "feed") check("먹이 꾸러미 → 동물 먹이 +1", (await feedQty()) === feedBefore + 1);
else check("코인 → 원장 fishing", (await coinSum()) === coinsBefore + row1.coins && row1.coins > 0, `${coinsBefore} → ${await coinSum()}`);
check("오늘 칸 1개 채워짐", (await page.locator('[data-cast-slot="empty"]').count()) === 2);
await page.screenshot({ path: `${outDir}/fishing.png`, fullPage: true });

// 2번째: 입질 전에 바로 당긴다 (타이밍 없이도 낚인다: 접근성 대체) → early
await page.getByRole("button", { name: /낚싯대 던지기 \(2번 남음\)/ }).click();
await page.locator("[data-reel]").waitFor();
await page.locator("[data-reel]").click();
await result.waitFor({ timeout: 10000 });
check("입질 전에 당겨도 무언가 낚임 (data-timing=early)", (await result.getAttribute("data-timing")) === "early", await result.getAttribute("data-timing"));

// 두 번째까지 기록 확인
const n2 = (await one("SELECT count(*)::int AS n FROM fishing_catches WHERE user_id = $1", [uid])).n;
check("두 번 던지면 2행 (cast_no 1, 2)", n2 === 2);

// 3번째
await page.getByRole("button", { name: /낚싯대 던지기 \(1번 남음\)/ }).click();
await page.locator("[data-reel]").waitFor();
await page.locator('[data-bobber="bite"]').waitFor({ timeout: 8000 });
await page.waitForTimeout(2200); // 입질 창이 지나간 뒤
check("입질 창이 지나면 찌가 다시 뜬다 (missed)", await page.locator('[data-fishing-status="missed"]').isVisible());
await page.locator("[data-reel]").click();
await result.waitFor({ timeout: 10000 });
check("늦게 당기면 data-timing=late", (await result.getAttribute("data-timing")) === "late", await result.getAttribute("data-timing"));
check("세 번 다 던지면 던지기 버튼 없음", (await page.getByRole("button", { name: /낚싯대 던지기/ }).count()) === 0 && (await page.locator("[data-fishing-done]").isVisible()));

// 하루 세 번: 새로고침해도 버튼 없음, DB도 4번째를 막는다
await page.reload();
check("새로고침해도 던지기 버튼 없음, 오늘 칸 3개", (await page.getByRole("button", { name: /낚싯대 던지기/ }).count()) === 0 && (await page.locator('[data-cast-slot="empty"]').count()) === 0);
const blocked = await db
  .query("INSERT INTO fishing_catches (user_id, date, cast_no, catch_key) SELECT user_id, date, 4, 'minnow' FROM fishing_catches WHERE user_id = $1 LIMIT 1", [uid])
  .then(() => false, () => true);
check("DB: 하루 4번째는 CHECK가 막음", blocked);
const dup = await db
  .query("INSERT INTO fishing_catches (user_id, date, cast_no, catch_key) SELECT user_id, date, 1, 'minnow' FROM fishing_catches WHERE user_id = $1 LIMIT 1", [uid])
  .then(() => false, () => true);
check("DB: 같은 낚싯대(cast_no) 두 번 못 받음", dup);
const ledger = (await one("SELECT count(*)::int AS n FROM point_ledger WHERE user_id = $1 AND reason = 'fishing'", [uid])).n;
const coinRows = (await one("SELECT count(*)::int AS n FROM fishing_catches WHERE user_id = $1 AND coins > 0", [uid])).n;
check("원장 fishing 줄 수 = 코인 받은 낚시 수", ledger === coinRows, `${ledger} / ${coinRows}`);

// 도감·최근 기록·랭킹
const kinds = (await one("SELECT count(DISTINCT catch_key)::int AS n FROM fishing_catches WHERE user_id = $1", [uid])).n;
check("도감 숫자 = 낚은 종류 수", (await page.locator("[data-dex-count]").innerText()).replace(/\s/g, "") === `${kinds}/15`);
check("도감: 낚은 칸에 처음 날짜·횟수", (await page.locator('[data-dex-found="1"] [data-dex-entry]').count()) === kinds);
check("최근 기록에 3줄", (await page.locator("[data-fishing-log] li").count()) >= 3);
const fishRows = (await one("SELECT max(size_mm) AS m FROM fishing_catches WHERE user_id = $1", [uid])).m;
if (fishRows) check("이번 주 랭킹에 내 이름", (await page.locator("[data-fish-ranking]").innerText()).includes(N));
else check("랭킹 칸이 보인다", await page.locator("[data-fish-ranking]").isVisible());
await page.screenshot({ path: `${outDir}/fishing-done-1280.png`, fullPage: true });

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
if (row1.coins > 0 || coinRows > 0) {
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
